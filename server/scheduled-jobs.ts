import cron from 'node-cron';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from './db.js';
import { opinions, cumulativeOpinions } from '../shared/schema.js';
import { LexiconAnalysisService } from './services/lexiconAnalysisService.js';
import { log } from './utils/logger.js';
import { TopicService } from './services/topicService.js';
import { OpinionService } from './services/opinionService.js';
import { CumulativeOpinionService } from './services/cumulativeOpinionService.js';
import { DebateService } from './services/debateService.js';
import { OpinionBatchService } from './services/opinionBatchService.js';
import { checkAIHealth, getAIStatus } from './lib/aiConfig.js';

const topicService = new TopicService();
const opinionService = new OpinionService();
const cumulativeOpinionService = new CumulativeOpinionService();
const debateService = new DebateService();
const opinionBatchService = new OpinionBatchService();

export async function runAISummaryUpdate(): Promise<{
  generated: number;
  refreshed: number;
  skipped: number;
  errors: string[];
}> {
  const topicService = new TopicService();
  const opinionService = new OpinionService();
  const cumulativeOpinionService = new CumulativeOpinionService();
  
  const topics = await topicService.getTopics({ limit: 1000 });
  let generated = 0;
  let refreshed = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (const topic of topics) {
    try {
      const opinions = await opinionService.getOpinionsByTopic(topic.id);
      
      if (opinions.length > 0) {
        const existingCumulative = await cumulativeOpinionService.getCumulativeOpinion(topic.id);
        
        const result: any = existingCumulative
          ? await cumulativeOpinionService.refreshCumulativeOpinion(topic.id)
          : await cumulativeOpinionService.generateCumulativeOpinion(topic.id);
        if (result?.usedFallback) {
          // OpenAI failed: say so instead of counting it as a success.
          const msg = `AI summary failed for "${topic.title}": ${getAIStatus().lastFailure?.error ?? 'unknown error'}`;
          log(`[AI Summary] ${msg}`);
          errors.push(msg);
        } else if (existingCumulative) {
          refreshed++;
          log(`[AI Summary] Refreshed summary for topic: ${topic.title}`);
        } else {
          generated++;
          log(`[AI Summary] Generated summary for topic: ${topic.title}`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      const errorMsg = `Error processing topic ${topic.id}: ${error}`;
      log(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  return { generated, refreshed, skipped, errors };
}

/**
 * Supabase keep-alive: free-plan projects pause after ~7 days without activity. Run a tiny real query
 * (not just SELECT 1) against the app's own tables twice a day from this always-on Render service.
 * Free; no extra service. Only works while the Render service is running (e.g. not suspended for billing).
 */
export async function runDbKeepAlive(): Promise<boolean> {
  try {
    const r: any = await db.execute(sql`SELECT count(*)::int AS users, now() AS at FROM users`);
    const row = (r.rows ?? r)[0] ?? {};
    log(`[CRON] DB keep-alive ok (users=${row.users})`);
    return true;
  } catch (error) {
    log(`[CRON ERROR] DB keep-alive failed: ${error}`);
    return false;
  }
}


/** Fill taste/passion scores for older opinions that only have political scores. */
export async function backfillMissingTastePassion(): Promise<number> {
  const rows = await db
    .select()
    .from(opinions)
    .where(
      and(
        or(isNull(opinions.tasteScore), isNull(opinions.passionScore)),
        sql`${opinions.status} IN ('approved', 'pending')`
      )
    );

  if (rows.length === 0) {
    log('[CRON] Taste/passion backfill: nothing to do');
    return 0;
  }

  const lexicon = new LexiconAnalysisService();
  let updated = 0;
  for (const op of rows) {
    try {
      const local = lexicon.analyzeOpinionLocally(op.content);
      await db
        .update(opinions)
        .set({
          tasteScore: op.tasteScore ?? local.taste.score,
          passionScore: op.passionScore ?? local.passion.score,
          analysisConfidence: op.analysisConfidence || local.confidence,
          analyzedAt: op.analyzedAt ?? (sql`now()` as any),
        })
        .where(eq(opinions.id, op.id));
      updated++;
    } catch (error) {
      log(`[CRON] Taste/passion backfill failed for ${op.id}: ${error}`);
    }
  }
  log(`[CRON] Taste/passion backfill updated ${updated} of ${rows.length} opinions`);
  return updated;
}

/**
 * Self-heal after an OpenAI outage (e.g. out of credits): once the API works again, regenerate summaries
 * that were saved as the vote-count fallback, and fill in missing compass/tint distributions.
 * Capped per run to respect the AI cost guardrails.
 */
export async function repairFallbackSummaries(maxTopics = 40): Promise<{ regenerated: number; failed: number; distributions: number }> {
  const health = await checkAIHealth();
  const rows = await db
    .select({ topicId: cumulativeOpinions.topicId, summary: cumulativeOpinions.summary, pd: cumulativeOpinions.politicalDistribution })
    .from(cumulativeOpinions);
  let regenerated = 0, failed = 0, distributions = 0;
  for (const row of rows) {
    const isFallback = !row.summary || row.summary.startsWith('Based on ') || row.summary.startsWith('Mock AI summary');
    try {
      if (isFallback && health.ok && regenerated + failed < maxTopics) {
        const r: any = await cumulativeOpinionService.generateCumulativeOpinion(row.topicId);
        if (r?.usedFallback) failed++; else regenerated++;
      } else if (!row.pd) {
        await opinionService.recalculateTopicDistributionNow(row.topicId);
        distributions++;
      }
    } catch (error) {
      failed++;
      log(`[AI Summary] Repair failed for ${row.topicId}: ${error}`);
    }
  }
  // Profile compasses that were never analyzed (the analysis used to be a stub).
  let profiles = 0;
  if (health.ok) {
    const never: any = await db.execute(sql`
      SELECT p.user_id FROM user_profiles p
      WHERE p.last_analyzed_at IS NULL
        AND EXISTS (SELECT 1 FROM opinions o WHERE o.user_id = p.user_id AND o.status IN ('approved','pending'))
      LIMIT 25`);
    for (const r of (never.rows ?? never)) {
      if (await opinionService.analyzeUserPoliticalCompass(r.user_id)) profiles++;
    }
  }
  log(`[CRON] Profile compass backfill: ${profiles} analyzed`);
  log(`[CRON] Summary repair: ${regenerated} regenerated, ${failed} failed, ${distributions} distributions filled (AI ${health.ok ? 'ok' : 'unavailable: ' + health.error})`);
  return { regenerated, failed, distributions };
}

/** Regenerate stored summaries that are missing sentence-level opinion citations. */
export async function backfillMissingSummarySentences(): Promise<{ updated: number; errors: string[] }> {
  const missing = await db
    .select({ topicId: cumulativeOpinions.topicId })
    .from(cumulativeOpinions)
    .where(or(isNull(cumulativeOpinions.summarySentences), sql`${cumulativeOpinions.summarySentences} = 'null'::jsonb`));

  const errors: string[] = [];
  let updated = 0;
  const service = new CumulativeOpinionService();
  for (const row of missing) {
    try {
      await service.generateCumulativeOpinion(row.topicId);
      updated++;
      log(`[AI Summary] Backfilled sentence citations for topic ${row.topicId}`);
    } catch (error) {
      const msg = `Failed sentence backfill for ${row.topicId}: ${error}`;
      log(`[AI Summary] ${msg}`);
      errors.push(msg);
    }
  }
  log(`[CRON] Summary sentence backfill: ${updated} updated, ${errors.length} failed, ${missing.length} missing`);
  return { updated, errors };
}

export function startScheduledJobs() {
  cron.schedule('17 */12 * * *', () => { void runDbKeepAlive(); }, { timezone: 'UTC' });
  log('[CRON] Scheduled Supabase keep-alive every 12 hours');
  setTimeout(() => { void runDbKeepAlive(); }, 60_000); // once shortly after each deploy/restart
  setTimeout(() => {
    void (async () => {
      try {
        await backfillMissingTastePassion();
      } catch (error) {
        log(`[CRON ERROR] Taste/passion backfill failed: ${error}`);
      }
      try {
        await backfillMissingSummarySentences();
      } catch (error) {
        log(`[CRON ERROR] Summary sentence backfill failed: ${error}`);
      }
      try {
        await repairFallbackSummaries();
      } catch (error) {
        log(`[CRON ERROR] Summary repair failed: ${error}`);
      }
    })();
  }, 90_000);

  cron.schedule('0 2 * * *', async () => {
    log('[CRON] Starting daily AI summary update at 2:00 AM');
    const result = await runAISummaryUpdate();
    log(`[CRON] Daily AI summary update completed - Generated: ${result.generated}, Refreshed: ${result.refreshed}, Skipped: ${result.skipped}, Failed: ${result.errors.length}`);
  }, {
    timezone: process.env.CRON_TZ || 'UTC'
  });

  log('[CRON] Scheduled daily AI summary update at 2:00 AM ' + (process.env.CRON_TZ || 'UTC'));

  // Batch process opinions for political scores every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    log('[CRON] Processing opinion batch for political scores');
    try {
      await opinionBatchService.processPendingOpinions();
    } catch (error) {
      log(`[CRON ERROR] Batch processing failed: ${error}`);
      // TODO: Send alert to monitoring system
    }
  });

  log('[CRON] Scheduled batch opinion processing every 5 minutes');

  // Auto-archive ended debates with no activity for 7 days
  cron.schedule('0 3 * * *', async () => {
    log('[CRON] Starting auto-archive of inactive ended debates at 3:00 AM');
    
    try {
      // Get all ended debates that haven't had messages in 7 days
      const endedRooms = await debateService.getEndedDebatesForArchiving(7);
      
      let archived = 0;
      for (const room of endedRooms) {
        try {
          await debateService.archiveDebateRoom(room.id);
          archived++;
          log(`[CRON] Archived debate room: ${room.id}`);
        } catch (error) {
          log(`[CRON] Error archiving debate room ${room.id}: ${error}`);
        }
      }
      
      log(`[CRON] Auto-archive completed - Archived: ${archived} debates`);
    } catch (error) {
      log(`[CRON] Error in auto-archive job: ${error}`);
    }
  }, {
    timezone: process.env.CRON_TZ || 'UTC'
  });

  log('[CRON] Scheduled auto-archive of inactive debates at 3:00 AM ' + (process.env.CRON_TZ || 'UTC'));
}

import cron from 'node-cron';
import { log } from './utils/logger.js';
import { TopicService } from './services/topicService.js';
import { OpinionService } from './services/opinionService.js';
import { CumulativeOpinionService } from './services/cumulativeOpinionService.js';
import { DebateService } from './services/debateService.js';
import { OpinionBatchService } from './services/opinionBatchService.js';

const topicService = new TopicService();
const opinionService = new OpinionService();
const cumulativeOpinionService = new CumulativeOpinionService();
const debateService = new DebateService();
const opinionBatchService = new OpinionBatchService();

export function startScheduledJobs() {
  cron.schedule('0 2 * * *', async () => {
    log('[CRON] Starting daily AI summary update at 2:00 AM');
    
    try {
      const topics = await topicService.getTopics({ limit: 1000 });
      let generated = 0;
      let refreshed = 0;
      let skipped = 0;
      
      for (const topic of topics) {
        try {
          const opinions = await opinionService.getOpinionsByTopic(topic.id);
          
          if (opinions.length > 0) {
            const existingCumulative = await cumulativeOpinionService.getCumulativeOpinion(topic.id);
            
            if (existingCumulative) {
              await cumulativeOpinionService.refreshCumulativeOpinion(topic.id);
              refreshed++;
              log(`[CRON] Refreshed AI summary for topic: ${topic.title}`);
            } else {
              await cumulativeOpinionService.generateCumulativeOpinion(topic.id);
              generated++;
              log(`[CRON] Generated AI summary for topic: ${topic.title}`);
            }
          } else {
            skipped++;
          }
        } catch (error) {
          log(`[CRON] Error processing topic ${topic.id}: ${error}`);
        }
      }
      
      log(`[CRON] Daily AI summary update completed - Generated: ${generated}, Refreshed: ${refreshed}, Skipped: ${skipped}`);
    } catch (error) {
      log(`[CRON] Error in scheduled job: ${error}`);
    }
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

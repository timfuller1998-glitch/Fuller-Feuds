import cron from 'node-cron';
import { storage } from './storage';
import { log } from './vite';

export function startScheduledJobs() {
  cron.schedule('0 2 * * *', async () => {
    log('[CRON] Starting daily AI summary update at 2:00 AM');
    
    try {
      const topics = await storage.getTopics({ limit: 1000 });
      let generated = 0;
      let refreshed = 0;
      let skipped = 0;
      
      for (const topic of topics) {
        try {
          const opinions = await storage.getOpinionsByTopic(topic.id);
          
          if (opinions.length > 0) {
            const existingCumulative = await storage.getCumulativeOpinion(topic.id);
            
            if (existingCumulative) {
              await storage.refreshCumulativeOpinion(topic.id);
              refreshed++;
              log(`[CRON] Refreshed AI summary for topic: ${topic.title}`);
            } else {
              await storage.generateCumulativeOpinion(topic.id);
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
}

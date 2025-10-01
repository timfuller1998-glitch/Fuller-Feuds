import cron from 'node-cron';
import { storage } from './storage';

export function startScheduledJobs() {
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting daily AI summary refresh at 2 AM');
    
    try {
      const topics = await storage.getTopics(1000);
      
      for (const topic of topics) {
        try {
          const opinions = await storage.getOpinionsByTopic(topic.id);
          
          if (opinions.length > 0) {
            const existingCumulative = await storage.getCumulativeOpinion(topic.id);
            
            if (existingCumulative) {
              await storage.refreshCumulativeOpinion(topic.id);
              console.log(`[CRON] Refreshed AI summary for topic: ${topic.title}`);
            }
          }
        } catch (error) {
          console.error(`[CRON] Error refreshing summary for topic ${topic.id}:`, error);
        }
      }
      
      console.log('[CRON] Daily AI summary refresh completed');
    } catch (error) {
      console.error('[CRON] Error in scheduled job:', error);
    }
  });

  console.log('[CRON] Scheduled daily AI summary refresh at 2:00 AM');
}

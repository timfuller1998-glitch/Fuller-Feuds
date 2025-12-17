import { Router } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { getCacheStats } from '../services/cacheService';
import { requireAdmin } from '../middleware/auth';

const router = Router();
const analyticsService = new AnalyticsService();

// GET /api/stats/platform - Get platform statistics
router.get('/platform', async (req, res) => {
  try {
    const stats = await analyticsService.getPlatformStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    res.status(500).json({ message: "Failed to fetch platform statistics" });
  }
});

// GET /api/stats/cache - Get cache statistics (admin only)
router.get('/cache', requireAdmin, async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    res.status(500).json({ message: "Failed to fetch cache statistics" });
  }
});

export default router;

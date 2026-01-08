/**
 * Health Check Routes
 * 
 * Provides endpoints for monitoring database health, connection pool metrics,
 * and query performance statistics.
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth, getConnectionPoolMetrics, getQueryPerformanceStats } from '../utils/dbMonitoring.js';
import { getConnectionStringInfo } from '../utils/connectionRotation.js';

const router = Router();

/**
 * GET /api/health/db
 * Database connection health check
 */
router.get('/db', async (req: Request, res: Response) => {
  try {
    const health = await checkDatabaseHealth();
    const statusCode = health.healthy ? 200 : 503;

    res.status(statusCode).json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      connection: health.connectionOk ? 'ok' : 'failed',
      timestamp: new Date().toISOString(),
      error: health.error,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/db/pool
 * Connection pool metrics
 */
router.get('/db/pool', async (req: Request, res: Response) => {
  try {
    const metrics = await getConnectionPoolMetrics();
    const connectionInfo = getConnectionStringInfo();

    res.json({
      pool: metrics,
      connectionInfo: connectionInfo ? {
        hostname: connectionInfo.hostname,
        port: connectionInfo.port,
        database: connectionInfo.database,
        isPooler: connectionInfo.isPooler,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/db/performance
 * Query performance statistics
 */
router.get('/db/performance', async (req: Request, res: Response) => {
  try {
    const stats = getQueryPerformanceStats();

    res.json({
      performance: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health
 * General health check
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    const overallHealth = dbHealth.healthy;

    res.status(overallHealth ? 200 : 503).json({
      status: overallHealth ? 'healthy' : 'unhealthy',
      services: {
        database: dbHealth.healthy ? 'healthy' : 'unhealthy',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;


/**
 * Database Connection Monitoring
 * 
 * Provides monitoring utilities for database connections including
 * connection pool metrics, query performance tracking, and health checks.
 */

import { pool, checkDbConnection } from '../db.js';
import { log } from './logger.js';

export interface ConnectionPoolMetrics {
  active: number;
  idle: number;
  waiting: number;
  total: number;
}

export interface QueryPerformanceStats {
  totalQueries: number;
  avgQueryTime: number;
  slowQueries: number; // Queries > 1000ms
  errorCount: number;
}

// In-memory performance tracking (for simple implementation)
// In production, consider using a proper metrics collection system
let performanceStats: QueryPerformanceStats = {
  totalQueries: 0,
  avgQueryTime: 0,
  slowQueries: 0,
  errorCount: 0,
};

let queryTimes: number[] = []; // Keep last 1000 query times
const MAX_QUERY_TIMES = 1000;

/**
 * Track query performance
 */
export function trackQuery(queryTimeMs: number, isError: boolean = false): void {
  performanceStats.totalQueries++;
  
  if (isError) {
    performanceStats.errorCount++;
    return;
  }

  // Add to query times array
  queryTimes.push(queryTimeMs);
  if (queryTimes.length > MAX_QUERY_TIMES) {
    queryTimes.shift(); // Remove oldest
  }

  // Calculate average
  const sum = queryTimes.reduce((a, b) => a + b, 0);
  performanceStats.avgQueryTime = sum / queryTimes.length;

  // Track slow queries (> 1000ms)
  if (queryTimeMs > 1000) {
    performanceStats.slowQueries++;
    log('Slow query detected', 'db-monitoring', 'warn', {
      queryTimeMs,
      avgQueryTime: performanceStats.avgQueryTime,
    });
  }
}

/**
 * Get connection pool metrics
 * Note: postgres-js doesn't expose detailed pool metrics directly
 * This is a simplified implementation
 */
export async function getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
  try {
    // postgres-js doesn't expose pool metrics directly
    // This is a placeholder - in production you might want to track this manually
    // or use a connection pool that exposes metrics
    
    // For now, return basic stats
    return {
      active: 0, // Not directly available from postgres-js
      idle: 0,
      waiting: 0,
      total: 0,
    };
  } catch (error) {
    log('Error getting connection pool metrics', 'db-monitoring', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      active: 0,
      idle: 0,
      waiting: 0,
      total: 0,
    };
  }
}

/**
 * Get query performance statistics
 */
export function getQueryPerformanceStats(): QueryPerformanceStats {
  return { ...performanceStats };
}

/**
 * Reset performance statistics
 */
export function resetPerformanceStats(): void {
  performanceStats = {
    totalQueries: 0,
    avgQueryTime: 0,
    slowQueries: 0,
    errorCount: 0,
  };
  queryTimes = [];
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  connectionOk: boolean;
  performanceStats: QueryPerformanceStats;
  error?: string;
}> {
  try {
    const connectionOk = await checkDbConnection();
    const stats = getQueryPerformanceStats();

    return {
      healthy: connectionOk,
      connectionOk,
      performanceStats: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      connectionOk: false,
      performanceStats: getQueryPerformanceStats(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


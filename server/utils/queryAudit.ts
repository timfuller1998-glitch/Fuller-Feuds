/**
 * Query Audit Utilities
 * 
 * Provides utilities for logging sensitive database operations,
 * tracking data access patterns, and detecting anomalies.
 */

import { logSecurityEvent, logDatabaseOperation, type DatabaseOperationContext } from './securityLogger.js';
import { trackQuery } from './dbMonitoring.js';
import type { Request } from 'express';

// List of sensitive tables that should always be logged
const SENSITIVE_TABLES = [
  'user_profiles',
  'users',
  'debate_rooms',
  'debate_messages',
  'debate_votes',
  'opinion_votes',
  'notifications',
  'push_subscriptions',
  'topic_views',
  'user_follows',
];

/**
 * Check if a table is considered sensitive
 */
export function isSensitiveTable(tableName: string): boolean {
  return SENSITIVE_TABLES.includes(tableName);
}

/**
 * Log a sensitive database query
 */
export function logSensitiveQuery(context: DatabaseOperationContext & {
  req?: Request;
}): void {
  // Log using security logger
  logDatabaseOperation(context);

  // Track query performance
  if (context.queryTimeMs) {
    trackQuery(context.queryTimeMs, false);
  }

  // Log security event if accessing sensitive data
  if (context.tableName && isSensitiveTable(context.tableName)) {
    logSecurityEvent('info', 'data_access', {
      userId: context.userId,
      userRole: context.userRole,
      action: context.action,
      resourceType: context.tableName,
      resourceId: context.resourceId,
      ipAddress: context.ipAddress || (context.req ? (context.req.ip || context.req.connection?.remoteAddress) : undefined),
      userAgent: context.userAgent || context.req?.headers['user-agent'],
      requestId: context.requestId || context.req?.id,
      metadata: {
        operation: context.operation,
        queryTimeMs: context.queryTimeMs,
        rowsAffected: context.rowsAffected,
      },
    });
  }
}

/**
 * Audit data access patterns
 */
export function auditDataAccess(context: {
  userId?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  accessLevel: 'read' | 'write' | 'delete';
  req?: Request;
}): void {
  logSecurityEvent('info', 'data_access', {
    userId: context.userId,
    userRole: context.userRole,
    action: context.action,
    resourceType: context.resourceType,
    resourceId: context.resourceId,
    ipAddress: context.req ? (context.req.ip || context.req.connection?.remoteAddress) : undefined,
    userAgent: context.req?.headers['user-agent'],
    requestId: context.req?.id,
    metadata: {
      accessLevel: context.accessLevel,
    },
  });
}

/**
 * Detect anomalies in access patterns
 * This is a simplified implementation - in production, you might want to use
 * machine learning or more sophisticated pattern detection
 */
export interface AnomalyDetectionResult {
  hasAnomaly: boolean;
  anomalies: string[];
}

export function detectAnomalies(context: {
  userId?: string;
  action: string;
  resourceType: string;
  queryTimeMs?: number;
  rowsAffected?: number;
}): AnomalyDetectionResult {
  const anomalies: string[] = [];

  // Detect unusually slow queries (> 5000ms)
  if (context.queryTimeMs && context.queryTimeMs > 5000) {
    anomalies.push(`Unusually slow query: ${context.queryTimeMs}ms`);
  }

  // Detect bulk data access (> 1000 rows)
  if (context.rowsAffected && context.rowsAffected > 1000) {
    anomalies.push(`Large data access: ${context.rowsAffected} rows`);
  }

  // In production, you might add:
  // - Unusual access times (e.g., 2am access)
  // - Unusual access patterns (e.g., accessing many different user profiles)
  // - Rate limit violations
  // - Geographic anomalies (access from unusual location)

  return {
    hasAnomaly: anomalies.length > 0,
    anomalies,
  };
}


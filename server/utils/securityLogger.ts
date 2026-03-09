/**
 * Structured Security Logging Utility
 * 
 * Provides comprehensive security event logging with structured JSON output,
 * categorization, and integration with the existing logger system.
 */

import { log } from './logger.js';

export type SecurityEventType =
  | 'auth_failure'
  | 'auth_success'
  | 'unauthorized_access'
  | 'authorization_failure'
  | 'data_access'
  | 'data_modification'
  | 'database_operation'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'security_config_change'
  | 'other';

export type LogLevel = 'info' | 'warn' | 'error' | 'security';

export interface SecurityEventContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface DataAccessContext extends SecurityEventContext {
  dataFields?: string[];
  accessLevel?: 'read' | 'write' | 'delete';
}

export interface AuthorizationFailureContext extends SecurityEventContext {
  reason: string;
  attemptedAction: string;
  requiredPermission?: string;
}

export interface DatabaseOperationContext extends SecurityEventContext {
  tableName?: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  queryTimeMs?: number;
  rowsAffected?: number;
}

/**
 * Sanitize sensitive data from log context
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'passwordHash', 'auth', 'p256dh', 'endpoint', 'token', 'secret'];
  const sanitized = { ...context };

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value);
    }
  }

  return sanitized;
}

/**
 * Format security event as structured JSON log entry
 */
function formatSecurityLog(
  level: LogLevel,
  eventType: SecurityEventType,
  context: SecurityEventContext
): string {
  const logEntry = {
    level,
    type: 'security',
    eventType,
    timestamp: context.timestamp || new Date().toISOString(),
    userId: context.userId,
    userEmail: context.userEmail ? context.userEmail.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
    userRole: context.userRole,
    action: context.action,
    resourceType: context.resourceType,
    resourceId: context.resourceId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    error: context.error,
    errorCode: context.errorCode,
    metadata: context.metadata ? sanitizeContext(context.metadata) : undefined,
  };

  return JSON.stringify(logEntry);
}

/**
 * Log a security-related event
 */
export function logSecurityEvent(
  level: LogLevel,
  eventType: SecurityEventType,
  context: SecurityEventContext
): void {
  try {
    const logMessage = formatSecurityLog(level, eventType, context);
    
    // Use appropriate console method based on level
    switch (level) {
      case 'error':
        console.error(`[SECURITY] ${logMessage}`);
        break;
      case 'warn':
        console.warn(`[SECURITY] ${logMessage}`);
        break;
      case 'security':
        console.warn(`[SECURITY] ${logMessage}`); // Use warn for security events
        break;
      default:
        console.log(`[SECURITY] ${logMessage}`);
    }

    // Also use existing logger for consistency
    log(`Security Event: ${eventType} - ${context.action}`, 'security');
  } catch (error) {
    // Fail silently to prevent logging errors from breaking the application
    console.error('[SecurityLogger] Error logging security event:', error);
  }
}

/**
 * Log data access events for sensitive data
 */
export function logDataAccess(context: DataAccessContext): void {
  logSecurityEvent('info', 'data_access', {
    ...context,
    metadata: {
      ...context.metadata,
      dataFields: context.dataFields,
      accessLevel: context.accessLevel,
    },
  });
}

/**
 * Log authorization failure events
 */
export function logAuthorizationFailure(context: AuthorizationFailureContext): void {
  logSecurityEvent('warn', 'authorization_failure', {
    ...context,
    metadata: {
      ...context.metadata,
      reason: context.reason,
      attemptedAction: context.attemptedAction,
      requiredPermission: context.requiredPermission,
    },
  });
}

/**
 * Log database operations on sensitive tables
 */
export function logDatabaseOperation(context: DatabaseOperationContext): void {
  logSecurityEvent('info', 'database_operation', {
    ...context,
    metadata: {
      ...context.metadata,
      tableName: context.tableName,
      operation: context.operation,
      queryTimeMs: context.queryTimeMs,
      rowsAffected: context.rowsAffected,
    },
  });
}

/**
 * Extract request context from Express request object
 */
export function extractRequestContext(req: any): Partial<SecurityEventContext> {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: req.headers['user-agent'],
    requestId: req.id || req.headers['x-request-id'],
    userId: req.user?.id,
    userEmail: req.user?.email,
    userRole: req.userRole,
  };
}


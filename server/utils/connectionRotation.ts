/**
 * Connection String Rotation System
 * 
 * Provides utilities for managing and rotating database connection strings
 * with validation, health checking, and logging.
 */

import { log, type LogContext } from './logger.js';
import { logSecurityEvent } from './securityLogger.js';

export interface ConnectionStringInfo {
  hostname: string;
  port: string;
  database: string;
  user: string;
  isPooler: boolean;
  isValid: boolean;
}

/**
 * Mask connection string for logging (hides password)
 */
export function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      return `${url.protocol}//${url.username}:***@${url.hostname}:${url.port}${url.pathname}`;
    }
    return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`;
  } catch (error) {
    return '[INVALID_CONNECTION_STRING]';
  }
}

/**
 * Parse and validate connection string
 */
export function parseConnectionString(connectionString: string): ConnectionStringInfo | null {
  try {
    const url = new URL(connectionString);
    
    if (!url.protocol.startsWith('postgres')) {
      log('Invalid connection string protocol', 'connection-rotation', 'error', {
        protocol: url.protocol,
      });
      return null;
    }

    const hostname = url.hostname;
    const port = url.port || (url.protocol === 'postgresql:' ? '5432' : '6543');
    const database = url.pathname.replace('/', '') || 'postgres';
    const user = url.username || 'postgres';
    
    // Check if it's a pooler connection (pooler URLs typically have 'pooler' in hostname)
    const isPooler = hostname.includes('pooler') || port === '6543';

    return {
      hostname,
      port,
      database,
      user,
      isPooler,
      isValid: true,
    };
  } catch (error) {
    log('Failed to parse connection string', 'connection-rotation', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Validate connection string format
 */
export function validateConnectionString(connectionString: string): boolean {
  const parsed = parseConnectionString(connectionString);
  return parsed !== null && parsed.isValid;
}

/**
 * Health check a connection string (basic validation)
 */
export async function healthCheckConnection(connectionString: string): Promise<boolean> {
  try {
    // Basic validation - just check if we can parse it
    const parsed = parseConnectionString(connectionString);
    return parsed !== null && parsed.isValid;
  } catch (error) {
    log('Connection health check failed', 'connection-rotation', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Log connection string access (masked for security)
 */
export function logConnectionStringAccess(action: string, context?: LogContext): void {
  const maskedUrl = process.env.DATABASE_URL 
    ? maskConnectionString(process.env.DATABASE_URL)
    : '[NOT_SET]';

  logSecurityEvent('info', 'security_config_change', {
    action: `connection_string_${action}`,
    metadata: {
      ...context,
      connectionStringMasked: maskedUrl,
    },
  });

  log(`Connection string access: ${action}`, 'connection-rotation', 'info', {
    ...context,
    connectionStringMasked: maskedUrl,
  });
}

/**
 * Rotate connection string (validate new one before using)
 */
export async function rotateConnectionString(
  newConnectionString: string,
  oldConnectionString?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logConnectionStringAccess('rotation_attempt');

    // Validate new connection string
    if (!validateConnectionString(newConnectionString)) {
      const error = 'New connection string is invalid';
      logConnectionStringAccess('rotation_failed', { error });
      return { success: false, error };
    }

    // Health check new connection
    const isHealthy = await healthCheckConnection(newConnectionString);
    if (!isHealthy) {
      const error = 'New connection string failed health check';
      logConnectionStringAccess('rotation_failed', { error });
      return { success: false, error };
    }

    // Log rotation success
    logConnectionStringAccess('rotation_success');

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logConnectionStringAccess('rotation_error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Get connection string info for monitoring
 */
export function getConnectionStringInfo(): ConnectionStringInfo | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  return parseConnectionString(connectionString);
}


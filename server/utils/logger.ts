export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  [key: string]: any;
}

/**
 * Sanitize sensitive data from log context
 */
function sanitizeContext(context: LogContext): LogContext {
  const sensitiveKeys = ['password', 'passwordHash', 'auth', 'p256dh', 'endpoint', 'token', 'secret'];
  const sanitized = { ...context };

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeContext(value);
    }
  }

  return sanitized;
}

/**
 * Enhanced logger with structured logging support
 */
export function log(
  message: string,
  source: string = "express",
  level: LogLevel = 'info',
  context?: LogContext
) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const timestamp = new Date().toISOString();

  // If context is provided, use structured logging
  if (context) {
    const sanitizedContext = sanitizeContext(context);
    const logEntry = {
      timestamp,
      level,
      source,
      message,
      ...sanitizedContext,
    };

    const logLine = `${formattedTime} [${source}] ${message} ${JSON.stringify(sanitizedContext)}`;

    switch (level) {
      case 'error':
        console.error(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(logLine);
        }
        break;
      default:
        console.log(logLine);
    }
  } else {
    // Simple string logging for backward compatibility
    const logLine = `${formattedTime} [${source}] ${message}`;

    switch (level) {
      case 'error':
        console.error(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(logLine);
        }
        break;
      default:
        console.log(logLine);
    }
  }
}

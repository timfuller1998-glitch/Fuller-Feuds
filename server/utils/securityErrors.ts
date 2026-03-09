/**
 * Security Error Classes
 * 
 * Custom error classes for security events with automatic logging
 * and structured error information.
 */

import { logAuthorizationFailure, logSecurityEvent, extractRequestContext } from './securityLogger.js';
import type { Request } from 'express';

export class SecurityError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userContext?: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
  };
  public readonly resource?: {
    type?: string;
    id?: string;
  };
  public readonly action?: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();

    if (context) {
      this.userContext = {
        userId: context.userId,
        userEmail: context.userEmail,
        userRole: context.userRole,
      };
      this.resource = {
        type: context.resourceType,
        id: context.resourceId,
      };
      this.action = context.action;
    }

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Unauthorized Error (401)
 * User is not authenticated
 */
export class UnauthorizedError extends SecurityError {
  constructor(
    message: string = 'Authentication required',
    context?: {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      req?: Request;
    }
  ) {
    super(message, 'UNAUTHORIZED', 401, context);

    // Auto-log the error
    const requestContext = context?.req ? extractRequestContext(context.req) : {};
    logSecurityEvent('warn', 'auth_failure', {
      userId: context?.userId,
      userEmail: context?.userEmail,
      userRole: context?.userRole,
      action: context?.action || 'authenticate',
      resourceType: context?.resourceType,
      resourceId: context?.resourceId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      error: message,
      errorCode: 'UNAUTHORIZED',
    });
  }
}

/**
 * Forbidden Error (403)
 * User is authenticated but lacks permission
 */
export class ForbiddenError extends SecurityError {
  public readonly reason: string;
  public readonly requiredPermission?: string;

  constructor(
    message: string = 'Access forbidden',
    reason: string = 'insufficient_permissions',
    context?: {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      requiredPermission?: string;
      req?: Request;
    }
  ) {
    super(message, 'FORBIDDEN', 403, context);
    this.reason = reason;
    this.requiredPermission = context?.requiredPermission;

    // Auto-log the error
    const requestContext = context?.req ? extractRequestContext(context.req) : {};
    logAuthorizationFailure({
      userId: context?.userId,
      userEmail: context?.userEmail,
      userRole: context?.userRole,
      action: context?.action || 'access_resource',
      resourceType: context?.resourceType,
      resourceId: context?.resourceId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      reason,
      attemptedAction: context?.action || 'access_resource',
      requiredPermission: context?.requiredPermission,
      error: message,
      errorCode: 'FORBIDDEN',
    });
  }
}

/**
 * Authorization Error
 * Failed authorization check (user doesn't own resource, etc.)
 */
export class AuthorizationError extends SecurityError {
  public readonly reason: string;

  constructor(
    message: string,
    reason: string = 'authorization_failed',
    context?: {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      req?: Request;
    }
  ) {
    super(message, 'AUTHORIZATION_FAILED', 403, context);
    this.reason = reason;

    // Auto-log the error
    const requestContext = context?.req ? extractRequestContext(context.req) : {};
    logAuthorizationFailure({
      userId: context?.userId,
      userEmail: context?.userEmail,
      userRole: context?.userRole,
      action: context?.action || 'authorize',
      resourceType: context?.resourceType,
      resourceId: context?.resourceId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      reason,
      attemptedAction: context?.action || 'authorize',
      error: message,
      errorCode: 'AUTHORIZATION_FAILED',
    });
  }
}

/**
 * Data Access Error
 * Unauthorized data access attempt
 */
export class DataAccessError extends SecurityError {
  public readonly dataType: string;

  constructor(
    message: string,
    dataType: string,
    context?: {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      req?: Request;
    }
  ) {
    super(message, 'DATA_ACCESS_DENIED', 403, {
      ...context,
      resourceType: dataType,
    });
    this.dataType = dataType;

    // Auto-log the error
    const requestContext = context?.req ? extractRequestContext(context.req) : {};
    logSecurityEvent('warn', 'unauthorized_access', {
      userId: context?.userId,
      userEmail: context?.userEmail,
      userRole: context?.userRole,
      action: context?.action || 'access_data',
      resourceType: dataType,
      resourceId: context?.resourceId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      error: message,
      errorCode: 'DATA_ACCESS_DENIED',
    });
  }
}


import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logSecurityEvent, extractRequestContext } from '../utils/securityLogger.js';

// Extend Express Request to include user role
declare global {
  namespace Express {
    interface Request {
      userRole?: string;
      userStatus?: string;
      id?: string; // Request ID for tracing
    }
  }
}

// Middleware to check if user is authenticated
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'auth_failure', {
      action: 'require_auth',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to fetch and attach user role
export async function attachUserRole(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }

  try {
    const user = req.user as Express.User;
    if (!user || !user.id) return next();

    // User object already has role and status from passport deserialization
    req.userRole = user.role || 'user';
    req.userStatus = user.status || 'active';
  } catch (error) {
    console.error('Error fetching user role:', error);
  }

  next();
}

// Middleware to check if user is admin or moderator
export function requireModerator(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'auth_failure', {
      action: 'require_moderator',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userRole !== 'admin' && req.userRole !== 'moderator') {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: (req.user as any)?.id,
      userRole: req.userRole,
      action: 'moderate',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Insufficient permissions. Moderator or admin role required.',
      errorCode: 'FORBIDDEN',
      metadata: {
        path: req.path,
        method: req.method,
        requiredPermission: 'moderator',
      },
    });

    return res.status(403).json({ error: 'Insufficient permissions. Moderator or admin role required.' });
  }

  next();
}

// Middleware to check if user is admin only
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'auth_failure', {
      action: 'require_admin',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userRole !== 'admin') {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: (req.user as any)?.id,
      userRole: req.userRole,
      action: 'admin_access',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Insufficient permissions. Admin role required.',
      errorCode: 'FORBIDDEN',
      metadata: {
        path: req.path,
        method: req.method,
        requiredPermission: 'admin',
      },
    });

    return res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
  }

  next();
}

// Middleware to check if user account is active
export function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'auth_failure', {
      action: 'require_active_account',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userStatus === 'suspended') {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: (req.user as any)?.id,
      userStatus: req.userStatus,
      action: 'access_with_suspended_account',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Account suspended',
      errorCode: 'ACCOUNT_SUSPENDED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(403).json({ error: 'Your account has been suspended' });
  }

  if (req.userStatus === 'banned') {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: (req.user as any)?.id,
      userStatus: req.userStatus,
      action: 'access_with_banned_account',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Account banned',
      errorCode: 'ACCOUNT_BANNED',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    return res.status(403).json({ error: 'Your account has been banned' });
  }

  next();
}

// Helper function to check if user is admin or moderator (for conditional logic)
export function isModeratorOrAdmin(role?: string): boolean {
  return role === 'admin' || role === 'moderator';
}

// Helper function to check if user is admin (for conditional logic)
export function isAdmin(role?: string): boolean {
  return role === 'admin';
}

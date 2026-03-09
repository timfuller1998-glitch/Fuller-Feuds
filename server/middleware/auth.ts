import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logSecurityEvent, extractRequestContext } from '../utils/securityLogger.js';
import { UnauthorizedError } from '../utils/securityErrors.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      role: string | null;
      status: string | null;
    }

    interface Request {
      userRole?: string;
      id?: string; // Request ID for tracing
    }
  }
}

// Middleware to generate and attach request ID for tracing
export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'auth_failure', {
      action: 'authenticate',
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
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
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
};

export const requireModerator = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.userRole !== 'moderator' && req.userRole !== 'admin')) {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: req.user?.id,
      userRole: req.userRole,
      action: 'moderate',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Moderator access required',
      errorCode: 'FORBIDDEN',
      metadata: {
        path: req.path,
        method: req.method,
        requiredPermission: 'moderator',
      },
    });

    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.userRole !== 'admin') {
    const requestContext = extractRequestContext(req);
    
    logSecurityEvent('warn', 'authorization_failure', {
      userId: req.user?.id,
      userRole: req.userRole,
      action: 'admin_access',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId || req.id,
      error: 'Admin access required',
      errorCode: 'FORBIDDEN',
      metadata: {
        path: req.path,
        method: req.method,
        requiredPermission: 'admin',
      },
    });

    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireActiveAccount = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement account status checking
  next();
};

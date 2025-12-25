import { Request, Response, NextFunction } from 'express';

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
    }
  }
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // #region agent log
  const authData = {
    hasIsAuthenticated: typeof req.isAuthenticated === 'function',
    isAuthenticatedResult: typeof req.isAuthenticated === 'function' ? req.isAuthenticated() : undefined,
    hasSession: !!req.session,
    sessionId: (req.session as any)?.id,
    sessionCookie: (req.session as any)?.cookie,
    hasUser: !!req.user,
    userId: (req.user as any)?.id,
    cookies: Object.keys(req.cookies || {}),
    cookieHeader: req.get('cookie')?.substring(0, 200),
    path: req.path,
    method: req.method,
  };
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware/auth.ts:21',message:'isAuthenticated middleware check',data:authData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware/auth.ts:25',message:'Authentication failed',data:{hasIsAuthenticated:typeof req.isAuthenticated==='function',hasSession:!!req.session,sessionId:(req.session as any)?.id,cookieHeader:req.get('cookie')?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireModerator = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.userRole !== 'moderator' && req.userRole !== 'admin')) {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireActiveAccount = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement account status checking
  next();
};

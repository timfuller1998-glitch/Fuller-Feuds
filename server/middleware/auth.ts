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
  if (!req.isAuthenticated || !req.isAuthenticated()) {
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

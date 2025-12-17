import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request to include user role
declare global {
  namespace Express {
    interface Request {
      userRole?: string;
      userStatus?: string;
    }
  }
}

// Middleware to check if user is authenticated
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
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
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userRole !== 'admin' && req.userRole !== 'moderator') {
    return res.status(403).json({ error: 'Insufficient permissions. Moderator or admin role required.' });
  }

  next();
}

// Middleware to check if user is admin only
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
  }

  next();
}

// Middleware to check if user account is active
export function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.userStatus === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended' });
  }

  if (req.userStatus === 'banned') {
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

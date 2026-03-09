/**
 * Admin Audit Routes
 * 
 * Provides admin-only endpoints for accessing security audit logs,
 * data access logs, and generating security reports.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { generateSecurityReport, auditUserAccess, detectSuspiciousActivity, exportAuditLogs } from '../../utils/securityAudit.js';

const router = Router();

// All routes require admin access
router.use(requireAdmin);

/**
 * GET /api/admin/audit/security
 * Get security event logs
 */
router.get('/security', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 100, offset = 0 } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const end = endDate ? new Date(endDate as string) : new Date();

    // Placeholder implementation
    // In production, this would query the security_audit_logs table
    res.json({
      logs: [],
      total: 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/audit/data-access
 * Get data access logs
 */
router.get('/data-access', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId, resourceType, limit = 100, offset = 0 } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Placeholder implementation
    // In production, this would query the data_access_logs table
    res.json({
      logs: [],
      total: 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/audit/users/:userId
 * Get audit logs for a specific user
 */
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const audit = await auditUserAccess(userId, start, end);

    res.json(audit);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/audit/report
 * Generate security report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate as string) : new Date();

    const report = await generateSecurityReport(start, end);

    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/audit/suspicious
 * Get suspicious activity
 */
router.get('/suspicious', async (req: Request, res: Response) => {
  try {
    const { userId, timeWindow } = req.query;

    const window = timeWindow ? Number(timeWindow) : 24; // Default: last 24 hours

    const activities = await detectSuspiciousActivity(userId as string, window);

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/audit/export
 * Export audit logs
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const exportData = await exportAuditLogs(start, end, format as 'json' | 'csv');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${start.toISOString()}-${end.toISOString()}.json"`);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${start.toISOString()}-${end.toISOString()}.csv"`);
    }

    res.send(exportData);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;


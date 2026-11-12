import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { feedbackRequests, moderationActions, users, FEEDBACK_STATUSES, FEEDBACK_TYPES } from '../../shared/schema.js';
import { requireAdmin } from '../middleware/auth.js';

// Public: anyone (signed in or not) can send a bug report / feature request.
export const feedbackRouter = Router();

const submitSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().trim().min(3, 'Title is too short').max(140),
  description: z.string().trim().min(5, 'Please add a few more details').max(5000),
  pageUrl: z.string().trim().max(1000).optional().nullable(),
});

// Tiny in-memory limiter: 5 submissions per 10 minutes per user (or IP when signed out).
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
function allow(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) { recent.set(key, hits); return false; }
  hits.push(now); recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return true;
}

feedbackRouter.post('/', async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request' });
  const userId = req.user?.id ?? null;
  if (!allow(userId || `ip:${req.ip}`)) return res.status(429).json({ error: 'Too many submissions. Please try again in a few minutes.' });
  try {
    const [row] = await db.insert(feedbackRequests).values({
      userId,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      pageUrl: parsed.data.pageUrl || null,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    }).returning({ id: feedbackRequests.id });
    res.status(201).json({ id: row.id });
  } catch (e) {
    console.error('Error saving feedback:', e);
    res.status(500).json({ error: 'Could not save your request' });
  }
});

// Admin only: review submitted requests.
export const adminFeedbackRouter = Router();
adminFeedbackRouter.use(requireAdmin);

adminFeedbackRouter.get('/', async (req, res) => {
  try {
    const conds = [];
    const type = String(req.query.type || '');
    const status = String(req.query.status || '');
    if ((FEEDBACK_TYPES as readonly string[]).includes(type)) conds.push(eq(feedbackRequests.type, type));
    if ((FEEDBACK_STATUSES as readonly string[]).includes(status)) conds.push(eq(feedbackRequests.status, status));
    const rows = await db.select({
      request: feedbackRequests,
      user: { id: users.id, handle: users.handle, firstName: users.firstName, lastName: users.lastName, email: users.email },
    }).from(feedbackRequests)
      .leftJoin(users, eq(users.id, feedbackRequests.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(feedbackRequests.createdAt))
      .limit(200);
    const counts = await db.select({ status: feedbackRequests.status, count: sql<number>`count(*)::int` })
      .from(feedbackRequests).groupBy(feedbackRequests.status);
    res.json({ items: rows, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.count)])) });
  } catch (e) {
    console.error('Error listing feedback:', e);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

const updateSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  adminNote: z.string().max(2000).nullable().optional(),
});

adminFeedbackRouter.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success || (parsed.data.status === undefined && parsed.data.adminNote === undefined)) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  try {
    const [row] = await db.update(feedbackRequests)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(feedbackRequests.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Request not found' });
    if (parsed.data.status) {
      await db.insert(moderationActions).values({
        moderatorId: req.user!.id, actionType: 'update_feedback_status', targetType: 'feedback',
        targetId: row.id, reason: `Status → ${parsed.data.status}`,
      }).catch(() => {});
    }
    res.json(row);
  } catch (e) {
    console.error('Error updating feedback:', e);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

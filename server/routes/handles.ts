import express from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { isAuthenticated } from '../middleware/auth.js';
import { invalidatePattern } from '../services/cacheService.js';
import { checkHandle, isHandleConflict } from '../lib/handles.js';
import { normalizeHandleInput } from '../../shared/handle.js';

const router = express.Router();

// GET /api/handles/check?handle=foo -> { handle, valid, available, reason?, suggestion? }
// Public (sign-up uses it); when signed in, your own current handle counts as available.
router.get('/check', async (req, res) => {
  try {
    const me = req.user as Express.User | undefined;
    res.json(await checkHandle(String(req.query.handle ?? ''), me?.id));
  } catch (e) {
    console.error('Error checking handle:', e);
    res.status(500).json({ message: 'Failed to check handle' });
  }
});

// GET /api/handles/suggest?name=Alice -> { suggestion } (a free handle based on a name)
router.get('/suggest', async (req, res) => {
  try {
    const me = req.user as Express.User | undefined;
    const name = String(req.query.name ?? '').slice(0, 60) || 'user';
    const r = await checkHandle(name.replace(/[^A-Za-z0-9_]/g, ''), me?.id);
    res.json({ suggestion: r.available ? r.handle : r.suggestion });
  } catch (e) {
    res.status(500).json({ message: 'Failed to suggest handle' });
  }
});

// PUT /api/handles/me { handle } -> change your own handle. 400 invalid, 409 taken.
router.put('/me', isAuthenticated, async (req, res) => {
  try {
    const me = req.user as Express.User;
    const r = await checkHandle(String(req.body?.handle ?? ''), me.id);
    if (!r.valid) return res.status(400).json({ message: r.reason, suggestion: r.suggestion });
    if (!r.available) return res.status(409).json({ message: r.reason, suggestion: r.suggestion });
    await db.execute(sql`update users set handle = ${r.handle}, updated_at = now() where id = ${me.id}`);
    await invalidatePattern('topic*');
    await invalidatePattern('opinion*');
    res.json({ handle: r.handle });
  } catch (e: any) {
    if (isHandleConflict(e)) return res.status(409).json({ message: 'That handle is taken' });
    console.error('Error setting handle:', e);
    res.status(500).json({ message: 'Failed to set handle' });
  }
});

// GET /api/handles/:handle -> { id, handle } so /u/@handle profile links can resolve.
router.get('/:handle', async (req, res) => {
  try {
    const h = normalizeHandleInput(req.params.handle).toLowerCase();
    const r: any = await db.execute(sql`select id, handle from users where lower(handle) = ${h} limit 1`);
    const row = (r.rows ?? r)[0];
    if (!row) return res.status(404).json({ message: 'No user with that handle' });
    res.json({ id: row.id, handle: row.handle });
  } catch (e) {
    res.status(500).json({ message: 'Failed to look up handle' });
  }
});

export default router;

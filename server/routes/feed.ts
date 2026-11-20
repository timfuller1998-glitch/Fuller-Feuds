import { Router } from 'express';
import { buildHomeFeed, isHomeSection } from '../lib/homeFeed.js';
import { FEED_PAGE_SIZE } from '../../shared/homeFeed.js';

// POST /api/feed/home { section, cycle, seed, exclude: [ids dealt this cycle], seen: [recently seen ids], limit }
// Next page of a home section's endless deck (ranking in server/lib/homeFeed.ts). POST so the cursor
// (ids already dealt) can be long; it reads only.
const router = Router();
const ids = (v: unknown, max: number) =>
  new Set((Array.isArray(v) ? v : []).map((s) => String(s)).filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, max));

router.post('/home', async (req, res) => {
  try {
    const b = req.body || {};
    const section = String(b.section || '');
    if (!isHomeSection(section)) return res.status(400).json({ message: 'Unknown section' });
    const limit = Math.min(30, Math.max(1, parseInt(String(b.limit ?? FEED_PAGE_SIZE), 10) || FEED_PAGE_SIZE));
    const cycle = Math.max(0, parseInt(String(b.cycle ?? 0), 10) || 0);
    const seed = String(b.seed || '').slice(0, 40) || 'x';
    const userId = (req.user as any)?.id ?? null;
    res.set('Cache-Control', 'no-store');
    res.json(await buildHomeFeed({ section, cycle, seed, limit, exclude: ids(b.exclude, 5000), seen: ids(b.seen, 300), userId }));
  } catch (e) {
    console.error('home feed error', e);
    res.status(500).json({ message: 'Could not load topics' });
  }
});
export default router;

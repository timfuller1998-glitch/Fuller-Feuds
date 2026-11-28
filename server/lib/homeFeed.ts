import { sql } from 'drizzle-orm';
import { getMajor } from '../../shared/topicTaxonomy.js';
import { db } from '../db.js';
import { TopicService } from '../services/topicService.js';
import type { TopicWithCounts } from '../../shared/schema.js';
import { HOME_SECTIONS, type HomeSectionKey } from '../../shared/homeFeed.js';

// Home "infinite" decks (Fuller Feuds Dev, Nov 20 2026). A basic, explainable ranking per section:
// engagement (opinions, likes, debates, views, people) with time decay, a boost for the signed-in user's
// followed categories, and recently seen topics pushed back. The client sends the ids it has already dealt
// in the current cycle (the cursor), and gets the next best ones. Cycle 0 is the ranked order; later cycles
// are a score-weighted shuffle (seeded), so the pile never runs out and strong topics still come round
// earlier, but nothing repeats until every topic in the section has been shown.

const topicService = new TopicService();
const rows = (r: any) => (r.rows ?? r) as any[];
const HOUR = 3600_000;

export type TopicStats = {
  likes: number; debates: number; recentDebates: number; views: number; recentViews: number;
  recentOpinions: number; forCount: number; againstCount: number; neutralCount: number; lastActivity: number;
};

let statsCache: { at: number; map: Map<string, TopicStats> } | null = null;
async function loadStats(): Promise<Map<string, TopicStats>> {
  if (statsCache && Date.now() - statsCache.at < 30_000) return statsCache.map;
  const r = rows(await db.execute(sql`
    select t.id::text as id,
      coalesce(o.likes, 0) as likes, coalesce(o.recent, 0) as recent_opinions,
      coalesce(o.f, 0) as for_count, coalesce(o.a, 0) as against_count, coalesce(o.n, 0) as neutral_count,
      coalesce(d.total, 0) as debates, coalesce(d.recent, 0) as recent_debates,
      coalesce(v.total, 0) as views, coalesce(v.recent, 0) as recent_views,
      greatest(t.created_at, o.last_at, d.last_at, c.last_at) as last_activity
    from topics t
    left join (select topic_id, sum(coalesce(likes_count, 0)) as likes, max(created_at) as last_at,
                 count(*) filter (where created_at > now() - interval '7 days') as recent,
                 count(*) filter (where stance = 'for') as f, count(*) filter (where stance = 'against') as a,
                 count(*) filter (where stance not in ('for', 'against') or stance is null) as n
               from opinions where status = 'approved' group by topic_id) o on o.topic_id = t.id
    left join (select topic_id, count(*) as total, max(coalesce(last_message_at, started_at)) as last_at,
                 count(*) filter (where started_at > now() - interval '7 days') as recent
               from debate_rooms where coalesce(invite_status, 'accepted') = 'accepted' group by topic_id) d on d.topic_id = t.id
    left join (select topic_id, count(*) as total, count(*) filter (where viewed_at > now() - interval '7 days') as recent
               from topic_views group by topic_id) v on v.topic_id = t.id
    left join (select o2.topic_id, max(c.created_at) as last_at
               from opinion_sentence_counterpoints c join opinions o2 on o2.id = c.opinion_id group by o2.topic_id) c on c.topic_id = t.id
    where t.status = 'active' and coalesce(t.is_active, true) = true`));
  const map = new Map<string, TopicStats>();
  for (const x of r) {
    map.set(x.id, {
      likes: Number(x.likes), debates: Number(x.debates), recentDebates: Number(x.recent_debates),
      views: Number(x.views), recentViews: Number(x.recent_views), recentOpinions: Number(x.recent_opinions),
      forCount: Number(x.for_count), againstCount: Number(x.against_count), neutralCount: Number(x.neutral_count),
      lastActivity: x.last_activity ? new Date(x.last_activity).getTime() : 0,
    });
  }
  statsCache = { at: Date.now(), map };
  return map;
}

const EMPTY: TopicStats = { likes: 0, debates: 0, recentDebates: 0, views: 0, recentViews: 0, recentOpinions: 0, forCount: 0, againstCount: 0, neutralCount: 0, lastActivity: 0 };

/** Hours-based decay: 1 now, ~0.5 after `half` hours. */
const decay = (ts: number, half: number) => 1 / (1 + Math.max(0, Date.now() - ts) / HOUR / half);

/** Base engagement for a topic: every interaction counts, debates and opinions most. */
function engagement(t: TopicWithCounts, s: TopicStats) {
  return 1 + (t.opinionsCount || 0) * 3 + (t.participantCount || 0) * 2 + s.likes + s.debates * 5 + s.views * 0.2;
}

export function scoreTopic(section: HomeSectionKey, t: TopicWithCounts, s: TopicStats): number {
  const created = t.createdAt ? new Date(t.createdAt as any).getTime() : 0;
  const recent = 1 + s.recentOpinions * 3 + s.recentDebates * 5 + s.recentViews * 0.3;
  switch (section) {
    case 'trending': // what's busy lately: all-time engagement, weighted toward the last week, decaying with quiet time
      return engagement(t, s) * recent * decay(s.lastActivity || created, 72);
    case 'hot-debates': // most recent activity (opinions, counterpoints, debates) first
      return (1 + s.debates * 4 + s.recentDebates * 6 + (t.opinionsCount || 0)) * decay(s.lastActivity || created, 24);
    case 'new-this-week': // newest topics first, a little lift from early engagement
      return decay(created, 48) * (1 + Math.log1p(engagement(t, s)) * 0.25);
    case 'most-debated': // most opinions and debates overall, gently favouring active ones
      return (1 + (t.opinionsCount || 0) * 3 + s.debates * 6 + s.likes * 0.5) * (0.6 + 0.4 * decay(s.lastActivity || created, 24 * 14));
    case 'diverse-perspectives': { // topics with people on both sides
      const sides = s.forCount + s.againstCount;
      const balance = sides ? Math.min(s.forCount, s.againstCount) / Math.max(s.forCount, s.againstCount) : 0;
      return (1 + (t.diversityScore || 0) * 5 + balance * 4 + Math.log1p(sides + s.neutralCount)) * (0.5 + 0.5 * decay(s.lastActivity || created, 24 * 14));
    }
    default: // my-topics / my-current-debates: most recently active first
      return (1 + Math.log1p(engagement(t, s))) * decay(s.lastActivity || created, 24 * 7);
  }
}

/** Small seeded PRNG so a cycle's shuffle is stable across its pages. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

export interface FeedRequest {
  section: HomeSectionKey;
  /** Topic ids already dealt in this cycle (the cursor). */
  exclude: Set<string>;
  limit: number;
  cycle: number;
  seed: string;
  seen: Set<string>;
  userId?: string | null;
}

export async function buildHomeFeed(req: FeedRequest) {
  const [all, stats] = await Promise.all([topicService.getTopics({}), loadStats()]);
  let pool = all.filter((t) => stats.has(t.id)); // active topics only

  let followed = new Set<string>();
  if (req.userId) {
    const u = rows(await db.execute(sql`select followed_categories from users where id = ${req.userId}`))[0];
    followed = new Set(((u?.followed_categories as string[] | null) || []).map((c) => c.toLowerCase()));
    // Server-side "recently seen" for signed-in users (topic cards they opened in the last day).
    if (req.cycle === 0) {
      for (const x of rows(await db.execute(sql`
        select topic_id::text as id from topic_interactions where user_id = ${req.userId} and seen_at > now() - interval '1 day'`))) req.seen.add(x.id);
    }
    if (req.section === 'my-topics') {
      const mine = new Set(rows(await db.execute(sql`select distinct topic_id::text as id from opinions where user_id = ${req.userId}`)).map((x) => x.id));
      pool = pool.filter((t) => mine.has(t.id));
    } else if (req.section === 'my-current-debates') {
      const mine = new Set(rows(await db.execute(sql`
        select distinct topic_id::text as id from debate_rooms
        where (participant1_id = ${req.userId} or participant2_id = ${req.userId}) and status = 'active'`)).map((x) => x.id));
      pool = pool.filter((t) => mine.has(t.id));
    }
  } else if (req.section === 'my-topics' || req.section === 'my-current-debates') {
    pool = [];
  }

  const scored = pool.map((t) => {
    let score = scoreTopic(req.section, t, stats.get(t.id) || EMPTY);
    const cats = ((t.categories as string[] | null) || []).map((c) => c.toLowerCase());
    const homeName = getMajor((t as any).homeMajor)?.name;
    if (homeName) cats.push(homeName.toLowerCase()); // following an official group matches topics whose home is in it
    if (followed.size && cats.some((c) => followed.has(c))) score *= 1.5; // the user's interests
    if (req.cycle === 0 && req.seen.has(t.id)) score *= 0.25; // seen recently: later in the first pass
    return { t, score: Math.max(score, 1e-6) };
  });

  let ordered: typeof scored;
  if (req.cycle === 0) {
    ordered = scored.sort((a, b) => b.score - a.score || String(a.t.id).localeCompare(String(b.t.id)));
  } else {
    // Weighted shuffle (Efraimidis–Spirakis): higher scores tend to come earlier, but every topic appears once.
    const rand = mulberry32(hashStr(`${req.section}|${req.seed}|${req.cycle}`));
    ordered = scored.map((x) => ({ ...x, k: Math.pow(rand(), 1 / x.score) })).sort((a: any, b: any) => b.k - a.k);
  }

  const total = ordered.length;
  const left = ordered.filter(({ t }) => !req.exclude.has(t.id));
  const page = left.slice(0, req.limit).map(({ t }) => {
    const { embedding, embeddingVec, ...rest } = t as any;
    return rest as TopicWithCounts;
  });
  const remaining = left.length - page.length;
  return { section: req.section, cycle: req.cycle, total, items: page, remaining, cycleDone: remaining === 0 };
}

export function isHomeSection(s: string): s is HomeSectionKey {
  return (HOME_SECTIONS as readonly string[]).includes(s);
}

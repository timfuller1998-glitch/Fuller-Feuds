import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';

const router = Router();

/**
 * Leaderboard categories. Each `valueSql` yields (user_id, value) rows; users with value 0
 * are not ranked. Ranks use RANK() so ties share a position.
 */
type Category = {
  id: string;
  title: string;
  unit: string;
  description: string;
  valueSql: (topicId?: string) => ReturnType<typeof sql>;
};

const CATEGORIES: Category[] = [
  {
    id: 'mostLiked',
    title: 'Most Liked',
    unit: 'likes',
    description: 'Likes received on opinions (self-likes excluded)',
    valueSql: (topicId) => sql`
      SELECT o.user_id, COUNT(*)::int AS value
      FROM opinion_votes v JOIN opinions o ON o.id = v.opinion_id
      WHERE v.vote_type = 'like' AND v.user_id <> o.user_id
        ${topicId ? sql`AND o.topic_id = ${topicId}` : sql``}
      GROUP BY o.user_id`,
  },
  {
    id: 'mostActive',
    title: 'Most Active',
    unit: 'contributions',
    description: 'Opinions + counterpoints + debate messages',
    valueSql: (topicId) => topicId
      ? sql`
        SELECT user_id, COUNT(*)::int AS value FROM (
          SELECT user_id FROM opinions WHERE topic_id = ${topicId}
          UNION ALL
          SELECT c.author_user_id FROM opinion_sentence_counterpoints c JOIN opinions o ON o.id = c.opinion_id WHERE o.topic_id = ${topicId}
          UNION ALL
          SELECT m.user_id FROM debate_messages m JOIN debate_rooms r ON r.id = m.room_id WHERE r.topic_id = ${topicId}
        ) a GROUP BY user_id`
      : sql`
        SELECT user_id, COUNT(*)::int AS value FROM (
          SELECT user_id FROM opinions
          UNION ALL SELECT author_user_id FROM opinion_sentence_counterpoints
          UNION ALL SELECT user_id FROM debate_messages
        ) a GROUP BY user_id`,
  },
  {
    id: 'mostFollowers',
    title: 'Most Followers',
    unit: 'followers',
    description: 'People following them',
    valueSql: () => sql`SELECT following_id AS user_id, COUNT(*)::int AS value FROM user_follows GROUP BY following_id`,
  },
  {
    id: 'topCreators',
    title: 'Top Topic Creators',
    unit: 'topics',
    description: 'Topics started',
    valueSql: () => sql`SELECT created_by_id AS user_id, COUNT(*)::int AS value FROM topics GROUP BY created_by_id`,
  },
];

async function rankCategory(cat: Category, limit: number, meId?: string, topicId?: string) {
  const result: any = await db.execute(sql`
    WITH v AS (${cat.valueSql(topicId)}),
    ranked AS (
      SELECT u.id AS user_id, coalesce((select nullif(trim(sn.display_first_name), '') from user_profiles sn where sn.user_id = u.id limit 1), u.first_name) AS first_name, (case when exists (select 1 from user_profiles sn where sn.user_id = u.id and nullif(trim(sn.display_first_name), '') is not null) then (select sn.display_last_name from user_profiles sn where sn.user_id = u.id limit 1) else u.last_name end) AS last_name, u.handle, u.profile_image_url, v.value,
             RANK() OVER (ORDER BY v.value DESC) AS rank,
             ROW_NUMBER() OVER (ORDER BY v.value DESC, u.first_name, u.id) AS rn
      FROM v JOIN users u ON u.id = v.user_id
      WHERE v.value > 0 AND COALESCE(u.status, 'active') = 'active'
    )
    SELECT *, (SELECT COUNT(*)::int FROM ranked) AS total FROM ranked
    WHERE rn <= ${limit} ${meId ? sql`OR user_id = ${meId}` : sql``}
    ORDER BY rn`);
  const rows = (result.rows ?? result) as any[];
  const map = (r: any) => ({
    userId: r.user_id,
    firstName: r.first_name,
    handle: r.handle,
    lastName: r.last_name,
    profileImageUrl: r.profile_image_url,
    value: Number(r.value),
    rank: Number(r.rank),
  });
  const entries = rows.filter((r) => Number(r.rn) <= limit).map(map);
  const meRow = meId ? rows.find((r) => r.user_id === meId) : undefined;
  return {
    id: cat.id,
    title: cat.title,
    unit: cat.unit,
    description: cat.description,
    totalRanked: Number(rows[0]?.total ?? 0),
    entries,
    me: meRow ? map(meRow) : null,
  };
}

// GET /api/leaderboards?userId=&topicId=&limit=
// `userId` (defaults to the signed-in user) gets their own rank in every category, even outside the top N.
// `topicId` scopes the like/activity boards to one topic (follower/creator boards are global and omitted).
router.get('/', async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit ?? '10'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;
    const meId = (typeof req.query.userId === 'string' && req.query.userId) || (req.user as Express.User | undefined)?.id;
    const topicId = typeof req.query.topicId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.topicId) ? req.query.topicId : undefined;
    const cats = topicId ? CATEGORIES.filter((c) => c.id === 'mostLiked' || c.id === 'mostActive') : CATEGORIES;
    const categories = await Promise.all(cats.map((c) => rankCategory(c, limit, meId, topicId)));
    res.json({ scope: topicId ? { topicId } : 'global', userId: meId ?? null, categories });
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    res.status(500).json({ message: 'Failed to fetch leaderboards' });
  }
});

export default router;

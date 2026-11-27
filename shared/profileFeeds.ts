// Pure ranking for the profile "Recommended for you" and "From people you follow" sections.
export interface FeedTopic {
  id: string;
  createdById?: string | null;
  categories?: string[] | null;
  createdAt?: string | Date | null;
  opinionsCount?: number | null;
  status?: string | null;
  isActive?: boolean | null;
}

const visible = (t: FeedTopic) => t.isActive !== false && (!t.status || t.status === "active");

const ms = (d?: string | Date | null) => (d ? new Date(d).getTime() || 0 : 0);

/**
 * Topics to suggest: ones the user hasn't weighed in on yet (including topics they started; admins create most
 * topics), favouring categories they already debate, then busy and recent ones. If that leaves fewer than `limit`,
 * fill with the busiest remaining topics so the deck is never empty while visible topics exist.
 */
export function rankRecommended<T extends FeedTopic>(
  topics: T[],
  opts: { userId: string; answeredTopicIds: Set<string>; categoryWeights: Map<string, number>; now?: number; limit?: number },
): (T & { recommendReason: string })[] {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 5;
  const score = (t: T) => {
    const overlap = (t.categories ?? []).reduce((s, c) => s + (opts.categoryWeights.get(c) ?? 0), 0);
    const ageDays = (now - ms(t.createdAt)) / 86_400_000;
    return 3 * Math.min(overlap, 5) + Math.log1p(t.opinionsCount ?? 0) + (ageDays <= 7 ? 1 : 0);
  };
  const byScore = (a: { t: T; s: number }, b: { t: T; s: number }) => b.s - a.s || ms(b.t.createdAt) - ms(a.t.createdAt);
  const visibleTopics = topics.filter(visible);
  const fresh = visibleTopics
    .filter((t) => !opts.answeredTopicIds.has(t.id))
    .map((t) => ({ t, s: score(t) }))
    .sort(byScore)
    .slice(0, limit)
    .map(({ t }) => ({
      ...t,
      recommendReason: (t.categories ?? []).some((c) => opts.categoryWeights.has(c)) ? "In categories you debate" : "You haven't weighed in yet",
    }));
  if (fresh.length >= limit) return fresh;
  const taken = new Set(fresh.map((t) => t.id));
  const fill = visibleTopics
    .filter((t) => !taken.has(t.id))
    .sort((a, b) => (b.opinionsCount ?? 0) - (a.opinionsCount ?? 0) || ms(b.createdAt) - ms(a.createdAt))
    .slice(0, limit - fresh.length)
    .map((t) => ({ ...t, recommendReason: "Trending — add a new take" }));
  return [...fresh, ...fill];
}

export interface FollowActivity {
  topicId: string;
  actorId: string;
  actorName: string;
  kind: "created" | "opinion";
  at: string | Date;
  excerpt?: string | null;
}

/** Topics with recent activity from followed users (whoever started the topic), newest first, one per topic with a short reason. */
export function rankFollowing<T extends FeedTopic>(
  topics: T[],
  activity: FollowActivity[],
  opts: { userId: string; limit?: number },
): (T & { followReason: string; followActivityAt: string; followExcerpt: string | null })[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const latest = new Map<string, FollowActivity>();
  for (const a of activity) {
    const prev = latest.get(a.topicId);
    if (!prev || ms(a.at) > ms(prev.at)) latest.set(a.topicId, a);
  }
  return Array.from(latest.values())
    .filter((a) => {
      const t = byId.get(a.topicId);
      return !!t && visible(t);
    })
    .sort((a, b) => ms(b.at) - ms(a.at))
    .slice(0, opts.limit ?? 5)
    .map((a) => ({
      ...byId.get(a.topicId)!,
      followReason: a.kind === "created" ? `${a.actorName} started this topic` : `${a.actorName} shared an opinion`,
      followActivityAt: new Date(a.at).toISOString(),
      followExcerpt: a.excerpt ? a.excerpt.trim() : null,
    }));
}

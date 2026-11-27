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

/** Topics the user hasn't created or answered, favouring categories they already debate, then busy and recent ones. */
export function rankRecommended<T extends FeedTopic>(
  topics: T[],
  opts: { userId: string; answeredTopicIds: Set<string>; categoryWeights: Map<string, number>; now?: number; limit?: number },
): T[] {
  const now = opts.now ?? Date.now();
  const scored = topics
    .filter((t) => visible(t) && t.createdById !== opts.userId && !opts.answeredTopicIds.has(t.id))
    .map((t) => {
      const overlap = (t.categories ?? []).reduce((s, c) => s + (opts.categoryWeights.get(c) ?? 0), 0);
      const ageDays = (now - ms(t.createdAt)) / 86_400_000;
      const score = 3 * Math.min(overlap, 5) + Math.log1p(t.opinionsCount ?? 0) + (ageDays <= 7 ? 1 : 0);
      return { t, score };
    });
  scored.sort((a, b) => b.score - a.score || ms(b.t.createdAt) - ms(a.t.createdAt));
  return scored.slice(0, opts.limit ?? 5).map((s) => s.t);
}

export interface FollowActivity {
  topicId: string;
  actorId: string;
  actorName: string;
  kind: "created" | "opinion";
  at: string | Date;
}

/** Topics with recent activity from followed users, newest first, one entry per topic with a short reason. */
export function rankFollowing<T extends FeedTopic>(
  topics: T[],
  activity: FollowActivity[],
  opts: { userId: string; limit?: number },
): (T & { followReason: string; followActivityAt: string })[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const latest = new Map<string, FollowActivity>();
  for (const a of activity) {
    const prev = latest.get(a.topicId);
    if (!prev || ms(a.at) > ms(prev.at)) latest.set(a.topicId, a);
  }
  return Array.from(latest.values())
    .filter((a) => {
      const t = byId.get(a.topicId);
      return !!t && visible(t) && t.createdById !== opts.userId;
    })
    .sort((a, b) => ms(b.at) - ms(a.at))
    .slice(0, opts.limit ?? 5)
    .map((a) => ({
      ...byId.get(a.topicId)!,
      followReason: a.kind === "created" ? `${a.actorName} started this topic` : `${a.actorName} shared an opinion`,
      followActivityAt: new Date(a.at).toISOString(),
    }));
}

// Activity notification rules (Nov 27 2026). Pure functions shared by the server (and its tests) and Settings.

export type ActivityType = 'topic_opinion' | 'opinion_counterpoint' | 'counterpoint_debate' | 'like_milestone';

/** Settings switches. Missing key = on. Debate invites to you are always on (you have to answer them). */
export const NOTIFICATION_PREFS = [
  { key: 'topicOpinions', type: 'topic_opinion', label: 'New opinions on topics you created' },
  { key: 'counterpoints', type: 'opinion_counterpoint', label: 'Counterpoints on your opinions' },
  { key: 'debates', type: 'counterpoint_debate', label: 'Debates started from your counterpoints' },
  { key: 'likes', type: 'like_milestone', label: 'Like milestones on your opinions' },
] as const;

export type NotificationPrefs = Partial<Record<(typeof NOTIFICATION_PREFS)[number]['key'], boolean>>;

export const LIKE_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];

/** Window in which a new event folds into the same unread notification instead of creating another. */
export const COLLAPSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function prefKeyFor(type: ActivityType) {
  return NOTIFICATION_PREFS.find((p) => p.type === type)!.key;
}

/** Never notify yourself, never notify nobody, and respect the recipient's switch. */
export function shouldNotify(type: ActivityType, actorId: string | null | undefined, recipientId: string | null | undefined, prefs?: NotificationPrefs | null) {
  if (!recipientId) return false;
  if (actorId && actorId === recipientId) return false;
  return prefs?.[prefKeyFor(type)] !== false;
}

/** The like count is a milestone worth one notification. Counts move one vote at a time, so equality is enough. */
export function isLikeMilestone(likes: number) {
  return LIKE_MILESTONES.includes(likes);
}

/** Collapsing key: one unread row per user per thing. */
export function groupKeyFor(type: ActivityType, targetId: string, extra?: string | number) {
  return extra != null ? `${type}:${targetId}:${extra}` : `${type}:${targetId}`;
}

/** Merge a new actor into the burst (distinct, newest first). */
export function mergeActors(existing: string[] | null | undefined, actorId: string | null | undefined) {
  const list = (existing ?? []).filter((a) => a && a !== actorId);
  return actorId ? [actorId, ...list] : list;
}

const clip = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Title and message for a (possibly collapsed) notification. `name` is the newest actor's display name. */
export function describe(type: ActivityType, o: { count: number; name: string; topic: string; likes?: number }) {
  const t = clip(o.topic || 'a topic');
  const others = o.count - 1;
  const who = others <= 0 ? o.name : `${o.name} and ${others} other${others === 1 ? '' : 's'}`;
  switch (type) {
    case 'topic_opinion':
      return { title: o.count > 1 ? `${o.count} new opinions on your topic` : 'New opinion on your topic', message: `${who} weighed in on "${t}".` };
    case 'opinion_counterpoint':
      return { title: o.count > 1 ? `${o.count} new counterpoints` : 'New counterpoint', message: `${who} answered your opinion on "${t}".` };
    case 'counterpoint_debate':
      return { title: 'Your counterpoint started a debate', message: `${who} started a debate from your counterpoint on "${t}".` };
    case 'like_milestone':
      return { title: `${o.likes} likes`, message: `Your opinion on "${t}" reached ${o.likes} likes.` };
  }
}

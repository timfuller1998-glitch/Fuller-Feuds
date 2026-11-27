import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { notifications, users } from '../../shared/schema.js';
import { pushNotification } from '../websocket.js';
import { pushForNotification } from './webPush.js';
import { displayNameOf } from './debateFlow.js';
import {
  type ActivityType, COLLAPSE_WINDOW_MS, describe, groupKeyFor, mergeActors, shouldNotify,
} from '../../shared/notificationRules.js';

async function topicTitleOf(topicId: string) {
  const r: any = await db.execute(sql`SELECT title FROM topics WHERE id = ${topicId} LIMIT 1`);
  return ((r.rows ?? r)[0]?.title as string) || 'a topic';
}

/**
 * Activity notification (opinion on your topic, counterpoint on your opinion, …). Skips your own actions and
 * switched-off types; folds a burst into the same unread row ("3 new opinions on your topic") and pushes it
 * over the socket. Never throws — a notification must never break the action that caused it.
 */
export async function notifyActivity(n: {
  type: ActivityType;
  recipientId: string | null | undefined;
  actorId?: string | null;
  targetId: string; // what the burst is about (topic id, opinion id, …)
  topicId: string;
  linkUrl: string;
  likes?: number;
}) {
  try {
    if (!shouldNotify(n.type, n.actorId, n.recipientId)) return null;
    const recipientId = n.recipientId!;
    const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, recipientId)).limit(1);
    if (!u || !shouldNotify(n.type, n.actorId, recipientId, u.prefs as any)) return null;

    const groupKey = groupKeyFor(n.type, n.targetId, n.type === 'like_milestone' ? n.likes : undefined);
    const topic = await topicTitleOf(n.topicId);
    const name = n.actorId ? await displayNameOf(n.actorId) : '';

    if (n.type === 'like_milestone') {
      // Once per opinion per milestone, ever (unlike + re-like must not repeat it).
      const [seen] = await db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, recipientId), eq(notifications.groupKey, groupKey))).limit(1);
      if (seen) return null;
    } else {
      const since = new Date(Date.now() - COLLAPSE_WINDOW_MS);
      const [open] = await db.select().from(notifications)
        .where(and(eq(notifications.userId, recipientId), eq(notifications.groupKey, groupKey),
          eq(notifications.isRead, false), gt(notifications.createdAt, since)))
        .orderBy(desc(notifications.createdAt)).limit(1);
      if (open) {
        const actorIds = mergeActors(open.actorIds, n.actorId);
        const text = describe(n.type, { count: actorIds.length, name, topic });
        const [row] = await db.update(notifications)
          .set({ ...text, actorIds, createdAt: new Date() })
          .where(eq(notifications.id, open.id)).returning();
        pushNotification(recipientId, row);
        pushForNotification(recipientId, row);
        return row;
      }
    }

    const actorIds = mergeActors([], n.actorId);
    const text = describe(n.type, { count: Math.max(1, actorIds.length), name, topic, likes: n.likes });
    const [row] = await db.insert(notifications).values({
      userId: recipientId, type: n.type, ...text, groupKey, linkUrl: n.linkUrl, actorIds, topicId: n.topicId,
    }).returning();
    pushNotification(recipientId, row);
    pushForNotification(recipientId, row);
    return row;
  } catch (e) {
    console.error('[notifyActivity] failed:', (e as Error).message);
    return null;
  }
}

/** Fire-and-forget wrapper so callers never wait on (or fail from) a notification. */
export function notifyActivityLater(n: Parameters<typeof notifyActivity>[0]) {
  void notifyActivity(n);
}

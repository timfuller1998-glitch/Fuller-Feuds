import { db } from '../db.js';
import { notifications } from '../../shared/schema.js';
import { pushNotification } from '../websocket.js';

export type NotifyType = 'new_debate' | 'your_turn' | 'debate_ended' | 'rate_opponent' | 'ratings_in' | 'debate_accepted' | 'debate_declined';

/** Store a notification for the bell and push it over the user's live sockets. Never throws. */
export async function notifyUser(
  userId: string,
  n: { type: NotifyType; title: string; message: string; debateRoomId?: string | null },
) {
  try {
    const [row] = await db
      .insert(notifications)
      .values({ userId, type: n.type, title: n.title, message: n.message, debateRoomId: n.debateRoomId ?? null })
      .returning();
    pushNotification(userId, row);
    return row;
  } catch (e) {
    console.error('[notify] failed:', (e as Error).message);
    return null;
  }
}

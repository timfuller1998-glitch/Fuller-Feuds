import { db } from '../db.js';
import { notifications, pushSubscriptions } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import type {
  Notification,
  InsertNotification,
  PushSubscription,
  InsertPushSubscription
} from '@shared/schema';

export class NotificationRepository {
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async subscribeToPush(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      })
      .returning();
    return created;
  }

  async unsubscribeFromPush(userId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }
}

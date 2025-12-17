import webPush from 'web-push';
import { NotificationService } from './services/notificationService';
import type { InsertNotification } from '../shared/schema';

const notificationService = new NotificationService();

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('VAPID keys not configured. Push notifications will not work.');
} else {
  webPush.setVapidDetails(
    'mailto:admin@opinionfeud.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    debateRoomId?: string;
    [key: string]: any;
  };
}

/**
 * Send a push notification to a specific user
 * @param userId - The user to send the notification to
 * @param payload - The notification payload
 * @returns Promise that resolves when notification is sent to all subscriptions
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('Push notifications disabled - VAPID keys not configured');
    return;
  }

  try {
    // Get all push subscriptions for this user
    const subscriptions = await notificationService.getUserPushSubscriptions(userId);

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    // Send to all subscriptions
    const promises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webPush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );

        console.log(`Push notification sent to user ${userId}, endpoint: ${sub.endpoint.substring(0, 50)}...`);
      } catch (error: any) {
        // If subscription is invalid (410 Gone), remove it
        if (error.statusCode === 410) {
          console.log(`Removing invalid subscription for user ${userId}`);
          await notificationService.unsubscribeFromPush(userId, sub.endpoint);
        } else {
          console.error(`Error sending push notification to user ${userId}:`, error);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

/**
 * Send a notification about a new debate message
 */
export async function sendDebateMessageNotification(
  recipientId: string,
  senderName: string,
  debateRoomId: string,
  topicTitle: string,
  messagePreview: string
): Promise<void> {
  // Create in-app notification
  const notification: InsertNotification = {
    userId: recipientId,
    type: 'debate_message',
    title: `New message from ${senderName}`,
    message: messagePreview.length > 100 
      ? messagePreview.substring(0, 100) + '...' 
      : messagePreview,
    debateRoomId,
  };

  await notificationService.createNotification(notification);

  // Send push notification (will only send if user is offline)
  await sendPushNotification(recipientId, {
    title: `${senderName} in ${topicTitle}`,
    body: messagePreview.length > 80 
      ? messagePreview.substring(0, 80) + '...' 
      : messagePreview,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `debate-${debateRoomId}`,
    data: {
      url: `/debates/${debateRoomId}`,
      debateRoomId,
    },
  });
}

/**
 * Send a notification about a debate phase change
 */
export async function sendDebatePhaseChangeNotification(
  recipientId: string,
  debateRoomId: string,
  topicTitle: string,
  newPhase: string
): Promise<void> {
  const phaseMessages: Record<string, string> = {
    voting: 'Time to rate your opponent!',
    'free-form': 'Voting complete - free discussion now open',
  };

  const message = phaseMessages[newPhase] || `Debate phase changed to ${newPhase}`;

  // Create in-app notification
  const notification: InsertNotification = {
    userId: recipientId,
    type: 'debate_phase_change',
    title: topicTitle,
    message,
    debateRoomId,
  };

  await notificationService.createNotification(notification);

  // Send push notification
  await sendPushNotification(recipientId, {
    title: topicTitle,
    body: message,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `debate-${debateRoomId}`,
    data: {
      url: `/debates/${debateRoomId}`,
      debateRoomId,
    },
  });
}

export { webPush };

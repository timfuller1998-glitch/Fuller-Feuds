import { NotificationRepository } from '../repositories/notificationRepository.js';
import type { InsertNotification, InsertPushSubscription } from '../../shared/schema.js';

export class NotificationService {
  private repository: NotificationRepository;

  constructor() {
    this.repository = new NotificationRepository();
  }

  async createNotification(notification: InsertNotification) {
    return await this.repository.createNotification(notification);
  }

  async getUserNotifications(userId: string, limit = 50) {
    return await this.repository.getUserNotifications(userId, limit);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.repository.markNotificationAsRead(notificationId);
  }

  async subscribeToPush(subscription: InsertPushSubscription) {
    return await this.repository.subscribeToPush(subscription);
  }

  async unsubscribeFromPush(userId: string, endpoint: string): Promise<void> {
    await this.repository.unsubscribeFromPush(userId, endpoint);
  }

  async getUserPushSubscriptions(userId: string) {
    return await this.repository.getUserPushSubscriptions(userId);
  }

  // Business logic methods for common notification scenarios
  async notifyNewDebate(participants: string[], debateId: string, topicTitle: string): Promise<void> {
    const notifications = participants.map(participantId => ({
      userId: participantId,
      type: 'new_debate' as const,
      title: 'New Debate Invitation',
      message: `You've been invited to debate: "${topicTitle}"`,
      debateRoomId: debateId,
    }));

    await Promise.all(notifications.map(notification => this.createNotification(notification)));
  }

  async notifyNewMessage(debateId: string, senderId: string, recipients: string[], senderName: string): Promise<void> {
    const notifications = recipients.map(recipientId => ({
      userId: recipientId,
      type: 'new_message' as const,
      title: 'New Debate Message',
      message: `${senderName} sent a message in your debate`,
      debateRoomId: debateId,
    }));

    await Promise.all(notifications.map(notification => this.createNotification(notification)));
  }

  async notifyDebateEnded(debateId: string, participants: string[], topicTitle: string): Promise<void> {
    const notifications = participants.map(participantId => ({
      userId: participantId,
      type: 'debate_ended' as const,
      title: 'Debate Concluded',
      message: `The debate "${topicTitle}" has ended`,
      debateRoomId: debateId,
    }));

    await Promise.all(notifications.map(notification => this.createNotification(notification)));
  }
}

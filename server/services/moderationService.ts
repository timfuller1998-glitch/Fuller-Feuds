import { ModerationRepository } from '../repositories/moderationRepository.js';
import type { BannedPhrase, InsertBannedPhrase } from '../../shared/schema.js';

export class ModerationService {
  private repository: ModerationRepository;

  constructor() {
    this.repository = new ModerationRepository();
  }

  // Content moderation
  async flagOpinion(opinionId: string, userId: string, fallacyType: string): Promise<void> {
    await this.repository.flagOpinion(opinionId, userId, fallacyType);
  }

  async flagTopic(topicId: string, userId: string, fallacyType: string): Promise<void> {
    await this.repository.flagTopic(topicId, userId, fallacyType);
  }

  async flagDebateMessage(messageId: string, userId: string, fallacyType: string): Promise<void> {
    await this.repository.flagDebateMessage(messageId, userId, fallacyType);
  }

  async getFlaggedOpinions() {
    return await this.repository.getFlaggedOpinions();
  }

  async approveOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.approveOpinion(opinionId, moderatorId, reason);
  }

  async hideOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void> {
    const { OpinionRepository } = await import('../repositories/opinionRepository.js');
    const existing = await new OpinionRepository().findById(opinionId, moderatorId, 'admin');
    await this.repository.hideOpinion(opinionId, moderatorId, reason);
    if (existing?.userId) {
      const { OpinionService } = await import('./opinionService.js');
      await new OpinionService().recountUserOpinionsAndRefreshCompass(existing.userId);
    }
  }

  async hideTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.hideTopic(topicId, moderatorId, reason);
    const { OpinionService } = await import('./opinionService.js');
    await new OpinionService().recountUsersOnTopic(topicId);
  }

  async archiveTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.archiveTopic(topicId, moderatorId, reason);
  }

  async restoreTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.restoreTopic(topicId, moderatorId, reason);
    const { OpinionService } = await import('./opinionService.js');
    await new OpinionService().recountUsersOnTopic(topicId);
  }

  // User management
  async suspendUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.suspendUser(userId, moderatorId, reason);
  }

  async banUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.banUser(userId, moderatorId, reason);
  }

  async reinstateUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await this.repository.reinstateUser(userId, moderatorId, reason);
  }

  async updateUserRole(userId: string, role: string, adminId: string): Promise<void> {
    await this.repository.updateUserRole(userId, role, adminId);
  }

  async updateUserStatus(userId: string, status: string, adminId: string): Promise<void> {
    await this.repository.updateUserStatus(userId, status, adminId);
  }

  async deleteUser(userId: string, adminId: string): Promise<void> {
    await this.repository.deleteUser(userId, adminId);
  }

  async deleteOpinionAdmin(opinionId: string, adminId: string): Promise<void> {
    const { OpinionRepository } = await import('../repositories/opinionRepository.js');
    const existing = await new OpinionRepository().findById(opinionId, adminId, 'admin');
    await this.repository.deleteOpinionAdmin(opinionId, adminId);
    const { OpinionService } = await import('./opinionService.js');
    const opinionService = new OpinionService();
    if (existing?.userId) await opinionService.recountUserOpinionsAndRefreshCompass(existing.userId);
    if (existing?.topicId) {
      const { invalidateOpinionCache } = await import('./cacheInvalidation.js');
      await invalidateOpinionCache(opinionId, existing.topicId);
    }
  }

  async deleteTopicAdmin(topicId: string, adminId: string): Promise<void> {
    await this.repository.deleteTopicAdmin(topicId, adminId);
    const { OpinionService } = await import('./opinionService.js');
    await new OpinionService().recountUsersOnTopic(topicId);
  }

  // Banned phrases management
  async createBannedPhrase(phrase: InsertBannedPhrase): Promise<BannedPhrase> {
    return await this.repository.createBannedPhrase(phrase);
  }

  async getBannedPhrases() {
    return await this.repository.getBannedPhrases();
  }

  async deleteBannedPhrase(id: string): Promise<void> {
    await this.repository.deleteBannedPhrase(id);
  }

  // Admin data access
  async getUsersForAdmin() {
    return await this.repository.getUsersForAdmin();
  }

  async getTopicsForAdmin() {
    return await this.repository.getTopicsForAdmin();
  }

  async getOpinionsForAdmin() {
    return await this.repository.getOpinionsForAdmin();
  }
}

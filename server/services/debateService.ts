import { DebateRepository } from '../repositories/debateRepository';
import { OpinionRepository } from '../repositories/opinionRepository';
import type { DebateRoom, DebateMessage, InsertDebateVote } from '@shared/schema';

export class DebateService {
  private debateRepository: DebateRepository;
  private opinionRepository: OpinionRepository;

  constructor() {
    this.debateRepository = new DebateRepository();
    this.opinionRepository = new OpinionRepository();
  }

  async createDebateRoom(opinionId: string, userId: string): Promise<DebateRoom> {
    return await this.debateRepository.createDebateRoomWithOpinionAuthor(opinionId, userId);
  }

  async getDebateRoom(roomId: string): Promise<DebateRoom | null> {
    const room = await this.debateRepository.getDebateRoom(roomId);
    return room ?? null;
  }

  async getUserDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await this.debateRepository.getUserDebateRooms(userId);
  }

  async getUserActiveDebateRoomsEnriched(userId: string): Promise<any[]> {
    return await this.debateRepository.getUserActiveDebateRoomsEnriched(userId);
  }

  async endDebateRoom(roomId: string): Promise<void> {
    await this.debateRepository.endDebateRoom(roomId);
  }

  async updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void> {
    await this.debateRepository.updateDebateRoomPrivacy(roomId, userId, privacy);
  }

  async sendMessage(roomId: string, userId: string, content: string): Promise<DebateMessage> {
    return await this.debateRepository.addDebateMessage(roomId, userId, content);
  }

  async getMessages(roomId: string, viewerId?: string): Promise<DebateMessage[]> {
    return await this.debateRepository.getDebateMessages(roomId, viewerId);
  }

  async updateTurn(roomId: string, userId: string): Promise<DebateRoom> {
    return await this.debateRepository.updateDebateRoomTurn(roomId, userId);
  }

  async submitVote(vote: InsertDebateVote): Promise<void> {
    await this.debateRepository.submitDebateVote(vote);
  }

  async getDebateVotes(roomId: string) {
    return await this.debateRepository.getDebateVotes(roomId);
  }

  async updateUserDebateStats(userId: string) {
    return await this.debateRepository.updateUserDebateStats(userId);
  }

  async getUserDebateStats(userId: string) {
    return await this.debateRepository.getUserDebateStats(userId);
  }

  async updateDebatePhase(roomId: string, phase: 'structured' | 'voting' | 'free-form'): Promise<void> {
    await this.debateRepository.updateDebatePhase(roomId, phase);
  }

  async submitVoteToContinue(roomId: string, userId: string, voteToContinue: boolean) {
    return await this.debateRepository.submitVoteToContinue(roomId, userId, voteToContinue);
  }

  async getGroupedDebateRooms(userId: string) {
    return await this.debateRepository.getGroupedDebateRooms(userId);
  }

  async getArchivedDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await this.debateRepository.getArchivedDebateRooms(userId);
  }

  async markRoomAsRead(roomId: string, userId: string): Promise<void> {
    await this.debateRepository.markDebateRoomAsRead(roomId, userId);
  }

  async archiveDebateRoom(roomId: string): Promise<void> {
    await this.debateRepository.archiveDebateRoom(roomId);
  }

  async getEndedDebatesForArchiving(daysInactive: number) {
    return await this.debateRepository.getEndedDebatesForArchiving(daysInactive);
  }

  async flagMessage(messageId: string, userId: string, fallacyType: string): Promise<void> {
    await this.debateRepository.flagDebateMessage(messageId, userId, fallacyType);
  }
}

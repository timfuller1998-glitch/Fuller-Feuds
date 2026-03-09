import { DebateRepository } from '../repositories/debateRepository.js';
import { OpinionRepository } from '../repositories/opinionRepository.js';
import type { DebateRoom, DebateMessage, InsertDebateVote } from '../../shared/schema.js';
import { logSecurityEvent } from '../utils/securityLogger.js';
import type { Request } from 'express';

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

  async getDebateRoom(
    roomId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<DebateRoom | null> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_debate_room',
        resourceType: 'debate_room',
        resourceId: roomId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getDebateRoom' }
      });
    }
    
    try {
      const room = await this.debateRepository.getDebateRoom(roomId, requestingUserId, requestingUserRole, req);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_debate_room',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return room ?? null;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_debate_room',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
  }

  async getUserDebateRooms(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<DebateRoom[]> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_user_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getUserDebateRooms' }
      });
    }
    
    try {
      const rooms = await this.debateRepository.getUserDebateRooms(userId, requestingUserId, requestingUserRole, req);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_user_debate_rooms',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return rooms;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_user_debate_rooms',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
  }

  async getUserActiveDebateRoomsEnriched(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<any[]> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_user_active_debate_rooms_enriched',
        resourceType: 'debate_room',
        resourceId: userId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getUserActiveDebateRoomsEnriched' }
      });
    }
    
    try {
      const rooms = await this.debateRepository.getUserActiveDebateRoomsEnriched(userId);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_user_active_debate_rooms_enriched',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return rooms;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_user_active_debate_rooms_enriched',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
  }

  async endDebateRoom(roomId: string): Promise<void> {
    await this.debateRepository.endDebateRoom(roomId);
  }

  async updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void> {
    await this.debateRepository.updateDebateRoomPrivacy(roomId, userId, privacy);
  }

  async sendMessage(
    roomId: string,
    userId: string,
    content: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<DebateMessage> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'send_debate_message',
        resourceType: 'debate_message',
        resourceId: roomId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'sendMessage' }
      });
    }
    
    try {
      const message = await this.debateRepository.addDebateMessage(
        roomId,
        userId,
        content,
        'approved',
        requestingUserId,
        requestingUserRole,
        req
      );
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'send_debate_message',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return message;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'send_debate_message',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
  }

  async getMessages(
    roomId: string,
    viewerId?: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<DebateMessage[]> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_debate_messages',
        resourceType: 'debate_message',
        resourceId: roomId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getMessages' }
      });
    }
    
    try {
      const messages = await this.debateRepository.getDebateMessages(
        roomId,
        viewerId,
        requestingUserId,
        requestingUserRole,
        req
      );
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_debate_messages',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return messages;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_debate_messages',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
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

  async getGroupedDebateRooms(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ) {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_grouped_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getGroupedDebateRooms' }
      });
    }
    
    try {
      const rooms = await this.debateRepository.getGroupedDebateRooms(userId);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_grouped_debate_rooms',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return rooms;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_grouped_debate_rooms',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
  }

  async getArchivedDebateRooms(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<DebateRoom[]> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_archived_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'DebateService', method: 'getArchivedDebateRooms' }
      });
    }
    
    try {
      const rooms = await this.debateRepository.getArchivedDebateRooms(userId);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_archived_debate_rooms',
          metadata: { duration, service: 'DebateService' }
        });
      }
      
      return rooms;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_archived_debate_rooms',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'DebateService' }
      });
      throw error;
    }
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

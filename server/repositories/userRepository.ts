import { db } from '../db.js';
import { users, userProfiles, userDebateStats, notifications, pushSubscriptions } from '../../shared/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import type { User, UserProfile, UserDebateStats, Notification, PushSubscription, UpsertUser } from '../../shared/schema.js';
import { checkUserOwnership, checkModifyPermission, sanitizeUserData, sanitizeUserProfileData } from '../utils/authorization.js';
import { logDataAccess, logDatabaseOperation, logSecurityEvent } from '../utils/securityLogger.js';
import { AuthorizationError } from '../utils/securityErrors.js';
import type { Request } from 'express';

export class UserRepository {
  async create(user: UpsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to insert, and if there's a conflict on ID, update the existing user
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      // Check if it's a duplicate email constraint error
      if (error.message?.includes('users_email_unique')) {
        // Email already exists with a different ID
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email!))
          .limit(1);

        if (existingUser) {
          // Update the existing user's info, keeping their original ID
          const [updatedUser] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: sql`now()`,
            })
            .where(eq(users.email, userData.email!))
            .returning();
          return updatedUser;
        }
      }
      throw error;
    }
  }

  async findById(id: string, requestingUserId?: string, requestingUserRole?: string, req?: Request): Promise<User | undefined> {
    const startTime = Date.now();
    
    try {
      // Log data access
      if (requestingUserId) {
        logDataAccess({
          userId: requestingUserId,
          userRole: requestingUserRole,
          action: 'read_user',
          resourceType: 'user',
          resourceId: id,
          accessLevel: 'read',
          dataFields: ['id', 'email', 'firstName', 'lastName', 'profileImageUrl', 'bio', 'location'],
          ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
          userAgent: req?.headers['user-agent'],
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_user',
        resourceType: 'user',
        resourceId: id,
        tableName: 'users',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: user ? 1 : 0,
      });

      if (!user) {
        return undefined;
      }

      // Sanitize user data based on permissions
      return sanitizeUserData(user, requestingUserId, requestingUserRole) as User;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_user',
        resourceType: 'user',
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async updateProfileImage(
    userId: string,
    profileImageUrl: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<void> {
    // Authorization check
    checkModifyPermission(requestingUserId, userId, requestingUserRole, 'user_profile_image', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'update_profile_image',
        resourceType: 'user',
        resourceId: userId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      await db
        .update(users)
        .set({ profileImageUrl })
        .where(eq(users.id, userId));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'update_profile_image',
        resourceType: 'user',
        resourceId: userId,
        tableName: 'users',
        operation: 'update',
        queryTimeMs: queryTime,
      });
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'update_profile_image',
        resourceType: 'user',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      bio?: string;
      location?: string;
      profileImageUrl?: string;
      followedCategories?: string[];
    },
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<void> {
    // Authorization check - users can only update their own profile (unless admin)
    checkModifyPermission(requestingUserId, userId, requestingUserRole, 'user_profile', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'update_user_profile',
        resourceType: 'user',
        resourceId: userId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      await db
        .update(users)
        .set({ ...data, updatedAt: sql`now()` })
        .where(eq(users.id, userId));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'update_user_profile',
        resourceType: 'user',
        resourceId: userId,
        tableName: 'users',
        operation: 'update',
        queryTimeMs: queryTime,
        rowsAffected: 1,
      });
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'update_user_profile',
        resourceType: 'user',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async updateFollowedCategories(
    userId: string,
    categories: string[],
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<void> {
    // Authorization check
    checkModifyPermission(requestingUserId, userId, requestingUserRole, 'user_categories', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'update_followed_categories',
        resourceType: 'user',
        resourceId: userId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      await db
        .update(users)
        .set({
          followedCategories: categories,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, userId));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'update_followed_categories',
        resourceType: 'user',
        resourceId: userId,
        tableName: 'users',
        operation: 'update',
        queryTimeMs: queryTime,
      });
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'update_followed_categories',
        resourceType: 'user',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async updateOnboardingProgress(
    userId: string,
    step: number,
    complete: boolean,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<User> {
    // Authorization check
    checkModifyPermission(requestingUserId, userId, requestingUserRole, 'user_onboarding', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'update_onboarding_progress',
        resourceType: 'user',
        resourceId: userId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const [updated] = await db
        .update(users)
        .set({
          onboardingStep: step,
          onboardingComplete: complete,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, userId))
        .returning();
      
      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'update_onboarding_progress',
        resourceType: 'user',
        resourceId: userId,
        tableName: 'users',
        operation: 'update',
        queryTimeMs: queryTime,
        rowsAffected: updated ? 1 : 0,
      });
      
      if (!updated) {
        throw new Error(`Failed to update onboarding progress for user ${userId}`);
      }
      
      return sanitizeUserData(updated, requestingUserId, requestingUserRole) as User;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'update_onboarding_progress',
        resourceType: 'user',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async getProfile(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<UserProfile | undefined> {
    const startTime = Date.now();

    try {
      // Log data access (political scores are extremely sensitive)
      if (requestingUserId) {
        logDataAccess({
          userId: requestingUserId,
          userRole: requestingUserRole,
          action: 'read_user_profile',
          resourceType: 'user_profile',
          resourceId: userId,
          accessLevel: 'read',
          dataFields: ['economicScore', 'authoritarianScore', 'politicalLeaning'],
          ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
          userAgent: req?.headers['user-agent'],
        });
      }

      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_user_profile',
        resourceType: 'user_profile',
        resourceId: userId,
        tableName: 'user_profiles',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: profile ? 1 : 0,
      });

      if (!profile) {
        return undefined;
      }

      // Sanitize profile data - remove sensitive political scores unless own profile
      return sanitizeUserProfileData(profile, requestingUserId, requestingUserRole) as UserProfile;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_user_profile',
        resourceType: 'user_profile',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async upsertProfile(
    profile: Partial<UserProfile> & { userId: string },
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<UserProfile> {
    // Authorization check - users can only upsert their own profile (unless admin)
    checkModifyPermission(requestingUserId, profile.userId, requestingUserRole, 'user_profile', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'upsert_user_profile',
        resourceType: 'user_profile',
        resourceId: profile.userId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const [upserted] = await db
        .insert(userProfiles)
        .values(profile)
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: profile
        })
        .returning();

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'upsert_user_profile',
        resourceType: 'user_profile',
        resourceId: profile.userId,
        tableName: 'user_profiles',
        operation: 'insert',
        queryTimeMs: queryTime,
        rowsAffected: upserted ? 1 : 0,
      });

      // Sanitize profile data
      return sanitizeUserProfileData(upserted, requestingUserId, requestingUserRole) as UserProfile;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'upsert_user_profile',
        resourceType: 'user_profile',
        resourceId: profile.userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async getDebateStats(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<UserDebateStats | undefined> {
    const startTime = Date.now();

    try {
      // Debate stats are public (performance metrics), but we log access
      if (requestingUserId) {
        logDataAccess({
          userId: requestingUserId,
          userRole: requestingUserRole,
          action: 'read_debate_stats',
          resourceType: 'user_debate_stats',
          resourceId: userId,
          accessLevel: 'read',
          ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
          userAgent: req?.headers['user-agent'],
        });
      }

      const [stats] = await db.select().from(userDebateStats).where(eq(userDebateStats.userId, userId)).limit(1);

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_debate_stats',
        resourceType: 'user_debate_stats',
        resourceId: userId,
        tableName: 'user_debate_stats',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: stats ? 1 : 0,
      });

      return stats;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_debate_stats',
        resourceType: 'user_debate_stats',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async updateDebateStats(userId: string, stats: Partial<UserDebateStats>): Promise<UserDebateStats> {
    const [updated] = await db
      .insert(userDebateStats)
      .values({ userId, ...stats })
      .onConflictDoUpdate({
        target: userDebateStats.userId,
        set: stats
      })
      .returning();
    return updated;
  }

  async getNotifications(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    limit: number = 50,
    req?: Request
  ): Promise<Notification[]> {
    // Authorization check - users can only see their own notifications
    checkUserOwnership(requestingUserId, userId, 'notifications', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'read_notifications',
        resourceType: 'notification',
        resourceId: userId,
        accessLevel: 'read',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const notifications_result = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_notifications',
        resourceType: 'notification',
        resourceId: userId,
        tableName: 'notifications',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: notifications_result.length,
      });

      return notifications_result;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_notifications',
        resourceType: 'notification',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async getPushSubscriptions(
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<PushSubscription[]> {
    // Authorization check - users can only see their own push subscriptions (highly sensitive)
    checkUserOwnership(requestingUserId, userId, 'push_subscriptions', req);

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'read_push_subscriptions',
        resourceType: 'push_subscription',
        resourceId: userId,
        accessLevel: 'read',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_push_subscriptions',
        resourceType: 'push_subscription',
        resourceId: userId,
        tableName: 'push_subscriptions',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: subscriptions.length,
      });

      return subscriptions;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_push_subscriptions',
        resourceType: 'push_subscription',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }
}

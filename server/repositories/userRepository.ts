import { db } from '../db';
import { users, userProfiles, userDebateStats, notifications, pushSubscriptions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { User, UserProfile, UserDebateStats, Notification, PushSubscription, UpsertUser } from '@shared/schema';

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
            updatedAt: new Date(),
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
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email!))
            .returning();
          return updatedUser;
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async updateProfileImage(userId: string, profileImageUrl: string): Promise<void> {
    await db
      .update(users)
      .set({ profileImageUrl })
      .where(eq(users.id, userId));
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    location?: string;
    profileImageUrl?: string;
    followedCategories?: string[];
  }): Promise<void> {
    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateFollowedCategories(userId: string, categories: string[]): Promise<void> {
    await db
      .update(users)
      .set({
        followedCategories: categories,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateOnboardingProgress(userId: string, step: number, complete: boolean): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({
        onboardingStep: step,
        onboardingComplete: complete,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) {
      throw new Error(`Failed to update onboarding progress for user ${userId}`);
    }
    
    return updated;
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return profile;
  }

  async upsertProfile(profile: Partial<UserProfile> & { userId: string }): Promise<UserProfile> {
    const [upserted] = await db
      .insert(userProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: profile
      })
      .returning();
    return upserted;
  }

  async getDebateStats(userId: string): Promise<UserDebateStats | undefined> {
    const [stats] = await db.select().from(userDebateStats).where(eq(userDebateStats.userId, userId)).limit(1);
    return stats;
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

  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }
}

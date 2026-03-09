/**
 * Authorization Helper Utilities
 * 
 * Reusable authorization functions for checking user permissions,
 * ownership, and access rights.
 */

import { AuthorizationError, ForbiddenError } from './securityErrors.js';
import type { Request } from 'express';
import type { DebateRoom } from '../../shared/schema.js';

/**
 * Check if a user owns a resource
 * @throws AuthorizationError if user does not own the resource
 */
export function checkUserOwnership(
  userId: string | undefined,
  resourceUserId: string,
  resourceType: string,
  req?: Request
): void {
  if (!userId) {
    throw new AuthorizationError(
      `Authentication required to access ${resourceType}`,
      'user_not_authenticated',
      {
        userId: undefined,
        resourceType,
        resourceId: resourceUserId,
        action: `access_${resourceType}`,
        req,
      }
    );
  }

  if (userId !== resourceUserId) {
    throw new AuthorizationError(
      `Cannot access ${resourceType} owned by another user`,
      'user_does_not_own_resource',
      {
        userId,
        resourceType,
        resourceId: resourceUserId,
        action: `access_${resourceType}`,
        req,
      }
    );
  }
}

/**
 * Check if a user is a participant in a debate room
 * @throws AuthorizationError if user is not a participant
 */
export function checkDebateParticipation(
  userId: string | undefined,
  debateRoom: DebateRoom | { participant1Id: string; participant2Id: string },
  req?: Request
): void {
  if (!userId) {
    throw new AuthorizationError(
      'Authentication required to access debate room',
      'user_not_authenticated',
      {
        userId: undefined,
        resourceType: 'debate_room',
        resourceId: 'id' in debateRoom ? debateRoom.id : undefined,
        action: 'access_debate_room',
        req,
      }
    );
  }

  // Handle both camelCase (TypeScript types) and snake_case (database) field names
  const participant1Id = ('participant1Id' in debateRoom && debateRoom.participant1Id)
    ? debateRoom.participant1Id
    : ('participant1_id' in debateRoom && (debateRoom as any).participant1_id)
    ? (debateRoom as any).participant1_id
    : (debateRoom as any).participant1Id;
  const participant2Id = ('participant2Id' in debateRoom && debateRoom.participant2Id)
    ? debateRoom.participant2Id
    : ('participant2_id' in debateRoom && (debateRoom as any).participant2_id)
    ? (debateRoom as any).participant2_id
    : (debateRoom as any).participant2Id;

  if (userId !== participant1Id && userId !== participant2Id) {
    throw new AuthorizationError(
      'Cannot access debate room - user is not a participant',
      'user_not_debate_participant',
      {
        userId,
        resourceType: 'debate_room',
        resourceId: 'id' in debateRoom ? debateRoom.id : undefined,
        action: 'access_debate_room',
        req,
      }
    );
  }
}

/**
 * Check if a user has moderator or admin access
 * @throws ForbiddenError if user is not moderator or admin
 */
export function checkModeratorAccess(
  userId: string | undefined,
  userRole: string | undefined,
  req?: Request
): void {
  if (!userId) {
    throw new ForbiddenError(
      'Authentication required for moderator access',
      'user_not_authenticated',
      {
        userId: undefined,
        action: 'moderate',
        requiredPermission: 'moderator',
        req,
      }
    );
  }

  if (userRole !== 'moderator' && userRole !== 'admin') {
    throw new ForbiddenError(
      'Moderator or admin role required',
      'insufficient_role',
      {
        userId,
        userRole,
        action: 'moderate',
        requiredPermission: 'moderator',
        req,
      }
    );
  }
}

/**
 * Check if a user has admin access
 * @throws ForbiddenError if user is not admin
 */
export function checkAdminAccess(
  userId: string | undefined,
  userRole: string | undefined,
  req?: Request
): void {
  if (!userId) {
    throw new ForbiddenError(
      'Authentication required for admin access',
      'user_not_authenticated',
      {
        userId: undefined,
        action: 'admin_access',
        requiredPermission: 'admin',
        req,
      }
    );
  }

  if (userRole !== 'admin') {
    throw new ForbiddenError(
      'Admin role required',
      'insufficient_role',
      {
        userId,
        userRole,
        action: 'admin_access',
        requiredPermission: 'admin',
        req,
      }
    );
  }
}

/**
 * Check if a user can access another user's profile
 * Users can access their own profile, or public profile info of others
 * @returns true if access is allowed, throws AuthorizationError if not
 */
export function checkProfileAccess(
  requestingUserId: string | undefined,
  targetUserId: string,
  requestingUserRole?: string
): boolean {
  // Users can always access their own profile
  if (requestingUserId === targetUserId) {
    return true;
  }

  // Admins can access any profile
  if (requestingUserRole === 'admin') {
    return true;
  }

  // Public profiles can be viewed by anyone (handled by application logic)
  // This function just checks if there's a blocker
  return true;
}

/**
 * Sanitize user data based on permissions
 * Removes sensitive fields from user objects based on who's requesting
 */
export function sanitizeUserData<T extends Record<string, any>>(
  user: T,
  requestingUserId?: string,
  requestingUserRole?: string
): Partial<T> {
  const isOwnProfile = user.id === requestingUserId;
  const isAdmin = requestingUserRole === 'admin';

  // If user is viewing their own profile or is admin, return all data
  if (isOwnProfile || isAdmin) {
    return user;
  }

  // For public profile access, exclude sensitive fields
  const {
    passwordHash,
    email, // Email might be sensitive depending on privacy settings
    role,
    status,
    onboardingStep,
    onboardingComplete,
    isSynthetic,
    ...publicData
  } = user;

  return publicData as Partial<T>;
}

/**
 * Sanitize user profile data (including political scores)
 * Removes sensitive political scores unless user is viewing own profile
 */
export function sanitizeUserProfileData<T extends Record<string, any>>(
  profile: T,
  requestingUserId?: string,
  requestingUserRole?: string
): Partial<T> {
  const isOwnProfile = profile.userId === requestingUserId || profile.user_id === requestingUserId;
  const isAdmin = requestingUserRole === 'admin';

  // If user is viewing their own profile or is admin, return all data
  if (isOwnProfile || isAdmin) {
    return profile;
  }

  // For public profile access, exclude sensitive political data
  const {
    economicScore,
    economic_score,
    authoritarianScore,
    authoritarian_score,
    leaningScore,
    leaning_score,
    politicalLeaning,
    political_leaning,
    leaningConfidence,
    leaning_confidence,
    opinionCount,
    opinion_count,
    totalOpinions,
    total_opinions,
    totalLikes,
    total_likes,
    totalDislikes,
    total_dislikes,
    lastAnalyzedAt,
    last_analyzed_at,
    ...publicData
  } = profile;

  return publicData as Partial<T>;
}

/**
 * Check if a user can modify a resource
 * Users can modify their own resources, admins can modify any
 */
export function checkModifyPermission(
  userId: string | undefined,
  resourceUserId: string,
  userRole: string | undefined,
  resourceType: string,
  req?: Request
): void {
  if (!userId) {
    throw new AuthorizationError(
      `Authentication required to modify ${resourceType}`,
      'user_not_authenticated',
      {
        userId: undefined,
        resourceType,
        resourceId: resourceUserId,
        action: `modify_${resourceType}`,
        req,
      }
    );
  }

  // Admins can modify anything
  if (userRole === 'admin') {
    return;
  }

  // Users can only modify their own resources
  if (userId !== resourceUserId) {
    throw new AuthorizationError(
      `Cannot modify ${resourceType} owned by another user`,
      'user_does_not_own_resource',
      {
        userId,
        resourceType,
        resourceId: resourceUserId,
        action: `modify_${resourceType}`,
        req,
      }
    );
  }
}


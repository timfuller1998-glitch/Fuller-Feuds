import { db } from '../db.js';
import { badges, userBadges, users } from '../../shared/schema.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import { BADGE_DEFINITIONS } from '../../shared/badgeDefinitions.js';
import {
  SKILL_BADGE_DEFINITIONS,
  XP_SKILLS,
  tierForXp,
  nextTierForXp,
  skillBadgeId,
  type SkillId,
  type SkillXp,
} from '../../shared/xpTiers.js';

export interface UserBadgeStats {
  debateCount: number;
  opinionCount: number;
  topicCount: number;
  likesReceived: number;
  followerCount: number;
  messageCount: number;
  fallacyRate: number;
  ratedDebates: number;
  avgRating: number;
  skillXp: SkillXp;
}

export class BadgeRepository {
  async initializeBadges(): Promise<void> {
    // Insert all badge definitions into the database if they don't exist
    for (const badge of BADGE_DEFINITIONS) {
      const existing = await db
        .select()
        .from(badges)
        .where(eq(badges.id, badge.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(badges).values(badge);
      }
    }
    // XP skill tiers come from shared/xpTiers.ts; upsert so a threshold change there takes effect on deploy.
    for (const badge of SKILL_BADGE_DEFINITIONS) {
      await db
        .insert(badges)
        .values(badge)
        .onConflictDoUpdate({
          target: badges.id,
          set: {
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            category: badge.category,
            tier: badge.tier,
            requirement: badge.requirement,
            requirementType: badge.requirementType,
          },
        });
    }
  }

  /**
   * XP per skill, computed live from existing activity (no XP table, so history counts with no backfill).
   * Earning rules are listed in shared/xpTiers.ts (XP_SKILLS[].rules) and must match this query.
   */
  async getSkillXp(userId: string): Promise<SkillXp> {
    const result: any = await db.execute(sql`
      WITH my_rooms AS (
        SELECT id, status, participant2_id, invitee_id FROM debate_rooms
        WHERE (participant1_id = ${userId} OR participant2_id = ${userId})
          AND COALESCE(invite_status, 'accepted') = 'accepted'
      ),
      ratings AS (
        SELECT COALESCE(SUM(logical_reasoning), 0)::int AS logic,
               COALESCE(SUM(politeness), 0)::int AS polite,
               COALESCE(SUM(openness_to_change), 0)::int AS open
        FROM debate_votes WHERE voted_for_user_id = ${userId} AND voter_id <> ${userId}
      )
      SELECT
        r.logic, r.polite, r.open,
        (SELECT COUNT(*)::int FROM my_rooms) AS debates,
        (SELECT COUNT(*)::int FROM my_rooms WHERE status IN ('ended', 'archived')) AS finished,
        (SELECT COUNT(*)::int FROM my_rooms WHERE invitee_id = ${userId} OR (invitee_id IS NULL AND participant2_id = ${userId})) AS accepted,
        (SELECT COUNT(*)::int FROM debate_messages WHERE user_id = ${userId}) AS messages,
        (SELECT COUNT(*)::int FROM debate_messages m WHERE m.user_id = ${userId}
           AND NOT EXISTS (SELECT 1 FROM debate_message_flags f WHERE f.message_id = m.id)) AS clean_messages,
        (SELECT COUNT(*)::int FROM opinion_sentence_counterpoints
           WHERE author_user_id = ${userId} AND COALESCE(status, 'approved') NOT IN ('hidden', 'flagged', 'removed')) AS counterpoints,
        (SELECT COUNT(*)::int FROM opinions WHERE user_id = ${userId} AND COALESCE(status, 'approved') NOT IN ('hidden', 'flagged')) AS opinions,
        (SELECT COUNT(*)::int FROM opinion_votes v JOIN opinions o ON o.id = v.opinion_id
           WHERE o.user_id = ${userId} AND v.vote_type = 'like' AND v.user_id <> ${userId}) AS likes,
        (SELECT COUNT(*)::int FROM topics WHERE created_by_id = ${userId}) AS topics,
        (SELECT COUNT(*)::int FROM opinions o JOIN topics t ON t.id = o.topic_id
           WHERE t.created_by_id = ${userId} AND o.user_id <> ${userId}
             AND COALESCE(o.status, 'approved') NOT IN ('hidden', 'flagged')) AS topic_opinions
      FROM ratings r
    `);
    const r = (result.rows ?? result)[0] ?? {};
    const n = (k: string) => Number(r[k] || 0);
    return {
      critical_thinking: 20 * n('logic') + 5 * n('clean_messages') + 10 * n('counterpoints'),
      civility: 20 * n('polite') + 10 * n('finished'),
      open_mind: 20 * n('open') + 15 * n('accepted'),
      debating: 50 * n('debates') + 5 * n('messages'),
      opinions: 25 * n('opinions') + 5 * n('likes'),
      topics: 50 * n('topics') + 5 * n('topic_opinions'),
    };
  }

  /** Per-skill XP, current tier and next tier for the profile. */
  async getUserSkills(userId: string) {
    const xp = await this.getSkillXp(userId);
    return XP_SKILLS.map((s) => {
      const tier = tierForXp(xp[s.id]);
      const next = nextTierForXp(xp[s.id]);
      return {
        id: s.id,
        name: s.name,
        icon: s.icon,
        rules: s.rules,
        xp: xp[s.id],
        tier: tier ? { id: tier.id, name: tier.name, minXp: tier.minXp, color: tier.color } : null,
        tierBadgeId: tier ? skillBadgeId(s.id, tier.id) : null,
        nextTier: next ? { id: next.id, name: next.name, minXp: next.minXp, color: next.color } : null,
      };
    });
  }

  async getAllBadges(): Promise<any[]> {
    return await db.select().from(badges).orderBy(asc(badges.category), asc(badges.tier));
  }

  /**
   * Activity stats used for badge awards, computed live from existing tables so that
   * historical activity counts without any backfill.
   */
  async getUserStats(userId: string): Promise<UserBadgeStats> {
    const skillXp = await this.getSkillXp(userId);
    const result: any = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM debate_rooms WHERE participant1_id = ${userId} OR participant2_id = ${userId}) AS debates,
        (SELECT COUNT(*)::int FROM opinions WHERE user_id = ${userId} AND COALESCE(status, 'approved') NOT IN ('hidden', 'flagged')) AS opinions,
        (SELECT COUNT(*)::int FROM topics WHERE created_by_id = ${userId}) AS topics,
        (SELECT COUNT(*)::int FROM opinion_votes v JOIN opinions o ON o.id = v.opinion_id
           WHERE o.user_id = ${userId} AND v.vote_type = 'like' AND v.user_id <> ${userId}) AS likes,
        (SELECT COUNT(*)::int FROM user_follows WHERE following_id = ${userId}) AS followers,
        (SELECT COUNT(*)::int FROM debate_messages WHERE user_id = ${userId}) AS messages,
        (SELECT COUNT(DISTINCT f.message_id)::int FROM debate_message_flags f
           JOIN debate_messages m ON m.id = f.message_id WHERE m.user_id = ${userId}) AS flagged,
        (SELECT COUNT(DISTINCT room_id)::int FROM debate_votes WHERE voted_for_user_id = ${userId} AND voter_id <> ${userId}) AS rated,
        (SELECT AVG((logical_reasoning + politeness + openness_to_change) / 3.0)::float FROM debate_votes
           WHERE voted_for_user_id = ${userId} AND voter_id <> ${userId}) AS avg_rating
    `);
    const r = (result.rows ?? result)[0] ?? {};
    const messages = Number(r.messages || 0);
    const flagged = Number(r.flagged || 0);
    return {
      debateCount: Number(r.debates || 0),
      opinionCount: Number(r.opinions || 0),
      topicCount: Number(r.topics || 0),
      likesReceived: Number(r.likes || 0),
      followerCount: Number(r.followers || 0),
      messageCount: messages,
      fallacyRate: messages > 0 ? (flagged / messages) * 100 : 0,
      ratedDebates: Number(r.rated || 0),
      avgRating: Number(r.avg_rating || 0),
      skillXp,
    };
  }

  /** Progress toward a badge: current value vs. required value (quality badges count debates). */
  progressFor(badge: { id: string; requirement: number; requirementType: string }, stats: UserBadgeStats) {
    switch (badge.requirementType) {
      case 'debate_count': return { current: stats.debateCount, required: badge.requirement };
      case 'opinion_count': return { current: stats.opinionCount, required: badge.requirement };
      case 'topic_count': return { current: stats.topicCount, required: badge.requirement };
      case 'likes_received': return { current: stats.likesReceived, required: badge.requirement };
      case 'follower_count': return { current: stats.followerCount, required: badge.requirement };
      case 'low_fallacy_rate': return { current: stats.debateCount, required: badge.requirement };
      case 'high_rating': return { current: stats.ratedDebates, required: badge.requirement };
      default:
        if (badge.requirementType.startsWith('xp_')) {
          const skill = badge.requirementType.slice(3) as SkillId;
          return { current: stats.skillXp[skill] ?? 0, required: badge.requirement };
        }
        return { current: 0, required: badge.requirement };
    }
  }

  qualifies(badge: { id: string; requirement: number; requirementType: string }, stats: UserBadgeStats): boolean {
    const { current, required } = this.progressFor(badge, stats);
    if (current < required) return false;
    if (badge.requirementType === 'low_fallacy_rate') {
      // Quality badges also need real debate messages and a low share of flagged ones.
      const maxRate = badge.id === 'master_debater' ? 3 : 5;
      return stats.messageCount > 0 && stats.fallacyRate < maxRate;
    }
    if (badge.requirementType === 'high_rating') {
      return stats.avgRating >= (badge.id === 'top_rated' ? 4.5 : 4.0);
    }
    return true;
  }

  /** All badge definitions with this user's unlock state, selection and progress. Awards first. */
  async getUserBadges(userId: string): Promise<any[]> {
    await this.checkAndAwardBadges(userId);
    const stats = await this.getUserStats(userId);

    const [user] = await db
      .select({ selectedBadgeId: users.selectedBadgeId })
      .from(users)
      .where(eq(users.id, userId));
    const selectedBadgeId = user?.selectedBadgeId;

    const allBadges = await db.select().from(badges).orderBy(asc(badges.category), asc(badges.tier));
    const unlocked = await db
      .select({ badgeId: userBadges.badgeId, unlockedAt: userBadges.unlockedAt })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));
    const unlockedMap = new Map(unlocked.map((ub) => [ub.badgeId, ub.unlockedAt]));

    return allBadges.map((badge) => ({
      ...badge,
      badgeId: badge.id,
      unlockedAt: unlockedMap.get(badge.id) || null,
      isSelected: selectedBadgeId === badge.id,
      progress: this.progressFor(badge, stats),
    }));
  }

  /** Awards any badges the user now qualifies for. Badges are permanent once earned. */
  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const stats = await this.getUserStats(userId);
    const allBadges = await db.select().from(badges);
    const earned = allBadges.filter((b) => this.qualifies(b, stats)).map((b) => b.id);
    if (earned.length === 0) return [];
    const inserted = await db
      .insert(userBadges)
      .values(earned.map((badgeId) => ({ userId, badgeId })))
      .onConflictDoNothing()
      .returning({ badgeId: userBadges.badgeId });
    return inserted.map((r) => r.badgeId);
  }

  async setSelectedBadge(userId: string, badgeId: string | null): Promise<void> {
    // If badgeId is provided, verify the user has unlocked this badge
    if (badgeId) {
      const hasBadge = await db
        .select()
        .from(userBadges)
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId)
          )
        )
        .limit(1);

      if (hasBadge.length === 0) {
        throw new Error("User has not unlocked this badge");
      }
    }

    await db
      .update(users)
      .set({ selectedBadgeId: badgeId })
      .where(eq(users.id, userId));
  }
}


import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  pgEnum,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const debateStatusEnum = pgEnum('debate_status', ['open', 'closed', 'private']);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  bio: text("bio"),
  location: varchar("location"),
  followedCategories: text("followed_categories").array().default(sql`ARRAY[]::text[]`),
  onboardingStep: integer("onboarding_step").default(0),
  onboardingComplete: boolean("onboarding_complete").default(false),
  role: varchar("role", { length: 20 }).default("user"), // 'user', 'moderator', 'admin'
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'suspended', 'banned'
  selectedBadgeId: varchar("selected_badge_id"), // Badge displayed on user avatar
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gamification: Badges
export const badges = pgTable("badges", {
  id: varchar("id", { length: 50 }).primaryKey(), // e.g. 'first_debate', 'opinionated_10'
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(), // Lucide icon name
  category: varchar("category", { length: 30 }).notNull(), // 'debate', 'opinion', 'topic', 'quality'
  tier: integer("tier").notNull().default(1), // 1, 2, 3, etc. for progression
  requirement: integer("requirement").notNull(), // Numeric threshold (e.g. 10 debates)
  requirementType: varchar("requirement_type", { length: 30 }).notNull(), // 'debate_count', 'opinion_count', 'topic_count', 'low_fallacy_rate'
});

// Gamification: User badges (tracks which badges users have unlocked)
export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: varchar("badge_id", { length: 50 }).notNull().references(() => badges.id),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_user_badge").on(table.userId, table.badgeId)
]);

// Debate topics
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categories: text("categories").array().notNull().default(sql`ARRAY[]::text[]`),
  imageUrl: varchar("image_url"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  isActive: boolean("is_active").default(true),
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'hidden', 'archived'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual opinions on topics
export const opinions = pgTable("opinions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  stance: varchar("stance", { length: 20 }).notNull(), // 'for', 'against', 'neutral'
  status: varchar("status", { length: 20 }).default("approved"), // 'pending', 'approved', 'flagged', 'hidden'
  debateStatus: debateStatusEnum("debate_status").default("open").notNull(),
  references: text("references").array().default(sql`ARRAY[]::text[]`), // Reference links/URLs
  likesCount: integer("likes_count").default(0),
  dislikesCount: integer("dislikes_count").default(0),
  repliesCount: integer("replies_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI-generated cumulative opinions
export const cumulativeOpinions = pgTable("cumulative_opinions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  keyPoints: text("key_points").array().default([]),
  supportingPercentage: integer("supporting_percentage").default(0),
  opposingPercentage: integer("opposing_percentage").default(0),
  neutralPercentage: integer("neutral_percentage").default(0),
  totalOpinions: integer("total_opinions").default(0),
  confidence: varchar("confidence", { length: 20 }).default("medium"), // 'high', 'medium', 'low'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One-on-one debate rooms
export const debateRooms = pgTable("debate_rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  participant1Id: varchar("participant1_id").notNull().references(() => users.id),
  participant2Id: varchar("participant2_id").notNull().references(() => users.id),
  participant1Stance: varchar("participant1_stance", { length: 20 }).notNull(),
  participant2Stance: varchar("participant2_stance", { length: 20 }).notNull(),
  participant1Privacy: varchar("participant1_privacy", { length: 20 }).default("public"), // 'public', 'private'
  participant2Privacy: varchar("participant2_privacy", { length: 20 }).default("public"), // 'public', 'private'
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'ended', 'abandoned'
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

// Messages in debate rooms
export const debateMessages = pgTable("debate_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: uuid("room_id").notNull().references(() => debateRooms.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  status: varchar("status", { length: 20 }).default("approved"), // 'approved', 'flagged', 'hidden'
  createdAt: timestamp("created_at").defaultNow(),
});

// Live streaming debates
export const liveStreams = pgTable("live_streams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  title: text("title").notNull(),
  description: text("description"),
  moderatorId: varchar("moderator_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("scheduled"), // 'scheduled', 'live', 'ended'
  participantSelectionMethod: varchar("participant_selection_method", { length: 20 }).default("open"), // 'invite', 'open'
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  viewerCount: integer("viewer_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stream invitations for invite-only streams
export const streamInvitations = pgTable("stream_invitations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: uuid("stream_id").notNull().references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'accepted', 'declined'
  invitedAt: timestamp("invited_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
}, (table) => [
  index("unique_stream_invitation").on(table.streamId, table.userId)
]);

// Participants in live streaming debates
export const streamParticipants = pgTable("stream_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: uuid("stream_id").notNull().references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  stance: varchar("stance", { length: 20 }).notNull(),
  isSpeaking: boolean("is_speaking").default(false),
  isMuted: boolean("is_muted").default(false),
  isCameraOn: boolean("is_camera_on").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Live chat messages for streaming debates
export const streamChatMessages = pgTable("stream_chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: uuid("stream_id").notNull().references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  type: varchar("type", { length: 20 }).default("chat"), // 'chat', 'reaction', 'system'
  isModerated: boolean("is_moderated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Opinion votes/reactions
export const opinionVotes = pgTable("opinion_votes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opinionId: uuid("opinion_id").notNull().references(() => opinions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  voteType: varchar("vote_type", { length: 20 }).notNull(), // 'like', 'dislike'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_opinion_user_vote").on(table.opinionId, table.userId)
]);

// Opinion flags - for reporting logical fallacies
export const opinionFlags = pgTable("opinion_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  opinionId: uuid("opinion_id").notNull().references(() => opinions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  fallacyType: varchar("fallacy_type", { length: 50 }).notNull(), // 'ad_hominem', 'straw_man', 'false_dichotomy', etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_opinion_flag").on(table.opinionId, table.userId)
]);

// Topic flags - for flagging entire topics
export const topicFlags = pgTable("topic_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  fallacyType: varchar("fallacy_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_topic_flag").on(table.topicId, table.userId)
]);

// Debate message flags - for flagging chat messages in debates
export const debateMessageFlags = pgTable("debate_message_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: uuid("message_id").notNull().references(() => debateMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  fallacyType: varchar("fallacy_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_message_flag").on(table.messageId, table.userId)
]);

// Moderation actions log - tracks all admin/moderator actions
export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moderatorId: varchar("moderator_id").notNull().references(() => users.id),
  actionType: varchar("action_type", { length: 50 }).notNull(), // 'approve_opinion', 'hide_opinion', 'suspend_user', 'ban_user', etc.
  targetType: varchar("target_type", { length: 50 }).notNull(), // 'opinion', 'user', 'topic', 'challenge'
  targetId: varchar("target_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Banned phrases/words for content filtering
export const bannedPhrases = pgTable("banned_phrases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  phrase: text("phrase").notNull().unique(),
  severity: varchar("severity", { length: 20 }).notNull().default("block"), // 'block' (prevent post), 'flag' (auto-flag for review)
  category: varchar("category", { length: 50 }).default("general"), // 'profanity', 'hate_speech', 'spam', 'general'
  matchType: varchar("match_type", { length: 20 }).default("whole_word"), // 'whole_word', 'partial'
  addedById: varchar("added_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// User following relationships
export const userFollows = pgTable("user_follows", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_follow_relationship").on(table.followerId, table.followingId)
]);

// User profile analytics and political leaning
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  bio: text("bio"),
  displayFirstName: varchar("display_first_name"),
  displayLastName: varchar("display_last_name"),
  opinionSortPreference: varchar("opinion_sort_preference", { length: 25 }).default("newest"), // 'newest', 'oldest', 'most_liked', 'most_controversial'
  categorySortPreference: varchar("category_sort_preference", { length: 20 }).default("popular"), // 'popular', 'alphabetical', 'newest', 'oldest'
  politicalLeaning: varchar("political_leaning", { length: 50 }), // 'progressive', 'moderate', 'conservative', etc.
  leaningScore: integer("leaning_score").default(0), // DEPRECATED: Legacy single-axis score (kept for backward compatibility)
  economicScore: integer("economic_score").default(0), // -100 (socialist) to +100 (capitalist)
  authoritarianScore: integer("authoritarian_score").default(0), // -100 (libertarian) to +100 (authoritarian)
  opinionCount: integer("opinion_count").default(0), // Count of opinions posted (triggers AI analysis every 5)
  leaningConfidence: varchar("leaning_confidence", { length: 20 }).default("low"), // 'high', 'medium', 'low'
  totalOpinions: integer("total_opinions").default(0),
  totalLikes: integer("total_likes").default(0),
  totalDislikes: integer("total_dislikes").default(0),
  followerCount: integer("follower_count").default(0),
  followingCount: integer("following_count").default(0),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Topic views tracking for recent categories
export const topicViews = pgTable("topic_views", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("topic_views_user_id_idx").on(table.userId),
  index("topic_views_viewed_at_idx").on(table.viewedAt)
]);

// Schema types and validation
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpinionSchema = createInsertSchema(opinions).omit({
  id: true,
  likesCount: true,
  dislikesCount: true,
  repliesCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDebateRoomSchema = createInsertSchema(debateRooms).omit({
  id: true,
  status: true,
  startedAt: true,
  endedAt: true,
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({
  id: true,
  status: true,
  startedAt: true,
  endedAt: true,
  viewerCount: true,
  createdAt: true,
});

export const insertUserFollowSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  userId: true,
  economicScore: true,
  authoritarianScore: true,
  opinionCount: true,
  totalOpinions: true,
  totalLikes: true,
  totalDislikes: true,
  followerCount: true,
  followingCount: true,
  lastAnalyzedAt: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect & {
  fallacyCounts?: { [key: string]: number };
};
export type TopicWithCounts = Topic & {
  opinionsCount: number;
  participantCount: number;
  previewContent?: string;
  previewAuthor?: string;
  previewIsAI?: boolean;
};
export type InsertOpinion = z.infer<typeof insertOpinionSchema>;
export type Opinion = typeof opinions.$inferSelect & {
  fallacyCounts?: { [key: string]: number };
  userVote?: 'like' | 'dislike' | null;
  author?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
};
export type CumulativeOpinion = typeof cumulativeOpinions.$inferSelect;
export type DebateRoom = typeof debateRooms.$inferSelect;
export type InsertDebateRoom = z.infer<typeof insertDebateRoomSchema>;
export type DebateMessage = typeof debateMessages.$inferSelect & {
  fallacyCounts?: { [key: string]: number };
};
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;
export type StreamInvitation = typeof streamInvitations.$inferSelect;
export type StreamParticipant = typeof streamParticipants.$inferSelect;
export type StreamChatMessage = typeof streamChatMessages.$inferSelect;
export type OpinionVote = typeof opinionVotes.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export const insertOpinionVoteSchema = createInsertSchema(opinionVotes).omit({
  id: true,
  createdAt: true,
});
export type InsertOpinionVote = z.infer<typeof insertOpinionVoteSchema>;

export const insertOpinionFlagSchema = createInsertSchema(opinionFlags).omit({
  id: true,
  createdAt: true,
});
export type InsertOpinionFlag = z.infer<typeof insertOpinionFlagSchema>;
export type OpinionFlag = typeof opinionFlags.$inferSelect;

export const insertTopicFlagSchema = createInsertSchema(topicFlags).omit({
  id: true,
  createdAt: true,
});
export type InsertTopicFlag = z.infer<typeof insertTopicFlagSchema>;
export type TopicFlag = typeof topicFlags.$inferSelect;

export const insertDebateMessageFlagSchema = createInsertSchema(debateMessageFlags).omit({
  id: true,
  createdAt: true,
});
export type InsertDebateMessageFlag = z.infer<typeof insertDebateMessageFlagSchema>;
export type DebateMessageFlag = typeof debateMessageFlags.$inferSelect;

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
});
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ModerationAction = typeof moderationActions.$inferSelect;

// User-created themes
export const themes = pgTable("themes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  visibility: varchar("visibility", { length: 20 }).default("private").notNull(), // 'private', 'public'
  baseTheme: varchar("base_theme", { length: 20 }).notNull(), // 'light', 'medium', 'dark'
  colors: jsonb("colors").notNull(), // Stores HSL values for all CSS custom properties
  forkedFromThemeId: uuid("forked_from_theme_id"),
  likesCount: integer("likes_count").default(0),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Theme likes - tracks which users liked which themes
export const themeLikes = pgTable("theme_likes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  themeId: uuid("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_theme_like").on(table.themeId, table.userId)
]);

export const insertThemeSchema = createInsertSchema(themes).omit({
  id: true,
  likesCount: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertThemeLikeSchema = createInsertSchema(themeLikes).omit({
  id: true,
  createdAt: true,
});

export type Theme = typeof themes.$inferSelect;
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type ThemeLike = typeof themeLikes.$inferSelect;
export type InsertThemeLike = z.infer<typeof insertThemeLikeSchema>;

export const insertBannedPhraseSchema = createInsertSchema(bannedPhrases).omit({
  id: true,
  createdAt: true,
});

export type BannedPhrase = typeof bannedPhrases.$inferSelect;
export type InsertBannedPhrase = z.infer<typeof insertBannedPhraseSchema>;

// Badges
export const insertBadgeSchema = createInsertSchema(badges);
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  unlockedAt: true,
});
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

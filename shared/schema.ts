import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Debate topics
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  imageUrl: varchar("image_url"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  isActive: boolean("is_active").default(true),
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
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  viewerCount: integer("viewer_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  index("unique_opinion_user_vote").on(table.opinionId, table.userId)
]);

// User following relationships
export const userFollows = pgTable("user_follows", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("unique_follow_relationship").on(table.followerId, table.followingId)
]);

// User profile analytics and political leaning
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  bio: text("bio"),
  politicalLeaning: varchar("political_leaning", { length: 50 }), // 'progressive', 'moderate', 'conservative', etc.
  leaningScore: integer("leaning_score").default(0), // -100 (very progressive) to +100 (very conservative)
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
export type Topic = typeof topics.$inferSelect;
export type InsertOpinion = z.infer<typeof insertOpinionSchema>;
export type Opinion = typeof opinions.$inferSelect;
export type CumulativeOpinion = typeof cumulativeOpinions.$inferSelect;
export type DebateRoom = typeof debateRooms.$inferSelect;
export type InsertDebateRoom = z.infer<typeof insertDebateRoomSchema>;
export type DebateMessage = typeof debateMessages.$inferSelect;
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;
export type StreamParticipant = typeof streamParticipants.$inferSelect;
export type StreamChatMessage = typeof streamChatMessages.$inferSelect;
export type OpinionVote = typeof opinionVotes.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

CREATE TYPE "public"."debate_phase" AS ENUM('structured', 'voting', 'free-form');--> statement-breakpoint
CREATE TYPE "public"."debate_status" AS ENUM('open', 'closed', 'private');--> statement-breakpoint
CREATE TABLE "badges" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(50) NOT NULL,
	"category" varchar(30) NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"requirement" integer NOT NULL,
	"requirement_type" varchar(30) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phrase" text NOT NULL,
	"severity" varchar(20) DEFAULT 'block' NOT NULL,
	"category" varchar(50) DEFAULT 'general',
	"match_type" varchar(20) DEFAULT 'whole_word',
	"added_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "banned_phrases_phrase_unique" UNIQUE("phrase")
);
--> statement-breakpoint
CREATE TABLE "cumulative_opinions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_points" text[] DEFAULT '{}',
	"total_opinions" integer DEFAULT 0,
	"confidence" varchar(20) DEFAULT 'medium',
	"average_economic_score" integer,
	"average_authoritarian_score" integer,
	"diversity_score" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debate_message_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"fallacy_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debate_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'approved',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debate_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"participant1_id" varchar NOT NULL,
	"participant2_id" varchar NOT NULL,
	"participant1_privacy" varchar(20) DEFAULT 'public',
	"participant2_privacy" varchar(20) DEFAULT 'public',
	"status" varchar(20) DEFAULT 'active',
	"phase" "debate_phase" DEFAULT 'structured' NOT NULL,
	"current_turn" varchar,
	"turn_count1" integer DEFAULT 0,
	"turn_count2" integer DEFAULT 0,
	"votes_to_continue1" boolean,
	"votes_to_continue2" boolean,
	"participant1_last_read_at" timestamp,
	"participant2_last_read_at" timestamp,
	"last_message_at" timestamp,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "debate_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"voter_id" varchar NOT NULL,
	"voted_for_user_id" varchar NOT NULL,
	"logical_reasoning" integer NOT NULL,
	"politeness" integer NOT NULL,
	"openness_to_change" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"moderator_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled',
	"participant_selection_method" varchar(20) DEFAULT 'open',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"viewer_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" varchar NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"debate_room_id" uuid,
	"message_id" uuid,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opinion_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opinion_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"fallacy_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opinion_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opinion_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opinions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'approved',
	"debate_status" "debate_status" DEFAULT 'open' NOT NULL,
	"references" text[] DEFAULT ARRAY[]::text[],
	"topic_economic_score" integer,
	"topic_authoritarian_score" integer,
	"likes_count" integer DEFAULT 0,
	"dislikes_count" integer DEFAULT 0,
	"replies_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'chat',
	"is_moderated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stream_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"invited_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stream_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"stance" varchar(20) NOT NULL,
	"is_speaking" boolean DEFAULT false,
	"is_muted" boolean DEFAULT false,
	"is_camera_on" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topic_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"fallacy_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topic_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"topic_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_url" varchar,
	"created_by_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'active',
	"embedding" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"badge_id" varchar(50) NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_debate_stats" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"total_debates" integer DEFAULT 0,
	"avg_logical_reasoning" integer DEFAULT 0,
	"avg_politeness" integer DEFAULT 0,
	"avg_openness_to_change" integer DEFAULT 0,
	"total_votes_received" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bio" text,
	"display_first_name" varchar,
	"display_last_name" varchar,
	"opinion_sort_preference" varchar(25) DEFAULT 'newest',
	"category_sort_preference" varchar(20) DEFAULT 'popular',
	"political_leaning" varchar(50),
	"leaning_score" integer DEFAULT 0,
	"economic_score" integer DEFAULT 0,
	"authoritarian_score" integer DEFAULT 0,
	"opinion_count" integer DEFAULT 0,
	"leaning_confidence" varchar(20) DEFAULT 'low',
	"total_opinions" integer DEFAULT 0,
	"total_likes" integer DEFAULT 0,
	"total_dislikes" integer DEFAULT 0,
	"follower_count" integer DEFAULT 0,
	"following_count" integer DEFAULT 0,
	"last_analyzed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"bio" text,
	"location" varchar,
	"followed_categories" text[] DEFAULT ARRAY[]::text[],
	"onboarding_step" integer DEFAULT 0,
	"onboarding_complete" boolean DEFAULT false,
	"role" varchar(20) DEFAULT 'user',
	"status" varchar(20) DEFAULT 'active',
	"selected_badge_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "banned_phrases" ADD CONSTRAINT "banned_phrases_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cumulative_opinions" ADD CONSTRAINT "cumulative_opinions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_message_flags" ADD CONSTRAINT "debate_message_flags_message_id_debate_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."debate_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_message_flags" ADD CONSTRAINT "debate_message_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_room_id_debate_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."debate_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_rooms" ADD CONSTRAINT "debate_rooms_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_rooms" ADD CONSTRAINT "debate_rooms_participant1_id_users_id_fk" FOREIGN KEY ("participant1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_rooms" ADD CONSTRAINT "debate_rooms_participant2_id_users_id_fk" FOREIGN KEY ("participant2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_room_id_debate_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."debate_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_voted_for_user_id_users_id_fk" FOREIGN KEY ("voted_for_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_debate_room_id_debate_rooms_id_fk" FOREIGN KEY ("debate_room_id") REFERENCES "public"."debate_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_message_id_debate_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."debate_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinion_flags" ADD CONSTRAINT "opinion_flags_opinion_id_opinions_id_fk" FOREIGN KEY ("opinion_id") REFERENCES "public"."opinions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinion_flags" ADD CONSTRAINT "opinion_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinion_votes" ADD CONSTRAINT "opinion_votes_opinion_id_opinions_id_fk" FOREIGN KEY ("opinion_id") REFERENCES "public"."opinions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinion_votes" ADD CONSTRAINT "opinion_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinions" ADD CONSTRAINT "opinions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinions" ADD CONSTRAINT "opinions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_chat_messages" ADD CONSTRAINT "stream_chat_messages_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_chat_messages" ADD CONSTRAINT "stream_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_invitations" ADD CONSTRAINT "stream_invitations_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_invitations" ADD CONSTRAINT "stream_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_participants" ADD CONSTRAINT "stream_participants_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_participants" ADD CONSTRAINT "stream_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_flags" ADD CONSTRAINT "topic_flags_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_flags" ADD CONSTRAINT "topic_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_views" ADD CONSTRAINT "topic_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_views" ADD CONSTRAINT "topic_views_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_debate_stats" ADD CONSTRAINT "user_debate_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_message_flag" ON "debate_message_flags" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_debate_vote" ON "debate_votes" USING btree ("room_id","voter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_opinion_flag" ON "opinion_flags" USING btree ("opinion_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_opinion_user_vote" ON "opinion_votes" USING btree ("opinion_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_push_subscription" ON "push_subscriptions" USING btree ("user_id","endpoint");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "unique_stream_invitation" ON "stream_invitations" USING btree ("stream_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_topic_flag" ON "topic_flags" USING btree ("topic_id","user_id");--> statement-breakpoint
CREATE INDEX "topic_views_user_id_idx" ON "topic_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_views_viewed_at_idx" ON "topic_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_badge" ON "user_badges" USING btree ("user_id","badge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_follow_relationship" ON "user_follows" USING btree ("follower_id","following_id");
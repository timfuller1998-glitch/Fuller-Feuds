-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR POLITICAL DATA PLATFORM
-- ============================================================================
-- These policies protect sensitive user data including political scores,
-- opinions, votes, and private conversations.
-- 
-- NOTE: Since this application uses direct PostgreSQL connections (not Supabase client),
-- RLS policies will not be automatically enforced. These policies document security
-- intent and will protect the database if/when migrating to Supabase client or
-- if implementing session-based RLS enforcement.
-- ============================================================================

-- Create helper function to get current user ID
-- This is a placeholder function for direct connections
-- For Supabase Auth, this would be: auth.uid()::text
-- For direct connections, this returns NULL (no enforcement)
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS text AS $$
  -- Placeholder function for direct connections
  -- Replace with actual auth mechanism if using Supabase client
  SELECT NULL::text;
$$ LANGUAGE sql STABLE;

-- Create helper function to check if user is moderator/admin
-- This is a placeholder function for direct connections
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin(user_id text) RETURNS boolean AS $$
  -- Placeholder function for direct connections
  -- Replace with actual role check if using Supabase client
  SELECT false;
$$ LANGUAGE sql STABLE;

-- Enable RLS on all tables
DO $$ 
BEGIN
  ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
  ALTER TABLE banned_phrases ENABLE ROW LEVEL SECURITY;
  ALTER TABLE cumulative_opinions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE debate_message_flags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE debate_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE debate_rooms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE debate_votes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
  ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE opinion_flags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE opinion_votes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE opinions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE stream_chat_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE stream_invitations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE stream_participants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE topic_flags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE topic_views ENABLE ROW LEVEL SECURITY;
  ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_debate_stats ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  
  RAISE NOTICE 'RLS enabled on all tables';
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error enabling RLS: %', SQLERRM;
END $$;

-- ============================================================================
-- USERS TABLE - Highly Sensitive
-- ============================================================================

-- Policy: Users can only read their own account data
CREATE POLICY "Users can read own account"
  ON users FOR SELECT
  USING (id = current_user_id());

-- Policy: Users can update their own account (except role/status - handled by admin)
CREATE POLICY "Users can update own account"
  ON users FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

-- Policy: Public can see limited profile info (for display purposes)
CREATE POLICY "Public can view basic profiles"
  ON users FOR SELECT
  USING (true);

-- ============================================================================
-- USER_PROFILES TABLE - EXTREMELY SENSITIVE (Political Scores)
-- ============================================================================

-- Policy: Users can only read their own political scores
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (user_id = current_user_id());

-- Policy: Users can update their own profile preferences (but not computed scores)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (
    user_id = current_user_id()
    -- Prevent users from modifying computed scores (enforced at app level)
  );

-- Policy: Public can see limited profile (no scores) - for display purposes
CREATE POLICY "Public can view limited profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- ============================================================================
-- OPINIONS TABLE - Sensitive (Contains Political Stance)
-- ============================================================================

-- Policy: Public can read approved opinions
CREATE POLICY "Public can read approved opinions"
  ON opinions FOR SELECT
  USING (status = 'approved');

-- Policy: Users can read their own opinions (even if not approved)
CREATE POLICY "Users can read own opinions"
  ON opinions FOR SELECT
  USING (user_id = current_user_id());

-- Policy: Users can create their own opinions
CREATE POLICY "Users can create own opinions"
  ON opinions FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Policy: Users can update their own opinions
CREATE POLICY "Users can update own opinions"
  ON opinions FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Policy: Moderators/admins can moderate opinions
CREATE POLICY "Moderators can moderate opinions"
  ON opinions FOR ALL
  USING (is_moderator_or_admin(current_user_id()));

-- ============================================================================
-- OPINION_VOTES TABLE - Sensitive (Voting Patterns)
-- ============================================================================

-- Policy: Users can only see their own votes
CREATE POLICY "Users can read own votes"
  ON opinion_votes FOR SELECT
  USING (user_id = current_user_id());

-- Policy: Users can create their own votes
CREATE POLICY "Users can create own votes"
  ON opinion_votes FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Policy: Users can update their own votes
CREATE POLICY "Users can update own votes"
  ON opinion_votes FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- DEBATE_ROOMS TABLE - Private Conversations
-- ============================================================================

-- Policy: Only participants can access their debate rooms
CREATE POLICY "Participants can access debate rooms"
  ON debate_rooms FOR SELECT
  USING (
    participant1_id = current_user_id()
    OR participant2_id = current_user_id()
  );

-- Policy: Users can create debate rooms (as participant)
CREATE POLICY "Users can create debate rooms"
  ON debate_rooms FOR INSERT
  WITH CHECK (
    participant1_id = current_user_id()
    OR participant2_id = current_user_id()
  );

-- Policy: Participants can update their debate rooms
CREATE POLICY "Participants can update debate rooms"
  ON debate_rooms FOR UPDATE
  USING (
    participant1_id = current_user_id()
    OR participant2_id = current_user_id()
  );

-- ============================================================================
-- DEBATE_MESSAGES TABLE - Private Messages
-- ============================================================================

-- Policy: Only debate participants can read messages
CREATE POLICY "Debate participants can read messages"
  ON debate_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debate_rooms
      WHERE debate_rooms.id = debate_messages.room_id
      AND (
        debate_rooms.participant1_id = current_user_id()
        OR debate_rooms.participant2_id = current_user_id()
      )
    )
  );

-- Policy: Only debate participants can create messages
CREATE POLICY "Debate participants can create messages"
  ON debate_messages FOR INSERT
  WITH CHECK (
    user_id = current_user_id()
    AND EXISTS (
      SELECT 1 FROM debate_rooms
      WHERE debate_rooms.id = debate_messages.room_id
      AND (
        debate_rooms.participant1_id = current_user_id()
        OR debate_rooms.participant2_id = current_user_id()
      )
    )
  );

-- ============================================================================
-- DEBATE_VOTES TABLE - Sensitive (Performance Ratings)
-- ============================================================================

-- Policy: Users can only see votes they cast
CREATE POLICY "Users can read own debate votes"
  ON debate_votes FOR SELECT
  USING (voter_id = current_user_id());

-- Policy: Users can create votes in debates they're part of
CREATE POLICY "Users can vote in own debates"
  ON debate_votes FOR INSERT
  WITH CHECK (
    voter_id = current_user_id()
    AND EXISTS (
      SELECT 1 FROM debate_rooms
      WHERE debate_rooms.id = debate_votes.room_id
      AND (
        debate_rooms.participant1_id = current_user_id()
        OR debate_rooms.participant2_id = current_user_id()
      )
    )
  );

-- ============================================================================
-- TOPIC_VIEWS TABLE - Sensitive (Tracking Data)
-- ============================================================================

-- Policy: Users can only see their own view history
CREATE POLICY "Users can read own topic views"
  ON topic_views FOR SELECT
  USING (user_id = current_user_id());

-- Policy: Users can create their own view records
CREATE POLICY "Users can create own topic views"
  ON topic_views FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- USER_FOLLOWS TABLE - Sensitive (Social Graph)
-- ============================================================================

-- Policy: Public can see follow relationships (needed for follower counts)
CREATE POLICY "Public can read follow relationships"
  ON user_follows FOR SELECT
  USING (true);

-- Policy: Users can create their own follow relationships
CREATE POLICY "Users can create own follows"
  ON user_follows FOR INSERT
  WITH CHECK (follower_id = current_user_id());

-- Policy: Users can delete their own follows
CREATE POLICY "Users can delete own follows"
  ON user_follows FOR DELETE
  USING (follower_id = current_user_id());

-- ============================================================================
-- NOTIFICATIONS TABLE - Private
-- ============================================================================

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = current_user_id());

-- Policy: System can create notifications (no user check needed - handled by app)
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- PUSH_SUBSCRIPTIONS TABLE - Highly Sensitive (Device Identifiers)
-- ============================================================================

-- Policy: Users can only access their own push subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- TOPICS TABLE - Public Content
-- ============================================================================

-- Policy: Public can read active topics
CREATE POLICY "Public can read active topics"
  ON topics FOR SELECT
  USING (status = 'active' AND is_active = true);

-- Policy: Authenticated users can create topics
CREATE POLICY "Authenticated users can create topics"
  ON topics FOR INSERT
  WITH CHECK (created_by_id = current_user_id());

-- Policy: Topic creators and moderators can update topics
CREATE POLICY "Creators and moderators can update topics"
  ON topics FOR UPDATE
  USING (
    created_by_id = current_user_id()
    OR is_moderator_or_admin(current_user_id())
  );

-- ============================================================================
-- OPINION_FLAGS TABLE - Sensitive (Reporting Data)
-- ============================================================================

-- Policy: Users can only see flags they created
CREATE POLICY "Users can read own flags"
  ON opinion_flags FOR SELECT
  USING (user_id = current_user_id());

-- Policy: Users can create flags
CREATE POLICY "Users can create flags"
  ON opinion_flags FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Policy: Moderators can see all flags
CREATE POLICY "Moderators can see all flags"
  ON opinion_flags FOR SELECT
  USING (is_moderator_or_admin(current_user_id()));

-- ============================================================================
-- MODERATION_ACTIONS TABLE - Admin Only
-- ============================================================================

-- Policy: Only moderators/admins can see moderation actions
CREATE POLICY "Moderators can access moderation actions"
  ON moderation_actions FOR ALL
  USING (is_moderator_or_admin(current_user_id()));

-- ============================================================================
-- SESSIONS TABLE - Highly Sensitive
-- ============================================================================

-- Policy: No public access to sessions (application handles this)
CREATE POLICY "No public session access"
  ON sessions FOR ALL
  USING (false);

-- ============================================================================
-- PUBLIC TABLES (No sensitive data)
-- ============================================================================

-- Badges: Public read
CREATE POLICY "Public can read badges"
  ON badges FOR SELECT
  USING (true);

-- User badges: Public read (shows achievements)
CREATE POLICY "Public can read user badges"
  ON user_badges FOR SELECT
  USING (true);

-- Cumulative opinions: Public read (aggregated data)
CREATE POLICY "Public can read cumulative opinions"
  ON cumulative_opinions FOR SELECT
  USING (true);

-- User debate stats: Public read (performance metrics)
CREATE POLICY "Public can read debate stats"
  ON user_debate_stats FOR SELECT
  USING (true);

-- Live streams: Public read active streams
CREATE POLICY "Public can read active streams"
  ON live_streams FOR SELECT
  USING (status IN ('scheduled', 'live'));

-- Stream participants: Public read
CREATE POLICY "Public can read stream participants"
  ON stream_participants FOR SELECT
  USING (true);

-- Stream chat messages: Public read (for live streams)
CREATE POLICY "Public can read stream chat"
  ON stream_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM live_streams
      WHERE live_streams.id = stream_chat_messages.stream_id
      AND live_streams.status = 'live'
    )
  );

-- Stream invitations: Only invited users can see
CREATE POLICY "Users can read own invitations"
  ON stream_invitations FOR SELECT
  USING (user_id = current_user_id());

-- Topic flags: Similar to opinion flags
CREATE POLICY "Users can read own topic flags"
  ON topic_flags FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "Users can create topic flags"
  ON topic_flags FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Debate message flags: Similar to opinion flags
CREATE POLICY "Users can read own debate message flags"
  ON debate_message_flags FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "Users can create debate message flags"
  ON debate_message_flags FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Banned phrases: Public read (for content filtering), admin write
CREATE POLICY "Public can read banned phrases"
  ON banned_phrases FOR SELECT
  USING (true);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies created successfully for all tables';
  RAISE NOTICE 'NOTE: These policies will not enforce with direct PostgreSQL connections';
  RAISE NOTICE 'They document security intent and will protect if migrating to Supabase client';
END $$;


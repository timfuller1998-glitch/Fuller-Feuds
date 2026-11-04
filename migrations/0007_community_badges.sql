-- 0007: community badge definitions (likes received, followers).
-- Data-only: no schema change. Badges/user_badges tables already exist (0000).
-- The server also upserts these from shared/badgeDefinitions.ts on startup (initializeBadges),
-- so this file is for environments that seed badges via SQL. Idempotent.
INSERT INTO badges (id, name, description, icon, category, tier, requirement, requirement_type) VALUES
  ('well_liked',     'Well Liked',     'Received 5 likes on your opinions',  'ThumbsUp', 'community', 1, 5,  'likes_received'),
  ('crowd_favorite', 'Crowd Favorite', 'Received 50 likes on your opinions', 'Heart',    'community', 2, 50, 'likes_received'),
  ('first_follower', 'First Follower', 'Gained your first follower',         'UserPlus', 'community', 1, 1,  'follower_count'),
  ('influencer',     'Influencer',     'Gained 10 followers',                'Users',    'community', 2, 10, 'follower_count')
ON CONFLICT (id) DO NOTHING;

-- Supports the likes-received badge/leaderboard query (opinion_votes joined to opinions by author).
CREATE INDEX IF NOT EXISTS idx_opinion_votes_opinion_type ON opinion_votes (opinion_id, vote_type);

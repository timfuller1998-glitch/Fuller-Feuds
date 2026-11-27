-- Activity notifications (Fuller Feuds Dev, Nov 27 2026). Additive only.
-- Bursts collapse into one row per (user, group_key) while unread; actor_ids holds who did it, link_url where it opens.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key varchar(160);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_ids text[] DEFAULT ARRAY[]::text[];
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notifications_user_group_idx ON notifications (user_id, group_key);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
-- Per-type on/off switches, e.g. {"topicOpinions": false}. Missing keys mean on.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'::jsonb;

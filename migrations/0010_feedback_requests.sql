-- 0010: in-app bug reports and feature requests (Fuller Feuds Dev, Nov 11 2026). Safe to re-run.
CREATE TABLE IF NOT EXISTS feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  type varchar(20) NOT NULL CHECK (type IN ('bug','feature')),
  title varchar(140) NOT NULL,
  description text NOT NULL,
  page_url text,
  user_agent text,
  status varchar(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done','wont_fix')),
  admin_note text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback_requests (status, created_at);
-- The app talks to Postgres directly; RLS with no policies keeps the table closed to Supabase's public REST API.
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;

-- 0012: users can flag an opinion as likely AI-written (Fuller Feuds Dev, Nov 19 2026). Safe to re-run.
CREATE TABLE IF NOT EXISTS opinion_ai_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES opinions(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  CONSTRAINT unique_opinion_ai_flag UNIQUE (opinion_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_opinion_ai_flags_opinion ON opinion_ai_flags (opinion_id);
ALTER TABLE opinion_ai_flags ENABLE ROW LEVEL SECURITY;

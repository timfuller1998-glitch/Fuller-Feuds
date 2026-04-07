-- Align production DB with shared/schema.ts: cumulative_opinions.summary_sentences
-- and sentence-level counterpoint tables. Without summary_sentences, Drizzle selects
-- fail and GET /api/topics returns 500.

ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS summary_sentences jsonb;

CREATE TABLE IF NOT EXISTS opinion_sentence_counterpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  opinion_id uuid NOT NULL REFERENCES opinions(id) ON DELETE CASCADE,
  sentence_index integer NOT NULL,
  author_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  status varchar(20) DEFAULT 'approved',
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opinion_sentence_counterpoints_opinion_id_idx
  ON opinion_sentence_counterpoints (opinion_id);

CREATE TABLE IF NOT EXISTS counterpoint_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  counterpoint_id uuid NOT NULL REFERENCES opinion_sentence_counterpoints(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_counterpoint_user_like
  ON counterpoint_likes (counterpoint_id, user_id);

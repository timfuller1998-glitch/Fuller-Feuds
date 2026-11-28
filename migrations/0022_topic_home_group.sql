-- Official home group for every topic (Fuller Feuds Dev, Nov 27 2026). Additive and idempotent.
-- home_major / home_sub hold ids from shared/topicTaxonomy.ts (e.g. 'entertainment' / 'movies').
-- Nullable so old rows keep working: a topic with no home is classified on the fly (never "Other").
-- topics.categories stays as optional free-form extra tags.
ALTER TABLE topics ADD COLUMN IF NOT EXISTS home_major varchar(40);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS home_sub varchar(60);
CREATE INDEX IF NOT EXISTS idx_topics_home_major ON topics (home_major);

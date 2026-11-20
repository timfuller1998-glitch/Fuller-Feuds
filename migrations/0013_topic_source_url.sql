-- 0013: optional source URL on topics (Fuller Feuds Dev, Nov 19 2026). Safe to re-run.
ALTER TABLE topics ADD COLUMN IF NOT EXISTS source_url text;

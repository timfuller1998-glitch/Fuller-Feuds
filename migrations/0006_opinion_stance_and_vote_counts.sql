-- Opinion stance (for / against / neutral). NULL = unstated (existing rows).
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS stance varchar(10);
DO $$ BEGIN
  ALTER TABLE opinions ADD CONSTRAINT opinions_stance_check
    CHECK (stance IS NULL OR stance IN ('for', 'against', 'neutral'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS opinions_topic_stance_idx ON opinions (topic_id, stance);

-- Backfill denormalized vote counters from opinion_votes (they were never written before;
-- the API now reads these columns and keeps them in sync on every vote).
UPDATE opinions o SET
  likes_count = COALESCE(v.likes, 0),
  dislikes_count = COALESCE(v.dislikes, 0)
FROM (
  SELECT o2.id,
         COUNT(*) FILTER (WHERE ov.vote_type = 'like') AS likes,
         COUNT(*) FILTER (WHERE ov.vote_type = 'dislike') AS dislikes
  FROM opinions o2 LEFT JOIN opinion_votes ov ON ov.opinion_id = o2.id
  GROUP BY o2.id
) v
WHERE v.id = o.id;

-- 0014: debate overhaul (Fuller Feuds Dev, Nov 20 2026). Additive only, safe to re-run.
-- Each side's stance in a debate (copied from their opinion, or picked when challenging without one).
ALTER TABLE debate_rooms ADD COLUMN IF NOT EXISTS participant1_stance varchar(10);
ALTER TABLE debate_rooms ADD COLUMN IF NOT EXISTS participant2_stance varchar(10);
-- Fast lookups for the Live Debates page and the per-user hourly start limit.
CREATE INDEX IF NOT EXISTS idx_debate_rooms_live ON debate_rooms (status, invite_status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_started_at ON debate_rooms (started_at DESC);

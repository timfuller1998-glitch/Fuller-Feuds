-- 0011: debate invites can be accepted or declined (Fuller Feuds Dev, Nov 11 2026). Safe to re-run.
ALTER TABLE debate_rooms ADD COLUMN IF NOT EXISTS invite_status varchar(20) NOT NULL DEFAULT 'accepted';
ALTER TABLE debate_rooms ADD COLUMN IF NOT EXISTS invitee_id varchar REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_debate_rooms_invitee_pending ON debate_rooms (invitee_id) WHERE invite_status = 'pending';

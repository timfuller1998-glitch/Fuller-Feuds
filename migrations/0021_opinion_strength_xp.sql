-- Opinion strength XP (Fuller Feuds Dev, Nov 27 2026). Additive and idempotent.
-- opinions.strength_xp holds the 0-25 XP the server computed from the opinion's text (shared/opinionStrength.ts).
-- Every opinion that already exists keeps the flat 25 XP it was earning, so nobody's XP changes retroactively.
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS strength_xp integer;
UPDATE opinions SET strength_xp = 25 WHERE strength_xp IS NULL;

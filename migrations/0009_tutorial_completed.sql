-- 0009: remember when each user finished (or skipped) the first-run tutorial.
-- NULL = show the tutorial on their next visit. Existing users who already finished onboarding are marked done,
-- so the tour only appears for new sign-ups (anyone can replay it from Settings or "How it works").
-- Safe to re-run (the backfill only runs when the column is first added).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tutorial_completed_at') THEN
    ALTER TABLE users ADD COLUMN tutorial_completed_at timestamp;
    UPDATE users SET tutorial_completed_at = now() WHERE onboarding_complete = true;
  END IF;
END $$;

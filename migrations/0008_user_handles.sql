-- 0008: unique @handles for users (display names may repeat; handles may not).
-- Rules (enforced in app code, shared/handle.ts; the CHECK below is a backstop): 3-20 chars,
-- letters/numbers/underscore, starts with a letter. Unique case-insensitively via lower(handle).
-- Safe to re-run. MUST be applied to production before deploying the code that uses users.handle.

ALTER TABLE users ADD COLUMN IF NOT EXISTS handle varchar(20);

-- Backfill: screen name (user_profiles.display_first_name) or first name (+ last initial), cleaned,
-- with a number appended when the base is taken or reserved.
DO $$
DECLARE
  r record;
  base text;
  cand text;
  n int;
  reserved text[] := ARRAY['admin','administrator','moderator','mod','mods','support','help','helpdesk','fullerfeuds',
    'fullerfeud','fuller_feuds','fuller','feuds','api','app','www','root','system','staff','official','team','security',
    'settings','profile','login','logout','signup','register','onboarding','about','terms','privacy','null','undefined',
    'anonymous','everyone','here','me','you','user','users','u','topic','topics','debate','debates','live','search',
    'trending','grok','bot','owner'];
BEGIN
  FOR r IN
    SELECT u.id, coalesce(nullif(trim(p.display_first_name), ''), u.first_name, '') AS fname,
           CASE WHEN nullif(trim(p.display_first_name), '') IS NULL THEN coalesce(left(u.last_name, 1), '') ELSE '' END AS linit
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.handle IS NULL
    ORDER BY u.created_at NULLS LAST, u.id
  LOOP
    base := regexp_replace(r.fname || r.linit, '[^A-Za-z0-9_]', '', 'g');
    IF base !~ '^[A-Za-z]' THEN base := 'user' || base; END IF;
    base := left(base, 15);
    IF length(base) < 3 THEN base := rpad(base, 3, '1'); END IF;
    cand := base; n := 1;
    WHILE lower(cand) = ANY(reserved) OR EXISTS (SELECT 1 FROM users WHERE lower(handle) = lower(cand)) LOOP
      n := n + 1;
      cand := base || n::text;
    END LOOP;
    UPDATE users SET handle = cand WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_unique ON users (lower(handle));
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_handle_format CHECK (handle ~ '^[A-Za-z][A-Za-z0-9_]{2,19}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

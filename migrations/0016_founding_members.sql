-- 0016: founding members — invite-only sign-up, applications, invite codes, founder perks, founders' room,
-- site switches (Fuller Feuds Dev, Nov 20 2026). Additive only, safe to re-run.

-- Site-wide switches (founding_mode, public_launch). Read by GET /api/site-config.
CREATE TABLE IF NOT EXISTS site_settings (
  key varchar(50) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp DEFAULT now()
);
INSERT INTO site_settings (key, value) VALUES ('founding_mode', 'true'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('public_launch', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;

-- Founding-member applications (/apply). politics/religion are optional and admin-only.
CREATE TABLE IF NOT EXISTS founder_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(80) NOT NULL,
  email varchar(254) NOT NULL,
  ref_source varchar(80),
  heard_about text,
  where_debate text,
  profile_links text,
  interests text[] NOT NULL DEFAULT ARRAY[]::text[],
  politics varchar(40),
  religion varchar(40),
  steelman_prompt varchar(200),
  steelman text NOT NULL,
  mind_change text NOT NULL,
  frequency varchar(20) NOT NULL,
  is_18_plus boolean NOT NULL DEFAULT false,
  pledge_agreed boolean NOT NULL DEFAULT false,
  ip_hash varchar(64),
  user_agent varchar(500),
  suggested_scores jsonb,
  suggested_total integer,
  red_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  score_method varchar(20),
  ai_notes text,
  admin_score integer,
  admin_note text,
  status varchar(20) NOT NULL DEFAULT 'new',
  invite_code_id uuid,
  reviewed_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  created_at timestamp DEFAULT now(),
  CONSTRAINT founder_applications_status_check CHECK (status IN ('new', 'accepted', 'declined', 'waitlisted'))
);
CREATE INDEX IF NOT EXISTS founder_applications_status_idx ON founder_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS founder_applications_email_idx ON founder_applications (lower(email));

-- Single-use invite codes. owner_user_id = founder who holds it (NULL for admin-issued codes).
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(32) NOT NULL UNIQUE,
  kind varchar(20) NOT NULL DEFAULT 'admin',
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  owner_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  application_id uuid REFERENCES founder_applications(id) ON DELETE SET NULL,
  note varchar(200),
  used_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  used_at timestamp,
  revoked_at timestamp,
  created_at timestamp DEFAULT now(),
  CONSTRAINT invite_codes_kind_check CHECK (kind IN ('admin', 'acceptance', 'founder'))
);
CREATE INDEX IF NOT EXISTS invite_codes_owner_idx ON invite_codes (owner_user_id);

-- Users: who invited them, how they found us, 18+ confirmation, founder perks.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ref varchar(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS founder_number integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS founder_lifetime_ad_free boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS users_founder_number_unique ON users (founder_number) WHERE founder_number IS NOT NULL;

-- Founders' Room: a small discussion board only founders and admins can read or post in.
CREATE TABLE IF NOT EXISTS founder_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS founder_posts_created_idx ON founder_posts (created_at DESC);

-- Showcase: an admin can feature a debate on /live as the weekly showcase.
ALTER TABLE debate_rooms ADD COLUMN IF NOT EXISTS is_showcase boolean DEFAULT false;

-- Numbered Founding Member badge (awarded on founder sign-up only, never by stats).
INSERT INTO badges (id, name, description, icon, category, tier, requirement, requirement_type)
VALUES ('founding_member', 'Founding Member', 'One of the first 100 members who set the culture of Fuller Feuds', 'Crown', 'community', 1, 1, 'founder')
ON CONFLICT (id) DO NOTHING;

-- RLS on like the other app tables (server connects as the owner role, so this only blocks the public API).
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_posts ENABLE ROW LEVEL SECURITY;

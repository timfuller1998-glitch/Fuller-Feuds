-- Founder launch passes (Fuller Feuds Dev, Nov 20 2026). Additive only.
-- Founders' 3 codes (invite_codes.kind = 'founder') are now "launch passes": they can't open an account while the
-- site is invite-only, only once the admin "public launch" switch is on, and they give 1 year of premium.
-- People holding a pass before launch can leave an email here so they hear when it unlocks.
CREATE TABLE IF NOT EXISTS launch_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL,
  invite_code_id uuid REFERENCES invite_codes(id) ON DELETE SET NULL,
  source varchar(40) DEFAULT 'launch_pass',
  notified_at timestamp,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS launch_waitlist_email_unique ON launch_waitlist (lower(email));
ALTER TABLE launch_waitlist ENABLE ROW LEVEL SECURITY;

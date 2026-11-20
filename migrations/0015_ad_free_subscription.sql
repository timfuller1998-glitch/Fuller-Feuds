-- 0015: ad-free switch + subscription placeholders (Fuller Feuds Dev, Nov 20 2026). Additive, safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_free boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier varchar(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp;

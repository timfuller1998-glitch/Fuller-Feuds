-- Additive user preference for political-compass colours (standard | american).
-- Default is standard (traditional compass: auth-liberal red, auth-conservative blue).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS compass_color_scheme varchar(20) DEFAULT 'standard';

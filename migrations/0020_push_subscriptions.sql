-- Web Push (Fuller Feuds Dev, Nov 27 2026). Additive only. The table already exists on live; this makes it
-- reproducible and adds an endpoint index (a device endpoint belongs to one signed-in user at a time).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_push_subscription ON push_subscriptions (user_id, endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

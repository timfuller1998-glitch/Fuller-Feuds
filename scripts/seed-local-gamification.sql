-- LOCAL DEMO DATA ONLY: never run against production/Supabase.
-- Seeds users, opinions, likes, follows and a debate so badges and leaderboards have data.
-- Requires migration 0008 (users.handle NOT NULL).
-- Idempotent: demo rows use fixed ids / ON CONFLICT DO NOTHING.
BEGIN;

INSERT INTO users (id, email, handle, first_name, last_name, bio, role, status, onboarding_complete, onboarding_step) VALUES
  ('u-erin',  'erin@local.test',  'ErinP', 'Erin',  'Park',    'Policy nerd',      'user','active',true,3),
  ('u-frank', 'frank@local.test', 'FrankO', 'Frank', 'Ortiz',   'Devil''s advocate','user','active',true,3),
  ('u-grace', 'grace@local.test', 'GraceL', 'Grace', 'Lee',     'Data first',       'user','active',true,3),
  ('u-hank',  'hank@local.test',  'HankM', 'Hank',  'Miller',  NULL,               'user','active',true,3),
  ('u-ivy',   'ivy@local.test',   'IvyC', 'Ivy',   'Chen',    'Here to learn',    'user','active',true,3),
  ('u-jack',  'jack@local.test',  'JackB', 'Jack',  'Brown',   NULL,               'user','active',true,3)
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_profiles (user_id) SELECT id FROM users WHERE id IN ('u-erin','u-frank','u-grace','u-hank','u-ivy','u-jack')
ON CONFLICT DO NOTHING;

-- Alice: an opinion on every topic she hasn't covered (=> 10+ opinions: First Opinion + Opinionated)
INSERT INTO opinions (topic_id, user_id, content, stance, debate_status, status)
SELECT t.id, 'u-alice', 'My take on "' || t.title || '": the evidence points one way, and I lean ' ||
       (CASE WHEN row_number() OVER (ORDER BY t.id) % 3 = 0 THEN 'against it.' ELSE 'in favor.' END),
       CASE WHEN row_number() OVER (ORDER BY t.id) % 3 = 0 THEN 'against' ELSE 'for' END, 'open', 'approved'
FROM topics t WHERE NOT EXISTS (SELECT 1 FROM opinions o WHERE o.topic_id = t.id AND o.user_id = 'u-alice');

-- Erin and Grace: a few opinions each
INSERT INTO opinions (topic_id, user_id, content, stance, debate_status, status)
SELECT t.id, u.id, (SELECT coalesce(nullif(trim(p.display_first_name), ''), us.first_name) FROM users us LEFT JOIN user_profiles p ON p.user_id = us.id WHERE us.id = u.id) || ' thinks: ' || t.title || ' deserves a nuanced answer.',
       (ARRAY['for','against','neutral'])[1 + (abs(hashtext(u.id || t.id::text)) % 3)], 'open', 'approved'
FROM topics t CROSS JOIN (VALUES ('u-erin'),('u-grace'),('u-frank')) u(id)
WHERE abs(hashtext(u.id || t.id::text)) % 2 = 0
  AND NOT EXISTS (SELECT 1 FROM opinions o WHERE o.topic_id = t.id AND o.user_id = u.id);

-- Likes: every demo user likes Alice's opinions; Bob's and Erin's get some.
INSERT INTO opinion_votes (opinion_id, user_id, vote_type)
SELECT o.id, v.id, 'like' FROM opinions o
CROSS JOIN (VALUES ('u-erin'),('u-frank'),('u-grace'),('u-hank'),('u-ivy'),('u-jack'),('u-carol'),('u-dave')) v(id)
WHERE o.user_id <> v.id AND (
  o.user_id = 'u-alice'
  OR (o.user_id IN ('u-bob','u-erin') AND abs(hashtext(o.id::text || v.id)) % 2 = 0)
  OR (abs(hashtext(o.id::text || v.id)) % 5 = 0))
ON CONFLICT DO NOTHING;

-- Follows: Bob is the most-followed; Alice gets a few.
INSERT INTO user_follows (follower_id, following_id)
SELECT f, 'u-bob' FROM unnest(ARRAY['u-erin','u-frank','u-grace','u-hank','u-ivy','u-jack','u-carol','u-dave']) f
UNION ALL SELECT f, 'u-alice' FROM unnest(ARRAY['u-erin','u-grace','u-ivy','u-bob']) f
UNION ALL SELECT f, 'u-erin' FROM unnest(ARRAY['u-frank','u-hank']) f
ON CONFLICT DO NOTHING;

-- A finished debate between Alice and Bob (First Debate for both) with clean messages.
INSERT INTO debate_rooms (id, topic_id, participant1_id, participant2_id, status, phase)
VALUES ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'u-alice', 'u-bob', 'ended', 'structured')
ON CONFLICT (id) DO NOTHING;
INSERT INTO debate_messages (id, room_id, user_id, content) VALUES
  ('dddddddd-0000-0000-0000-0000000000a1','dddddddd-0000-0000-0000-000000000001','u-alice','Remote work widens the hiring pool.'),
  ('dddddddd-0000-0000-0000-0000000000a2','dddddddd-0000-0000-0000-000000000001','u-bob','But juniors lose day-to-day mentoring.'),
  ('dddddddd-0000-0000-0000-0000000000a3','dddddddd-0000-0000-0000-000000000001','u-alice','Structured pairing time can replace hallway learning.')
ON CONFLICT (id) DO NOTHING;

-- Keep denormalized counters in sync (same as migration 0006 backfill / recomputeFollowCounts).
UPDATE opinions o SET
  likes_count = (SELECT COUNT(*) FROM opinion_votes v WHERE v.opinion_id = o.id AND v.vote_type = 'like'),
  dislikes_count = (SELECT COUNT(*) FROM opinion_votes v WHERE v.opinion_id = o.id AND v.vote_type = 'dislike');
UPDATE user_profiles p SET
  follower_count = (SELECT COUNT(*) FROM user_follows f WHERE f.following_id = p.user_id),
  following_count = (SELECT COUNT(*) FROM user_follows f WHERE f.follower_id = p.user_id);
COMMIT;

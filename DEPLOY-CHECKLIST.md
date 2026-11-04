# Deploy checklist (production)

Pending steps to do **before** deploying `main` to production. Tick off and date each item when it's applied to prod.
The dev bot only ever touches the local DB; production Supabase migrations are run by Timothy.

## Database migrations not yet applied to production (run in order)
- [ ] `migrations/0006_opinion_stance_and_vote_counts.sql`: `opinions.stance` + vote-count columns (needed since the stance/deck work).
- [ ] `migrations/0007_community_badges.sql`: community badge rows + `idx_opinion_votes_opinion_type` (local only so far; confirm on prod).
- [ ] `migrations/0008_user_handles.sql`: **required before deploying the @handles PR.** Adds `users.handle`, backfills every
      existing user (screen name or first name + last initial, with a number appended if taken/reserved), then sets NOT NULL,
      a unique index on `lower(handle)` and a format CHECK. Without it, sign-up and every name query fail (`column "handle" does not exist`).
      Safe to re-run. Tip: run it in a transaction and spot-check `select handle, count(*) from users group by 1 having count(*) > 1` (should be empty).

All three files are idempotent (`IF NOT EXISTS` / duplicate guards).

## 2026-11-21 (19:17 CST, America/Chicago) — Explore Topics Map pills no longer overlap (branch fix/topics-map-spacing)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy asked to make sure the pills on the Explore Topics Map don't overcrowd each other.
- Category and topic pills now get an angular slice proportional to how many topics hang off them, so a busy group like Politics or Other gets more room than a small one like Climate.
- Ring radius is computed from the measured pill size (including the count under a category) so neighbors on the same ring fit with padding. If a parent still has too many children for one arc, extra children move to a farther compact ring instead of stacking.
- A layout-time collision pass then nudges any remaining overlaps apart. This never runs per frame, so camera pan/zoom stays a single SVG transform.
- Labels that would still collide at the current zoom are hidden or abbreviated, and only when lod, focus, or the tree changes. Deeper labels are hidden outright when zoomed out, not faded, so text never stacks. The focused branch stays visible.
- Tapping a category still centers it and tries to fit its branches; if fitting every child would shrink the focused pill until it is hard to read, the camera zooms in anyway so the pill stays readable (outer branches may sit just off-screen and can be panned to).
- Typecheck: 50 (ceiling 52). Unit tests cover the live topic tree and a 420-topic synthetic tree, both with no overlapping pills.
- Left for later: on a narrow phone, a dense category like Politics can push a few child pills just off the right edge when focused; pan still reaches them. Secondary "also in" copies of a topic can sit farther out than the primary one.

## 2026-11-20 (19:11 CST, America/Chicago) — Explore Topics Map camera focuses without re-rooting (branch fix/topics-map-camera)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy rated the first map about a 3/10 and asked to fix zooming first: tapping a category was opening it as its own map, but it should just center that pill at a zoom that shows its connecting branches.
- The map is now one persistent radial tree in a single world space. Tapping a category, using the breadcrumb or back-to-parent control, or choosing a search result animates only the camera (translate + scale) to center that pill and fit its child branches and connecting lines. The rest of the tree stays in place around it.
- Pinch, wheel, and pan use the same camera, including after an animated focus. Starting a gesture cancels the in-flight animation so the view does not jump. Wheel and pinch still zoom around the cursor or pinch midpoint. Level-of-detail labels follow the camera zoom, and the focused branch stays readable even when deeper labels are still faded.
- Typecheck: 50 (ceiling 52). Playwright confirmed a category tap does not re-layout the tree, child branches stay visible, back-to-parent and search animate the camera, and wheel zoom continues smoothly after a tap.
- Left for later: sub-category labels in a tight wedge still overlap (especially under Politics), nearby unfocused labels can sit under a focused cluster, and some topic pills overlap their parent.

## 2026-11-20 (19:00 CST, America/Chicago) — Explore Topics Map replaces Browse All (branch feat/explore-topics-map)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy asked for a full-screen, zoomable radial map of every topic, replacing the Browse Categories page, so discovery stays spatial and hierarchical while reading and debating stay as they are.
- New Explore Topics map at `/categories` (sidebar label is now "Explore Topics"). Major category pills sit around a center hub; tapping a pill animates that category to the center with its sub-categories around it. Pinch, scroll-wheel zoom, and drag-pan work at any time (on this page, drag pans the map instead of scrolling — an intended exception to the swipe-scroll rule). Deeper, more niche topics fade in as you zoom.
- Tapping a topic leaf opens the existing topic page. The browser back button returns to the map at the same focus. Breadcrumb and a back-to-parent control step up one level. Search focuses the map on a match and highlights its path.
- Old `/category/:name` URLs redirect to the map focused on that category. Category links in the sidebar, topic cards, search, and topic pages go to the map. Home piles, topic pages, and debates are unchanged. Ad cards are unchanged.
- Hierarchy lives in `shared/topicTaxonomy.ts` (no database change). Existing category tags are grouped into majors (Politics, Economics, Science, Climate, Technology, Social Policy, Health, Education, Culture, Ideas); keyword rules place topics into sub-categories. A topic can appear under more than one parent, with an "also in" link. Unmapped tags fall under Other. Timothy can edit that file to retune groups, keywords, and accents.
- Public `GET /api/topics/map` works signed-out. A `?synthetic=1` tree (hundreds of fake topics) is available only in development for scale testing, and is not written to the database.
- Typecheck: 50 (ceiling 52). Playwright covered tap-to-focus, wheel zoom, pan, breadcrumb, search, leaf open, redirect, mobile and desktop, and a 420+ node synthetic tree.

## 2026-11-20 (18:27 CST, America/Chicago) — Topic cards get a split Open / Add opinion bar (branch ui/topic-card-action-bar)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy wanted the topic card cleaned up: the back had a big red "Open full page" button that the front lacked, and the bottom-right + / flag / view-full controls felt cluttered. He asked to replace that bottom bar with the same red button, split with a button for adding an opinion, and on the back to keep only the stats sitting above the red bar.
- Front and back now share the same full-width split red bar: "Open full page" goes to the topic page; "Add your opinion" opens the existing composer (and the sign-in prompt for visitors). Both halves are buttons, so a tap acts and does not flip the card. A tap on the rest of the card still flips it. Vertical swipe still scrolls.
- The small + / flag / arrow control row is gone. Flagging a topic stays on the full topic page (the Flag button was already there).
- The back keeps the "X opinions / Y participants / Top: Z likes" row above the bar, and no longer repeats the old control row under it.
- Applies everywhere TopicCard is used (home piles, profile Topics, search, and so on). Ad cards are unchanged. Opinion cards use a different component and were left alone.
- Typecheck: 50 (ceiling 52).

## 2026-11-20 (18:05 CST, America/Chicago) — Smoother card swipes and faster home load (branch perf/swipe-and-load)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy loved the left-side back swipe (PR #61) but said the cards looked like 10fps instead of a smooth 60+, and that the site loaded slowly. Motion path is unchanged (forward tuck, back swipe around the left, flip-reset, landing stability).
- **Swipe smoothness:** Deeper/moving cards no longer use CSS `filter: brightness/saturate` (that re-rasterized a new bitmap every frame). They use a cheap static-color overlay instead, which fades out as a card becomes the top card. Political glow `box-shadow` and `backdrop-filter` blur are flattened while a card is dragging or playing the out/in animation. `will-change: transform` is set only while a card is moving. Drag tracking sets a DOM attribute (no React setState on pointermove). Off-screen home piles are not mounted until they are near the viewport, so only the first two sections render at first.
- **Home load:** Routes other than Home are code-split (`React.lazy`) and vendor libraries are split into react/query/radix/motion chunks. Avatar badges no longer `import *` the entire lucide-react icon set (a small map of the known badge/tier icons is used instead). The app shell paints as soon as JS runs instead of waiting on `/api/auth/user`. Home no longer fetches `/api/topics` and `/api/opinions/recent` just to choose section titles; the public sections render immediately and each deck loads its own feed. Google Fonts are trimmed to the weights actually used (`font-display: swap`). The launch logo is the existing 192px file (47KB) instead of the 512px 232KB file. AdSense keeps the verification snippet but is preconnected, `fetchpriority=low`, and injected at the end of `<body>`.
- **Typecheck:** 50 (ceiling 52).
- **Motion check:** Playwright confirmed a back swipe still travels left (never right) and returns the previous card to the top, front-side-up.

## 2026-11-20 (16:55 CST, America/Chicago) — Back swipe comes around the left (branch fix/back-swipe-from-left)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy and his brother found it strange that a back swipe brought the previous card in from the right. He asked for the back swipe to look like the reverse of a card going to the bottom of the pile: even though you swipe right, the card should come around the left side.
- Forward swipe is unchanged: the top card slides out to the left, drops behind the pile, and tucks back under from the left.
- Back swipe is now that motion in reverse. The previous card (front side up) slides out from under the pile to the left, then comes over the top and settles in the center. A rightward finger swipe, the ‹ button, and the left arrow all use this path.
- Phone pile-nudge during a back swipe now shifts right, clearing the left side, instead of left.
- PR #54 landing stability is unchanged (no replayed settle, no jitter). PR #60 flip-reset is unchanged (a flipped card leaves as-is and snaps back to the front once hidden). Touch rule unchanged.

## 2026-11-20 (15:40 CST, America/Chicago) — Flipped cards swipe away as-is (branch fix/flipped-card-swipe)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy: when a card's back was showing and you swiped it, the card first returned to the center and flipped to the front before going to the back of the pile. He wanted it to go straight to the back in one motion, and come around front-side-up next time, without remembering the flipped state.
- A flipped card now swipes (or tucks, or is covered by a back-swipe) with its back still showing. The old 600ms "unflip, wait, then move" step is gone, so the card no longer springs back to the center to flip first.
- Once the card is off-screen (forward swipe, after it has slid out) or covered by the incoming card (back swipe), the flip is reset instantly with no animation. When that card comes around again, it is front side up.
- Applies to every CardDeck pile: home topics, profile Topics, Recent Opinions, topic AI-summary and opinion decks, counterpoints, and ad cards (both deck-owned FlipFaces and self-flipping TopicCard / AdCardSelfFlip).
- Back-swipe landing from PR #54 is unchanged (no replayed settle, no jitter). Touch rule unchanged: vertical swipe scrolls, tap flips, only buttons/links navigate.

## 2026-11-20 (15:20 CST, America/Chicago) — Opinion structure guide and strength meter (branch feat/opinion-structure)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy asked for a light guide so people don't just post "yes", then chose a single freeform box with a client-side strength meter ("even if it can be fooled it doesn't actually effect anything since the opinion score comes from other users").
- In every opinion composer (topic Share/Update dialog, topic-card dialog, create-topic page, search-bar create form, adopt-opinion dialog, and onboarding topic cards) the freeform box stays one field. A compact, collapsible "What to include" guide sits under it: stance, main reason, support, the other side, and an optional "what would change your mind," using the topic question when we have it.
- A live strength meter (Bare / Basic / Solid / Strong) and chips light up as they type, from strong text signals only: length, stance words, reason words, support (links, numbers, examples, studies, experience), the other side, and openness. No API or OpenAI calls; nothing is stored or scored from the meter.
- One-word or very bare posts (like just "yes") get a gentle "Add your reason?" tip before submit, with Keep writing or Post anyway. Posting is never blocked.
- Logic lives in `shared/opinionStrength.ts` with 15 unit tests (`npm run test:shared`). Typecheck stays at 50 (ceiling 52).

## 2026-11-20 (15:00 CST, America/Chicago) — Home sections open on different cards (branch fix/home-section-first-cards)
By Fuller Feuds Dev. Follow-up to the endless home decks: on the live site the sections load at the same moment, so several opened on the same topic. Each section now claims its first card as soon as it picks it, and later sections skip claimed ones.

## 2026-11-20 (15:10 CST, America/Chicago) — Endless home decks (branch feat/infinite-home-decks)
Made by the Fuller Feuds Dev bot (Grok Bot). Timothy: "the cards only ever stack to 5 … make the stacks infinite … not numbered … a basic algorithm to show the most relevant posts with minimal repeating."
- Home sections (Trending, Hot Debates, New This Week, Most Debated, Diverse Perspectives, My Topics, My Current Debates) are endless: no 5-card cap, no "n / m" counter and no count in the section header. New `POST /api/feed/home` returns the next 10 cards for a section (cursor = topic ids already dealt this cycle); the deck asks for more when about 3 real cards are left.
- Ranking (`server/lib/homeFeed.ts`): engagement (opinions ×3, people ×2, opinion likes, debates ×5, views ×0.2) with time decay per section — Trending favours the last week and decays over ~3 days of quiet; Hot Debates is most recent activity (opinions, counterpoints, debates); New This Week is newest first; Most Debated is opinions + debates; Diverse Perspectives favours topics with people on both sides. Signed-in users get ×1.5 on topics in their followed categories. Topics seen in the last 12 h (this browser) or opened in the last day (signed in) are pushed back in the first pass.
- Minimal repeating: no topic repeats until every topic in that section has been dealt; then a new reshuffled pass starts (score-weighted shuffle, so strong topics still come earlier), never the same card twice in a row, and a section's first card avoids topics already on top of other sections. A section with one topic shows it once.
- Back swipes walk through what you've seen (no wrap past the first card; ‹ is disabled there). Ad cards still come after every 5 real cards and show "Sponsored" under the deck; nothing else is numbered.
- Unchanged: the Trending page (ranked list with 1, 2, 3 badges), home search results, topic opinion decks, counterpoints and profile decks keep their counters.
- Tests: local, 40 swipes in Trending (32 topics): no repeats until all 32 were shown, no back-to-back repeats, ads after every 5 real cards, 6 back swipes matched history, drag forward/back works, the 4 other sections opened on 4 different topics. Screenshots + clip: /workspace/ff-videos/nov20/infinite-home/.

## 2026-11-20 (14:15 CST, America/Chicago) — Founder launch passes, remove data seeding, account cleanup, starter topics (branch feat/founder-launch-passes)
Made by the Fuller Feuds Dev bot (Grok Bot), approved by Timothy ("Invite codes go to users that will be able to join on initial public release with free premium for 1 year"; "Remove the feature to create fake accounts and opinions"; delete @TIMOTHYF and @EmilyF; publish the starter topics).
- Launch passes: founders' 3 codes are now launch passes. While public launch is off they can't open an account (`/api/register` → 403 `PASS_LOCKED`, "This pass unlocks at public launch"); the sign-up form says so and offers a waitlist (email stored in new `launch_waitlist`, linked to the pass). Once the admin "Public launch" switch is on, a pass signs the person up with `subscription_tier='premium_gift'`, `subscription_expires_at` = sign-up + 12 months and ads off (via `isSupporter`), records the inviter, and does not make them a numbered founder or give them codes. Admin acceptance/direct codes work as before.
- Settings: founders see "Your launch passes" with copy-pass-link buttons and the explanation; pass members see "Premium from your launch pass, until <date>". Admin Founders tab: passes labelled "Launch pass from Founder #n", a Launch waitlist list, and updated Public launch switch text. Acceptance message, Privacy text updated.
- Migration `0017_launch_passes.sql` (additive): `launch_waitlist`.
- Removed the admin Data Seeding tab, `/api/admin/seeding/*` (Reddit import + AI opinion generator that created synthetic users/opinions), `server/services/scrapingService.ts` and `scripts/seed-local-gamification.sql`. The `is_synthetic` column and `seeding_jobs` table stay (no destructive migration).
- Sign-in/sign-up email lookup is now case-insensitive.
- Production data (approved): @TIMOTHYF's 11 topics, 1 opinion, 1 counterpoint, 6 feedback reports, 12 admin actions, 12 seeding-job records, 11 topic interactions and 1 badge moved to @timf (3 duplicate badges and 3 duplicate topic interactions dropped; no opinion conflicts), then @TIMOTHYF deleted. @EmilyF deleted with her 1 counterpoint, 1 like and 1 topic interaction. Backups on the bot box: /workspace/ff-backups/timothyf-2026-11-20/ and /workspace/ff-backups/emilyf-2026-11-20/. Only @timf remains.
- Published the 20 starter topics from `docs/STARTER_TOPICS.md` as @timf (no opinions).
- Tests: local end to end (pass refused before launch + waitlist; accepted after launch with premium to 2027-11-20, ads off, inviter recorded, no founder number/codes; founders still see ads before launch; seeding tab/API gone). Screenshots: /workspace/ff-videos/nov20/founders-passes/.

## 2026-11-20 (14:00 CST, America/Chicago) — Founding members: invite-only sign-up, /apply, admin Founders tab (branch feat/founding-members)
Made by the Fuller Feuds Dev bot (Grok Bot), approved by Timothy (recruiting plan decisions 1–9).
- Migration `0016_founding_members.sql` (additive): `site_settings` (founding_mode on, public_launch off), `founder_applications`, `invite_codes`, `founder_posts`, `users` columns (invited_by_user_id, invite_code_id, signup_ref, age_confirmed_at, founder_number, founder_lifetime_ad_free), `debate_rooms.is_showcase`, and the `founding_member` badge.
- Founding mode: `/api/register` needs a single-use invite code while the admin switch is on, records who invited whom and the `?ref=` source, requires an 18+ confirmation, and is rate-limited (20 attempts / 5 accounts per hour per IP, Cloudflare client IP). Existing accounts sign in as before.
- Founders: a code used during founding mode makes the account a numbered founder (#1–#100) with the Founding Member badge, the lifetime ad-free perk stored (only active after the admin "Public launch" switch; ads keep showing until then), and 3 invite codes of their own when admitted by an admin (application or direct code).
- `/apply` public page (linked from sign-in, sign-up and the signed-out sidebar): plan questions, steelman prompt, optional politics/religion questions with a balance note, 18+ and pledge, honeypot, 3/hour limit, duplicate-email check. `?ref=` tags are remembered for 30 days.
- Admin "Founders" tab: switches, every application with rubric-suggested scores (optional OpenAI second opinion that fails quietly with no credits), best picks highlighted in gold, red flags, viewpoint mix tally, final score/note, Accept / Waitlist / Decline. Accept creates the code and shows a ready-to-copy subject + body to send by hand. Direct invite codes for Timothy's own network, code list with revoke, and a Saturday showcase switch that pins a debate to the top of /live.
- Founders' Room at `/founders`: small board only founders and admins can read or post in. Settings shows a Founding Member card with invite codes; the profile shows "Founding Member #n".
- Terms/Privacy: accounts are 18+, and a section on applications and invite data.
- Production data (approved): backed up then deleted the 111 seeded accounts, their 110 opinions, 2 counterpoints on those opinions, 1 counterpoint like, 22 badges, 98 profiles, 100 topic interactions and 9 vote-count fallback summaries that cited them. Backup: /workspace/ff-backups/seeded-users-2026-11-20/ on the bot box. Remaining users: @timf, @TIMOTHYF (admins), @EmilyF.
- Draft starter topics for approval: `docs/STARTER_TOPICS.md` (not published).
- Tests: local end to end (apply → scores → accept → code → sign up → Founder #1 + badge + 3 codes; no code / bad code / reused code refused; public launch turns on founder ad-free). Screenshots: /workspace/ff-videos/nov20/founders/.

## 2026-11-20 (12:40 CST) — Fix the back-swipe landing jitter

- **By:** Fuller Feuds Dev
- **Branch:** `fix/back-swipe-jitter`
- **Bug (Timothy):** "When swiping back, the cards jitter slightly when they arrive at the top."
- **Cause:** When the pulled-out card finished landing on top, its role changed from "in" to "top" and the deck re-ran the forward-arrival settle meant for button/key forward moves. That snapped the just-landed card about 70–90 px to the right and slid it back (measured on the live site at 390 and 1280). Two smaller instant changes also happened on landing: in dark/medium the card's back-of-deck brightness filter switched off, and the shadow switched from the pile shadow to the top-card shadow. Introduced Nov 12 (`7cc1406`), not by the ad cards.
- **Fix (`CardDeck.tsx`, `index.css`):** A card that just landed from a back swipe stays exactly where it landed. The incoming card uses top-card styling (shadow, no brightness filter, fading in over 0.3 s while it flies in), so nothing changes at the moment it lands. Forward swipes are unchanged.
- **Checked:** Frame-by-frame position traces before and after at 390 (touch) and 1280, landing on an ad card and on a topic card. After the fix the card rests at its landing spot with no further movement, filter or shadow change. The Sponsored counter switch doesn't move the card.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (12:00 CST) — AdSense-ready: ad cards in decks, ads.txt, Privacy & Terms

- **By:** Fuller Feuds Dev
- **Branch:** `feat/adsense-ready`
- **Ad cards:** Every card deck (Home sections, Trending, Categories, Search, Recent Opinions, topic opinions, counterpoints, profile) now gets one **Sponsored** ad card after every 5 real cards, in decks with 5+ cards. Same size as the deck's cards, dashed gold frame, "Sponsored" / "Advertisement" labels. A tap flips it (back: "Hide ads with a supporter subscription" + Ad settings button); nothing navigates. Swipe forward/back animations are unchanged. The counter skips ad cards (shows "Sponsored"), and pages' `onIndexChange`/`initialIndex` see only real cards. No banners between sections; nothing in debate rooms, Settings, admin, onboarding or auth. The topic AI-summary deck opts out. Ad-free users never get ad cards.
- **AdSense:** With `VITE_ADSENSE_CLIENT` set at build time, every page's `<head>` has the `google-adsense-account` meta and the async `adsbygoogle.js?client=ca-pub-…` script. Ad cards render a real `<ins class="adsbygoogle">` unit once `VITE_ADSENSE_SLOT_FEED` is also set; until then they show an "Ad space" placeholder.
- **ads.txt:** `/ads.txt` serves `google.com, pub-…, DIRECT, f08c47fec0942fa0` from `ADSENSE_PUBLISHER_ID`; 404 when unset.
- **Legal:** New `/privacy` (accounts, data, cookies, Google AdSense and third-party ad cookies, opt-out links) and `/terms` pages, linked from the sidebar, Settings and the Home hero footer. Contact goes through the in-app feedback form.
- **Docs:** `docs/ADSENSE.md` lists the Render env vars, keeping Auto ads off, and turning on Google's EEA/UK consent message.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (11:20 CST) — Remove leftover debug instrumentation

- **By:** Fuller Feuds Dev
- **Branch:** `chore/remove-debug-instrumentation`
- **Agent-log calls:** Removed all 25 leftover `fetch('http://127.0.0.1:7242/ingest/...')` calls and their 24 `#region agent log` blocks: `server/db.ts` (7), `server/vite.ts` (6), `server/static-files.ts` (6, plus 6 `[DEBUG]` console lines printed on every start), `server/routes/topics.ts` (4, on every topic search), `server/auth.ts` (1), `scripts/copy-static.js` (1). None of these remain in the repo or the built bundle.
- **Leftover debug logs:** Removed 25 `console.log` lines and blocks.
  - **Server:** `[OpinionRepository]` dumps of every new opinion's full data (5), `[Onboarding Progress]` (2), raw and parsed OpenAI political-compass responses (2).
  - **Client:** Onboarding response/refetch dumps (7), `[Onboarding Redirect]` dev dump (1), WebSocket new-debate event chatter (3), "Theme toggled", "Logout clicked", "View cumulative details clicked", "Stack … is empty", and the sidebar's `onNavigate` console stub.
  - **Startup logs:** `server/db.ts` no longer prints the first 50 or 100 characters of the database URL (which could include the password) when fixing a prefix or failing to parse it. Masked host/port startup lines stay.
- **Kept:** Error logging, server startup logs, cache/AI-fallback notices, the opt-in `LOG_REQUESTS` request log, service worker and WebSocket connect/reconnect logs, and the placeholder handlers on the unused LiveStreamDebate component.
- **Behavior:** Unchanged. Smoke tested home, Recent Opinions, topic search (dropdown and page) and people search, with no page errors.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (11:30 CST) — Search for people

- **By:** Fuller Feuds Dev
- **Branch:** `feat/user-search`
- **What:** The header search dropdown has a **People** section (up to 5) under Topics, and the Search page has a **Topics / People** switch (it opens on People when only people match). Each person shows avatar, public display name, @handle, top badge (their avatar badge, else their highest-tier one) and follower count, and links to their profile. Enter now goes to the Search page when only people match.
- **API:** New `GET /api/users/search?q=&limit=` (2–50 chars, leading @ ignored, default 8, max 20). Matches the public display name or @handle, never the hidden real name when a display name is set. Active accounts only; returns no email, role, status or other private fields. LIKE wildcards are escaped. Rate-limited to 120/minute per signed-in user, or per client IP (`cf-connecting-ip`) when signed out.
- **Index:** None added. Production has 114 users, so a scan is instant; a trigram index can come later if the user base grows.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (11:05 CST) — Recent Opinions uses the stacked card deck

- **By:** Fuller Feuds Dev
- **Branch:** `feat/recent-opinions-deck`
- **What:** Each topic on Recent Opinions (`/recent-opinions`) now shows its opinions as the same stacked card pile used on the Topic and Profile opinion decks (`CardDeck`, maxWidth 420, `OpinionDeckFront`/`OpinionDeckBack`), replacing the sideways scroller. Tap flips to the back (votes, See counterpoints, Challenge to a debate, Like/Dislike, Adopt, Flag, Flag as AI-written); vertical swipes scroll the page; horizontal swipes and the arrows change cards; only buttons navigate. Up to 20 opinions per topic, with an "Open debate" / "See all N opinions" button under each deck. Flag now opens the existing flag dialog and really submits (it was a no-op before). The header wraps on phones.
- **Server:** `GET /api/opinions/recent` now includes the signed-in user's own vote (`userVote`, one batched query) so the card backs show it.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (10:45 CST) — Stacked milestone badges become one badge with levels; dark-theme badge colors

- **By:** Fuller Feuds Dev
- **Branch:** `feat/stacked-badges-dark`
- **Levels:** Milestone badges that measure the same thing at several thresholds now show as one badge with levels: Debates (4 levels: 1/10/50/100), Opinions Shared (4: 1/10/50/100), Topics Created (3: 1/10/25), Sound Reasoning (2), Opponent Ratings (2), Likes Received (2: 5/50), Followers (2: 1/10). Thresholds are unchanged. Each card shows the current level's name, "Level N of M", the count, progress to the next level, and level dots, matching the Skill tiers cards. Stack names are in `BADGE_STACKS` (`shared/badgeDefinitions.ts`).
- **No data changes:** `user_badges` and `users.selected_badge_id` are untouched. If someone's avatar shows a lower level of a stack (e.g. First Opinion), the avatar and profile now show the highest level they've earned in that stack (e.g. Opinionated). The same applies to XP skill tiers (Bronze → Silver once earned). "Show on avatar" on a stack picks its highest earned level.
- **Dark theme:** Badge cards, progress tracks/bars, level dots, pills and medals now use theme variables (`.level-card` in `index.css`) with lighter tier colors on dark and medium themes, instead of fixed paper colors.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (10:30 CST) — Ad-free switch in Settings + XP-tiered skill badges

- **By:** Fuller Feuds Dev
- **Branch:** `feat/ad-free-and-xp-badges`
- **Ad-free switch:** New **Ads** card in Settings with "Hide ads on my account." Saved in `users.ad_free` (migration `0015`, additive; also adds placeholder `subscription_tier` and `subscription_expires_at`). `PUT /api/users/me/ad-free` only accepts admins now, or anyone `isSupporter(user)` once subscriptions exist (nobody yet); everyone else sees the switch disabled with "Coming with supporter subscription." No payments or subscription flow. The site has no ad slots yet, so `useAdsEnabled()` and `<AdSlot>` are ready for the first ones. The ad fields are hidden from public profiles. Sponsored topics untouched.
- **XP skill tiers:** Six skills (Critical Thinking, Civility, Open Mind, Debating, Opinions, Topics) earn XP, computed live from existing activity (debate ratings, messages, fallacy flags, counterpoints, opinions, likes, topics), so past activity counts with no backfill and no new XP table. Tiers come from one config table in `shared/xpTiers.ts`: Bronze 200, Silver 1,000, Gold 5,000, Diamond 10,000, Platinum 20,000 (Platinum above Diamond). Each skill × tier is a badge (`skill_<skill>_<tier>`, synced on startup) and can be shown on the avatar. Profile → Badges has a new "Skill tiers" section (tier pill, XP, progress to the next tier, tier dots, "How to earn"). The milestone badges stay as before.
- **Backlog:** The "which badges get 2x debate credit" question is replaced by the tiers. Sponsored-topic handling is deferred until sponsored topics are built.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (10:07 CST) — Merge All Categories scroll fix with the debates overhaul

- **By:** Fuller Feuds Dev
- **Branch:** `fix/all-categories-scroll`
- **What:** Updated this branch with latest main after PR #47 (debates overhaul, live `38ddffb`). The only conflict was CHANGELOG-BOT.md; both entry sets were kept. Typecheck 50 (ceiling 52). Production build passed. Local re-check: All Categories still scrolls (a vertical swipe over a card and a desktop wheel both reach the bottom), cards are 358×501.2 at 390 and 400×560 at 1280, Topic and profile decks still render at the expected sizes, and the new Challenge to a debate button is visible on opinion card backs.
- **Typecheck:** 50.

## 2026-11-20 (09:45 CST) — Debates overhaul: Challenge button, invites that never expire, live viewing

- **By:** Fuller Feuds Dev
- **Branch:** `feat/debates-overhaul`
- **Starting debates:** Opinion cards (Topic and Profile decks) have a **Challenge to a debate** button on the card back. It's an explicit button, so swipes and taps on the card behave as before. The dialog picks your side and takes an optional opening argument; with an opening, the challenger goes first. You no longer need your own opinion on the topic (from the card or the counterpoint opponent picker): your stance comes from your opinion if you have one, otherwise from the side you pick. Stances are saved on the room (`participant1_stance` / `participant2_stance`, migration `0014`, additive) and shown in the room and on the Live page.
- **Invites:** Invites never expire. A pending invite stays open until it is accepted, declined, or cancelled, and the inviter's "Withdraw" is now **Cancel invite**. The hourly start limit (10/hour) is counted from `debate_rooms` in the database, so it survives deploys.
- **Live viewing:** Anyone, signed in or not, can watch a debate once the invite is accepted, unless a debater hides it ("Hide from spectators", which now works). Spectators get a read-only room that updates live over `/ws` (`watch_debate`): new messages, whose turn it is, a typing bubble, an "N watching" count, and the final ratings once both have rated. Pending, declined, and cancelled invites stay private. New `GET /api/debates/live` and `GET /api/debates/finished` power a rebuilt **Live Debates** page (`/live`) with Watch and Read links. `/debate-room/:id` is now a public route.
- **Room cleanup:** Removed the dead Switch-opponent dialog and the unused second socket (`useDebateRoom`). The fallacy flag now posts to `/api/debates/messages/:id/flag` and validates the type. Unknown flag types no longer crash the room. The chat area scrolls inside its card. The stale "Open the bell to reply" toast now points to the Debates bar. Deleted dead panels and pages: AllActiveDebatesPanel, ArchivedDebatesPanel, MessengerChat, LiveDebateRoom, DebateRoom, MyDebates, MyActiveDebates, DebateOnboardingModal. Footer dots, typing, and Archive are unchanged.
- **QA:** Local end-to-end with Alice, Bob, Carol, and an anonymous viewer: 40/40 checks passed. Screenshots are in `/workspace/ff-videos/nov20/debates/`.
- **Typecheck:** 50 (ceiling 52).

## 2026-11-20 (07:56 CST) — Don't let a growing deck parent shrink the card

- **By:** Fuller Feuds Dev
- **Branch:** `fix/all-categories-scroll`
- **What:** The first "growing parent is not a height cap" check still treated a wrapper as bounded when it was only slightly shorter than the uncapped card plus deck chrome. After a tab switch or a window-height cap, that parent was about as tall as the visible card, so the deck shrank, the parent shrank with it, and profile Topics cards could end up smaller than on main (and sometimes tiny). The parent is now a cap only when it is shorter than the card itself, which is the reserved home snap slot. Topic, Counterpoints, and profile decks keep their window- or column-based size; Home still fits the title, card, and chevron in that slot.
- **Typecheck:** 52.

## 2026-11-20 (07:40 CST) — Let All Categories scroll, and use the default card size

- **By:** Fuller Feuds Dev
- **Branch:** `fix/all-categories-scroll`
- **What:** The All Categories page wrapper used `overflow-x-hidden`, and each category section used `overflow-hidden`. Those compute as vertical scroll containers even though they are as tall as their content, so a vertical swipe starting on a card (or in a section) can get trapped and never reach the `main` scroller. Both now use `overflow-x-clip`, which hides sideways overflow without creating that trap. Category decks also drop the 320px width cap and use the site default of 400px. On a 390-wide screen they still shrink to fit the column; on desktop they stay 400px because this scrolling page does not apply the home viewport chrome reserve, and a parent that only grows with the card is no longer treated as a height cap. Vertical swipe over a card still scrolls the page, and a tap still flips the card.
- **Typecheck:** 52.
## 2026-11-20 (06:45 CST) — Fix the stuck middle card on later forward swipes

- **By:** Fuller Feuds Dev
- **Branch:** `fix/forward-swipe-stuck-card`
- **What:** After the first forward swipe, the new "next" card was mounted during the previous card's tuck-under and never subscribed to the forward-swipe lift, so it stayed frozen in the 2nd-slot pose. On every later forward swipe it sat wedged behind the departing card and popped away when the swipe finished. It now subscribes to lift once that tuck-under settles, so swipe 2 onward matches swipe 1: one departing card, the next card rising and shifting opposite it, and the proper back layers. Leftover tuck-under motion is also cleared when that card becomes the peek. Back-swipe behavior is unchanged.
- **Typecheck:** 52.

## 2026-11-19 (19:35 CST) — Fit home sections between the header and footer

- **By:** Fuller Feuds Dev
- **Branch:** `fix/home-section-fit`
- **What:** A snapped home section is now the height of the visible area between the header and the fixed footer (the app shell already uses dvh), instead of `100dvh` plus leftover main padding. The title, card pile, and down-chevron all stay on screen; you can no longer scroll a section just enough to tuck the title under the header. The deck sizes itself to that column and shrinks a little on short viewports so the controls still fit.
- **Typecheck:** 52.

## 2026-11-19 (19:22 CST) — Don't replace real AI summaries when OpenAI is out of credits

- **By:** Fuller Feuds Dev
- **Branch:** `fix/keep-summary-on-ai-failure`
- **What:** If summary generation falls back (OpenAI unconfigured, out of credits, or a request error), the service now keeps an existing real summary and only attaches sentence citations to that text. It no longer overwrites a good stored summary with the vote-count fallback. This also protects the 2:00 AM UTC daily refresh. The earlier one-time backfill already overwrote the 10 existing summaries because the OpenAI account had no credits; those need a credit top-up and a regenerate to restore quality.
- **Typecheck:** 52.

## 2026-11-19 (20:20 CST) — Start a debate from a YouTube, X, or article link

- **By:** Fuller Feuds Dev
- **Branch:** `feat/topic-source-links`
- **What:** Topics can have an optional source URL (`source_url`, migration `0013`). Create Topic and the search-bar create form have a source field and a "Draft from link" button: the server fetches public page title / og description, YouTube oEmbed, or X oEmbed, then uses OpenAI to draft a neutral title and description that the user can edit before publishing. Failed or private/login-walled fetches fail gracefully. The source link is shown on the topic page. Private/internal URLs are rejected.
- **Typecheck:** 52.

## 2026-11-19 (20:00 CST) — Let users flag opinions as likely AI-written

- **By:** Fuller Feuds Dev
- **Branch:** `feat/ai-opinion-flags`
- **What:** Added a "Flag as AI-written" button on the back of opinion cards (one flag per signed-in user per opinion, not on your own). Flags are stored in `opinion_ai_flags` (migration `0012_opinion_ai_flags.sql`). The admin Requests tab now lists flag counts. No automatic AI detector yet.
- **Typecheck:** 52.

## 2026-11-19 (19:45 CST) — Fix AI summaries, category suggestions, and leftover opinion scores

- **By:** Fuller Feuds Dev
- **Branch:** `fix/ai-summary-sentences`
- **What:** AI summaries now store `summary_sentences` with per-paragraph links to the opinions each card draws on, so the back of a summary card shows its own opinions instead of the same top three on every card. The daily refresh actually regenerates instead of skipping. After deploy, existing summaries missing those citations are regenerated once, and the 36 older opinions that had political scores but no taste/passion scores are filled in with the local lexicon scorer. "Suggest categories" on create-topic now calls `AIService.generateCategories` instead of always returning Politics / Society / General.
- **Typecheck:** 52.

## 2026-11-19 (19:30 CST) — Keep the tuck-under visible after the first forward swipe

- **By:** Fuller Feuds Dev
- **Branch:** `fix/card-tuck-animation`
- **What:** After the first forward swipe, the departing card dropped behind the blank middle backs, so you could not see it tucking under the pile. It now returns under the face cards but above those backs, then settles behind the deck. Leftover nudge and lift motion values are cleared when the swipe animation finishes. Back-swipe behavior is unchanged: the top card stays put while the bottom card is pulled out and laid on top.
- **Typecheck:** 52.

## 2026-11-19 (19:20 CST) — Remove duplicate category titles on the home page

- **By:** Fuller Feuds Dev
- **Branch:** `fix/home-section-titles`
- **What:** Each home stack no longer repeats the next section's title at the bottom. A small, quiet downward chevron hints that another section is below. Tightened the top header padding so the card has more room and the gaps feel smaller.
- **Typecheck:** 52.

## 2026-11-13 (16:00 CST) — Drop the profile page title and stack topics in a card deck

- **By:** Fuller Feuds Dev
- **Branch:** `fix/profile-drop-title-topics-deck`
- **What:** Removed the Home / Profile breadcrumb and Bold Arena "PROFILE" title strip (the site header stays). The Topics tab now uses the same SwipeableCardStack / TopicCard pile as the home page — default card sizing, tap to flip, swipe to the next card, vertical swipes still scroll the page — with the existing empty state if the user has no topics.
- **Typecheck:** 52.

## 2026-11-13 (15:50 CST) — Let the profile tab bar scroll on a phone

- **By:** Fuller Feuds Dev
- **Branch:** `fix/profile-tab-bar-scroll`
- **What:** On a 390px screen the last profile tabs were clipped mid-label (Following / Badges). Tabs now keep their full width and the bar scrolls horizontally instead of shrinking to fit.
- **Typecheck:** 52.

## 2026-11-13 (15:50 CST) — Restyle the user profile in the Editorial theme

- **By:** Fuller Feuds Dev
- **Branch:** `feat/profile-editorial-restyle`
- **What:** The profile page (own and other users) now follows the MatDash Users Profile layout, restyled in the current Editorial theme — paper `#f7f2e9`, serif titles, small-caps labels, red `#8c2121` accents and gold on a CSS/SVG cover banner (no stock image, no upload required). Centered avatar overlapping the banner, @handle, badges on the avatar, three real stat counters (Opinions, Followers, Following), and existing actions (Follow / Unfollow, Edit profile / Settings, rankings). Icon tabs switch between Profile, Opinions, Topics, Followers, Following, and Badges. Followers/Following use a searchable person-card grid with Follow/Followed. Wins/win rate, social network buttons, and “Add to Story” were left out because the app has no such data or features. Typecheck 52.
- **Typecheck:** 52.

## 2026-11-12 (06:30 CST) — Match the installed-app splash to the paper loading screen

- **By:** Fuller Feuds Dev
- **Branch:** `fix/pwa-splash-paper`
- **What:** The Android home-screen splash was still the old Editorial black (`background_color` / `theme_color` `#14110e`) with a white/grey rounded icon tile, so opening the app showed a dark splash (and the dark in-page launch) before the cream "Loading debates..." shell. Set the manifest, `<meta name="theme-color">`, and `html`/`body` first-paint background to the page paper color `#f7f2e9` (`--background`). Rebuilt 64/192/512 and maskable/apple-touch icons as the existing logo on that same paper (logo artwork unchanged) so Android does not draw a white tile. Color-matched the pre-React / auth launch screen to paper as well, otherwise a paper splash would still flash through a dark in-page loader. Name/short_name remain "Fuller Feuds". The native splash is baked into the WebAPK and will not change on a regular refresh — see the PR notes.
- **Typecheck:** 52 (CSS/HTML/JSON/PNG only).

## 2026-11-12 (06:05 CST) — Copy repo public/ assets into the production build

- **By:** Fuller Feuds Dev
- **Branch:** `fix/copy-public-assets-into-dist`
- **What:** Vite root is `client/`, so `public/manifest.json`, favicon, logo, and PWA icons were not copied into `dist/public`. After #31 stopped serving the source `public/` folder in production those files 404ed. Set `publicDir` to the repo-level `public/` folder so they land in the same build directory as `index.html`.
- **Typecheck:** 52 (unchanged; config-only change).

## 2026-11-12 (06:05 CST, America/Chicago) — Phones no longer keep an old build after a deploy (branch fix/stale-pwa-and-cache-headers)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **The phone was being served a cached copy of the site, and sometimes an unversioned service worker, so a new Render deploy did not show up right away.** Production was mounting the source `public/` folder *before* the built files, so `/service-worker.js` was the template with `{{CACHE_VERSION}}` still in it — the same bytes on every deploy. The browser never saw a new worker, and that worker used stale-while-revalidate for the app shell (`/` and `index.html`), so it handed back the previous page immediately and only fetched a fresh one in the background. `/index.html` was also getting a one-year `Cache-Control` from Express. The server looked through several folders (`dist/public`, `server/static`, even source `public/` and `dist/`) to decide what to serve.
- The built, versioned service worker (now tagged with the git SHA) is the one that is served, with `Cache-Control: no-store`. It network-fetches HTML and the manifest, caches only fingerprinted `/assets` files, takes control immediately, and deletes older caches — including the leftover `{{CACHE_VERSION}}` cache on phones that already have the app installed. `index.html`, `manifest.json`, and `/api/version` are `no-store`; hashed assets stay `immutable` for a year. The server only serves `dist/public`. A failed lazy chunk load reloads the tab once. You can confirm the build at `/api/version` or at the bottom of Settings (`App version` plus the short SHA). Typecheck 52.

## 2026-11-12 (05:48 CST, America/Chicago) — Card text that already overflows now keeps scrolling the page (branch fix/card-scroll-chain-touch)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **A vertical swipe on a slightly overflowing opinion body still stopped at the end of the card.** PR #29 chained further movement to the page from pointer events, but a real finger (and Playwright's touch events) never fired those, and the browser would not hand the rest of the swipe from the in-card scroller to `main`. A non-passive `touchmove` listener now moves the page once the card body is at either end, so a swipe on the live UBI opinion at 390px — which has a few pixels of in-card overflow — keeps going down the topic page. Typecheck 52.

## 2026-11-12 (05:43 CST, America/Chicago) — Touch scroll over cards, and taps flip instead of opening (branch fix/touch-scroll-and-tap-flip)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Vertical swipes starting on a card's text often did nothing.** The site does not scroll the window — it scrolls `main` (or a home-page overflow pane). Opinion, summary, and counterpoint cards put their body in an `overflow-y-auto` area with `overscroll-contain`, so a finger on the text scrolled a few pixels inside the card (or nowhere, if the text already fit) and never moved the page. You could scroll from the author row, the header, or the gap beside the card, but not from the words. Those in-card areas now only become a scroller when the text actually overflows, and at either end they chain the rest of the swipe to the page, so you can reach the ‹ › controls and the rest of the topic page. A scroll or horizontal deck swipe is no longer treated as a tap, so it will not flip the card when you lift your finger.
- **Tapping card body text should flip the card, not open an opinion or counterpoints.** On the back of an AI Summary card, the whole referenced-opinion row (including the excerpt) was a link, so a tap on the quoted text jumped to that opinion instead of flipping the card back. Only the author's name/avatar is a link now; "See counterpoints (N) →" is still a link; tapping the excerpt or empty card area flips. On Your Opinion, tapping a paragraph opened the counterpoints sheet — only the counterpoints badge does that now, same as Other Opinions (the "See counterpoints" button on the flipped card still opens the page). Explicit buttons and links (author, ¶ chips, Challenge, heart, Open debate) still work. Typecheck 52.

## 2026-11-12 (05:20 CST, America/Chicago) — Summary and counterpoint cards match the topic pile size and type (branch fix/summary-counterpoint-card-sizing)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Summary and counterpoint cards were about half the size of the topic cards, so the same body type looked huge — only a couple of words fit on a line.** To keep those decks squeezed above the site footer, the pages passed a large `chromeReserve` (580px on the summary pile, 480–500px on counterpoints) into `CardDeck`. Topic / Other Opinions cards use the default 290px reserve, so they stay full phone width (~356×498 at 390px). The extra reserve shrank the 5:7 card to as little as 189×264, and 16px serif on a card that narrow really does look twice as big. Those decks now use the same default reserve and `maxWidth={420}` as the topic pile, so all three cards are the same size. Body text is `text-base leading-relaxed` (16px / 26px), matching the opinion cards. Long paragraphs still scroll inside the card. On a phone you may need to scroll the page a little to see the ‹ › controls, the same way the Other Opinions pile already works. Typecheck 52.

## 2026-11-12 (03:48 CST, America/Chicago) — Summary paragraph cards + opponent picker on counterpoint backs (branch feat/summary-cards-opponent-picker)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **AI Summary is now a card pile of paragraphs.** Each summary paragraph is its own paper card (gold "AI Summary" kicker, "¶ 2 of 5", gold rule, serif body). Tap to flip and see the opinions that paragraph draws on — compact rows with avatar, name, @handle, stance, a short excerpt, and the "See counterpoints (N) →" link from PR #22. Tapping a row opens that opinion on the topic page. Paragraphs with no references get a quiet empty note; long text scrolls inside the card; topics with no summary still show the lined empty state. The pile reuses the existing `CardDeck` (same swipe / ‹ › behavior).
- **Counterpoint card backs are an opponent picker.** Flip a counterpoint to choose someone to debate *for* or *against* that reply. "Debate for" is the original opinion's side (the original author leads, then people with the same topic stance). "Debate against" is the counterpoint's side (the author who wrote it, people who liked it, then people with that author's topic stance). You are left out of both lists. If the two sides share a stance (or have none), only those structural roles are used so nobody is listed twice. Tap a person, then Challenge — it uses the existing debate invite flow and the friendly cap messages from PR #21 (5 pending invites, 10 open debates, 10/hour). Signed-out visitors are prompted to sign in. Like stays on the back as a compact heart. Starting a debate from a counterpoint is no longer limited to the original opinion's author; anyone signed in can challenge someone in the discussion (you still need an opinion on the topic, and you cannot challenge yourself). Typecheck 52.

## 2026-11-12 (03:31 CST, America/Chicago) — Counterpoint cards + editorial polish on AI Summary and Your Opinion (branch feat/editorial-counterpoint-cards)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Counterpoints page is now a card pile.** `/opinion/:id/counterpoints` used to be a long scroll of outlined mini-cards under paragraph headings. Each counterpoint is now a paper card in the same language as Other Opinions (avatar, name, @handle, body, small-caps label). A compact context card at the top shows the original author, their stance, and the paragraph the current card is answering — it updates as you swipe. The page reuses the existing `CardDeck` (same left/› = next and back-swipe pull, no duplicated pile). Optional ¶ chips filter by paragraph (`All` is always there, and `?p=` opens on that paragraph); every counterpoint stays reachable. Like and Start a debate live on the back of the card; Add is in the header and opens a short form. If the author also has an opinion on the topic, their stance chip appears on the card (counterpoints themselves have no stance field).
- **AI Summary tab** dropped the generic boxed card and the extra "AI Summary" + brain icon that repeated the tab. It is now a paper article: gold small-caps kicker, thin gold rule, serif body. Paragraph references and counterpoint badges from PR #22 are unchanged, with a short hint under the text. The empty state is a lined editorial note instead of a lone sentence.
- **Your Opinion tab** is the same kind of opinion card (avatar, @handle, stance, body, counterpoint badges) with Update on the card, instead of a plain Card and an outline button. The empty state is a paper card with a "Your take" kicker and Share Your Opinion. Tapping a paragraph still opens the sheet; the badge still goes to the counterpoints page. Typecheck 52.

## 2026-11-12 (03:14 CST, America/Chicago) — Forward swipe: the rest of the pile slides right, out of the top card's way (branch fix/forward-swipe-opposite)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **The stack was sliding with the top card on a forward swipe.** PR #24 made the remaining pile move by a visible amount, but it followed the top card left. It now shifts the other way — right, about 78px, the same size as the back-swipe top nudge — so the deck looks like it is moving out of the departing card's way. The next card still rises and scales into the top spot, then the pile settles back to center when you let go. The › button and → key do the same. Back swipe is unchanged. Typecheck 52.

## 2026-11-12 (03:08 CST, America/Chicago) — Forward swipe now moves the rest of the deck by a visible amount (branch fix/forward-swipe-settle)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Forward swipe only seemed to move the top card.** The rest of the pile did animate during a left drag, but it only rose 7px and scaled up 3.5% (the distance from the 2nd slot to the top). On a phone that is almost invisible next to the top card sliding away. A back swipe already nudges the top card about 78px (22% of the card width) and shrinks it 5%.
- The remaining pile now takes that same left shift while the top card is dragged away, rises and scales into the top spot, and settles back to center when you let go. The blank back and the hidden previous card follow so they do not peek out. The › button and → key start the new top from that same offset and slide it into place. Typecheck 52.

## 2026-11-12 (00:10 CST, America/Chicago) — Card-pile swipe: no leftover cards on back swipe, deck settles on forward swipe (branch fix/card-pile-swipe)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Back swipe no longer uncovers cards deeper in the pile.** On phones, pulling the bottom card out nudged the top card left and shrank it, which left a gap. The 2nd card (and the blank back) stayed put, so they peeked out beside the incoming card. Those cards now follow the same nudge and stay tucked under the top card. Only the current top card, the incoming card, and the normal downward peek of the pile are visible. The ‹ button, ← key, and the wheel use the same pull, so they get the same motion.
- **Forward swipe now moves the rest of the deck.** While the top card is swiped left, the card behind it rises and scales into the top spot, and the blank back settles one layer forward — the same kind of slight motion the top card already got on a back swipe. After the swipe commits, a new 2nd card rises from the back of the pile into place. The › button and → key use the same settle.
- `prefers-reduced-motion` still skips the timed animations (durations go to 0). Typecheck 52.

## 2026-11-11 (23:26 CST, America/Chicago) — Counterpoints links and scrolling (branch fix/counterpoints-navigation)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Summary "N counterpoints" badge opens counterpoints, not opinions.** Clicking a summary paragraph still opens the referenced-opinions sheet, but the badge itself goes to `/opinion/:id/counterpoints` when the paragraph points at one opinion. When it points at several, a sheet titled "Counterpoints" lists those opinions with a "See counterpoints (N) →" link on each. Referenced-opinion cards also got that same link so they are no longer a dead end.
- **All counterpoints are reachable.** "See counterpoints" on a flipped Other Opinions card, and the per-paragraph badges on the card front and on Your Opinion, now open the full counterpoints page (same as profile), so every paragraph's counterpoints can be scrolled to. The leftover side sheet (from tapping Your Opinion text) was not scrollable — content taller than the screen was clipped (`overflow: visible`) — and now scrolls (`overflow-y-auto`).
- Local Playwright: summary badge from sentence 1 lands on Alice's counterpoints page; the two-opinion sentence opens a Counterpoints sheet with two links; Dave's 6 counterpoints across 3 paragraphs are all listed and reachable at 390px and 1280px. Typecheck 52.

## 2026-11-11 (22:05 CST, America/Chicago) — Debate overload plan (branch feat/debate-overload)
Made by the Fuller Feuds Dev bot (Grok Bot). Migration `0011_debate_invites.sql`.
- **Accept / decline invites.** New debates start as a *pending invite* (`debate_rooms.invite_status` = pending, `invitee_id`). The invited person can Accept or Decline from the Debates list, the room page banner, or the popup — or just reply, which accepts. The sender sees "Waiting for X to accept" with **Withdraw**. Declined/withdrawn invites close without ratings, go to Archive for both, and the sender gets a notification. Existing debates are marked accepted.
- **Caps** (server-side, friendly messages): max **5** invites waiting for an answer per sender (429); nobody can be in more than **10** open debates (pending + active, not counting rating/finished) — applies to both sender (409) and recipient ("They have a full plate", 409).
- **Rate limit:** max **10** new debates started per user per hour (429).
- **Same debate twice** (same two people, same topic, still open) reuses the existing room instead of creating a duplicate.
- **Priority sort:** footer avatars and the Debates list order new invites (green) → needs you (red: your turn, rate now, invite to answer) → the rest, newest first.
- **+N chip:** the footer shows as many avatars as fit (measured live) and collapses the rest into a "+N" chip that carries the most urgent dot (green/red) and opens the list.
- **One merged list:** the Debates button, the +N chip and the Archive button all open the same list, sectioned Needs you / Waiting on them / Archive (Archive jumps to its section). The separate Archive panel is no longer used from the footer.
- **No counts** (Timothy's footer prefs): removed the unread number on the Debates button (now a single green/red dot), the "(N)" on Archive, and the per-row "N new". Kept: green dot = new, red dot = needs you, "…" while the opponent types, finished debates → Archive.
- Local Playwright: 21/21 (`/workspace/ff-nov11-overload.cjs`) + API checks for the 5-pending cap (429) and the 10-open cap (409). Typecheck 52.

## 2026-11-11 (21:50 CST, America/Chicago) — Launch screen recolor + Supabase keep-alive (branch chore/keepalive-loading)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **Launch/loading screen matches the Editorial scheme** (logo artwork unchanged, per Timothy Nov 11): near-black background, "FULLER" in paper white + "FEUDS" in red (Anton), thin gold rules top and bottom, a thin gold ring around the logo, italic gold-beige tagline, and a small red loading bar. The same screen shows before React loads (inline in `client/index.html`) and while sign-in state loads (`App.tsx`), replacing the old grey spinner + "Loading...".
- **Installed-app (PWA) splash**: `manifest.json` background/theme color changed from navy slate (#0f172a/#1e293b) to Editorial black (#14110e). New `launch-logo-512.png` / `launch-logo-192.png` are the same logo trimmed to its circle (transparent corners) so it doesn't sit in a grey square on the dark splash. Maskable/home-screen icon unchanged. Android caches the manifest: re-adding the app to the home screen may be needed to see the new splash.
- **Supabase keep-alive (fix item 7)**: new `runDbKeepAlive()` in `server/scheduled-jobs.ts` runs a tiny real query on `users` every 12 h (00:17/12:17 UTC) plus once a minute after each start. Free, inside the existing Render service (Starter plan, always on). Caveat: it can't help if the Render service itself is suspended (e.g. billing) — Supabase emails before pausing.
- Typecheck 52.

## 2026-11-11 (21:40 CST, America/Chicago) — Fix list items 1–6 (branch fix/nov11-fixes)
Made by the Fuller Feuds Dev bot (Grok Bot).
1. **End debate early** now uses a styled Editorial dialog ("End this debate early?" · Keep debating / End debate) instead of the browser's plain confirm() pop-up (debate room page; the popup window already had its own).
2. **Enter in search filters the home page.** On `/`, pressing Enter keeps you on home and shows only matching topics (title, description, categories; every word must match) in a "Search results" deck, with a "N topics matching "x"" chip and ✕ to clear. No matches → "Create this topic" / "Clear search". Other pages still go to /search on Enter.
3. **Leaderboards popup uses @handles.** Title is "@handle's rankings" (or "Your rankings"); each row leads with @handle, real name underneath. Followers/following popups on a profile also use @handle.
4. **New rating badges** (Quality category, same badge system/look): **Highly Rated** = 4.0+/5 average from opponents across 3 rated debates; **Top Rated** = 4.5+/5 across 10. Average = (logic + politeness + openness) / 3 from `debate_votes`, own votes excluded. Auto-added on server start; awarded on rating and on profile view.
5. **Full counterpoints page** at `/opinion/:id/counterpoints` (`?p=N` jumps to a paragraph): the opinion paragraph by paragraph, every counterpoint under its paragraph with author, @handle, time and likes; like/unlike; "+ Add a counterpoint" per paragraph; the opinion's author gets "Debate @handle" on each counterpoint. Linked from the topic page's counterpoints sheet ("See all counterpoints on this opinion →") and from "See counterpoints" on profile opinion cards. API: `GET /api/opinions/:id/counterpoints` without `sentenceIndex` now returns all paragraphs.
6. **Time zone fix for debate times.** The DB stores UTC without a zone; the footer/Debates list API returned "2026-11-03 14:16:47+00" (iPhone Safari can't parse it) and any zone-less string is read by browsers as local time (6 h off in Central). Server now sends real ISO-8601 UTC; the client parses all debate timestamps with new `parseServerDate()` (treats zone-less as UTC) in the room page, popup, messenger, tray, Debates list, opponent list and Archive. Production DB session timezone confirmed UTC.
- Local Playwright: 17/17 pass (`/workspace/ff-nov11-fixes.cjs`). Typecheck 52 (unchanged).

## 2026-11-11 (21:25 CST, America/Chicago) — In-app bug reports & feature requests + admin page fixes (branch feat/feedback-admin)
Made by the Fuller Feuds Dev bot (Grok Bot).
- **New "Report a bug / idea" form.** Sidebar item (every visitor, signed in or not) and a button in Settings. Pick Bug or Feature idea, add a title and details; the page you were on is attached automatically (plus browser user-agent). Signed-in submissions keep your user id.
- **New table `feedback_requests`** (migration `0010_feedback_requests.sql`): type, title, description, page_url, user_agent, status (new / in_progress / done / wont_fix), admin_note, timestamps. RLS on with no policies so Supabase's public REST API can't read it.
- API: `POST /api/feedback` (validated, 5 per 10 min per user/IP). `GET /api/admin/feedback?type=&status=` and `PATCH /api/admin/feedback/:id` are **admin-only on the server** (403 for moderators/users, checked in tests). Status changes are written to the audit log.
- **Admin page audit + fixes:**
  - New **Requests** tab (admins only) with type/status filters, counts, a red "new" badge on the tab, and a per-request status dropdown.
  - Removed the dead **Challenges** tab (its API was a stub that always returned nothing).
  - **Audit Log** was a stub that always said "No actions recorded"; it now reads the real `moderation_actions` table with the moderator's name, and the filter works.
  - Tabs no longer overflow on phones (horizontally scrollable row).
  - Safety: admins can't change role/status of, or delete, their own account; moderators can't suspend/ban/reinstate admins or other moderators.
- Admin access is decided by `users.role` (`admin` / `moderator` / `user`), checked server-side by `requireAdmin`/`requireModerator`. Both of Timothy's accounts (timfuller1998@gmail.com @timf and Timfuller1998@gmail.com @TIMOTHYF) are `admin` in production.
- Typecheck 56 → 52.

## 2026-11-05 (19:40 CST, America/Chicago) — Fix /create-topic 404 (branch fix/create-topic-404)

- **Cause:** Client had no `/create-topic` route. `CreateTopicPage.tsx` was removed in an Oct 2025 Replit restore, but `CategoryPage` still navigated to `/create-topic`, so the SPA catch-all rendered `NotFound` ("404 Page Not Found"). Not caused by cleanup PR #16 (routes unchanged there); API `POST /api/topics` was fine.
- **Fix:** Restored `client/src/pages/CreateTopicPage.tsx` (updated for `useAuth` + current `apiRequest`), registered `<Route path="/create-topic" />` in `App.tsx`. Category CTAs pass `?category=`. Empty category state also gets a Create button. SearchBar inline create path unchanged.
- Not merged yet until local + live verify.

## 2026-11-05 (19:25 CST, America/Chicago) — Drop leftover Replit + Vercel config (branch chore/drop-replit-vercel)

- Removed Replit host files: `.replit`, `replit.md`, unused `server/replitAuth.ts`, Replit object-storage stack (`server/objectStorage.ts`, `server/objectAcl.ts`).
- Removed Vercel-only pieces: `vercel.json`, `api/` serverless shim, `VERCEL_STATIC_FILES_EXPLANATION.md`, `APPROACH_1_IMPLEMENTATION.md`.
- Vite: dropped `@replit/vite-plugin-*` (cartographer, dev-banner, runtime-error-modal) and `REPL_ID` gates; plugins is just `@vitejs/plugin-react`.
- npm: uninstalled `@replit/vite-plugin-*`, `openid-client` (Replit OIDC only), `@google-cloud/storage` (Replit sidecar only).
- Kept `render.yaml` (Render hosting). Local auth (`server/auth.ts`), passport-local, and Editorial app code unchanged.
- Not merged; waiting for Timothy.

## 2026-11-04 (09:22 CST, America/Chicago): Footer avatars get status dots, a live typing "…", and an Archive for finished debates (branch fix/full-qa)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- **Removed the per-message unread number on footer avatars.** It counted every message after you last read, your own messages included, and the room page never cleared it. The old `getGroupedDebateRooms` query is gone. Grouping now lives in NEW `server/lib/userDebates.ts`, which also feeds the footer Debates list, so the two always agree.
- Still one avatar per person. Each one shows a single indicator, in this order:
  1. **"…" typing bubble** (animated) while that person is typing in an active debate with you. It overrides the dots because it's momentary and the most actionable signal. The dot comes back once they stop.
  2. **Green dot:** a new debate invite from them you haven't opened yet.
  3. **Red dot:** a debate with them needs you (your turn, or rate now).
  4. Nothing otherwise.
- Opening the debate clears the green dot, whether you open it from the room page, the Debates list, the person's list, or the popup. The popup now calls read-room too. Dots update live over WebSocket.
- **Finished debates move to Archive.** "Finished" means both sides rated, or you've rated and are only waiting on theirs.
  - A debate that ended but you haven't rated stays active with a red "Rate now" dot.
  - A person whose debates are all finished appears only in Archive. A person with both kinds keeps an avatar for the active ones.
  - The Archive button shows a count. The Archive panel is rebuilt from the same data: it shows the right opponent and opens the room on tap.
  - The old 30-day cutoff is dropped, because status now decides.
  - The Debates list uses the same split; its "Completed" section is now "Archive".
- **Live typing.**
  - Debate inputs (room page and popup) send typing start at most every 2s, and stop after 3s idle, on send, or on blur.
  - On the receiving side the bubble expires after 5s, so a lost "stop" can't leave it stuck.
  - The room page and popup show "<Name> is typing…" with the same bubble. This replaces the room's old typing text, which never worked because it listened on a socket the server doesn't serve.
- **WebSocket typing is now locked down.** The server relays it only from a signed-in participant of that room, only while the debate is active and not in rating, and drops repeat "start" events within 1s. Unauthenticated sockets are ignored, as before.
- Tests: NEW `/workspace/ff-qa-dots.cjs`, 25/25 PASS at 390px and on desktop, covering invite → green live → open clears green → red on your turn → "…" in footer and room → rate → Archive. The earlier `ff-qa-footer.cjs` still passes 36/36. Checked in dark, medium and light themes. Videos and screenshots are in /workspace/ff-videos/footer-dots/.
- No new migration.

## 2026-11-04 (08:12 CST, updated 08:31 CST, America/Chicago): Full QA pass, debate notifications and end-of-debate ratings (branch fix/full-qa)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Full end-to-end test with Playwright: alice, bob, admin and fresh sign-ups, on desktop and at 390px. Scripts are in /workspace (ff-qa-*.cjs); videos and screenshots are in /workspace/ff-videos/full-qa/.
- NEW debate notifications, saved in the `notifications` table and pushed live over WebSocket. Types: new debate, your turn, debate ended, rate your opponent, ratings in. API: `/api/notifications` (list, read-all, read-room, mark one read).
- Update after Timothy's review: **no bell in the header any more**, so the search bar gets its full width back. Everything now lives in the footer: a NEW **Debates** button (replaces "More") with a live unread badge opens "Your debates".
  - The list includes every debate: new invites (highlighted, marked NEW), your turn, their turn, rate now, waiting for their rating, and a Completed section.
  - Tapping an item opens the debate room and marks its notifications read.
  - Backed by a new `GET /api/notifications/debates`. Checked in dark, medium and light themes.
- Also fixed: a debate popup you'd already closed by opening the room page came back after a reload. Saved popups were restored after child pages had run.
- NEW turn-based flow: 3 turns each, and only the person whose turn it is can post (others get a 409). After 3 turns each, or when someone ends the debate early, it moves to rating.
- NEW end-of-debate rating: `POST /api/debate-rooms/:id/vote` (Logic, Civility, Openness, 1–5, one rating per person) and `GET /:id/votes`. Scores stay hidden until both sides have rated. A "Final ratings" card shows on the room page, and the opponent's stats update. Added a NEW "Top Rated" leaderboard tab.
- Bugs fixed:
  - Security: the WebSocket trusted any userId, so anyone could pose as anyone. It now uses the session.
  - `/debate-room/:id` had no route (it 404'd).
  - The rating dialog posted to an endpoint that didn't exist.
  - "End debate" sent you to a 404.
  - When sending a message failed, nothing told you.
  - The turn badge didn't update.
  - The popup window covered the room page.
  - The rating dialog showed the wrong side's scores.
  - Emails showed as name fallbacks.
  - **Opinions were saved without their stance** (the repository dropped it).
  - Posting an opinion on a brand-new topic returned a 500 (a Date was bound in raw SQL), even though the opinion had been saved.
  - A new opinion didn't appear on the topic page for up to 2 minutes (stale cache).
  - Two other raw-SQL Date bindings were fixed.
- Typecheck 57; `vite build` passes. No migration (see DEPLOY-CHECKLIST.md about the DB timezone). QA test data deleted from the local DB.

## 2026-11-04 (06:45 CST, America/Chicago): Sign-up audit and first-run tutorial (branch feat/first-run-tutorial)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Audit (fresh sign-ups on desktop and at 390px; videos and screenshots in /workspace/ff-videos/signup-audit/):
  - Bug, from the handles PR: `/api/auth/user` didn't return `handle`, so the onboarding Handle field was empty and **Next stayed disabled with no explanation** (a dead end). Settings' handle box was empty too. Fixed.
  - When logged out, the sidebar showed a fake "User · Online" card with settings and logout buttons. It's now hidden.
  - There was no explanation of the site anywhere. Onboarding step 4 advertised live streaming and AI insights, but not stances, the card deck, flipping cards, counterpoints, debates or badges.
  - The Location placeholder "San Francisco, CA" looked like a filled-in value. It now reads "City, state or country".
- New first-run tutorial (`FirstRunTutorial.tsx`), in the Editorial style, 5 steps: what Fuller Feuds is (For/Against/Neutral), sharing an opinion, the deck (swipe left or › for next, tap to flip), counterpoints and one-on-one debates, then badges, leaderboards and your @handle.
  - Swipe, ‹ › buttons and arrow keys all work. Skippable.
  - Opens once after onboarding. Finishing or skipping saves `users.tutorial_completed_at` (new migration 0009, added to DEPLOY-CHECKLIST.md).
  - Replay from Settings ("Replay tutorial") or from "How it works" in the sidebar, which also works when logged out.
- Onboarding step 4 now lists the real core actions and mentions the tour.
- Typecheck 61; `vite build` passes. New-flow videos: /workspace/ff-videos/signup-tutorial/{desktop,mobile}.mp4. Audit test accounts deleted from the local DB.

## 2026-11-04 (06:10 CST, America/Chicago): Unique @handles (branch feat/user-handles)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Every user now has a unique @handle (3–20 letters, numbers or _, must start with a letter, case-insensitive unique, reserved words like admin/moderator/support/fullerfeuds/api blocked). Display names can still repeat.
- Migration `migrations/0008_user_handles.sql`: adds `users.handle`, backfills existing users from screen name / first name + last initial (number added if taken), then NOT NULL + unique index on `lower(handle)` + format CHECK. Applied to the LOCAL DB only. **Must run on production before deploying**; see the new `DEPLOY-CHECKLIST.md` (which also lists 0006 and 0007 as still pending on prod).
- Server: `GET /api/handles/check` (validity + availability + suggestion), `GET /api/handles/suggest`, `PUT /api/handles/me` (own handle only; 400 invalid, 409 taken), `GET /api/handles/:handle` (lookup). `/api/register` accepts a handle (409 if taken). Any other creation path (Replit login, synthetic users) gets an auto-generated handle in `UserRepository`.
- Client: handle picker with live, debounced availability and a "Try @…" suggestion in sign-up, onboarding step 1 and a new Settings "Handle" card. "@handle" shows in small muted text under names on opinion cards (front and back), counterpoints (which now show their author), the debate window and debate room, the profile header, leaderboards and the opponent picker. `/u/@handle` (or `/u/handle`) links open that profile.
- Seed script sets handles for the demo users. Typecheck 61. Screenshots: /workspace/ff-videos/handles/.

## 2026-11-04 (05:59 CST, America/Chicago): Screen names show plainly (PR #11 follow-up)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- Checked: the app never adds a "(screen name)" label anywhere. That text was only part of the temporary test name I gave Erin for the first screenshots. Names show plainly: just the screen name, or first and last name if there isn't one.
- New screenshot with a realistic screen name ("ErinP"): /workspace/ff-videos/display-names/after-v2-mobile.png. The test name was reset afterwards. No app code changes. Typecheck 61.

## 2026-11-04 (05:52 CST, America/Chicago): Opinion screen names (branch fix/opinion-display-names)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Root cause of "u-erin thinks…": the local seed script `scripts/seed-local-gamification.sql` wrote the user id into the opinion text itself. The app never showed raw ids. The seed now uses the screen name (or first name), and the 17 affected local opinions were rewritten (local DB only).
- Real code bugs found along the way:
  - Settings saved screen names to `PATCH /api/profile/:userId`, a route that didn't exist, so screen names were never saved. The route now exists (you can only edit your own profile). It saves the screen name, bio and sort preferences and clears the cached topic and opinion lists so the new name shows right away.
  - Everywhere except the Profile page used first/last name and ignored the screen name. New `server/lib/screenName.ts` (screen name first, else first/last name) is now used for opinion authors (deck cards and the flipped side, recent and profile opinions), counterpoint authors, debate room participants (debate window and My Debates), topic preview quotes, debate-candidate pickers, and leaderboards.
- Typecheck 61; `vite build` succeeds. Screenshots: /workspace/ff-videos/display-names/.

## 2026-11-04 (05:46 CST, America/Chicago): Card deck buttons and keys back to the usual directions (PR #10 update, merged)
Made by the Fuller Feuds Dev bot (Grok Bot), on Timothy's decision.
- Buttons: ‹ on the left = previous card, › on the right = next card. Keys: → = next, ← = previous. Tooltips and screen-reader labels now just say "Previous card" and "Next card".
- Swipes are unchanged (swipe left = next, swipe right = previous), and so are the card animations.
- Checked in Playwright on desktop light: a left swipe, the › button and the → key each go forward; a right swipe, the ‹ button and the ← key each go back (1→4→1). Typecheck 61; `vite build` succeeds. Video: /workspace/ff-videos/swipe-fixed-v4/light-desktop.mp4.

## 2026-11-04 (05:41 CST, America/Chicago): Card deck phone pull-out and arrow directions (PR #10 update)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Phones (under 640px): when going back, the bottom card is pulled out only about 55% of a card width, so it stays on screen. During a right swipe the top card also moves a little left and shrinks slightly, so the emerging card is easy to see. The emerging card sits between the top card and the 2nd card, so the 2nd card is still never uncovered.
- Arrows now point the way the cards move. ‹ (left) means next: the top card slides off to the left. › (right) means previous: the bottom card comes in from the right. Arrow keys follow the same rule (← next, → previous), matching left and right swipes.
- Typecheck 61; `vite build` succeeds. Videos: /workspace/ff-videos/swipe-fixed-v3/.

## 2026-11-04 (05:37 CST, America/Chicago): Going back in the card deck now works like a real deck (PR #10 update)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Dragging right no longer moves the top card away, so the 2nd card is never uncovered. Instead the bottom card is pulled out from behind the deck on the right, following the finger.
- When you let go, the bottom card finishes coming out from behind, then lands on top, and the old top card settles one step down. Keys and the back button use the same motion.
- Forward (top card tucked under to the bottom) is unchanged. Typecheck 61; `vite build` succeeds. Videos: /workspace/ff-videos/swipe-fixed-v2/.

## 2026-11-03 (21:44 CST, America/Chicago): Card deck swipe fixes (branch fix/deck-swipe)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged; waiting for Timothy's review.
- Mobile: opinion cards can now be swiped by touching their text. The text area uses `overflow-x-hidden touch-pan-y` so the browser no longer takes over sideways swipes; vertical scrolling still works.
- Backward swipe now mirrors forward: the previous card enters right away from the swipe direction and settles on top, while the dragged card sinks into the next slot from where you let go (no spring-back first).
- The position counter now changes at the same moment the animation starts, going forward or back.
- Dark/dusk: deck cards get a faint light hairline plus a stronger ink shadow. Partly hidden cards are a little brighter, and the plain card backs are neutral instead of red-tinted.
- Typecheck at 61 errors (no change); `vite build` succeeds. Videos: /workspace/ff-videos/swipe-fixed/.

## 2026-11-03 (21:05 CST, America/Chicago): Merged PR #7 and PR #8
Made by the Fuller Feuds Dev bot (Grok Bot), on Timothy's OK ("Looks good, merge both").
- PR #7 (Editorial redesign) merged into main as 681d325.
- PR #8 (Editorial dark/dusk modes, saved-theme boot fix) retargeted to main and merged as 2a5de51, with no conflicts.
- Main after both merges: typecheck at 61 errors (no change); `vite build` succeeds.

## 2026-11-03 (21:45 CST, America/Chicago) — Editorial dark mode (branch design/editorial-dark, stacked on design/editorial / PR #7)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- Dark mode is now Editorial at night: ink-brown paper (`30 14% 9%`), cream type, and a brightened red accent (`4 72% 66%`) with dark-ink text on red buttons. It keeps the same Playfair, Source Serif, Inter caps and Anton wordmark, the square corners and the double rules.
- Medium mode is now an Editorial "dusk" palette: the dark palette lifted 8 lightness steps.
- Dark-mode versions of the shared colors (stance, success, warning, live, info, ai, gold/silver/bronze, charts), so every component follows. White text on colored fills is now `text-primary-foreground` (14 spots), so badges read in both modes.
- Ink-block shadows and dialog overlays use a new `--shadow-ink` token with a strength multiplier, so they stay visible on dark paper. Avatar initials are a fixed dark ink because avatar backgrounds are always light.
- Fix: the saved light/medium/dark preference was only applied after visiting Settings, so it was lost on every reload. An inline boot script in index.html now applies it before first paint and sets the browser theme color.
- Fix: two `bg-muted0` classes, broken by the color remap in PR #7 ("Ended" badges), are now `bg-stance-neutral`.
- WCAG AA, dark: body text 14.7:1, muted text 8.9:1, every colored color as text on the page background and as a fill with dark text at least 6:1. Medium: at least 4.6:1.

## 2026-11-03 (21:20 CST, America/Chicago) — Editorial redesign as the default look (branch design/editorial)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- New default (light) palette: cream paper, ink text and a deep-red accent. Fonts: Playfair Display headlines, Source Serif 4 body text, and Inter small caps for buttons, tabs and badges. The browser theme color is cream.
- Header and sidebar wordmark: "FULLER FEUDS" in Anton, all caps and not italic, in ink with "Feuds" in red. The header wordmark shows on mobile; the sidebar wordmark shows on desktop.
- Corners are square everywhere through the Tailwind radius scale; avatars and dots stay round. Small shadows are gone and large ones are soft offset ink blocks. The header and footer have double-rule borders.
- New semantic color tokens: stance for/against/neutral, success, warning, live, info, ai, and gold/silver/bronze. All hard-coded Tailwind colors in 17 components were replaced with them (Active pill, stance badges and toggles, leaderboard medals, topic badges, admin status, Hot/Trending ranks, Live page).
- Avatars: the near-centre compass color is now warm newsprint instead of pink, and avatar initials are ink rather than white. AvatarWithBadge uses the stance tokens.
- UI primitives restyled: buttons, tabs (ruled bar with a red underline on the active tab), badges, cards, inputs and textareas on card paper, dialogs (ink border with a heavy top rule), sheets, toasts (red left rule), and ink-tinted overlays. The debate window, including mobile full-screen, picks the look up from the tokens.
- Main area spacing moved to a consistent scale. Contrast was checked to WCAG AA: body text 15:1, muted text 6.4:1, and 4.5:1 or better for white text on every token badge.
- Medium and dark modes keep their own palettes but get the new tokens. The deck shuffle, flip and all behavior are unchanged.

## 2026-11-03 (18:50 CST, America/Chicago) — Mobile debate window (branch fix/mobile-debate-window, PR #6)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- `PopupDebateWindow` is full-screen on screens narrower than 768px. It sits above the footer and fills the visual viewport, falling back to `100dvh`. When the on-screen keyboard opens, the window shrinks so the input stays visible. It also respects iPhone safe areas, locks page scrolling while open, and turns off dragging.
- On mobile the close and minimize buttons are 40px tap targets. The input text is 16px so iOS doesn't zoom, and message bubbles can be up to 80% wide.
- Desktop (768px and wider) is unchanged: a draggable 400x500 popup.
- Verified with Playwright at 360x640, 390x844, 414x896 and 1366x768: open, send a message, then close.

## 2026-11-03 (18:30 CST, America/Chicago) — Choose debater fixes (branch fix/choose-debater, PR #5)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- New `GET /api/counterpoints/:id/debate-candidates`: the counterpoint's author first, then the people who liked it. Duplicates and the requester are left out. Each entry has the user's name, avatar, online status and "Most Active" leaderboard rank (null when the user has no activity).
- The Choose debater picker shows avatars, real names, "Wrote this" or "Liked this", a green dot when online, and "#N active" only when a rank exists. The "Rank 0 / Offline" labels and the sort toggle are gone. You can debate the author even when no one has liked the counterpoint.
- Starting a debate closes the panel, opens the debate window with that opponent, and shows a toast with an Open button.
- The opening message now reads "Counterpoint to paragraph N:" instead of "sentence #N".
- On the flipped opinion card, the actions now sit right under the text, with "See counterpoints" placed first. At 390x844 the button is visible above the footer without scrolling.

## 2026-11-03 (14:45 CST, America/Chicago) — Badges + Rankings (branch feat/profile-cleanup, PR #4)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- `GET /api/users/:id/badges` is now real. It returns every badge definition with `unlockedAt`, `isSelected` and `progress {current, required}`. Badges are awarded lazily on read (`BadgeRepository.checkAndAwardBadges`), computed from existing tables, so past activity counts with no backfill. Earned badges are permanent (`user_badges`, ON CONFLICT DO NOTHING).
  - Opinions: count of opinions that aren't hidden or flagged (1/10/50/100).
  - Debates: debate rooms the user took part in (1/10/50/100).
  - Topics: topics created (1/10/25).
  - Quality: 10 or 25 debates, at least one message, and under 5% or 3% of messages flagged for fallacies.
  - NEW community badges: likes received from others (5/50) and followers (1/10).
- `POST /api/users/me/selected-badge` is implemented (it was a stub). It only allows badges you've earned, and the chosen badge shows on the avatar.
- NEW `GET /api/leaderboards?userId=&topicId=&limit=` (server/routes/leaderboards.ts). Categories:
  - Most Liked: likes received, self-likes excluded.
  - Most Active: opinions + counterpoints + debate messages.
  - Most Followers.
  - Top Topic Creators.
  - Ranks use RANK(), so ties share a position. Only active users with a value above 0 are ranked. `me` carries the requested user's rank even outside the top N. With `topicId`, only Most Liked and Most Active are returned, scoped to that topic.
- Profile:
  - The Badges button (earned/total) and dialog are back, split into Earned and Locked, with progress bars and "Show on avatar".
  - The Rankings button is back and shows the user's best rank (e.g. "#1 Rank · Liked").
  - NEW LeaderboardsDialog component: tabs per category, a "You are #N of M" summary, a highlighted own row (appended below the top 10 if outside it), and rows that link to profiles.
- Migration `migrations/0007_community_badges.sql` (applied to the local DB only): inserts the 4 community badge rows and adds the index `idx_opinion_votes_opinion_type`. Data and index only, no schema change.
- Local demo data: `scripts/seed-local-gamification.sql` (LOCAL ONLY; adds 6 users, opinions, likes, follows and 1 debate).
- Media: /workspace/ff-videos/pr4/expanded/ (390 and 1366 screenshots, plus badges-rankings-mobile.mp4)

## 2026-11-03 (14:15 CST, America/Chicago) — Profile page cleanup (branch feat/profile-cleanup)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- Security: `GET /api/profile/:id` no longer returns `passwordHash` (it was included when you viewed your own profile). The followers and following lists no longer include emails, and the modals don't display them.
- Follow and unfollow returned a 500 (`column "user_profiles" of relation "user_profiles" does not exist`). `recomputeFollowCounts` put table-qualified columns into a raw `UPDATE ... SET`. It now uses the Drizzle query builder, so follower and following counts update.
- The profile shows the bio from `user.bio` and the top-level follower and following counts from the API.
- Other users' profiles now say "Bob's Topics" and "Bob's Opinions" instead of "My Topics" and "My Opinions". Removed the "View All" links, which pointed back to the same page.
- Opinions now appear in the shared CardDeck using OpinionDeckFront and OpinionDeckBack: stance badge, author, likes and voting. An "Open debate" button links to the topic. This replaces the OpinionCard row that showed raw ISO timestamps.
- `{topics: [...]}` responses (recommended topics and topics from people you follow) are normalized to arrays. Before, `.map` crashed as soon as they had data.
- Fixed the political-leaning label condition, which was always true. It now shows only when there are scores and at least one opinion.
- Hid the Rankings button and modal: there is no `/api/leaderboards` route. The Badges button is hidden while `/api/users/:id/badges` is still a stub that returns [].
- Tighter page padding. No DB migrations.
- Media: /workspace/ff-videos/pr4/before/, /workspace/ff-videos/pr4/after/, /workspace/ff-videos/pr4/profile-mobile.mp4

## 2026-11-03 (14:10 CST, America/Chicago) — Footer overlap fix (branch feat/stances-likes, PR #3)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged.
- Root cause: the debate footer was `position: fixed` on top of the scrolling `<main>`, and the app shell used `h-screen` (100vh). Main's scroll area extended under the footer, so cards and buttons slid beneath it whenever the page wasn't scrolled all the way down. On mobile browsers 100vh is taller than the visible area (URL bar), which also pushed main's bottom padding off-screen, so the earlier extra-padding fix couldn't help.
- Fix: the footer is now in normal flow (`relative shrink-0`) at the bottom of the app column; the shell uses `100dvh` (falls back to `h-screen`); main is `flex-1 min-h-0` with normal padding. Main's visible area now ends exactly at the footer's top edge, so nothing can render under it. Reverted the 6rem/5rem padding from the previous entry.
- CardDeck caps card height on short screens (viewport height − 290px, keeping the 5:7 ratio) so the home deck and its controls fit above the footer at 360x640.
- Verified at 360x640, 375x667, 390x844, 414x896, 1366x768 and 1280x800 with a long opinion, front and flipped: /workspace/ff-videos/pr3/footer-fix/ (before/ holds the pre-fix captures).

## 2026-11-03 (13:50 CST, America/Chicago) — PR: Opinion stances + like/dislike count fix (branch feat/stances-likes)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged — waiting for Timothy's review of the video.
- PR #2 (topic page opinion deck, feat/topic-page-deck) was merged into main by Fuller Feuds Dev on Nov 3, 2026 (merge commit ef35eb5).
- Stance: new nullable `opinions.stance` column (`for` / `against` / `neutral`, CHECK constraint, `(topic_id, stance)` index). Migration `migrations/0006_opinion_stance_and_vote_counts.sql` — applied to the LOCAL dev DB only; production Supabase still needs it.
- API: stance is returned on opinions and accepted (validated) on create and PATCH. PATCH now only accepts content / debateStatus / references / stance (previously the raw body was passed through, so counters could be patched).
- UI: For / Against / Neutral picker in the create/update opinion dialog (required); OpinionDeckCard stance badges and the topic header tally now use real data.
- Like/dislike fix: votes were stored in `opinion_votes` but the topic opinions list was served from a 2-minute cache that the vote handler never invalidated (no topicId passed), and the read path ignored the `likes_count`/`dislikes_count` columns (live COUNT, returned as a string). Voting now updates the vote and resyncs the counters in one transaction, invalidates `topic:<id>:opinions:*`, and the vote endpoint returns the fresh counts. The migration backfills the counters from `opinion_votes`.
- Opinion lists now sort by created_at then id, so opinions with identical timestamps no longer swap places in the deck after a refetch (the card under your finger used to change after liking).
- Bottom spacing: main content gets bottom padding of 6rem (5rem on md+) plus the safe-area inset, and the fixed debate footer pads for the safe area, so deck cards and buttons on the home and topic pages clear the footer at 390x844 and on desktop.
- Local test data: stances set on all 7 seeded opinions; seed likes replaced with real `opinion_votes` rows.
- Verification media: /workspace/ff-videos/pr3/ (screenshots 01–11, pr3-mobile-stances-likes.mp4).


##  (, America/Chicago) — PR: Generic CardDeck (branch fix/topic-cards)
Made by the Fuller Feuds Dev bot (Grok Bot).
- Added `client/src/components/CardDeck.tsx`: generic reusable deck (items, getKey, renderFront, optional renderBack, renderBadge) with the existing overlap, tap-to-flip, tuck-to-bottom shuffle and input lock; built-in 3D flip when renderBack is given.
- `SwipeableCardStack.tsx` is now a thin topic wrapper over CardDeck (TopicCard still renders its own front/back); pages unchanged.
- Pushed branch fix/topic-cards (includes earlier deck commits c31b689..568e992) and opened PR to main.
- Merge: PR merged into main by the Fuller Feuds Dev bot after typecheck, build and mobile Playwright checks passed (per Timothy's instruction).

## 2026-11-03 (10:31 CST, America/Chicago) — PR: Topic page redesign (branch feat/topic-page-deck)
Made by the Fuller Feuds Dev bot (Grok Bot). Not merged — waiting for Timothy's review of the video.
- Topic header: title, short description (topic description, else start of the AI summary), and a For / Against / Neutral stance tally.
- AI summary: removed the highlight styling; clean paragraphs, with a tappable "N counterpoints" badge (counterpoints on the opinions the paragraph references) that opens the existing referenced-opinions sheet.
- Other Opinions is now a CardDeck (renderFront/renderBack) with the home-deck shuffle. Front: author name/avatar, stance, text with per-paragraph counterpoint badges. Back: like/dislike/counterpoint counts, Like/Dislike/Adopt/Flag below the text, and "See counterpoints" opening the existing counterpoints sheet.
- Adopt dialog: fits a 390x844 screen, body scrolls, header and footer stay visible.
- CardDeck: new optional onIndexChange and initialIndex props (topic decks unaffected).
- New files: client/src/components/OpinionDeckCard.tsx, client/src/lib/stance.ts.

## 2026-11-20 — Fuller Feuds Dev: backlog note for ad-free toggle
- Added `docs/BACKLOG.md` with a scoped (not built) plan for an ad-free opt-in toggle in Settings, admin-only for now, with placeholder hooks for supporter badges and 2x debate credit. Docs only, no code changes.

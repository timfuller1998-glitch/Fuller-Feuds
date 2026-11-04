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

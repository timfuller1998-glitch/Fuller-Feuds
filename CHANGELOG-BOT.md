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

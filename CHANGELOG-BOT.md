
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

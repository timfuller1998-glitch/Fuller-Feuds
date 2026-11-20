# Google AdSense on Fuller Feuds

Publisher: `ca-pub-3189160810875202` (public id, not a secret).

## Where ads show

Ads live **only on cards inside card decks** (Timothy, Nov 20 2026: "ads built onto cards only … every 5-6 swipes").

- `CardDeck` inserts one **Sponsored** ad card after every 5 real cards (positions 6, 12, 18 …), only in
  decks with at least 5 cards. That covers every deck: Home sections, Trending, All Categories / Category,
  Search, Recent Opinions, topic opinion decks, counterpoints and profile decks.
- The AI summary deck on a topic page opts out (`ads={false}`); it is one article read paragraph by paragraph.
- No banners between sections or lists, and nothing in debate rooms, Settings, admin, onboarding or auth.
- Ad cards are the deck's card size, dashed gold frame, "Sponsored" + "Advertisement" labels. A tap flips the
  card (never navigates); the back says "Hide ads with a supporter subscription" with an **Ad settings** button.
- The position counter skips ad cards (it reads "Sponsored" while one is on top), and `onIndexChange` /
  `initialIndex` only ever see real cards.
- Users with ad-free on (`useAdsEnabled()` false: admins now, supporters later) never get ad cards.
- The AdSense unit is only mounted while its card is on top of the deck.

Code: `client/src/components/CardDeck.tsx` (wrapper at the bottom), `client/src/components/ads/AdCard.tsx`,
`client/src/components/ads/AdSlot.tsx` (`AdUnit`), `client/src/lib/adsense.ts`.

## Render environment variables (service srv-d57jt9n5r7bs7386qqj0)

| Variable | Value | When it matters |
| --- | --- | --- |
| `VITE_ADSENSE_CLIENT` | `ca-pub-3189160810875202` | **Build time.** Adds `<meta name="google-adsense-account">` and the async `adsbygoogle.js?client=…` script to `<head>` on every page (site verification + ad serving). |
| `VITE_ADSENSE_SLOT_FEED` | ad unit id, digits only (e.g. `1234567890`) | **Build time.** Until it is set, ad cards show the "Ad space" placeholder. Create a *Display ad* unit in AdSense → Ads → By ad unit, copy its `data-ad-slot`. |
| `ADSENSE_PUBLISHER_ID` | `pub-3189160810875202` (`ca-pub-…` also accepted) | Runtime. `/ads.txt` returns `google.com, pub-3189160810875202, DIRECT, f08c47fec0942fa0`; 404 when unset. |

`VITE_*` values are baked into the client bundle, so after changing them **redeploy** (a new build).

## AdSense console settings

- **Auto ads: keep OFF.** Auto ads would place ads all over the page and ignore the ad-free switch and the
  cards-only rule. (The head script alone does not show anything unless Auto ads is on.)
- **Privacy & messaging → European regulations message (Google CMP): turn ON** for EEA, UK and Switzerland.
  Google requires a certified CMP there; its message handles consent for personalized ads.
- Sites → add `fullerfeuds.com`, verify with the snippet (already in `<head>`) and ads.txt.

## No CSP

The server sends no Content-Security-Policy header (no helmet), so `pagead2.googlesyndication.com`,
`googleads.g.doubleclick.net`, `tpc.googlesyndication.com`, `fundingchoicesmessages.google.com` etc. load
freely. If a CSP is ever added, allow those domains (script-src, frame-src, img-src, connect-src).

## Legal pages

`/privacy` (accounts, data, cookies, Google AdSense / third-party ad cookies, links to Google Ads Settings and
"How Google uses information from sites or apps that use our services") and `/terms`. Linked from the sidebar,
Settings and the Home hero footer. Contact goes through the in-app feedback form (no public email yet).

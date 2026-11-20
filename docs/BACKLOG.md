# Fuller Feuds Backlog

Scoped ideas that are approved for later but **not built yet**. Each entry says what it is, where it would live, and what's deliberately left out.

## Ad-free opt-in toggle (future paid subscription)

_Added Nov 20, 2026 by Fuller Feuds Dev at Timothy's request. Not built._

**Now (v1):** a per-account "Ad-free" switch so Timothy can turn ads off on his own account. The site has no ad slots yet, so this ships alongside (or after) the first ads.

**Where it lives**
- UI: a new "Ads" card in `client/src/pages/Settings.tsx` (same Card/CardHeader pattern as the Tutorial and Handle cards), with one switch: "Hide ads on my account."
- v1 gating: only visible/enabled for `users.role = 'admin'` (Timothy's accounts). Everyone else sees nothing, or later a "Go ad-free" upsell.
- Data: new nullable columns on `users` in `shared/schema.ts` (additive migration):
  - `ad_free` boolean default false: the user's toggle.
  - `subscription_tier` varchar, null / 'supporter' (placeholder, unused in v1).
  - `subscription_expires_at` timestamp (placeholder, unused in v1).
- API: `PATCH /api/users/me/settings` (or the existing profile update route in `server/routes/users.ts`) accepts `adFree`; the server rejects it unless the user is an admin (v1) or has an active subscription (later).
- Client: a single helper like `useAdsEnabled()` that every future ad slot checks. Ads render only when `!user?.adFree`. All ad components must go through it.

**Later: paid subscription hooks (placeholders only)**
- `isSupporter(user)` helper in `shared/` that returns true if `subscription_tier` is set and not expired. v1 always returns false, except admins are treated as ad-free.
- Bonus badges: add supporter-only entries to `shared/badgeDefinitions.ts` with a new `requirementType: "subscription"` (e.g. "Supporter", "Founding Supporter"). They stay hidden until subscriptions exist.
- 2x debate credit: in the badge-progress code that counts debates (`debate_count` requirement, see `server/lib/debateFlow.ts` / badge award logic), apply a `debateCreditMultiplier(user)` that returns 2 for supporters and 1 otherwise. Credit only completed debates, to avoid farming.
- Payments (Stripe or similar), pricing, refunds, and the upsell UI are out of scope until Timothy decides.

**Open questions for Timothy**
- Price and billing period when it becomes paid.
- Does ad-free also hide "sponsored" topics, or only display ads?
- Should 2x credit apply to all debate badges or only some tiers?

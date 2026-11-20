// Supporter / ad-free hooks (Fuller Feuds Dev, Nov 20 2026). No payments yet: nobody is a supporter
// until a subscription flow sets subscription_tier + subscription_expires_at.

export interface SupporterFields {
  role?: string | null;
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: string | Date | null;
  /** Founder perk (migration 0016): lifetime ad-free, but only once the site has publicly launched. */
  founderLifetimeAdFree?: boolean | null;
}

/** True when a founder's lifetime ad-free perk is active (stored now, switched on at public launch). */
export function founderAdFreeActive(user: SupporterFields | null | undefined, publicLaunch: boolean): boolean {
  return publicLaunch === true && user?.founderLifetimeAdFree === true;
}

/** True when the account has an active paid tier. Always false until subscriptions exist. */
export function isSupporter(user: SupporterFields | null | undefined, now: Date = new Date()): boolean {
  if (!user?.subscriptionTier) return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > now.getTime();
}

/**
 * Who may flip the ad-free switch: admins now, supporters once subscriptions exist, and founders once
 * the admin "public launch" switch is on (until then founders see ads like everyone else).
 */
export function canUseAdFree(user: SupporterFields | null | undefined, publicLaunch = false): boolean {
  return user?.role === "admin" || isSupporter(user) || founderAdFreeActive(user, publicLaunch);
}

// Supporter / ad-free hooks (Fuller Feuds Dev, Nov 20 2026). No payments yet: nobody is a supporter
// until a subscription flow sets subscription_tier + subscription_expires_at.

export interface SupporterFields {
  role?: string | null;
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: string | Date | null;
}

/** True when the account has an active paid tier. Always false until subscriptions exist. */
export function isSupporter(user: SupporterFields | null | undefined, now: Date = new Date()): boolean {
  if (!user?.subscriptionTier) return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > now.getTime();
}

/** Who may flip the ad-free switch: admins now, supporters once subscriptions exist. */
export function canUseAdFree(user: SupporterFields | null | undefined): boolean {
  return user?.role === "admin" || isSupporter(user);
}

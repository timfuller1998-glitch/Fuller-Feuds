import { useAuth } from "@/hooks/useAuth";
import { canUseAdFree } from "@shared/supporter";

/**
 * Single gate for every ad slot (Fuller Feuds Dev, Nov 20 2026). Ads show unless the signed-in
 * account has the ad-free switch on AND is allowed to use it (admins now, supporters later).
 * The site has no ad slots yet; wrap any future ad in <AdSlot> so it goes through here.
 */
export function useAdsEnabled(): boolean {
  const { user } = useAuth();
  const u = user as any;
  if (!u) return true;
  return !(u.adFree === true && canUseAdFree(u));
}

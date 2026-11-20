import type { ReactNode } from "react";
import { useAdsEnabled } from "@/hooks/useAdsEnabled";

/** Wrap every ad in this so the ad-free switch hides it. Renders nothing when ads are off. */
export function AdSlot({ children }: { children: ReactNode }) {
  const adsEnabled = useAdsEnabled();
  if (!adsEnabled) return null;
  return <>{children}</>;
}

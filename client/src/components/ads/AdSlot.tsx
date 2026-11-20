import { useEffect, useRef } from "react";
import { useAdsEnabled } from "@/hooks/useAdsEnabled";
import { ADSENSE_CLIENT, ADSENSE_LIVE, ADSENSE_SLOT_FEED } from "@/lib/adsense";

// Ads (Fuller Feuds Dev, Nov 20 2026). Ads live only on ad cards inside card decks (see AdCard and
// CardDeck). AdUnit fills its (fixed-size) parent: a real AdSense unit when VITE_ADSENSE_CLIENT and
// VITE_ADSENSE_SLOT_FEED are set at build time, otherwise a labeled placeholder.

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function AdSenseUnit() {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blocker or script not loaded: the reserved space stays empty.
    }
  }, []);
  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block", width: "100%", height: "100%" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT_FEED}
      data-full-width-responsive="false"
    />
  );
}

/** The ad itself, sized by its parent. `live` = only mount the AdSense unit when this card is on screen. */
export function AdUnit({ live = true }: { live?: boolean }) {
  if (ADSENSE_LIVE) return live ? <AdSenseUnit /> : <div className="h-full w-full" />;
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-foreground/20 bg-muted/40 text-center"
      data-testid="ad-placeholder"
    >
      <span className="font-serif text-sm text-muted-foreground">Ad space</span>
      <span className="font-ui text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70">Reserved for Google AdSense</span>
    </div>
  );
}

/** Standalone labeled slot (not placed anywhere right now; Timothy wants ads on deck cards only). */
export function AdSlot({ placement, className = "" }: { placement: string; className?: string }) {
  const adsEnabled = useAdsEnabled();
  if (!adsEnabled) return null;
  return (
    <aside className={`flex w-full flex-col items-center gap-1 ${className}`} aria-label="Advertisement" data-testid={`ad-slot-${placement}`}>
      <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Advertisement</span>
      <div className="h-[250px] w-[300px] max-w-full"><AdUnit /></div>
    </aside>
  );
}

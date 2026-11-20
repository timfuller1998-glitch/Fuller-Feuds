import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardFaceContext } from "@/components/CardDeck";
import { AdUnit } from "./AdSlot";
import { cardGestureJustHappened } from "@/lib/cardGesture";

// Ad card (Fuller Feuds Dev, Nov 20 2026): a deck card that holds one ad. Same size/shape as the deck's
// cards but clearly labeled, with a muted frame so it never reads as a topic or opinion. A tap flips it
// (never navigates); the back explains ads and links to Settings only through an explicit button.

const shell = "relative w-full h-full rounded-xl border border-dashed border-[hsl(var(--gold)/0.55)] bg-card deck-card-surface overflow-hidden flex flex-col";

function Label() {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--gold)/0.5)] px-2 py-0.5 font-ui text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--gold))]">
        <Megaphone className="w-3 h-3" /> Sponsored
      </span>
      <span className="font-ui text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Advertisement</span>
    </div>
  );
}

export function AdCardFace({ slot, isTop }: { slot: number; isTop: boolean }) {
  return (
    <div className={shell} data-testid={`ad-card-${slot}`} data-ad-card="true" aria-label="Advertisement">
      <Label />
      <div className="flex-1 min-h-0 px-4 flex items-center justify-center">
        <div className="w-full h-full max-h-[300px]">
          <AdUnit live={isTop} />
        </div>
      </div>
      <p className="px-4 pt-2 pb-3 text-center font-ui text-[0.65rem] text-muted-foreground flex-shrink-0">
        Ads keep Fuller Feuds free · swipe to keep going
      </p>
    </div>
  );
}

export function AdCardBack() {
  const [, navigate] = useLocation();
  return (
    <div className={`${shell} items-center justify-center text-center px-6 gap-3`} data-testid="ad-card-back">
      <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--gold))]">About this ad</span>
      <p className="font-serif text-lg leading-snug">Ads keep Fuller Feuds free to read and debate.</p>
      <p className="text-sm text-muted-foreground">Hide ads with a supporter subscription.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings")} data-testid="button-ad-settings">
        Ad settings
      </Button>
    </div>
  );
}

/** For decks whose cards flip themselves (topic decks): same flip contract as TopicCard. */
export function AdCardSelfFlip({ slot, ctx }: { slot: number; ctx: CardFaceContext }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { if (ctx.forceUnflipSignal) setFlipped(false); }, [ctx.forceUnflipSignal]);
  useEffect(() => { ctx.onFlipChange?.(flipped); }, [flipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const face = (rot: number, visible: boolean): React.CSSProperties => ({
    transform: `rotateY(${rot}deg)`, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transition: "opacity 0.6s ease-in-out",
  });
  return (
    <div
      className="relative w-full h-full"
      style={{ perspective: "1000px" }}
      onClick={(e) => {
        if (!ctx.isTop || cardGestureJustHappened()) return;
        if ((e.target as HTMLElement).closest("button, a, [role='button']")) return;
        setFlipped((f) => !f);
      }}
    >
      <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none", transition: "transform 600ms ease-in-out" }}>
        <div className="absolute inset-0" style={face(0, !flipped)}><AdCardFace slot={slot} isTop={ctx.isTop} /></div>
        <div className="absolute inset-0" style={face(180, flipped)}><AdCardBack /></div>
      </div>
    </div>
  );
}

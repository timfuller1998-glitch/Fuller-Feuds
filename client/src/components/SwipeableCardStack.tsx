import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, animate, useMotionValue, useTransform, useReducedMotion, PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopicCard from "./TopicCard";

const FLIP_DURATION_MS = 600;
const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
const WHEEL_COOLDOWN_MS = 450;

/** Loose topic shape: every page maps its API topics a little differently. */
export interface DeckTopic {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  categories?: string[] | null;
  participantCount?: number | null;
  opinionsCount?: number | null;
  isActive?: boolean | null;
  [key: string]: any;
}

const getCardDimensions = (maxWidth: number) => {
  const width = Math.min(window.innerWidth - 34, maxWidth); // 17px gutter each side
  const height = (width * 7) / 5; // 5:7 playing-card ratio
  return { width, height };
};

interface SwipeableCardStackProps {
  topics: DeckTopic[];
  onEmpty?: () => void;
  /** Max card width in px (default 400). */
  maxWidth?: number;
  /** Optional overlay (e.g. trending rank) rendered on the top card. */
  renderBadge?: (topic: DeckTopic, index: number) => ReactNode;
  testId?: string;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Shuffle model: moving forward tucks the top card under the deck (slides out to the
 * side, drops behind, settles at the back) while the next card rises into the top spot.
 * Moving back pulls the bottom card out from under the deck and lands it on top.
 * Background cards are plain card backs, offset downward, and never take pointer events.
 */
const BACK_LAYERS = [2] as const; // blank backs beyond the second card
const backStyle = (d: number) => ({ y: 7 * d, scale: 1 - 0.035 * d });
const EASE = [0.22, 1, 0.36, 1] as const;

type Role = "top" | "next" | "out" | "in";

interface DeckCardProps {
  card: DeckTopic;
  role: Role;
  width: number;
  reduceMotion: boolean;
  draggable: boolean;
  onDragEnd?: (info: PanInfo, releaseX: number) => void;
  onDone?: () => void;
  children: (isTop: boolean) => ReactNode;
}

/**
 * One physical card. Every card owns its own motion values, so a card that leaves the top
 * keeps its own content and position; it is never re-used for another topic.
 * Outer values = deck placement/shuffle animation, inner x = finger drag.
 */
function DeckCard({ card, role, width, reduceMotion, draggable, onDragEnd, onDone, children }: DeckCardProps) {
  const first = useRef(true);
  const s1 = backStyle(1);
  const s2 = backStyle(2);
  const start =
    role === "in" ? { y: s2.y, scale: s2.scale, z: 3 } : role === "next" ? { y: s1.y, scale: s1.scale, z: 5 } : { y: 0, scale: 1, z: 10 };
  const ox = useMotionValue(0);
  const oy = useMotionValue(start.y);
  const os = useMotionValue(start.scale);
  const orot = useMotionValue(0);
  const oz = useMotionValue(start.z);
  const ix = useMotionValue(0);
  const irot = useTransform(ix, [-300, 300], [-10, 10]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const out = width * 1.12;
    let cancelled = false;
    const anims: { stop: () => void }[] = [];
    const go = (mv: any, to: number, duration: number) => {
      const a = animate(mv, to, { duration: reduceMotion ? 0 : duration, ease: EASE as any });
      anims.push(a);
      return a;
    };
    const run = async () => {
      if (role === "top") {
        oz.set(10);
        if (first.current) return;
        go(ox, 0, 0.3); go(oy, 0, 0.3); go(os, 1, 0.3); go(orot, 0, 0.3);
      } else if (role === "next") {
        oz.set(5);
        go(ox, 0, 0.3); go(oy, s1.y, 0.3); go(os, s1.scale, 0.3); go(orot, 0, 0.3);
      } else if (role === "out") {
        // Forward: slide off to the left from wherever the finger released it, then drop behind the deck.
        // Hand the finger offset over to the outer layer and stop the drag's spring-back, so the card
        // continues from exactly where it was released.
        ix.stop();
        ox.set(ox.get() + ix.get());
        orot.set(orot.get() + irot.get());
        ix.set(0);
        oz.set(20);
        await Promise.all([go(ox, -out, 0.2), go(orot, -9, 0.2), go(os, 0.98, 0.2)]);
        if (cancelled) return;
        oz.set(0); // now strictly behind every other card, including the blank back
        await Promise.all([go(ox, 0, 0.28), go(orot, 0, 0.28), go(oy, s2.y, 0.28), go(os, s2.scale, 0.28)]);
        if (!cancelled) doneRef.current?.();
      } else if (role === "in") {
        // Backward: pulled out from under the deck to the right, then laid on top.
        oz.set(3);
        await Promise.all([go(ox, out * 0.92, 0.22), go(orot, 7, 0.22), go(oy, 4, 0.22), go(os, 0.98, 0.22)]);
        if (cancelled) return;
        oz.set(15);
        await Promise.all([go(ox, 0, 0.26), go(orot, 0, 0.26), go(oy, 0, 0.26), go(os, 1, 0.26)]);
        if (!cancelled) doneRef.current?.();
      }
    };
    run();
    first.current = false;
    return () => { cancelled = true; anims.forEach((a) => a.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const isTop = role === "top";
  return (
    <motion.div
      className={isTop ? "absolute inset-0" : "absolute inset-0 pointer-events-none select-none"}
      aria-hidden={isTop ? undefined : true}
      data-deck-card={card.id}
      data-deck-role={role}
      style={{ x: ox, y: oy, scale: os, rotate: orot, zIndex: oz }}
    >
      <motion.div
        className={isTop ? "absolute inset-0 cursor-grab active:cursor-grabbing" : "absolute inset-0"}
        drag={isTop && draggable ? "x" : false}
        dragElastic={0.9}
        dragConstraints={{ left: 0, right: 0 }}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
        onDragEnd={isTop ? (_e, info) => onDragEnd?.(info, ix.get()) : undefined}
        style={{ x: ix, rotate: irot, touchAction: "pan-y" }}
      >
        {children(isTop)}
      </motion.div>
    </motion.div>
  );
}

export default function SwipeableCardStack({ topics, onEmpty, maxWidth = 400, renderBadge, testId }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [forceUnflipSignal, setForceUnflipSignal] = useState(0);
  const [dimensions, setDimensions] = useState(() => getCardDimensions(maxWidth));
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelRef = useRef(0);
  const n = topics.length;

  useEffect(() => {
    const onResize = () => setDimensions(getCardDimensions(maxWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxWidth]);

  useEffect(() => () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); }, []);

  useEffect(() => {
    if (n > 0 && currentIndex >= n) setCurrentIndex(0);
    if (n === 0) onEmpty?.();
  }, [n, currentIndex, onEmpty]);

  const reduceMotion = !!useReducedMotion();
  /** Cards still animating out of / into the top spot. Each is its own element keyed by topic id. */
  const [outgoing, setOutgoing] = useState<{ card: DeckTopic; key: number } | null>(null);
  const [incomingId, setIncomingId] = useState<string | null>(null);
  const keyRef = useRef(0);
  const currentCard = n > 0 ? topics[wrap(currentIndex, n)] : null;
  const nextCard = n > 1 ? topics[wrap(currentIndex + 1, n)] : null;
  const busy = !!outgoing || !!incomingId;

  /** Move through the deck; flips the top card back first if it is showing its back. */
  const step = useCallback((dir: 1 | -1) => {
    if (n < 2 || !currentCard || busy) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const leaving = currentCard;
    const run = () => {
      if (dir === 1) {
        keyRef.current += 1;
        setOutgoing({ card: leaving, key: keyRef.current });
      } else {
        setIncomingId(topics[wrap(currentIndex - 1, n)].id);
      }
      setCurrentIndex((i) => wrap(i + dir, n));
    };
    if (flipped[currentCard.id]) {
      setForceUnflipSignal(Date.now());
      advanceTimerRef.current = setTimeout(run, FLIP_DURATION_MS);
    } else {
      run();
    }
  }, [n, currentCard, flipped, busy, topics, currentIndex]);

  const handleDragEnd = (info: PanInfo) => {
    const { offset, velocity } = info;
    // Drag left = tuck top card under (next), drag right = pull bottom card out on top (previous).
    let dir: 1 | -1 | 0 = 0;
    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) dir = velocity.x < 0 ? 1 : -1;
    else if (offset.x <= -SWIPE_OFFSET_THRESHOLD) dir = 1;
    else if (offset.x >= SWIPE_OFFSET_THRESHOLD) dir = -1;
    if (dir === 0) return; // framer springs the card back to center
    step(dir);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only horizontal wheel/trackpad gestures sift the deck; vertical scrolling keeps scrolling the page.
    if (Math.abs(e.deltaX) < 20 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const now = Date.now();
    if (now - lastWheelRef.current < WHEEL_COOLDOWN_MS) return;
    lastWheelRef.current = now;
    step(e.deltaX > 0 ? 1 : -1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  };

  if (!currentCard) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">No more topics</p>
      </div>
    );
  }

  const { width: cardWidth, height: cardHeight } = dimensions;
  const cardProps = (card: DeckTopic) => ({
    ...card,
    title: card.title,
    description: card.description ?? "",
    categories: card.categories ?? [],
    participantCount: card.participantCount ?? 0,
    opinionsCount: card.opinionsCount ?? 0,
    imageUrl: card.imageUrl ?? "",
    isActive: card.isActive ?? true,
  });

  const backs = BACK_LAYERS.filter((d) => d < n);
  type Entry = { card: DeckTopic; role: Role; key: string };
  const entries: Entry[] = [];
  if (outgoing) entries.push({ card: outgoing.card, role: "out", key: `card-${outgoing.card.id}` });
  if (nextCard && nextCard.id !== currentCard.id && !entries.some((e) => e.card.id === nextCard.id)) {
    entries.push({ card: nextCard, role: "next", key: `card-${nextCard.id}` });
  }
  entries.push({ card: currentCard, role: incomingId === currentCard.id ? "in" : "top", key: `card-${currentCard.id}` });

  return (
    <div
      className="flex flex-col items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      role="region"
      aria-roledescription="card deck"
      aria-label={`Topic deck, card ${wrap(currentIndex, n) + 1} of ${n}`}
      data-testid={testId ?? "card-deck"}
    >
      <div className="relative" style={{ width: cardWidth, height: cardHeight, perspective: 1200 }}>
        {backs.map((d) => {
          const s = backStyle(d);
          return (
            <div
              key={`back-${d}`}
              className="absolute inset-0 pointer-events-none select-none"
              style={{ transform: `translateY(${s.y}px) scale(${s.scale})`, zIndex: 3 - d }}
              aria-hidden
            >
              {/* Plain card back: only the bottom edge shows, no text can bleed through */}
              <div className="w-full h-full rounded-xl border bg-card shadow-md overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5" />
              </div>
            </div>
          );
        })}

        {entries.map(({ card, role, key }) => (
          <DeckCard
            key={key}
            card={card}
            role={role}
            width={cardWidth}
            reduceMotion={reduceMotion}
            draggable={n > 1 && !busy}
            onDragEnd={handleDragEnd}
            onDone={
              role === "out" ? () => setOutgoing(null) : role === "in" ? () => setIncomingId(null) : undefined
            }
          >
            {(isTop) => (
              <>
                <div className={`w-full h-full rounded-xl ${isTop ? "shadow-xl" : "shadow-md overflow-hidden bg-card"}`}>
                  <TopicCard
                    {...cardProps(card)}
                    onFlipChange={isTop ? (f) => setFlipped((p) => ({ ...p, [card.id]: f })) : undefined}
                    forceUnflipSignal={isTop ? forceUnflipSignal : undefined}
                  />
                </div>
                {isTop && renderBadge && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-30 pointer-events-none">
                    {renderBadge(card, wrap(currentIndex, n))}
                  </div>
                )}
              </>
            )}
          </DeckCard>
        ))}
      </div>

      {n > 1 && (
        <div className="flex items-center gap-3 z-20">
          <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => step(-1)} aria-label="Previous card" data-testid="button-deck-prev">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums min-w-[3.5rem] text-center" data-testid="text-deck-position">
            {wrap(currentIndex, n) + 1} / {n}
          </span>
          <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => step(1)} aria-label="Next card" data-testid="button-deck-next">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

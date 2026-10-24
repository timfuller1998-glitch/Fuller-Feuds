import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, useReducedMotion, PanInfo } from "framer-motion";
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
const SHUFFLE_S = 0.46;
const SHUFFLE_EASE = [0.22, 1, 0.36, 1] as const;

type Shuffle = { key: number; card: DeckTopic; dir: 1 | -1; fromX: number; fromRotate: number };

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

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-10, 10]);

  const reduceMotion = useReducedMotion();
  const [shuffle, setShuffle] = useState<Shuffle | null>(null);
  const shuffleKeyRef = useRef(0);
  const currentCard = n > 0 ? topics[wrap(currentIndex, n)] : null;
  const nextCard = n > 1 ? topics[wrap(currentIndex + 1, n)] : null;

  /** Move through the deck; flips the top card back first if it is showing its back. */
  const step = useCallback((dir: 1 | -1, fromX = 0) => {
    if (n < 2 || !currentCard) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const leaving = currentCard;
    const run = () => {
      shuffleKeyRef.current += 1;
      setShuffle({ key: shuffleKeyRef.current, card: leaving, dir, fromX, fromRotate: (fromX / 300) * 10 });
      setCurrentIndex((i) => wrap(i + dir, n));
    };
    if (flipped[currentCard.id]) {
      setForceUnflipSignal(Date.now());
      advanceTimerRef.current = setTimeout(run, FLIP_DURATION_MS);
    } else {
      run();
    }
  }, [n, currentCard, flipped]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const releaseX = x.get();
    // Drag left = tuck top card under (next), drag right = pull bottom card out on top (previous).
    let dir: 1 | -1 | 0 = 0;
    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) dir = velocity.x < 0 ? 1 : -1;
    else if (offset.x <= -SWIPE_OFFSET_THRESHOLD) dir = 1;
    else if (offset.x >= SWIPE_OFFSET_THRESHOLD) dir = -1;
    if (dir === 0) return; // framer springs the card back to center
    const willFlipFirst = !!(currentCard && flipped[currentCard.id]);
    x.set(0);
    step(dir, dir === 1 && !willFlipFirst ? releaseX : 0);
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
  const out = cardWidth * 1.12;
  const t = { duration: reduceMotion ? 0.2 : SHUFFLE_S, ease: SHUFFLE_EASE as any, times: [0, 0.45, 0.55, 1] };
  const sh = shuffle && !reduceMotion ? shuffle : null;

  // Incoming top card motion. Forward: rises from the second slot. Back: slides out from under
  // the deck (behind, z 2) to the right, then lands on top (z 10).
  const topInitial = reduceMotion
    ? { opacity: 0.4 }
    : sh?.dir === -1
      ? { x: 0, y: 14, scale: 0.93, rotate: 0, zIndex: 2, opacity: 1 }
      : sh
        ? { x: 0, y: 7, scale: 0.965, rotate: 0, zIndex: 10, opacity: 1 }
        : false;
  const topAnimate = reduceMotion
    ? { opacity: 1 }
    : sh?.dir === -1
      ? { x: [0, out * 0.92, out * 0.85, 0], y: [14, 4, 0, 0], scale: [0.93, 0.98, 1, 1], rotate: [0, 7, 6, 0], zIndex: [2, 2, 10, 10], opacity: 1 }
      : { x: 0, y: 0, scale: 1, rotate: 0, zIndex: 10, opacity: 1 };
  const topTransition = sh?.dir === -1 ? t : { type: "spring" as const, stiffness: 300, damping: 28 };

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

        {/* Outgoing card: forward = slides out and tucks under the deck; back = sinks to second slot. */}
        {sh && (
          <motion.div
            key={`ghost-${sh.key}`}
            className="absolute inset-0 pointer-events-none select-none"
            aria-hidden
            initial={{ x: sh.fromX, rotate: sh.fromRotate, y: 0, scale: 1, zIndex: sh.dir === 1 ? 20 : 9 }}
            animate={
              sh.dir === 1
                ? { x: [sh.fromX, -out, -out * 0.9, 0], rotate: [sh.fromRotate, -9, -7, 0], rotateY: [0, 14, 10, 0], y: [0, 2, 8, 14], scale: [1, 0.98, 0.95, 0.93], zIndex: [20, 20, 1, 1] }
                : { x: 0, rotate: 0, y: [0, 4, 7, 7], scale: [1, 0.985, 0.97, 0.965], zIndex: [9, 9, 9, 9] }
            }
            transition={t}
            onAnimationComplete={() => setShuffle((cur) => (cur?.key === sh.key ? null : cur))}
          >
            <div className="w-full h-full rounded-xl shadow-lg overflow-hidden bg-card">
              <TopicCard {...cardProps(sh.card)} />
            </div>
          </motion.div>
        )}

        {/* Top + next cards, keyed by topic id so React moves the element (and its content)
            from the second slot to the top instead of swapping content inside a slot. */}
        {[
          { card: nextCard, isTop: false },
          { card: currentCard, isTop: true },
        ].map(({ card, isTop }) => {
          if (!card) return null;
          // The outgoing ghost already shows this card; don't double-render it in the second slot.
          if (!isTop && sh && sh.card.id === card.id) return null;
          if (!isTop && card.id === currentCard.id) return null;
          const s1 = backStyle(1);
          return (
            <motion.div
              key={`card-${card.id}`}
              className={isTop ? "absolute inset-0" : "absolute inset-0 pointer-events-none select-none"}
              aria-hidden={isTop ? undefined : true}
              initial={isTop ? (topInitial as any) : { x: 0, y: s1.y, scale: s1.scale, rotate: 0, zIndex: 5, opacity: 1 }}
              animate={isTop ? (topAnimate as any) : { x: 0, y: s1.y, scale: s1.scale, rotate: 0, zIndex: 5, opacity: 1 }}
              transition={isTop ? (topTransition as any) : { duration: 0.2 }}
              style={{ zIndex: isTop ? 10 : 5 }}
            >
              <motion.div
                className={isTop ? "absolute inset-0 cursor-grab active:cursor-grabbing" : "absolute inset-0"}
                drag={isTop && n > 1 ? "x" : false}
                dragElastic={0.9}
                dragConstraints={{ left: 0, right: 0 }}
                dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
                onDragEnd={isTop ? handleDragEnd : undefined}
                style={isTop ? { x, rotate, touchAction: "pan-y" } : { x: 0, rotate: 0 }}
              >
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
              </motion.div>
            </motion.div>
          );
        })}
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

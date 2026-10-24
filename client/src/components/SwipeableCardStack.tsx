import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
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
 * Cards behind the top card. Offsets > 0 sit to the right (next cards), -1 to the left
 * (previous card). Each is slightly smaller, rotated and covered with a scrim so only
 * the edge "peeks" out and no text bleeds through the top card.
 */
const PEEK_OFFSETS = [-1, 2, 1] as const; // render order: furthest first

const peekStyle = (offset: number, cardWidth: number) => {
  const d = Math.abs(offset);
  const dir = Math.sign(offset);
  return {
    x: dir * cardWidth * (0.07 + 0.05 * (d - 1)),
    y: 6 * d,
    rotate: dir * (3 + 2.5 * (d - 1)),
    scale: 1 - 0.04 * d,
    zIndex: 5 - d,
  };
};

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

  const currentCard = n > 0 ? topics[wrap(currentIndex, n)] : null;

  /** Move through the deck; flips the top card back first if it is showing its back. */
  const step = useCallback((dir: 1 | -1) => {
    if (n < 2 || !currentCard) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const run = () => setCurrentIndex((i) => wrap(i + dir, n));
    if (flipped[currentCard.id]) {
      setForceUnflipSignal(Date.now());
      advanceTimerRef.current = setTimeout(run, FLIP_DURATION_MS);
    } else {
      run();
    }
  }, [n, currentCard, flipped]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    x.set(0);
    // Drag left = next card (like sliding the top card off the deck), right = previous.
    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) step(velocity.x < 0 ? 1 : -1);
    else if (offset.x <= -SWIPE_OFFSET_THRESHOLD) step(1);
    else if (offset.x >= SWIPE_OFFSET_THRESHOLD) step(-1);
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

  const peeks = PEEK_OFFSETS.filter((o) => (o === -1 ? n >= 3 : o < n));

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
      <div className="relative" style={{ width: cardWidth, height: cardHeight }}>
        {peeks.map((offset) => {
          const card = topics[wrap(currentIndex + offset, n)];
          const s = peekStyle(offset, cardWidth);
          return (
            <motion.div
              key={`peek-${card.id}-${offset}`}
              className="absolute inset-0 pointer-events-none select-none"
              initial={false}
              animate={{ x: s.x, y: s.y, rotate: s.rotate, scale: s.scale }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              style={{ zIndex: s.zIndex }}
              aria-hidden
            >
              {/* Plain card back: only the edge peeks out, so no text can bleed through or look garbled */}
              <div className="w-full h-full rounded-xl border bg-card shadow-md overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5" />
              </div>
            </motion.div>
          );
        })}

        <motion.div
          key={`top-${currentCard.id}-${currentIndex}`}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          drag={n > 1 ? "x" : false}
          dragElastic={0.12}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.96, y: 6, opacity: 0.6 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          style={{ x, rotate, zIndex: 10 }}
        >
          <div className="w-full h-full shadow-xl rounded-xl">
            <TopicCard
              {...cardProps(currentCard)}
              onFlipChange={(f) => setFlipped((p) => ({ ...p, [currentCard.id]: f }))}
              forceUnflipSignal={forceUnflipSignal}
            />
          </div>
          {renderBadge && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-30 pointer-events-none">
              {renderBadge(currentCard, wrap(currentIndex, n))}
            </div>
          )}
        </motion.div>
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

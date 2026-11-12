import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, animate, useMotionValue, useTransform, useReducedMotion, PanInfo, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Generic physical card deck: overlapping cards, tap-to-flip, and a shuffle where the top
 * card tucks to the bottom while the next card (its own element, keyed by getKey) is revealed.
 * Reusable for topics, opinions, counterpoints, etc.
 */

const FLIP_DURATION_MS = 600;
const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
const WHEEL_COOLDOWN_MS = 450;

/** Passed to face renderers. Self-flipping cards can use onFlipChange/forceUnflipSignal instead of renderBack. */
export interface CardFaceContext {
  isTop: boolean;
  index: number;
  flipped: boolean;
  setFlipped: (flipped: boolean) => void;
  onFlipChange?: (flipped: boolean) => void;
  forceUnflipSignal?: number;
}

export interface CardDeckProps<T> {
  items: T[];
  getKey: (item: T) => string;
  /** Front face. If renderBack is omitted, this renders the whole card (which may flip itself). */
  renderFront: (item: T, ctx: CardFaceContext) => ReactNode;
  /** Back face. When given, the deck owns the flip: tapping the card toggles front/back. */
  renderBack?: (item: T, ctx: CardFaceContext) => ReactNode;
  onEmpty?: () => void;
  /** Max card width in px (default 400). */
  maxWidth?: number;
  /** Optional overlay (e.g. trending rank) rendered on the top card. */
  renderBadge?: (item: T, index: number) => ReactNode;
  testId?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  /** Called with the index of the item on top whenever it changes. */
  onIndexChange?: (index: number, item: T) => void;
  /** Index of the card shown on top when the deck mounts. */
  initialIndex?: number;
}

/** Built-in 3D flip used when the deck owns the flip (renderBack provided). */
function FlipFaces({ flipped, onToggle, front, back }: { flipped: boolean; onToggle: () => void; front: ReactNode; back: ReactNode }) {
  const face = (rot: number, visible: boolean): React.CSSProperties => ({
    transform: `rotateY(${rot}deg)`, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transition: "opacity 0.6s ease-in-out",
  });
  return (
    <div className="relative w-full h-full" style={{ perspective: "1000px" }}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a, [role="button"]')) onToggle(); }}>
      <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", transition: `transform ${FLIP_DURATION_MS}ms ease-in-out` }}>
        <div className="absolute inset-0" style={face(0, !flipped)}>{front}</div>
        <div className="absolute inset-0" style={face(180, flipped)}>{back}</div>
      </div>
    </div>
  );
}

const getCardDimensions = (maxWidth: number) => {
  let width = Math.min(window.innerWidth - 34, maxWidth); // 17px gutter each side
  let height = (width * 7) / 5; // 5:7 playing-card ratio
  // On short screens, cap by viewport height (header, page title, deck controls and the
  // footer take ~290px) so the whole deck fits above the footer instead of being clipped.
  const maxHeight = Math.max(300, window.innerHeight - 290);
  if (height > maxHeight) { height = maxHeight; width = (height * 5) / 7; }
  return { width, height };
};

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
// Phone-only: while the bottom card is pulled out, the rest of the pile shifts left and
// shrinks with the top card so no deeper card is uncovered beside the incoming one.
const NUDGE_X = 0.22;
const NUDGE_SCALE = 0.05;
const nudgeProgress = (pull: number, width: number) => Math.min(Math.max(pull, 0) / (width * 0.55), 1);
const pullTargetFor = (width: number, narrow: boolean) => (narrow ? width * 0.55 : width * 1.12 * 0.92);
const applyNudge = (ox: MotionValue<number>, os: MotionValue<number>, pull: number, width: number, baseScale: number) => {
  const f = nudgeProgress(pull, width);
  ox.set(-f * NUDGE_X * width);
  os.set(baseScale * (1 - f * NUDGE_SCALE));
};
const liftProgress = (lift: number, width: number) => Math.min(Math.max(lift, 0) / (width * 0.45), 1);
/** Remaining pile on a forward swipe: shifts right (opposite the departing top card) by the same amount as the back-swipe top nudge, plus rise/scale into the next slot. */
const applyLift = (
  ox: MotionValue<number>,
  oy: MotionValue<number>,
  os: MotionValue<number>,
  lift: number,
  width: number,
  fromY: number,
  fromScale: number,
  toY = 0,
  toScale = 1,
) => {
  const p = liftProgress(lift, width);
  ox.set(p * NUDGE_X * width);
  oy.set(fromY + (toY - fromY) * p);
  os.set(fromScale + (toScale - fromScale) * p);
};
const followLift = (
  lift: MotionValue<number>,
  ox: MotionValue<number>,
  oy: MotionValue<number>,
  os: MotionValue<number>,
  width: number,
  fromY: number,
  fromScale: number,
  anims: { stop: () => void }[],
  shouldSkip?: () => boolean,
  toY = 0,
  toScale = 1,
) => {
  const apply = (v: number) => {
    if (shouldSkip?.()) return;
    applyLift(ox, oy, os, v, width, fromY, fromScale, toY, toScale);
  };
  let lifting = lift.get() > 2;
  if (lifting) apply(lift.get());
  const unsub = lift.on("change", (v) => {
    if (v > 2) { lifting = true; apply(v); }
    else if (lifting) { lifting = false; apply(0); }
  });
  anims.push({ stop: unsub });
  return lifting;
};
/** Follow an active back-swipe pull without applying a 0-pull on subscribe (that would cancel a settle animation). */
const followNudge = (
  pull: MotionValue<number>,
  ox: MotionValue<number>,
  os: MotionValue<number>,
  width: number,
  baseScale: number,
  anims: { stop: () => void }[],
) => {
  let nudging = pull.get() > 2;
  const apply = (v: number) => applyNudge(ox, os, v, width, baseScale);
  if (nudging) apply(pull.get());
  const unsub = pull.on("change", (v) => {
    if (v > 2) { nudging = true; apply(v); }
    else if (nudging) { nudging = false; apply(0); }
  });
  anims.push({ stop: unsub });
  return nudging;
};

type Role = "top" | "next" | "out" | "in" | "peek";

interface DeckCardProps {
  cardKey: string;
  role: Role;
  width: number;
  reduceMotion: boolean;
  draggable: boolean;
  onDragEnd?: (info: PanInfo, releaseX: number) => void;
  onDrag?: (info: PanInfo) => void;
  /** Rightward drag distance; the bottom ("peek") card emerges from behind the deck by this much. */
  pull?: MotionValue<number>;
  /** Freshly mounted "next" card during a forward swipe: start at the back and rise into the 2nd slot. */
  enterFromBack?: boolean;
  /** Leftward drag distance; the rest of the pile rises/settles forward by this much. */
  lift?: MotionValue<number>;
  onDone?: () => void;
  children: (isTop: boolean) => ReactNode;
}

/**
 * One physical card. Every card owns its own motion values, so a card that leaves the top
 * keeps its own content and position; it is never re-used for another topic.
 * Outer values = deck placement/shuffle animation, inner x = finger drag.
 */
function DeckCard({ cardKey, role, width, reduceMotion, draggable, onDragEnd, onDrag, pull, lift, enterFromBack, onDone, children }: DeckCardProps) {
  const first = useRef(true);
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const s1 = backStyle(1);
  const s2 = backStyle(2);
  const start =
    role === "in" || role === "peek"
      ? { y: s2.y, scale: s2.scale, z: role === "peek" ? 0 : 3 }
      : role === "next" && enterFromBack
      ? { x: NUDGE_X * width, y: backStyle(2.6).y, scale: backStyle(2.6).scale, z: 2 }
      : role === "next" ? { y: s1.y, scale: s1.scale, z: 5 }
      : { y: 0, scale: 1, z: 10 };
  const ox = useMotionValue(role === "next" && enterFromBack ? NUDGE_X * width : 0);
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
    // How far the bottom card is pulled out on a backward move. On phones keep it partly on screen.
    const pullTarget = narrow ? width * 0.55 : out * 0.92;
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
        // Phones: while the bottom card is being pulled out to the right, nudge the top card left and
        // shrink it a touch so the emerging card is clearly visible. Deeper cards follow this same
        // nudge so they stay tucked under the top card and never peek out beside the incoming one.
        const topNudging = pull && narrow ? followNudge(pull, ox, os, width, 1, anims) : false;
        if (first.current) return;
        if (!topNudging) {
          // Button/key forward starts at rest (x=0). Give the new top the same right
          // offset a finished forward drag would have (out of the departing card's way),
          // then settle to center, so the motion is as visible as the back-swipe nudge.
          if (Math.abs(ox.get()) < 2) ox.set(NUDGE_X * width);
          go(ox, 0, 0.32); go(os, 1, 0.32);
        }
        go(oy, 0, 0.32); go(orot, 0, 0.32);
      } else if (role === "next") {
        // A card that was just on top (backward swipe) sinks to the next slot from wherever the finger
        // released it: hand the drag offset to the outer layer so it never springs back first.
        if (ix.get() !== 0) {
          ix.stop();
          ox.set(ox.get() + ix.get());
          orot.set(orot.get() + irot.get());
          ix.set(0);
        }
        oz.set(5);
        go(oy, s1.y, 0.3); go(orot, 0, 0.3);
        // Stay tucked under the top card during a back-swipe nudge; otherwise settle into the 2nd slot
        // (rising from the back when this card just mounted during a forward swipe).
        if (pull && narrow) {
          const nudging = followNudge(pull, ox, os, width, s1.scale, anims);
          if (!nudging) { go(ox, 0, 0.3); go(os, s1.scale, 0.3); }
        } else {
          go(ox, 0, 0.3); go(os, s1.scale, 0.3);
        }
        // Forward swipe: as the top card is dragged left, the rest of the pile shifts
        // right (out of its way) by the same amount as the back-swipe top nudge, and this
        // card rises/scales into the top slot.
        if (lift) {
          followLift(lift, ox, oy, os, width, s1.y, s1.scale, anims, () => !!(pull && pull.get() > 2));
        }
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
      } else if (role === "peek") {
        // Bottom card hidden behind the plain backs; a rightward drag slides it out from behind.
        oz.set(0); oy.set(s2.y); os.set(s2.scale);
        if (pull) {
          const follow = (v: number) => {
            oz.set(v > 2 ? 6 : 0); // above the 2nd card while emerging, hidden behind the backs at rest
            ox.set(Math.min(Math.max(v, 0) * 0.9, pullTarget)); orot.set(Math.min(Math.max(v, 0), 300) / 300 * 7); };
          follow(pull.get());
          const unsub = pull.on("change", follow);
          anims.push({ stop: unsub });
        }
        // Stay tucked behind the blank backs when those backs shift right on a forward swipe.
        if (lift) {
          const apply = (v: number) => {
            if (pull && pull.get() > 2) return;
            ox.set(liftProgress(v, width) * NUDGE_X * width);
          };
          let lifting = lift.get() > 2;
          if (lifting) apply(lift.get());
          const unsub = lift.on("change", (v) => {
            if (v > 2) { lifting = true; apply(v); }
            else if (lifting) { lifting = false; apply(0); }
          });
          anims.push({ stop: unsub });
        }
      } else if (role === "in") {
        // Backward (mirror of forward): the bottom card is pulled out from BEHIND the deck to the right
        // (continuing from wherever the finger's pull left it), then laid over the top card, which only
        // sinks one step down. The top card never slides away, so the 2nd card is never uncovered.
        oz.set(6);
        const target = pullTarget;
        const left = Math.max(0, target - ox.get());
        const d1 = Math.max(0.1, 0.22 * (left / target));
        await Promise.all([go(ox, target, d1), go(orot, 7, d1), go(oy, 4, d1), go(os, 0.98, d1)]);
        if (cancelled) return;
        oz.set(15);
        // Release the pile's back-swipe nudge as this card lands, so deeper cards ease back with it.
        if (pull) go(pull, 0, 0.28);
        await Promise.all([go(ox, 0, 0.28), go(orot, 0, 0.28), go(oy, 0, 0.28), go(os, 1, 0.28)]);
        if (cancelled) return;
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
      data-deck-card={cardKey}
      data-deck-role={role}
      style={{ x: ox, y: oy, scale: os, rotate: orot, zIndex: oz }}
    >
      <motion.div
        className={isTop ? "absolute inset-0 cursor-grab active:cursor-grabbing" : "absolute inset-0"}
        drag={isTop && draggable ? "x" : false}
        // Rightward drags must not move the top card (that would uncover the 2nd card); they pull the bottom card out instead.
        dragElastic={{ left: 0.9, right: 0, top: 0, bottom: 0 }}
        dragConstraints={{ left: 0, right: 0 }}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
        onDrag={isTop ? (_e, info) => onDrag?.(info) : undefined}
        onDragEnd={isTop ? (_e, info) => onDragEnd?.(info, ix.get()) : undefined}
        style={{ x: ix, rotate: irot, touchAction: "pan-y" }}
      >
        {children(isTop)}
      </motion.div>
    </motion.div>
  );
}

/** Plain card back under the face cards. Follows the back-swipe nudge and, on a forward swipe, settles up from one layer deeper. */
function DeckBack({ depth, width, narrow, pull, lift, settleToken, reduceMotion }: {
  depth: number;
  width: number;
  narrow: boolean;
  pull: MotionValue<number>;
  lift: MotionValue<number>;
  settleToken: number;
  reduceMotion: boolean;
}) {
  const s = backStyle(depth);
  const deeper = backStyle(depth + 1);
  const ox = useMotionValue(0);
  const oy = useMotionValue(s.y);
  const os = useMotionValue(s.scale);

  useEffect(() => {
    if (!settleToken) return;
    oy.set(deeper.y);
    os.set(deeper.scale);
    const a0 = animate(ox, 0, { duration: reduceMotion ? 0 : 0.3, ease: EASE as any });
    const a1 = animate(oy, s.y, { duration: reduceMotion ? 0 : 0.3, ease: EASE as any });
    const a2 = animate(os, s.scale, { duration: reduceMotion ? 0 : 0.3, ease: EASE as any });
    return () => { a0.stop(); a1.stop(); a2.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleToken]);

  useEffect(() => {
    if (!narrow) return;
    const anims: { stop: () => void }[] = [];
    followNudge(pull, ox, os, width, s.scale, anims);
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow, width, pull]);

  useEffect(() => {
    const to = backStyle(Math.max(0, depth - 1));
    const anims: { stop: () => void }[] = [];
    followLift(lift, ox, oy, os, width, s.y, s.scale, anims, () => !!(settleToken || pull.get() > 2), to.y, to.scale);
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, lift, pull, settleToken]);

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ x: ox, y: oy, scale: os, zIndex: 3 - depth }}
      aria-hidden
    >
      <div className="w-full h-full rounded-xl border bg-card shadow-md overflow-hidden deck-card-surface">
        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5 dark:from-foreground/[0.04] dark:via-transparent dark:to-foreground/[0.02]" />
      </div>
    </motion.div>
  );
}

export default function CardDeck<T>({
  items, getKey, renderFront, renderBack, onEmpty, maxWidth = 400, renderBadge, testId,
  emptyLabel = "No more topics", ariaLabel = "Topic deck", onIndexChange, initialIndex = 0,
}: CardDeckProps<T>) {
  const topics = items;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
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

  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  useEffect(() => {
    if (n > 0) onIndexChangeRef.current?.(wrap(currentIndex, n), topics[wrap(currentIndex, n)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, n]);

  const reduceMotion = !!useReducedMotion();
  /** Cards still animating out of / into the top spot. Each is its own element keyed by topic id. */
  const [outgoing, setOutgoing] = useState<{ card: T; key: number } | null>(null);
  const [incomingId, setIncomingId] = useState<string | null>(null);
  const keyRef = useRef(0);
  const currentCard = n > 0 ? topics[wrap(currentIndex, n)] : null;
  const nextCard = n > 1 ? topics[wrap(currentIndex + 1, n)] : null;
  const busy = !!outgoing || !!incomingId;
  const pull = useMotionValue(0);
  const lift = useMotionValue(0);
  const prevCard = n > 2 ? topics[wrap(currentIndex - 1, n)] : null;

  useEffect(() => {
    if (outgoing) lift.set(0);
  }, [outgoing, lift]);

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
        setIncomingId(getKey(topics[wrap(currentIndex - 1, n)]));
        // Buttons, keys, and the wheel don't drag, so drive the same pull the finger would:
        // the top card and the rest of the pile nudge together while the bottom card comes out.
        if (!reduceMotion && pull.get() < 2) {
          const narrow = window.innerWidth < 640;
          animate(pull, pullTargetFor(dimensions.width, narrow), { duration: 0.2, ease: EASE as any });
        }
      }
      setCurrentIndex((i) => wrap(i + dir, n));
    };
    if (flipped[getKey(currentCard)]) {
      setForceUnflipSignal(Date.now());
      advanceTimerRef.current = setTimeout(run, FLIP_DURATION_MS);
    } else {
      run();
    }
  }, [n, currentCard, flipped, busy, topics, currentIndex, getKey, reduceMotion, pull, dimensions.width]);

  const handleDragEnd = (info: PanInfo) => {
    const { offset, velocity } = info;
    // Drag left = tuck top card under (next), drag right = pull bottom card out on top (previous).
    let dir: 1 | -1 | 0 = 0;
    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) dir = velocity.x < 0 ? 1 : -1;
    else if (offset.x <= -SWIPE_OFFSET_THRESHOLD) dir = 1;
    else if (offset.x >= SWIPE_OFFSET_THRESHOLD) dir = -1;
    if (dir !== -1 && pull.get() > 2) animate(pull, 0, { duration: 0.2 });
    if (dir !== 1 && lift.get() > 2) animate(lift, 0, { duration: 0.2 });
    // On a committed forward swipe, leave lift as-is until the next render unsubscribes
    // followers (the rising card becomes "top" and keeps its mid-lift position).
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
    // Conventional keys: → next, ← previous. (Swipes stay physical: swipe left = next, swipe right = previous.)
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  };

  if (!currentCard) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const { width: cardWidth, height: cardHeight } = dimensions;
  const renderFace = (card: T, isTop: boolean) => {
    const id = getKey(card);
    const ctx: CardFaceContext = {
      isTop,
      index: wrap(currentIndex, n),
      flipped: isTop ? !!flipped[id] : false,
      setFlipped: (f) => { if (isTop) setFlipped((p) => ({ ...p, [id]: f })); },
      onFlipChange: isTop ? (f) => setFlipped((p) => ({ ...p, [id]: f })) : undefined,
      forceUnflipSignal: isTop ? forceUnflipSignal : undefined,
    };
    if (!renderBack) return renderFront(card, ctx);
    return <FlipFaces flipped={ctx.flipped} onToggle={() => ctx.setFlipped(!ctx.flipped)} front={renderFront(card, ctx)} back={renderBack(card, ctx)} />;
  };

  const backs = BACK_LAYERS.filter((d) => d < n);
  type Entry = { card: T; role: Role; key: string };
  const entries: Entry[] = [];
  if (outgoing) entries.push({ card: outgoing.card, role: "out", key: `card-${getKey(outgoing.card)}` });
  if (nextCard && getKey(nextCard) !== getKey(currentCard) && !entries.some((e) => getKey(e.card) === getKey(nextCard))) {
    entries.push({ card: nextCard, role: "next", key: `card-${getKey(nextCard)}` });
  }
  if (!busy && prevCard && getKey(prevCard) !== getKey(currentCard) && !entries.some((e) => getKey(e.card) === getKey(prevCard))) {
    entries.unshift({ card: prevCard, role: "peek", key: `card-${getKey(prevCard)}` });
  }
  entries.push({ card: currentCard, role: incomingId === getKey(currentCard) ? "in" : "top", key: `card-${getKey(currentCard)}` });

  return (
    <div
      className="flex flex-col items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      role="region"
      aria-roledescription="card deck"
      aria-label={`${ariaLabel}, card ${wrap(currentIndex, n) + 1} of ${n}`}
      data-testid={testId ?? "card-deck"}
    >
      <div className="relative" style={{ width: cardWidth, height: cardHeight, perspective: 1200 }}>
        {backs.map((d) => (
          <DeckBack
            key={`back-${d}`}
            depth={d}
            width={cardWidth}
            narrow={typeof window !== "undefined" && window.innerWidth < 640}
            pull={pull}
            lift={lift}
            settleToken={outgoing?.key ?? 0}
            reduceMotion={reduceMotion}
          />
        ))}

        {entries.map(({ card, role, key }) => (
          <DeckCard
            key={key}
            cardKey={getKey(card)}
            role={role}
            width={cardWidth}
            reduceMotion={reduceMotion}
            draggable={n > 1 && !busy}
            onDragEnd={handleDragEnd}
            onDrag={(info) => {
              pull.set(Math.max(0, info.offset.x));
              lift.set(Math.max(0, -info.offset.x));
            }}
            pull={role === "peek" || role === "top" || role === "next" || role === "in" ? pull : undefined}
            lift={(role === "next" && !outgoing) || role === "peek" ? lift : undefined}
            enterFromBack={role === "next" && !!outgoing}
            onDone={
              role === "out" ? () => setOutgoing(null) : role === "in" ? () => { pull.set(0); setIncomingId(null); } : undefined
            }
          >
            {(isTop) => (
              <>
                <div className={`w-full h-full rounded-xl deck-card-surface ${isTop ? "shadow-xl" : "shadow-md overflow-hidden bg-card"}`}>
                  {renderFace(card, isTop)}
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
          {/* Conventional buttons: ‹ previous on the left, › next on the right. */}
          <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => step(-1)} aria-label="Previous card" title="Previous card" data-testid="button-deck-prev">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums min-w-[3.5rem] text-center" data-testid="text-deck-position">
            {wrap(currentIndex, n) + 1} / {n}
          </span>
          <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => step(1)} aria-label="Next card" title="Next card" data-testid="button-deck-next">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

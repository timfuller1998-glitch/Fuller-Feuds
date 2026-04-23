import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo, useMotionValueEvent } from "framer-motion";
import TopicCard from "./TopicCard";
import type { TopicWithCounts } from "@shared/schema";

const FLIP_DURATION_MS = 600;

// Calculate card dimensions based on viewport
const getCardDimensions = () => {
  const maxWidth = 400;
  const raw = window.innerWidth - 34;
  const width = Math.max(1, Math.min(Math.max(raw, 0), maxWidth));
  const height = (width * 7) / 5;
  return { width, height };
};

interface SwipeableCardStackProps {
  topics: TopicWithCounts[];
  onEmpty?: () => void;
}

interface CardState {
  isFlipped: boolean;
  timeOnBackMs: number;
}

const getCardAtOffset = (topics: TopicWithCounts[], currentIndex: number, offset: number): TopicWithCounts | null => {
  if (topics.length === 0) return null;
  const index = (currentIndex + offset + topics.length) % topics.length;
  return topics[index];
};

// Resting translate for side cards (fraction of width)
const SIDE_OFFSET_FRAC = 0.25;
const FOLLOW = 0.5;
const BACK_SCALE = 0.88;
/** Back cards at rest: 90% opacity → 100% as they move toward center with the drag */
const BACK_OPACITY_REST = 0.9;
const BACK_OPACITY_FULL = 1;
/** At rest: current on top, left peek above right */
const Z_BACK = 2;
const Z_BACK_REST_LEAD = 3;
const Z_PASS_OVER = 6;
const Z_CURRENT = 5;
const Z_CURRENT_WHILE_DRAG = 3;

const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
/** 3D hinge at full drag (|x| = max). Tilts while sliding; useTransform from x. */
const COMMIT_TWIST_DEG = 28;
/** Post-release: peek floats to center, old front tucks to the side; new peek fades in. */
const FLOAT_TO_REST_S = 0.5;
const FLOAT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const NEW_PEEK_FADE_IN_END = 0.14;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const tiltTAt = (v: number, m: number) => {
  if (m < 1) return 0;
  return Math.min(1, Math.abs(v) / m) * COMMIT_TWIST_DEG;
};

/** Matches tiltPrev / tiltFront / tiltNext at release position `v`. */
function rotationTripletAt(v: number, m: number) {
  const c = tiltTAt(v, m);
  if (v > 0) return { p: c, f: -c, n: 0 } as const;
  if (v < 0) return { p: 0, f: c, n: -c } as const;
  return { p: 0, f: 0, n: 0 } as const;
}

type FloatState =
  | { mode: "none" }
  | {
      mode: "toPrev" | "toNext";
      fromX: number;
      cw: number;
      m: number;
      rPrev0: number;
      rCurr0: number;
      rNext0: number;
    };

export default function SwipeableCardStack({ topics, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());
  const [forceUnflipSignal, setForceUnflipSignal] = useState(0);
  const [dimensions, setDimensions] = useState(getCardDimensions());
  const [isCommitting, setIsCommitting] = useState(false);
  const advanceAfterUnflipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, skip x.set(0) on currentIndex change — float handoff controls x. */
  const suppressIndexXResetRef = useRef(false);
  const cardWRef = useRef(dimensions.width);
  const currentHingeRef = useRef<HTMLDivElement | null>(null);
  /** Drives useTransform recompute when width changes; refs alone are not reactive. */
  const stackWidth = useMotionValue(Math.max(1, dimensions.width));

  const x = useMotionValue(0);
  /** After index change: brief vertical spring so the new top card settles to center */
  const revealY = useMotionValue(0);
  /** 0→1 while cards float to their resting roles after a commit */
  const floatU = useMotionValue(0);
  const floatStateRef = useRef<FloatState>({ mode: "none" });

  // Drag +x: left peek; -x: right peek. During float, positions come from [floatU, floatStateRef] only.
  const maxDragForNorm = useRef(200);
  const mNow = () => maxDragForNorm.current;

  const bL = (cw: number) => -cw * SIDE_OFFSET_FRAC;
  const bR = (cw: number) => cw * SIDE_OFFSET_FRAC;
  const prevXIdle = (xv: number, cw: number) => {
    const b = bL(cw);
    if (xv > 0) return b + xv * FOLLOW;
    return b;
  };
  const nextXIdle = (xv: number, cw: number) => {
    const b = bR(cw);
    if (xv < 0) return b + xv * FOLLOW;
    return b;
  };
  const prevScaleIdle = (xv: number) => {
    if (xv < 0) return BACK_SCALE;
    const t = Math.min(1, xv / mNow());
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  };
  const nextScaleIdle = (xv: number) => {
    if (xv > 0) return BACK_SCALE;
    const t = Math.min(1, -xv / mNow());
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  };
  const prevOpacityIdle = (xv: number) => {
    if (xv < 0) return 0;
    if (xv === 0) return BACK_OPACITY_REST;
    const t = Math.min(1, xv / mNow());
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  };
  const nextOpacityIdle = (xv: number) => {
    if (xv > 0) return 0;
    if (xv === 0) return BACK_OPACITY_REST;
    const t = Math.min(1, -xv / mNow());
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  };
  const tiltT = (v: number) => tiltTAt(v, mNow());
  const tiltFrontIdle = (v: number) => {
    if (v > 0) return -tiltT(v);
    if (v < 0) return tiltT(v);
    return 0;
  };
  const tiltPrevIdle = (v: number) => (v > 0 ? tiltT(v) : 0);
  const tiltNextIdle = (v: number) => (v < 0 ? -tiltT(v) : 0);

  // Peeks: use stackWidth in useTransform so idle offsets update when width changes (not only on x).
  // The draggable CENTER must use raw `x` in style (see return) so Framer drag works.
  const slotPrevX = useTransform([x, floatU, stackWidth], (xv, u, w) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return bL(s.cw);
    }
    if (s.mode === "toNext") {
      return lerp(s.fromX, bL(s.cw), easeOutCubic(u));
    }
    return prevXIdle(xv, w);
  });
  const slotNextX = useTransform([x, floatU, stackWidth], (xv, u, w) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return lerp(s.fromX, bR(s.cw), easeOutCubic(u));
    }
    if (s.mode === "toNext") {
      return bR(s.cw);
    }
    return nextXIdle(xv, w);
  });

  const slotPrevScale = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return BACK_SCALE;
    }
    if (s.mode === "toNext") {
      return lerp(1, BACK_SCALE, easeOutCubic(u));
    }
    return prevScaleIdle(xv);
  });
  const slotCurrScale = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return lerp(prevScaleIdle(s.fromX), 1, easeOutCubic(u));
    }
    if (s.mode === "toNext") {
      return lerp(nextScaleIdle(s.fromX), 1, easeOutCubic(u));
    }
    return 1;
  });
  const slotNextScale = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return lerp(1, BACK_SCALE, easeOutCubic(u));
    }
    if (s.mode === "toNext") {
      return BACK_SCALE;
    }
    return nextScaleIdle(xv);
  });

  const newPeekOpacity = (u: number) => (u < 1e-6 ? 0 : Math.min(1, u / NEW_PEEK_FADE_IN_END) * BACK_OPACITY_REST);
  const slotPrevOpacity = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return newPeekOpacity(u);
    }
    if (s.mode === "toNext") {
      return lerp(1, BACK_OPACITY_REST, easeOutCubic(u));
    }
    return prevOpacityIdle(xv);
  });
  const slotCurrOpacity = useTransform([x, floatU], () => 1);
  const slotNextOpacity = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return lerp(1, BACK_OPACITY_REST, easeOutCubic(u));
    }
    if (s.mode === "toNext") {
      return newPeekOpacity(u);
    }
    return nextOpacityIdle(xv);
  });

  const slotPrevRY = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return 0;
    }
    if (s.mode === "toNext") {
      return lerp(s.rPrev0, 0, easeOutCubic(u));
    }
    return tiltPrevIdle(xv);
  });
  const slotCurrRY = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev" || s.mode === "toNext") {
      return lerp(s.rCurr0, 0, easeOutCubic(u));
    }
    return tiltFrontIdle(xv);
  });
  const slotNextRY = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return lerp(s.rNext0, 0, easeOutCubic(u));
    }
    if (s.mode === "toNext") {
      return 0;
    }
    return tiltNextIdle(xv);
  });

  const slotPrevPointer = useTransform([x, floatU], (xv) => (floatStateRef.current.mode !== "none" ? "auto" : xv < 0 ? "none" : "auto"));
  const slotNextPointer = useTransform([x, floatU], (xv) => (floatStateRef.current.mode !== "none" ? "auto" : xv > 0 ? "none" : "auto"));

  const slotPrevZ = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return u < 0.01 ? 0 : Z_BACK;
    }
    if (s.mode === "toNext") {
      return Z_CURRENT_WHILE_DRAG;
    }
    return xv < 0 ? 0 : xv > 0 ? Z_PASS_OVER : Z_BACK_REST_LEAD;
  });
  const slotCurrZ = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev" || s.mode === "toNext") {
      return 8;
    }
    return Math.abs(xv) < 0.5 ? Z_CURRENT : Z_CURRENT_WHILE_DRAG;
  });
  const slotNextZ = useTransform([x, floatU], (xv, u) => {
    const s = floatStateRef.current;
    if (s.mode === "toPrev") {
      return Z_CURRENT_WHILE_DRAG;
    }
    if (s.mode === "toNext") {
      return u < 0.01 ? 0 : Z_BACK;
    }
    return xv > 0 ? 0 : xv < 0 ? Z_PASS_OVER : Z_BACK;
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions(getCardDimensions());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useLayoutEffect(() => {
    const w = Math.max(1, dimensions.width);
    stackWidth.set(w);
    cardWRef.current = w;
    maxDragForNorm.current = Math.min(220, w * 0.55);
  }, [dimensions.width]);

  useEffect(() => {
    return () => {
      if (advanceAfterUnflipRef.current) {
        clearTimeout(advanceAfterUnflipRef.current);
      }
    };
  }, []);

  // Reset drag when the active card index changes (unless a float handoff is driving `x`).
  useEffect(() => {
    if (suppressIndexXResetRef.current) return;
    x.set(0);
  }, [currentIndex, x]);

  // Hinge the front card from the edge toward the neighbor (door past the other card)
  useMotionValueEvent(x, "change", (v) => {
    if (floatStateRef.current.mode !== "none") return;
    const el = currentHingeRef.current;
    if (!el) return;
    el.style.transformOrigin = v >= 0 ? "100% 50%" : "0% 50%";
  });

  useLayoutEffect(() => {
    const el = currentHingeRef.current;
    if (!el) return;
    // After a commit, `x` is 0: hinge from the right edge (positive drag direction) by default
    el.style.transformOrigin = "100% 50%";
  }, [currentIndex]);

  const prev1Card = getCardAtOffset(topics, currentIndex, -1);
  const currentCard = getCardAtOffset(topics, currentIndex, 0);
  const next1Card = getCardAtOffset(topics, currentIndex, 1);

  const handleFlipChange = (topicId: string, isFlipped: boolean) => {
    setCardStates((prev) => {
      const newMap = new Map(prev);
      const currentState = newMap.get(topicId) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(topicId, { ...currentState, isFlipped });
      return newMap;
    });
  };

  const handleBackTimeUpdate = (topicId: string, timeMs: number) => {
    setCardStates((prev) => {
      const newMap = new Map(prev);
      const currentState = newMap.get(topicId) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(topicId, { ...currentState, timeOnBackMs: timeMs });
      return newMap;
    });
  };

  const clearAdvanceTimer = useCallback(() => {
    if (advanceAfterUnflipRef.current) {
      clearTimeout(advanceAfterUnflipRef.current);
      advanceAfterUnflipRef.current = null;
    }
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + topics.length) % topics.length);
  }, [topics.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % topics.length);
  }, [topics.length]);

  const finishCommit = useCallback(
    async (dir: "next" | "prev") => {
      if (topics.length < 2) {
        if (dir === "next") goToNext();
        else goToPrev();
        return;
      }
      const m = maxDragForNorm.current;
      if (m < 1) {
        if (dir === "next") goToNext();
        else goToPrev();
        return;
      }
      const fromX = x.get();
      const cw = Math.max(1, cardWRef.current);
      const rots = rotationTripletAt(fromX, m);
      const floatOpts = { duration: FLOAT_TO_REST_S, ease: FLOAT_EASE };
      setIsCommitting(true);
      suppressIndexXResetRef.current = true;
      if (dir === "prev") {
        goToPrev();
        floatStateRef.current = {
          mode: "toPrev",
          fromX,
          cw,
          m,
          rPrev0: 0,
          rCurr0: rots.p,
          rNext0: rots.f,
        };
      } else {
        goToNext();
        floatStateRef.current = {
          mode: "toNext",
          fromX,
          cw,
          m,
          rPrev0: rots.f,
          rCurr0: rots.n,
          rNext0: 0,
        };
      }
      const startCenterX = dir === "prev" ? bL(cw) + fromX * FOLLOW : bR(cw) + fromX * FOLLOW;
      x.set(startCenterX);
      floatU.set(0);
      try {
        // Index updates immediately; center `x` and `floatU` run in lockstep (raw `x` keeps drag working).
        await Promise.all([animate(x, 0, floatOpts), animate(floatU, 1, floatOpts)]);
        floatStateRef.current = { mode: "none" };
        floatU.set(0);
        x.set(0);
        revealY.set(10);
        await animate(revealY, 0, { type: "spring", stiffness: 300, damping: 26, mass: 0.55 });
      } finally {
        suppressIndexXResetRef.current = false;
        setIsCommitting(false);
      }
    },
    [goToNext, goToPrev, floatU, topics.length, revealY]
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    clearAdvanceTimer();
    if (isCommitting) {
      return;
    }
    const { velocity } = info;
    // Use live motion value — at drag constraints, `offset` in PanInfo can disagree with the visible x
    const dragX = x.get();

    if (!currentCard || topics.length === 0) {
      void animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
      return;
    }

    let wantPrev = false;
    let wantNext = false;

    // +x = drag right = left peek comes forward → goToPrev. -x = right peek → goToNext.
    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) {
      if (velocity.x < 0) {
        wantNext = true;
      } else {
        wantPrev = true;
      }
    } else {
      if (dragX <= -SWIPE_OFFSET_THRESHOLD) {
        wantNext = true;
      } else if (dragX >= SWIPE_OFFSET_THRESHOLD) {
        wantPrev = true;
      }
    }

    if (!wantPrev && !wantNext) {
      void animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
      return;
    }
    if (wantPrev && wantNext) {
      void animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
      return;
    }

    const cardState = cardStates.get(currentCard.id) || { isFlipped: false, timeOnBackMs: 0 };
    const commitDir: "next" | "prev" = wantNext ? "next" : "prev";
    if (cardState.isFlipped) {
      setForceUnflipSignal(Date.now());
      advanceAfterUnflipRef.current = setTimeout(() => {
        void finishCommit(commitDir);
        advanceAfterUnflipRef.current = null;
      }, FLIP_DURATION_MS);
    } else {
      void finishCommit(commitDir);
    }
  };

  if (!currentCard || topics.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">No more topics</p>
      </div>
    );
  }

  const cardWidth = dimensions.width;
  const maxDragX = Math.min(220, cardWidth * 0.55);
  cardWRef.current = cardWidth;
  maxDragForNorm.current = maxDragX;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${cardWidth}px`,
        height: `${dimensions.height}px`,
        margin: "0 auto",
        overflow: "visible",
        perspective: 1400,
        WebkitPerspective: 1400,
        transformStyle: "preserve-3d",
        WebkitTransformStyle: "preserve-3d",
      }}
    >
      {[
        { card: prev1Card, role: "prev" as const },
        { card: currentCard, role: "current" as const },
        { card: next1Card, role: "next" as const },
      ].map(({ card, role }) => {
        if (!card) return null;

        if (role === "prev") {
          return (
            <motion.div
              key={`${card.id}-prev-${currentIndex}`}
              className="absolute w-full h-full"
              style={{
                x: slotPrevX,
                scale: slotPrevScale,
                opacity: slotPrevOpacity,
                pointerEvents: slotPrevPointer,
                rotateY: slotPrevRY,
                transformOrigin: "100% 50%",
                WebkitTransformOrigin: "100% 50%",
                z: 1,
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: slotPrevZ,
                transformStyle: "preserve-3d",
              }}
            >
              <TopicCard
                {...card}
                imageUrl={card.imageUrl ?? ""}
                isActive={card.isActive ?? false}
                onFlipChange={(isFlipped) => handleFlipChange(card.id, isFlipped)}
                onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(card.id, timeMs)}
              />
            </motion.div>
          );
        }

        if (role === "next") {
          return (
            <motion.div
              key={`${card.id}-next-${currentIndex}`}
              className="absolute w-full h-full"
              style={{
                x: slotNextX,
                scale: slotNextScale,
                opacity: slotNextOpacity,
                pointerEvents: slotNextPointer,
                rotateY: slotNextRY,
                transformOrigin: "0% 50%",
                WebkitTransformOrigin: "0% 50%",
                z: 1,
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: slotNextZ,
                transformStyle: "preserve-3d",
              }}
            >
              <TopicCard
                {...card}
                imageUrl={card.imageUrl ?? ""}
                isActive={card.isActive ?? false}
                onFlipChange={(isFlipped) => handleFlipChange(card.id, isFlipped)}
                onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(card.id, timeMs)}
              />
            </motion.div>
          );
        }

        return (
          <motion.div
            key={`${card.id}-current-${currentIndex}`}
            className="absolute w-full h-full [touch-action:pan-x]"
            drag={isCommitting ? false : "x"}
            dragMomentum={false}
            dragElastic={0.02}
            dragConstraints={{ left: -maxDragX, right: maxDragX }}
            onDragEnd={handleDragEnd}
            style={{
              x,
              y: revealY,
              scale: slotCurrScale,
              opacity: slotCurrOpacity,
              z: 2,
              left: "50%",
              marginLeft: `-${cardWidth / 2}px`,
              zIndex: slotCurrZ,
              transformStyle: "preserve-3d",
            }}
          >
            <motion.div
              ref={currentHingeRef}
              className="h-full w-full"
              style={{
                rotateY: slotCurrRY,
                transformStyle: "preserve-3d",
                transformOrigin: "100% 50%",
                WebkitTransformOrigin: "100% 50%",
              }}
            >
              <div
                className="h-full w-full"
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                <TopicCard
                  {...card}
                  imageUrl={card.imageUrl ?? ""}
                  isActive={card.isActive ?? false}
                  onFlipChange={(isFlipped) => handleFlipChange(card.id, isFlipped)}
                  onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(card.id, timeMs)}
                  forceUnflipSignal={forceUnflipSignal}
                />
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

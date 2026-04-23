import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo, useMotionValueEvent } from "framer-motion";
import TopicCard from "./TopicCard";
import type { TopicWithCounts } from "@shared/schema";

const FLIP_DURATION_MS = 600;

// Calculate card dimensions based on viewport
const getCardDimensions = () => {
  const maxWidth = 400;
  const width = Math.min(window.innerWidth - 34, maxWidth);
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
/** Back card horizontal motion relative to the top: half as far, opposite direction. */
const FOLLOW = 0.5;
/** translateZ in px: large gap so 3D tilts do not z-fight past z-index. */
const FRONT_TZ = 32;
const BACK_TZ = 0;
const BACK_SCALE = 0.88;
/** Back cards at rest: 90% opacity → 100% as they move toward center with the drag */
const BACK_OPACITY_REST = 0.9;
const BACK_OPACITY_FULL = 1;
/** Peeks stay below Z_CURRENT so the front card stays on top until index changes after release. */
const Z_BACK = 2;
const Z_BACK_REST_LEAD = 3;
const Z_CURRENT = 5;

const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
/** 3D hinge at full drag (|x| = max). Tilts while sliding; useTransform from x. */
const COMMIT_TWIST_DEG = 44;
const FINISH_SWEEP_S = 0.22;

export default function SwipeableCardStack({ topics, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());
  const [forceUnflipSignal, setForceUnflipSignal] = useState(0);
  const [dimensions, setDimensions] = useState(getCardDimensions());
  const [isCommitting, setIsCommitting] = useState(false);
  const advanceAfterUnflipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardWRef = useRef(dimensions.width);
  const currentHingeRef = useRef<HTMLDivElement | null>(null);

  const x = useMotionValue(0);
  /** After index change: brief vertical spring so the new top card settles to center */
  const revealY = useMotionValue(0);

  // Drag +x (to the right): only the left peek is visible/animated; the right peek is hidden. -x: mirror.
  const maxDragForNorm = useRef(200);
  const mNow = () => maxDragForNorm.current;

  const prevX = useTransform(x, (v) => {
    const cw = cardWRef.current;
    const b = -cw * SIDE_OFFSET_FRAC;
    if (v > 0) return b - v * FOLLOW;
    return b;
  });
  const nextX = useTransform(x, (v) => {
    const cw = cardWRef.current;
    const b = cw * SIDE_OFFSET_FRAC;
    if (v < 0) return b - v * FOLLOW;
    return b;
  });
  const prevScale = useTransform(x, (v) => {
    if (v < 0) return BACK_SCALE;
    const t = Math.min(1, v / mNow());
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  });
  const nextScale = useTransform(x, (v) => {
    if (v > 0) return BACK_SCALE;
    const t = Math.min(1, -v / mNow());
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  });
  /** v<0: hide left peek. v>0: show and bring toward full opacity. v=0: resting peek. */
  const prevOpacity = useTransform(x, (v) => {
    if (v < 0) return 0;
    if (v === 0) return BACK_OPACITY_REST;
    const t = Math.min(1, v / mNow());
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  });
  const nextOpacity = useTransform(x, (v) => {
    if (v > 0) return 0;
    if (v === 0) return BACK_OPACITY_REST;
    const t = Math.min(1, -v / mNow());
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  });
  const prevPointerEvents = useTransform(x, (v) => (v < 0 ? "none" : "auto"));
  const nextPointerEvents = useTransform(x, (v) => (v > 0 ? "none" : "auto"));
  const prevZ = useTransform(x, (v) => (v < 0 ? 0 : Z_BACK_REST_LEAD));
  const nextZ = useTransform(x, (v) => (v > 0 ? 0 : Z_BACK));

  const tiltT = (v: number) => {
    const m = mNow();
    if (m < 1) return 0;
    return Math.min(1, Math.abs(v) / m) * COMMIT_TWIST_DEG;
  };
  /** Top card: v>0 → twist toward the left; v<0 → toward the right. (Signs flipped for correct 3D read.) */
  const tiltFront = useTransform(x, (v) => {
    if (v > 0) return -tiltT(v);
    if (v < 0) return tiltT(v);
    return 0;
  });
  /** Left peek (v>0 only): hinges on inner edge, swings over the current. */
  const tiltPrev = useTransform(x, (v) => (v > 0 ? tiltT(v) : 0));
  /** Right peek (v<0 only): mirror. */
  const tiltNext = useTransform(x, (v) => (v < 0 ? -tiltT(v) : 0));

  useEffect(() => {
    const handleResize = () => {
      setDimensions(getCardDimensions());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (advanceAfterUnflipRef.current) {
        clearTimeout(advanceAfterUnflipRef.current);
      }
    };
  }, []);

  // Reset drag when the active card index changes. Do not reset `revealY` here — `finishCommit`
  // sets revealY for the post-advance spring; resetting here would race and cancel that animation.
  useEffect(() => {
    x.set(0);
  }, [currentIndex, x]);

  // Hinge the front card from the edge toward the neighbor (door past the other card)
  useMotionValueEvent(x, "change", (v) => {
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
      const ease = [0.45, 0, 0.2, 1] as [number, number, number, number];
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
      setIsCommitting(true);
      // goToNext = user dragged left (x<0): finish to -m. goToPrev = dragged right (x>0): finish to +m.
      const targetX = dir === "next" ? -m : m;
      try {
        // Complete sweep: tilt follows x via useTransform, then take new top card
        await animate(x, targetX, { duration: FINISH_SWEEP_S, type: "tween", ease: ease });
        if (dir === "next") goToNext();
        else goToPrev();
        x.set(0);
        revealY.set(10);
        await animate(revealY, 0, { type: "spring", stiffness: 300, damping: 26, mass: 0.55 });
      } finally {
        setIsCommitting(false);
      }
    },
    [goToNext, goToPrev, x, topics.length, revealY]
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

    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) {
      if (velocity.x < 0) {
        wantPrev = true;
      } else {
        wantNext = true;
      }
    } else {
      if (dragX <= -SWIPE_OFFSET_THRESHOLD) {
        wantPrev = true;
      } else if (dragX >= SWIPE_OFFSET_THRESHOLD) {
        wantNext = true;
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
    // Positive drag → bring left peek to top (goToPrev). Negative drag → bring right peek to top (goToNext).
    const commitDir: "next" | "prev" = wantNext ? "prev" : "next";
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
      {/* prev → next → current: paint current last in DOM to avoid 3D edge cases covering the front. */}
      {[
        { card: prev1Card, role: "prev" as const },
        { card: next1Card, role: "next" as const },
        { card: currentCard, role: "current" as const },
      ].map(({ card, role }) => {
        if (!card) return null;

        if (role === "prev") {
          return (
            <motion.div
              key={`${card.id}-prev-${currentIndex}`}
              className="absolute w-full h-full"
              style={{
                x: prevX,
                scale: prevScale,
                opacity: prevOpacity,
                pointerEvents: prevPointerEvents,
                rotateY: tiltPrev,
                transformOrigin: "100% 50%",
                /* inner edge to center: swings over the current while dragging right */
                WebkitTransformOrigin: "100% 50%",
                z: BACK_TZ,
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: prevZ,
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
                x: nextX,
                scale: nextScale,
                opacity: nextOpacity,
                pointerEvents: nextPointerEvents,
                rotateY: tiltNext,
                transformOrigin: "0% 50%",
                WebkitTransformOrigin: "0% 50%",
                z: BACK_TZ,
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: nextZ,
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
              z: FRONT_TZ,
              left: "50%",
              marginLeft: `-${cardWidth / 2}px`,
              zIndex: Z_CURRENT,
              transformStyle: "preserve-3d",
            }}
          >
            <motion.div
              ref={currentHingeRef}
              className="h-full w-full"
              style={{
                rotateY: tiltFront,
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

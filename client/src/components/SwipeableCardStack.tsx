import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
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
const FOLLOW = 0.5;
const BACK_SCALE = 0.88;
/** Back cards at rest: 90% opacity → 100% as they move toward center with the drag */
const BACK_OPACITY_REST = 0.9;
const BACK_OPACITY_FULL = 1;

const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

export default function SwipeableCardStack({ topics, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());
  const [forceUnflipSignal, setForceUnflipSignal] = useState(0);
  const [dimensions, setDimensions] = useState(getCardDimensions());
  const advanceAfterUnflipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardWRef = useRef(dimensions.width);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);

  // Swipe right (v>0): left (prev) card follows. Swipe left (v<0): right (next) card follows.
  const maxDragForNorm = useRef(200);
  const prevX = useTransform(x, (v) => {
    const cw = cardWRef.current;
    const b = -cw * SIDE_OFFSET_FRAC;
    if (v > 0) return b + v * FOLLOW;
    return b;
  });
  const nextX = useTransform(x, (v) => {
    const cw = cardWRef.current;
    const b = cw * SIDE_OFFSET_FRAC;
    if (v < 0) return b + v * FOLLOW;
    return b;
  });
  const prevScale = useTransform(x, (v) => {
    if (v <= 0) return BACK_SCALE;
    const t = Math.min(1, v / maxDragForNorm.current);
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  });
  const nextScale = useTransform(x, (v) => {
    if (v >= 0) return BACK_SCALE;
    const t = Math.min(1, -v / maxDragForNorm.current);
    return BACK_SCALE + (1 - BACK_SCALE) * 0.65 * t;
  });
  const prevOpacity = useTransform(x, (v) => {
    if (v <= 0) return BACK_OPACITY_REST;
    const t = Math.min(1, v / maxDragForNorm.current);
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  });
  const nextOpacity = useTransform(x, (v) => {
    if (v >= 0) return BACK_OPACITY_REST;
    const t = Math.min(1, -v / maxDragForNorm.current);
    return BACK_OPACITY_REST + (BACK_OPACITY_FULL - BACK_OPACITY_REST) * t;
  });

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

  useEffect(() => {
    x.set(0);
  }, [currentIndex, x]);

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

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    clearAdvanceTimer();
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
    const run = () => {
      if (wantPrev) {
        goToPrev();
      } else {
        goToNext();
      }
    };

    x.set(0);
    if (cardState.isFlipped) {
      setForceUnflipSignal(Date.now());
      advanceAfterUnflipRef.current = setTimeout(() => {
        run();
        advanceAfterUnflipRef.current = null;
      }, FLIP_DURATION_MS);
    } else {
      run();
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
                x: prevX,
                scale: prevScale,
                opacity: prevOpacity,
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: 2,
                transformStyle: "preserve-3d",
                willChange: "transform, opacity",
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
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: 2,
                transformStyle: "preserve-3d",
                willChange: "transform, opacity",
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
            className="absolute w-full h-full"
            drag="x"
            dragMomentum={false}
            dragElastic={0.02}
            dragConstraints={{ left: -maxDragX, right: maxDragX }}
            onDragEnd={handleDragEnd}
            style={{
              x,
              rotate,
              left: "50%",
              marginLeft: `-${cardWidth / 2}px`,
              zIndex: 5,
              transformStyle: "preserve-3d",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                perspective: "1000px",
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
        );
      })}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import TopicCard from "./TopicCard";
import type { TopicWithCounts } from "@shared/schema";

const FLIP_DURATION_MS = 600;

// Calculate card dimensions based on viewport
const getCardDimensions = () => {
  const maxWidth = 400;
  const width = Math.min(window.innerWidth - 34, maxWidth); // 17px padding each side (34px total)
  const height = (width * 7) / 5; // 5:7 aspect ratio
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

// Helper function to get card at offset using circular array
const getCardAtOffset = (topics: TopicWithCounts[], currentIndex: number, offset: number): TopicWithCounts | null => {
  if (topics.length === 0) return null;
  const index = (currentIndex + offset + topics.length) % topics.length;
  return topics[index];
};

// Calculate card properties based on position
const getCardStyle = (offset: number, cardWidth: number) => {
  const distance = Math.abs(offset);
  const scale = distance === 0 ? 1.0 : 0.88; // Slightly smaller for side cards
  const opacity = distance === 0 ? 1.0 : 0.6; // More transparent for side cards
  const zIndex = distance === 0 ? 5 : 2;
  const translateX = offset * cardWidth * 0.25;

  return {
    translateX,
    scale,
    opacity,
    zIndex,
  };
};

const SWIPE_OFFSET_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

export default function SwipeableCardStack({ topics, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());
  const [forceUnflipSignal, setForceUnflipSignal] = useState(0);
  const [dimensions, setDimensions] = useState(getCardDimensions());
  const advanceAfterUnflipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update dimensions on window resize
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

  // Get cards at different offsets
  const prev1Card = getCardAtOffset(topics, currentIndex, -1);
  const currentCard = getCardAtOffset(topics, currentIndex, 0);
  const next1Card = getCardAtOffset(topics, currentIndex, 1);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);

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
    const { offset, velocity } = info;
    x.set(0);

    if (!currentCard || topics.length === 0) return;

    // Decide intent: high horizontal velocity wins; else use offset
    let wantPrev = false;
    let wantNext = false;

    if (Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) {
      if (velocity.x < 0) {
        wantPrev = true;
      } else {
        wantNext = true;
      }
    } else {
      if (offset.x <= -SWIPE_OFFSET_THRESHOLD) {
        wantPrev = true;
      } else if (offset.x >= SWIPE_OFFSET_THRESHOLD) {
        wantNext = true;
      }
    }

    if (!wantPrev && !wantNext) {
      return;
    }
    if (wantPrev && wantNext) {
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
        { card: prev1Card, offset: -1, key: "prev1" },
        { card: currentCard, offset: 0, key: "current" },
        { card: next1Card, offset: 1, key: "next1" },
      ].map(({ card, offset }) => {
        if (!card) return null;

        const isCurrent = offset === 0;
        const style = getCardStyle(offset, cardWidth);

        if (!isCurrent) {
          return (
            <div
              key={`${card.id}-${offset}-${currentIndex}`}
              className="absolute w-full h-full"
              style={{
                left: "50%",
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: style.zIndex,
                transform: `translateX(${style.translateX}px) scale(${style.scale})`,
                opacity: style.opacity,
                transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
              }}
            >
              <TopicCard
                {...card}
                imageUrl={card.imageUrl ?? ""}
                isActive={card.isActive ?? false}
                onFlipChange={(isFlipped) => handleFlipChange(card.id, isFlipped)}
                onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(card.id, timeMs)}
              />
            </div>
          );
        }

        return (
          <motion.div
            key={`${card.id}-current-${currentIndex}`}
            className="absolute w-full h-full"
            drag="x"
            dragElastic={0.12}
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

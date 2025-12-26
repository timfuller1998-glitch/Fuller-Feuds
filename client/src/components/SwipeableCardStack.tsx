import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import TopicCard from "./TopicCard";
import type { TopicWithCounts } from "@shared/schema";

interface SwipeableCardStackProps {
  topics: TopicWithCounts[];
  onSwipe: (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: CardState) => void;
  onEmpty?: () => void;
}

interface CardState {
  isFlipped: boolean;
  timeOnBackMs: number;
}

export default function SwipeableCardStack({ topics, onSwipe, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());
  const [swipeDirection, setSwipeDirection] = useState<'like' | 'dislike' | 'opinion' | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [triggerOpinionForm, setTriggerOpinionForm] = useState(0);

  const currentTopic = topics[currentIndex];
  const nextTopic = topics[currentIndex + 1];
  const thirdTopic = topics[currentIndex + 2];

  // Motion values for drag
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  
  // Update card state when flip changes
  const handleFlipChange = (index: number, isFlipped: boolean) => {
    setCardStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(index) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(index, { ...currentState, isFlipped });
      return newMap;
    });
  };

  // Update time on back side
  const handleBackTimeUpdate = (index: number, timeMs: number) => {
    setCardStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(index) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(index, { ...currentState, timeOnBackMs: timeMs });
      return newMap;
    });
  };

  const handleDrag = (event: any, info: PanInfo) => {
    const { offset } = info;
    
    // Determine swipe direction and overlay opacity
    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      // Horizontal swipe
      if (offset.x > 50) {
        setSwipeDirection('like');
        setOverlayOpacity(Math.min(Math.abs(offset.x) / 150, 0.7));
      } else if (offset.x < -50) {
        setSwipeDirection('dislike');
        setOverlayOpacity(Math.min(Math.abs(offset.x) / 150, 0.7));
      }
    } else if (offset.y < -50) {
      // Vertical swipe up
      setSwipeDirection('opinion');
      setOverlayOpacity(Math.min(Math.abs(offset.y) / 100, 0.7));
    } else {
      setSwipeDirection(null);
      setOverlayOpacity(0);
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeThreshold = 100;
    const velocityThreshold = 500;

    setSwipeDirection(null);
    setOverlayOpacity(0);

    // Vertical swipe up (add opinion) - don't remove card, just trigger opinion dialog
    if (offset.y < -80 || velocity.y < -velocityThreshold) {
      const cardState = cardStates.get(currentIndex) || { isFlipped: false, timeOnBackMs: 0 };
      onSwipe(currentTopic, 'up', cardState);
      // Trigger opinion form by updating timestamp
      setTriggerOpinionForm(Date.now());
      // Don't advance - keep the card, just open opinion dialog
      x.set(0);
      y.set(0);
      return;
    }

    // Horizontal swipe (like/dislike)
    if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > velocityThreshold) {
      const direction = offset.x > 0 ? 'right' : 'left';
      const cardState = cardStates.get(currentIndex) || { isFlipped: false, timeOnBackMs: 0 };
      onSwipe(currentTopic, direction, cardState);
      setCurrentIndex(prev => prev + 1);
      x.set(0);
      y.set(0);
    }
    // Snap back
    else {
      x.set(0);
      y.set(0);
    }

    // Check if we're out of topics
    if (currentIndex >= topics.length - 1 && onEmpty) {
      setTimeout(() => {
        if (currentIndex >= topics.length - 1) {
          onEmpty();
        }
      }, 300);
    }
  };

  useEffect(() => {
    if (currentIndex >= topics.length && onEmpty) {
      onEmpty();
    }
  }, [currentIndex, topics.length, onEmpty]);

  if (!currentTopic) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">No more topics</p>
      </div>
    );
  }

  const cardState = cardStates.get(currentIndex) || { isFlipped: false, timeOnBackMs: 0 };

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center" 
      style={{ 
        width: 'min(calc(100vw - 2rem), 400px)',
        aspectRatio: '5/7',
        margin: '0 auto',
        maxWidth: '400px'
      }}
    >
      {/* Third card (furthest back) */}
      {thirdTopic && (
        <div
          className="absolute w-full"
          style={{
            transform: "scale(0.9) translateY(20px)",
            zIndex: 1,
            opacity: 0.6,
          }}
        >
          <TopicCard
            {...thirdTopic}
            imageUrl={thirdTopic.imageUrl ?? ""}
            isActive={thirdTopic.isActive ?? false}
          />
        </div>
      )}
      {/* Second card (middle) */}
      {nextTopic && (
        <div
          className="absolute w-full"
          style={{
            transform: "scale(0.95) translateY(10px)",
            zIndex: 2,
            opacity: 0.8,
            transition: "transform 0.3s ease-out",
          }}
        >
          <TopicCard
            {...nextTopic}
            imageUrl={nextTopic.imageUrl ?? ""}
            isActive={nextTopic.isActive ?? false}
          />
        </div>
      )}

      {/* Top card (draggable) */}
      <motion.div
        className="absolute w-full z-30"
        style={{
          x,
          y,
          rotate,
        }}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        initial={{ scale: 1 }}
        animate={{
          scale: currentIndex < topics.length ? 1 : 0.8,
          opacity: currentIndex < topics.length ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Swipe overlays */}
        {swipeDirection === 'like' && (
          <div
            className="absolute inset-0 bg-green-500/50 rounded-lg z-40 pointer-events-none flex items-center justify-center"
            style={{ opacity: overlayOpacity }}
          >
            <div className="text-6xl">✓</div>
          </div>
        )}
        {swipeDirection === 'dislike' && (
          <div
            className="absolute inset-0 bg-red-500/50 rounded-lg z-40 pointer-events-none flex items-center justify-center"
            style={{ opacity: overlayOpacity }}
          >
            <div className="text-6xl">✗</div>
          </div>
        )}
        {swipeDirection === 'opinion' && (
          <div
            className="absolute inset-0 bg-purple-500/50 rounded-lg z-40 pointer-events-none flex items-center justify-center"
            style={{ opacity: overlayOpacity }}
          >
            <div className="text-4xl">📝</div>
          </div>
        )}

        <TopicCard
          {...currentTopic}
          imageUrl={currentTopic.imageUrl ?? ""}
          isActive={currentTopic.isActive ?? false}
          onFlipChange={(isFlipped) => handleFlipChange(currentIndex, isFlipped)}
          onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(currentIndex, timeMs)}
          showSwipeOverlay={
            swipeDirection === 'like'
              ? 'like'
              : swipeDirection === 'dislike'
              ? 'dislike'
              : swipeDirection === 'opinion'
              ? 'opinion'
              : null
          }
          overlayOpacity={overlayOpacity}
          triggerOpinionForm={triggerOpinionForm}
        />
      </motion.div>
    </div>
  );
}


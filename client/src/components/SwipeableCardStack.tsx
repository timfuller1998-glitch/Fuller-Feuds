import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import TopicCard from "./TopicCard";
import type { TopicWithCounts } from "@shared/schema";

// Calculate card dimensions based on viewport
const getCardDimensions = () => {
  const maxWidth = 400;
  const width = Math.min(window.innerWidth - 34, maxWidth); // 17px padding each side (34px total)
  const height = (width * 7) / 5; // 5:7 aspect ratio
  return { width, height };
};

interface SwipeableCardStackProps {
  topics: TopicWithCounts[];
  onSwipe: (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: CardState) => void;
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
  // Calculate translateX so cards are more hidden behind the center card
  // Using smaller offset to bring them more under
  const translateX = offset * cardWidth * 0.25; // Reduced spacing to bring cards more under
  
  return {
    translateX,
    scale,
    opacity,
    zIndex,
  };
};

export default function SwipeableCardStack({ topics, onSwipe, onEmpty }: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map()); // Use topic ID as key
  const [swipeDirection, setSwipeDirection] = useState<'like' | 'dislike' | 'opinion' | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [triggerOpinionForm, setTriggerOpinionForm] = useState(0);
  const [dimensions, setDimensions] = useState(getCardDimensions());
  const [isAnimating, setIsAnimating] = useState(false);

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getCardDimensions());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get cards at different offsets
  const prev1Card = getCardAtOffset(topics, currentIndex, -1);
  const currentCard = getCardAtOffset(topics, currentIndex, 0);
  const next1Card = getCardAtOffset(topics, currentIndex, 1);

  // Motion values for drag
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  
  // Update card state when flip changes (using topic ID)
  const handleFlipChange = (topicId: string, isFlipped: boolean) => {
    setCardStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(topicId) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(topicId, { ...currentState, isFlipped });
      return newMap;
    });
  };

  // Update time on back side (using topic ID)
  const handleBackTimeUpdate = (topicId: string, timeMs: number) => {
    setCardStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(topicId) || { isFlipped: false, timeOnBackMs: 0 };
      newMap.set(topicId, { ...currentState, timeOnBackMs: timeMs });
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

    if (!currentCard) return;

    // Vertical swipe up (add opinion) - don't remove card, just trigger opinion dialog
    if (offset.y < -80 || velocity.y < -velocityThreshold) {
      const cardState = cardStates.get(currentCard.id) || { isFlipped: false, timeOnBackMs: 0 };
      onSwipe(currentCard, 'up', cardState);
      // Trigger opinion form by updating timestamp
      setTriggerOpinionForm(Date.now());
      // Don't advance - keep the card, just open opinion dialog
      x.set(0);
      y.set(0);
      return;
    }

    // Horizontal swipe (like/dislike) - move card to back
    if (Math.abs(offset.x) > swipeThreshold || Math.abs(velocity.x) > velocityThreshold) {
      const direction = offset.x > 0 ? 'right' : 'left';
      const cardState = cardStates.get(currentCard.id) || { isFlipped: false, timeOnBackMs: 0 };
      onSwipe(currentCard, direction, cardState);
      
      // Move to next card (infinite loop)
      setIsAnimating(true);
      setCurrentIndex(prev => (prev + 1) % topics.length);
      
      // Reset drag position
      x.set(0);
      y.set(0);
      
      // Reset animation flag after transition
      setTimeout(() => setIsAnimating(false), 300);
    }
    // Snap back
    else {
      x.set(0);
      y.set(0);
    }
  };

  if (!currentCard || topics.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">No more topics</p>
      </div>
    );
  }

  const currentCardState = cardStates.get(currentCard.id) || { isFlipped: false, timeOnBackMs: 0 };
  const cardWidth = dimensions.width;

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ 
        width: `${cardWidth}px`,
        height: `${dimensions.height}px`,
        margin: '0 auto',
        overflow: 'visible',
      }}
    >
      {/* Render 3 cards: prev1, current, next1 */}
      {[
        { card: prev1Card, offset: -1, key: 'prev1' },
        { card: currentCard, offset: 0, key: 'current' },
        { card: next1Card, offset: 1, key: 'next1' },
      ].map(({ card, offset, key }) => {
        if (!card) return null;
        
        const isCurrent = offset === 0;
        const style = getCardStyle(offset, cardWidth);
        const cardState = cardStates.get(card.id) || { isFlipped: false, timeOnBackMs: 0 };

        // Non-current cards (static background cards)
        if (!isCurrent) {
          return (
            <div
              key={`${card.id}-${offset}-${currentIndex}`}
              className="absolute w-full h-full"
              style={{
                left: '50%',
                marginLeft: `-${cardWidth / 2}px`,
                zIndex: style.zIndex,
                transform: `translateX(${style.translateX}px) scale(${style.scale})`,
                opacity: style.opacity,
                transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
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

        // Current card (draggable)
        return (
          <motion.div
            key={`${card.id}-current-${currentIndex}`}
            className="absolute w-full h-full"
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={{
              x,
              y,
              rotate,
              left: '50%',
              marginLeft: `-${cardWidth / 2}px`,
              zIndex: 5,
              transformStyle: 'preserve-3d',
            }}
            animate={{
              scale: 1,
              opacity: 1,
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

            <div
              style={{
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                perspective: '1000px',
              }}
            >
              <TopicCard
                {...card}
                imageUrl={card.imageUrl ?? ""}
                isActive={card.isActive ?? false}
                onFlipChange={(isFlipped) => handleFlipChange(card.id, isFlipped)}
                onBackTimeUpdate={(timeMs) => handleBackTimeUpdate(card.id, timeMs)}
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
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

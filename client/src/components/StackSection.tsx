import { LucideIcon } from "lucide-react";
import SwipeableCardStack from "./SwipeableCardStack";
import type { TopicWithCounts } from "@shared/schema";

interface StackSectionProps {
  title: string;
  icon: LucideIcon;
  sectionKey: string;
  topics: TopicWithCounts[];
  onSwipe: (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: { isFlipped: boolean; timeOnBackMs: number }) => void;
}

export default function StackSection({ title, icon: Icon, sectionKey, topics, onSwipe }: StackSectionProps) {
  const handleSwipe = (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: { isFlipped: boolean; timeOnBackMs: number }) => {
    onSwipe(topic, direction, cardState);
  };

  const handleEmpty = () => {
    // Handle empty stack - could trigger refresh or show message
    console.log(`Stack ${sectionKey} is empty`);
  };

  return (
    <section
      className="min-h-[100dvh] snap-start flex flex-col items-center justify-center px-4 py-8"
      data-testid={`section-${sectionKey}`}
    >
      {/* Section Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold" data-testid={`text-section-${sectionKey}`}>
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {topics.length} {topics.length === 1 ? 'debate' : 'debates'}
        </p>
      </div>

      {/* Card Stack */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        {topics.length > 0 ? (
          <SwipeableCardStack
            topics={topics}
            onSwipe={handleSwipe}
            onEmpty={handleEmpty}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <p>No topics available</p>
          </div>
        )}
      </div>
    </section>
  );
}


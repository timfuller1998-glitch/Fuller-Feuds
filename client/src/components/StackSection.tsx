import { LucideIcon } from "lucide-react";
import SwipeableCardStack from "./SwipeableCardStack";
import type { TopicWithCounts } from "@shared/schema";

interface NextSection {
  title: string;
  icon: LucideIcon;
}

interface StackSectionProps {
  title: string;
  icon: LucideIcon;
  sectionKey: string;
  topics: TopicWithCounts[];
  onSwipe: (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: { isFlipped: boolean; timeOnBackMs: number }) => void;
  nextSection?: NextSection;
}

export default function StackSection({ title, icon: Icon, sectionKey, topics, onSwipe, nextSection }: StackSectionProps) {
  const handleSwipe = (topic: TopicWithCounts, direction: 'left' | 'right' | 'up', cardState: { isFlipped: boolean; timeOnBackMs: number }) => {
    onSwipe(topic, direction, cardState);
  };

  const handleEmpty = () => {
    // Handle empty stack - could trigger refresh or show message
    console.log(`Stack ${sectionKey} is empty`);
  };

  const NextSectionIcon = nextSection?.icon;

  return (
    <section
      className="min-h-[100dvh] snap-start flex flex-col items-center px-4 py-8"
      data-testid={`section-${sectionKey}`}
    >
      {/* Top Spacer */}
      <div className="h-16 flex-shrink-0" />

      {/* Section Header */}
      <div className="w-full flex justify-between items-center mb-0 flex-shrink-0">
        <div className="inline-flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold" data-testid={`text-section-${sectionKey}`}>
            {title}
          </h2>
        </div>
        <span className="text-xl font-semibold text-muted-foreground">
          {topics.length}
        </span>
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

      {/* Bottom Spacer */}
      <div className="h-16 flex-shrink-0" />

      {/* Next Section Preview */}
      {nextSection && NextSectionIcon && (
        <div className="w-full flex justify-between items-center opacity-60 flex-shrink-0">
          <div className="inline-flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <NextSectionIcon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-muted-foreground">
              {nextSection.title}
            </h2>
          </div>
        </div>
      )}
    </section>
  );
}


import { ChevronDown, LucideIcon } from "lucide-react";
import SwipeableCardStack from "./SwipeableCardStack";
import type { TopicWithCounts } from "@shared/schema";

interface StackSectionProps {
  title: string;
  icon: LucideIcon;
  sectionKey: string;
  topics: TopicWithCounts[];
  /** When true, show a small chevron hint that another section is below. */
  showNextHint?: boolean;
}

export default function StackSection({ title, icon: Icon, sectionKey, topics, showNextHint }: StackSectionProps) {
  const handleEmpty = () => {
    console.log(`Stack ${sectionKey} is empty`);
  };

  return (
    <section
      className="h-[100dvh] snap-start flex flex-col items-center px-4"
      data-testid={`section-${sectionKey}`}
    >
      <div className="w-full flex justify-between items-center pt-3 pb-1 flex-shrink-0">
        <div className="inline-flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
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

      <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-visible">
        {topics.length > 0 ? (
          <SwipeableCardStack
            topics={topics}
            onEmpty={handleEmpty}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <p>No topics available</p>
          </div>
        )}
      </div>

      {showNextHint ? (
        <div className="w-full flex justify-center pb-2 pt-0 flex-shrink-0" aria-hidden="true">
          <ChevronDown className="w-5 h-5 text-muted-foreground/50" data-testid={`hint-next-section-${sectionKey}`} />
        </div>
      ) : (
        <div className="h-3 flex-shrink-0" />
      )}
    </section>
  );
}

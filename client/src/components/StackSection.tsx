import { ChevronDown, LucideIcon } from "lucide-react";
import SwipeableCardStack, { type DeckTopic } from "./SwipeableCardStack";
import type { TopicWithCounts } from "@shared/schema";
import type { HomeSectionKey } from "@shared/homeFeed";
import { useInfiniteHomeDeck } from "@/hooks/useInfiniteHomeDeck";

interface StackSectionProps {
  title: string;
  icon: LucideIcon;
  sectionKey: string;
  /** Fixed list (e.g. home search results). Omit and pass feedSection for an endless, ranked deck. */
  topics?: TopicWithCounts[];
  /** Endless deck fed by /api/feed/home (no numbering; loads more as you swipe). */
  feedSection?: HomeSectionKey;
  /** When true, show a small chevron hint that another section is below. */
  showNextHint?: boolean;
}

const deckKey = (t: DeckTopic) => (t.deckKey as string) || t.id;

function SectionShell({ title, icon: Icon, sectionKey, count, showNextHint, children }: {
  title: string; icon: LucideIcon; sectionKey: string; count?: number; showNextHint?: boolean; children: React.ReactNode;
}) {
  return (
    <section
      className="h-full snap-start shrink-0 flex flex-col items-center px-4"
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
        {count != null ? <span className="text-xl font-semibold text-muted-foreground">{count}</span> : null}
      </div>

      <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-visible">
        {children}
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

function EndlessDeck({ feedSection }: { feedSection: HomeSectionKey }) {
  const { items, total, error, loadMore, onTopChange, endless } = useInfiniteHomeDeck(feedSection);
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground" data-testid={`deck-loading-${feedSection}`}>
        <p>{error ? "Couldn't load topics. Pull down to try again." : total === 0 ? "No topics available" : "Loading…"}</p>
      </div>
    );
  }
  return (
    <SwipeableCardStack
      topics={items}
      getKey={deckKey}
      infinite={endless}
      onNearEnd={() => { void loadMore(); }}
      onTopChange={(t) => onTopChange(t as any)}
      testId={`deck-${feedSection}`}
    />
  );
}

export default function StackSection({ title, icon, sectionKey, topics, feedSection, showNextHint }: StackSectionProps) {
  return (
    <SectionShell title={title} icon={icon} sectionKey={sectionKey} count={feedSection ? undefined : topics?.length} showNextHint={showNextHint}>
      {feedSection ? (
        <EndlessDeck feedSection={feedSection} />
      ) : topics && topics.length > 0 ? (
        <SwipeableCardStack topics={topics} />
      ) : (
        <div className="text-center text-muted-foreground">
          <p>No topics available</p>
        </div>
      )}
    </SectionShell>
  );
}

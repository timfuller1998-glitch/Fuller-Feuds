import type { ReactNode } from "react";
import CardDeck from "./CardDeck";
import TopicCard from "./TopicCard";

/** Loose topic shape: every page maps its API topics a little differently. */
export interface DeckTopic {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  categories?: string[] | null;
  participantCount?: number | null;
  opinionsCount?: number | null;
  isActive?: boolean | null;
  [key: string]: any;
}

interface SwipeableCardStackProps {
  topics: DeckTopic[];
  onEmpty?: () => void;
  maxWidth?: number;
  /** Forwarded to CardDeck. Use 0 on scrolling pages so the default 400×560 card is not capped to the viewport. */
  chromeReserve?: number;
  renderBadge?: (topic: DeckTopic, index: number) => ReactNode;
  testId?: string;
  /** Endless deck: no counter, caller appends more via onNearEnd (Home sections). */
  infinite?: boolean;
  onNearEnd?: (remaining: number) => void;
  onTopChange?: (topic: DeckTopic) => void;
  /** Key per card; defaults to topic id (endless decks repeat topics, so they pass a per-cycle key). */
  getKey?: (topic: DeckTopic) => string;
}

const topicKey = (t: DeckTopic) => t.id;

/** Topic deck: the generic CardDeck with TopicCard faces (TopicCard renders its own front and back). */
export default function SwipeableCardStack({ topics, onEmpty, maxWidth, chromeReserve, renderBadge, testId, infinite, onNearEnd, onTopChange, getKey }: SwipeableCardStackProps) {
  return (
    <CardDeck<DeckTopic>
      items={topics}
      getKey={getKey ?? topicKey}
      infinite={infinite}
      onNearEnd={onNearEnd}
      onIndexChange={onTopChange ? (_i, t) => onTopChange(t) : undefined}
      onEmpty={onEmpty}
      maxWidth={maxWidth}
      chromeReserve={chromeReserve}
      renderBadge={renderBadge}
      testId={testId}
      renderFront={(card, ctx) => (
        <TopicCard
          {...card}
          title={card.title}
          description={card.description ?? ""}
          categories={card.categories ?? []}
          participantCount={card.participantCount ?? 0}
          opinionsCount={card.opinionsCount ?? 0}
          imageUrl={card.imageUrl ?? ""}
          isActive={card.isActive ?? true}
          onFlipChange={ctx.onFlipChange}
          forceUnflipSignal={ctx.forceUnflipSignal}
        />
      )}
    />
  );
}

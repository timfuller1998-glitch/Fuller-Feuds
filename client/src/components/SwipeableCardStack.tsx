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
  renderBadge?: (topic: DeckTopic, index: number) => ReactNode;
  testId?: string;
}

const topicKey = (t: DeckTopic) => t.id;

/** Topic deck: the generic CardDeck with TopicCard faces (TopicCard renders its own front and back). */
export default function SwipeableCardStack({ topics, onEmpty, maxWidth, renderBadge, testId }: SwipeableCardStackProps) {
  return (
    <CardDeck<DeckTopic>
      items={topics}
      getKey={topicKey}
      onEmpty={onEmpty}
      maxWidth={maxWidth}
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

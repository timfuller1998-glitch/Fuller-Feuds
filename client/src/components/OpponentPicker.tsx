import { useState } from "react";
import { Heart, Swords } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { Button } from "@/components/ui/button";
import { StanceChip } from "@/components/OpinionDeckCard";
import {
  groupOpponents,
  opponentName,
  relationLabel,
  type Opponent,
} from "@/lib/opponentSides";
import type { Stance } from "@/lib/stance";
import { CardScrollBody } from "@/components/CardScrollBody";

function initials(p: Opponent) {
  return `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function PersonButton({
  person,
  selected,
  onSelect,
}: {
  person: Opponent;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = opponentName(person);
  const role = relationLabel(person.relation);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border px-2 py-1.5 flex items-center gap-2 transition-colors ${
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary"
          : "border-foreground/10 bg-background/40 hover:border-foreground/25"
      }`}
      data-testid={`opponent-${person.userId}`}
      aria-pressed={selected}
    >
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={person.profileImageUrl || undefined} alt={name} />
        <AvatarFallback className="text-xs">{initials(person)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-serif text-sm font-semibold truncate">{name}</span>
          {person.stance ? <StanceChip stance={person.stance} /> : null}
        </span>
        {person.handle ? (
          <UserHandle handle={person.handle} className="text-xs text-muted-foreground block truncate" />
        ) : null}
        {role ? (
          <span className="block font-ui text-[0.6rem] uppercase tracking-[0.1em] text-[hsl(var(--gold))]">
            {role}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Side({
  title,
  hint,
  people,
  selectedId,
  onSelect,
  testId,
  emptyText,
}: {
  title: string;
  hint: string;
  people: Opponent[];
  selectedId: string | null;
  onSelect: (p: Opponent) => void;
  testId: string;
  emptyText?: string;
}) {
  return (
    <section className="space-y-1" data-testid={testId}>
      <div>
        <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">{title}</p>
        <p className="font-ui text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">{hint}</p>
      </div>
      {people.length === 0 ? (
        <p className="font-serif text-sm italic text-muted-foreground">{emptyText || "No one on this side yet."}</p>
      ) : (
        <div className="space-y-1">
          {people.map((p) => (
            <PersonButton
              key={p.userId}
              person={p}
              selected={selectedId === p.userId}
              onSelect={() => onSelect(p)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function OpponentPicker({
  meId,
  isAuthenticated,
  people,
  counterpointAuthorId,
  originalAuthorId,
  counterpointAuthorStance,
  originalAuthorStance,
  likedByMe,
  likeCount,
  canLike,
  likePending,
  onLike,
  onChallenge,
  challengePending,
  onNeedSignIn,
}: {
  meId?: string | null;
  isAuthenticated: boolean;
  people: Opponent[];
  counterpointAuthorId: string;
  originalAuthorId: string;
  counterpointAuthorStance?: Stance | null;
  originalAuthorStance?: Stance | null;
  likedByMe: boolean;
  likeCount: number;
  canLike: boolean;
  likePending?: boolean;
  onLike: () => void;
  onChallenge: (opponent: Opponent, side: "for" | "against") => void;
  challengePending?: boolean;
  onNeedSignIn: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { forSide, againstSide } = groupOpponents({
    meId,
    counterpointAuthorId,
    originalAuthorId,
    counterpointAuthorStance,
    originalAuthorStance,
    people,
  });
  const selected =
    forSide.find((p) => p.userId === selectedId) ||
    againstSide.find((p) => p.userId === selectedId) ||
    null;
  const selectedSide: "for" | "against" | null = selected
    ? forSide.some((p) => p.userId === selected.userId)
      ? "for"
      : "against"
    : null;

  const challenge = () => {
    if (!isAuthenticated) {
      onNeedSignIn();
      return;
    }
    if (selected && selectedSide) onChallenge(selected, selectedSide);
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="opponent-picker">
      <div className="flex items-center gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))] leading-tight">
            Choose an opponent
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={likedByMe ? "default" : "outline"}
          disabled={!canLike || likePending}
          onClick={onLike}
          className="shrink-0"
          data-testid="button-like-counterpoint"
        >
          <Heart className={`w-3.5 h-3.5 mr-1.5 ${likedByMe ? "fill-current" : ""}`} />
          {likeCount}
        </Button>
      </div>
      <div className="mt-2 h-px bg-[hsl(var(--gold)/0.45)] shrink-0" />
      <CardScrollBody className="mt-2 space-y-3">
        <Side
          title="Debate for"
          hint="Face the original opinion"
          people={forSide}
          selectedId={selectedId}
          onSelect={(p) => setSelectedId(p.userId)}
          testId="side-debate-for"
        />
        <Side
          title="Debate against"
          hint="Face this counterpoint"
          people={againstSide}
          selectedId={selectedId}
          onSelect={(p) => setSelectedId(p.userId)}
          testId="side-debate-against"
          emptyText={
            meId && meId === counterpointAuthorId
              ? "You wrote this reply. Challenge someone on the original side."
              : "No one on this side yet."
          }
        />
      </CardScrollBody>
      <div className="pt-2 mt-auto shrink-0">
        <Button
          type="button"
          className="w-full text-sm whitespace-normal"
          disabled={(!selected && isAuthenticated) || challengePending}
          onClick={challenge}
          data-testid="button-challenge-opponent"
        >
          <Swords className="w-4 h-4 mr-2" />
          {isAuthenticated
            ? selected
              ? `Challenge ${selected.handle ? `@${selected.handle}` : opponentName(selected)}`
              : "Select an opponent"
            : "Sign in to challenge"}
        </Button>
      </div>
    </div>
  );
}

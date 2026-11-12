import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { StanceChip, type Person } from "@/components/OpinionDeckCard";
import type { Stance } from "@/lib/stance";
import { OpponentPicker } from "@/components/OpponentPicker";
import type { Opponent } from "@/lib/opponentSides";

export type CounterpointCardItem = {
  id: string;
  opinionId: string;
  sentenceIndex: number;
  authorUserId: string;
  content: string;
  paragraphText: string | null;
  createdAt: string;
  author: Person & { id?: string };
  likeCount: number;
  likedByMe: boolean;
  /** The counterpoint author's stance on this topic, if they have an opinion. */
  authorStance?: Stance | null;
};

const shell =
  "w-full h-full rounded-xl border bg-card shadow-md text-card-foreground overflow-hidden flex flex-col deck-card-surface";

function initials(p: Person) {
  return `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function CounterpointAuthorRow({
  author,
  stance,
}: {
  author: Person;
  stance?: Stance | null;
}) {
  const name = [author.firstName, author.lastName].filter(Boolean).join(" ") || "Someone";
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={author.profileImageUrl || undefined} alt={name} />
        <AvatarFallback className="text-xs">{initials(author)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-serif text-sm font-semibold truncate">{name}</span>
          {stance ? <StanceChip stance={stance} /> : null}
        </div>
        {author.handle ? (
          <UserHandle handle={author.handle} className="text-xs text-muted-foreground" />
        ) : null}
      </div>
    </div>
  );
}

export function CounterpointDeckFront({ item }: { item: CounterpointCardItem }) {
  const para = item.sentenceIndex + 1;
  return (
    <div className={`${shell} p-4`} data-testid={`counterpoint-card-front-${item.id}`}>
      <CounterpointAuthorRow author={item.author} stance={item.authorStance} />
      <div className="mt-3 h-px bg-foreground/15" />
      <div className="mt-3 flex items-center gap-2">
        <span className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">
          Counterpoint
        </span>
        <span className="font-ui text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
          on ¶{para}
        </span>
      </div>
      <p className="mt-3 font-serif text-[1.05rem] leading-relaxed flex-1 overflow-y-auto">
        {item.content}
      </p>
    </div>
  );
}

export function CounterpointDeckBack({
  item,
  people,
  originalAuthorId,
  originalAuthorStance,
  meId,
  isAuthenticated,
  canLike,
  onLike,
  onChallenge,
  onNeedSignIn,
  likePending,
  challengePending,
}: {
  item: CounterpointCardItem;
  people: Opponent[];
  originalAuthorId: string;
  originalAuthorStance?: Stance | null;
  meId?: string | null;
  isAuthenticated: boolean;
  canLike: boolean;
  onLike: () => void;
  onChallenge: (opponent: Opponent, side: "for" | "against") => void;
  onNeedSignIn: () => void;
  likePending?: boolean;
  challengePending?: boolean;
}) {
  return (
    <div className={`${shell} p-4`} data-testid={`counterpoint-card-back-${item.id}`}>
      <OpponentPicker
        meId={meId}
        isAuthenticated={isAuthenticated}
        people={people}
        counterpointAuthorId={item.authorUserId}
        originalAuthorId={originalAuthorId}
        counterpointAuthorStance={item.authorStance}
        originalAuthorStance={originalAuthorStance}
        likedByMe={item.likedByMe}
        likeCount={item.likeCount}
        canLike={canLike}
        likePending={likePending}
        onLike={onLike}
        onChallenge={onChallenge}
        challengePending={challengePending}
        onNeedSignIn={onNeedSignIn}
      />
    </div>
  );
}

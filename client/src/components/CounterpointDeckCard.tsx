import { Heart, Swords } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { Button } from "@/components/ui/button";
import { StanceChip, type Person } from "@/components/OpinionDeckCard";
import type { Stance } from "@/lib/stance";

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
  isOpinionAuthor,
  canLike,
  onLike,
  onStartDebate,
  likePending,
  debatePending,
}: {
  item: CounterpointCardItem;
  isOpinionAuthor: boolean;
  canLike: boolean;
  onLike: () => void;
  onStartDebate: () => void;
  likePending?: boolean;
  debatePending?: boolean;
}) {
  const para = item.sentenceIndex + 1;
  return (
    <div className={`${shell} p-4`} data-testid={`counterpoint-card-back-${item.id}`}>
      <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">
        Actions
      </p>
      <div className="mt-3 h-px bg-foreground/15" />
      <div className="mt-4 space-y-3">
        <Button
          type="button"
          variant={item.likedByMe ? "default" : "outline"}
          className="w-full justify-start"
          disabled={!canLike || likePending}
          onClick={onLike}
          data-testid={`button-like-counterpoint-${item.id}`}
        >
          <Heart className={`w-4 h-4 mr-2 ${item.likedByMe ? "fill-current" : ""}`} />
          {item.likedByMe ? "Liked" : "Like"} · {item.likeCount}
        </Button>
        {isOpinionAuthor ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={debatePending}
            onClick={onStartDebate}
            data-testid={`button-start-debate-${item.id}`}
          >
            <Swords className="w-4 h-4 mr-2" />
            Start a debate
          </Button>
        ) : null}
      </div>
      <div className="mt-auto pt-4 border-t border-foreground/15">
        <p className="font-ui text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground mb-1">
          On ¶{para} of the original
        </p>
        <p className="font-serif text-sm italic text-muted-foreground line-clamp-4">
          {item.paragraphText || "This counterpoint answers a paragraph of the original opinion."}
        </p>
      </div>
    </div>
  );
}

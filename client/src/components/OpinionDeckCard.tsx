import { useQuery } from "@tanstack/react-query";
import { UserHandle } from "@/components/UserHandle";
import type { Opinion } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, MessageSquareReply, RotateCcw, ThumbsDown, ThumbsUp, UserPlus } from "lucide-react";
import { InteractiveSentenceText } from "@/components/InteractiveSentenceText";
import { getOpinionGradientStyle } from "@/lib/politicalColors";
import { getOpinionStance, stanceLabel } from "@/lib/stance";

type Op = Opinion & { author?: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null } | null; userVote?: { voteType?: string } | null };

export function opinionAuthorName(op: Op): string {
  const a = op.author;
  const name = a ? `${a.firstName || ""} ${a.lastName || ""}`.trim() : "";
  return name || "Anonymous";
}

/** Counterpoint counts per paragraph for one opinion (same query key the topic page already uses). */
export function useCounterpointCounts(opinionId: string | undefined) {
  const { data } = useQuery({
    queryKey: ["/api/opinions", opinionId, "counterpoint-counts"] as const,
    queryFn: async () => {
      const r = await fetch(`/api/opinions/${opinionId}/counterpoints/counts`);
      if (!r.ok) throw new Error("Failed to fetch counterpoint counts");
      return r.json();
    },
    enabled: !!opinionId,
  });
  const rows: { sentenceIndex: number; count: number }[] = Array.isArray(data)
    ? data.map((r: any) => ({ sentenceIndex: Number(r?.sentenceIndex), count: Number(r?.count) || 0 })).filter((r) => Number.isFinite(r.sentenceIndex))
    : [];
  const byIndex = new Map(rows.map((r) => [r.sentenceIndex, r.count]));
  const total = rows.reduce((a, r) => a + r.count, 0);
  const firstWithCounterpoints = rows.filter((r) => r.count > 0).sort((a, b) => a.sentenceIndex - b.sentenceIndex)[0]?.sentenceIndex ?? 0;
  return { byIndex, total, firstWithCounterpoints };
}

function StanceBadge({ op }: { op: Op }) {
  const s = getOpinionStance(op);
  if (!s) return <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-stance-${op.id}`}>No stance</Badge>;
  const cls = s === "for" ? "bg-stance-for text-primary-foreground" : s === "against" ? "bg-stance-against text-primary-foreground" : "bg-stance-neutral text-primary-foreground";
  return <Badge className={cls} data-testid={`badge-stance-${op.id}`}>{stanceLabel[s]}</Badge>;
}

function AuthorRow({ op }: { op: Op }) {
  const name = opinionAuthorName(op);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-9 w-9 flex-shrink-0">
        {op.author?.profileImageUrl ? <AvatarImage src={op.author.profileImageUrl} alt={name} /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex flex-col">
        <span className="font-semibold truncate leading-tight" data-testid={`text-opinion-author-${op.id}`}>{name}</span>
        <UserHandle handle={(op.author as any)?.handle} testId={`text-opinion-handle-${op.id}`} />
      </span>
      <span className="ml-auto flex-shrink-0"><StanceBadge op={op} /></span>
    </div>
  );
}

const shell = "w-full h-full rounded-xl border bg-card shadow-md text-card-foreground flex flex-col overflow-hidden p-4";

export function OpinionDeckFront({ op, onSelectParagraph }: { op: Op; onSelectParagraph: (paragraphIndex: number) => void }) {
  const { byIndex } = useCounterpointCounts(op.id);
  return (
    <div className={`${shell} relative`} data-testid={`opinion-card-front-${op.id}`}>
      {/* Political-colour tint layered over an opaque card so cards underneath never show through */}
      <div className="absolute inset-0 pointer-events-none" style={getOpinionGradientStyle(op.topicEconomicScore, op.topicAuthoritarianScore)} aria-hidden />
      <div className="relative flex flex-col flex-1 min-h-0">
      <AuthorRow op={op} />
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain pr-1">
        <InteractiveSentenceText
          text={op.content}
          segmentMode="paragraph"
          paragraphsClickable={false}
          interactionCount={(i) => byIndex.get(i) ?? 0}
          selectedSentenceIndex={null}
          onSelectSentence={onSelectParagraph}
        />
      </div>
      <p className="pt-2 text-xs text-muted-foreground text-center flex-shrink-0">Tap card for votes &amp; actions</p>
      </div>
    </div>
  );
}

export interface OpinionDeckBackProps {
  op: Op;
  onVote: (voteType: "like" | "dislike") => void;
  onAdopt: () => void;
  onFlag: () => void;
  onSeeCounterpoints: (paragraphIndex: number) => void;
}

export function OpinionDeckBack({ op, onVote, onAdopt, onFlag, onSeeCounterpoints }: OpinionDeckBackProps) {
  const { total, firstWithCounterpoints } = useCounterpointCounts(op.id);
  const vote = op.userVote?.voteType;
  const likes = Number(op.likesCount) || 0;
  const dislikes = Number(op.dislikesCount) || 0;
  return (
    <div className={shell} data-testid={`opinion-card-back-${op.id}`}>
      <AuthorRow op={op} />
      {/* Opinion text first; every action sits below it. */}
      <p className="mt-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words line-clamp-4 flex-shrink min-h-0 overflow-hidden">{op.content}</p>
      <div className="pt-3 space-y-2 flex-shrink-0">
        <div className="grid grid-cols-3 text-center text-xs text-muted-foreground border-y py-1.5">
          <div><div className="text-lg font-semibold text-foreground tabular-nums">{likes}</div>likes</div>
          <div><div className="text-lg font-semibold text-foreground tabular-nums">{dislikes}</div>dislikes</div>
          <div><div className="text-lg font-semibold text-foreground tabular-nums">{total}</div>counterpoints</div>
        </div>
        <Button size="sm" className="w-full" onClick={() => onSeeCounterpoints(firstWithCounterpoints)} data-testid={`button-see-counterpoints-${op.id}`}>
          <MessageSquareReply className="w-4 h-4 mr-1.5" /> See counterpoints{total > 0 ? ` (${total})` : ""}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={vote === "like" ? "default" : "outline"} onClick={() => onVote("like")} data-testid={`button-like-${op.id}`}>
            <ThumbsUp className="w-4 h-4 mr-1.5" /> Like
          </Button>
          <Button size="sm" variant={vote === "dislike" ? "destructive" : "outline"} onClick={() => onVote("dislike")} data-testid={`button-dislike-${op.id}`}>
            <ThumbsDown className="w-4 h-4 mr-1.5" /> Dislike
          </Button>
          <Button size="sm" variant="outline" onClick={onAdopt} data-testid={`button-adopt-${op.id}`}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Adopt
          </Button>
          <Button size="sm" variant="outline" onClick={onFlag} data-testid={`button-flag-opinion-${op.id}`}>
            <Flag className="w-4 h-4 mr-1.5" /> Flag
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1"><RotateCcw className="w-3 h-3" /> Tap card to flip back</p>
      </div>
    </div>
  );
}

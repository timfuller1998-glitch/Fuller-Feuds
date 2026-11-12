import { Link } from "wouter";
import type { Opinion } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { StanceChip, type Person } from "@/components/OpinionDeckCard";
import { getOpinionStance } from "@/lib/stance";

const shell =
  "w-full h-full rounded-xl border bg-card shadow-md text-card-foreground overflow-hidden flex flex-col deck-card-surface";

export type SummaryParagraphCard = {
  index: number;
  total: number;
  text: string;
  topicId: string;
  opinions: Opinion[];
  counterpointCountFor: (opinionId: string) => number;
};

function nameOf(op: Opinion) {
  const a = (op as Opinion & { author?: Person | null }).author;
  const name = a ? `${a.firstName || ""} ${a.lastName || ""}`.trim() : "";
  return name || "Anonymous";
}

function initials(name: string) {
  return name.slice(0, 1).toUpperCase() || "?";
}

export function SummaryParagraphFront({ item }: { item: SummaryParagraphCard }) {
  const refs = item.opinions.length;
  const cps = item.opinions.reduce((a, op) => a + item.counterpointCountFor(op.id), 0);
  return (
    <div className={`${shell} p-4`} data-testid={`summary-card-front-${item.index}`}>
      <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">
        AI Summary
      </p>
      <p className="mt-1 font-ui text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
        ¶ {item.index + 1} of {item.total}
      </p>
      <div className="mt-3 h-px bg-[hsl(var(--gold)/0.45)]" />
      <p className="mt-4 font-serif text-base leading-relaxed flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain pr-1">
        {item.text}
      </p>
      <div className="mt-3 pt-3 border-t border-foreground/15 shrink-0">
        <p className="font-ui text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground text-center">
          {refs === 0
            ? "Tap to see referenced opinions"
            : `${refs} referenced opinion${refs === 1 ? "" : "s"}${cps ? ` · ${cps} counterpoint${cps === 1 ? "" : "s"}` : ""} · tap to flip`}
        </p>
      </div>
    </div>
  );
}

export function SummaryParagraphBack({ item }: { item: SummaryParagraphCard }) {
  return (
    <div className={`${shell} p-4`} data-testid={`summary-card-back-${item.index}`}>
      <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">
        Referenced opinions
      </p>
      <p className="mt-1 font-ui text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
        ¶ {item.index + 1} of {item.total}
      </p>
      <div className="mt-3 h-px bg-[hsl(var(--gold)/0.45)]" />
      {item.opinions.length === 0 ? (
        <p className="mt-4 font-serif text-base italic text-muted-foreground">
          This paragraph doesn't cite a specific opinion yet.
        </p>
      ) : (
        <ul className="mt-3 flex-1 min-h-0 overflow-y-auto touch-pan-y overscroll-contain space-y-2 pr-0.5">
          {item.opinions.map((op) => {
            const author = (op as Opinion & { author?: Person | null }).author;
            const name = nameOf(op);
            const stance = getOpinionStance(op);
            const n = item.counterpointCountFor(op.id);
            const excerpt = (op.content || "").replace(/\s+/g, " ").trim();
            return (
              <li key={op.id} className="rounded-lg border border-foreground/10 bg-background/40 p-2.5">
                <Link
                  href={`/topic/${item.topicId}?opinion=${op.id}`}
                  className="flex items-start gap-2.5 min-w-0"
                  data-testid={`link-summary-opinion-${op.id}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={author?.profileImageUrl || undefined} alt={name} />
                    <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="font-serif text-sm font-semibold leading-tight">{name}</span>
                    <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      {stance ? <StanceChip stance={stance} /> : null}
                      {author?.handle ? (
                        <UserHandle handle={author.handle} className="text-xs text-muted-foreground" />
                      ) : null}
                    </span>
                    {excerpt ? (
                      <span className="mt-1 block font-serif text-sm italic text-muted-foreground line-clamp-2">
                        {excerpt}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <Link
                  href={`/opinion/${op.id}/counterpoints`}
                  className="mt-2 inline-flex font-ui text-[0.65rem] uppercase tracking-[0.1em] text-primary hover:underline"
                  data-testid={`link-summary-counterpoints-${op.id}`}
                >
                  See counterpoints{n > 0 ? ` (${n})` : ""} →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

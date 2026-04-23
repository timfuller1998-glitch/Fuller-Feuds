import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Sentence = {
  index: number;
  text: string;
};

function splitIntoSentences(text: string): Sentence[] {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  // Simple sentence split: . ! ? followed by space and a capital/number/quote.
  // This is intentionally heuristic; we can refine later.
  // Use a non-capturing group inside the lookahead so split() does not inject
  // capture values (undefined) into the result array — those caused .trim() crashes.
  const parts = normalized
    .split(/(?<=[.!?])\s+(?=(?:["'(\[])?[A-Z0-9])/g)
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  return parts.map((p, idx) => ({ index: idx, text: p }));
}

/** Paragraphs = blocks separated by a blank line (one or more newlines with optional spaces). */
function splitIntoParagraphs(text: string): Sentence[] {
  const normalized = (text || "").replace(/\r\n/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/\n(?:\s*\n)+/)
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);

  return parts.map((p, idx) => ({ index: idx, text: p }));
}

export function InteractiveSentenceText(props: {
  /** Full text to split when `chunks` is not provided. */
  text?: string;
  /** One interactive segment per entry (index matches API, e.g. cumulative summary sentences). */
  chunks?: string[];
  segmentMode?: "sentence" | "paragraph";
  /** When set, stacked segments with count &gt; 0 get a light highlight and a numeric badge. */
  interactionCount?: (segmentIndex: number) => number;
  /** Affects the hover title on the count badge (counterpoints vs referenced opinions). */
  interactionKind?: "counterpoints" | "references";
  selectedSentenceIndex: number | null;
  onSelectSentence: (sentenceIndex: number) => void;
  className?: string;
  sentenceClassName?: string;
  selectedSentenceClassName?: string;
  renderAfterSentence?: (sentence: Sentence) => React.ReactNode;
}) {
  const stacked = props.chunks !== undefined || props.segmentMode === "paragraph";

  const sentences = useMemo(() => {
    if (props.chunks !== undefined) {
      return props.chunks.map((raw, index) => ({
        index,
        text: typeof raw === "string" ? raw : "",
      }));
    }
    const t = props.text ?? "";
    if (props.segmentMode === "paragraph") return splitIntoParagraphs(t);
    return splitIntoSentences(t);
  }, [props.chunks, props.text, props.segmentMode]);

  return (
    <div
      className={cn(
        "text-base leading-relaxed whitespace-pre-wrap",
        stacked && "flex flex-col gap-2",
        props.className
      )}
    >
      {sentences.length === 0 ? (
        <span className="text-muted-foreground">No text yet.</span>
      ) : stacked ? (
        sentences.map((s) => {
          const isSelected = props.selectedSentenceIndex === s.index;
          const n = props.interactionCount?.(s.index) ?? 0;
          const hasInteraction = n > 0;
          const kind = props.interactionKind ?? "counterpoints";
          const badgeTitle =
            kind === "references"
              ? `${n} referenced opinion${n === 1 ? "" : "s"}`
              : `${n} counterpoint${n === 1 ? "" : "s"}`;
          return (
            <span key={s.index} className="block">
              <button
                type="button"
                onClick={() => props.onSelectSentence(s.index)}
                title={hasInteraction ? badgeTitle : undefined}
                className={cn(
                  "flex w-full gap-2 items-stretch rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hasInteraction && "border-primary/25 bg-primary/[0.06] shadow-sm hover:bg-primary/[0.08]",
                  isSelected && "bg-muted ring-2 ring-ring",
                  props.sentenceClassName,
                  isSelected && props.selectedSentenceClassName
                )}
              >
                <span className="flex-1 min-w-0 whitespace-pre-wrap">{s.text}</span>
                {hasInteraction ? (
                  <span className="flex shrink-0 items-start pt-0.5">
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-[1.25rem] justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                    >
                      {n > 99 ? "99+" : n}
                    </Badge>
                  </span>
                ) : null}
              </button>
              {props.renderAfterSentence?.(s)}
            </span>
          );
        })
      ) : (
        sentences.map((s) => {
          const isSelected = props.selectedSentenceIndex === s.index;
          return (
            <span key={s.index}>
              <button
                type="button"
                onClick={() => props.onSelectSentence(s.index)}
                className={cn(
                  "inline text-left rounded-md px-1 -mx-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  props.sentenceClassName,
                  isSelected && "bg-muted",
                  isSelected && props.selectedSentenceClassName
                )}
              >
                {s.text}
              </button>
              {props.renderAfterSentence?.(s)}
              <span> </span>
            </span>
          );
        })
      )}
    </div>
  );
}


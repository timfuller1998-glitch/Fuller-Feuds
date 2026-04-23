import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type Sentence = {
  index: number;
  text: string;
};

function splitIntoSentences(text: string): Sentence[] {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

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

/** Last sentence-ending punctuation in the paragraph (for anchoring the count chip). */
function splitAtLastSentencePunct(text: string): { before: string; punct: string; tail: string } {
  let best = -1;
  let punctChar = "";
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i];
    if (c === "." || c === "!" || c === "?") {
      best = i;
      punctChar = c;
      break;
    }
  }
  if (best < 0) return { before: text, punct: "", tail: "" };
  return {
    before: text.slice(0, best),
    punct: punctChar,
    tail: text.slice(best + 1),
  };
}

function EndCountChip({
  n,
  title,
}: {
  n: number;
  title: string;
}) {
  return (
    <span
      className="pointer-events-none absolute bottom-full left-1/2 z-[1] mb-0.5 -translate-x-1/2 whitespace-nowrap"
      title={title}
    >
      <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold tabular-nums text-secondary-foreground shadow-sm ring-1 ring-border">
        {n > 99 ? "99+" : n}
      </span>
    </span>
  );
}

export function InteractiveSentenceText(props: {
  text?: string;
  chunks?: string[];
  segmentMode?: "sentence" | "paragraph";
  interactionCount?: (segmentIndex: number) => number;
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
        "text-base leading-relaxed",
        !stacked && "whitespace-pre-wrap",
        stacked && "max-w-none space-y-0 text-pretty",
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
          const { before, punct, tail } = splitAtLastSentencePunct(s.text);

          return (
            <span key={s.index} className="block">
              <button
                type="button"
                onClick={() => props.onSelectSentence(s.index)}
                title={hasInteraction ? badgeTitle : undefined}
                className={cn(
                  "mb-5 block w-full max-w-none cursor-pointer rounded-lg border border-transparent px-2 py-2 text-left text-base leading-relaxed transition-colors last:mb-0 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "whitespace-pre-wrap",
                  hasInteraction && "border-primary/20 bg-primary/[0.07] shadow-sm hover:bg-primary/[0.09]",
                  isSelected && "bg-muted/90 ring-2 ring-ring ring-offset-2 ring-offset-background",
                  props.sentenceClassName,
                  isSelected && props.selectedSentenceClassName
                )}
              >
                {punct ? (
                  <>
                    <span>{before}</span>
                    <span className="relative inline">
                      {punct}
                      {hasInteraction ? <EndCountChip n={n} title={badgeTitle} /> : null}
                    </span>
                    <span>{tail}</span>
                  </>
                ) : (
                  <>
                    <span>{before}</span>
                    {hasInteraction ? (
                      <span className="relative inline align-baseline">
                        {"\u200b"}
                        <EndCountChip n={n} title={badgeTitle} />
                      </span>
                    ) : null}
                  </>
                )}
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

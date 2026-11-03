import { useMemo } from "react";
import { MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitIntoParagraphs } from "@/lib/textSegments";

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
  /** Override the badge text for a paragraph with n interactions. */
  badgeLabel?: (n: number) => string;
  /** When false, only the badge is tappable (e.g. inside a flippable card). Default true. */
  paragraphsClickable?: boolean;
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
        stacked && "max-w-none text-pretty",
        props.className
      )}
    >
      {sentences.length === 0 ? (
        <span className="text-muted-foreground">No text yet.</span>
      ) : stacked ? (
        sentences.map((s) => {
          const n = props.interactionCount?.(s.index) ?? 0;
          const kind = props.interactionKind ?? "counterpoints";
          const label =
            props.badgeLabel?.(n) ??
            (kind === "references"
              ? `${n} referenced opinion${n === 1 ? "" : "s"}`
              : `${n} counterpoint${n === 1 ? "" : "s"}`);
          const clickable = props.paragraphsClickable !== false;
          const select = () => props.onSelectSentence(s.index);

          return (
            <div key={s.index} className="mb-5 last:mb-0" data-paragraph-index={s.index}>
              <p
                {...(clickable
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: select,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") select();
                      },
                    }
                  : {})}
                className={cn(
                  "whitespace-pre-wrap break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                  clickable && "cursor-pointer",
                  props.sentenceClassName
                )}
              >
                {s.text}
              </p>
              {n > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    select();
                  }}
                  className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`badge-paragraph-${s.index}`}
                  aria-label={label}
                >
                  <MessageSquareReply className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              )}
              {props.renderAfterSentence?.(s)}
            </div>
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

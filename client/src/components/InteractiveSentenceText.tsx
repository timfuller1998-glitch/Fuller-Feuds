import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type Sentence = {
  index: number;
  text: string;
};

function splitIntoSentences(text: string): Sentence[] {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  // Simple sentence split: . ! ? followed by space and a capital/number/quote.
  // This is intentionally heuristic; we can refine later.
  const parts = normalized
    .split(/(?<=[.!?])\s+(?=(["'(\[])?[A-Z0-9])/g)
    .map(s => s.trim())
    .filter(Boolean);

  return parts.map((p, idx) => ({ index: idx, text: p }));
}

export function InteractiveSentenceText(props: {
  text: string;
  selectedSentenceIndex: number | null;
  onSelectSentence: (sentenceIndex: number) => void;
  className?: string;
  sentenceClassName?: string;
  selectedSentenceClassName?: string;
  renderAfterSentence?: (sentence: Sentence) => React.ReactNode;
}) {
  const sentences = useMemo(() => splitIntoSentences(props.text), [props.text]);

  return (
    <div className={cn("text-base leading-relaxed whitespace-pre-wrap", props.className)}>
      {sentences.length === 0 ? (
        <span className="text-muted-foreground">No text yet.</span>
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


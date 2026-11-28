import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  analyzeOpinion,
  OPINION_PART_IDS,
  OPINION_PART_META,
  STRENGTH_LEVEL_LABEL,
  structurePrompt,
  type OpinionPartId,
} from "@shared/opinionStrength";
import { Button } from "@/components/ui/button";
import { useBareOpinionGuard } from "@/hooks/useBareOpinionGuard";

interface OpinionStructureProps {
  text: string;
  topicTitle?: string | null;
  /** Tighter layout for narrow cards (onboarding). */
  compact?: boolean;
}

export function OpinionStructure({ text, topicTitle, compact = false }: OpinionStructureProps) {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(() => analyzeOpinion(text), [text]);
  const prompt = structurePrompt(topicTitle);

  const coveredLabels = OPINION_PART_IDS
    .filter((id) => result.parts[id])
    .map((id) => OPINION_PART_META[id].shortLabel);
  const aria = result.wordCount === 0
    ? "Opinion strength: empty. Start with your stance and a reason."
    : `Opinion strength: ${STRENGTH_LEVEL_LABEL[result.level]}. ${
        coveredLabels.length ? `${coveredLabels.join(", ")} covered.` : "No parts covered yet."
      }`;

  return (
    <div className="opinion-structure space-y-2" data-testid="opinion-structure">
      <p className="font-ui text-xs text-muted-foreground leading-snug" data-testid="opinion-structure-prompt">
        {prompt}
        <button
          type="button"
          className="ml-1 inline-flex items-center gap-0.5 text-[hsl(var(--gold))] hover:underline underline-offset-2"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-testid="button-structure-toggle"
        >
          {expanded ? "Hide guide" : "What to include"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </p>

      {expanded && (
        <ul className="space-y-1 rounded-none border border-border bg-muted/40 px-3 py-2" data-testid="opinion-structure-guide">
          {OPINION_PART_IDS.map((id) => {
            const meta = OPINION_PART_META[id];
            return (
              <li key={id} className="text-xs leading-snug">
                <span className="font-ui font-medium text-foreground">
                  {meta.label}
                  {meta.optional ? " (optional)" : ""}.
                </span>{" "}
                <span className="text-muted-foreground">{meta.hint}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={`flex flex-wrap gap-1 ${compact ? "gap-0.5" : ""}`} data-testid="opinion-structure-chips">
        {OPINION_PART_IDS.map((id) => (
          <PartChip key={id} id={id} on={result.parts[id]} />
        ))}
      </div>

      <div className="flex items-center gap-2" data-testid="opinion-strength-meter">
        <div
          className="opinion-strength-track h-1.5 flex-1 overflow-hidden"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={result.score}
          aria-valuetext={STRENGTH_LEVEL_LABEL[result.level]}
          aria-label={aria}
        >
          <div
            className="opinion-strength-fill h-full"
            style={{ width: `${result.score}%` }}
            data-testid="opinion-strength-fill"
          />
        </div>
        <span
          className="font-ui text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground shrink-0 min-w-12 text-right"
          data-testid="opinion-strength-level"
        >
          {STRENGTH_LEVEL_LABEL[result.level]}
          {result.wordCount > 0 && (
            <span className="text-[hsl(var(--gold))]" data-testid="opinion-strength-xp">{` · ${result.xp} XP`}</span>
          )}
        </span>
      </div>
      {result.stuffed && (
        <p className="font-ui text-xs text-muted-foreground leading-snug" data-testid="opinion-strength-stuffed">
          Phrases like "because" only count when real content follows them.
        </p>
      )}
    </div>
  );
}

function PartChip({ id, on }: { id: OpinionPartId; on: boolean }) {
  const meta = OPINION_PART_META[id];
  return (
    <span
      data-testid={`chip-${id}`}
      data-covered={on ? "true" : "false"}
      className={
        on
          ? "font-ui text-[0.65rem] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.16)] text-[hsl(var(--gold))]"
          : "font-ui text-[0.65rem] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-border text-muted-foreground"
      }
    >
      {meta.shortLabel}
    </span>
  );
}

interface BareOpinionTipProps {
  open: boolean;
  onKeepWriting: () => void;
  onPostAnyway: () => void;
  /** Label on the confirm action, e.g. "Post anyway" or "Create anyway". */
  anywayLabel?: string;
}

export function BareOpinionTip({
  open,
  onKeepWriting,
  onPostAnyway,
  anywayLabel = "Post anyway",
}: BareOpinionTipProps) {
  if (!open) return null;
  return (
    <div
      role="status"
      className="rounded-none border border-[hsl(var(--gold)/0.45)] bg-[hsl(var(--gold)/0.10)] px-3 py-2 space-y-2"
      data-testid="bare-opinion-tip"
    >
      <p className="font-ui text-sm text-foreground leading-snug">
        Add your reason? A one-word take is hard for others to engage with. You can still post it as-is.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onKeepWriting} data-testid="button-keep-writing">
          Keep writing
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onPostAnyway} data-testid="button-post-anyway">
          {anywayLabel}
        </Button>
      </div>
    </div>
  );
}

export { useBareOpinionGuard };

/**
 * Client-side opinion strength signals (Fuller Feuds Dev, Nov 20 2026).
 * Pure text checks — no API or model calls. The meter is a nudge only;
 * opinion scores still come from other users, and posting is never blocked.
 */

export const OPINION_PART_IDS = [
  "stance",
  "reason",
  "support",
  "otherSide",
  "openness",
] as const;

export type OpinionPartId = (typeof OPINION_PART_IDS)[number];

export type OpinionStrengthLevel = "bare" | "basic" | "solid" | "strong";

export const OPINION_PART_META: Record<
  OpinionPartId,
  { label: string; shortLabel: string; hint: string; optional?: boolean }
> = {
  stance: {
    label: "Your stance",
    shortLabel: "Stance",
    hint: "Where you land, in one line.",
  },
  reason: {
    label: "Your main reason",
    shortLabel: "Reason",
    hint: "The single strongest why behind it.",
  },
  support: {
    label: "Your support",
    shortLabel: "Support",
    hint: "A fact, an example or a personal experience, with an optional source link.",
  },
  otherSide: {
    label: "The other side",
    shortLabel: "Other side",
    hint: "The best point against you, and why it doesn't change your mind.",
  },
  openness: {
    label: "What would change your mind",
    shortLabel: "Open mind",
    hint: "It's great for the Open Mind skill.",
    optional: true,
  },
};

export const STRENGTH_LEVEL_LABEL: Record<OpinionStrengthLevel, string> = {
  bare: "Bare",
  basic: "Basic",
  solid: "Solid",
  strong: "Strong",
};

const STANCE_RE = [
  /\byes\b/i,
  /\byeah\b/i,
  /\byep\b/i,
  /\bnope\b/i,
  /\bno\b/i,
  /\bi\s+agree\b/i,
  /\bi\s+disagree\b/i,
  /\bagree(?:s|d)?\b/i,
  /\bdisagree(?:s|d)?\b/i,
  /\bshould(?:n['’]t| not)?\b/i,
  /\bmust(?:n['’]t| not)?\b/i,
  /\bought\s+to\b/i,
  /\bi\s+think\b/i,
  /\bi\s+believe\b/i,
  /\bi\s+feel\b/i,
  /\bin\s+my\s+(?:view|opinion)\b/i,
  /\bi\s+support\b/i,
  /\bi\s+oppose\b/i,
  /\bin\s+favou?r\b/i,
  /\bagainst\b/i,
  /\bsupport\b/i,
  /\boppose\b/i,
  /\bdefinitely\b/i,
  /\babsolutely\b/i,
];

const REASON_RE = [
  /\bbecause\b/i,
  /\bsince\b/i,
  /\btherefore\b/i,
  /\bwhich\s+means\b/i,
  /\bdue\s+to\b/i,
  /\bthat['’]?s\s+why\b/i,
  /\bthe\s+reason\b/i,
  /\bas\s+a\s+result\b/i,
  /\bconsequently\b/i,
  /\bhence\b/i,
  /\bso\s+that\b/i,
  /(?:,|;|\.|:)\s*so\b/i,
  /\band\s+so\b/i,
];

const SUPPORT_RE = [
  /https?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co)\b/i,
  /\b\d+(?:\.\d+)?%/i,
  /\b\d{1,3}(?:,\d{3})+\b/,
  /\b\d{2,}\b/,
  /\bfor\s+example\b/i,
  /\bfor\s+instance\b/i,
  /\be\.g\.?\b/i,
  /\bstudies\b/i,
  /\bstudy\b/i,
  /\bdata\b/i,
  /\bresearch\b/i,
  /\bevidence\b/i,
  /\baccording\s+to\b/i,
  /\bin\s+my\s+experience\b/i,
  /\bi(?:['’]ve| have)\s+seen\b/i,
  /\bpersonally\b/i,
];

const OTHER_SIDE_RE = [
  /\bhowever\b/i,
  /\bon\s+the\s+other\s+hand\b/i,
  /\bon\s+the\s+flip\s+side\b/i,
  /\bcritics\b/i,
  /\bsome\s+argue\b/i,
  /\bsome\s+say\b/i,
  /\bothers\s+(?:say|argue|claim)\b/i,
  /\badmittedly\b/i,
  /\balthough\b/i,
  /\bthough\b/i,
  /\bwhile\b/i,
  /\bwhereas\b/i,
  /\bopponents\b/i,
  /\beven\s+so\b/i,
  /\bthat\s+said\b/i,
  /\bnonetheless\b/i,
  /\bnevertheless\b/i,
  /\bi\s+grant\b/i,
  /\bfair\s+point\b/i,
];

const OPENNESS_RE = [
  /\bwould\s+change\s+my\s+mind\b/i,
  /\bchange\s+my\s+mind\b/i,
  /\bunless\b/i,
  /\bif\s+it\s+turned\s+out\b/i,
  /\bif\s+it\s+turns\s+out\b/i,
  /\bi\s+could\s+be\s+wrong\b/i,
  /\bi\s+might\s+be\s+wrong\b/i,
  /\bi\s+may\s+be\s+wrong\b/i,
  /\bopen\s+to\b/i,
  /\bi(?:['’]d| would)\s+reconsider\b/i,
  /\bif\s+(?:new\s+)?evidence\b/i,
];

export type OpinionPartsFound = Record<OpinionPartId, boolean>;

export interface OpinionStrength {
  wordCount: number;
  charCount: number;
  parts: OpinionPartsFound;
  /** 0–100, for the meter fill. */
  score: number;
  level: OpinionStrengthLevel;
  /**
   * True for one-word or very thin takes (like just "yes").
   * Used only for a non-blocking "Add your reason?" tip. Empty text is not bare
   * in this sense, because those posts can't be submitted anyway.
   */
  isBare: boolean;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const PART_POINTS: Record<OpinionPartId, number> = {
  stance: 16,
  reason: 28,
  support: 20,
  otherSide: 16,
  openness: 8,
};

function lengthPoints(wordCount: number): number {
  if (wordCount <= 0) return 0;
  if (wordCount <= 8) return 3;
  if (wordCount <= 24) return 7;
  if (wordCount <= 49) return 10;
  return 12;
}

function levelFor(score: number, isBare: boolean, wordCount: number): OpinionStrengthLevel {
  if (wordCount === 0 || isBare) return "bare";
  if (score < 40) return "basic";
  if (score < 70) return "solid";
  return "strong";
}

export function analyzeOpinion(text: string): OpinionStrength {
  const raw = text ?? "";
  const charCount = raw.trim().length;
  const wordCount = countWords(raw);

  const parts: OpinionPartsFound = {
    stance: matchesAny(raw, STANCE_RE),
    reason: matchesAny(raw, REASON_RE),
    support: matchesAny(raw, SUPPORT_RE),
    otherSide: matchesAny(raw, OTHER_SIDE_RE),
    openness: matchesAny(raw, OPENNESS_RE),
  };

  const partScore = (Object.keys(PART_POINTS) as OpinionPartId[]).reduce(
    (sum, id) => sum + (parts[id] ? PART_POINTS[id] : 0),
    0,
  );
  const score = Math.min(100, partScore + lengthPoints(wordCount));

  const isBare =
    wordCount > 0 &&
    !parts.reason &&
    (wordCount <= 8 || (wordCount <= 12 && !parts.support && !parts.otherSide));

  return {
    wordCount,
    charCount,
    parts,
    score,
    level: levelFor(score, isBare, wordCount),
    isBare,
  };
}

export function isBareOpinion(text: string): boolean {
  return analyzeOpinion(text).isBare;
}

/** One-line prompt that can mention the topic question. */
export function structurePrompt(topicTitle?: string | null): string {
  const base =
    "A strong opinion has a stance, a reason, support, and the other side.";
  const title = topicTitle?.trim();
  if (!title) return base;
  return `For “${title}”, say where you land and why — not just yes or no.`;
}

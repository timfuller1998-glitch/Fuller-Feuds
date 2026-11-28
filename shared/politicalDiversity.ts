// Deterministic political-diversity score from opinion leanings on a topic.
// economic: −100 left … +100 right; authoritarian: −100 libertarian … +100 authoritarian.

export const DIVERSITY_MIN_OPINIONS = 2;

export interface Lean {
  economic: number | null | undefined;
  authoritarian: number | null | undefined;
}

export interface DiversityResult {
  /** 0–100, or null when there aren't enough scored opinions to measure spread. */
  score: number | null;
  enough: boolean;
  counted: number;
}

const clamp = (v: number) => Math.max(-100, Math.min(100, v));

function popStdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * How spread out a topic's opinion leanings are, as 0–100.
 *
 * Uses the population RMS of the two axis standard deviations, so a full
 * left-vs-right (or auth-vs-lib) split scores 100, and a moderate split on
 * one axis (e.g. −30 vs +35) scores in the 30s — not 0. Quadrant-count
 * entropy was a poor fit because most users are moderate and never land in
 * a ±20 quadrant.
 *
 * Fewer than two opinions with both scores: not enough to measure (score is null).
 */
export function politicalDiversity(leans: Lean[]): DiversityResult {
  const pts = leans
    .filter((l) => l.economic != null && l.authoritarian != null)
    .map((l) => ({ economic: Number(l.economic), authoritarian: Number(l.authoritarian) }))
    .filter((p) => Number.isFinite(p.economic) && Number.isFinite(p.authoritarian))
    .map((p) => ({ economic: clamp(p.economic), authoritarian: clamp(p.authoritarian) }));

  if (pts.length < DIVERSITY_MIN_OPINIONS) {
    return { score: null, enough: false, counted: pts.length };
  }

  const sdE = popStdev(pts.map((p) => p.economic));
  const sdA = popStdev(pts.map((p) => p.authoritarian));
  const score = Math.round(Math.min(100, Math.hypot(sdE, sdA)));
  return { score, enough: true, counted: pts.length };
}

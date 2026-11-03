export type Stance = "for" | "against" | "neutral";

/** Reads an opinion's stance if it has one. Opinions currently have no stance column, so this is often null. */
export function getOpinionStance(op: unknown): Stance | null {
  const s = (op as { stance?: unknown } | null)?.stance;
  return s === "for" || s === "against" || s === "neutral" ? s : null;
}

export const stanceLabel: Record<Stance, string> = { for: "For", against: "Against", neutral: "Neutral" };

export function tallyStances(ops: unknown[]): Record<Stance | "unstated", number> {
  const t = { for: 0, against: 0, neutral: 0, unstated: 0 };
  for (const op of ops) t[getOpinionStance(op) ?? "unstated"]++;
  return t;
}

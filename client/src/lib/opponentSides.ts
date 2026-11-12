import type { Stance } from "@/lib/stance";

export type Opponent = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  handle?: string | null;
  profileImageUrl?: string | null;
  stance?: Stance | null;
  relation?: "author" | "original" | "liker" | "topic";
};

function dedupe(people: Opponent[]): Opponent[] {
  const seen = new Set<string>();
  const out: Opponent[] = [];
  for (const p of people) {
    if (!p.userId || seen.has(p.userId)) continue;
    seen.add(p.userId);
    out.push(p);
  }
  return out;
}

/**
 * Split people you can challenge into the two sides of this counterpoint.
 *
 * "Debate for" = opponents you face if you want to argue *for* the counterpoint
 * (the original opinion's side).
 * "Debate against" = opponents you face if you want to argue *against* it
 * (the counterpoint author and people who back that reply).
 *
 * Structural roles always lead: original author on "for", counterpoint author
 * (then likers) on "against". When the two sides have different topic stances,
 * other people on the topic fill in the matching side. If stances are missing
 * or the same, only the structural roles are used so nobody is listed twice.
 */
export function groupOpponents(opts: {
  meId?: string | null;
  counterpointAuthorId: string;
  originalAuthorId: string;
  counterpointAuthorStance?: Stance | null;
  originalAuthorStance?: Stance | null;
  people: Opponent[];
}): { forSide: Opponent[]; againstSide: Opponent[] } {
  const me = opts.meId || null;
  const people = dedupe(opts.people).filter((p) => p.userId !== me);

  const byId = new Map(people.map((p) => [p.userId, p]));
  const againstLead: Opponent[] = [];
  const forLead: Opponent[] = [];

  const cp = byId.get(opts.counterpointAuthorId);
  if (cp) againstLead.push({ ...cp, relation: cp.relation || "author" });
  for (const p of people) {
    if (p.relation === "liker" && p.userId !== opts.counterpointAuthorId) againstLead.push(p);
  }

  const orig = byId.get(opts.originalAuthorId);
  if (orig && orig.userId !== opts.counterpointAuthorId) {
    forLead.push({ ...orig, relation: orig.relation || "original" });
  }

  const used = new Set([...againstLead, ...forLead].map((p) => p.userId));
  const stancesDiffer =
    !!opts.counterpointAuthorStance &&
    !!opts.originalAuthorStance &&
    opts.counterpointAuthorStance !== opts.originalAuthorStance;

  if (stancesDiffer) {
    for (const p of people) {
      if (used.has(p.userId)) continue;
      if (p.stance === opts.counterpointAuthorStance) {
        againstLead.push(p);
        used.add(p.userId);
      } else if (p.stance === opts.originalAuthorStance) {
        forLead.push(p);
        used.add(p.userId);
      }
    }
  }

  return { forSide: dedupe(forLead), againstSide: dedupe(againstLead) };
}

export function opponentName(p: Opponent): string {
  return `${p.firstName || ""} ${p.lastName || ""}`.trim() || (p.handle ? `@${p.handle}` : "Someone");
}

export function relationLabel(relation?: Opponent["relation"]): string | null {
  if (relation === "author") return "Wrote this";
  if (relation === "original") return "Original opinion";
  if (relation === "liker") return "Liked this";
  return null;
}

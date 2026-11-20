// XP-tiered skill badges (Fuller Feuds Dev, Nov 20 2026).
// One config table for tiers and one for skills. Change thresholds here only; the server syncs
// the badge rows from this file on startup.

export type XpTierId = "bronze" | "silver" | "gold" | "diamond" | "platinum";

/** Tier ladder, lowest to highest. Timothy ranks platinum ABOVE diamond. */
export const XP_TIERS: { id: XpTierId; name: string; minXp: number; color: string }[] = [
  { id: "bronze", name: "Bronze", minXp: 200, color: "#9a5b2e" },
  { id: "silver", name: "Silver", minXp: 1_000, color: "#7d838c" },
  { id: "gold", name: "Gold", minXp: 5_000, color: "#b38a2e" },
  { id: "diamond", name: "Diamond", minXp: 10_000, color: "#3f7a99" },
  { id: "platinum", name: "Platinum", minXp: 20_000, color: "#5b5e78" },
];

export type SkillId = "critical_thinking" | "civility" | "open_mind" | "debating" | "opinions" | "topics";

/** Skills that earn XP. `rules` is the plain-English earning list shown on the profile. */
export const XP_SKILLS: { id: SkillId; name: string; icon: string; rules: string[] }[] = [
  {
    id: "critical_thinking",
    name: "Critical Thinking",
    icon: "Brain",
    rules: [
      "20 XP per point of Logic in each debate rating you receive (up to 100 per rating)",
      "5 XP per debate message nobody flagged as a fallacy",
      "10 XP per counterpoint you write",
    ],
  },
  {
    id: "civility",
    name: "Civility",
    icon: "HeartHandshake",
    rules: [
      "20 XP per point of Politeness in each debate rating you receive",
      "10 XP per debate you see through to the end",
    ],
  },
  {
    id: "open_mind",
    name: "Open Mind",
    icon: "DoorOpen",
    rules: [
      "20 XP per point of Openness in each debate rating you receive",
      "15 XP per debate challenge you accept",
    ],
  },
  {
    id: "debating",
    name: "Debating",
    icon: "MessagesSquare",
    rules: ["50 XP per debate you take part in", "5 XP per debate message you send"],
  },
  {
    id: "opinions",
    name: "Opinions",
    icon: "Lightbulb",
    rules: ["25 XP per opinion you share", "5 XP per like your opinions get from others"],
  },
  {
    id: "topics",
    name: "Topics",
    icon: "PlusCircle",
    rules: ["50 XP per topic you create", "5 XP per opinion others share on your topics"],
  },
];

export type SkillXp = Record<SkillId, number>;

/** Highest tier reached for an XP total, or null below Bronze. */
export function tierForXp(xp: number) {
  let reached: (typeof XP_TIERS)[number] | null = null;
  for (const t of XP_TIERS) if (xp >= t.minXp) reached = t;
  return reached;
}

/** Next tier above the current XP, or null at the top. */
export function nextTierForXp(xp: number) {
  return XP_TIERS.find((t) => xp < t.minXp) ?? null;
}

export const skillBadgeId = (skill: SkillId, tier: XpTierId) => `skill_${skill}_${tier}`;
export const skillRequirementType = (skill: SkillId) => `xp_${skill}`;

/** Badge rows generated from the two tables above (category "skill", tier 1..5). */
export const SKILL_BADGE_DEFINITIONS = XP_SKILLS.flatMap((s) =>
  XP_TIERS.map((t, i) => ({
    id: skillBadgeId(s.id, t.id),
    name: `${s.name} · ${t.name}`,
    description: `Reach ${t.minXp.toLocaleString("en-US")} ${s.name} XP`,
    icon: s.icon,
    category: "skill",
    tier: i + 1,
    requirement: t.minXp,
    requirementType: skillRequirementType(s.id),
  })),
);

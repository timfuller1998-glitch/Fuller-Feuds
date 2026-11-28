// Founding members (Fuller Feuds Dev, Nov 20 2026): shared constants for /apply, the admin Applications tab,
// invite codes and founder perks. Change numbers here; server and client both read them.

/**
 * Single-use "launch passes" each application-accepted founder gets on sign-up (stored as invite_codes.kind
 * 'founder'). A pass can't open an account while the site is invite-only; once the admin "public launch"
 * switch is on, it lets one person join with PASS_PREMIUM_MONTHS of premium. Pass holders aren't founders.
 */
export const FOUNDER_INVITE_CODES = 3;
export const FOUNDER_PASSES = FOUNDER_INVITE_CODES;
/** Months of free premium (ad-free) a launch pass gives the person who signs up with it. */
export const PASS_PREMIUM_MONTHS = 12;
/** subscription_tier given to launch-pass sign-ups (expires with subscription_expires_at). */
export const PASS_PREMIUM_TIER = "premium_gift";
export const PASS_LOCKED_MESSAGE = "This pass unlocks at public launch";
/** Founding Member numbers run #1..#100 and are never issued again. */
export const FOUNDER_CAP = 100;
/** Founding Member badge id (numbered via users.founder_number). */
export const FOUNDING_BADGE_ID = "founding_member";
/** Rubric total (out of 15) at or above which an applicant is a suggested "best pick". */
export const BEST_PICK_THRESHOLD = 10;
export const RUBRIC_MAX = { steelman: 5, goodFaith: 3, trackRecord: 3, clarity: 2, commitment: 2 } as const;
export type RubricKey = keyof typeof RUBRIC_MAX;
export type RubricScores = Record<RubricKey, number>;
export const RUBRIC_LABELS: Record<RubricKey, string> = {
  steelman: "Steelman quality",
  goodFaith: "Good faith",
  trackRecord: "Track record",
  clarity: "Clarity",
  commitment: "Commitment",
};

export const STEELMAN_PROMPTS = [
  "Make the best case for a policy your side usually opposes.",
  "Defend the opposite of your view on God's existence.",
  "Argue for the side you think is losing in a debate you follow.",
] as const;

export const INTEREST_AREAS = [
  "Politics",
  "Philosophy & religion",
  "Science & tech",
  "Economics",
  "Culture & media",
  "Sports",
  "Lifestyle",
] as const;

export const POLITICS_OPTIONS = ["Left", "Center-left", "Center", "Center-right", "Right", "Libertarian", "Other", "Prefer not to say"] as const;

/** Stored values stay as Left/Right; show Liberal/Conservative in the UI. */
export const POLITICS_OPTION_LABELS: Record<(typeof POLITICS_OPTIONS)[number] | string, string> = {
  Left: "Liberal",
  "Center-left": "Center-liberal",
  Center: "Center",
  "Center-right": "Center-conservative",
  Right: "Conservative",
  Libertarian: "Libertarian",
  Other: "Other",
  "Prefer not to say": "Prefer not to say",
};

export function politicsOptionLabel(value: string | null | undefined): string {
  if (!value) return "skipped";
  return POLITICS_OPTION_LABELS[value] ?? value;
}

export const RELIGION_OPTIONS = ["Religious", "Spiritual, not religious", "Not religious", "Unsure", "Prefer not to say"] as const;
export const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly or more" },
  { value: "monthly", label: "A few times a month" },
  { value: "occasionally", label: "Occasionally" },
] as const;
export type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"];

export const FOUNDERS_PLEDGE =
  "Argue the idea, not the person. Steelman before you rebut. Say so when you've been persuaded.";

export const APPLICATION_STATUSES = ["new", "accepted", "declined", "waitlisted"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Political bucket used for the viewpoint-mix tally (left / right / center & other). */
export function politicsBucket(p?: string | null): "left" | "right" | "center" | "unknown" {
  if (!p || p === "Prefer not to say") return "unknown";
  if (p === "Left" || p === "Center-left") return "left";
  if (p === "Right" || p === "Center-right") return "right";
  return "center";
}
export function religionBucket(r?: string | null): "religious" | "nonreligious" | "unsure" | "unknown" {
  if (!r || r === "Prefer not to say") return "unknown";
  if (r === "Religious" || r === "Spiritual, not religious") return "religious";
  if (r === "Not religious") return "nonreligious";
  return "unsure";
}

/** Sign-up link that opens the Create Account form with the code filled in. */
export function inviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/?invite=${encodeURIComponent(code)}`;
}

/** Ready-to-copy acceptance email Timothy sends by hand (no email provider). */
export function buildAcceptanceMessage(opts: { name: string; code: string; origin: string }): { subject: string; body: string } {
  const first = (opts.name || "there").trim().split(/\s+/)[0];
  const link = inviteLink(opts.origin, opts.code);
  return {
    subject: "You're in: welcome to Fuller Feuds as a founding member",
    body: `Hi ${first},

Thanks for applying. I'd love to have you as one of the founding members of Fuller Feuds. The first 100 people set the tone for everyone who comes after, and your application stood out.

Your invite code: ${opts.code}
It works once. Sign up here and it's filled in for you: ${link}

When you join you'll get a numbered Founding Member badge, access to the Founders' Room, and ${FOUNDER_INVITE_CODES} launch passes to give people you'd trust to argue in good faith. Each pass lets one person join the day we open to the public, with a year of premium free.

Three things to do this week:
1. Post one opinion on any topic.
2. Challenge someone to a debate, or accept one.
3. Watch our showcase debate live on Saturday afternoon at fullerfeuds.com/live.

Founders' pledge: ${FOUNDERS_PLEDGE}

Glad you're here,
Timothy Fuller
fullerfeuds.com`,
  };
}

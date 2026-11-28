/**
 * Opinion strength scorer (Fuller Feuds Dev, Nov 20 2026; rewritten Nov 27 2026).
 *
 * ONE module used by the live editor bar (client) and by the server, which recomputes it
 * from the saved text to award opinion XP and never trusts a client number.
 * Pure text checks: no API or model calls, so it is safe on every keystroke.
 *
 * Design (from Timothy's workshop chat, with its bugs fixed):
 *  - Topic-agnostic: no hardcoded subject words. It works for politics, religion, cars, recipes.
 *  - A cue phrase ("because", "on the other hand", "I tested") only counts if real content
 *    words follow it. "Yes because random.co on the other hand my mind is open" scores 0.
 *  - Personal experience counts as evidence. Openness has a low weight.
 *  - Stuffing penalty, a link-only-evidence cap, a repeated-word penalty, and short text is capped.
 *  - Quality 0-100 maps non-linearly to 0-25 XP, so nothing-burgers earn ~0.
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


// ---------------------------------------------------------------------------
// Tokenising
// ---------------------------------------------------------------------------

type Tok =
  | { t: "w"; lo: string; raw: string; sent: number; i: number }
  | { t: "url"; lo: string; raw: string; sent: number; i: number }
  | { t: "comma"; lo: string; raw: string; sent: number; i: number }
  | { t: "end"; lo: string; raw: string; sent: number; i: number };

const TOKEN_RE =
  /https?:\/\/\S+|www\.\S+|[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*%?|[,]|[.!?;:\n]+/gu;
const DOMAIN_RE =
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|edu|gov|io|co|uk|ch|info|us|ca|ai|me|tv|app|de|fr|au|ly|gl|xyz|biz)$/i;

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  let sent = 0;
  const matches = text.replace(/[’]/g, "'").match(TOKEN_RE) ?? [];
  for (const raw of matches) {
    const i = out.length;
    if (/^[.!?;:\n]+$/.test(raw)) {
      out.push({ t: "end", lo: raw, raw, sent, i });
      sent++;
    } else if (raw === ",") {
      out.push({ t: "comma", lo: ",", raw, sent, i });
    } else if (/^(https?:\/\/|www\.)/i.test(raw) || DOMAIN_RE.test(raw)) {
      out.push({ t: "url", lo: raw.toLowerCase(), raw, sent, i });
    } else {
      out.push({ t: "w", lo: raw.toLowerCase(), raw, sent, i });
    }
  }
  return out;
}

// Function words and filler. Cue-phrase words are here too, so that a cue never pads its own clause.
const STOP = new Set(
  (
    "a an the and or but nor so yet for of to in on at by with from into onto over under about as is are was were be been being am " +
    "it its it's this that these those there here then than too very really just also even still only own same such " +
    "i me my mine we us our ours you your yours he him his she her hers they them their theirs who whom whose which what when where why how " +
    "do does did done doing have has had having can could will would shall should may might must ought not no yes yeah yep nope ok okay " +
    "if else unless because since therefore hence thus however although though while whereas otherwise " +
    "think believe feel feels felt say says said argue argues argued claim claims claimed agree agrees disagree support oppose " +
    "mind open change changed wrong right sure maybe perhaps probably definitely absolutely certainly honestly basically literally actually " +
    "hand side view opinion take example instance experience personally critics opponents others people folks some any all each every both " +
    "thing things stuff something anything everything one ones lot lots many much more most less least few little bit kind sort way ways " +
    "get gets got going goes go make makes made let lets lol idk imo imho tbh etc like likes liked love hate dislike prefer " +
    "good bad nice great best worse worst better well fine okay cool " +
    "i'm i've i'd i'll we've we'd don't doesn't didn't can't won't isn't aren't wasn't weren't shouldn't wouldn't couldn't " +
    "that's there's he's she's what's let's they're you're we're they've you've they'd you'd"
  ).split(/\s+/),
);
// 2-letter words that are real content in some topics (EV, TV, AI...).
const SHORT_OK = new Set(["ev", "tv", "ai", "pc", "uk", "us", "eu", "un", "vw", "bmw", "gm", "ac", "dc", "hr", "id"]);

function isContent(tok: Tok): boolean {
  if (tok.t !== "w") return false;
  const w = tok.lo;
  if (STOP.has(w)) return false;
  if (/\d/.test(w)) return true; // numbers and things like "12g" are content
  if (w.length < 3 && !SHORT_OK.has(w)) return false;
  // Keyboard mash: long with no vowel, or one character repeated 4+ times.
  if (w.length >= 4 && !/[aeiouy]/.test(w)) return false;
  if (/(.)\1{3,}/.test(w)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Cues. Each is a phrase of lowercase tokens. A cue only counts with content after it.
// ---------------------------------------------------------------------------

type CueKind = "reason" | "other" | "open" | "exp" | "source";

const CUES: Record<CueKind, string[]> = {
  reason: [
    "because", "since", "so that", "the reason", "due to", "thanks to", "that's why", "which is why", "which means",
    "that means", "therefore", "as a result", "consequently", "hence", "in order to", "leads to", "results in",
  ],
  other: [
    "on the other hand", "however", "on the flip side", "critics", "opponents", "some argue", "some say", "some people",
    "some folks", "others argue", "others say", "others claim", "people say", "people argue", "people claim",
    "the counter", "the main counter", "the biggest counter", "the counterargument", "the objection", "the main objection",
    "the downside", "the drawback", "the other side", "the other view", "admittedly", "although", "even though",
    "that said", "fair point", "to be fair", "i understand why", "i get why", "granted", "nevertheless", "nonetheless",
    "i'll admit", "i admit", "the best argument against",
  ],
  open: [
    "would change my mind", "change my mind", "i could be wrong", "i might be wrong", "i may be wrong", "i'd reconsider",
    "i would reconsider", "unless", "if it turned out", "if it turns out", "if new evidence", "if evidence", "open to changing",
    "open to hearing", "depends on", "i'd change", "i would change", "if i saw", "if i were shown", "unless someone shows",
  ],
  exp: [
    "for example", "for instance", "e.g", "such as", "in my experience", "personally", "last time", "every time",
    "my own experience", "from experience", "my dad", "my mom", "my mother", "my father", "my friend", "my brother", "my sister",
    "my wife", "my husband", "my kids", "my family", "my neighbor",
  ],
  source: [
    "according to", "studies show", "studies found", "studies suggest", "a study", "research shows", "research found",
    "data shows", "data show", "statistics show", "reports show", "a report", "the evidence", "polls show", "surveys show",
  ],
};

const FIRST_PERSON = new Set(["i", "i've", "we", "we've", "ive", "i'd", "we'd"]);
const EXP_VERBS = new Set(
  (
    "tried tested owned drove driven used made cooked baked ate eaten switched worked lived seen saw watched visited read had " +
    "bought built fixed replaced took went grew raised taught studied noticed found tasted played ran measured compared " +
    "tracked paid spent lost gained learned kept stopped started"
  ).split(" "),
);

interface CueHit {
  kind: CueKind;
  start: number; // token index of first cue token
  end: number; // token index just after the cue
}

const CUE_PHRASES = (Object.keys(CUES) as CueKind[]).flatMap((kind) =>
  CUES[kind].map((p) => ({ kind, words: p.split(" ") })),
);

function findCues(toks: Tok[]): CueHit[] {
  const hits: CueHit[] = [];
  // Word-only view with back-pointers, so phrases can span a comma ("however, ...").
  const idx: number[] = [];
  for (const t of toks) if (t.t === "w") idx.push(t.i);
  for (let a = 0; a < idx.length; a++) {
    // Longest phrase wins at each position.
    let best: { kind: CueKind; len: number } | null = null;
    for (const p of CUE_PHRASES) {
      if (a + p.words.length > idx.length) continue;
      let ok = true;
      for (let k = 0; k < p.words.length; k++) {
        if (toks[idx[a + k]].lo !== p.words[k]) {
          ok = false;
          break;
        }
        // phrase words must be in the same sentence
        if (k > 0 && toks[idx[a + k]].sent !== toks[idx[a]].sent) {
          ok = false;
          break;
        }
      }
      if (ok && (!best || p.words.length > best.len)) best = { kind: p.kind, len: p.words.length };
    }
    if (best) {
      hits.push({ kind: best.kind, start: idx[a], end: idx[a + best.len - 1] + 1 });
      a += best.len - 1;
      continue;
    }
    // ", so" is a reason cue. A bare "so" is not.
    const t = toks[idx[a]];
    if (t.lo === "so" && idx[a] > 0 && toks[idx[a] - 1].t === "comma") {
      hits.push({ kind: "reason", start: idx[a], end: idx[a] + 1 });
      continue;
    }
    // First person + experience verb: "I tested", "we've owned", "I also tried".
    if (FIRST_PERSON.has(t.lo)) {
      for (let k = 1; k <= 2 && a + k < idx.length; k++) {
        if (EXP_VERBS.has(toks[idx[a + k]].lo) && toks[idx[a + k]].sent === t.sent) {
          hits.push({ kind: "exp", start: idx[a], end: idx[a + k] + 1 });
          a += k;
          break;
        }
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points per dimension. Sums to 100. */
export const OPINION_POINTS = {
  stance: 16,
  reason: 26,
  support: 22,
  otherSide: 16,
  openness: 8,
  depth: 12,
} as const;

/** How much of a dimension's points a clause earns for its (weighted) count of real content words. */
function substanceFactor(cw: number): number {
  if (cw < 2) return 0;
  if (cw < 3) return 0.35;
  if (cw < 4) return 0.6;
  if (cw < 5) return 0.75;
  if (cw < 6) return 0.9;
  return 1;
}
const TICK_FACTOR = 0.5; // a dimension ticks only with >= 3 real content words

export const MAX_OPINION_XP = 25;
/** Every opinion posted before the strength-based XP earned a flat 25. Those keep it. */
export const LEGACY_OPINION_XP = 25;

/** Non-linear map of quality 0-100 to XP 0-25. Weak scores stay near zero. */
export function xpForQuality(quality: number): number {
  const q = Math.max(0, Math.min(100, quality));
  let xp: number;
  if (q <= 25) xp = (q / 25) * 2;
  else if (q <= 45) xp = 2 + ((q - 25) / 20) * 4;
  else if (q <= 65) xp = 6 + ((q - 45) / 20) * 6;
  else if (q <= 80) xp = 12 + ((q - 65) / 15) * 6;
  else xp = 18 + ((q - 80) / 20) * 7;
  return Math.max(0, Math.min(MAX_OPINION_XP, Math.round(xp)));
}

/** Caps total quality by how much real content there is, so short text can't score high. */
function lengthCap(uniqueContent: number): number {
  if (uniqueContent < 3) return 5;
  if (uniqueContent < 6) return 20;
  if (uniqueContent < 10) return 35;
  if (uniqueContent < 15) return 55;
  if (uniqueContent < 22) return 75;
  return 100;
}

export type OpinionPartsFound = Record<OpinionPartId, boolean>;

export interface OpinionStrength {
  wordCount: number;
  charCount: number;
  parts: OpinionPartsFound;
  /** 0–100 quality, for the meter fill. */
  score: number;
  level: OpinionStrengthLevel;
  /**
   * True for one-word or very thin takes (like just "yes").
   * Used only for a non-blocking "Add your reason?" tip. Empty text is not bare
   * in this sense, because those posts can't be submitted anyway.
   */
  isBare: boolean;
  /** 0–25 XP this text earns. The server recomputes it from the saved text. */
  xp: number;
  /** Distinct real content words (not filler, links, cue words or keyboard mash). */
  contentWords: number;
  /** True when cue phrases or repeated words outweigh real content. */
  stuffed: boolean;
  /** Points earned by each dimension before modifiers. */
  points: Record<keyof typeof OPINION_POINTS, number>;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function levelFor(score: number, isBare: boolean, wordCount: number): OpinionStrengthLevel {
  if (wordCount === 0 || isBare) return "bare";
  if (score < 40) return "basic";
  if (score < 70) return "solid";
  return "strong";
}

/** Weighted unique content count of tokens [from, to): words already claimed by another dimension count half. */
function countClause(toks: Tok[], from: number, to: number, claimed: Set<string>): { cw: number; words: string[] } {
  const seen = new Set<string>();
  let cw = 0;
  for (let k = from; k < to; k++) {
    const t = toks[k];
    if (!isContent(t) || seen.has(t.lo)) continue;
    seen.add(t.lo);
    cw += claimed.has(t.lo) ? 0.5 : 1;
  }
  return { cw, words: [...seen] };
}

const EMPTY_PARTS: OpinionPartsFound = {
  stance: false,
  reason: false,
  support: false,
  otherSide: false,
  openness: false,
};

export function analyzeOpinion(text: string): OpinionStrength {
  const raw = text ?? "";
  const charCount = raw.trim().length;
  const wordCount = countWords(raw);

  const toks = tokenize(raw);
  const cues = findCues(toks);
  const urlCount = toks.filter((t) => t.t === "url").length;

  const allContent = new Set<string>();
  let totalContent = 0;
  for (const t of toks) {
    if (isContent(t)) {
      totalContent++;
      allContent.add(t.lo);
    }
  }
  const uniqueContent = allContent.size;

  // A clause runs from the end of a cue to the sentence end, or to the next cue that is not
  // an experience/source cue (those can sit inside a reason). Capped at 40 tokens.
  const clauseEnd = (hit: CueHit, ownKind: CueKind): number => {
    const sent = toks[hit.end - 1].sent;
    let end = hit.end;
    const stopKinds: CueKind[] = ownKind === "exp" || ownKind === "source" ? ["reason", "other", "open", "exp", "source"] : ["reason", "other", "open"];
    const nextCue = cues.find((c) => c.start >= hit.end && stopKinds.includes(c.kind));
    const limit = Math.min(toks.length, hit.end + 40);
    while (end < limit && toks[end].sent === sent && !(nextCue && end >= nextCue.start)) end++;
    return end;
  };

  const claimed = new Set<string>();
  const clauseWords = (kinds: CueKind[]): { cw: number; hits: CueHit[] } => {
    const words = new Set<string>();
    let cw = 0;
    const used: CueHit[] = [];
    for (const hit of cues) {
      if (!kinds.includes(hit.kind)) continue;
      const end = clauseEnd(hit, hit.kind);
      const r = countClause(toks, hit.end, end, claimed);
      let add = 0;
      for (const w of r.words) {
        if (words.has(w)) continue;
        words.add(w);
        add += claimed.has(w) ? 0.5 : 1;
      }
      cw += add;
      if (add > 0) used.push(hit);
    }
    for (const w of words) claimed.add(w);
    return { cw, hits: used };
  };

  const points = { stance: 0, reason: 0, support: 0, otherSide: 0, openness: 0, depth: 0 };

  const other = clauseWords(["other"]);
  points.otherSide = OPINION_POINTS.otherSide * substanceFactor(other.cw);
  const open = clauseWords(["open"]);
  points.openness = OPINION_POINTS.openness * substanceFactor(open.cw);
  const reason = clauseWords(["reason"]);
  points.reason = OPINION_POINTS.reason * substanceFactor(reason.cw);

  // Support: experience, a stated source with content, a number with context, a link only alongside real text,
  // and named specifics. Link-only "evidence" earns little and never ticks the box alone.
  const exp = clauseWords(["exp"]);
  let support = 14 * substanceFactor(exp.cw);
  const src = clauseWords(["source"]);
  support += 8 * substanceFactor(src.cw);
  const numberSents = new Set<number>();
  for (const t of toks) if (t.t === "w" && /\d/.test(t.lo)) numberSents.add(t.sent);
  let numberPoints = 0;
  for (const s of numberSents) {
    let cw = 0;
    const seen = new Set<string>();
    for (const t of toks) if (t.sent === s && isContent(t) && !/\d/.test(t.lo) && !seen.has(t.lo)) (seen.add(t.lo), cw++);
    if (cw >= 3) numberPoints += numberPoints === 0 ? 8 : 2;
  }
  support += Math.min(10, numberPoints);
  if (urlCount > 0 && uniqueContent >= 12) support += 5;
  const proper = toks.filter(
    (t) =>
      t.t === "w" &&
      /^\p{Lu}/u.test(t.raw) &&
      t.raw !== "I" &&
      !/^I'/.test(t.raw) &&
      t.i > 0 &&
      toks.slice(0, t.i).some((x) => x.t === "w" && x.sent === t.sent) &&
      isContent(t),
  );
  const properUnique = new Set(proper.map((t) => t.lo)).size;
  if (uniqueContent >= 8) support += properUnique >= 2 ? 6 : properUnique === 1 ? 4 : 0;
  points.support = Math.min(OPINION_POINTS.support, support);

  // Stance: a claim part (the sentence up to its first reason/other cue) with a stance cue and content.
  const STRONG_STANCE = [
    /\b(i|we) (really |truly |strongly |firmly )?(think|believe|feel|prefer|like|love|hate|dislike|support|oppose|favou?r|reckon|say)\b/,
    /\b(in my|my) (view|opinion|take|position|book)\b/,
    /\b(should|shouldn't|must|mustn't|ought to|need to|needs to|belongs?|doesn't belong|deserves?)\b/,
    /\b(better|worse|best|worst|overrated|underrated|worth|worthless|dangerous|unsafe|pointless|essential|wrong|unfair|immoral|unethical|ridiculous|reliable|unreliable|superior|inferior) ?(than|to)?\b/,
    /\b(is|are|was|were|isn't|aren't) (not |never |always |far |much |way |a |an |the )*(true|false|real|fake|good|bad|right|wrong|fair|unfair|safe|dangerous|legal|illegal|moral|immoral|necessary|harmful|helpful)\b/,
    /\b(never|always|no way|not a chance|of course)\b/,
  ];
  const WEAK_STANCE = /\b(yes|yeah|yep|no|nope|agree|disagree|absolutely|definitely|totally|for|against)\b/;
  let stanceClaim = 0;
  let stanceStrong = false;
  let stanceWeak = false;
  const sentIds = [...new Set(toks.map((t) => t.sent))];
  for (const sid of sentIds) {
    const sentToks = toks.filter((t) => t.sent === sid);
    const firstCue = cues.find((c) => c.kind !== "exp" && c.kind !== "source" && toks[c.start].sent === sid);
    const cut = firstCue ? firstCue.start : Infinity;
    const claim = sentToks.filter((t) => t.i < cut);
    const claimText = claim.filter((t) => t.t === "w" || t.t === "comma").map((t) => t.lo).join(" ");
    const cw = new Set(claim.filter(isContent).map((t) => t.lo)).size;
    const strong = STRONG_STANCE.some((re) => re.test(claimText));
    const weak = WEAK_STANCE.test(claimText);
    if (strong && cw >= 1 && cw > stanceClaim) (stanceClaim = cw, (stanceStrong = true));
    else if (weak && cw >= 2 && cw > stanceClaim) (stanceClaim = cw, (stanceWeak = true));
  }
  const reasonTicked = substanceFactor(reason.cw) >= TICK_FACTOR;
  if (stanceStrong && stanceClaim >= 1) points.stance = OPINION_POINTS.stance * (stanceClaim >= 2 ? 1 : 0.7);
  else if ((stanceWeak && stanceClaim >= 2) || (reasonTicked && /\b(yes|yeah|yep|no|nope|agree|disagree)\b/i.test(raw)))
    points.stance = OPINION_POINTS.stance * 0.75;

  // Depth: how much distinct real vocabulary the text has.
  points.depth = OPINION_POINTS.depth * Math.min(1, uniqueContent / 28);

  let quality = points.stance + points.reason + points.support + points.otherSide + points.openness + points.depth;

  // Stuffing: cue phrases (and links) outnumbering real content, repeated words, repeated cue phrases.
  const cueHits = cues.filter((c) => c.kind !== "exp" || toks[c.start].lo !== "i").length + urlCount;
  const cueCounts = new Map<string, number>();
  for (const c of cues) {
    const key = toks.slice(c.start, c.end).map((t) => t.lo).join(" ");
    cueCounts.set(key, (cueCounts.get(key) ?? 0) + 1);
  }
  const repeatedCue = [...cueCounts.values()].some((n) => n >= 3);
  let stuffed = false;
  if (cueHits >= 3 && uniqueContent < 5 * cueHits) {
    quality *= 0.25;
    stuffed = true;
  } else if (cueHits >= 2 && uniqueContent < 3 * cueHits) {
    quality *= 0.4;
    stuffed = true;
  }
  if (repeatedCue) {
    quality *= 0.25;
    stuffed = true;
  }
  if (totalContent >= 8 && uniqueContent / totalContent < 0.5) {
    quality *= 0.4;
    stuffed = true;
  }
  if (urlCount >= 3) quality *= 0.5;

  quality = Math.min(quality, lengthCap(uniqueContent));
  quality = Math.max(0, Math.min(100, Math.round(quality)));

  const parts: OpinionPartsFound = wordCount === 0 ? { ...EMPTY_PARTS } : {
    stance: points.stance >= OPINION_POINTS.stance * 0.5,
    reason: points.reason >= OPINION_POINTS.reason * TICK_FACTOR,
    support: points.support >= 8,
    otherSide: points.otherSide >= OPINION_POINTS.otherSide * TICK_FACTOR,
    openness: points.openness >= OPINION_POINTS.openness * TICK_FACTOR,
  };
  // Ticks never survive a stuffed or capped-to-nothing text.
  if (quality <= 5) for (const k of OPINION_PART_IDS) parts[k] = false;

  const isBare =
    wordCount > 0 &&
    !parts.reason &&
    (wordCount <= 8 || (wordCount <= 12 && !parts.support && !parts.otherSide));

  return {
    wordCount,
    charCount,
    parts,
    score: quality,
    level: levelFor(quality, isBare, wordCount),
    isBare,
    xp: xpForQuality(quality),
    contentWords: uniqueContent,
    stuffed,
    points,
  };
}

export function isBareOpinion(text: string): boolean {
  return analyzeOpinion(text).isBare;
}

/** XP (0–25) for an opinion's text. The server calls this on the saved text. */
export function opinionXp(text: string): number {
  return analyzeOpinion(text).xp;
}

/** Statuses that hide an opinion. getSkillXp must not count these (same as a delete). */
export const EXCLUDED_OPINION_STATUSES = ["hidden", "flagged"] as const;

export type OpinionXpRow = {
  topicId: string;
  status?: string | null;
  /** Absent rows (hard-deleted, or omitted from the list) are not passed in, so they add 0. */
  strengthXp?: number | null;
};

/**
 * Opinions-skill XP from a user's current opinion rows.
 * - Hard-deleted opinions are gone from the list, so their XP is removed.
 * - hidden / flagged (moderation soft-delete) are skipped, so that XP is removed too.
 * - Each row is clamped to 0–25 (NULL strength_xp is the legacy flat 25).
 * - At most 25 XP per topic, even if a user somehow has two opinions on it.
 * Keep the SQL in badgeRepository.getSkillXp in sync with this.
 */
export function opinionXpFromRows(rows: readonly OpinionXpRow[]): number {
  const bestByTopic = new Map<string, number>();
  for (const row of rows) {
    const status = (row.status ?? "approved").toLowerCase();
    if ((EXCLUDED_OPINION_STATUSES as readonly string[]).includes(status)) continue;
    const xp = Math.max(0, Math.min(MAX_OPINION_XP, row.strengthXp ?? LEGACY_OPINION_XP));
    const prev = bestByTopic.get(row.topicId) ?? 0;
    if (xp > prev) bestByTopic.set(row.topicId, xp);
  }
  let sum = 0;
  for (const xp of bestByTopic.values()) sum += xp;
  return sum;
}

/** One-line prompt that can mention the topic question. */
export function structurePrompt(topicTitle?: string | null): string {
  const base =
    "A strong opinion has a stance, a reason, support, and the other side.";
  const title = topicTitle?.trim();
  if (!title) return base;
  return `For “${title}”, say where you land and why — not just yes or no.`;
}

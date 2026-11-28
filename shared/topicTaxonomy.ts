/**
 * Explore Topics Map taxonomy (official groups).
 *
 * Tweak this file to change how topics are grouped on the map. No database
 * change is required for new subs or keywords.
 *
 * HOW A TOPIC GETS ITS HOME
 *  - Every topic has ONE stored home: an official major + sub (topics.home_major,
 *    topics.home_sub hold the ids from this file). The home decides where the topic
 *    sits on the map. It is never "Other": if nothing fits, it goes to the closest
 *    major's "General" sub (and as a last resort Culture / General).
 *  - On create the AI chooses from this official list (server/aiService.ts). If the AI
 *    is unavailable or answers with something off-list, `classifyTopic` below picks the
 *    home from aliases + keywords. Admins can move a topic later (admin dashboard).
 *  - Free-form tags (topics.categories, optional, max 5) are extras. They are search
 *    tags, and a tag that is an alias of a DIFFERENT major shows the topic there as
 *    "also in".
 *
 * MATCHING RULES (classifyTopic)
 *  - `aliases` are tag names (case-insensitive) that point at a major, or at a specific
 *    sub. Add synonyms here (Movies, Film, Cars, Faith, Welfare, ...).
 *  - `keywords` match WHOLE WORDS in the title (strong) or description (weaker).
 *    A trailing * means "any ending" (immigra* matches immigrant, immigration).
 *    Short or generic words are avoided on purpose (no bare "exist", "id", "default").
 *  - Tag points beat a single weak keyword; the FIRST tag counts a little extra.
 *    Ties go to the earlier tag, then to the declared order of majors.
 *
 * DEPTH: 2 group levels (major -> sub), then topics. Computed at map build time:
 *  - SPLIT FLAG: a sub with more than SPLIT_THRESHOLD (20) topics is reported in
 *    `splitCandidates` (logged by the server, shown in the admin Move dialog). Names
 *    for new subs are never invented automatically; a person adds them here.
 *  - FOLD: a sub with exactly 1 topic is folded visually into its major's "General"
 *    bubble while the major would still keep at least FOLD_MIN_OTHER_SUBS (3) other
 *    non-General subs. Folded topics remember their sub in `foldedFrom`.
 *  - A major with no topics is hidden. Majors keep the declared order; subs sort by
 *    size, with General last.
 *  - New MAJORS: add one only for a domain you want to welcome (about 8-10+ topics,
 *    or a planned area such as Vehicles). Prefer a new sub first.
 */

export interface MajorCategory {
  id: string;
  name: string;
  /** Tag names (lowercase) that mean this major. The major's own name is always included. */
  aliases: string[];
  /** Optional accent used as a faint pill tint on the map. */
  accent: string;
}

export interface Subcategory {
  id: string;
  name: string;
  majorId: string;
  /** Whole-word matches against title (strong) and description (weaker). Trailing * = any ending. */
  keywords: string[];
  /** Tag names (lowercase) that point straight at this sub. */
  aliases?: string[];
}

export const GENERAL_SUB_ID = "general";
export const FALLBACK_MAJOR_ID = "culture";
/** A sub with more topics than this is flagged for a human to split. */
export const SPLIT_THRESHOLD = 20;
/** A 1-topic sub folds into General only while the major keeps this many other non-General subs. */
export const FOLD_MIN_OTHER_SUBS = 3;

export const MAJOR_CATEGORIES: MajorCategory[] = [
  { id: "politics", name: "Politics", accent: "hsl(4 72% 66%)", aliases: ["law", "legal", "government", "policy", "public policy", "election", "elections", "voting", "immigration", "guns", "war", "foreign policy", "justice", "crime"] },
  { id: "economics", name: "Economics", accent: "hsl(28 80% 58%)", aliases: ["economy", "business", "finance", "money", "jobs", "labor", "work", "labor market", "future of work", "taxes", "tax", "free markets", "trade policy", "consumer preferences", "wealth", "markets"] },
  { id: "social-policy", name: "Social Policy", accent: "hsl(340 45% 68%)", aliases: ["society", "social", "social issues", "community", "welfare", "family", "poverty", "inequality"] },
  { id: "health", name: "Health", accent: "hsl(350 62% 62%)", aliases: ["medicine", "medical", "healthcare", "wellness", "mental health", "fitness", "nutrition", "drugs", "substance use", "legalization"] },
  { id: "education", name: "Education", accent: "hsl(45 70% 55%)", aliases: ["school", "schools", "college", "university", "learning", "teaching"] },
  { id: "science", name: "Science", accent: "hsl(200 70% 62%)", aliases: ["research", "space", "physics", "biology", "nature", "astronomy"] },
  { id: "climate", name: "Climate", accent: "hsl(150 50% 48%)", aliases: ["environment", "energy", "sustainability", "conservation", "green"] },
  { id: "technology", name: "Technology", accent: "hsl(260 50% 70%)", aliases: ["tech", "ai", "artificial intelligence", "internet", "software", "gadgets", "social media", "privacy", "cybersecurity"] },
  { id: "entertainment", name: "Entertainment", accent: "hsl(310 55% 62%)", aliases: ["movies", "movie", "film", "films", "tv", "television", "streaming", "games", "gaming", "video games", "music", "celebrities", "pop culture", "action", "fantasy", "film analysis", "franchise debate", "comics", "anime"] },
  { id: "sports", name: "Sports", accent: "hsl(135 50% 45%)", aliases: ["sport", "athletics", "athletes", "football", "basketball", "baseball", "soccer", "martial arts", "olympics"] },
  { id: "food", name: "Food & Cooking", accent: "hsl(95 45% 50%)", aliases: ["food", "cooking", "recipes", "recipe", "restaurants", "restaurant", "fast food", "dining", "drinks", "baking", "grilling", "cuisine"] },
  { id: "vehicles", name: "Vehicles", accent: "hsl(215 15% 55%)", aliases: ["cars", "car", "trucks", "truck", "automotive", "auto", "motorcycles", "motorcycle", "ev", "evs", "driving", "transportation", "boats", "aviation"] },
  { id: "religion", name: "Religion", accent: "hsl(52 50% 48%)", aliases: ["faith", "spirituality", "theology", "christianity", "islam", "judaism", "atheism", "church", "god", "beliefs"] },
  { id: "ideas", name: "Ideas", accent: "hsl(270 35% 68%)", aliases: ["philosophy", "ethics", "morality", "logic", "big questions", "opinions"] },
  { id: "culture", name: "Culture", accent: "hsl(18 70% 62%)", aliases: ["arts", "art", "literature", "books", "travel", "holidays", "cultural impact", "traditions", "media", "news", "trends", "lifestyle"] },
];

const S = (majorId: string, id: string, name: string, keywords: string[], aliases: string[] = []): Subcategory => ({ id, name, majorId, keywords, aliases });

const NAMED_SUBS: Subcategory[] = [
  // Politics
  S("politics", "elections", "Elections & Voting", ["voting", "vote", "election*", "ranked-choice", "ranked choice", "ballot*", "electoral college", "primary", "gerrymander*"]),
  S("politics", "immigration", "Immigration", ["immigra*", "border*", "asylum", "refugee*", "deportation", "citizenship"]),
  S("politics", "guns", "Guns & Safety", ["gun", "guns", "firearm*", "background check", "second amendment", "assault weapon*"]),
  S("politics", "government", "Government", ["congress", "term limit*", "senate", "parliament", "constitution*", "president*", "supreme court justices", "filibuster", "federal government"]),
  S("politics", "law-courts", "Law & Courts", ["court*", "lawsuit*", "judge*", "jury", "death penalty", "prison*", "police", "crime*", "criminal*", "law enforcement"], ["law", "legal"]),
  S("politics", "foreign-policy", "War & Foreign Policy", ["war", "military", "nato", "ukraine", "israel", "china", "foreign policy", "sanction*", "nuclear weapon*", "troops"]),
  // Economics
  S("economics", "taxes", "Taxes & Wealth", ["tax", "taxes", "wealth", "billionaire*", "inequality", "income tax", "estate tax"]),
  S("economics", "work", "Work & Labor", ["work week", "remote work", "four-day", "four day", "labor", "labour", "employee*", "wage*", "minimum wage", "union*", "jobs", "workplace"], ["labor market", "future of work"]),
  S("economics", "business", "Business", ["business*", "compan*", "corporate", "corporation*", "startup*", "monopol*", "antitrust"]),
  S("economics", "cost-of-living", "Cost of Living", ["cost of living", "afford*", "housing", "rent", "inflation", "mortgage*", "prices"]),
  S("economics", "markets", "Trade & Markets", ["trade", "tariff*", "free market*", "capitalism", "socialism", "stock market", "crypto*", "bitcoin"], ["free markets", "trade policy"]),
  // Social Policy
  S("social-policy", "culture-norms", "Culture & Norms", ["cancel culture", "norms", "separate the art", "political correctness", "woke", "stereotype*"]),
  S("social-policy", "welfare", "Welfare & Safety Net", ["welfare", "universal basic income", "ubi", "poverty", "homeless*", "social security", "food stamps", "safety net"], ["welfare", "ubi"]),
  S("social-policy", "family", "Family & Parenting", ["parent*", "marriage", "divorce", "childcare", "adoption", "children", "family"]),
  S("social-policy", "community", "Community & Society", ["community", "society", "neighborhood*", "volunteer*", "public spaces"], ["community"]),
  // Health
  S("health", "public-health", "Public Health", ["health", "healthcare", "vaccin*", "hospital*", "pandemic", "insurance", "medicare"]),
  S("health", "bioethics", "Bioethics", ["assisted dying", "euthanasia", "terminally ill", "abortion", "organ donor*", "surrogacy", "cloning"]),
  S("health", "mental-health", "Mental Health", ["mental health", "therapy", "depression", "anxiety", "suicide", "addiction"]),
  S("health", "diet-fitness", "Diet & Fitness", ["diet", "dieting", "nutrition", "vegan*", "vegetarian*", "meat", "exercise", "fitness", "obesity", "gym"]),
  S("health", "drugs", "Drugs & Substances", ["drug", "drugs", "marijuana", "cannabis", "alcohol", "intoxicating", "substance*", "psychedelic*", "opioid*", "legalization"], ["substance use", "legalization"]),
  // Education
  S("education", "higher-ed", "Higher Education", ["college", "colleges", "university", "universities", "tuition", "campus", "student debt", "student loan*", "degree*"]),
  S("education", "schools", "Schools", ["school", "schools", "k-12", "teacher*", "curriculum", "homeschool*", "standardized test*", "school choice"]),
  // Science
  S("science", "biology", "Biology & Nature", ["species", "extinct*", "de-extinction", "gene", "genes", "genetic*", "biology", "evolution", "animals", "dna"]),
  S("science", "space-physics", "Space & Physics", ["space", "nasa", "mars", "moon", "physics", "quantum", "astronom*", "aliens", "telescope"]),
  S("science", "research", "Research", ["research*", "experiment*", "scientific", "scientist*", "peer review", "study", "studies"]),
  // Climate
  S("climate", "emissions", "Energy & Emissions", ["carbon", "emission*", "fossil", "nuclear power", "solar", "wind power", "renewable*", "coal", "oil and gas", "fracking"]),
  S("climate", "conservation", "Conservation", ["conservation", "biodiversity", "wildlife", "national park*", "deforestation", "endangered"]),
  S("climate", "climate-policy", "Climate Policy", ["climate", "environment*", "green new deal", "global warming", "carbon tax", "paris agreement"]),
  // Technology
  S("technology", "ai", "AI", ["ai", "artificial intelligence", "machine learning", "ai-generated", "chatbot*", "chatgpt", "robot*", "superintelligence"]),
  S("technology", "social-media", "Social Media", ["social media", "under 16", "tiktok", "facebook", "instagram", "twitter", "youtube"]),
  S("technology", "digital-rights", "Privacy & Digital Rights", ["privacy", "copyright*", "surveillance", "data collection", "encryption", "right to repair", "net neutrality"]),
  S("technology", "gadgets", "Gadgets & Software", ["iphone", "android", "smartphone*", "laptop*", "software", "app", "apps", "windows", "linux", "gadget*", "computer*", "internet"]),
  S("technology", "automation", "Automation & Work", ["automation", "self-checkout", "automated", "jobs replaced"]),
  // Entertainment
  S("entertainment", "movies", "Movies & Film", ["movie*", "film*", "cinema", "actor*", "actress*", "oscar*", "marvel", "star wars", "starwars", "trilogy", "sequel*", "remake*", "director*", "hollywood", "box office", "disney", "pixar"], ["movies", "film", "films", "action", "film analysis"]),
  S("entertainment", "tv", "TV & Streaming", ["tv", "television", "series", "netflix", "hbo", "streaming", "sitcom*", "anime", "reality show*", "episode*", "season finale"], ["tv", "streaming"]),
  S("entertainment", "games", "Games", ["video game*", "gaming", "gamer*", "playstation", "xbox", "nintendo", "minecraft", "fortnite", "esports", "board game*", "poker", "chess"], ["games", "gaming", "video games"]),
  S("entertainment", "music", "Music", ["music", "song*", "album*", "band", "bands", "rapper*", "singer*", "concert*", "taylor swift", "beatles", "hip hop", "rap", "guitar"], ["music"]),
  S("entertainment", "celebrities", "Celebrities & Pop Culture", ["celebrit*", "famous", "pop culture", "kardashian*", "influencer*", "fandom", "comic book*"], ["celebrities", "pop culture"]),
  // Sports
  S("sports", "team-sports", "Team Sports", ["nfl", "nba", "mlb", "nhl", "mls", "soccer", "football", "basketball", "baseball", "hockey", "world cup", "super bowl", "quarterback*", "coach*", "referee*"]),
  S("sports", "combat-sports", "Combat Sports & Martial Arts", ["boxing", "mma", "ufc", "martial art*", "karate", "judo", "wrestling", "jiu-jitsu", "bruce lee", "kung fu"], ["martial arts"]),
  S("sports", "college-sports", "College Sports", ["college athlete*", "ncaa", "student athlete*", "college sports", "college football", "college basketball", "name image"]),
  S("sports", "sports-integrity", "Doping & Fair Play", ["doping", "performance-enhancing", "steroid*", "cheating", "fair play", "sign stealing", "pro sports"]),
  S("sports", "individual-sports", "Olympics & Individual Sports", ["olympic*", "golf", "tennis", "swimming", "marathon*", "running", "cycling", "gymnastics", "track and field"]),
  // Food & Cooking
  S("food", "recipes", "Recipes & Cooking", ["recipe*", "cook", "cooking", "bake", "baking", "grill*", "bbq", "barbecue", "ingredient*", "homemade", "from scratch", "marinade", "seasoning", "sauce*"], ["recipes", "cooking", "baking"]),
  S("food", "restaurants", "Restaurants & Fast Food", ["restaurant*", "fast food", "burger*", "mcdonald*", "chick-fil-a", "wendy*", "taco bell", "diner*", "takeout", "pizzeria", "chain restaurant*", "dining", "tipping"], ["restaurants", "fast food", "dining"]),
  S("food", "dishes", "Dishes & Ingredients", ["pizza", "pineapple", "pasta", "steak*", "chili", "taco*", "sushi", "bacon", "cheese", "chocolate", "bread", "eggs", "ketchup", "mustard", "hot dog*", "sandwich*", "dessert*", "breakfast", "lasagna"]),
  S("food", "drinks", "Drinks", ["coffee", "tea", "beer", "wine", "cocktail*", "soda", "whiskey", "bourbon", "smoothie*", "energy drink*", "water"], ["drinks"]),
  // Vehicles
  S("vehicles", "cars-trucks", "Cars & Trucks", ["car", "cars", "truck*", "pickup*", "suv*", "sedan*", "minivan*", "gas car*", "muscle car*", "horsepower", "ford", "chevy", "chevrolet", "toyota", "honda", "jeep", "mustang", "camaro", "camero", "corvette", "dodge", "manual transmission", "stick shift", "v8"], ["cars", "car", "trucks", "truck", "automotive", "auto"]),
  S("vehicles", "electric", "Electric & Hybrid", ["electric vehicle*", "electric car*", "ev", "evs", "hybrid*", "tesla", "charging station*", "range anxiety", "rivian"], ["ev", "evs"]),
  S("vehicles", "motorcycles-bikes", "Motorcycles & Bikes", ["motorcycle*", "harley*", "bicycle*", "bike", "bikes", "e-bike*", "scooter*", "moped*", "helmet*"], ["motorcycles", "motorcycle"]),
  S("vehicles", "air-sea-rail", "Planes, Boats & Trains", ["airplane*", "aircraft", "boat*", "yacht*", "train", "trains", "railway*", "airline*", "airport*", "flying", "high-speed rail", "cruise ship*"], ["boats", "aviation"]),
  S("vehicles", "driving-roads", "Driving & Roads", ["driving", "drivers", "speed limit*", "traffic", "road", "roads", "highway*", "license", "self-driving", "autonomous vehicle*", "parking", "dui", "seatbelt*", "toll*"], ["driving"]),
  // Religion
  S("religion", "beliefs", "God & Beliefs", ["god", "gods", "atheis*", "agnostic*", "afterlife", "heaven", "hell", "soul", "miracle*", "prayer", "divine", "creationism", "intelligent design", "faith"], ["god", "atheism", "beliefs", "faith"]),
  S("religion", "christianity", "Christianity", ["christian*", "jesus", "bible", "biblical", "church", "catholic*", "protestant*", "pope", "evangelical*", "baptism"], ["christianity", "church"]),
  S("religion", "other-faiths", "Islam, Judaism & Other Faiths", ["islam*", "muslim*", "quran", "jewish", "judaism", "hindu*", "buddhis*", "sikh*", "mormon*", "scientology", "pagan*"], ["islam", "judaism"]),
  S("religion", "faith-society", "Faith & Society", ["religious freedom", "secular*", "school prayer", "blasphemy", "church and state", "separation of church", "religious liberty", "hijab", "tithe*"]),
  // Ideas
  S("ideas", "philosophy", "Philosophy", ["free will", "consciousness", "meaning of life", "determinism", "simulation", "nihilism", "existential*", "metaphysic*", "reality is"], ["philosophy"]),
  S("ideas", "ethics", "Ethics & Morality", ["ethical", "ethically", "ethics", "moral", "morals", "morally", "morality", "right and wrong"], ["ethics", "morality"]),
  // Culture
  S("culture", "arts-literature", "Arts & Literature", ["art", "artist*", "painting*", "museum*", "book", "books", "novel*", "literature", "poetry", "poem*", "author*", "harry potter", "shakespeare", "sculpture"], ["arts", "art", "literature", "books"]),
  S("culture", "holidays", "Holidays & Traditions", ["christmas", "halloween", "thanksgiving", "holiday*", "easter", "wedding*", "tradition*", "new year"], ["holidays", "traditions"]),
  S("culture", "media-news", "Media & News", ["news", "journalis*", "newspaper*", "media bias", "fake news", "podcast*", "meme*", "headline*"], ["media", "news"]),
  S("culture", "travel", "Travel & Places", ["travel*", "tourism", "tourist*", "vacation*", "passport", "city life", "countryside", "road trip*"], ["travel"]),
];

/** Every major also has a "General" sub: the home for topics that fit the major but no specific sub. */
export const SUBCATEGORIES: Subcategory[] = [
  ...NAMED_SUBS,
  ...MAJOR_CATEGORIES.map((m) => S(m.id, GENERAL_SUB_ID, "General", [])),
];

export const ROOT_ID = "root";
export const ROOT_NAME = "Explore Topics";

export type MapNodeType = "root" | "major" | "sub" | "topic";

export interface MapAlsoIn {
  id: string;
  name: string;
  majorId: string;
}

export interface MapTopicRef {
  id: string;
  title: string;
  description?: string | null;
  /** Free-form extra tags (optional). */
  categories: string[];
  /** Stored official home (topics.home_major / topics.home_sub). Missing = computed with classifyTopic. */
  homeMajor?: string | null;
  homeSub?: string | null;
}

export interface SplitCandidate {
  majorId: string;
  majorName: string;
  subId: string;
  subName: string;
  count: number;
}

export interface MapTreeNode {
  id: string;
  type: MapNodeType;
  name: string;
  count: number;
  accent?: string;
  topicId?: string;
  alsoIn?: MapAlsoIn[];
  /** Topic nodes only: the sub this topic really belongs to, when it was folded into General. */
  foldedFrom?: string;
  /** Sub nodes only: over SPLIT_THRESHOLD, a person should split it. */
  splitSuggested?: boolean;
  /** Root only. */
  splitCandidates?: SplitCandidate[];
  children: MapTreeNode[];
}

// ---------------------------------------------------------------------------
// Lookups

const majorById = new Map(MAJOR_CATEGORIES.map((m) => [m.id, m]));
const majorOrder = new Map(MAJOR_CATEGORIES.map((m, i) => [m.id, i]));
const subsByMajor = new Map<string, Subcategory[]>();
for (const s of SUBCATEGORIES) {
  const list = subsByMajor.get(s.majorId) || [];
  list.push(s);
  subsByMajor.set(s.majorId, list);
}

export function getMajor(id: string | null | undefined): MajorCategory | undefined {
  return id ? majorById.get(id) : undefined;
}
export function getSub(majorId: string, subId: string | null | undefined): Subcategory | undefined {
  return (subsByMajor.get(majorId) || []).find((s) => s.id === subId);
}
export function subsOf(majorId: string): Subcategory[] {
  return subsByMajor.get(majorId) || [];
}

const normTag = (t: string) => t.toLowerCase().replace(/^#/, "").replace(/\s+/g, " ").trim();

type AliasTarget = { majorId: string; subId?: string };
const aliasMap = new Map<string, AliasTarget>();
for (const m of MAJOR_CATEGORIES) {
  aliasMap.set(normTag(m.name), { majorId: m.id });
  aliasMap.set(m.id, { majorId: m.id });
}
for (const m of MAJOR_CATEGORIES) for (const a of m.aliases) if (!aliasMap.has(normTag(a))) aliasMap.set(normTag(a), { majorId: m.id });
// Sub-level aliases win over major-level ones (Welfare -> Social Policy / Welfare & Safety Net).
for (const s of NAMED_SUBS) for (const a of s.aliases || []) aliasMap.set(normTag(a), { majorId: s.majorId, subId: s.id });

/** Resolve a free-form tag to an official group, or undefined if the tag is unknown. */
export function resolveTag(tag: string): AliasTarget | undefined {
  return aliasMap.get(normTag(tag));
}

/** Validate a stored/submitted home. Accepts ids or names. A missing/unknown sub becomes the major's General. */
export function normalizeHome(major: string | null | undefined, sub?: string | null): { majorId: string; subId: string } | null {
  if (!major) return null;
  const key = normTag(String(major));
  const m = majorById.get(key) || MAJOR_CATEGORIES.find((x) => normTag(x.name) === key);
  if (!m) return null;
  if (!sub) return { majorId: m.id, subId: GENERAL_SUB_ID };
  const sk = normTag(String(sub));
  const s = subsOf(m.id).find((x) => x.id === sk || normTag(x.name) === sk);
  return { majorId: m.id, subId: s ? s.id : GENERAL_SUB_ID };
}

// ---------------------------------------------------------------------------
// Keyword matching (whole words, so "exist" or "id" never fire inside other words)

const rxCache = new Map<string, RegExp>();
function kwRegex(kw: string): RegExp {
  let rx = rxCache.get(kw);
  if (!rx) {
    const k = kw.toLowerCase().trim();
    const star = k.endsWith("*");
    const base = (star ? k.slice(0, -1) : k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    rx = new RegExp(`(?:^|[^a-z0-9])${base}${star ? "[a-z0-9]*" : "(?:s|es)?(?![a-z0-9])"}`);
    rxCache.set(kw, rx);
  }
  return rx;
}
const words = (kw: string) => kw.trim().split(/[\s-]+/).length;

function keywordPoints(sub: Subcategory, title: string, desc: string): number {
  let pts = 0;
  for (const kw of sub.keywords) {
    const rx = kwRegex(kw);
    if (rx.test(title)) pts += 4 + 2 * (words(kw) - 1);
    else if (rx.test(desc)) pts += 2 + (words(kw) - 1);
  }
  return pts;
}

export interface Classification {
  majorId: string;
  subId: string;
  /** Total evidence for the winning major (0 = nothing matched, fell back). */
  score: number;
  /** True when the evidence was thin or two majors were close; worth an AI check or a human look. */
  ambiguous: boolean;
}

/** Pick an official home from aliases + keywords. Never returns Other. */
export function classifyTopic(topic: Pick<MapTopicRef, "title" | "description" | "categories">): Classification {
  const title = (topic.title || "").toLowerCase();
  const desc = (topic.description || "").toLowerCase();
  const subScore = new Map<string, number>();
  const majorScore = new Map<string, number>();
  const firstTag = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, n: number) => map.set(key, (map.get(key) || 0) + n);

  const titleHitMajors = new Set<string>();
  for (const s of NAMED_SUBS) {
    const pts = keywordPoints(s, title, desc);
    if (pts > 0) {
      add(subScore, `${s.majorId}/${s.id}`, pts);
      add(majorScore, s.majorId, pts);
      if (s.keywords.some((kw) => kwRegex(kw).test(title))) titleHitMajors.add(s.majorId);
    }
  }
  (topic.categories || []).forEach((tag, i) => {
    const hit = resolveTag(tag);
    if (!hit) return;
    const bonus = i === 0 ? 2 : 0;
    add(majorScore, hit.majorId, 6 + bonus);
    if (hit.subId) add(subScore, `${hit.majorId}/${hit.subId}`, 6 + bonus);
    if (!firstTag.has(hit.majorId)) firstTag.set(hit.majorId, i);
  });

  const ranked = MAJOR_CATEGORIES
    .map((m) => ({ id: m.id, score: majorScore.get(m.id) || 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      (firstTag.get(a.id) ?? 99) - (firstTag.get(b.id) ?? 99) ||
      (majorOrder.get(a.id)! - majorOrder.get(b.id)!));

  if (!ranked.length) return { majorId: FALLBACK_MAJOR_ID, subId: GENERAL_SUB_ID, score: 0, ambiguous: true };
  const best = ranked[0];
  let bestSub = GENERAL_SUB_ID;
  let bestSubScore = 0;
  for (const s of subsOf(best.id)) {
    const sc = subScore.get(`${best.id}/${s.id}`) || 0;
    if (sc > bestSubScore) { bestSub = s.id; bestSubScore = sc; }
  }
  const second = ranked[1]?.score ?? 0;
  // Also ambiguous when the title names another major's subject that the tags overruled.
  const titleDisagrees = [...titleHitMajors].some((id) => id !== best.id);
  return { majorId: best.id, subId: bestSub, score: best.score, ambiguous: best.score < 6 || best.score - second <= 2 || titleDisagrees };
}

/** The topic's home: the stored one when valid, otherwise computed. Never Other. */
export function resolveHome(topic: MapTopicRef): { majorId: string; subId: string; stored: boolean } {
  const stored = normalizeHome(topic.homeMajor, topic.homeSub);
  if (stored) return { ...stored, stored: true };
  const c = classifyTopic(topic);
  return { majorId: c.majorId, subId: c.subId, stored: false };
}

/** Best sub inside one major from keywords alone (used for "also in" placements). */
function pickSubInMajor(majorId: string, topic: MapTopicRef, hint?: string): string {
  if (hint) return hint;
  const title = (topic.title || "").toLowerCase();
  const desc = (topic.description || "").toLowerCase();
  let best = GENERAL_SUB_ID;
  let bestPts = 0;
  for (const s of subsOf(majorId)) {
    const pts = keywordPoints(s, title, desc);
    if (pts > bestPts) { best = s.id; bestPts = pts; }
  }
  return best;
}

export interface TopicPlacement {
  majorId: string;
  majorName: string;
  subId: string;
  subName: string;
}

const placementOf = (majorId: string, subId: string): TopicPlacement => ({
  majorId,
  majorName: majorById.get(majorId)?.name || majorId,
  subId,
  subName: getSub(majorId, subId)?.name || "General",
});

const MAX_ALSO_IN = 3;

/** Primary = the home. "Also in" = extra tags that are aliases of a different official major. */
export function placeTopic(topic: MapTopicRef): { primary: TopicPlacement; alsoIn: TopicPlacement[] } {
  const home = resolveHome(topic);
  const primary = placementOf(home.majorId, home.subId);
  const seenMajors = new Set([home.majorId]);
  const alsoIn: TopicPlacement[] = [];
  for (const tag of topic.categories || []) {
    const hit = resolveTag(tag);
    if (!hit || seenMajors.has(hit.majorId)) continue;
    seenMajors.add(hit.majorId);
    alsoIn.push(placementOf(hit.majorId, pickSubInMajor(hit.majorId, topic, hit.subId)));
    if (alsoIn.length >= MAX_ALSO_IN) break;
  }
  return { primary, alsoIn };
}

/** Counts of placements per major/sub (used by the groups endpoint and split detection). */
export function countByGroup(topics: MapTopicRef[]): { byMajor: Record<string, number>; bySub: Record<string, number> } {
  const byMajor: Record<string, number> = {};
  const bySub: Record<string, number> = {};
  for (const t of topics) {
    const h = resolveHome(t);
    byMajor[h.majorId] = (byMajor[h.majorId] || 0) + 1;
    bySub[`${h.majorId}/${h.subId}`] = (bySub[`${h.majorId}/${h.subId}`] || 0) + 1;
  }
  return { byMajor, bySub };
}

export function findSplitCandidates(bySub: Record<string, number>): SplitCandidate[] {
  return Object.entries(bySub)
    .filter(([key, count]) => count > SPLIT_THRESHOLD && !key.endsWith(`/${GENERAL_SUB_ID}`))
    .map(([key, count]) => {
      const [majorId, subId] = key.split("/");
      return { majorId, majorName: majorById.get(majorId)?.name || majorId, subId, subName: getSub(majorId, subId)?.name || subId, count };
    })
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Map tree

export function buildMapTree(topics: MapTopicRef[]): MapTreeNode {
  type Entry = { topic: MapTopicRef; subId: string; primary: boolean };
  // 1) place every topic (home + also-in copies)
  const buckets = new Map<string, Map<string, Entry[]>>(); // major -> sub -> entries
  const put = (majorId: string, e: Entry) => {
    const subs = buckets.get(majorId) || new Map<string, Entry[]>();
    const list = subs.get(e.subId) || [];
    list.push(e);
    subs.set(e.subId, list);
    buckets.set(majorId, subs);
  };
  for (const topic of topics) {
    const { primary, alsoIn } = placeTopic(topic);
    put(primary.majorId, { topic, subId: primary.subId, primary: true });
    for (const a of alsoIn) put(a.majorId, { topic, subId: a.subId, primary: false });
  }

  // 2) fold 1-topic subs into General while the major keeps enough other subs
  const foldedFrom = new Map<string, string>(); // `${major}/${topicId}/${primary}` -> original sub id
  for (const [majorId, subs] of buckets) {
    const named = [...subs.keys()].filter((id) => id !== GENERAL_SUB_ID);
    let remaining = named.length;
    const singles = named.filter((id) => subs.get(id)!.length === 1).sort();
    for (const id of singles) {
      if (remaining - 1 < FOLD_MIN_OTHER_SUBS) break;
      const [entry] = subs.get(id)!;
      subs.delete(id);
      remaining -= 1;
      const general = subs.get(GENERAL_SUB_ID) || [];
      general.push({ ...entry, subId: GENERAL_SUB_ID });
      subs.set(GENERAL_SUB_ID, general);
      foldedFrom.set(`${majorId}/${entry.topic.id}/${entry.primary}`, id);
    }
  }

  // 3) build nodes (final bubbles, after folding)
  const finalByTopic = new Map<string, { majorId: string; subId: string }[]>();
  for (const [majorId, subs] of buckets) {
    for (const [subId, entries] of subs) {
      for (const e of entries) {
        const list = finalByTopic.get(e.topic.id) || [];
        list.push({ majorId, subId });
        finalByTopic.set(e.topic.id, list);
      }
    }
  }
  const majorNodes: MapTreeNode[] = [];
  const counts: Record<string, number> = {};
  for (const major of MAJOR_CATEGORIES) {
    const subs = buckets.get(major.id);
    if (!subs || subs.size === 0) continue;
    const majorNode: MapTreeNode = { id: `major:${major.id}`, type: "major", name: major.name, count: 0, accent: major.accent, children: [] };
    for (const [subId, entries] of subs) {
      const sub = getSub(major.id, subId)!;
      const subNode: MapTreeNode = { id: `sub:major:${major.id}:${subId}`, type: "sub", name: sub.name, count: entries.length, accent: major.accent, children: [] };
      counts[`${major.id}/${subId}`] = entries.length;
      for (const e of entries) {
        const others = (finalByTopic.get(e.topic.id) || []).filter((p) => !(p.majorId === major.id && p.subId === subId));
        const node: MapTreeNode = {
          id: `topic:${e.topic.id}${e.primary ? "" : `:via:${major.id}`}`,
          type: "topic",
          name: e.topic.title,
          count: 1,
          topicId: e.topic.id,
          alsoIn: others.map((p) => ({
            id: `sub:major:${p.majorId}:${p.subId}`,
            name: getSub(p.majorId, p.subId)?.name || "General",
            majorId: `major:${p.majorId}`,
          })),
          children: [],
        };
        const original = foldedFrom.get(`${major.id}/${e.topic.id}/${e.primary}`);
        if (original) node.foldedFrom = getSub(major.id, original)?.name;
        subNode.children.push(node);
      }
      subNode.children.sort((a, b) => a.name.localeCompare(b.name));
      majorNode.count += entries.length;
      majorNode.children.push(subNode);
    }
    majorNode.children.sort((a, b) => {
      const ag = a.id.endsWith(`:${GENERAL_SUB_ID}`) ? 1 : 0;
      const bg = b.id.endsWith(`:${GENERAL_SUB_ID}`) ? 1 : 0;
      return ag - bg || b.count - a.count || a.name.localeCompare(b.name);
    });
    majorNodes.push(majorNode);
  }

  const splitCandidates = findSplitCandidates(counts);
  for (const c of splitCandidates) {
    const sub = majorNodes.find((m) => m.id === `major:${c.majorId}`)?.children.find((s) => s.id === `sub:major:${c.majorId}:${c.subId}`);
    if (sub) sub.splitSuggested = true;
  }
  return { id: ROOT_ID, type: "root", name: ROOT_NAME, count: topics.length, children: majorNodes, ...(splitCandidates.length ? { splitCandidates } : {}) };
}

export function findNode(root: MapTreeNode, id: string): MapTreeNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function findNodeByFocus(root: MapTreeNode, focus: string): MapTreeNode | undefined {
  if (!focus) return root;
  const direct = findNode(root, focus);
  if (direct) return direct;
  const lower = focus.toLowerCase();
  const stack: MapTreeNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.name.toLowerCase() === lower) return node;
    if (node.topicId === focus) return node;
    if (node.id.endsWith(`:${focus}`) || node.id === `major:${focus}` || node.id === `tag:${focus}`) return node;
    stack.push(...node.children);
  }
  return undefined;
}

export function pathToNode(root: MapTreeNode, id: string): MapTreeNode[] {
  const path: MapTreeNode[] = [];
  const walk = (node: MapTreeNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  walk(root);
  return path;
}

/** Local-only helper: a large fake tree so the map can be tested at scale. Never written to the database. */
export function buildSyntheticTopics(count = 420): MapTopicRef[] {
  const topics: MapTopicRef[] = [];
  let i = 0;
  while (topics.length < count) {
    const major = MAJOR_CATEGORIES[i % MAJOR_CATEGORIES.length];
    const subs = subsOf(major.id);
    const sub = subs[i % Math.max(subs.length, 1)];
    const keyword = sub?.keywords[0]?.replace(/\*$/, "") || major.name.toLowerCase();
    const also = MAJOR_CATEGORIES[(i + 3) % MAJOR_CATEGORIES.length];
    topics.push({
      id: `synthetic-${i}`,
      title: `${major.name} debate ${i + 1}: ${keyword}`,
      description: `A synthetic ${keyword} topic used only to test the map at scale.`,
      categories: i % 4 === 0 && also.id !== major.id ? [also.name] : [],
      homeMajor: major.id,
      homeSub: sub?.id,
    });
    i += 1;
  }
  return topics;
}

export function indexMapNodes(root: MapTreeNode): MapTreeNode[] {
  const out: MapTreeNode[] = [];
  const walk = (n: MapTreeNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

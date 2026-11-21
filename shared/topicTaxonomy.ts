/**
 * Explore Topics Map taxonomy
 *
 * Tweak this file to change how topics are grouped on the map. No database
 * change is required.
 *
 * - MAJOR_CATEGORIES are the top-level pills around the center.
 *   `tags` lists existing topic category labels (the strings already stored
 *   on each topic) that belong to that major.
 * - SUBCATEGORIES radiate under a major. A topic is placed in the first sub
 *   whose `keywords` appear in the title or description (case-insensitive),
 *   or whose `tags` match one of the topic's category labels.
 * - A topic's first matching category tag is its primary parent. Other
 *   matches show up on the map as "also in" links.
 * - Tags that are not listed anywhere land under the "Other" major, in a
 *   sub named after the tag, so nothing is dropped. Add a tag to `tags`
 *   above to give it a real home.
 */

export interface MajorCategory {
  id: string;
  name: string;
  tags: string[];
  /** Optional accent used as a faint pill tint on the map. */
  accent: string;
}

export interface Subcategory {
  id: string;
  name: string;
  majorId: string;
  /** Matched against title + description (case-insensitive substring). */
  keywords: string[];
  /** If the topic carries one of these category tags, prefer this sub. */
  tags?: string[];
}

export const OTHER_MAJOR_ID = "other";

export const MAJOR_CATEGORIES: MajorCategory[] = [
  {
    id: "politics",
    name: "Politics",
    tags: ["Politics", "Law"],
    accent: "hsl(4 72% 66%)",
  },
  {
    id: "economics",
    name: "Economics",
    tags: ["Economics", "Business"],
    accent: "hsl(28 80% 58%)",
  },
  {
    id: "science",
    name: "Science",
    tags: ["Science"],
    accent: "hsl(200 70% 62%)",
  },
  {
    id: "climate",
    name: "Climate",
    tags: ["Climate", "Environment"],
    accent: "hsl(150 50% 48%)",
  },
  {
    id: "technology",
    name: "Technology",
    tags: ["Technology"],
    accent: "hsl(260 50% 70%)",
  },
  {
    id: "social-policy",
    name: "Social Policy",
    tags: ["Society"],
    accent: "hsl(340 45% 68%)",
  },
  {
    id: "health",
    name: "Health",
    tags: ["Health"],
    accent: "hsl(350 62% 62%)",
  },
  {
    id: "education",
    name: "Education",
    tags: ["Education"],
    accent: "hsl(45 70% 55%)",
  },
  {
    id: "culture",
    name: "Culture",
    tags: ["Entertainment", "Arts", "Sports", "Food"],
    accent: "hsl(18 70% 62%)",
  },
  {
    id: "ideas",
    name: "Ideas",
    tags: ["Philosophy", "Religion", "Ethics"],
    accent: "hsl(270 35% 68%)",
  },
];

export const SUBCATEGORIES: Subcategory[] = [
  // Politics
  { id: "elections", name: "Elections & Voting", majorId: "politics", keywords: ["voting", "election", "ranked-choice", "ranked choice", "ballot", "mandatory voting"] },
  { id: "immigration", name: "Immigration", majorId: "politics", keywords: ["immigration", "immigrant", "border", "asylum"] },
  { id: "guns", name: "Guns & Safety", majorId: "politics", keywords: ["gun", "firearm", "background check", "second amendment"] },
  { id: "government", name: "Government", majorId: "politics", keywords: ["congress", "term limit", "senate", "parliament", "constitution"] },
  { id: "law-courts", name: "Law & Courts", majorId: "politics", keywords: ["legal", "court", "copyright", "law"], tags: ["Law"] },
  // Economics
  { id: "taxes", name: "Taxes & Wealth", majorId: "economics", keywords: ["tax", "wealth", "billionaire", "income"] },
  { id: "work", name: "Work & Labor", majorId: "economics", keywords: ["work week", "remote work", "four-day", "four day", "labor", "employee", "wage", "union"] },
  { id: "business", name: "Business", majorId: "economics", keywords: ["business", "company", "market", "corporate"], tags: ["Business"] },
  { id: "cost-of-living", name: "Cost of Living", majorId: "economics", keywords: ["cost", "tuition", "afford", "worth the cost", "student debt"] },
  // Science
  { id: "biology", name: "Biology & Nature", majorId: "science", keywords: ["species", "extinct", "gene", "biology", "evolve"] },
  { id: "research", name: "Research", majorId: "science", keywords: ["research", "experiment", "scientific"] },
  { id: "energy-science", name: "Energy Science", majorId: "science", keywords: ["nuclear", "fusion", "physics"] },
  // Climate
  { id: "emissions", name: "Energy & Emissions", majorId: "climate", keywords: ["carbon", "emission", "gas car", "fossil", "nuclear power", "2035"] },
  { id: "conservation", name: "Conservation", majorId: "climate", keywords: ["conservation", "extinct", "biodiversity", "wildlife"] },
  { id: "climate-policy", name: "Climate Policy", majorId: "climate", keywords: ["climate", "environment", "green", "warming"], tags: ["Climate", "Environment"] },
  // Technology
  { id: "ai", name: "AI", majorId: "technology", keywords: ["ai", "artificial intelligence", "machine learning", "ai-generated", "ai art"] },
  { id: "social-media", name: "Social Media", majorId: "technology", keywords: ["social media", "under 16", "kids", "tiktok", "facebook", "instagram"] },
  { id: "digital-rights", name: "Digital Rights", majorId: "technology", keywords: ["id", "privacy", "copyright", "surveillance", "data"] },
  { id: "tech-work", name: "Tech & Work", majorId: "technology", keywords: ["remote", "automation", "default"] },
  // Social Policy
  { id: "culture-norms", name: "Culture & Norms", majorId: "social-policy", keywords: ["cancel culture", "culture", "norm", "separate the art"] },
  { id: "community", name: "Community", majorId: "social-policy", keywords: ["community", "society", "public"], tags: ["Society"] },
  // Health
  { id: "public-health", name: "Public Health", majorId: "health", keywords: ["health", "vaccine", "diet", "meat", "nutrition"], tags: ["Health"] },
  { id: "bioethics", name: "Bioethics", majorId: "health", keywords: ["assisted dying", "euthanasia", "terminally ill", "abortion"] },
  // Education
  { id: "higher-ed", name: "Higher Education", majorId: "education", keywords: ["college", "university", "tuition", "student"] },
  { id: "schools", name: "Schools", majorId: "education", keywords: ["school", "k-12", "teacher", "curriculum"], tags: ["Education"] },
  { id: "campus-sports", name: "Campus Sports", majorId: "education", keywords: ["college athlete", "ncaa", "student athlete"] },
  // Culture
  { id: "arts-media", name: "Arts & Media", majorId: "culture", keywords: ["art", "artist", "copyright", "entertainment", "movie", "music"], tags: ["Entertainment", "Arts"] },
  { id: "sports", name: "Sports", majorId: "culture", keywords: ["sport", "athlete", "doping", "performance-enhancing"], tags: ["Sports"] },
  { id: "food", name: "Food", majorId: "culture", keywords: ["food", "pizza", "pineapple", "diet"], tags: ["Food"] },
  // Ideas
  { id: "philosophy", name: "Philosophy", majorId: "ideas", keywords: ["free will", "exist", "consciousness", "meaning"], tags: ["Philosophy"] },
  { id: "religion", name: "Religion", majorId: "ideas", keywords: ["god", "religion", "faith", "church"], tags: ["Religion"] },
  { id: "ethics", name: "Ethics", majorId: "ideas", keywords: ["ethical", "ethics", "moral"], tags: ["Ethics"] },
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
  categories: string[];
}

export interface MapTreeNode {
  id: string;
  type: MapNodeType;
  name: string;
  count: number;
  accent?: string;
  topicId?: string;
  alsoIn?: MapAlsoIn[];
  children: MapTreeNode[];
}

const tagToMajor = new Map<string, MajorCategory>();
for (const major of MAJOR_CATEGORIES) {
  for (const tag of major.tags) {
    if (!tagToMajor.has(tag)) tagToMajor.set(tag, major);
  }
}

function textBlob(topic: MapTopicRef): string {
  return `${topic.title} ${topic.description || ""}`.toLowerCase();
}

function majorForTag(tag: string): MajorCategory | undefined {
  return tagToMajor.get(tag);
}

function pickSub(majorId: string, topic: MapTopicRef, tag?: string): Subcategory | undefined {
  const candidates = SUBCATEGORIES.filter((s) => s.majorId === majorId);
  const blob = textBlob(topic);
  let best: { sub: Subcategory; score: number } | undefined;
  for (const sub of candidates) {
    let score = 0;
    for (const kw of sub.keywords) {
      if (kw && blob.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { sub, score };
  }
  if (best) return best.sub;
  if (tag) {
    const byTag = candidates.find((s) => s.tags?.includes(tag));
    if (byTag) return byTag;
  }
  return undefined;
}

export interface TopicPlacement {
  majorId: string;
  majorName: string;
  subId: string;
  subName: string;
  fromTag: string;
}

export function placeTopic(topic: MapTopicRef): { primary: TopicPlacement; alsoIn: TopicPlacement[] } {
  const placements: TopicPlacement[] = [];
  const seen = new Set<string>();
  const tags = topic.categories?.length ? topic.categories : ["General"];

  for (const tag of tags) {
    const major = majorForTag(tag) || {
      id: OTHER_MAJOR_ID,
      name: "Other",
      tags: [],
      accent: "hsl(30 10% 50%)",
    };
    const sub = pickSub(major.id, topic, tag) || {
      id: `tag:${tag}`,
      name: tag === major.name ? "General" : tag,
      majorId: major.id,
      keywords: [],
    };
    const key = `${major.id}/${sub.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    placements.push({
      majorId: major.id,
      majorName: major.name,
      subId: sub.id,
      subName: sub.name,
      fromTag: tag,
    });
  }

  if (!placements.length) {
    placements.push({
      majorId: OTHER_MAJOR_ID,
      majorName: "Other",
      subId: "tag:General",
      subName: "General",
      fromTag: "General",
    });
  }

  return { primary: placements[0], alsoIn: placements.slice(1) };
}

export function buildMapTree(topics: MapTopicRef[]): MapTreeNode {
  const majors = new Map<string, MapTreeNode>();
  const ensureMajor = (id: string, name: string, accent?: string): MapTreeNode => {
    let node = majors.get(id);
    if (!node) {
      node = { id: `major:${id}`, type: "major", name, count: 0, accent, children: [] };
      majors.set(id, node);
    }
    return node;
  };
  const ensureSub = (major: MapTreeNode, subId: string, subName: string): MapTreeNode => {
    const id = `sub:${major.id}:${subId}`;
    let node = major.children.find((c) => c.id === id);
    if (!node) {
      node = { id, type: "sub", name: subName, count: 0, accent: major.accent, children: [] };
      major.children.push(node);
    }
    return node;
  };

  for (const major of MAJOR_CATEGORIES) {
    ensureMajor(major.id, major.name, major.accent);
  }

  for (const topic of topics) {
    const { primary, alsoIn } = placeTopic(topic);
    const placements = [primary, ...alsoIn];
    for (const place of placements) {
      const majorDef = MAJOR_CATEGORIES.find((m) => m.id === place.majorId);
      const majorNode = ensureMajor(place.majorId, place.majorName, majorDef?.accent);
      const subNode = ensureSub(majorNode, place.subId, place.subName);
      const others = placements.filter((p) => p !== place);
      // Topic ids must be unique in the SVG tree; suffix non-primary copies.
      const suffix = place === primary ? "" : `:via:${place.majorId}`;
      subNode.children.push({
        id: `topic:${topic.id}${suffix}`,
        type: "topic",
        name: topic.title,
        count: 1,
        topicId: topic.id,
        alsoIn: others.map((p) => ({
          id: `sub:major:${p.majorId}:${p.subId}`,
          name: p.subName,
          majorId: `major:${p.majorId}`,
        })),
        children: [],
      });
      subNode.count += 1;
      majorNode.count += 1;
    }
  }

  // Drop empty majors so the top ring only shows groups that have topics,
  // but keep declared majors with zero count? Better to hide empty ones.
  const children = [...majors.values()].filter((m) => m.count > 0);
  // Sort majors in the declared order, Other last
  const order = new Map(MAJOR_CATEGORIES.map((m, i) => [m.id, i]));
  children.sort((a, b) => {
    const aid = a.id.replace(/^major:/, "");
    const bid = b.id.replace(/^major:/, "");
    const ao = aid === OTHER_MAJOR_ID ? 1000 : order.get(aid) ?? 500;
    const bo = bid === OTHER_MAJOR_ID ? 1000 : order.get(bid) ?? 500;
    return ao - bo;
  });
  for (const major of children) {
    major.children.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    for (const sub of major.children) {
      sub.children.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const total = topics.length;
  return { id: ROOT_ID, type: "root", name: ROOT_NAME, count: total, children };
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
  const majors = MAJOR_CATEGORIES;
  const topics: MapTopicRef[] = [];
  let i = 0;
  while (topics.length < count) {
    const major = majors[i % majors.length];
    const subs = SUBCATEGORIES.filter((s) => s.majorId === major.id);
    const sub = subs[i % Math.max(subs.length, 1)];
    const keyword = sub?.keywords[0] || major.name.toLowerCase();
    const tag = major.tags[i % major.tags.length];
    const also = majors[(i + 3) % majors.length].tags[0];
    topics.push({
      id: `synthetic-${i}`,
      title: `${major.name} debate ${i + 1}: ${keyword}`,
      description: `A synthetic ${keyword} topic used only to test the map at scale.`,
      categories: i % 4 === 0 && also !== tag ? [tag, also] : [tag],
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

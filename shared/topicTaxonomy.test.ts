import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAJOR_CATEGORIES,
  SUBCATEGORIES,
  GENERAL_SUB_ID,
  SPLIT_THRESHOLD,
  FOLD_NEW_TOPIC_DAYS,
  FOLD_RECENT_ACTIVITY_DAYS,
  compareFoldActivity,
  buildMapTree,
  classifyTopic,
  findSplitCandidates,
  normalizeHome,
  placeTopic,
  resolveHome,
  resolveTag,
  type MapTopicRef,
  type MapTreeNode,
} from "./topicTaxonomy.ts";

const t = (id: string, title: string, categories: string[] = [], extra: Partial<MapTopicRef> = {}): MapTopicRef => ({ id, title, description: title, categories, ...extra });
const walk = (n: MapTreeNode, out: MapTreeNode[] = []) => { out.push(n); n.children.forEach((c) => walk(c, out)); return out; };

describe("topicTaxonomy: official groups", () => {
  it("has the new majors and a General sub for every major", () => {
    for (const name of ["Vehicles", "Food & Cooking", "Religion", "Entertainment", "Sports"]) {
      assert.ok(MAJOR_CATEGORIES.some((m) => m.name === name), `missing major ${name}`);
    }
    for (const m of MAJOR_CATEGORIES) {
      assert.ok(SUBCATEGORIES.some((s) => s.majorId === m.id && s.id === GENERAL_SUB_ID), `${m.name} has no General sub`);
    }
    const keys = SUBCATEGORIES.map((s) => `${s.majorId}/${s.id}`);
    assert.equal(new Set(keys).size, keys.length, "duplicate sub ids");
    assert.ok(!MAJOR_CATEGORIES.some((m) => m.name === "Other"));
  });

  it("resolves the alias and naming-trap tags", () => {
    const cases: [string, string][] = [
      ["Movies", "entertainment"], ["Film", "entertainment"], ["Culture", "culture"], ["Social Policy", "social-policy"],
      ["Society", "social-policy"], ["Labor Market", "economics"], ["Future of Work", "economics"], ["Welfare", "social-policy"],
      ["Faith", "religion"], ["Cars", "vehicles"], ["Trucks", "vehicles"], ["Recipes", "food"], ["Food", "food"], ["Sports", "sports"],
      ["Religion", "religion"], ["Philosophy", "ideas"], ["Law", "politics"],
    ];
    for (const [tag, major] of cases) assert.equal(resolveTag(tag)?.majorId, major, tag);
    assert.equal(resolveTag("  movies ")?.majorId, "entertainment");
    assert.equal(resolveTag("zzz-not-a-tag"), undefined);
  });

  it("normalizeHome accepts ids or names and falls back to General for a missing sub", () => {
    assert.deepEqual(normalizeHome("entertainment", "movies"), { majorId: "entertainment", subId: "movies" });
    assert.deepEqual(normalizeHome("Food & Cooking", "Recipes & Cooking"), { majorId: "food", subId: "recipes" });
    assert.deepEqual(normalizeHome("vehicles"), { majorId: "vehicles", subId: GENERAL_SUB_ID });
    assert.deepEqual(normalizeHome("vehicles", "nope"), { majorId: "vehicles", subId: GENERAL_SUB_ID });
    assert.equal(normalizeHome("other", "movies"), null);
    assert.equal(normalizeHome(null), null);
    assert.equal(normalizeHome("movies", "movies"), null); // a sub id is not a major
  });
});

describe("topicTaxonomy: classifyTopic", () => {
  const home = (title: string, tags: string[] = []) => { const c = classifyTopic({ title, description: title, categories: tags }); return `${c.majorId}/${c.subId}`; };

  it("places general-site topics in sensible homes", () => {
    assert.equal(home("The best action movie of all time", ["Movies", "Action"]), "entertainment/movies");
    assert.equal(home("Does God exist?", ["Religion", "Philosophy"]), "religion/beliefs");
    assert.equal(home("Is a manual transmission better than an automatic?", ["Cars"]), "vehicles/cars-trucks");
    assert.equal(home("Should pineapple go on pizza?", ["Food"]), "food/dishes");
    assert.equal(home("Is a gas-powered pickup better than an electric truck?"), "vehicles/cars-trucks");
    assert.equal(home("Should college athletes be paid as employees?", ["Sports", "Education"]), "sports/college-sports");
    assert.equal(home("Should every gun sale require a background check?", ["Law", "Politics"]), "politics/guns");
    assert.equal(home("Bruce Lee is the greatest fighter of all time", ["Martial Arts"]), "sports/combat-sports");
  });

  it("does not misfire on short words inside other words (whole-word matching)", () => {
    // "exist" alone is no longer a Philosophy keyword, and "id"/"art" do not fire inside other words.
    assert.notEqual(home("Do aliens exist?"), "ideas/philosophy");
    assert.equal(home("Do aliens exist?"), "science/space-physics");
    assert.notEqual(home("Is the party over for pizza parties?").split("/")[1], "arts-literature");
    assert.equal(home("Should residents get a vote on rent control?").split("/")[0] === "technology", false);
  });

  it("never returns Other: unknown tags and empty text fall back to a real major's General", () => {
    const c = classifyTopic({ title: "zzz qqq", description: "", categories: ["Totally Unknown Tag"] });
    assert.equal(c.majorId, "culture");
    assert.equal(c.subId, GENERAL_SUB_ID);
    assert.equal(c.ambiguous, true);
    const tree = buildMapTree([t("1", "zzz qqq", ["Totally Unknown Tag"]), t("2", "Does God exist?", ["Weird", "Odd"])]);
    assert.ok(!walk(tree).some((n) => n.name === "Other"));
    const g = classifyTopic({ title: "opinion", description: "topic", categories: ["Politics", "Society", "General"] });
    assert.equal(g.majorId, "politics");
  });

  it("a stored home beats keywords, and an invalid stored home falls back to classification", () => {
    assert.deepEqual(resolveHome(t("1", "Does God exist?", ["Religion"], { homeMajor: "ideas", homeSub: "philosophy" })), { majorId: "ideas", subId: "philosophy", stored: true });
    const r = resolveHome(t("1", "Does God exist?", ["Religion"], { homeMajor: "other", homeSub: "x" }));
    assert.equal(r.stored, false);
    assert.equal(r.majorId, "religion");
  });

  it("extra tags that name a different major show as 'also in'; the home decides the primary", () => {
    const { primary, alsoIn } = placeTopic(t("1", "Best fast food burger", ["Restaurants", "Entertainment", "Zzz"], { homeMajor: "food", homeSub: "restaurants" }));
    assert.equal(primary.majorId, "food");
    assert.deepEqual(alsoIn.map((a) => a.majorId), ["entertainment"]);
  });
});

describe("topicTaxonomy: map depth rules", () => {
  it("is two group levels: root -> major -> sub -> topic", () => {
    const tree = buildMapTree([t("1", "Does God exist?", [], { homeMajor: "religion", homeSub: "beliefs" })]);
    const types = walk(tree).map((n) => n.type);
    assert.deepEqual([...new Set(types)].sort(), ["major", "root", "sub", "topic"]);
    const sub = tree.children[0].children[0];
    assert.equal(sub.type, "sub");
    assert.equal(sub.children[0].type, "topic");
    assert.equal(sub.children[0].children.length, 0);
  });

  it("folds 1-topic subs into General only while the major keeps 3+ other subs", () => {
    // Culture: 4 single-topic subs + 0 General. Fold keeps at least 3 named subs.
    const topics = [
      t("a", "a", [], { homeMajor: "culture", homeSub: "arts-literature" }),
      t("b", "b", [], { homeMajor: "culture", homeSub: "holidays" }),
      t("c", "c", [], { homeMajor: "culture", homeSub: "media-news" }),
      t("d", "d", [], { homeMajor: "culture", homeSub: "travel" }),
    ];
    const culture = buildMapTree(topics).children.find((m) => m.name === "Culture")!;
    const named = culture.children.filter((s) => s.name !== "General");
    assert.equal(named.length, 3);
    const general = culture.children.find((s) => s.name === "General")!;
    assert.equal(general.children.length, 1);
    assert.ok(general.children[0].foldedFrom, "folded topic remembers its sub");
    assert.equal(culture.count, 4);
  });


  it("folds the least-active single first: no recent activity before recent, then fewer opinions, then older topics", () => {
    const now = Date.parse("2026-11-27T21:00:00-06:00");
    const day = 24 * 60 * 60 * 1000;
    const topics = [
      t("hot", "hot", [], { homeMajor: "culture", homeSub: "arts-literature", createdAt: now - 40 * day, opinionsCount: 2, lastActivity: now - 2 * day }),
      t("busy", "busy", [], { homeMajor: "culture", homeSub: "holidays", createdAt: now - 40 * day, opinionsCount: 8, lastActivity: now - 40 * day }),
      t("quiet-newish", "quiet-newish", [], { homeMajor: "culture", homeSub: "media-news", createdAt: now - 20 * day, opinionsCount: 1, lastActivity: now - 20 * day }),
      t("quiet-old", "quiet-old", [], { homeMajor: "culture", homeSub: "travel", createdAt: now - 60 * day, opinionsCount: 1, lastActivity: now - 60 * day }),
    ];
    const culture = buildMapTree(topics, now).children.find((m) => m.name === "Culture")!;
    const general = culture.children.find((s) => s.name === "General")!;
    // Only one needs to fold. quiet-old is least active (no activity in 14 days, 1 opinion, oldest).
    assert.equal(general.children.length, 1);
    assert.equal(general.children[0].topicId, "quiet-old");
    assert.equal(general.children[0].foldedFrom, "Travel & Places");
    assert.ok(culture.children.some((s) => s.name === "Arts & Literature"));
    assert.ok(culture.children.some((s) => s.name === "Holidays & Traditions"));
    assert.ok(culture.children.some((s) => s.name === "Media & News"));
  });

  it("keeps a brand-new topic unfolded when an older quiet single can fold instead", () => {
    const now = Date.parse("2026-11-27T21:00:00-06:00");
    const day = 24 * 60 * 60 * 1000;
    const topics = [
      t("new", "new", [], { homeMajor: "culture", homeSub: "arts-literature", createdAt: now - 2 * day, opinionsCount: 0 }),
      t("old-a", "old-a", [], { homeMajor: "culture", homeSub: "holidays", createdAt: now - 40 * day, opinionsCount: 0 }),
      t("old-b", "old-b", [], { homeMajor: "culture", homeSub: "media-news", createdAt: now - 30 * day, opinionsCount: 3, lastActivity: now - 1 * day }),
      t("old-c", "old-c", [], { homeMajor: "culture", homeSub: "travel", createdAt: now - 25 * day, opinionsCount: 1 }),
    ];
    const culture = buildMapTree(topics, now).children.find((m) => m.name === "Culture")!;
    const general = culture.children.find((s) => s.name === "General")!;
    assert.equal(general.children[0].topicId, "old-a"); // oldest, no recent activity, 0 opinions
    assert.ok(culture.children.some((s) => s.name === "Arts & Literature"), "brand-new topic stays in its sub");
    assert.equal(culture.children.find((s) => s.name === "Arts & Literature")!.children[0].topicId, "new");
  });

  it("still folds a brand-new topic if every single is new, using the same activity order", () => {
    const now = Date.parse("2026-11-27T21:00:00-06:00");
    const day = 24 * 60 * 60 * 1000;
    const topics = [
      t("n1", "n1", [], { homeMajor: "culture", homeSub: "arts-literature", createdAt: now - 6 * day, opinionsCount: 0 }),
      t("n2", "n2", [], { homeMajor: "culture", homeSub: "holidays", createdAt: now - 1 * day, opinionsCount: 4, lastActivity: now - 1 * day }),
      t("n3", "n3", [], { homeMajor: "culture", homeSub: "media-news", createdAt: now - 3 * day, opinionsCount: 0 }),
      t("n4", "n4", [], { homeMajor: "culture", homeSub: "travel", createdAt: now - 5 * day, opinionsCount: 2, lastActivity: now - 5 * day }),
    ];
    const general = buildMapTree(topics, now).children.find((m) => m.name === "Culture")!.children.find((s) => s.name === "General")!;
    // All are new, so newness ties. n1 and n3 have no recent activity and 0 opinions; n1 is older.
    assert.equal(general.children[0].topicId, "n1");
  });

  it("is deterministic: the same topics and now always fold the same sub, using topic id as the last tie-break", () => {
    const now = 1_800_000_000_000;
    const topics = [
      t("b", "b", [], { homeMajor: "culture", homeSub: "holidays", createdAt: now - 40 * 86400000, opinionsCount: 1 }),
      t("a", "a", [], { homeMajor: "culture", homeSub: "arts-literature", createdAt: now - 40 * 86400000, opinionsCount: 1 }),
      t("c", "c", [], { homeMajor: "culture", homeSub: "media-news", createdAt: now - 40 * 86400000, opinionsCount: 1 }),
      t("d", "d", [], { homeMajor: "culture", homeSub: "travel", createdAt: now - 40 * 86400000, opinionsCount: 1 }),
    ];
    const folded = () => {
      const g = buildMapTree(topics, now).children.find((m) => m.name === "Culture")!.children.find((s) => s.name === "General")!;
      return g.children[0].topicId;
    };
    assert.equal(folded(), "a");
    assert.equal(folded(), folded());
    assert.ok(FOLD_NEW_TOPIC_DAYS === 7 && FOLD_RECENT_ACTIVITY_DAYS === 14);
    assert.ok(compareFoldActivity(topics[1], topics[0], now) < 0);
  });

  it("does not fold when the major has too few subs", () => {
    const tree = buildMapTree([
      t("a", "a", [], { homeMajor: "religion", homeSub: "beliefs" }),
      t("b", "b", [], { homeMajor: "religion", homeSub: "christianity" }),
    ]);
    const religion = tree.children.find((m) => m.name === "Religion")!;
    assert.deepEqual(religion.children.map((s) => s.name).sort(), ["Christianity", "God & Beliefs"]);
  });

  it("flags a sub over the split threshold without renaming or moving anything", () => {
    const many = Array.from({ length: SPLIT_THRESHOLD + 1 }, (_, i) => t(`m${i}`, `movie ${i}`, [], { homeMajor: "entertainment", homeSub: "movies" }));
    const tree = buildMapTree(many);
    assert.equal(tree.splitCandidates?.[0].subName, "Movies & Film");
    assert.equal(tree.splitCandidates?.[0].count, SPLIT_THRESHOLD + 1);
    assert.equal(walk(tree).find((n) => n.name === "Movies & Film")?.splitSuggested, true);
    assert.deepEqual(findSplitCandidates({ "entertainment/movies": SPLIT_THRESHOLD }), []);
    const small = buildMapTree(many.slice(0, 5));
    assert.equal(small.splitCandidates, undefined);
  });

  it("hides empty majors and counts unique topics at the root", () => {
    const tree = buildMapTree([t("1", "Does God exist?", ["Philosophy"], { homeMajor: "religion", homeSub: "beliefs" })]);
    assert.equal(tree.count, 1);
    assert.deepEqual(tree.children.map((m) => m.name), ["Religion", "Ideas"]); // declared order; the empty majors are hidden
    assert.ok(tree.children.every((m) => m.count > 0));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeOpinion,
  isBareOpinion,
  opinionXp,
  opinionXpFromRows,
  xpForQuality,
  MAX_OPINION_XP,
  structurePrompt,
  STRENGTH_LEVEL_LABEL,
} from "./opinionStrength.ts";

const NUCLEAR_STRONG = `Yes, nuclear power should be used because it has a much lower carbon footprint than coal or gas — roughly 12g CO2 per kWh according to the IPCC, versus several hundred for fossil fuels. For example, France already gets most of its electricity from reactors. Critics argue that waste and meltdown risk make it unsafe; however, modern plants are far safer than the legacy ones people remember, and that doesn't change my mind given the climate cost of delay. I could be wrong if it turned out that renewables plus storage can reliably cover baseload at a similar cost; that would change my mind.`;

describe("analyzeOpinion", () => {
  it("treats empty text as not bare (nothing to submit) with a zero score", () => {
    const result = analyzeOpinion("");
    assert.equal(result.wordCount, 0);
    assert.equal(result.score, 0);
    assert.equal(result.isBare, false);
    assert.equal(result.level, "bare");
  });

  it("treats whitespace-only text like empty", () => {
    const result = analyzeOpinion("   \n\t  ");
    assert.equal(result.wordCount, 0);
    assert.equal(result.isBare, false);
    assert.equal(result.score, 0);
  });

  it("flags a one-word yes as bare, with nothing ticked (a bare yes is not a stance)", () => {
    const result = analyzeOpinion("yes");
    assert.equal(result.wordCount, 1);
    assert.equal(result.parts.stance, false);
    assert.equal(result.parts.reason, false);
    assert.equal(result.isBare, true);
    assert.equal(result.level, "bare");
    assert.equal(STRENGTH_LEVEL_LABEL[result.level], "Bare");
  });

  it("flags a short stance without a reason as bare", () => {
    const result = analyzeOpinion("Yes, nuclear power should be used");
    assert.equal(result.parts.stance, true);
    assert.equal(result.parts.reason, false);
    assert.equal(result.isBare, true);
    assert.equal(isBareOpinion("Yes, nuclear power should be used"), true);
  });

  it("does not flag a short take that includes a reason", () => {
    const result = analyzeOpinion("Yes, because it has a lower carbon footprint.");
    assert.equal(result.parts.stance, true);
    assert.equal(result.parts.reason, true);
    assert.equal(result.isBare, false);
    assert.ok(result.level === "basic" || result.level === "solid");
  });

  it("detects reason, support, the other side and openness in a strong nuclear take", () => {
    const result = analyzeOpinion(NUCLEAR_STRONG);
    assert.equal(result.parts.stance, true);
    assert.equal(result.parts.reason, true);
    assert.equal(result.parts.support, true);
    assert.equal(result.parts.otherSide, true);
    assert.equal(result.parts.openness, true);
    assert.equal(result.isBare, false);
    assert.equal(result.level, "strong");
    assert.ok(result.score >= 70);
    assert.ok(result.wordCount > 50);
  });

  it("detects a URL and 'for example' as support", () => {
    const result = analyzeOpinion(
      "I think we should keep nuclear power because it keeps carbon low. For example, France runs most of its grid on reactors and the emissions numbers at https://www.ipcc.ch back that up.",
    );
    assert.equal(result.parts.stance, true);
    assert.equal(result.parts.reason, true);
    assert.equal(result.parts.support, true);
    assert.equal(result.isBare, false);
  });

  it("detects percentages and 'in my experience' as support", () => {
    const result = analyzeOpinion(
      "I believe it works because in my experience towns with 70% nuclear power had cheaper bills.",
    );
    assert.equal(result.parts.support, true);
    assert.equal(result.parts.reason, true);
  });

  it("detects other-side signals like however and some argue", () => {
    const result = analyzeOpinion(
      "I support it because it produces far less carbon than coal. Some argue the waste is dangerous and lasts for thousands of years; however, that risk is manageable with deep storage.",
    );
    assert.equal(result.parts.otherSide, true);
    assert.equal(result.parts.reason, true);
  });

  it("detects openness signals like unless and I could be wrong", () => {
    const result = analyzeOpinion(
      "Yes, I think we should, because the climate math is clear. I could be wrong if it turned out that battery storage gets much cheaper than reactors.",
    );
    assert.equal(result.parts.openness, true);
  });

  it("does not treat a lone 'so' at the start as a reason", () => {
    const result = analyzeOpinion("So yes.");
    assert.equal(result.parts.reason, false);
    assert.equal(result.isBare, true);
  });

  it("treats ', so' as a reason signal", () => {
    const result = analyzeOpinion("The carbon footprint is lower, so we should build more reactors soon.");
    assert.equal(result.parts.reason, true);
    assert.equal(result.isBare, false);
  });

  it("ranks a mid-length reasoned take as at least basic, usually solid", () => {
    const result = analyzeOpinion(
      "I think nuclear power should stay in the mix because it cuts carbon while keeping the lights on at night.",
    );
    assert.equal(result.isBare, false);
    assert.ok(result.score >= 40 || result.level === "basic");
    assert.notEqual(result.level, "bare");
  });
});

describe("structurePrompt", () => {
  it("returns a generic prompt without a topic", () => {
    assert.match(structurePrompt(), /stance/);
    assert.match(structurePrompt(""), /stance/);
  });

  it("mentions the topic question when provided", () => {
    const prompt = structurePrompt(
      "Should nuclear power be used because it has a lower carbon footprint",
    );
    assert.match(prompt, /nuclear power/);
    assert.match(prompt, /not just yes or no/i);
  });
});


// ---------------------------------------------------------------------------
// Strength indicator v2 (Fuller Feuds Dev, Nov 27 2026): topic-agnostic, hard to game, XP 0-25.
// ---------------------------------------------------------------------------

const STUFFED = "yes because random.co on the other hand my mind is open";
const PINEAPPLE =
  "Pineapple belongs on pizza because the acidity cuts the grease. I've tested it on five different pies and the ones without it tasted heavier. The counter is that it makes the pizza sweet, but that only happens if you use canned rings instead of fresh.";
const POLITICAL =
  "I think the federal minimum wage should be raised because it hasn't kept up with rent. In 2009 it was $7.25 an hour and a full-time worker still can't afford a one-bedroom apartment in most cities. Critics argue that higher wages cost jobs; however, studies of neighboring counties in Pennsylvania and New Jersey found little employment loss. I'd reconsider if new evidence showed large job losses in low-cost regions.";
const VEHICLE =
  "I think the Toyota Tacoma is a better daily truck than the Ford Ranger because the 2.7 liter engine has a long record of reliability. My Tacoma hit 240,000 miles on the original timing chain and only needed brakes and fluids. The Ranger is cheaper and rides nicer, but resale value drops faster. I'd reconsider if Ford's reliability numbers improved over a few years.";

describe("strength indicator v2", () => {
  it("scores the stuffing example near 0 with ~0 XP and no ticks", () => {
    const r = analyzeOpinion(STUFFED);
    assert.ok(r.score <= 5, `score ${r.score}`);
    assert.ok(r.xp <= 1, `xp ${r.xp}`);
    assert.equal(opinionXp(STUFFED), r.xp);
    for (const ticked of Object.values(r.parts)) assert.equal(ticked, false);
  });

  it("scores more cue-stuffing variants at ~0 XP", () => {
    for (const t of [
      "yes because studies show for example however people say my mind is open unless",
      "because because because because because because because because",
      "I think because however for example unless on the other hand https://a.com https://b.com https://c.com",
      "I think tax cuts are good because https://random.co/x",
    ]) {
      const r = analyzeOpinion(t);
      assert.ok(r.xp <= 1, `${t} -> xp ${r.xp}`);
      assert.equal(r.parts.reason, false);
    }
  });

  it("scores a lone 'yes' ~0", () => {
    assert.equal(analyzeOpinion("yes").score, 0);
    assert.equal(opinionXp("yes"), 0);
    assert.equal(opinionXp("Yes definitely"), 0);
    assert.equal(opinionXp("no way"), 0);
  });

  it("scores the pineapple pizza example high, with stance, reason, support and other side ticked", () => {
    const r = analyzeOpinion(PINEAPPLE);
    assert.ok(r.score >= 65, `score ${r.score}`);
    assert.ok(r.xp >= 12, `xp ${r.xp}`);
    assert.equal(r.level, "strong");
    assert.deepEqual(r.parts, { stance: true, reason: true, support: true, otherSide: true, openness: false });
  });

  it("scores a solid political example well", () => {
    const r = analyzeOpinion(POLITICAL);
    assert.ok(r.score >= 70, `score ${r.score}`);
    assert.ok(r.xp >= 15, `xp ${r.xp}`);
    assert.equal(r.parts.otherSide, true);
    assert.equal(r.parts.support, true);
    assert.equal(r.parts.openness, true);
  });

  it("scores a vehicle example well (personal experience counts as evidence)", () => {
    const r = analyzeOpinion(VEHICLE);
    assert.ok(r.score >= 65, `score ${r.score}`);
    assert.ok(r.xp >= 12, `xp ${r.xp}`);
    assert.equal(r.parts.support, true);
  });

  it("works with no topic words: religion and a recipe", () => {
    const religion = analyzeOpinion(
      "I believe infant baptism is valid because the early church baptized whole households, as in Acts 16. My own parish has done it for generations and the kids grow up inside the community. Baptists say faith must come first; however, the covenant meaning in Colossians 2 points to the family.",
    );
    const recipe = analyzeOpinion(
      "Cast iron is better than nonstick for searing steak because it holds heat when the cold meat hits the pan. I tried both for a month and the crust from cast iron was noticeably deeper. Nonstick is easier to clean, but it can't take the high heat that a proper sear needs.",
    );
    assert.ok(religion.xp >= 10, `religion xp ${religion.xp}`);
    assert.ok(recipe.xp >= 10, `recipe xp ${recipe.xp}`);
  });

  it("is not fooled by a link alone: the link needs real text around it", () => {
    const linkOnly = analyzeOpinion("I think taxes should go down because https://random.co and https://example.org");
    assert.equal(linkOnly.parts.support, false);
    assert.equal(linkOnly.parts.reason, false);
    assert.ok(linkOnly.xp <= 1);
  });

  it("does not tick other side or openness on bare phrases", () => {
    const r = analyzeOpinion(
      "I think pineapple belongs on pizza because the acidity cuts the grease. On the other hand. However. My mind is open.",
    );
    assert.equal(r.parts.otherSide, false);
    assert.equal(r.parts.openness, false);
    assert.equal(r.parts.reason, true);
  });

  it("caps short text: a short but real opinion cannot score high", () => {
    const r = analyzeOpinion("Pineapple belongs on pizza because the acidity cuts grease.");
    assert.ok(r.score <= 55, `score ${r.score}`);
    assert.ok(r.xp <= 9);
  });

  it("penalizes repeating the same words to pad length", () => {
    const padded = analyzeOpinion(
      "I think cheese is good because cheese is cheese and cheese is cheese. For example cheese cheese cheese cheese cheese cheese. However cheese cheese cheese cheese.",
    );
    assert.ok(padded.xp <= 2, `xp ${padded.xp}`);
  });

  it("keeps XP within 0..25, monotonic in quality, near 0 for tiny quality and 25 at the top", () => {
    let prev = -1;
    for (let q = 0; q <= 100; q++) {
      const xp = xpForQuality(q);
      assert.ok(xp >= 0 && xp <= MAX_OPINION_XP);
      assert.ok(xp >= prev);
      prev = xp;
    }
    assert.equal(xpForQuality(0), 0);
    assert.ok(xpForQuality(10) <= 1);
    assert.equal(xpForQuality(100), 25);
    assert.equal(xpForQuality(-5), 0);
    assert.equal(xpForQuality(900), 25);
    for (const t of ["", "   ", "a", STUFFED, PINEAPPLE, POLITICAL, VEHICLE, NUCLEAR_STRONG, "🙂🙂🙂", "x".repeat(5000)]) {
      const xp = opinionXp(t);
      assert.ok(Number.isInteger(xp) && xp >= 0 && xp <= 25, `xp ${xp}`);
    }
  });

  it("good opinions earn clearly more than thin ones", () => {
    assert.ok(opinionXp(POLITICAL) > opinionXp(PINEAPPLE) - 5);
    assert.ok(opinionXp(PINEAPPLE) > opinionXp("I think pineapple belongs on pizza because it tastes good and sweet"));
    assert.ok(opinionXp(NUCLEAR_STRONG) >= 20);
  });

  it("returns xp on analyzeOpinion that matches opinionXp", () => {
    assert.equal(analyzeOpinion(VEHICLE).xp, opinionXp(VEHICLE));
  });
});


describe("opinionXpFromRows (delete removes XP; cap 25 per topic)", () => {
  const t1 = "topic-1";
  const t2 = "topic-2";

  it("sums visible opinions and treats a missing (hard-deleted) row as 0", () => {
    const afterCreate = [{ topicId: t1, status: "approved", strengthXp: 19 }];
    assert.equal(opinionXpFromRows(afterCreate), 19);
    assert.equal(opinionXpFromRows([]), 0);
  });

  it("removes XP when an opinion is hidden or flagged (soft delete / moderation)", () => {
    const live = [
      { topicId: t1, status: "approved", strengthXp: 19 },
      { topicId: t2, status: "approved", strengthXp: 16 },
    ];
    assert.equal(opinionXpFromRows(live), 35);
    assert.equal(
      opinionXpFromRows([
        { topicId: t1, status: "hidden", strengthXp: 19 },
        { topicId: t2, status: "approved", strengthXp: 16 },
      ]),
      16,
    );
    assert.equal(
      opinionXpFromRows([
        { topicId: t1, status: "flagged", strengthXp: 19 },
        { topicId: t2, status: "approved", strengthXp: 16 },
      ]),
      16,
    );
  });

  it("delete-then-recreate never exceeds 25 XP for that topic", () => {
    const first = [{ topicId: t1, status: "approved", strengthXp: 19 }];
    assert.equal(opinionXpFromRows(first), 19);

    const afterDelete: typeof first = [];
    assert.equal(opinionXpFromRows(afterDelete), 0);

    const recreated = [{ topicId: t1, status: "approved", strengthXp: 22 }];
    const total = opinionXpFromRows(recreated);
    assert.equal(total, 22);
    assert.ok(total <= 25);

    // Even if both rows were somehow still present, the topic is capped at 25.
    const both = [
      { topicId: t1, status: "approved", strengthXp: 19 },
      { topicId: t1, status: "approved", strengthXp: 22 },
    ];
    assert.equal(opinionXpFromRows(both), 22);
    assert.ok(opinionXpFromRows(both) <= 25);
  });

  it("does not let two topics' XP get mixed into one topic's cap", () => {
    const rows = [
      { topicId: t1, status: "approved", strengthXp: 19 },
      { topicId: t2, status: "approved", strengthXp: 16 },
    ];
    assert.equal(opinionXpFromRows(rows), 35);
  });

  it("counts legacy NULL strength_xp as 25, and clamps out-of-range values", () => {
    assert.equal(opinionXpFromRows([{ topicId: t1, strengthXp: null }]), 25);
    assert.equal(opinionXpFromRows([{ topicId: t1, status: "approved" }]), 25);
    assert.equal(opinionXpFromRows([{ topicId: t1, status: "approved", strengthXp: 900 }]), 25);
    assert.equal(opinionXpFromRows([{ topicId: t1, status: "approved", strengthXp: -4 }]), 0);
  });
});

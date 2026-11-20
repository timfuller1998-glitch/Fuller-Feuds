import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeOpinion,
  isBareOpinion,
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

  it("flags a one-word yes as bare, with stance covered", () => {
    const result = analyzeOpinion("yes");
    assert.equal(result.wordCount, 1);
    assert.equal(result.parts.stance, true);
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
      "I think we should keep nuclear because, for example, https://www.ipcc.ch shows low emissions.",
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
      "I support it because it's cleaner. Some argue the waste is dangerous; however, that risk is manageable.",
    );
    assert.equal(result.parts.otherSide, true);
    assert.equal(result.parts.reason, true);
  });

  it("detects openness signals like unless and I could be wrong", () => {
    const result = analyzeOpinion(
      "Yes, I think we should, because the climate math is clear. I could be wrong unless storage gets much cheaper.",
    );
    assert.equal(result.parts.openness, true);
  });

  it("does not treat a lone 'so' at the start as a reason", () => {
    const result = analyzeOpinion("So yes.");
    assert.equal(result.parts.reason, false);
    assert.equal(result.isBare, true);
  });

  it("treats ', so' as a reason signal", () => {
    const result = analyzeOpinion("The footprint is lower, so we should use it.");
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

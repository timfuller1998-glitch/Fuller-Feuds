import { test } from "node:test";
import assert from "node:assert/strict";
import { describeCompass, compassExtent, confidenceRadius, degree } from "./compassDescription";

test("near-centre positions read as centrist with their small leans", () => {
  assert.equal(describeCompass(-10, 5).region, "Centrist, leaning slightly left and slightly authoritarian");
  assert.equal(describeCompass(0, 0).region, "Centrist");
  assert.equal(describeCompass(3, -12).region, "Centrist, leaning slightly libertarian");
  assert.match(describeCompass(-10, 5).summary, /tendency rather than a fixed position/);
});

test("quadrants and single-axis positions", () => {
  assert.equal(describeCompass(-40, -40).region, "Libertarian Left");
  assert.equal(describeCompass(70, 20).region, "Strong Authoritarian Right");
  assert.equal(describeCompass(-20, 16).region, "Moderate Authoritarian Left");
  assert.equal(describeCompass(45, 2).region, "Right, socially centrist");
  assert.equal(describeCompass(-8, -50).region, "Libertarian, slightly left on economics");
  assert.match(describeCompass(70, 20).summary, /free markets/);
  assert.match(describeCompass(-40, -40).summary, /personal freedom/);
});

test("basis line mentions opinions and confidence, and clamps bad input", () => {
  assert.equal(describeCompass(1, 1, { opinions: 1 }).basis, "Based on 1 opinion. An early read that sharpens as more opinions are shared.");
  assert.equal(describeCompass(1, 1, { opinions: 24, confidence: "high" }).basis, "Based on 24 opinions · high confidence.");
  assert.equal(describeCompass(NaN, 500).region, "Strong Authoritarian, economically centrist");
  assert.equal(degree(4), "");
});

test("zoom extent and halo", () => {
  assert.equal(compassExtent(-10, 5), 25);
  assert.equal(compassExtent(-22, 5), 35);
  assert.equal(compassExtent(95, 0), 100);
  assert.equal(confidenceRadius("low"), 8);
  assert.equal(confidenceRadius(null), null);
});

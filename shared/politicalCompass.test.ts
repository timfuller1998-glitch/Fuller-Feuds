import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPASS_QUADRANTS,
  compassQuadrantId,
  compassQuadrantsFor,
  displayQuadrantLabel,
  get1DLeaningColor,
  get2DPoliticalCompassColor,
  parseCompassColorScheme,
} from "./politicalCompass";

test("quadrants use traditional compass colours and liberal/conservative names", () => {
  assert.equal(COMPASS_QUADRANTS.authoritarianLiberal.hue, 0);
  assert.equal(COMPASS_QUADRANTS.authoritarianConservative.hue, 220);
  assert.equal(COMPASS_QUADRANTS.libertarianLiberal.hue, 140);
  assert.equal(COMPASS_QUADRANTS.libertarianConservative.hue, 50);
  assert.equal(COMPASS_QUADRANTS.authoritarianLiberal.label, "Authoritarian Liberal");
  assert.equal(COMPASS_QUADRANTS.authoritarianConservative.label, "Authoritarian Conservative");
  assert.equal(compassQuadrantId(-40, 30), "authoritarianLiberal");
  assert.equal(compassQuadrantId(40, 30), "authoritarianConservative");
  assert.equal(compassQuadrantId(-40, -30), "libertarianLiberal");
  assert.equal(compassQuadrantId(40, -30), "libertarianConservative");
});

test("display labels map stored slugs without renaming API values", () => {
  assert.equal(displayQuadrantLabel("authoritarian-socialist"), "Authoritarian Liberal");
  assert.equal(displayQuadrantLabel("authoritarian-capitalist"), "Authoritarian Conservative");
  assert.equal(displayQuadrantLabel("libertarian-socialist"), "Libertarian Liberal");
  assert.equal(displayQuadrantLabel("libertarian-capitalist"), "Libertarian Conservative");
  assert.equal(displayQuadrantLabel("centrist"), "Centrist");
});

test("point colours follow the quadrant hues, not a swapped pair", () => {
  const authLib = get2DPoliticalCompassColor(-60, 60, { vivid: true });
  const authCon = get2DPoliticalCompassColor(60, 60, { vivid: true });
  // Red is high R, low B; blue is high B, low R.
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [lr, lg, lb] = hex(authLib);
  const [cr, cg, cb] = hex(authCon);
  assert.ok(lr > lb, `authoritarian liberal should read red, got ${authLib}`);
  assert.ok(cb > cr, `authoritarian conservative should read blue, got ${authCon}`);
});

test("american scheme swaps only the authoritarian red/blue pair", () => {
  const standard = compassQuadrantsFor("standard");
  const american = compassQuadrantsFor("american");
  assert.equal(standard.authoritarianLiberal.hue, 0);
  assert.equal(standard.authoritarianConservative.hue, 220);
  assert.equal(american.authoritarianLiberal.hue, 220);
  assert.equal(american.authoritarianConservative.hue, 0);
  assert.equal(american.authoritarianLiberal.hex, standard.authoritarianConservative.hex);
  assert.equal(american.authoritarianConservative.hex, standard.authoritarianLiberal.hex);
  assert.equal(american.libertarianLiberal.hue, standard.libertarianLiberal.hue);
  assert.equal(american.libertarianConservative.hue, standard.libertarianConservative.hue);
  assert.equal(american.authoritarianLiberal.label, "Authoritarian Liberal");
  assert.equal(american.authoritarianConservative.label, "Authoritarian Conservative");
});

test("point and 1D colours follow the selected scheme", () => {
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const authLibAm = get2DPoliticalCompassColor(-60, 60, { vivid: true, scheme: "american" });
  const authConAm = get2DPoliticalCompassColor(60, 60, { vivid: true, scheme: "american" });
  const [lr, , lb] = hex(authLibAm);
  const [cr, , cb] = hex(authConAm);
  assert.ok(lb > lr, `american authoritarian liberal should read blue, got ${authLibAm}`);
  assert.ok(cr > cb, `american authoritarian conservative should read red, got ${authConAm}`);

  const oneDLib = get1DLeaningColor(-40, "american");
  const oneDCon = get1DLeaningColor(40, "american");
  const [olr, , olb] = hex(oneDLib);
  const [ocr, , ocb] = hex(oneDCon);
  assert.ok(olb > olr, `american 1D liberal should read blue, got ${oneDLib}`);
  assert.ok(ocr > ocb, `american 1D conservative should read red, got ${oneDCon}`);
  assert.equal(parseCompassColorScheme("american"), "american");
  assert.equal(parseCompassColorScheme("standard"), "standard");
  assert.equal(parseCompassColorScheme("nope"), "standard");
  assert.equal(parseCompassColorScheme(null), "standard");
});

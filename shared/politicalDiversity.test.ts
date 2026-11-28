import { test } from "node:test";
import assert from "node:assert/strict";
import { politicalDiversity } from "./politicalDiversity";

test("fewer than two scored opinions is not enough", () => {
  assert.deepEqual(politicalDiversity([]), { score: null, enough: false, counted: 0 });
  assert.deepEqual(politicalDiversity([{ economic: 10, authoritarian: 5 }]), { score: null, enough: false, counted: 1 });
  assert.deepEqual(politicalDiversity([{ economic: 10, authoritarian: null }, { economic: -20, authoritarian: undefined }]), { score: null, enough: false, counted: 0 });
});

test("identical leanings score 0, not 'not enough'", () => {
  const r = politicalDiversity([
    { economic: -10, authoritarian: 5 },
    { economic: -10, authoritarian: 5 },
    { economic: -10, authoritarian: 5 },
  ]);
  assert.deepEqual(r, { score: 0, enough: true, counted: 3 });
});

test("a full split on one axis scores 100", () => {
  const r = politicalDiversity([
    { economic: -100, authoritarian: 0 },
    { economic: 100, authoritarian: 0 },
  ]);
  assert.equal(r.score, 100);
  assert.equal(r.enough, true);
});

test("moderate two-opinion spreads are visible, not 0 (the live UBI / assisted-dying cases)", () => {
  // UBI: −30 vs +35 economic, same social
  const ubi = politicalDiversity([
    { economic: -30, authoritarian: -10 },
    { economic: 35, authoritarian: -10 },
  ]);
  assert.equal(ubi.score, 33); // pop stdev of 65-point gap is 32.5
  // Assisted dying: same economic, −25 vs +18 social
  const ad = politicalDiversity([
    { economic: 0, authoritarian: -25 },
    { economic: 0, authoritarian: 18 },
  ]);
  assert.equal(ad.score, 22); // pop stdev of 43-point gap is 21.5
});

test("the old ±20 quadrant rule would have scored these 0; this one does not", () => {
  // Both opinions sit inside the centre, so no quadrant would count them.
  const r = politicalDiversity([
    { economic: -15, authoritarian: 10 },
    { economic: 15, authoritarian: -10 },
  ]);
  assert.ok(r.score != null && r.score > 0);
});

test("bad input is clamped and ignored", () => {
  const r = politicalDiversity([
    { economic: 500, authoritarian: 0 },
    { economic: -500, authoritarian: 0 },
    { economic: NaN, authoritarian: 0 },
  ]);
  assert.equal(r.score, 100);
  assert.equal(r.counted, 2);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  POP_CLOSE_FRAC,
  POP_OPEN_FRAC,
  decideOpenSet,
  isPoppableUmbrella,
  leafZoomCap,
  LEAF_MAX_WIDTH_FRAC,
  type ZoomNode,
} from "./topicsMapZoom.ts";

const n = (id: string, type: string, x: number, y: number, parentId?: string): ZoomNode => ({
  id, type, x, y, parentId,
});

const root = n("root", "root", 0, 0);
const major = n("major:politics", "major", 0, 0, "root");
const sub = n("sub:politics:guns", "sub", 0, 0, "major:politics");
const general = n("sub:politics:general", "sub", 80, 0, "major:politics");
const t1 = n("topic:a", "topic", 200, 0, "sub:politics:guns");
const t2 = n("topic:b", "topic", -200, 0, "sub:politics:guns");
const folded = n("topic:folded", "topic", 200, 40, "sub:politics:general");

const order = [root, major, sub, general, t1, t2, folded];
const kids = new Map<string, ZoomNode[]>([
  ["root", [major]],
  ["major:politics", [sub, general]],
  ["sub:politics:guns", [t1, t2]],
  ["sub:politics:general", [folded]],
]);
const childDist = new Map([
  ["root", 200],
  ["major:politics", 200],
  ["sub:politics:guns", 200],
  ["sub:politics:general", 130],
]);
const kidRead = new Map([
  ["root", 0],
  ["major:politics", 0],
  ["sub:politics:guns", 0.3],
  ["sub:politics:general", 0.3],
]);

function decide(partial: Partial<Parameters<typeof decideOpenSet>[0]> & { k: number; cx?: number; cy?: number; wasOpen?: Set<string> }) {
  return decideOpenSet({
    order,
    childDist,
    kidRead,
    kids,
    cx: 0,
    cy: 0,
    vx: 400,
    vy: 400,
    minDim: 400,
    wasOpen: new Set(),
    forced: null,
    ...partial,
  });
}

describe("topicsMapZoom: topics are terminal", () => {
  it("never treats a topic as a poppable umbrella, even if it were given children", () => {
    assert.equal(isPoppableUmbrella(t1, 0), false);
    assert.equal(isPoppableUmbrella(t1, 3), false);
    assert.equal(isPoppableUmbrella(root, 1), true);
    assert.equal(isPoppableUmbrella(sub, 2), true);
    assert.equal(isPoppableUmbrella(n("empty-sub", "sub", 0, 0, "major"), 0), false);
  });

  it("opens groups down to the topic level, but does not add topics to the open set", () => {
    const open = decide({ k: 2, wasOpen: new Set(["root", "major:politics", "sub:politics:guns"]) });
    assert.ok(open.has("root") && open.has("major:politics") && open.has("sub:politics:guns"));
    assert.ok(!open.has("topic:a") && !open.has("topic:b") && !open.has("topic:folded"));
  });

  it("keeps a sub open when you zoom in on a topic that sits away from the sub's center", () => {
    // Deep zoom: the viewport around the topic no longer contains the sub pill.
    const wasOpen = new Set(["root", "major:politics", "sub:politics:guns"]);
    const open = decide({
      k: 8,
      cx: 200,
      cy: 0,
      vx: 40,
      vy: 80,
      minDim: 400,
      wasOpen,
    });
    assert.ok(open.has("sub:politics:guns"), "sub must stay open — zooming in on a topic is not a deeper level");
    assert.ok(!open.has("topic:a"));
  });

  it("keeps a folded General bubble open when you zoom in on its folded topic", () => {
    const wasOpen = new Set(["root", "major:politics", "sub:politics:general"]);
    const open = decide({
      k: 8,
      cx: 200,
      cy: 40,
      vx: 36,
      vy: 70,
      minDim: 400,
      wasOpen,
    });
    assert.ok(open.has("sub:politics:general"));
    assert.ok(!open.has("topic:folded"));
  });

  it("still merges a sub when you zoom out below the close threshold", () => {
    const wasOpen = new Set(["root", "major:politics", "sub:politics:guns"]);
    // d=200, minDim=400, close frac 0.13 => need k >= 0.26 to stay open. k=0.1 closes.
    const open = decide({ k: 0.1, wasOpen, vx: 2000, vy: 2000 });
    assert.ok(open.has("root"));
    assert.ok(!open.has("sub:politics:guns"), "zooming out should merge the topic level");
  });

  it("uses hysteresis so a k between close and open does not flicker", () => {
    const minDim = 400;
    const d = 200;
    // Midway: 0.13 < d*k/minDim < 0.18  => 0.26 < k < 0.36. Pick k=0.32.
    const k = 0.32;
    assert.ok(d * k / minDim < POP_OPEN_FRAC);
    assert.ok(d * k / minDim > POP_CLOSE_FRAC);
    const closed = decide({ k, minDim, wasOpen: new Set(["root", "major:politics"]) });
    const opened = decide({ k, minDim, wasOpen: new Set(["root", "major:politics", "sub:politics:guns"]) });
    assert.ok(!closed.has("sub:politics:guns"), "stays merged until the open threshold");
    assert.ok(opened.has("sub:politics:guns"), "stays open until the close threshold");
  });

  it("merges a distant sub when nothing in its branch is in view (even if it was open)", () => {
    const open = decide({
      k: 8,
      cx: 4000,
      cy: 4000,
      vx: 40,
      vy: 40,
      wasOpen: new Set(["root", "major:politics", "sub:politics:guns"]),
    });
    assert.ok(!open.has("sub:politics:guns"));
  });
});

describe("topicsMapZoom: max zoom at the topic level", () => {
  it("does not cap zoom while only groups are on screen", () => {
    assert.equal(leafZoomCap([], 390, 844, 10), 10);
  });

  it("caps zoom so a topic pill stays on screen instead of diving into a letter", () => {
    const cap = leafZoomCap([{ w: 200, h: 32 }], 390, 844, 10);
    assert.ok(cap < 10);
    assert.ok(Math.abs(cap - (LEAF_MAX_WIDTH_FRAC * 390) / 200) < 1e-9);
    assert.ok(200 * cap <= 390 + 1e-6);
  });

  it("uses the largest topic when several are showing", () => {
    const cap = leafZoomCap([{ w: 80, h: 32 }, { w: 280, h: 32 }], 390, 844, 10);
    assert.ok(Math.abs(cap - (LEAF_MAX_WIDTH_FRAC * 390) / 280) < 1e-9);
  });
});

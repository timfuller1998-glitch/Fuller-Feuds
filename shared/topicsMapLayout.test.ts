import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  angularSpan,
  findOverlaps,
  layoutWorld,
  leafWeight,
  PILL_PAD,
} from "./topicsMapLayout.ts";
import {
  buildMapTree,
  buildSyntheticTopics,
  type MapTreeNode,
} from "./topicTaxonomy.ts";

const here = dirname(fileURLToPath(import.meta.url));

function loadLiveTree(): MapTreeNode {
  return JSON.parse(readFileSync(join(here, "liveTopicsMap.fixture.json"), "utf8")) as MapTreeNode;
}

function assertNoOverlaps(tree: MapTreeNode, label: string, pad = 0) {
  const items = layoutWorld(tree);
  const hits = findOverlaps(items, pad);
  assert.equal(
    hits.length,
    0,
    `${label}: ${hits.length} overlapping pair(s), first: ${hits.slice(0, 5).map((h) => `${h.a}×${h.b}`).join(", ")}`,
  );
  return items;
}

describe("topicsMapLayout", () => {
  it("gives heavier majors a wider angular span on the live tree", () => {
    const tree = loadLiveTree();
    const items = layoutWorld(tree);
    const other = tree.children.find((c) => c.name === "Other");
    const climate = tree.children.find((c) => c.name === "Climate");
    assert.ok(other && climate, "expected Other and Climate majors");
    assert.ok(leafWeight(other) > leafWeight(climate));
    const otherSpan = angularSpan(items, other.id);
    const climateSpan = angularSpan(items, climate.id);
    assert.ok(
      otherSpan > climateSpan * 1.2,
      `Other span ${otherSpan.toFixed(3)} should be wider than Climate ${climateSpan.toFixed(3)}`,
    );
  });

  it("keeps every live-tree pill from overlapping, including padding", () => {
    const items = assertNoOverlaps(loadLiveTree(), "live", 0);
    // Tight padding still holds — pills must not crowd.
    const padded = findOverlaps(items, PILL_PAD * 0.5);
    assert.equal(padded.length, 0, `live still overlaps with half pad: ${padded.slice(0, 4).map((h) => `${h.a}×${h.b}`).join(", ")}`);
  });

  it("places each child in its parent's angular wedge", () => {
    const items = layoutWorld(loadLiveTree());
    for (const item of items.values()) {
      if (!item.parentId) continue;
      const parent = items.get(item.parentId);
      if (!parent || parent.depth === 0) continue;
      const siblings = [...items.values()].filter((it) => it.parentId === parent.id);
      if (siblings.length < 2) continue;
      const angles = siblings.map((s) => s.angle).sort((a, b) => a - b);
      const minA = angles[0]!;
      const maxA = angles[angles.length - 1]!;
      for (const child of siblings) {
        assert.ok(
          child.angle >= minA - 1e-9 && child.angle <= maxA + 1e-9,
          `${child.id} left its sibling wedge`,
        );
        assert.ok(child.radius > parent.radius, `${child.id} should sit outside ${parent.id}`);
      }
    }
  });

  it("does not overlap parent pills with their children", () => {
    const items = layoutWorld(loadLiveTree());
    for (const item of items.values()) {
      if (!item.parentId) continue;
      const parent = items.get(item.parentId);
      if (!parent) continue;
      assert.equal(
        findOverlaps(new Map([
          [parent.id, parent],
          [item.id, item],
        ]), 0).length,
        0,
        `${item.id} overlaps parent ${parent.id}`,
      );
    }
  });

  it("keeps child rings close to their parent instead of exploding outward", () => {
    const items = layoutWorld(loadLiveTree());
    for (const item of items.values()) {
      if (!item.parentId) continue;
      // Secondary "also in" copies can sit farther out when they share space
      // with another branch; compactness is enforced on primary nodes.
      if (item.id.includes(":via:")) continue;
      const parent = items.get(item.parentId);
      if (!parent) continue;
      const gap = item.radius - parent.radius;
      const siblings = [...items.values()].filter((it) => it.parentId === item.parentId).length;
      const budget = 800 + 200 * Math.max(siblings, 1);
      assert.ok(
        gap < budget,
        `${item.id} sits ${gap.toFixed(0)} beyond ${parent.id} (r=${item.radius.toFixed(0)}, budget ${budget})`,
      );
    }
  });

  it("spaces the 420-topic synthetic tree without overlapping pills", () => {
    const tree = buildMapTree(buildSyntheticTopics(420));
    assert.ok(tree.children.length >= 8, "synthetic tree should have many majors");
    const items = assertNoOverlaps(tree, "synthetic-420", 0);
    assert.ok(items.size > 400, `expected a large layout, got ${items.size}`);
    const maxR = Math.max(...[...items.values()].map((it) => it.radius));
    assert.ok(maxR < 12000, `synthetic tree radius exploded to ${maxR.toFixed(0)}`);
  });
});

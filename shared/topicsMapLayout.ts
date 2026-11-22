import { type MapTreeNode, ROOT_ID } from "./topicTaxonomy";

export const PILL_PAD = 28;
export const MIN_RING_GAP = 100;

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  depth: number;
  parentId?: string;
  angle: number;
  radius: number;
  w: number;
  h: number;
  node: MapTreeNode;
  /** Cluster layout only: radius of the pill's own bounding circle. */
  self?: number;
  /** Cluster layout only: distance from this pill to its children. */
  ring?: number;
  /** Cluster layout only: radius of the circle holding this pill and all descendants. */
  cluster?: number;
}

export interface LabelPlan {
  hidden: Set<string>;
  abbrev: Set<string>;
}

function clampFinite(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

/** Label font size per pill type (px at zoom 1). Keep in sync with the map's CSS fonts. */
export function pillFontSize(type: MapTreeNode["type"]): number {
  if (type === "root") return 15;
  if (type === "major") return 13;
  if (type === "sub") return 12;
  return 12.5;
}

/**
 * Estimated axis-aligned pill size, slightly generous so text stays inside.
 * Fonts match the site: Anton for the hub, Playfair Display (bold) for
 * categories, Source Serif 4 for topics.
 */
export function measurePill(name: string, type: MapTreeNode["type"]): { w: number; h: number } {
  const fs = pillFontSize(type);
  if (type === "topic") {
    const w = Math.min(280, Math.max(80, name.length * fs * 0.54 + 30));
    return { w, h: 30 };
  }
  if (type === "root") {
    return { w: Math.max(150, name.length * fs * 0.56 + 44), h: 42 };
  }
  const w = Math.min(240, Math.max(84, name.length * fs * 0.6 + 36));
  return { w, h: type === "major" ? 36 : 30 };
}

/** Visual box including the count under a category or the "also in" line on a topic. */
export function measureLayoutBox(node: MapTreeNode): { w: number; h: number } {
  const { w, h } = measurePill(node.name, node.type);
  let extra = 0;
  if (node.type !== "topic" && node.type !== "root" && node.count > 0) extra += 24;
  if (node.type === "topic" && node.alsoIn && node.alsoIn.length > 0) extra += 6;
  return { w, h: h + extra };
}

export function shortLabel(name: string, type: MapTreeNode["type"]): string {
  const cap = type === "topic" ? 22 : 16;
  if (name.length <= cap) return name;
  const cut = name.split(/[:&–—-]/)[0]!.trim();
  if (cut.length >= 6 && cut.length <= cap) return cut;
  return `${name.slice(0, cap - 1)}…`;
}

export function leafWeight(node: MapTreeNode): number {
  if (!node.children.length) return 1;
  const leaves = node.children.reduce((sum, child) => sum + leafWeight(child), 0);
  // Direct children need a minimum share so a wide fan is not forced onto a distant ring.
  const childNeed = node.children.length * 1.8;
  return Math.max(leaves, childNeed);
}

function halfDiag(w: number, h: number) {
  return Math.hypot(w / 2, h / 2);
}

/**
 * Smallest common radius that keeps two axis-aligned pills on the same ring
 * from overlapping, including `pad`.
 */
export function radiusToSeparate(
  aAngle: number,
  aw: number,
  ah: number,
  bAngle: number,
  bw: number,
  bh: number,
  pad: number,
): number {
  const ux = Math.abs(Math.cos(bAngle) - Math.cos(aAngle));
  const uy = Math.abs(Math.sin(bAngle) - Math.sin(aAngle));
  const wx = (aw + bw) / 2 + pad;
  const hy = (ah + bh) / 2 + pad;
  const rBox = Math.min(
    ux > 1e-6 ? wx / ux : Number.POSITIVE_INFINITY,
    uy > 1e-6 ? hy / uy : Number.POSITIVE_INFINITY,
  );
  let dθ = Math.abs(bAngle - aAngle);
  dθ = Math.min(dθ, Math.PI * 2 - dθ);
  const minDist = halfDiag(aw, ah) + halfDiag(bw, bh) + pad;
  const chord = 2 * Math.sin(dθ / 2);
  const rChord = chord > 1e-6 ? minDist / chord : Number.POSITIVE_INFINITY;
  const r = Math.max(
    Number.isFinite(rBox) ? rBox : 0,
    Number.isFinite(rChord) ? rChord : 0,
  );
  return clampFinite(r, 0);
}

export function boxesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad: number,
): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw + pad * 2 && Math.abs(ay - by) * 2 < ah + bh + pad * 2;
}

interface Slot {
  id: string;
  node: MapTreeNode;
  depth: number;
  parentId?: string;
  angle: number;
  start: number;
  end: number;
  w: number;
  h: number;
}

function collectSlots(
  node: MapTreeNode,
  start: number,
  end: number,
  depth: number,
  parentId: string | undefined,
  out: Slot[],
) {
  const mid = (start + end) / 2;
  const { w, h } = measureLayoutBox(node);
  out.push({
    id: node.id,
    node,
    depth,
    parentId,
    angle: depth === 0 ? 0 : mid,
    start,
    end,
    w,
    h,
  });
  const kids = node.children;
  if (!kids.length) return;
  const weights = kids.map(leafWeight);
  const total = weights.reduce((sum, n) => sum + n, 0) || kids.length;
  const span = end - start;
  const inset = kids.length > 1 ? Math.min(0.1, 0.05 + 0.006 * kids.length) * span : 0;
  const usable = span - inset;
  let a = start + inset / 2;
  kids.forEach((kid, i) => {
    const slice = usable * (weights[i]! / total);
    collectSlots(kid, a, a + slice, depth + 1, node.id, out);
    a += slice;
  });
}

function ringMinRadius(ring: Slot[], pad: number): number {
  if (ring.length < 2) return 0;
  let r = 0;
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      r = Math.max(
        r,
        radiusToSeparate(ring[i]!.angle, ring[i]!.w, ring[i]!.h, ring[j]!.angle, ring[j]!.w, ring[j]!.h, pad),
      );
    }
  }
  return r;
}

function placeItems(slots: Slot[], radiusOf: Map<string, number>): Map<string, LayoutItem> {
  const items = new Map<string, LayoutItem>();
  slots.forEach((s) => {
    const r = radiusOf.get(s.id) || 0;
    items.set(s.id, {
      id: s.id,
      x: s.depth === 0 ? 0 : Math.cos(s.angle) * r,
      y: s.depth === 0 ? 0 : Math.sin(s.angle) * r,
      depth: s.depth,
      parentId: s.parentId,
      angle: s.angle,
      radius: r,
      w: s.w,
      h: s.h,
      node: s.node,
    });
  });
  return items;
}

function groupSpan(children: Slot[]): { start: number; span: number } {
  const starts = children.map((s) => s.start);
  const ends = children.map((s) => s.end);
  let start = Math.min(...starts);
  let end = Math.max(...ends);
  // If the wedge crosses the branch cut, use a wrapped span.
  const angles = children.map((s) => s.angle);
  const raw = end - start;
  if (raw > Math.PI * 1.8) {
    const shifted = children.map((s) => {
      const a = s.angle < 0 ? s.angle + Math.PI * 2 : s.angle;
      const lo = s.start < 0 ? s.start + Math.PI * 2 : s.start;
      const hi = s.end < 0 ? s.end + Math.PI * 2 : s.end;
      return { a, lo, hi };
    });
    start = Math.min(...shifted.map((s) => s.lo));
    end = Math.max(...shifted.map((s) => s.hi));
  }
  return { start, span: Math.max(end - start, 0.12) };
}

function assignRowAngles(row: Slot[], start: number, span: number) {
  if (row.length === 1) {
    row[0]!.angle = start + span / 2;
    return;
  }
  row.forEach((s, k) => {
    const t = (k + 0.5) / row.length;
    s.angle = start + t * span;
  });
}

/** How many of `remaining` fit on one arc of radius r inside the wedge. */
function rowCapacity(remaining: Slot[], start: number, span: number, r: number, pad: number): number {
  if (remaining.length <= 1) return remaining.length || 1;
  let take = remaining.length;
  while (take > 1) {
    const row = remaining.slice(0, take);
    assignRowAngles(row, start, span);
    if (ringMinRadius(row, pad) <= r * 1.01) return take;
    take -= 1;
  }
  return 1;
}

/** Place a parent's children on one or more compact arcs instead of one huge ring. */
function packGroup(children: Slot[], parentR: number, parent: Slot | undefined, pad: number, radiusOf: Map<string, number>) {
  if (!children.length) return;
  const parentDiag = parent ? halfDiag(parent.w, parent.h) : 20;
  const childDiag = children.reduce((m, s) => Math.max(m, halfDiag(s.w, s.h)), 0);
  const minR = parentR + Math.max(MIN_RING_GAP, parentDiag + childDiag + pad);

  if (children.length === 1) {
    radiusOf.set(children[0]!.id, minR);
    return;
  }

  const around = ringMinRadius(children, pad);
  if (around <= minR * 1.4) {
    const r = Math.max(minR, around);
    children.forEach((s) => radiusOf.set(s.id, r));
    return;
  }

  const parentWedge = parent
    ? { start: parent.start, span: Math.max(parent.end - parent.start, 0.12) }
    : groupSpan(children);
  const { start, span } = parentWedge;
  const rowGap = Math.max(64, children.reduce((m, s) => Math.max(m, s.h), 28) + pad);

  const sorted = [...children].sort((a, b) => a.angle - b.angle);
  let idx = 0;
  let ring = 0;
  while (idx < sorted.length && ring < 80) {
    let r = minR + ring * rowGap;
    const remaining = sorted.slice(idx);
    let take = rowCapacity(remaining, start, span, r, pad);
    // If the chosen row still cannot sit on this compact arc, drop items
    // rather than inflating the radius to a huge shared ring.
    while (take > 1 && ringMinRadius(remaining.slice(0, take), pad) > r * 1.02) {
      take -= 1;
    }
    const row = remaining.slice(0, take);
    assignRowAngles(row, start, span);
    row.forEach((s) => radiusOf.set(s.id, r));
    idx += take;
    ring++;
  }
}

function assignRadii(slots: Slot[], pad: number): Map<string, number> {
  const maxDepth = slots.reduce((m, s) => Math.max(m, s.depth), 0);
  const byId = new Map(slots.map((s) => [s.id, s]));
  const radiusOf = new Map<string, number>();
  slots.filter((s) => s.depth === 0).forEach((s) => radiusOf.set(s.id, 0));
  for (let d = 1; d <= maxDepth; d++) {
    const ring = slots.filter((s) => s.depth === d);
    const groups = new Map<string, Slot[]>();
    ring.forEach((s) => {
      const key = s.parentId || "";
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    });
    groups.forEach((children, parentId) => {
      packGroup(children, radiusOf.get(parentId) || 0, byId.get(parentId), pad, radiusOf);
    });
  }
  return radiusOf;
}

/** Persistent world layout: always rooted at the tree origin, never re-rooted. */
export function layoutWorld(tree: MapTreeNode, pad = PILL_PAD): Map<string, LayoutItem> {
  const slots: Slot[] = [];
  collectSlots(tree, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 0, undefined, slots);
  let radiusOf = assignRadii(slots, pad);

  const clampAngle = (s: Slot, angle: number) => {
    const lo = Math.min(s.start, s.end) + 0.02;
    const hi = Math.max(s.start, s.end) - 0.02;
    return hi > lo ? Math.max(lo, Math.min(hi, angle)) : (s.start + s.end) / 2;
  };

  for (let iter = 0; iter < 60; iter++) {
    const items = placeItems(slots, radiusOf);
    const list = slots.filter((s) => s.depth > 0);
    const bump = new Map<string, number>();
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      const ai = items.get(a.id)!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const bi = items.get(b.id)!;
        if (!boxesOverlap(ai.x, ai.y, a.w, a.h, bi.x, bi.y, b.w, b.h, pad)) continue;
        let dθ = b.angle - a.angle;
        while (dθ > Math.PI) dθ -= Math.PI * 2;
        while (dθ < -Math.PI) dθ += Math.PI * 2;
        const step = 0.03 * (dθ >= 0 ? 1 : -1);
        const aNext = clampAngle(a, a.angle - step);
        const bNext = clampAngle(b, b.angle + step);
        if (aNext !== a.angle || bNext !== b.angle) {
          a.angle = aNext;
          b.angle = bNext;
          moved = true;
        }
        const ox = (a.w + b.w) / 2 + pad - Math.abs(ai.x - bi.x);
        const oy = (a.h + b.h) / 2 + pad - Math.abs(ai.y - bi.y);
        const need = Math.max(ox, oy, 8);
        const ra = radiusOf.get(a.id) || 0;
        const rb = radiusOf.get(b.id) || 0;
        const outer = ra === rb ? (a.depth >= b.depth ? a : b) : ra > rb ? a : b;
        bump.set(outer.id, Math.max(bump.get(outer.id) || 0, need + 4));
      }
    }
    bump.forEach((dR, id) => {
      radiusOf.set(id, (radiusOf.get(id) || 0) + dR);
      moved = true;
    });
    if (!moved) break;
  }

  return placeItems(slots, radiusOf);
}

/** Gap between neighboring cluster circles; leaves room for the gentle float. */
export const CLUSTER_PAD = 56;
const CLUSTER_GAP = 0.9; // radians left open toward the parent

function selfRadius(node: MapTreeNode) {
  const { w, h } = measurePill(node.name, node.type);
  const below = node.type !== "topic" && node.type !== "root" && node.count > 0 ? 18 : node.type === "topic" && node.alsoIn?.length ? 8 : 0;
  return Math.hypot(w / 2, h / 2 + below);
}

/**
 * Nested-cluster layout for semantic zoom. Each pill's children sit on a
 * compact ring around it (fanned away from its own parent), and every subtree
 * fits inside a bounding circle. Sibling circles get disjoint angular sectors,
 * so no two pills — or two whole subtrees — can overlap at any depth.
 */
export function layoutClusters(tree: MapTreeNode, pad = CLUSTER_PAD): Map<string, LayoutItem> {
  const selfR = new Map<string, number>();
  const ringR = new Map<string, number>();
  const clusterR = new Map<string, number>();

  const sectorSum = (cs: number[], R: number) =>
    cs.reduce((sum, c) => sum + 2 * Math.asin(Math.min(1, (c + pad / 2) / R)), 0);

  const measure = (node: MapTreeNode): number => {
    const self = selfRadius(node);
    selfR.set(node.id, self);
    if (!node.children.length) {
      clusterR.set(node.id, self);
      return self;
    }
    const cs = node.children.map(measure);
    const maxC = Math.max(...cs);
    const arc = node.type === "root" ? Math.PI * 2 : Math.PI * 2 - CLUSTER_GAP;
    let lo = self + maxC + pad;
    if (sectorSum(cs, lo) > arc) {
      let hi = lo * 2;
      while (sectorSum(cs, hi) > arc) hi *= 2;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (sectorSum(cs, mid) > arc) lo = mid;
        else hi = mid;
      }
      lo = hi;
    }
    ringR.set(node.id, lo);
    const c = lo + maxC;
    clusterR.set(node.id, c);
    return c;
  };
  measure(tree);

  const out = new Map<string, LayoutItem>();
  const place = (node: MapTreeNode, x: number, y: number, depth: number, angle: number, parentId?: string) => {
    const box = measureLayoutBox(node);
    out.set(node.id, {
      id: node.id,
      x,
      y,
      depth,
      parentId,
      angle,
      radius: Math.hypot(x, y),
      w: box.w,
      h: box.h,
      node,
      self: selfR.get(node.id),
      ring: ringR.get(node.id),
      cluster: clusterR.get(node.id),
    });
    if (!node.children.length) return;
    const R = ringR.get(node.id)!;
    const widths = node.children.map((c) => 2 * Math.asin(Math.min(1, (clusterR.get(c.id)! + pad / 2) / R)));
    const total = widths.reduce((a, b) => a + b, 0);
    const isRoot = !parentId;
    // Root fills the full circle; others fan out centered on the outward direction.
    const stretch = isRoot ? (Math.PI * 2) / total : 1;
    let a = isRoot ? -Math.PI / 2 - (widths[0]! * stretch) / 2 : angle - total / 2;
    node.children.forEach((child, i) => {
      const wdt = widths[i]! * stretch;
      const ca = a + wdt / 2;
      a += wdt;
      place(child, x + Math.cos(ca) * R, y + Math.sin(ca) * R, depth + 1, ca, node.id);
    });
  };
  place(tree, 0, 0, 0, -Math.PI / 2);
  return out;
}

export interface Overlap {
  a: string;
  b: string;
}

export function findOverlaps(items: Map<string, LayoutItem>, pad = 0): Overlap[] {
  const list = [...items.values()];
  const out: Overlap[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      if (boxesOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h, pad)) {
        out.push({ a: a.id, b: b.id });
      }
    }
  }
  return out;
}

export function angularSpan(items: Map<string, LayoutItem>, nodeId: string): number {
  const node = items.get(nodeId);
  if (!node || !node.parentId) return 0;
  const siblings = [...items.values()]
    .filter((it) => it.parentId === node.parentId)
    .sort((a, b) => a.angle - b.angle);
  if (siblings.length < 2) return Math.PI * 2;
  const i = siblings.findIndex((s) => s.id === nodeId);
  if (i < 0) return 0;
  const prev = siblings[(i - 1 + siblings.length) % siblings.length]!;
  const next = siblings[(i + 1) % siblings.length]!;
  const mid = (a: number, b: number) => {
    let d = b - a;
    while (d < 0) d += Math.PI * 2;
    while (d >= Math.PI * 2) d -= Math.PI * 2;
    return d;
  };
  // Span from midpoints of neighboring gaps, which approximates the allocated wedge.
  return mid(prev.angle, node.angle) + mid(node.angle, next.angle);
}

/**
 * Decide which labels to hide or abbreviate at a given camera scale.
 * Call this only when lod, focus, or the tree changes — never per frame.
 */
export function planLabels(
  items: Map<string, LayoutItem>,
  opts: {
    k: number;
    focusId: string;
    highlightId?: string | null;
    pathIds: Set<string>;
  },
): LabelPlan {
  const gap = 10 / Math.max(opts.k, 0.05);
  const focus = opts.focusId;
  const highlight = opts.highlightId;

  type Cand = { item: LayoutItem; pri: number; keep: boolean };
  const cands: Cand[] = [];
  items.forEach((item) => {
    const isFocus = item.id === focus;
    const isHighlight = Boolean(highlight && (item.id === highlight || item.node.topicId === highlight));
    const forced = isFocus || isHighlight || item.parentId === focus;
    const onPath = opts.pathIds.has(item.id);
    let pri = 20 - item.depth * 8;
    if (isFocus) pri += 100;
    if (isHighlight) pri += 90;
    if (forced) pri += 40;
    if (onPath) pri += 20;
    cands.push({ item, pri, keep: forced || isFocus || onPath });
  });
  cands.sort((a, b) => b.pri - a.pri || a.item.id.localeCompare(b.item.id));

  const kept: Cand[] = [];
  const hidden = new Set<string>();
  const abbrev = new Set<string>();
  for (const c of cands) {
    const hit = kept.some((o) =>
      boxesOverlap(c.item.x, c.item.y, c.item.w, c.item.h, o.item.x, o.item.y, o.item.w, o.item.h, gap),
    );
    if (!hit) {
      kept.push(c);
      continue;
    }
    if (c.keep) {
      kept.push(c);
      if (c.item.node.name.length > 16) abbrev.add(c.item.id);
      continue;
    }
    hidden.add(c.item.id);
  }
  return { hidden, abbrev };
}

export { ROOT_ID };

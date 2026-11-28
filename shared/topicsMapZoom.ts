/**
 * Pop / merge rules for the Explore Topics map.
 *
 * Groups (root, major, sub) are umbrellas: they open when you zoom in far
 * enough that their children would be readable, and merge back when you zoom
 * out. Topics are the terminal level — they are never umbrellas. Zooming in
 * past the topic pills just scales the camera up to max zoom; it must not
 * re-layout, try to expand a topic, or flicker between levels.
 *
 * Hysteresis (open vs close fractions, readable slack, and a wider "near"
 * margin once open) stops the set from oscillating at a threshold. A parent
 * also stays "near" while any of its children are in view, so zooming in on a
 * topic that sits out from its sub (or a folded General) does not collapse
 * the branch.
 */

export const POP_OPEN_FRAC = 0.18;
/** Merge back below this share of the short screen side (hysteresis vs POP_OPEN_FRAC). */
export const POP_CLOSE_FRAC = 0.13;
/** Children only pop once they'd render at least this big (so topic text is readable). */
export const READ_SCALE = 0.62;
/** "Near the view" slack when opening vs. once already open. */
export const NEAR_OPEN_MARGIN = 1.05;
export const NEAR_CLOSE_MARGIN = 1.5;
/** Already-open umbrellas keep this fraction of the open readable threshold. */
export const READABLE_CLOSE_FACTOR = 0.85;

export interface ZoomNode {
  id: string;
  parentId?: string;
  x: number;
  y: number;
  /** Map node type; topics are never treated as umbrellas. */
  type?: string;
  node?: { type?: string };
}

export function zoomNodeType(n: ZoomNode): string {
  return n.type || n.node?.type || "";
}

/** Topics (and anything with no children, other than the root) cannot pop open. */
export function isPoppableUmbrella(node: ZoomNode, childCount: number): boolean {
  if (zoomNodeType(node) === "topic") return false;
  if (!node.parentId) return true;
  return childCount > 0;
}

export interface DecideOpenArgs {
  order: ZoomNode[];
  childDist: Map<string, number>;
  kidRead: Map<string, number>;
  kids: Map<string, ZoomNode[]>;
  k: number;
  cx: number;
  cy: number;
  /** Viewport half-size in layout units (cssWidth / 2 / k). */
  vx: number;
  vy: number;
  minDim: number;
  wasOpen: Set<string>;
  forced: Set<string> | null;
}

/**
 * Which umbrellas should be open at this camera. Does not mutate `wasOpen`.
 * Callers replace their open set with the result each frame.
 */
export function decideOpenSet(args: DecideOpenArgs): Set<string> {
  const { order, childDist, kidRead, kids, k, cx, cy, vx, vy, minDim, wasOpen, forced } = args;
  const open = new Set<string>();

  const inView = (x: number, y: number, margin: number) =>
    Math.abs(x - cx) < vx * margin && Math.abs(y - cy) < vy * margin;

  const isNear = (it: ZoomNode, was: boolean) => {
    const margin = was ? NEAR_CLOSE_MARGIN : NEAR_OPEN_MARGIN;
    if (inView(it.x, it.y, margin)) return true;
    // Deep zoom shrinks the viewport in layout units, so the umbrella pill
    // (a major or sub) often leaves the frame while you are still looking at
    // one of its topics. Walk descendants (not just immediate children) so
    // the branch stays open; topics never pop, they just keep their parents.
    const stack = [...(kids.get(it.id) || [])];
    while (stack.length) {
      const c = stack.pop()!;
      if (inView(c.x, c.y, margin)) return true;
      const more = kids.get(c.id);
      if (more) stack.push(...more);
    }
    return false;
  };

  for (const it of order) {
    const childList = kids.get(it.id) || [];
    if (!isPoppableUmbrella(it, childList.length)) continue;
    if (!it.parentId) {
      open.add(it.id);
      continue;
    }
    if (!open.has(it.parentId)) continue;
    const d = childDist.get(it.id);
    if (d == null) continue;

    const was = wasOpen.has(it.id);
    const spread = d * k >= minDim * (was ? POP_CLOSE_FRAC : POP_OPEN_FRAC);
    const readable = k >= (kidRead.get(it.id) || 0) * (was ? READABLE_CLOSE_FACTOR : 1);
    const want = (forced != null && forced.has(it.id)) || (spread && readable && isNear(it, was));
    if (want) open.add(it.id);
  }
  return open;
}

/** At topic level, a pill may fill at most this much of the viewport width. */
export const LEAF_MAX_WIDTH_FRAC = 0.96;
/** And at most this much of the viewport height (pills are short, so width usually binds). */
export const LEAF_MAX_HEIGHT_FRAC = 0.55;

/**
 * Max camera k once topic pills are on screen. Past this, further zoom would
 * dive into a single letter and look like another level opening. Returns
 * `hardMax` when no topics are showing (still zooming through groups).
 */
export function leafZoomCap(
  topics: { w: number; h: number }[],
  viewportWidth: number,
  viewportHeight: number,
  hardMax: number,
): number {
  if (!topics.length) return hardMax;
  let cap = hardMax;
  for (const t of topics) {
    if (t.w > 0) cap = Math.min(cap, (LEAF_MAX_WIDTH_FRAC * Math.max(viewportWidth, 1)) / t.w);
    if (t.h > 0) cap = Math.min(cap, (LEAF_MAX_HEIGHT_FRAC * Math.max(viewportHeight, 1)) / t.h);
  }
  return Math.max(cap, 0.2);
}

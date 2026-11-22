import { useEffect, useMemo, useRef } from "react";
import {
  type MapTreeNode,
  pathToNode,
  ROOT_ID,
} from "@shared/topicTaxonomy";
import {
  CLUSTER_PAD,
  layoutClusters,
  measurePill,
  pillFontSize,
  shortLabel,
  type LayoutItem,
} from "@shared/topicsMapLayout";

export const MAP_VIEW_KEY = "ff-topics-map-view";

export interface MapViewState {
  focusId: string;
  x: number;
  y: number;
  k: number;
}

interface Camera {
  x: number;
  y: number;
  k: number;
}

interface TopicsMapProps {
  tree: MapTreeNode;
  focusId: string;
  highlightId?: string | null;
  onFocus: (id: string) => void;
  onOpenTopic: (topicId: string) => void;
  className?: string;
}

const MIN_K = 0.02;
const MAX_K = 10;
const TAP_PX = 14;
const FRAME_PAD = 56;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lodFromK(k: number, baseK: number): 0 | 1 | 2 | 3 {
  const r = k / Math.max(baseK, 0.2);
  if (r < 1.35) return 0;
  if (r < 2.4) return 1;
  if (r < 3.8) return 2;
  return 3;
}

/** An umbrella pops open once its children would sit this far out, as a share of the short screen side. */
const POP_OPEN_FRAC = 0.18;
/** ...and merges back below this (hysteresis so it doesn't flicker at the edge). */
const POP_CLOSE_FRAC = 0.13;
/** Children only pop once they'd render at least this big (so topic text is readable). */
const READ_SCALE = 0.62;
/** Zoomed out, pills keep about this on-screen size where they have room (semantic zoom). */
const LABEL_FLOOR = 0.9;
const POP_MS = 460;
const MERGE_MS = 340;
/** Gentle float: max on-screen drift in px, capped in layout units so pills never meet (pad is 28). */
const DRIFT_PX = 3.5;
const DRIFT_MAX_LAYOUT = CLUSTER_PAD * 0.38;

/** Largest boost a merged umbrella can take and still stay inside its own cluster circle. */
function closedCap(it: LayoutItem) {
  const self = it.self || 1;
  return Math.max(1, ((it.cluster || self) - DRIFT_MAX_LAYOUT) / self);
}
/** Largest boost an open umbrella can take without touching its popped children. */
function openCap(it: LayoutItem, childReach: number) {
  const self = it.self || 1;
  if (!it.ring) return 1;
  return Math.max(1, (it.ring - childReach - CLUSTER_PAD / 2 - DRIFT_MAX_LAYOUT) / self);
}

function easeOutBack(t: number) {
  const c1 = 1.55;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function hash01(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function readStoredView(): MapViewState | null {
  try {
    const raw = sessionStorage.getItem(MAP_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as MapViewState;
    if (!v || typeof v.focusId !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

export function storeMapView(view: MapViewState) {
  try {
    sessionStorage.setItem(MAP_VIEW_KEY, JSON.stringify(view));
  } catch {
    // ignore quota / private mode
  }
}

export function peekStoredMapView(): MapViewState | null {
  return readStoredView();
}

function frameNode(
  layout: Map<string, LayoutItem>,
  nodeId: string,
  viewport: HTMLDivElement | null,
): Camera {
  if (!viewport) return { x: 0, y: 0, k: 1 };
  const focus = layout.get(nodeId) || layout.get(ROOT_ID);
  if (!focus) return { x: 0, y: 0, k: 1 };

  const members: LayoutItem[] = [focus];
  layout.forEach((it) => {
    if (it.parentId === focus.id) members.push(it);
  });
  // Leaves have no children — include the parent so a connecting branch stays in view.
  if (members.length === 1 && focus.parentId) {
    const parent = layout.get(focus.parentId);
    if (parent) members.push(parent);
  }

  // Frame the box around the tapped pill and its children so the popped
  // branch uses the whole screen and never spills past a narrow phone edge.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxHalfW = 40;
  members.forEach((it) => {
    minX = Math.min(minX, it.x);
    maxX = Math.max(maxX, it.x);
    minY = Math.min(minY, it.y);
    maxY = Math.max(maxY, it.y);
    maxHalfW = Math.max(maxHalfW, it.w / 2);
  });
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  // Pill sizes are roughly constant on screen when zoomed out, so pad in screen px.
  const padX = FRAME_PAD / 2 + maxHalfW * READ_SCALE;
  const padY = FRAME_PAD / 2 + 26;
  let fitK = Math.min(
    Math.max(vw - padX * 2, 80) / Math.max(maxX - minX, 1),
    Math.max(vh - padY * 2, 80) / Math.max(maxY - minY, 1),
  );
  // Topic leaves can't be boosted, so make sure they're readable when they pop.
  // On a small screen, zoom in a little past "fit everything" if that's what it
  // takes for the popped children to be readable (edges can be panned to).
  const kids = members.filter((m) => m.parentId === focus.id);
  if (kids.length) {
    const kidCap = Math.min(...kids.map(closedCap));
    const readK = READ_SCALE / kidCap;
    if (readK > fitK) fitK = Math.min(readK, fitK * 1.5);
  }
  const leafKids = members.some((m) => m.parentId === focus.id && m.node.type === "topic");
  const k = clamp(Math.min(fitK, leafKids || focus.node.type === "topic" ? 1.1 : 2), MIN_K, MAX_K);
  const kk = leafKids ? Math.max(k, READ_SCALE) : k;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, k: kk };
}

export default function TopicsMap({
  tree,
  focusId,
  highlightId,
  onFocus,
  onOpenTopic,
  className = "",
}: TopicsMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const cam = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const baseKRef = useRef(1);
  const layoutRef = useRef<Map<string, LayoutItem>>(new Map());
  const nodeEls = useRef<Map<string, SVGGElement>>(new Map());
  const linkEls = useRef<Map<string, SVGPathElement>>(new Map());
  const linkDir = useRef<Map<string, string>>(new Map());
  const loopRaf = useRef(0);
  const lastTick = useRef(0);
  const presence = useRef<Map<string, number>>(new Map());
  const boostRef = useRef<Map<string, number>>(new Map());
  const openSet = useRef<Set<string>>(new Set());
  const shownRef = useRef<Map<string, string>>(new Map());
  const focusFrameK = useRef(1);
  const forcedActive = useRef(true);
  const userMovedRef = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; k: number; lx: number; ly: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pannedRef = useRef(false);
  const animRaf = useRef(0);
  const readyRef = useRef(false);
  const restoredRef = useRef(false);
  const onFocusRef = useRef(onFocus);
  const onOpenTopicRef = useRef(onOpenTopic);
  const focusIdRef = useRef(focusId);
  onFocusRef.current = onFocus;
  onOpenTopicRef.current = onOpenTopic;
  focusIdRef.current = focusId;
  const reduceMotion = useRef(false);
  const pathIds = useMemo(() => {
    const highlight = highlightId || focusId;
    return new Set(pathToNode(tree, highlight).map((n) => n.id));
  }, [tree, focusId, highlightId]);
  const highlightIdRef = useRef(highlightId);
  const pathIdsRef = useRef(pathIds);
  highlightIdRef.current = highlightId;
  pathIdsRef.current = pathIds;

  const items = useMemo(() => layoutClusters(tree), [tree]);
  layoutRef.current = items;

  // Per-node data for semantic zoom + float, computed once per tree.
  const motion = useMemo(() => {
    const order = [...items.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
    const kids = new Map<string, LayoutItem[]>();
    items.forEach((it) => {
      if (!it.parentId) return;
      const list = kids.get(it.parentId) || [];
      list.push(it);
      kids.set(it.parentId, list);
    });
    const childDist = new Map<string, number>();
    kids.forEach((list, id) => {
      const p = items.get(id);
      if (!p || !list.length) return;
      let sum = 0;
      list.forEach((c) => (sum += Math.hypot(c.x - p.x, c.y - p.y)));
      childDist.set(id, sum / list.length);
    });
    const maxKid = new Map<string, number>();
    const kidRead = new Map<string, number>();
    kids.forEach((list, id) => {
      maxKid.set(id, Math.max(...list.map((c) => c.cluster || c.self || 0)));
      // Zoom at which the smallest-capacity child would render at READ_SCALE.
      kidRead.set(id, Math.max(...list.map((c) => READ_SCALE / closedCap(c))));
    });
    // Siblings share one boost cap so merged umbrellas stay the same size as each other.
    const groupCap = new Map<string, number>();
    kids.forEach((list, id) => groupCap.set(id, Math.min(...list.map(closedCap))));
    const wob = new Map<string, [number, number, number, number]>();
    items.forEach((it) => {
      wob.set(it.id, [
        0.45 + hash01(it.id, 1) * 0.35,
        0.38 + hash01(it.id, 2) * 0.35,
        hash01(it.id, 3) * Math.PI * 2,
        hash01(it.id, 4) * Math.PI * 2,
      ]);
    });
    return { order, childDist, wob, maxKid, kidRead, groupCap, kids };
  }, [items]);
  const motionRef = useRef(motion);
  motionRef.current = motion;



  const applyCamera = () => {
    const { x, y, k } = cam.current;
    const el = cameraRef.current;
    const box = viewportRef.current;
    if (!el || !box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    el.setAttribute("transform", `translate(${w / 2} ${h / 2}) scale(${k}) translate(${-x} ${-y})`);
    const lod = lodFromK(k, baseKRef.current);
    if (box.getAttribute("data-lod") !== String(lod)) box.setAttribute("data-lod", String(lod));
    kickLoop();
  };

  /** Which umbrellas are popped open at the current zoom (with hysteresis). */
  const updateOpen = () => {
    const { order, childDist, kidRead } = motionRef.current;
    const k = cam.current.k;
    const box = viewportRef.current;
    const minDim = box ? Math.min(box.clientWidth, box.clientHeight) : 400;
    const vx = box ? box.clientWidth / 2 / k : Infinity;
    const vy = box ? box.clientHeight / 2 / k : Infinity;
    const cx = cam.current.x;
    const cy = cam.current.y;
    const fk = focusFrameK.current;
    forcedActive.current = forcedActive.current ? k >= fk * 0.6 : k >= fk * 0.72;
    const forced = forcedActive.current ? pathIdsRef.current : null;
    const open = openSet.current;
    for (const it of order) {
      const d = childDist.get(it.id);
      if (d == null) continue;
      if (!it.parentId) {
        open.add(it.id);
        continue;
      }
      if (!open.has(it.parentId)) {
        open.delete(it.id);
        continue;
      }
      // Pop only umbrellas you are zoomed in on: past the depth's zoom and near the view.
      const was = open.has(it.id);
      const margin = was ? 1.5 : 1.05;
      const near = Math.abs(it.x - cx) < vx * margin && Math.abs(it.y - cy) < vy * margin;
      const spread = d * k >= minDim * (was ? POP_CLOSE_FRAC : POP_OPEN_FRAC);
      const readable = k >= (kidRead.get(it.id) || 0) * (was ? 0.85 : 1);
      const want = (forced && forced.has(it.id)) || (spread && readable && near);
      if (want) open.add(it.id);
      else open.delete(it.id);
    }
  };

  const setShown = (id: string, el: Element, value: string) => {
    if (shownRef.current.get(id) === value) return;
    shownRef.current.set(id, value);
    (el as SVGElement).style.visibility = value;
  };

  const kickLoop = () => {
    if (loopRaf.current || typeof window === "undefined") return;
    lastTick.current = performance.now();
    loopRaf.current = requestAnimationFrame(tick);
  };

  /**
   * Organic branch: a tapered, gently bent cubic from parent to child, drawn as
   * one filled path (thick at the parent, fine at the child) with a gradient
   * that fades toward the child. Widths are in screen px so zoom doesn't fatten it.
   */
  const writeBranch = (
    el: SVGPathElement,
    id: string,
    px: number,
    py: number,
    cx: number,
    cy: number,
    k: number,
    t: number,
    sway: boolean,
    onPath: boolean,
  ) => {
    const dx = cx - px;
    const dy = cy - py;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const w = motionRef.current.wob.get(id);
    const side = w && w[2] > Math.PI ? 1 : -1;
    const bendBase = 0.1 + (w ? (w[3] / (Math.PI * 2)) * 0.08 : 0);
    const bend = len * (bendBase + (sway && w ? Math.sin(t * w[1] * 0.7 + w[2]) * 0.025 : 0)) * side;
    const c1x = px + dx * 0.33 + nx * bend;
    const c1y = py + dy * 0.33 + ny * bend;
    const c2x = px + dx * 0.68 + nx * bend * 0.55;
    const c2y = py + dy * 0.68 + ny * bend * 0.55;
    const s = 1 / k;
    const w0 = (onPath ? 2.2 : 1.3) * s;
    const w1 = (onPath ? 1.5 : 0.85) * s;
    const w2 = (onPath ? 0.95 : 0.55) * s;
    const w3 = (onPath ? 0.5 : 0.3) * s;
    const f = (n: number) => n.toFixed(1);
    el.setAttribute(
      "d",
      `M${f(px + nx * w0)} ${f(py + ny * w0)}C${f(c1x + nx * w1)} ${f(c1y + ny * w1)} ${f(c2x + nx * w2)} ${f(c2y + ny * w2)} ${f(cx + nx * w3)} ${f(cy + ny * w3)}` +
        `L${f(cx - nx * w3)} ${f(cy - ny * w3)}C${f(c2x - nx * w2)} ${f(c2y - ny * w2)} ${f(c1x - nx * w1)} ${f(c1y - ny * w1)} ${f(px - nx * w0)} ${f(py - ny * w0)}Z`,
    );
    // Pick the gradient that runs parent → child along the dominant axis.
    const dir = Math.abs(ux) >= Math.abs(uy) ? (ux >= 0 ? "r" : "l") : uy >= 0 ? "d" : "u";
    if (linkDir.current.get(id) !== dir) {
      linkDir.current.set(id, dir);
      el.setAttribute("fill", `url(#tm-g-${dir})`);
    }
  };

  /** One frame of pop/merge + float. Only SVG transforms/attributes; no React state. */
  const tick = (now: number) => {
    loopRaf.current = 0;
    const dt = Math.min(64, Math.max(0, now - lastTick.current));
    lastTick.current = now;
    updateOpen();
    const { order, wob, groupCap, kids } = motionRef.current;
    const open = openSet.current;
    const pres = presence.current;
    const rm = reduceMotion.current;
    const drift = !rm && !document.hidden;
    const k = cam.current.k;
    const amp = drift ? Math.min(DRIFT_PX / k, DRIFT_MAX_LAYOUT) : 0;
    const t = now / 1000;
    const box = viewportRef.current;
    const halfW = box ? (box.clientWidth / 2 + 260) / k : Infinity;
    const halfH = box ? (box.clientHeight / 2 + 200) / k : Infinity;
    const rendered = new Map<string, { x: number; y: number }>();
    const boosts = boostRef.current;
    const want = LABEL_FLOOR / k;
    let animating = false;

    for (const it of order) {
      const el = nodeEls.current.get(it.id);
      const link = linkEls.current.get(it.id);
      const target = !it.parentId || open.has(it.parentId) ? 1 : 0;
      let p = pres.get(it.id) ?? 0;
      if (p !== target) {
        if (rm) p = target;
        else {
          const step = dt / (target > p ? POP_MS : MERGE_MS);
          p = target > p ? Math.min(target, p + step) : Math.max(target, p - step);
        }
        pres.set(it.id, p);
        if (p !== target) animating = true;
      }
      const parentPos = it.parentId ? rendered.get(it.parentId) || { x: it.x, y: it.y } : { x: it.x, y: it.y };
      if (p <= 0) {
        rendered.set(it.id, parentPos);
        if (el) setShown(it.id, el, "hidden");
        if (link) setShown(`l:${it.id}`, link, "hidden");
        continue;
      }
      const e = p >= 1 ? 1 : rm ? p : easeOutBack(p);
      let ax = it.x;
      let ay = it.y;
      if (amp && it.parentId) {
        const w = wob.get(it.id)!;
        ax += Math.sin(t * w[0] + w[2]) * amp;
        ay += Math.cos(t * w[1] + w[3]) * amp;
      }
      const x = parentPos.x + (ax - parentPos.x) * e;
      const y = parentPos.y + (ay - parentPos.y) * e;
      rendered.set(it.id, { x, y });
      // Skip DOM writes for settled pills far off-screen.
      const off = p >= 1 && (Math.abs(it.x - cam.current.x) > halfW || Math.abs(it.y - cam.current.y) > halfH);
      // Semantic zoom: grow pills toward a readable on-screen size when zoomed
      // out, but never past their own free space (so nothing can overlap).
      const sib = it.parentId ? groupCap.get(it.parentId) ?? closedCap(it) : closedCap(it);
      let cap: number;
      if (open.has(it.id)) {
        // How far the popped children reach toward this pill: a merged child only
        // as far as its own (boosted) pill, an open child its whole cluster.
        const kidCap = Math.min(groupCap.get(it.id) ?? 1, Math.max(1, want));
        let reach = 0;
        for (const c of kids.get(it.id) || []) {
          reach = Math.max(reach, open.has(c.id) ? c.cluster || 0 : (c.self || 0) * kidCap);
        }
        cap = Math.min(openCap(it, reach), sib);
      } else cap = Math.min(closedCap(it), sib);
      const bTarget = Math.max(1, Math.min(want, cap));
      let b = boosts.get(it.id) ?? bTarget;
      if (b !== bTarget) {
        b = rm ? bTarget : b + (bTarget - b) * Math.min(1, dt / 140);
        if (Math.abs(b - bTarget) < 0.002) b = bTarget;
        else animating = true;
        boosts.set(it.id, b);
      } else if (!boosts.has(it.id)) boosts.set(it.id, b);
      if (el) {
        setShown(it.id, el, "visible");
        if (!off) {
          const s = (p >= 1 ? 1 : 0.3 + 0.7 * e) * b;
          el.setAttribute("transform", s === 1 ? `translate(${x} ${y})` : `translate(${x} ${y}) scale(${s})`);
          const op = p >= 1 ? "" : String(Math.min(1, p * 1.6));
          if (el.style.opacity !== op) el.style.opacity = op;
        }
      }
      if (link) {
        setShown(`l:${it.id}`, link, "visible");
        if (!off) {
          writeBranch(link, it.id, parentPos.x, parentPos.y, x, y, k, t, drift, pathIdsRef.current.has(it.id) && pathIdsRef.current.has(it.parentId!));
          const op = p >= 1 ? "" : String(p);
          if (link.style.opacity !== op) link.style.opacity = op;
        }
      }
    }
    if (animating || drift) {
      if (!document.hidden) loopRaf.current = requestAnimationFrame(tick);
    }
  };

  const cancelAnim = () => {
    if (animRaf.current) {
      cancelAnimationFrame(animRaf.current);
      animRaf.current = 0;
    }
  };

  const animateCameraTo = (target: Camera, duration = 420) => {
    cancelAnim();
    const ms = reduceMotion.current ? 0 : duration;
    if (ms === 0) {
      cam.current = { ...target };
      applyCamera();
      return;
    }
    const from = { ...cam.current };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = easeInOutCubic(clamp((now - t0) / ms, 0, 1));
      cam.current.x = from.x + (target.x - from.x) * t;
      cam.current.y = from.y + (target.y - from.y) * t;
      cam.current.k = from.k + (target.k - from.k) * t;
      applyCamera();
      if (t < 1) animRaf.current = requestAnimationFrame(step);
      else animRaf.current = 0;
    };
    animRaf.current = requestAnimationFrame(step);
  };

  const screenToLayout = (sx: number, sy: number) => {
    const box = viewportRef.current!.getBoundingClientRect();
    const { x, y, k } = cam.current;
    return {
      x: x + (sx - box.left - box.width / 2) / k,
      y: y + (sy - box.top - box.height / 2) / k,
    };
  };

  const zoomAround = (sx: number, sy: number, nextK: number) => {
    const k = clamp(nextK, MIN_K, MAX_K);
    const before = screenToLayout(sx, sy);
    cam.current.k = k;
    const after = screenToLayout(sx, sy);
    cam.current.x += before.x - after.x;
    cam.current.y += before.y - after.y;
    applyCamera();
  };

  useEffect(() => {
    reduceMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const v = readStoredView();
    if (v && v.focusId === focusId && Number.isFinite(v.k)) {
      cam.current = { x: v.x, y: v.y, k: clamp(v.k, MIN_K, MAX_K) };
      restoredRef.current = true;
      userMovedRef.current = true;
      applyCamera();
    }
    // Initial restore only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) kickLoop();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (loopRaf.current) cancelAnimationFrame(loopRaf.current);
      loopRaf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // New highlight / focus path may force a branch open.
    kickLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathIds, motion]);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => {
      // Until the user pans or zooms, keep the current focus framed as the
      // viewport settles (phones often resize right after first paint).
      if (!userMovedRef.current && layoutRef.current.size && !animRaf.current) {
        baseKRef.current = frameNode(layoutRef.current, ROOT_ID, box).k;
        const f = frameNode(layoutRef.current, focusIdRef.current, box);
        focusFrameK.current = f.k;
        cam.current = f;
      }
      applyCamera();
    });
    ro.observe(box);
    applyCamera();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    layoutRef.current = items;
    const box = viewportRef.current;
    if (!box || items.size === 0) return;
    baseKRef.current = frameNode(items, ROOT_ID, box).k;

    if (!readyRef.current) {
      readyRef.current = true;
      const first = frameNode(items, focusId, box);
      focusFrameK.current = first.k;
      forcedActive.current = true;
      if (restoredRef.current) {
        restoredRef.current = false;
        applyCamera();
        return;
      }
      cam.current = first;
      applyCamera();
      return;
    }

    const target = frameNode(items, focusId, box);
    userMovedRef.current = false;
    focusFrameK.current = target.k;
    forcedActive.current = true;
    animateCameraTo(target);
    return () => cancelAnim();
    // items only changes when the tree itself changes; focusId drives the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, items]);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnim();
      userMovedRef.current = true;
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(e.clientX, e.clientY, cam.current.k * factor);
    };

    const onDown = (e: PointerEvent) => {
      cancelAnim();
      box.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) {
        pannedRef.current = false;
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false };
        pinch.current = null;
      } else if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const mid = screenToLayout(midX, midY);
        pinch.current = { dist: Math.max(dist, 1), k: cam.current.k, lx: mid.x, ly: mid.y };
        drag.current = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && pointers.current.size >= 2) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        userMovedRef.current = true;
        const nextK = clamp(pinch.current.k * (dist / pinch.current.dist), MIN_K, MAX_K);
        cam.current.k = nextK;
        const boxRect = box.getBoundingClientRect();
        cam.current.x = pinch.current.lx - (midX - boxRect.left - boxRect.width / 2) / nextK;
        cam.current.y = pinch.current.ly - (midY - boxRect.top - boxRect.height / 2) / nextK;
        applyCamera();
        return;
      }
      if (drag.current && pointers.current.size === 1) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        if (Math.hypot(dx, dy) > TAP_PX) {
          drag.current.moved = true;
          userMovedRef.current = true;
          pannedRef.current = true;
          cam.current.x = drag.current.cx - dx / cam.current.k;
          cam.current.y = drag.current.cy - dy / cam.current.k;
          applyCamera();
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      const shouldTap = !pannedRef.current && pointers.current.size === 0 && !pinch.current;
      if (pointers.current.size === 0) {
        const x = e.clientX;
        const y = e.clientY;
        requestAnimationFrame(() => {
          if (shouldTap) activateAtPoint(x, y);
          drag.current = null;
          pannedRef.current = false;
        });
      }
      try {
        box.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    };

    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    box.addEventListener("lostpointercapture", onUp);
    return () => {
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("lostpointercapture", onUp);
    };
  }, []);

  const activateNode = (node: MapTreeNode) => {
    if (node.type === "topic" && node.topicId) {
      storeMapView({ focusId: focusIdRef.current, ...cam.current });
      onOpenTopicRef.current(node.topicId);
      return;
    }
    onFocusRef.current(node.id);
  };

  const activateAtPoint = (sx: number, sy: number) => {
    const el = document.elementFromPoint(sx, sy);
    if (!el) return;
    const also = (el as Element).closest(".tm-also-hit");
    const g = (el as Element).closest("[data-testid^='map-node-']");
    if (!g) return;
    const id = g.getAttribute("data-testid")!.slice("map-node-".length);
    const item = layoutRef.current.get(id);
    if (!item) return;
    if (also && item.node.alsoIn?.[0]) {
      onFocusRef.current(item.node.alsoIn[0].id);
      return;
    }
    activateNode(item.node);
  };

  const links: { id: string; x1: number; y1: number; x2: number; y2: number; depth: number; onPath: boolean; forced: boolean }[] = [];
  items.forEach((item) => {
    if (!item.parentId) return;
    const parent = items.get(item.parentId);
    if (!parent) return;
    links.push({
      id: `${parent.id}->${item.id}`,
      x1: parent.x,
      y1: parent.y,
      x2: item.x,
      y2: item.y,
      depth: Math.max(item.depth, 0),
      onPath: pathIds.has(item.id) && pathIds.has(parent.id),
      forced: item.id === focusId || item.parentId === focusId,
    });
  });

  const ordered = [...items.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));

  return (
    <div
      ref={viewportRef}
      className={`topics-map relative h-full w-full overflow-hidden ${className}`}
      data-lod="0"
      data-testid="topics-map"
    >
      <svg role="img" aria-label="Explore Topics map">
        <defs>
          {(
            [
              ["r", 0, 0, 1, 0],
              ["l", 1, 0, 0, 0],
              ["d", 0, 0, 0, 1],
              ["u", 0, 1, 0, 0],
            ] as const
          ).map(([d, x1, y1, x2, y2]) => (
            <linearGradient key={d} id={`tm-g-${d}`} x1={x1} y1={y1} x2={x2} y2={y2}>
              <stop offset="0" className="tm-stop-a" />
              <stop offset="1" className="tm-stop-b" />
            </linearGradient>
          ))}
        </defs>
        <g ref={cameraRef} data-testid="topics-map-camera">
          <g data-links>
            {links.map((l) => (
              <path
                key={l.id}
                ref={(el) => {
                  const cid = l.id.slice(l.id.indexOf("->") + 2);
                  if (el) linkEls.current.set(cid, el);
                  else linkEls.current.delete(cid);
                }}
                className="tm-link"
                fill="url(#tm-g-r)"
              />
            ))}
          </g>
          <g data-nodes>
            {ordered.map((item) => {
              const { node } = item;
              const { w, h } = measurePill(node.name, node.type);
              const isFocus = node.id === focusId;
              const isChildOfFocus = item.parentId === focusId;
              const isHighlight = Boolean(highlightId && (node.id === highlightId || node.topicId === highlightId));
              const lodClass = item.depth <= 1 ? "tm-lod-1" : item.depth === 2 ? "tm-lod-2" : "tm-lod-3";
              const fontSize = pillFontSize(node.type);
              return (
                <g
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeEls.current.set(node.id, el);
                    else nodeEls.current.delete(node.id);
                  }}
                  transform={`translate(${item.x} ${item.y})`}
                  className={`tm-node ${lodClass} ${isFocus || isChildOfFocus ? "tm-forced" : ""} ${isFocus ? "is-focus" : ""} ${isHighlight ? "is-highlight" : ""}`}
                  data-testid={`map-node-${node.id}`}
                  data-map-type={node.type}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateNode(node);
                    }
                  }}
                >
                  <rect
                    className="tm-pill"
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx={h / 2}
                    ry={h / 2}
                    style={node.accent && node.type !== "topic" ? { stroke: node.accent } : undefined}
                  />
                  {(() => {
                    const full = labelSafe(node.name);
                    const short = shortLabel(full, node.type);
                    const y = node.type === "topic" && node.alsoIn?.length ? -2 : 4;
                    const cls = node.type === "topic" ? "tm-topic-label" : "tm-label";
                    return (
                      <>
                        <text
                          className={`${cls} tm-label-full`}
                          textAnchor="middle"
                          y={y}
                          fontSize={fontSize}
                          data-full={full}
                        >
                          {full}
                        </text>
                        {short !== full && (
                          <text className={`${cls} tm-label-short`} textAnchor="middle" y={y} fontSize={fontSize}>
                            {short}
                          </text>
                        )}
                      </>
                    );
                  })()}
                  {node.type !== "topic" && node.type !== "root" && node.count > 0 && (
                    <text className="tm-count" textAnchor="middle" y={h / 2 + 12}>
                      {node.count}
                    </text>
                  )}
                  {node.type === "topic" && node.alsoIn && node.alsoIn.length > 0 && (
                    <g
                      className="tm-also-hit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <text className="tm-also" textAnchor="middle" y={12}>
                        also in {node.alsoIn[0].name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}

function labelSafe(name: string) {
  return name.length > 36 ? `${name.slice(0, 34)}…` : name;
}

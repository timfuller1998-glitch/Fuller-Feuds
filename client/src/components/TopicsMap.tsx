import { useEffect, useMemo, useRef } from "react";
import {
  type MapTreeNode,
  pathToNode,
  ROOT_ID,
} from "@shared/topicTaxonomy";
import {
  layoutWorld,
  measureLayoutBox,
  measurePill,
  planLabels,
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

const MIN_K = 0.08;
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

/** Lowest zoom in a lod band, used so label hiding is stable during a gesture. */
function kFloorForLod(lod: number, baseK: number) {
  if (lod <= 0) return Math.max(baseK, 0.2);
  if (lod === 1) return 1.35 * baseK;
  if (lod === 2) return 2.4 * baseK;
  return 3.8 * baseK;
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

  // Center the tapped pill. Size the zoom so the pill, its children, and
  // the connecting lines stay in view even though that box is off-center.
  const cx = focus.x;
  const cy = focus.y;
  let halfW = 40;
  let halfH = 40;
  members.forEach((it) => {
    const { w, h } = measureLayoutBox(it.node);
    halfW = Math.max(halfW, Math.abs(it.x - w / 2 - cx), Math.abs(it.x + w / 2 - cx));
    halfH = Math.max(halfH, Math.abs(it.y - h / 2 - cy), Math.abs(it.y + h / 2 - cy));
  });
  const fitK = Math.min(
    viewport.clientWidth / (halfW * 2 + FRAME_PAD * 2),
    viewport.clientHeight / (halfH * 2 + FRAME_PAD * 2),
  );
  // If fitting every child would shrink the focused pill until it is hard to
  // read, zoom in anyway. Outermost branches can sit just off-screen; the
  // user can pan, and the connecting lines still show the way.
  const pill = measurePill(focus.node.name, focus.node.type);
  const readableK = focus.depth > 0 ? 112 / Math.max(pill.w, 72) : 0;
  const k = clamp(Math.max(fitK, readableK), MIN_K, MAX_K);
  return { x: cx, y: cy, k };
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

  const items = useMemo(() => layoutWorld(tree), [tree]);
  layoutRef.current = items;

  const lodKeyRef = useRef("");

  const applyLabelLod = (lod: number) => {
    const plan = planLabels(layoutRef.current, {
      k: kFloorForLod(lod, baseKRef.current),
      focusId: focusIdRef.current,
      highlightId: highlightIdRef.current,
      pathIds: pathIdsRef.current,
    });
    nodeEls.current.forEach((el, id) => {
      el.classList.toggle("tm-crowded", plan.hidden.has(id));
      el.classList.toggle("tm-abbrev", plan.abbrev.has(id));
    });
  };

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
    const key = `${lod}|${focusIdRef.current}|${highlightIdRef.current || ""}`;
    if (lodKeyRef.current !== key) {
      lodKeyRef.current = key;
      applyLabelLod(lod);
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
      applyCamera();
    }
    // Initial restore only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => applyCamera());
    ro.observe(box);
    applyCamera();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    layoutRef.current = items;
    lodKeyRef.current = "";
    const box = viewportRef.current;
    if (!box || items.size === 0) return;
    baseKRef.current = frameNode(items, ROOT_ID, box).k;

    if (!readyRef.current) {
      readyRef.current = true;
      if (restoredRef.current) {
        restoredRef.current = false;
        applyCamera();
        return;
      }
      cam.current = frameNode(items, focusId, box);
      applyCamera();
      return;
    }

    animateCameraTo(frameNode(items, focusId, box));
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
        <g ref={cameraRef} data-testid="topics-map-camera">
          <g data-links>
            {links.map((l) => (
              <line
                key={l.id}
                className={`tm-link ${l.onPath ? "tm-path" : ""} tm-lod-${Math.max(l.depth, 0)} ${l.forced ? "tm-forced" : ""}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
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
              const fontSize = node.type === "topic" ? 12 : node.type === "root" ? 12 : node.type === "major" ? 11 : 10;
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

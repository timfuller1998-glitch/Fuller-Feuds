import { useEffect, useMemo, useRef } from "react";
import {
  type MapTreeNode,
  findNodeByFocus,
  pathToNode,
  ROOT_ID,
} from "@shared/topicTaxonomy";

export const MAP_VIEW_KEY = "ff-topics-map-view";

export interface MapViewState {
  focusId: string;
  x: number;
  y: number;
  k: number;
}

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  depth: number;
  parentId?: string;
  node: MapTreeNode;
}

interface TopicsMapProps {
  tree: MapTreeNode;
  focusId: string;
  highlightId?: string | null;
  onFocus: (id: string) => void;
  onOpenTopic: (topicId: string) => void;
  className?: string;
}

const MIN_K = 0.4;
const MAX_K = 6;
const TAP_PX = 14;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lodFromK(k: number): 0 | 1 | 2 | 3 {
  // Default view (k = 1) shows the current center and its children only.
  // Subs and topics resolve as the user zooms in.
  if (k < 1.25) return 0;
  if (k < 1.85) return 1;
  if (k < 2.5) return 2;
  return 3;
}

function measurePill(name: string, type: MapTreeNode["type"]): { w: number; h: number } {
  if (type === "topic") {
    const w = Math.min(280, Math.max(72, name.length * 7.2 + 20));
    return { w, h: 28 };
  }
  if (type === "root") {
    return { w: Math.max(150, name.length * 8.2 + 32), h: 40 };
  }
  const w = Math.min(220, Math.max(84, name.length * 7.4 + 28));
  return { w, h: type === "major" ? 34 : 28 };
}

function layoutRadial(tree: MapTreeNode, focusId: string): Map<string, LayoutItem> {
  const focus = findNodeByFocus(tree, focusId) || tree;
  const path = pathToNode(tree, focus.id);
  const parent = path.length > 1 ? path[path.length - 2] : undefined;
  const items = new Map<string, LayoutItem>();

  items.set(focus.id, { id: focus.id, x: 0, y: 0, depth: 0, parentId: parent?.id, node: focus });
  if (parent) {
    items.set(parent.id, { id: parent.id, x: 0, y: -155, depth: -1, node: parent });
  }

  const children = focus.children;
  const n = children.length;
  const R = Math.max(200, (n * 78) / (2 * Math.PI) * 2.15);

  children.forEach((child, i) => {
    const a = n === 0 ? 0 : (2 * Math.PI * i) / n - Math.PI / 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    items.set(child.id, { id: child.id, x, y, depth: 1, parentId: focus.id, node: child });

    const grands = child.children;
    if (!grands.length) return;
    const r2 = R + Math.max(150, 22 * Math.sqrt(grands.length) + 70);
    const wedge = n === 0 ? Math.PI / 2 : ((2 * Math.PI) / n) * 0.82;
    grands.forEach((g, j) => {
      const t = grands.length === 1 ? 0.5 : j / (grands.length - 1);
      const a2 = a - wedge / 2 + t * wedge;
      items.set(g.id, {
        id: g.id,
        x: Math.cos(a2) * r2,
        y: Math.sin(a2) * r2,
        depth: 2,
        parentId: child.id,
        node: g,
      });

      const greats = g.children;
      if (!greats.length) return;
      const r3 = r2 + Math.max(120, 16 * Math.sqrt(greats.length) + 50);
      const wedge2 = (wedge / Math.max(grands.length, 1)) * 0.9;
      greats.forEach((tNode, k) => {
        const u = greats.length === 1 ? 0.5 : k / (greats.length - 1);
        const a3 = a2 - wedge2 / 2 + u * wedge2;
        items.set(tNode.id, {
          id: tNode.id,
          x: Math.cos(a3) * r3,
          y: Math.sin(a3) * r3,
          depth: 3,
          parentId: g.id,
          node: tNode,
        });
      });
    });
  });

  return items;
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
  const cam = useRef({ x: 0, y: 0, k: 1 });
  const layoutRef = useRef<Map<string, LayoutItem>>(new Map());
  const nodeEls = useRef<Map<string, SVGGElement>>(new Map());
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; k: number; lx: number; ly: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pannedRef = useRef(false);
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

  const items = useMemo(() => layoutRadial(tree, focusId), [tree, focusId]);


  const fitCamera = (layout: Map<string, LayoutItem>) => {
    const box = viewportRef.current;
    if (!box) return { x: 0, y: 0, k: 1 };
    const visible = [...layout.values()].filter((it) => it.depth <= 1);
    if (!visible.length) return { x: 0, y: 0, k: 1 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visible.forEach((it) => {
      const { w, h } = measurePill(it.node.name, it.node.type);
      minX = Math.min(minX, it.x - w / 2);
      maxX = Math.max(maxX, it.x + w / 2);
      minY = Math.min(minY, it.y - h / 2);
      maxY = Math.max(maxY, it.y + h / 2);
    });
    const pad = 36;
    const bw = Math.max(maxX - minX, 80);
    const bh = Math.max(maxY - minY, 80);
    const k = clamp(Math.min(box.clientWidth / (bw + pad * 2), box.clientHeight / (bh + pad * 2)), 0.45, 1.08);
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, k };
  };
  const applyCamera = () => {
    const { x, y, k } = cam.current;
    const el = cameraRef.current;
    const box = viewportRef.current;
    if (!el || !box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    el.setAttribute("transform", `translate(${w / 2} ${h / 2}) scale(${k}) translate(${-x} ${-y})`);
    const lod = lodFromK(k);
    if (box.getAttribute("data-lod") !== String(lod)) box.setAttribute("data-lod", String(lod));
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

  const restoredRef = useRef(false);
  useEffect(() => {
    reduceMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const v = readStoredView();
    if (v && v.focusId === focusId && Number.isFinite(v.k)) {
      cam.current = { x: v.x, y: v.y, k: clamp(v.k, MIN_K, MAX_K) };
      restoredRef.current = true;
      applyCamera();
    }
  }, []);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => applyCamera());
    ro.observe(box);
    applyCamera();
    return () => ro.disconnect();
  }, []);

  // Animate node positions when the focus (and therefore the layout) changes.
  useEffect(() => {
    const prev = layoutRef.current;
    layoutRef.current = items;
    const ids = new Set(items.keys());
    const start = new Map<string, { x: number; y: number }>();
    ids.forEach((id) => {
      const was = prev.get(id);
      const now = items.get(id)!;
      start.set(id, was ? { x: was.x, y: was.y } : { x: now.x, y: now.y });
    });

    const skipReset = restoredRef.current;
    restoredRef.current = false;
    const duration = reduceMotion.current || skipReset ? 0 : 380;
    if (duration === 0) {
      ids.forEach((id) => {
        const el = nodeEls.current.get(id);
        const now = items.get(id)!;
        if (el) el.setAttribute("transform", `translate(${now.x} ${now.y})`);
      });
      if (!skipReset) cam.current = fitCamera(items);
      applyCamera();
      return;
    }

    const fromCam = { ...cam.current };
    const toCam = fitCamera(items);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = easeInOutCubic(clamp((now - t0) / duration, 0, 1));
      ids.forEach((id) => {
        const el = nodeEls.current.get(id);
        const a = start.get(id)!;
        const b = items.get(id)!;
        if (el) el.setAttribute("transform", `translate(${a.x + (b.x - a.x) * t} ${a.y + (b.y - a.y) * t})`);
      });
      cam.current.x = fromCam.x + (toCam.x - fromCam.x) * t;
      cam.current.y = fromCam.y + (toCam.y - fromCam.y) * t;
      cam.current.k = fromCam.k + (toCam.k - fromCam.k) * t;
      applyCamera();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(e.clientX, e.clientY, cam.current.k * factor);
    };

    const onDown = (e: PointerEvent) => {
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

  const links: { id: string; x1: number; y1: number; x2: number; y2: number; depth: number; onPath: boolean }[] = [];
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
    });
  });

  const ordered = [...items.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));

  return (
    <div
      ref={viewportRef}
      className={`topics-map relative h-full w-full overflow-hidden ${className}`}
      data-lod="1"
      data-testid="topics-map"
    >
      <svg role="img" aria-label="Explore Topics map">
        <g ref={cameraRef} data-testid="topics-map-camera">
          <g data-links>
            {links.map((l) => (
              <line
                key={l.id}
                className={`tm-link ${l.onPath ? "tm-path" : ""} tm-lod-${Math.max(l.depth, 0)}`}
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
              const isFocus = node.id === focusId || (focusId === ROOT_ID && node.id === ROOT_ID);
              const isHighlight = Boolean(highlightId && (node.id === highlightId || node.topicId === highlightId));
              const lodClass = item.depth <= 1 ? "tm-lod-1" : item.depth === 2 ? "tm-lod-2" : "tm-lod-3";
              const label = node.type === "topic" ? node.name : node.name;
              const fontSize = node.type === "topic" ? 12 : node.type === "root" ? 12 : node.type === "major" ? 11 : 10;
              return (
                <g
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeEls.current.set(node.id, el);
                    else nodeEls.current.delete(node.id);
                  }}
                  transform={`translate(${item.x} ${item.y})`}
                  className={`tm-node ${lodClass} ${isFocus ? "is-focus" : ""} ${isHighlight ? "is-highlight" : ""}`}
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
                  <text
                    className={node.type === "topic" ? "tm-topic-label" : "tm-label"}
                    textAnchor="middle"
                    y={node.type === "topic" && node.alsoIn?.length ? -2 : 4}
                    fontSize={fontSize}
                  >
                    {label.length > 36 ? `${label.slice(0, 34)}…` : label}
                  </text>
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

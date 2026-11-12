import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CARD_GESTURE_LOCK_PX, markCardGesture } from "@/lib/cardGesture";

function nearestPageScroller(from: HTMLElement | null): HTMLElement | null {
  let el = from;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight - el.clientHeight > 1) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * In-card text area: scrolls when the body overflows, otherwise lets the page
 * (usually `main`) scroll. At either end of the in-card scroller, further
 * vertical drags chain to the page. A move is marked as a gesture so it
 * does not flip the card on pointer-up.
 *
 * Chaining uses a non-passive touchmove listener so it works with real
 * touches (and Playwright CDP), not only pointer events.
 */
export function CardScrollBody({ className, children, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const lastY = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [overflows, setOverflows] = useState(false);
  const overflowsRef = useRef(false);
  overflowsRef.current = overflows;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    const ro = new ResizeObserver(update);
    const watch = () => {
      ro.observe(el);
      el.querySelectorAll("*").forEach((n) => ro.observe(n));
    };
    update();
    watch();
    const mo = new MutationObserver(() => { update(); watch(); });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [children]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last: number | null = null;
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      last = e.touches[0]?.clientY ?? null;
      startY = last;
    };
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y == null || last == null) return;
      if (startY != null && Math.abs(y - startY) >= CARD_GESTURE_LOCK_PX) markCardGesture();
      const dy = last - y;
      last = y;
      if (!overflowsRef.current || dy === 0) return;
      const max = el.scrollHeight - el.clientHeight;
      const atStart = el.scrollTop <= 0;
      const atEnd = el.scrollTop >= max - 1;
      if ((dy < 0 && atStart) || (dy > 0 && atEnd)) {
        const page = nearestPageScroller(el.parentElement);
        if (page) {
          e.preventDefault();
          page.scrollTop += dy;
          markCardGesture();
        }
      }
    };
    const onEnd = () => { last = null; startY = null; };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      {...rest}
      ref={ref}
      data-card-scroll-body=""
      className={cn(
        "min-h-0 flex-1 overflow-x-hidden touch-pan-y overscroll-y-auto pr-1",
        overflows ? "overflow-y-auto" : "overflow-y-hidden",
        className,
      )}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        lastY.current = e.clientY;
        onPointerDown?.(e);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= CARD_GESTURE_LOCK_PX) markCardGesture();
        const el = ref.current;
        const prev = lastY.current;
        if (el && prev != null && overflows) {
          const dy = prev - e.clientY;
          lastY.current = e.clientY;
          if (dy !== 0) {
            const max = el.scrollHeight - el.clientHeight;
            const atStart = el.scrollTop <= 0;
            const atEnd = el.scrollTop >= max - 1;
            if ((dy < 0 && atStart) || (dy > 0 && atEnd)) {
              const page = nearestPageScroller(el.parentElement);
              if (page) {
                page.scrollTop += dy;
                markCardGesture();
              }
            }
          }
        } else {
          lastY.current = e.clientY;
        }
        onPointerMove?.(e);
      }}
      onPointerUp={(e) => {
        start.current = null;
        lastY.current = null;
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        start.current = null;
        lastY.current = null;
        onPointerCancel?.(e);
      }}
    >
      {children}
    </div>
  );
}

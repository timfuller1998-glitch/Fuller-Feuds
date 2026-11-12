import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
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
 */
export function CardScrollBody({ className, children, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const lastY = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

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

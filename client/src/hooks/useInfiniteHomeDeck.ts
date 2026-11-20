import { useCallback, useEffect, useRef, useState } from "react";
import type { TopicWithCounts } from "@shared/schema";
import { FEED_PAGE_SIZE, type HomeSectionKey } from "@shared/homeFeed";

/**
 * Endless home deck (Fuller Feuds Dev, Nov 20 2026). Pages through POST /api/feed/home for one section
 * (cursor = ids already dealt this cycle) and keeps appending, so the pile never runs out:
 * - cycle 0 is the server's ranked order (topics seen recently pushed back);
 * - when every topic in the section has been dealt, the next cycle is a fresh weighted shuffle, so nothing
 *   repeats until everything has been shown, and never the same card twice in a row;
 * - the first card avoids topics already on top of another home section.
 */

export type DeckItem = TopicWithCounts & { deckKey: string };

const SEEN_KEY = "ff-home-seen";
const SEEN_TTL_MS = 12 * 60 * 60 * 1000;
/** Load until at least this many cards are in the pile before showing it (keeps the ad mix stable). */
const MIN_READY = 8;

// Which topic is on top of each home section right now (to avoid the same card on two sections).
const sectionTops = new Map<string, string>();

function readSeen(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => now - at < SEEN_TTL_MS));
  } catch {
    return {};
  }
}
function markSeen(id: string) {
  try {
    const seen = readSeen();
    seen[id] = Date.now();
    const entries = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 300);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage full or blocked: ranking just won't skip seen cards */ }
}

export function useInfiniteHomeDeck(section: HomeSectionKey, enabled = true) {
  const [items, setItems] = useState<DeckItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const state = useRef({ cycle: 0, loading: false, cycleIds: new Set<string>(), seen: Object.keys(readSeen()), items: [] as DeckItem[] });
  const seed = useRef(Math.random().toString(36).slice(2, 10));

  const loadMore = useCallback(async () => {
    const st = state.current;
    if (st.loading || !enabled) return;
    st.loading = true;
    try {
      // Loop so a small section (fewer topics than a page) still fills up to MIN_READY right away.
      for (let guard = 0; guard < 6; guard++) {
        const res = await fetch("/api/feed/home", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            section, cycle: st.cycle, seed: seed.current, limit: FEED_PAGE_SIZE,
            exclude: Array.from(st.cycleIds), seen: st.cycle === 0 ? st.seen.slice(0, 150) : [],
          }),
        });
        if (!res.ok) throw new Error("feed");
        const page: { items: TopicWithCounts[]; cycleDone: boolean; total: number } = await res.json();
        setTotal(page.total);
        if (page.total === 0) break;

        let incoming = page.items.filter((t) => !st.cycleIds.has(t.id));
        const prev = st.items[st.items.length - 1];
        // Never the same card twice in a row (e.g. across a cycle boundary).
        if (prev && incoming.length > 1 && incoming[0].id === prev.id) incoming = [incoming[1], incoming[0], ...incoming.slice(2)];
        // The very first card: avoid one already on top of another home section.
        if (st.items.length === 0 && incoming.length > 1) {
          const tops = new Set(Array.from(sectionTops.entries()).filter(([k]) => k !== section).map(([, v]) => v));
          const i = incoming.findIndex((t) => !tops.has(t.id));
          if (i > 0) incoming = [incoming[i], ...incoming.slice(0, i), ...incoming.slice(i + 1)];
        }
        const cycle = st.cycle;
        incoming.forEach((t) => st.cycleIds.add(t.id));
        const added: DeckItem[] = incoming.map((t) => ({ ...t, deckKey: `${t.id}~${cycle}` }));
        st.items = [...st.items, ...added];

        if (page.cycleDone) {
          // Every topic in this section has been dealt once: start a new, reshuffled cycle.
          st.cycle += 1;
          st.cycleIds = new Set();
        }
        if (page.total < 2) break; // a single topic: show it once, no endless repeats
        if (st.items.length >= MIN_READY) break;
      }
      setItems(st.items);
      setError(false);
    } catch {
      setError(true);
    } finally {
      st.loading = false;
    }
  }, [section, enabled]);

  useEffect(() => {
    if (enabled && state.current.items.length === 0) void loadMore();
  }, [enabled, loadMore]);

  const onTopChange = useCallback((item: DeckItem) => {
    sectionTops.set(section, item.id);
    markSeen(item.id);
  }, [section]);

  useEffect(() => () => { sectionTops.delete(section); }, [section]);

  return { items, total, error, loadMore, onTopChange, endless: (total ?? 0) >= 2 };
}

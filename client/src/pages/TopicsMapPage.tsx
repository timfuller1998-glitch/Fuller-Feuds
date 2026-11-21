import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Search, X } from "lucide-react";
import TopicsMap, { peekStoredMapView } from "@/components/TopicsMap";
import {
  type MapTreeNode,
  ROOT_ID,
  findNodeByFocus,
  indexMapNodes,
  pathToNode,
} from "@shared/topicTaxonomy";

function useQueryParam(name: string): string | null {
  const search = useSearch();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = params.get(name);
  return value && value.length ? value : null;
}

function replaceQuery(updates: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === ROOT_ID) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}

export default function TopicsMapPage() {
  const [, setLocation] = useLocation();
  const focusParam = useQueryParam("focus");
  const synthetic = useQueryParam("synthetic") === "1";
  const stored = typeof window !== "undefined" ? peekStoredMapView() : null;
  const [focusId, setFocusId] = useState<string>(focusParam || stored?.focusId || ROOT_ID);
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { data: tree, isLoading, error } = useQuery<MapTreeNode>({
    queryKey: ["/api/topics/map", synthetic ? "synthetic" : "live"],
    queryFn: async () => {
      const qs = synthetic ? "?synthetic=1" : "";
      const res = await fetch(`/api/topics/map${qs}`);
      if (!res.ok) throw new Error("Failed to load topics map");
      return res.json();
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!tree) return;
    const want = focusParam || stored?.focusId;
    if (!want) return;
    const node = findNodeByFocus(tree, want);
    if (node) setFocusId(node.id);
    // Only honor the stored focus on first load of this tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const path = useMemo(() => (tree ? pathToNode(tree, focusId) : []), [tree, focusId]);
  const parent = path.length > 1 ? path[path.length - 2] : null;

  const setFocus = useCallback((id: string) => {
    setFocusId(id);
    setHighlightId(null);
    replaceQuery({ focus: id === ROOT_ID ? null : id });
  }, []);

  const nodes = useMemo(() => (tree ? indexMapNodes(tree) : []), [tree]);
  const q = search.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (q.length < 1) return [];
    return nodes
      .filter((n) => n.id !== ROOT_ID && n.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [nodes, q]);

  const focusSearchResult = (node: MapTreeNode) => {
    setSearch("");
    setHighlightId(node.id);
    setFocusId(node.id);
    replaceQuery({ focus: node.id === ROOT_ID ? null : node.id });
  };

  const goParent = () => {
    if (parent) setFocus(parent.id);
    else setFocus(ROOT_ID);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (search) {
          setSearch("");
          return;
        }
        goParent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, search]);

  const openTopic = (topicId: string) => {
    setLocation(`/topic/${topicId}`);
  };

  return (
    <div className="topics-map-page relative h-full min-h-0 w-full" data-testid="topics-map-page">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 bg-gradient-to-b from-[hsl(30_14%_9%)] via-[hsl(30_14%_9%/0.92)] to-transparent p-3 pb-8 sm:p-4 sm:pb-10">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goParent}
            disabled={!parent}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-[hsl(30_13%_14%)] px-3 py-1.5 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[hsl(40_35%_90%)] disabled:opacity-40"
            data-testid="button-map-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {parent ? parent.name : "Top level"}
          </button>
          <nav
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[hsl(40_35%_90%)]"
            aria-label="Map breadcrumb"
            data-testid="map-breadcrumb"
          >
            {path.map((node, i) => (
              <span key={node.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[hsl(38_18%_70%)]">/</span>}
                <button
                  type="button"
                  className={`max-w-[10rem] truncate font-ui text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${
                    i === path.length - 1 ? "text-[hsl(4_72%_66%)]" : "text-[hsl(38_18%_70%)] hover:text-[hsl(40_35%_90%)]"
                  }`}
                  onClick={() => setFocus(node.id)}
                  data-testid={`map-crumb-${node.id}`}
                >
                  {node.name}
                </button>
              </span>
            ))}
          </nav>
        </div>
        <div className="pointer-events-auto relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(38_18%_70%)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics and categories"
            className="w-full rounded-full border border-white/15 bg-[hsl(30_13%_14%)] py-2 pl-9 pr-9 font-ui text-sm text-[hsl(40_35%_90%)] placeholder:text-[hsl(38_18%_55%)] outline-none focus:border-[hsl(4_72%_66%)]"
            data-testid="input-map-search"
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(38_18%_70%)]"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {suggestions.length > 0 && (
            <ul
              className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/15 bg-[hsl(30_13%_12%)] py-1 shadow-lg"
              data-testid="map-search-results"
            >
              {suggestions.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5"
                    onClick={() => focusSearchResult(node)}
                    data-testid={`map-search-result-${node.id}`}
                  >
                    <span className={node.type === "topic" ? "font-serif font-semibold text-[hsl(40_35%_90%)]" : "font-ui text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(40_35%_90%)]"}>
                      {node.name}
                    </span>
                    <span className="font-ui text-[0.62rem] uppercase tracking-[0.08em] text-[hsl(38_18%_70%)]">
                      {node.type === "topic" ? "Topic" : node.type === "sub" ? "Sub" : "Category"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="absolute inset-0 pt-[7.5rem] sm:pt-32">
        {isLoading && (
          <div className="flex h-full items-center justify-center bg-[hsl(30_14%_9%)] font-ui text-sm uppercase tracking-[0.08em] text-[hsl(38_18%_70%)]">
            Loading map…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center bg-[hsl(30_14%_9%)] font-ui text-sm text-[hsl(4_72%_66%)]">
            Couldn’t load the topics map.
          </div>
        )}
        {tree && (
          <TopicsMap
            tree={tree}
            focusId={focusId}
            highlightId={highlightId}
            onFocus={setFocus}
            onOpenTopic={openTopic}
          />
        )}
      </div>
    </div>
  );
}

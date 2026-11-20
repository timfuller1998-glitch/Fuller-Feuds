// Home "infinite" decks (Fuller Feuds Dev, Nov 20 2026): section keys shared by /api/feed/home and Home.tsx.
export const HOME_SECTIONS = [
  "trending", "hot-debates", "new-this-week", "most-debated", "diverse-perspectives", "my-topics", "my-current-debates",
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number];
/** Cards fetched per page. */
export const FEED_PAGE_SIZE = 10;
/** Fetch the next page when this many real cards (or fewer) are left in the pile. */
export const FEED_PREFETCH_AT = 3;

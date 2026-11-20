// Google AdSense configuration (Fuller Feuds Dev, Nov 20 2026). Build-time Vite env vars, set on
// Render before the build. See docs/ADSENSE.md. Unset = placeholders only, no Google script.
const rawClient = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() ?? "";
const rawSlot = (import.meta.env.VITE_ADSENSE_SLOT_FEED as string | undefined)?.trim() ?? "";

/** "ca-pub-1234567890123456" when configured, else "". */
export const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/.test(rawClient) ? rawClient : "";
/** Ad unit (slot) id for in-feed display units, digits only. */
export const ADSENSE_SLOT_FEED = /^\d{6,20}$/.test(rawSlot) ? rawSlot : "";
/** Real ads render only when both the publisher id and a slot id are set. */
export const ADSENSE_LIVE = !!(ADSENSE_CLIENT && ADSENSE_SLOT_FEED);

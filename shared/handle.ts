/**
 * @handles: unique public usernames shown under display names (display names may repeat).
 * Rules: 3-20 chars, letters / numbers / underscore, must start with a letter, case-insensitive unique.
 * Stored as typed (case preserved); uniqueness is on lower(handle).
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const HANDLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;

export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "moderator", "mod", "mods", "support", "help", "helpdesk", "fullerfeuds", "fullerfeud",
  "fuller_feuds", "fuller", "feuds", "api", "app", "www", "root", "system", "staff", "official", "team", "security",
  "settings", "profile", "login", "logout", "signup", "register", "onboarding", "about", "terms", "privacy", "null",
  "undefined", "anonymous", "everyone", "here", "me", "you", "user", "users", "u", "topic", "topics", "debate",
  "debates", "live", "search", "trending", "grok", "bot", "owner",
]);

/** Strip a leading @ and surrounding spaces. */
export function normalizeHandleInput(raw: string): string {
  return String(raw ?? "").trim().replace(/^@+/, "");
}

/** Returns an error message, or null when the handle is well-formed and not reserved. */
export function validateHandle(raw: string): string | null {
  const h = normalizeHandleInput(raw);
  if (h.length < HANDLE_MIN) return `At least ${HANDLE_MIN} characters`;
  if (h.length > HANDLE_MAX) return `At most ${HANDLE_MAX} characters`;
  if (!/^[A-Za-z0-9_]+$/.test(h)) return "Letters, numbers and underscores only";
  if (!/^[A-Za-z]/.test(h)) return "Must start with a letter";
  if (RESERVED_HANDLES.has(h.toLowerCase())) return "That handle is reserved";
  return null;
}

/** A well-formed base for auto-generated handles, from a display/first name. */
export function handleBaseFrom(...names: (string | null | undefined)[]): string {
  let base = names.filter(Boolean).join("").normalize("NFKD").replace(/[^A-Za-z0-9_]/g, "");
  if (!/^[A-Za-z]/.test(base)) base = "user" + base;
  base = base.slice(0, 15); // leave room for a number suffix
  if (base.length < HANDLE_MIN) base = base.padEnd(HANDLE_MIN, "1");
  if (RESERVED_HANDLES.has(base.toLowerCase())) base = base + "_";
  return base;
}

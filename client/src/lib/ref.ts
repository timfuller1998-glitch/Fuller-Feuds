// Source tracking + invite links (founding members, Nov 20 2026).
// ?ref=debatecraft on any page is remembered for 30 days and sent with applications and sign-ups.
// ?invite=FF-XXXX-XXXX opens Create Account with the code filled in.
const REF_KEY = "ff_ref";
const INVITE_KEY = "ff_invite";
const DAY = 24 * 60 * 60 * 1000;

function clean(v: string | null): string | null {
  const s = (v || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 80);
  return s || null;
}

/** Call once on app load. */
export function captureUrlParams(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = clean(params.get("ref"));
    if (ref) localStorage.setItem(REF_KEY, JSON.stringify({ ref, at: Date.now() }));
    const invite = (params.get("invite") || "").trim().toUpperCase();
    if (invite) sessionStorage.setItem(INVITE_KEY, invite);
  } catch {
    /* storage blocked: tracking is best-effort */
  }
}

export function getRef(): string | null {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const { ref, at } = JSON.parse(raw);
    if (!ref || Date.now() - Number(at) > 30 * DAY) return null;
    return String(ref);
  } catch {
    return null;
  }
}

export function getPendingInvite(): string | null {
  try { return sessionStorage.getItem(INVITE_KEY); } catch { return null; }
}
export function clearPendingInvite(): void {
  try { sessionStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
}

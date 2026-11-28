/** Collect, normalize, and rank reference links from opinions. */

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
/** Bare domains and www. hosts in running text (not emails, not already captured as http). */
const BARE_RE = /(?<![/@\w.-])(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi;
export const MAX_OPINION_LINKS = 5;

export type ResourceOpinionInput = {
  content?: string | null;
  references?: string[] | null;
  likesCount?: number | null;
  dislikesCount?: number | null;
};

export type RankedResource = {
  url: string;
  domain: string;
  faviconUrl: string;
  citationCount: number;
  likes: number;
  dislikes: number;
  likeRatio: number;
};

/** Accept a full URL or a bare domain like example.com by adding https://. */
export function coerceHttpUrl(raw: string): string | null {
  const trimmed = trimUrlCandidate(String(raw || "").trim());
  if (!trimmed) return null;
  if (/^(javascript|data|file|vbscript|blob):/i.test(trimmed)) return null;
  const withScheme = /^(https?:\/\/)/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
  const url = isSafeHttpUrl(withScheme);
  if (!url) return null;
  if (!url.hostname.includes(".")) return null;
  return normalizeHttpUrl(url.toString());
}

/** Dedupe and coerce up to `limit` user-supplied source links. */
export function normalizeReferences(raw: unknown, limit = MAX_OPINION_LINKS): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const normalized = coerceHttpUrl(String(item ?? ""));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

export function isSafeHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return null;
  if (host === "metadata.google.internal") return null;
  return url;
}

/** Strip tracking params and trailing punctuation so the same page groups together. */
export function normalizeHttpUrl(raw: string): string | null {
  const url = isSafeHttpUrl(raw);
  if (!url) return null;
  url.hash = "";
  const drop = [...url.searchParams.keys()].filter((k) => /^utm_/i.test(k) || k === "fbclid" || k === "gclid" || k === "mc_cid" || k === "mc_eid");
  for (const k of drop) url.searchParams.delete(k);
  let href = url.toString();
  if (url.pathname === "/" && !url.search) {
    href = `${url.protocol}//${url.host}`;
  } else if (href.endsWith("/")) {
    href = href.slice(0, -1);
  }
  return href;
}

function trimUrlCandidate(raw: string): string {
  return raw.replace(/[).,;:'"!?]+$/g, "");
}

export function extractHttpUrls(...parts: Array<string | string[] | null | undefined>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const normalized = coerceHttpUrl(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    found.push(normalized);
  };
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      for (const item of part) add(String(item));
      continue;
    }
    const text = String(part);
    for (const match of text.match(URL_RE) || []) add(match);
    for (const match of text.match(BARE_RE) || []) add(match);
  }
  return found;
}

export function resourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconForUrl(url: string): string {
  const domain = resourceDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function aggregateTopicResources(opinions: ResourceOpinionInput[]): RankedResource[] {
  const groups = new Map<string, { likes: number; dislikes: number; citations: number }>();
  for (const opinion of opinions) {
    const urls = extractHttpUrls(opinion.content, opinion.references);
    if (!urls.length) continue;
    const likes = Number(opinion.likesCount) || 0;
    const dislikes = Number(opinion.dislikesCount) || 0;
    for (const url of urls) {
      const current = groups.get(url) || { likes: 0, dislikes: 0, citations: 0 };
      current.citations += 1;
      current.likes += likes;
      current.dislikes += dislikes;
      groups.set(url, current);
    }
  }
  const rows: RankedResource[] = [];
  for (const [url, stats] of groups) {
    const totalVotes = stats.likes + stats.dislikes;
    rows.push({
      url,
      domain: resourceDomain(url),
      faviconUrl: faviconForUrl(url),
      citationCount: stats.citations,
      likes: stats.likes,
      dislikes: stats.dislikes,
      likeRatio: totalVotes > 0 ? stats.likes / totalVotes : 0,
    });
  }
  rows.sort((a, b) => {
    if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
    if (b.likeRatio !== a.likeRatio) return b.likeRatio - a.likeRatio;
    return a.domain.localeCompare(b.domain);
  });
  return rows;
}

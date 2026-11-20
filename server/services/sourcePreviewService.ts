import dns from 'node:dns/promises';
import net from 'node:net';
import OpenAI from 'openai';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'FullerFeudsBot/1.0 (source preview; +https://www.fullerfeuds.com)';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export class UnsafeUrlError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || a === 255) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const n = ip.toLowerCase();
    if (n === '::1' || n === '::') return true;
    if (n.startsWith('fe80:') || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('ff')) return true;
    if (n.startsWith('::ffff:')) return isPrivateIp(n.slice('::ffff:'.length));
    return false;
  }
  return true;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError('That does not look like a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https links are allowed.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Links with a username or password are not allowed.');
  }
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') {
    throw new UnsafeUrlError('That link cannot be loaded.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError('That link cannot be loaded.');
    return url;
  }
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("Couldn't look up that link.");
  }
  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw new UnsafeUrlError('That link cannot be loaded.');
  }
  return url;
}

async function fetchPublic(url: URL, accept?: string): Promise<{ finalUrl: string; contentType: string; body: string }> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    current = await assertPublicHttpUrl(current.toString());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept || 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('That page took too long to respond.');
      throw new Error("Couldn't load that link.");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error("Couldn't load that link.");
      current = new URL(loc, current);
      continue;
    }

    if (!res.ok) {
      throw new Error(`The page returned ${res.status}.`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    const body = buf.subarray(0, MAX_BYTES).toString('utf8');
    return { finalUrl: current.toString(), contentType, body };
  }
  throw new Error('Too many redirects.');
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decode(m[1]);
  }
  return null;
}

function parseHtml(html: string): { title: string; description: string } {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const title = meta(html, 'og:title') || meta(html, 'twitter:title') || (titleTag ? decode(titleTag) : '') || '';
  const description = meta(html, 'og:description') || meta(html, 'twitter:description') || meta(html, 'description') || '';
  return { title, description };
}

function isYouTube(url: URL): boolean {
  const h = url.hostname.replace(/^www\./, '');
  return h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be' || h === 'youtube-nocookie.com';
}

function isX(url: URL): boolean {
  const h = url.hostname.replace(/^www\./, '');
  return h === 'x.com' || h === 'twitter.com' || h === 'mobile.twitter.com';
}

async function oEmbed(endpoint: string, pageUrl: string): Promise<{ title: string; description: string } | null> {
  try {
    const target = await assertPublicHttpUrl(`${endpoint}?url=${encodeURIComponent(pageUrl)}&format=json`);
    const { body, contentType } = await fetchPublic(target, 'application/json');
    if (!contentType.includes('json') && !body.trim().startsWith('{')) return null;
    const data = JSON.parse(body);
    const title = decode(String(data.title || data.author_name || ''));
    const description = decode(String(data.author_name && data.title ? `${data.author_name}: ${data.title}` : data.html ? '' : ''));
    return title || description ? { title, description } : null;
  } catch {
    return null;
  }
}

async function draftWithAi(sourceUrl: string, pageTitle: string, pageDescription: string): Promise<{ title: string; description: string } | null> {
  if (!openai) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You write neutral debate-topic titles and short descriptions. Do not take a side or endorse the source. Respond with JSON only.',
        },
        {
          role: 'user',
          content: `Source URL: ${sourceUrl}\nExtracted title: ${pageTitle || '(none)'}\nExtracted description: ${pageDescription || '(none)'}\n\nReturn JSON: {"title":"A concise debate topic title","description":"2-3 sentences that neutrally frame what is being debated, mentioning the source type if useful."}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const title = String(parsed.title || '').trim();
    const description = String(parsed.description || '').trim();
    if (!title && !description) return null;
    return { title, description };
  } catch (error) {
    console.error('[Source preview] OpenAI draft failed:', error);
    return null;
  }
}

export type SourcePreview = {
  url: string;
  pageTitle: string;
  pageDescription: string;
  draftTitle: string;
  draftDescription: string;
  warning?: string;
};

export async function previewSource(rawUrl: string): Promise<SourcePreview> {
  const url = await assertPublicHttpUrl(rawUrl);
  let pageTitle = '';
  let pageDescription = '';
  let warning: string | undefined;

  try {
    if (isYouTube(url)) {
      const oem = await oEmbed('https://www.youtube.com/oembed', url.toString());
      if (oem) {
        pageTitle = oem.title;
        pageDescription = oem.description;
      }
    } else if (isX(url)) {
      const oem = await oEmbed('https://publish.twitter.com/oembed', url.toString());
      if (oem) {
        pageTitle = oem.title;
        pageDescription = oem.description;
      }
    }

    if (!pageTitle) {
      const { body, contentType } = await fetchPublic(url);
      if (contentType.includes('text/html') || body.includes('<title') || body.includes('og:title')) {
        const parsed = parseHtml(body);
        pageTitle = pageTitle || parsed.title;
        pageDescription = pageDescription || parsed.description;
      } else if (!pageTitle) {
        warning = "Couldn't read a title from that page. You can still add the link and write the topic yourself.";
      }
    }
  } catch (error: any) {
    warning = error?.message || "Couldn't load that link. You can still add it and write the title yourself.";
  }

  const draft = await draftWithAi(url.toString(), pageTitle, pageDescription);
  const draftTitle = draft?.title || pageTitle;
  const draftDescription = draft?.description || pageDescription;

  if (!draftTitle && !draftDescription && !warning) {
    warning = "Couldn't draft a title from that link. You can still add it and write the topic yourself.";
  }

  return {
    url: url.toString(),
    pageTitle,
    pageDescription,
    draftTitle,
    draftDescription,
    warning,
  };
}

import type { Request } from 'express';

/** Visitor IP behind Cloudflare → Render. Cloudflare sets cf-connecting-ip; fall back to Express's req.ip. */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  const v = Array.isArray(cf) ? cf[0] : cf;
  return (v && String(v).trim()) || req.ip || 'unknown';
}

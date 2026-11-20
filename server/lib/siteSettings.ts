import { sql } from 'drizzle-orm';
import { db } from '../db.js';

// Site-wide switches stored in site_settings (migration 0016). Cached briefly so every sign-up and page
// load doesn't hit the database; writes clear the cache on this instance.
export type SiteConfig = { foundingMode: boolean; publicLaunch: boolean };
const DEFAULTS: SiteConfig = { foundingMode: true, publicLaunch: false };
const KEYS: Record<keyof SiteConfig, string> = { foundingMode: 'founding_mode', publicLaunch: 'public_launch' };

let cache: { at: number; value: SiteConfig } | null = null;
const TTL_MS = 10_000;

export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = { ...DEFAULTS };
  try {
    const res: any = await db.execute(sql`select key, value from site_settings`);
    for (const row of (res.rows ?? res) as Array<{ key: string; value: unknown }>) {
      for (const [field, key] of Object.entries(KEYS) as Array<[keyof SiteConfig, string]>) {
        if (row.key === key) value[field] = row.value === true || row.value === 'true';
      }
    }
  } catch (e) {
    // Table missing (migration not applied yet): fall back to defaults (invite-only, not launched).
    console.error('[site-settings] read failed, using defaults:', (e as Error).message);
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function setSiteSetting(field: keyof SiteConfig, on: boolean, userId: string): Promise<SiteConfig> {
  const key = KEYS[field];
  await db.execute(sql`
    insert into site_settings (key, value, updated_by_id, updated_at)
    values (${key}, ${JSON.stringify(on)}::jsonb, ${userId}, now())
    on conflict (key) do update set value = excluded.value, updated_by_id = excluded.updated_by_id, updated_at = now()
  `);
  cache = null;
  return getSiteConfig();
}

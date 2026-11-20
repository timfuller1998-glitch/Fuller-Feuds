import { randomInt } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { FOUNDER_CAP, FOUNDER_INVITE_CODES, FOUNDING_BADGE_ID, PASS_PREMIUM_MONTHS, PASS_PREMIUM_TIER } from '../../shared/founders.js';

// Single-use invite codes and founder perks (Fuller Feuds Dev, Nov 20 2026).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function generateCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `FF-${part()}-${part()}`;
}
export function normalizeCode(input: unknown): string {
  return String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export type InviteKind = 'admin' | 'acceptance' | 'founder';
export interface InviteRow {
  id: string;
  code: string;
  kind: InviteKind;
  created_by_id: string | null;
  owner_user_id: string | null;
  application_id: string | null;
  note: string | null;
  used_by_user_id: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const rows = (r: any) => (r.rows ?? r) as any[];

export async function createInviteCode(opts: {
  kind: InviteKind; createdById?: string | null; ownerUserId?: string | null; applicationId?: string | null; note?: string | null;
}): Promise<InviteRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const r = await db.execute(sql`
        insert into invite_codes (code, kind, created_by_id, owner_user_id, application_id, note)
        values (${code}, ${opts.kind}, ${opts.createdById ?? null}, ${opts.ownerUserId ?? null}, ${opts.applicationId ?? null}, ${opts.note ?? null})
        returning *`);
      return rows(r)[0] as InviteRow;
    } catch (e: any) {
      if (String(e?.code) !== '23505') throw e; // retry only on a code collision
    }
  }
  throw new Error('Could not generate a unique invite code');
}

/** Atomically reserves an unused, unrevoked code. Returns null when it's invalid or already used. */
export async function claimInviteCode(code: string): Promise<InviteRow | null> {
  if (!code) return null;
  const r = await db.execute(sql`
    update invite_codes set used_at = now()
    where code = ${code} and used_at is null and revoked_at is null
    returning *`);
  return (rows(r)[0] as InviteRow) ?? null;
}
export async function releaseInviteCode(id: string): Promise<void> {
  await db.execute(sql`update invite_codes set used_at = null, used_by_user_id = null where id = ${id}`);
}
export async function lookupInviteCode(code: string): Promise<InviteRow | null> {
  if (!code) return null;
  const r = await db.execute(sql`select * from invite_codes where code = ${code} limit 1`);
  return (rows(r)[0] as InviteRow) ?? null;
}

/**
 * Links a new account to the code it used. A founder's launch pass gives 1 year of premium (no founder number).
 * An admin/acceptance code, while founding mode is on, makes the account a numbered founder:
 * Founding Member badge, lifetime ad-free stored (active only after public launch), and FOUNDER_INVITE_CODES
 * codes of its own when it was admitted by an admin (application acceptance or an admin-issued code).
 */
export async function finalizeInvitedSignup(userId: string, invite: InviteRow, opts: { foundingMode: boolean }) {
  const invitedBy = invite.owner_user_id ?? invite.created_by_id ?? null;
  await db.execute(sql`
    update invite_codes set used_by_user_id = ${userId}, used_at = coalesce(used_at, now()) where id = ${invite.id}`);
  // Source tracking: if this browser had no ?ref=, inherit the ref from the application the code came from.
  await db.execute(sql`
    update users set invited_by_user_id = ${invitedBy}, invite_code_id = ${invite.id}, updated_at = now(),
      signup_ref = coalesce(signup_ref, (select ref_source from founder_applications where id = ${invite.application_id}))
    where id = ${userId}`);
  // Launch passes (a founder's codes): never a numbered founder and no codes of their own; they get
  // PASS_PREMIUM_MONTHS of premium (ad-free on). The sign-up route only lets passes through after public launch.
  if (invite.kind === 'founder') {
    const r = await db.execute(sql`
      update users set subscription_tier = ${PASS_PREMIUM_TIER},
        subscription_expires_at = now() + make_interval(months => ${PASS_PREMIUM_MONTHS}::int),
        ad_free = true, updated_at = now()
      where id = ${userId}
      returning subscription_expires_at`);
    const until = rows(r)[0]?.subscription_expires_at ?? null;
    return { founderNumber: null as number | null, codes: [] as string[], premiumUntil: until ? new Date(until).toISOString() : null };
  }
  if (!opts.foundingMode) return { founderNumber: null as number | null, codes: [] as string[], premiumUntil: null as string | null };

  let founderNumber: number | null = null;
  for (let attempt = 0; attempt < 5 && founderNumber === null; attempt++) {
    try {
      const r = await db.execute(sql`
        update users set
          founder_number = (select coalesce(max(founder_number), 0) + 1 from users),
          founder_lifetime_ad_free = true
        where id = ${userId} and founder_number is null
          and (select coalesce(max(founder_number), 0) from users) < ${FOUNDER_CAP}
        returning founder_number`);
      const row = rows(r)[0];
      if (!row) break; // cap reached (or already numbered)
      founderNumber = Number(row.founder_number);
    } catch (e: any) {
      if (String(e?.code) !== '23505') throw e; // two sign-ups raced for the same number; retry
    }
  }
  if (founderNumber === null) return { founderNumber: null, codes: [], premiumUntil: null };

  await db.execute(sql`
    insert into user_badges (user_id, badge_id) values (${userId}, ${FOUNDING_BADGE_ID}) on conflict do nothing`);

  const codes: string[] = [];
  if (invite.kind === 'acceptance' || invite.kind === 'admin') {
    for (let i = 0; i < FOUNDER_INVITE_CODES; i++) {
      const c = await createInviteCode({ kind: 'founder', ownerUserId: userId, createdById: userId, note: `Founder #${founderNumber}` });
      codes.push(c.code);
    }
  }
  return { founderNumber, codes, premiumUntil: null as string | null };
}

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { handleBaseFrom, normalizeHandleInput, validateHandle, RESERVED_HANDLES } from "../../shared/handle.js";

/** True when another user already has this handle (case-insensitive). */
export async function isHandleTaken(handle: string, exceptUserId?: string): Promise<boolean> {
  const h = normalizeHandleInput(handle).toLowerCase();
  const r: any = await db.execute(
    sql`select 1 from users where lower(handle) = ${h} ${exceptUserId ? sql`and id <> ${exceptUserId}` : sql``} limit 1`,
  );
  return ((r.rows ?? r) as any[]).length > 0;
}

/** First free handle of the form base, base2, base3... */
export async function uniqueHandleFrom(base: string, exceptUserId?: string): Promise<string> {
  const b = handleBaseFrom(base);
  for (let n = 1; n < 10000; n++) {
    const cand = n === 1 ? b : `${b}${n}`;
    if (RESERVED_HANDLES.has(cand.toLowerCase())) continue;
    if (!(await isHandleTaken(cand, exceptUserId))) return cand;
  }
  return `${b.slice(0, 10)}${Date.now() % 1e9}`.slice(0, 20);
}

export type HandleCheck = { handle: string; valid: boolean; available: boolean; reason?: string; suggestion?: string };

/** Validate + availability, with a free suggestion when the requested one can't be used. */
export async function checkHandle(raw: string, exceptUserId?: string): Promise<HandleCheck> {
  const handle = normalizeHandleInput(raw);
  const err = validateHandle(handle);
  if (err) return { handle, valid: false, available: false, reason: err, suggestion: handle ? await uniqueHandleFrom(handle, exceptUserId) : undefined };
  if (await isHandleTaken(handle, exceptUserId)) {
    return { handle, valid: true, available: false, reason: "That handle is taken", suggestion: await uniqueHandleFrom(handle, exceptUserId) };
  }
  return { handle, valid: true, available: true };
}

/** Postgres unique-violation on the handle index (race between check and write). */
export const isHandleConflict = (e: any) => e?.code === "23505" && String(e?.constraint ?? e?.message ?? "").includes("handle");

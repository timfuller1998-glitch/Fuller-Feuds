/**
 * Parse a timestamp from the API as UTC. The DB stores `timestamp without time zone` in UTC; most API values are
 * ISO strings with "Z", but raw-SQL paths can return "2026-11-03 14:16:47.72" (no zone, which browsers read as
 * local time, i.e. 6 hours off in Central) or "...+00" (Safari can't parse). Normalize all of them to UTC.
 */
export function parseServerDate(value: string | number | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (!value) return new Date(NaN);
  let s = String(value).trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s += ":00"; // "+00" -> "+00:00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += "Z"; // no zone -> UTC
  return new Date(s);
}

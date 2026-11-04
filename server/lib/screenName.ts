import { sql } from "drizzle-orm";

/**
 * Screen names: a user's public name is the display name they set in Settings (user_profiles.display_first_name /
 * display_last_name). If they haven't set one, it's their first/last name. Never the raw user id.
 */
const hasScreenName = (id: unknown) =>
  sql`exists (select 1 from user_profiles sn where sn.user_id = ${id} and nullif(trim(sn.display_first_name), '') is not null)`;

/** SQL expression for the public first name; `id` and `first` are column refs or sql fragments. */
export const screenFirstNameSql = (id: unknown, first: unknown) =>
  sql<string | null>`coalesce((select nullif(trim(sn.display_first_name), '') from user_profiles sn where sn.user_id = ${id} limit 1), ${first})`;

/** SQL expression for the public last name (the display last name goes with a display first name, even if empty). */
export const screenLastNameSql = (id: unknown, last: unknown) =>
  sql<string | null>`(case when ${hasScreenName(id)} then (select sn.display_last_name from user_profiles sn where sn.user_id = ${id} limit 1) else ${last} end)`;

/** Same rule for rows already loaded in JS. */
export function screenName(
  user: { firstName?: string | null; lastName?: string | null },
  profile?: { displayFirstName?: string | null; displayLastName?: string | null } | null,
): { firstName: string | null; lastName: string | null } {
  const df = profile?.displayFirstName?.trim();
  if (df) return { firstName: df, lastName: profile?.displayLastName?.trim() || null };
  return { firstName: user.firstName ?? null, lastName: user.lastName ?? null };
}

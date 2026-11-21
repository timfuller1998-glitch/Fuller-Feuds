import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getBadgeIcon } from "@/lib/badgeIcons";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";

// People search (Fuller Feuds Dev, Nov 20 2026): public fields only (name, @handle, avatar,
// top badge, follower count) from GET /api/users/search.
export interface PersonResult {
  id: string;
  handle: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  followerCount: number;
  topBadge: { name: string; icon: string; tier: number } | null;
}

export function personName(p: PersonResult) {
  return `${p.firstName || ""} ${p.lastName || ""}`.trim() || (p.handle ? `@${p.handle}` : "Member");
}

export function useUserSearch(q: string, limit = 8) {
  const term = q.trim();
  return useQuery<PersonResult[]>({
    queryKey: ["/api/users/search", { q: term, limit }],
    queryFn: async () => {
      if (term.replace(/^@/, "").length < 2) return [];
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&limit=${limit}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: term.replace(/^@/, "").length >= 2,
    staleTime: 30_000,
  });
}

/** One person row: avatar, name, @handle, top badge, followers. The whole row is a profile link. */
export function PersonRow({ p, compact = false, onNavigate }: { p: PersonResult; compact?: boolean; onNavigate?: () => void }) {
  const name = personName(p);
  const Icon = p.topBadge ? getBadgeIcon(p.topBadge.icon) : null;
  return (
    <Link
      href={`/profile/${p.id}`}
      onClick={onNavigate}
      className={`flex w-full items-center gap-3 rounded-lg hover-elevate active-elevate-2 ${compact ? "px-2 py-1.5" : "border bg-card p-3"}`}
      data-testid={`person-result-${p.id}`}
    >
      <Avatar className={compact ? "h-8 w-8" : "h-11 w-11"}>
        {p.profileImageUrl ? <AvatarImage src={p.profileImageUrl} alt={name} /> : null}
        <AvatarFallback className="text-xs">{(name.replace(/^@/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className={`flex min-w-0 items-center gap-1 font-semibold leading-tight text-foreground ${compact ? "text-sm" : ""}`}>
          <span className="truncate">{name}</span>
          {compact && p.topBadge && Icon && (
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-label={p.topBadge.name} data-testid={`person-badge-${p.id}`} />
          )}
        </span>
        {compact ? (
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {p.handle ? `@${p.handle} · ` : ""}
            {p.followerCount.toLocaleString("en-US")} {p.followerCount === 1 ? "follower" : "followers"}
          </span>
        ) : (
          <UserHandle handle={p.handle} />
        )}
      </span>
      {!compact && (
        <span className="flex flex-shrink-0 flex-col items-end gap-0.5 text-right">
          {p.topBadge && Icon && (
            <span
              className="font-ui inline-flex max-w-[9.5rem] items-center gap-1 truncate rounded-full border border-primary/25 px-1.5 py-0.5 text-[0.62rem] text-primary"
              title={p.topBadge.name}
              data-testid={`person-badge-${p.id}`}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{p.topBadge.name}</span>
            </span>
          )}
          <span className="font-ui inline-flex items-center gap-1 text-[0.68rem] text-muted-foreground" data-testid={`person-followers-${p.id}`}>
            <Users className="h-3 w-3" />
            {p.followerCount.toLocaleString("en-US")} {p.followerCount === 1 ? "follower" : "followers"}
          </span>
        </span>
      )}
    </Link>
  );
}

import { useQuery } from "@tanstack/react-query";
import { UserHandle } from "@/components/UserHandle";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, Heart, Activity, Users, Lightbulb, Star } from "lucide-react";

export interface LeaderboardEntry {
  userId: string;
  firstName?: string | null;
  handle?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  value: number;
  rank: number;
}
export interface LeaderboardCategory {
  id: string;
  title: string;
  unit: string;
  description: string;
  totalRanked: number;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}
export interface LeaderboardsResponse {
  userId: string | null;
  categories: LeaderboardCategory[];
}

const ICONS: Record<string, typeof Heart> = { mostLiked: Heart, mostActive: Activity, topRatedDebaters: Star, mostFollowers: Users, topCreators: Lightbulb };
const SHORT: Record<string, string> = { mostLiked: "Liked", mostActive: "Active", topRatedDebaters: "Rated", mostFollowers: "Followers", topCreators: "Creators" };

export function useLeaderboards(userId: string | undefined, enabled = true) {
  return useQuery<LeaderboardsResponse>({
    queryKey: ["/api/leaderboards", userId],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboards?limit=10${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load leaderboards");
      return res.json();
    },
    enabled: !!userId && enabled,
    staleTime: 60_000,
  });
}

/** Best (lowest) rank across categories, for the profile's Rankings button. */
export function bestRank(data?: LeaderboardsResponse) {
  const ranked = (data?.categories ?? []).filter((c) => c.me);
  if (!ranked.length) return null;
  return ranked.reduce((best, c) => (c.me!.rank < best.me!.rank ? c : best));
}

const medal = (rank: number) =>
  rank === 1 ? "bg-gold text-primary-foreground" : rank === 2 ? "bg-silver text-primary-foreground" : rank === 3 ? "bg-bronze text-primary-foreground" : "bg-muted text-muted-foreground";

function Row({ e, unit, highlight, onOpen }: { e: LeaderboardEntry; unit: string; highlight: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left bg-card hover-elevate ${highlight ? "ring-2 ring-primary bg-primary/5" : ""}`}
      data-testid={`leaderboard-row-${e.userId}`}
    >
      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${medal(e.rank)}`}>{e.rank}</span>
      <Avatar className="w-8 h-8">
        <AvatarImage src={e.profileImageUrl ?? undefined} />
        <AvatarFallback className="text-xs">{e.firstName?.charAt(0)}{e.lastName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">{e.firstName} {e.lastName}</span>
        <UserHandle handle={e.handle} />
      </span>
      <span className="text-sm font-semibold tabular-nums">{e.value}</span>
      <span className="text-xs text-muted-foreground w-[4.5rem] truncate">{unit}</span>
    </button>
  );
}

export default function LeaderboardsDialog({
  open, onOpenChange, userId, displayName, isOwnProfile,
}: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; displayName: string; isOwnProfile: boolean }) {
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useLeaderboards(userId, open);
  const who = isOwnProfile ? "You" : displayName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6" data-testid="dialog-leaderboards">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />Rankings</DialogTitle>
          <DialogDescription>Top 10 across Fuller Feuds. {who === "You" ? "Your" : `${displayName}'s`} position is highlighted.</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading rankings…</p>}
        {isError && <p className="py-8 text-center text-sm text-destructive">Couldn't load rankings.</p>}
        {data && (
          <Tabs defaultValue={data.categories[0]?.id}>
            <TabsList className={`grid w-full h-auto ${data.categories.length >= 5 ? "grid-cols-5" : data.categories.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
              {data.categories.map((c) => {
                const Icon = ICONS[c.id] ?? BarChart3;
                return (
                  <TabsTrigger key={c.id} value={c.id} className="flex flex-col gap-0.5 py-1.5 text-xs" data-testid={`tab-${c.id}`}>
                    <Icon className="w-4 h-4" />{SHORT[c.id] ?? c.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {data.categories.map((c) => (
              <TabsContent key={c.id} value={c.id} className="space-y-3 mt-3">
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.description} · {c.totalRanked} ranked</p>
                </div>
                <div className={`rounded-lg border p-3 text-sm ${c.me ? "bg-primary/5" : "bg-muted/40"}`} data-testid={`my-rank-${c.id}`}>
                  {c.me
                    ? <>{who} {isOwnProfile ? "are" : "is"} <span className="font-bold">#{c.me.rank}</span> of {c.totalRanked} with <span className="font-semibold">{c.me.value} {c.unit}</span></>
                    : <>{who} {isOwnProfile ? "aren't" : "isn't"} ranked here yet.</>}
                </div>
                {c.entries.length === 0
                  ? <p className="py-6 text-center text-sm text-muted-foreground">No one is ranked yet.</p>
                  : <div className="space-y-2">
                      {c.entries.map((e) => (
                        <Row key={e.userId} e={e} unit={c.unit} highlight={e.userId === userId}
                          onOpen={() => { onOpenChange(false); navigate(`/profile/${e.userId}`); }} />
                      ))}
                      {c.me && !c.entries.some((e) => e.userId === c.me!.userId) && (
                        <>
                          <div className="text-center text-xs text-muted-foreground">…</div>
                          <Row e={c.me} unit={c.unit} highlight onOpen={() => onOpenChange(false)} />
                        </>
                      )}
                    </div>}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

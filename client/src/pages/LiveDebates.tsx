import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Radio, Eye, BookOpen, MessageSquare, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { parseServerDate } from "@/lib/dates";
import { stanceLabel, type Stance } from "@/lib/stance";

/** One public debate, from GET /api/debates/live or /api/debates/finished. */
type PublicDebate = {
  id: string; topicId: string; topicTitle: string; status: string; phase: string;
  participant1Id: string; participant1Name: string; participant1Avatar: string | null; participant1Stance: string | null;
  participant2Id: string; participant2Name: string; participant2Avatar: string | null; participant2Stance: string | null;
  messageCount: number; startedAt: string | null; lastActivityAt: string | null; endedAt: string | null;
  isShowcase?: boolean;
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - parseServerDate(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Side({ name, avatar, stance, align }: { name: string; avatar: string | null; stance: string | null; align: "left" | "right" }) {
  const label = stance && stanceLabel[stance as Stance];
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <Avatar className="h-9 w-9 shrink-0">
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-serif font-semibold truncate">{name}</div>
        {label ? <div className="font-ui text-[0.65rem] uppercase tracking-[0.1em] text-[hsl(var(--gold))]">{label}</div> : null}
      </div>
    </div>
  );
}

function DebateRow({ d, live }: { d: PublicDebate; live: boolean }) {
  return (
    <Card className={d.isShowcase ? "border-[hsl(var(--gold))] border-2" : "border-foreground/20"} data-testid={`${live ? "live" : "finished"}-debate-${d.id}`}>
      <CardContent className="p-4 space-y-3">
        {d.isShowcase ? (
          <div className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--gold))] flex items-center gap-1.5" data-testid={`badge-showcase-${d.id}`}>
            <Star className="w-3.5 h-3.5" /> Saturday Showcase
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/topic/${d.topicId}`} className="font-serif text-lg font-bold leading-snug hover:underline">
            {d.topicTitle}
          </Link>
          {live ? (
            <Badge className="shrink-0 gap-1 bg-primary text-primary-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" /> {d.phase === "voting" ? "Rating" : "Live"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">Finished</Badge>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Side name={d.participant1Name} avatar={d.participant1Avatar} stance={d.participant1Stance} align="left" />
          <span className="font-ui text-xs font-bold tracking-[0.15em] text-primary">VS</span>
          <Side name={d.participant2Name} avatar={d.participant2Avatar} stance={d.participant2Stance} align="right" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> {d.messageCount} {d.messageCount === 1 ? "message" : "messages"}
            <span aria-hidden>·</span> {live ? `active ${ago(d.lastActivityAt)}` : `ended ${ago(d.endedAt)}`}
          </span>
          <Link href={`/debate-room/${d.id}`}>
            <Button size="sm" variant={live ? "default" : "outline"} data-testid={`button-${live ? "watch" : "read"}-${d.id}`}>
              {live ? <><Eye className="w-4 h-4 mr-1.5" /> Watch</> : <><BookOpen className="w-4 h-4 mr-1.5" /> Read</>}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveDebates() {
  // Refreshes on its own every 15s; debate updates over the socket also refresh it.
  const live = useQuery<PublicDebate[]>({ queryKey: ["/api/debates/live"], refetchInterval: 15000, staleTime: 5000 });
  const finished = useQuery<PublicDebate[]>({ queryKey: ["/api/debates/finished"], refetchInterval: 60000, staleTime: 30000 });

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="page-live-debates">
      <header className="text-center space-y-2 border-b-[3px] border-double border-foreground pb-4">
        <div className="font-ui text-xs uppercase tracking-[0.2em] text-[hsl(var(--gold))] flex items-center justify-center gap-2">
          <Radio className="w-4 h-4" /> On the floor now
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold" data-testid="heading-live-debates">Live Debates</h1>
        <p className="text-sm text-muted-foreground">Watch two people go at it, turn by turn. Messages appear as they're sent.</p>
      </header>

      <section className="space-y-3" aria-labelledby="live-now">
        <h2 id="live-now" className="font-ui text-xs uppercase tracking-[0.15em] text-muted-foreground">Happening now</h2>
        {live.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : live.isError ? (
          <p className="text-sm text-destructive">Couldn't load live debates. Try again in a moment.</p>
        ) : (live.data?.length ?? 0) === 0 ? (
          <Card className="border-dashed" data-testid="empty-live">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No debates are running right now. Open any opinion card, flip it, and tap <span className="font-semibold text-foreground">Challenge to a debate</span> to start one.
            </CardContent>
          </Card>
        ) : (
          live.data!.map((d) => <DebateRow key={d.id} d={d} live />)
        )}
      </section>

      <section className="space-y-3" aria-labelledby="finished">
        <h2 id="finished" className="font-ui text-xs uppercase tracking-[0.15em] text-muted-foreground">Recently finished</h2>
        {finished.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (finished.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="empty-finished">Nothing finished yet.</p>
        ) : (
          finished.data!.map((d) => <DebateRow key={d.id} d={d} live={false} />)
        )}
      </section>
    </div>
  );
}

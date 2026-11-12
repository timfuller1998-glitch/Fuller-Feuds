import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, MessageSquareQuote, Swords } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { splitIntoParagraphs } from "@/lib/textSegments";
import { formatDistanceToNow } from "date-fns";

type Person = { id: string; firstName?: string | null; lastName?: string | null; handle?: string | null; profileImageUrl?: string | null };
type Counterpoint = { id: string; sentenceIndex: number; content: string; createdAt: string; author: Person | null; likeCount: number; likedByMe: boolean };

const nameOf = (p?: Person | null) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || (p.handle ? `@${p.handle}` : "Anonymous") : "Anonymous");

function PersonLine({ p, sub }: { p?: Person | null; sub?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={p?.profileImageUrl ?? undefined} />
        <AvatarFallback className="text-xs">{nameOf(p).charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{nameOf(p)}</span>
        <UserHandle handle={p?.handle} />
      </span>
      {sub && <span className="ml-auto text-xs text-muted-foreground shrink-0">{sub}</span>}
    </div>
  );
}

/** Full counterpoints page for one opinion: every paragraph with its counterpoints, likes, replies and debate starts. */
export default function CounterpointsPage() {
  const { id } = useParams<{ id: string }>();
  const focus = Number(new URLSearchParams(useSearch()).get("p") ?? "NaN");
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [openForm, setOpenForm] = useState<number | null>(null);

  const { data: opinion, isLoading, isError } = useQuery<any>({ queryKey: [`/api/opinions/${id}`], enabled: !!id });
  const { data: author } = useQuery<Person>({ queryKey: [`/api/users/${opinion?.userId}`], enabled: !!opinion?.userId });
  const { data: topic } = useQuery<any>({ queryKey: [`/api/topics/${opinion?.topicId}`], enabled: !!opinion?.topicId });
  const cpKey = ["/api/opinions", id, "counterpoints", "all"];
  const { data: counterpoints = [] } = useQuery<Counterpoint[]>({
    queryKey: cpKey,
    enabled: !!id,
    queryFn: async () => {
      const r = await fetch(`/api/opinions/${id}/counterpoints`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load counterpoints");
      return r.json();
    },
  });

  const paragraphs = useMemo(() => splitIntoParagraphs(opinion?.content || ""), [opinion?.content]);
  const byPara = useMemo(() => {
    const m = new Map<number, Counterpoint[]>();
    counterpoints.forEach((c) => m.set(c.sentenceIndex, [...(m.get(c.sentenceIndex) || []), c]));
    return m;
  }, [counterpoints]);
  const isAuthor = !!user && opinion?.userId === user.id;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: cpKey });
    queryClient.invalidateQueries({ queryKey: ["/api/opinions", id, "counterpoint-counts"] });
  };
  const like = useMutation({
    mutationFn: ({ cpId, like }: { cpId: string; like: boolean }) => apiRequest("POST", `/api/counterpoints/${cpId}/like`, { like }),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: ({ idx }: { idx: number }) => apiRequest("POST", `/api/opinions/${id}/counterpoints`, {
      sentenceIndex: idx, content: (drafts[idx] || "").trim(), paragraphText: paragraphs[idx]?.text,
    }),
    onSuccess: (_d, { idx }) => { setDrafts((d) => ({ ...d, [idx]: "" })); setOpenForm(null); refresh(); toast({ title: "Counterpoint added" }); },
    onError: (e: any) => toast({ title: "Couldn't add counterpoint", description: String(e?.message || "").replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const debate = useMutation({
    mutationFn: async (cp: Counterpoint) => (await apiRequest("POST", `/api/counterpoints/${cp.id}/start-debate`, { opponentUserId: cp.author!.id })).json(),
    onSuccess: (room: any) => room?.id && navigate(`/debate-room/${room.id}`),
    onError: () => toast({ title: "Couldn't start the debate", variant: "destructive" }),
  });

  if (isLoading) return <p className="py-12 text-center text-muted-foreground">Loading counterpoints…</p>;
  if (isError || !opinion) return <p className="py-12 text-center text-muted-foreground">This opinion isn't available.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24" data-testid="page-counterpoints">
      <div className="space-y-2">
        <Link href={`/topic/${opinion.topicId}`} className="inline-flex items-center gap-1 font-ui text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground" data-testid="link-back-topic">
          <ArrowLeft className="h-3.5 w-3.5" />{topic?.title || "Back to topic"}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><MessageSquareQuote className="h-6 w-6 text-primary" />Counterpoints</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1"><PersonLine p={author ? { ...author, id: opinion.userId } : null} /></div>
          {opinion.stance && <Badge variant="outline" className="uppercase">{opinion.stance}</Badge>}
          <span className="text-xs text-muted-foreground">{counterpoints.length} counterpoint{counterpoints.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {paragraphs.map((para) => {
        const list = byPara.get(para.index) || [];
        return (
          <section key={para.index} id={`p${para.index}`} className={`border-t-2 border-foreground pt-4 space-y-3 ${focus === para.index ? "scroll-mt-20" : ""}`} data-testid={`section-paragraph-${para.index}`}
            ref={(el) => { if (el && focus === para.index) setTimeout(() => el.scrollIntoView({ block: "start" }), 50); }}>
            <div className="flex items-start gap-3">
              <span className="font-ui text-xs text-muted-foreground pt-1 shrink-0">¶{para.index + 1}</span>
              <p className="text-base leading-relaxed whitespace-pre-wrap flex-1">{para.text}</p>
            </div>
            <div className="pl-6 space-y-2">
              {list.length === 0 && <p className="text-sm text-muted-foreground italic">No counterpoints on this paragraph yet.</p>}
              {list.map((cp) => (
                <Card key={cp.id} data-testid={`card-counterpoint-${cp.id}`}>
                  <CardContent className="p-3 space-y-2">
                    <PersonLine p={cp.author} sub={cp.createdAt ? formatDistanceToNow(new Date(cp.createdAt), { addSuffix: true }) : undefined} />
                    <p className="text-sm whitespace-pre-wrap">{cp.content}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant={cp.likedByMe ? "default" : "outline"} disabled={!isAuthenticated || like.isPending}
                        onClick={() => like.mutate({ cpId: cp.id, like: !cp.likedByMe })} data-testid={`button-like-counterpoint-${cp.id}`}>
                        <Heart className="h-3.5 w-3.5 mr-1" />{cp.likeCount}
                      </Button>
                      {isAuthor && cp.author && cp.author.id !== user?.id && (
                        <Button size="sm" variant="outline" disabled={debate.isPending} onClick={() => debate.mutate(cp)} data-testid={`button-debate-counterpoint-${cp.id}`}>
                          <Swords className="h-3.5 w-3.5 mr-1" />Debate {cp.author.handle ? `@${cp.author.handle}` : nameOf(cp.author)}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {isAuthenticated && !isAuthor && (openForm === para.index ? (
                <div className="space-y-2">
                  <Textarea rows={3} value={drafts[para.index] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [para.index]: e.target.value }))}
                    placeholder="Make your counterpoint to this paragraph…" data-testid={`input-counterpoint-${para.index}`} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!(drafts[para.index] || "").trim() || add.isPending} onClick={() => add.mutate({ idx: para.index })} data-testid={`button-submit-counterpoint-${para.index}`}>Post counterpoint</Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpenForm(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setOpenForm(para.index)} data-testid={`button-add-counterpoint-${para.index}`}>+ Add a counterpoint</Button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

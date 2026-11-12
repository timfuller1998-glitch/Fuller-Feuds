import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserHandle } from "@/components/UserHandle";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useDebateContext } from "@/contexts/DebateContext";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import type { Opponent } from "@/lib/opponentSides";
import { getOpinionStance } from "@/lib/stance";
import { splitIntoParagraphs } from "@/lib/textSegments";
import CardDeck from "@/components/CardDeck";
import { StanceChip, type Person } from "@/components/OpinionDeckCard";
import {
  CounterpointDeckFront,
  CounterpointDeckBack,
  type CounterpointCardItem,
} from "@/components/CounterpointDeckCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Opinion } from "@shared/schema";
import type { Stance } from "@/lib/stance";

type Counterpoint = CounterpointCardItem & { author: (Person & { id?: string }) | null };

const nameOf = (p?: Person | null) =>
  (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || (p.handle ? `@${p.handle}` : "Anonymous") : "Anonymous");

function ContextCard({
  author,
  stance,
  paragraphIndex,
  paragraphText,
  paragraphCount,
}: {
  author?: Person | null;
  stance?: Stance | null;
  paragraphIndex: number;
  paragraphText: string;
  paragraphCount: number;
}) {
  const name = nameOf(author);
  return (
    <article
      className="rounded-xl border bg-card shadow-sm deck-card-surface overflow-hidden px-3 py-2.5"
      data-testid="counterpoints-context"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={author?.profileImageUrl || undefined} alt={name} />
          <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-serif text-sm font-semibold truncate">{name}</span>
            {stance ? <StanceChip stance={stance} /> : null}
          </div>
          {author?.handle ? (
            <UserHandle handle={author.handle} className="text-xs text-muted-foreground" />
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 border-t border-foreground/15 pt-2.5">
        <p className="font-ui text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--gold))] mb-1">
          ¶{paragraphIndex + 1}
          {paragraphCount > 1 ? ` of ${paragraphCount}` : ""} of the original
        </p>
        <p className="font-serif text-sm leading-relaxed line-clamp-2 whitespace-pre-wrap">
          {paragraphText}
        </p>
      </div>
    </article>
  );
}

export default function CounterpointsPage() {
  const { id } = useParams<{ id: string }>();
  const focus = Number(new URLSearchParams(useSearch()).get("p") ?? "NaN");
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { openDebateWindow } = useDebateContext();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [filter, setFilter] = useState<"all" | number>(Number.isInteger(focus) ? focus : "all");
  const [topIndex, setTopIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [chromeReserve, setChromeReserve] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 768 ? 500 : 480,
  );
  useEffect(() => {
    const onResize = () => setChromeReserve(window.innerWidth >= 768 ? 500 : 480);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [draftPara, setDraftPara] = useState<number>(Number.isInteger(focus) ? focus : 0);
  const [draft, setDraft] = useState("");

  const { data: opinion, isLoading, isError } = useQuery<any>({ queryKey: [`/api/opinions/${id}`], enabled: !!id });
  const { data: author } = useQuery<Person>({ queryKey: [`/api/users/${opinion?.userId}`], enabled: !!opinion?.userId });
  const { data: topic } = useQuery<any>({ queryKey: [`/api/topics/${opinion?.topicId}`], enabled: !!opinion?.topicId });
  const { data: topicOpinions = [] } = useQuery<Opinion[]>({
    queryKey: [`/api/topics/${opinion?.topicId}/opinions`],
    enabled: !!opinion?.topicId,
    queryFn: async () => {
      const r = await fetch(`/api/topics/${opinion.topicId}/opinions`);
      if (!r.ok) throw new Error("Failed to load opinions");
      return r.json();
    },
  });
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
  const stanceByUser = useMemo(() => {
    const m = new Map<string, Stance>();
    for (const o of topicOpinions) {
      if (o.userId && (o.stance === "for" || o.stance === "against" || o.stance === "neutral")) {
        m.set(o.userId, o.stance);
      }
    }
    return m;
  }, [topicOpinions]);

  const sorted = useMemo(() => {
    return [...counterpoints].sort((a, b) => {
      if (a.sentenceIndex !== b.sentenceIndex) return a.sentenceIndex - b.sentenceIndex;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }, [counterpoints]);

  const visible = useMemo(() => {
    const list = filter === "all" ? sorted : sorted.filter((c) => c.sentenceIndex === filter);
    return list.map((c) => ({
      ...c,
      author: c.author || { firstName: null, lastName: null, handle: null, profileImageUrl: null },
      authorStance: c.authorUserId ? stanceByUser.get(c.authorUserId) ?? null : null,
    })) as CounterpointCardItem[];
  }, [sorted, filter, stanceByUser]);

  const countsByPara = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of counterpoints) m.set(c.sentenceIndex, (m.get(c.sentenceIndex) || 0) + 1);
    return m;
  }, [counterpoints]);

  const isAuthor = !!user && opinion?.userId === user.id;
  const top = visible[Math.min(topIndex, Math.max(visible.length - 1, 0))];
  const contextIndex =
    top?.sentenceIndex ??
    (filter !== "all" ? filter : Number.isInteger(focus) ? focus : 0);
  const contextText =
    paragraphs.find((p) => p.index === contextIndex)?.text ||
    paragraphs[0]?.text ||
    opinion?.content ||
    "";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: cpKey });
    queryClient.invalidateQueries({ queryKey: ["/api/opinions", id, "counterpoint-counts"] });
  };
  const like = useMutation({
    mutationFn: ({ cpId, like }: { cpId: string; like: boolean }) =>
      apiRequest("POST", `/api/counterpoints/${cpId}/like`, { like }),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/opinions/${id}/counterpoints`, {
        sentenceIndex: draftPara,
        content: draft.trim(),
        paragraphText: paragraphs.find((p) => p.index === draftPara)?.text,
      }),
    onSuccess: () => {
      setDraft("");
      setAddOpen(false);
      setFilter("all");
      refresh();
      toast({ title: "Counterpoint added" });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't add counterpoint",
        description: String(e?.message || "").replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const peopleFor = (item: CounterpointCardItem): Opponent[] => {
    const out: Opponent[] = [];
    const seen = new Set<string>();
    const push = (p: Opponent) => {
      if (!p.userId || seen.has(p.userId)) return;
      seen.add(p.userId);
      out.push(p);
    };
    if (item.authorUserId) {
      push({
        userId: item.authorUserId,
        firstName: item.author?.firstName,
        lastName: item.author?.lastName,
        handle: item.author?.handle,
        profileImageUrl: item.author?.profileImageUrl,
        stance: item.authorStance,
        relation: "author",
      });
    }
    if (opinion?.userId) {
      const origOp = topicOpinions.find((o) => o.userId === opinion.userId);
      push({
        userId: opinion.userId,
        firstName: author?.firstName,
        lastName: author?.lastName,
        handle: author?.handle,
        profileImageUrl: author?.profileImageUrl,
        stance: getOpinionStance(origOp || opinion),
        relation: "original",
      });
    }
    for (const o of topicOpinions) {
      const a = (o as any).author || {};
      push({
        userId: o.userId,
        firstName: a.firstName,
        lastName: a.lastName,
        handle: a.handle,
        profileImageUrl: a.profileImageUrl,
        stance: getOpinionStance(o),
        relation: o.userId === item.authorUserId ? "author" : o.userId === opinion?.userId ? "original" : "topic",
      });
    }
    return out;
  };

  const debate = useMutation({
    mutationFn: async ({ cpId, opponent }: { cpId: string; opponent: Opponent }) => {
      const res = await apiRequest("POST", `/api/counterpoints/${cpId}/start-debate`, { opponentUserId: opponent.userId });
      return { room: await res.json(), opponent };
    },
    onSuccess: ({ room, opponent }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
      const opponentName = `${opponent.firstName || ""} ${opponent.lastName || ""}`.trim() || (opponent.handle ? `@${opponent.handle}` : "your opponent");
      if (!room?.id) return;
      const open = () =>
        openDebateWindow({ debateRoomId: room.id, topicTitle: topic?.title || "Debate", opponentName, opponentId: opponent.userId });
      open();
      toast({
        title: room.reused ? "Debate already open" : "Invite sent",
        description: room.reused
          ? `You already have an open debate with ${opponentName}.`
          : `You challenged ${opponentName}. They'll get an invite — it's also in your debates footer.`,
        action: <ToastAction altText="Open debate" onClick={open}>Open</ToastAction>,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't start the debate",
        description: String(e?.message || "Failed to start debate").replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const openAdd = () => {
    const idx =
      filter !== "all" ? filter : (top?.sentenceIndex ?? (Number.isInteger(focus) ? focus : 0));
    setDraftPara(idx);
    setAddOpen(true);
  };

  if (isLoading) {
    return <p className="py-12 text-center font-serif text-muted-foreground">Loading counterpoints…</p>;
  }
  if (isError || !opinion) {
    return <p className="py-12 text-center font-serif text-muted-foreground">This opinion isn't available.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3 pb-28" data-testid="page-counterpoints">
      <div className="space-y-2">
        <Link
          href={`/topic/${opinion.topicId}`}
          className="inline-flex items-center gap-1 font-ui text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
          data-testid="link-back-topic"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {topic?.title || "Back to topic"}
        </Link>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Counterpoints</h1>
          <div className="flex items-center gap-3 shrink-0 pb-1">
            <span className="font-ui text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {counterpoints.length} {counterpoints.length === 1 ? "reply" : "replies"}
            </span>
            {isAuthenticated && !isAuthor ? (
              <Button type="button" variant="outline" size="sm" onClick={openAdd} data-testid="button-add-counterpoint">
                <Plus className="w-4 h-4 mr-1.5" />
                Add
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ContextCard
        author={author ?? null}
        stance={opinion.stance === "for" || opinion.stance === "against" || opinion.stance === "neutral" ? opinion.stance : null}
        paragraphIndex={contextIndex}
        paragraphText={contextText}
        paragraphCount={paragraphs.length}
      />

      {paragraphs.length > 1 && counterpoints.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="counterpoint-filters">
          <button
            type="button"
            onClick={() => { setFilter("all"); setTopIndex(0); }}
            className={`font-ui text-[0.65rem] uppercase tracking-[0.12em] rounded-full px-3 py-1.5 border transition-colors ${
              filter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-foreground/15 hover:text-foreground"
            }`}
            data-testid="filter-all"
          >
            All · {counterpoints.length}
          </button>
          {paragraphs.map((p) => {
            const n = countsByPara.get(p.index) || 0;
            return (
              <button
                type="button"
                key={p.index}
                onClick={() => { setFilter(p.index); setTopIndex(0); }}
                className={`font-ui text-[0.65rem] uppercase tracking-[0.12em] rounded-full px-3 py-1.5 border transition-colors ${
                  filter === p.index
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-foreground/15 hover:text-foreground"
                }`}
                data-testid={`filter-paragraph-${p.index}`}
              >
                ¶{p.index + 1}
                {n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {visible.length > 0 ? (
        <CardDeck<CounterpointCardItem>
          key={String(filter)}
          items={visible}
          getKey={(item) => item.id}
          renderFront={(item) => <CounterpointDeckFront item={item} />}
          renderBack={(item) => (
            <CounterpointDeckBack
              item={item}
              people={peopleFor(item)}
              originalAuthorId={opinion.userId}
              originalAuthorStance={getOpinionStance(opinion)}
              meId={user?.id}
              isAuthenticated={isAuthenticated}
              canLike={isAuthenticated}
              onLike={() => like.mutate({ cpId: item.id, like: !item.likedByMe })}
              onChallenge={(opponent) => debate.mutate({ cpId: item.id, opponent })}
              onNeedSignIn={() => setShowLoginPrompt(true)}
              likePending={like.isPending}
              challengePending={debate.isPending}
            />
          )}
          initialIndex={0}
          onIndexChange={(i) => setTopIndex(i)}
          maxWidth={400}
          chromeReserve={chromeReserve}
          emptyLabel="No counterpoints yet"
          ariaLabel="Counterpoint cards"
          testId="counterpoint-deck"
        />
      ) : (
        <article className="rounded-xl border bg-card shadow-md deck-card-surface p-6 text-center" data-testid="counterpoints-empty">
          <p className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-[hsl(var(--gold))]">
            {filter === "all" ? "No counterpoints yet" : `No counterpoints on ¶${Number(filter) + 1}`}
          </p>
          <div className="mt-3 mx-auto h-px w-16 bg-[hsl(var(--gold)/0.45)]" />
          <p className="mt-4 font-serif text-base italic text-muted-foreground">
            {filter === "all"
              ? "Be the first to answer a paragraph of this opinion."
              : "Switch to All to see the rest, or add the first reply to this paragraph."}
          </p>
        </article>
      )}


      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add a counterpoint</DialogTitle>
            <DialogDescription>
              Reply to a paragraph of {nameOf(author)}'s opinion.
            </DialogDescription>
          </DialogHeader>
          {paragraphs.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {paragraphs.map((p) => (
                <button
                  type="button"
                  key={p.index}
                  onClick={() => setDraftPara(p.index)}
                  className={`font-ui text-[0.65rem] uppercase tracking-[0.12em] rounded-full px-3 py-1.5 border ${
                    draftPara === p.index
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-foreground/15"
                  }`}
                  data-testid={`button-add-target-${p.index}`}
                >
                  ¶{p.index + 1}
                </button>
              ))}
            </div>
          ) : null}
          {paragraphs.find((p) => p.index === draftPara)?.text ? (
            <p className="font-serif text-sm italic text-muted-foreground line-clamp-3 border-l-2 border-[hsl(var(--gold)/0.6)] pl-3">
              {paragraphs.find((p) => p.index === draftPara)?.text}
            </p>
          ) : null}
          <Textarea
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Make your counterpoint…"
            data-testid={`input-counterpoint-${draftPara}`}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft.trim() || add.isPending}
              onClick={() => add.mutate()}
              data-testid={`button-submit-counterpoint-${draftPara}`}
            >
              Post counterpoint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} action="debate" />
    </div>
  );
}

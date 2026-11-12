import { useQuery } from "@tanstack/react-query";
import { parseServerDate } from "@/lib/dates";
import { useTypingRooms } from "@/lib/typingStore";
import { TypingBubble } from "./TypingBubble";
import { StatusDot, STATE_LABEL, type DebateState } from "./DebateStatus";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OPEN_DEBATES_TRAY_EVENT, answerInvite } from "@/lib/debatesTray";
import { useToast } from "@/hooks/use-toast";

/**
 * The footer's ONE debates list (Nov 2026 overload plan): the "Debates" button, the "+N" chip and the Archive
 * button all open this. Sections: Needs you (new invites, invites to answer, your turn, rate now) → Waiting on them
 * → Archive (finished, declined). No counts anywhere: a single green dot = something new, red = needs you.
 * Refreshed live by the `notification` socket event, which invalidates ["/api/notifications", ...].
 */
type TrayItem = {
  id: string; topicTitle: string; opponentName: string; opponentHandle?: string | null;
  state: DebateState; isNew: boolean; unread: number; finished?: boolean; activityAt?: string | null;
};

const STATE_CLASS: Partial<Record<DebateState, string>> = {
  your_turn: "bg-primary text-primary-foreground", rate: "bg-primary text-primary-foreground", invited: "bg-primary text-primary-foreground",
  waiting: "border border-foreground/40 text-foreground", rated: "border border-foreground/40 text-foreground", invite_sent: "border border-foreground/40 text-foreground",
};
const needsYou = (s: DebateState) => s === "your_turn" || s === "rate" || s === "invited";

export function DebateTray() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const archiveRef = useRef<HTMLDivElement>(null);
  const [scrollToArchive, setScrollToArchive] = useState(false);
  const { data } = useQuery<{ items: TrayItem[]; hasNew?: boolean; needsYou?: boolean }>({
    queryKey: ["/api/notifications", "debates"],
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];
  const isDone = (i: TrayItem) => i.finished ?? (i.state === "completed" || i.state === "rated" || i.state === "declined");
  const active = items.filter((i) => !isDone(i));
  const now = active.filter((i) => i.isNew || needsYou(i.state));
  const later = active.filter((i) => !(i.isNew || needsYou(i.state)));
  const done = items.filter(isDone);
  const typingRooms = useTypingRooms();
  const hasNew = data?.hasNew ?? items.some((i) => i.isNew);
  const needs = data?.needsYou ?? active.some((i) => needsYou(i.state));

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      setScrollToArchive((e as CustomEvent).detail?.section === "archive");
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", "debates"] });
    };
    window.addEventListener(OPEN_DEBATES_TRAY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DEBATES_TRAY_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (open && scrollToArchive && archiveRef.current) {
      const t = setTimeout(() => archiveRef.current?.scrollIntoView({ block: "start" }), 60);
      return () => clearTimeout(t);
    }
  }, [open, scrollToArchive, done.length]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
  };

  const openRoom = async (item: TrayItem) => {
    setOpen(false);
    setLocation(`/debate-room/${item.id}`);
    if (item.unread > 0 || item.isNew) {
      await apiRequest("POST", `/api/notifications/read-room/${item.id}`, {}).catch(() => {});
      refresh();
    }
  };

  const answer = async (item: TrayItem, action: "accept" | "decline") => {
    try {
      await answerInvite(item.id, action);
      await apiRequest("POST", `/api/notifications/read-room/${item.id}`, {}).catch(() => {});
      refresh();
      if (action === "accept") openRoom(item);
      else toast({ title: "Invite declined", description: "It moved to Archive." });
    } catch (e: any) {
      toast({ title: "Couldn't answer the invite", description: e?.message, variant: "destructive" });
    }
  };

  const row = (d: TrayItem) => {
    const highlighted = d.isNew || needsYou(d.state);
    return (
      <li key={d.id}>
        <div className={`flex items-start gap-2 px-3 py-2.5 hover:bg-muted ${highlighted && !isDone(d) ? "bg-primary/10 border-l-[3px] border-primary" : "border-l-[3px] border-transparent"}`}>
          <div className="min-w-0 flex-1">
          <button onClick={() => openRoom(d)} className="w-full text-left" data-testid={`tray-debate-${d.id}`} data-state={d.state}>
            <div className="flex items-center gap-2">
              {d.isNew && <span className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.1em] text-primary" data-testid="tray-new">New</span>}
              <span className="font-serif font-semibold text-sm truncate">{d.topicTitle}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              vs {d.opponentName}{d.opponentHandle ? ` · @${d.opponentHandle}` : ""}
              {d.activityAt ? ` · ${formatDistanceToNow(parseServerDate(d.activityAt), { addSuffix: true })}` : ""}
            </div>
          </button>
            {d.state === "invited" && (
              <div className="flex gap-1.5 mt-1.5">
                <button type="button" onClick={() => answer(d, "accept")}
                  className="font-ui text-[0.65rem] uppercase tracking-[0.08em] px-2 py-1 bg-primary text-primary-foreground" data-testid={`tray-accept-${d.id}`}>Accept</button>
                <button type="button" onClick={() => answer(d, "decline")}
                  className="font-ui text-[0.65rem] uppercase tracking-[0.08em] px-2 py-1 border border-foreground/40" data-testid={`tray-decline-${d.id}`}>Decline</button>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {typingRooms.has(d.id) && !isDone(d) ? <TypingBubble size="sm" data-testid={`tray-typing-${d.id}`} />
              : isDone(d) ? null
              : d.isNew ? <StatusDot kind="new" className="w-2.5 h-2.5" data-testid={`tray-dot-new-${d.id}`} />
              : needsYou(d.state) ? <StatusDot kind="needs_you" className="w-2.5 h-2.5" data-testid={`tray-dot-needs-${d.id}`} /> : null}
            <span className={`font-ui text-[0.6rem] uppercase tracking-[0.08em] px-1.5 py-0.5 ${STATE_CLASS[d.state] ?? "border border-foreground/20 text-muted-foreground"}`} data-testid="tray-state">{STATE_LABEL[d.state]}</span>
          </div>
        </div>
      </li>
    );
  };

  const heading = (t: string, testId: string) => (
    <div className="px-3 pt-3 pb-1 font-ui text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground border-t first:border-t-0" data-testid={testId}>{t}</div>
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setScrollToArchive(false); if (o) queryClient.invalidateQueries({ queryKey: ["/api/notifications", "debates"] }); }}>
      <PopoverTrigger asChild>
        <button
          className="relative shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-muted font-ui text-[0.72rem] font-semibold uppercase tracking-[0.08em]"
          aria-label={hasNew ? "Debates, something new" : needs ? "Debates, needs you" : "Debates"}
          data-testid="button-footer-debates"
        >
          <MessageSquare className="w-4 h-4" />
          Debates
          {hasNew ? <StatusDot kind="new" className="w-2.5 h-2.5" data-testid="dot-footer-debates-new" />
            : needs ? <StatusDot kind="needs_you" className="w-2.5 h-2.5" data-testid="dot-footer-debates-needs" /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(24rem,calc(100vw-1rem))] p-0 border-2 border-foreground" data-testid="panel-footer-debates">
        <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-double border-foreground">
          <span className="font-serif font-bold text-lg">Your debates</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground text-center">No debates yet. Invites and turns show up here.</p>}
          {now.length > 0 && (<>{heading("Needs you", "heading-tray-now")}<ul className="divide-y" data-testid="list-tray-active">{now.map(row)}</ul></>)}
          {later.length > 0 && (<>{heading("Waiting on them", "heading-tray-later")}<ul className="divide-y" data-testid="list-tray-waiting">{later.map(row)}</ul></>)}
          {(done.length > 0 || scrollToArchive) && (
            <div ref={archiveRef}>
              {heading("Archive", "heading-tray-archive")}
              {done.length > 0 ? <ul className="divide-y" data-testid="list-tray-completed">{done.map(row)}</ul>
                : <p className="px-3 py-4 text-sm text-muted-foreground">Finished debates show up here.</p>}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

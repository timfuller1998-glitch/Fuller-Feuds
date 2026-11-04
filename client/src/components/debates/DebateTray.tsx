import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";

/**
 * NEW: footer debates tray. Lists every debate the user is in (invites, your turn, waiting,
 * waiting for a rating, completed) with an unread badge. Refreshed live by the `notification`
 * socket event, which invalidates ["/api/notifications", ...].
 */
type TrayItem = {
  id: string; topicTitle: string; opponentName: string; opponentHandle?: string | null;
  state: "your_turn" | "waiting" | "rate" | "rated" | "completed"; isNew: boolean; unread: number; activityAt?: string | null;
};

const STATE_LABEL: Record<TrayItem["state"], string> = {
  your_turn: "Your turn", waiting: "Their turn", rate: "Rate now", rated: "Waiting for their rating", completed: "Completed",
};
const STATE_CLASS: Record<TrayItem["state"], string> = {
  your_turn: "bg-primary text-primary-foreground", rate: "bg-primary text-primary-foreground",
  waiting: "border border-foreground/40 text-foreground", rated: "border border-foreground/40 text-foreground",
  completed: "border border-foreground/20 text-muted-foreground",
};

export function DebateTray() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ items: TrayItem[]; unreadCount: number }>({
    queryKey: ["/api/notifications", "debates"],
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;
  const active = items.filter((i) => i.state !== "completed");
  const done = items.filter((i) => i.state === "completed");

  const openRoom = async (item: TrayItem) => {
    setOpen(false);
    setLocation(`/debate-room/${item.id}`);
    if (item.unread > 0) {
      await apiRequest("POST", `/api/notifications/read-room/${item.id}`, {}).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  };

  const markAll = async () => {
    await apiRequest("POST", "/api/notifications/read-all", {}).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const row = (d: TrayItem) => {
    const highlighted = d.isNew || d.unread > 0;
    return (
      <li key={d.id}>
        <button
          onClick={() => openRoom(d)}
          className={`w-full text-left px-3 py-2.5 hover:bg-muted flex items-start gap-2 ${highlighted ? "bg-primary/10 border-l-[3px] border-primary" : "border-l-[3px] border-transparent"}`}
          data-testid={`tray-debate-${d.id}`}
          data-state={d.state}
          data-unread={d.unread}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {d.isNew && <span className="font-ui text-[0.6rem] font-bold uppercase tracking-[0.1em] text-primary" data-testid="tray-new">New</span>}
              <span className="font-serif font-semibold text-sm truncate">{d.topicTitle}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              vs {d.opponentName}{d.opponentHandle ? ` · @${d.opponentHandle}` : ""}
              {d.activityAt ? ` · ${formatDistanceToNow(new Date(d.activityAt), { addSuffix: true })}` : ""}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`font-ui text-[0.6rem] uppercase tracking-[0.08em] px-1.5 py-0.5 ${STATE_CLASS[d.state]}`} data-testid="tray-state">{STATE_LABEL[d.state]}</span>
            {d.unread > 0 && <span className="text-[0.65rem] font-bold text-primary">{d.unread} new</span>}
          </div>
        </button>
      </li>
    );
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) queryClient.invalidateQueries({ queryKey: ["/api/notifications", "debates"] }); }}>
      <PopoverTrigger asChild>
        <button
          className="relative shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-muted font-ui text-[0.72rem] font-semibold uppercase tracking-[0.08em]"
          aria-label={unread ? `Debates, ${unread} new` : "Debates"}
          data-testid="button-footer-debates"
        >
          <MessageSquare className="w-4 h-4" />
          Debates
          {unread > 0 && (
            <span className="min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-primary text-primary-foreground text-[0.65rem] font-bold leading-[1.15rem] text-center" data-testid="badge-footer-debates-count">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(24rem,calc(100vw-1rem))] p-0 border-2 border-foreground" data-testid="panel-footer-debates">
        <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-double border-foreground">
          <span className="font-serif font-bold text-lg">Your debates</span>
          {unread > 0 && (
            <button className="font-ui text-[0.7rem] uppercase tracking-[0.08em] text-primary" onClick={markAll} data-testid="button-tray-read-all">Mark all read</button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground text-center">No debates yet. Invites and turns show up here.</p>}
          {active.length > 0 && <ul className="divide-y" data-testid="list-tray-active">{active.map(row)}</ul>}
          {done.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 font-ui text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground border-t">Completed</div>
              <ul className="divide-y" data-testid="list-tray-completed">{done.map(row)}</ul>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

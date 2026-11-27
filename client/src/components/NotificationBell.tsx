import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseServerDate } from "@/lib/dates";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkUrl?: string | null;
  debateRoomId?: string | null;
}

const KEY = ["/api/notifications"];

/**
 * Header bell: unread count, the newest 30 notifications, mark-all-read. No polling — the `notification`
 * socket event (useDebateWebSocket) invalidates this query, and opening the bell refetches once.
 */
export function NotificationBell({ side = "bottom" }: { side?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ items: NotificationItem[]; unreadCount: number }>({ queryKey: KEY, staleTime: 30_000 });
  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) queryClient.invalidateQueries({ queryKey: KEY });
  }, []);

  const markAll = useCallback(async () => {
    // Optimistic: clear the badge right away, then confirm with the server.
    queryClient.setQueryData(KEY, (old: any) => old ? { ...old, unreadCount: 0, items: old.items.map((i: NotificationItem) => ({ ...i, isRead: true })) } : old);
    await apiRequest("POST", "/api/notifications/read-all", {}).catch(() => {});
    queryClient.invalidateQueries({ queryKey: KEY });
  }, []);

  const openItem = useCallback((n: NotificationItem) => {
    setOpen(false);
    if (!n.isRead) {
      queryClient.setQueryData(KEY, (old: any) => old ? { ...old, unreadCount: Math.max(0, old.unreadCount - 1), items: old.items.map((i: NotificationItem) => i.id === n.id ? { ...i, isRead: true } : i) } : old);
      apiRequest("PATCH", `/api/notifications/${n.id}/read`, {}).catch(() => {});
    }
    const href = n.linkUrl || (n.debateRoomId ? `/debate-room/${n.debateRoomId}` : null);
    if (href) setLocation(href);
  }, [setLocation]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative shrink-0 p-2 text-foreground hover:text-primary"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[0.65rem] font-semibold leading-[1.1rem] text-center" data-testid="badge-notifications-unread">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0" data-testid="popover-notifications">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-display text-base">Notifications</span>
          <button
            className="text-xs text-primary disabled:text-muted-foreground"
            onClick={markAll}
            disabled={unread === 0}
            data-testid="button-notifications-read-all"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">Nothing yet. You'll hear here when people answer you.</p>
          ) : items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 flex gap-2 ${n.isRead ? "" : "bg-primary/5"}`}
              data-testid={`notification-${n.id}`}
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.isRead ? "bg-transparent" : "bg-primary"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{n.title}</span>
                <span className="block text-sm text-muted-foreground">{n.message}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(parseServerDate(n.createdAt), { addSuffix: true })}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

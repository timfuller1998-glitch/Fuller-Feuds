import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";

/** NEW: header bell for debate invites, turns, endings and ratings. Live via the `notification` socket event. */
type Item = { id: string; type: string; title: string; message: string; debateRoomId?: string | null; isRead: boolean; createdAt: string };

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ items: Item[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60_000,
  });
  const markOne = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative shrink-0 p-2 hover:bg-muted rounded-md"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-primary text-primary-foreground text-[0.65rem] font-bold leading-[1.15rem] text-center"
              data-testid="badge-notification-count"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0 border-2 border-foreground" data-testid="panel-notifications">
        <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-double border-foreground">
          <span className="font-serif font-bold text-lg">Notifications</span>
          {unread > 0 && (
            <button className="font-ui text-[0.7rem] uppercase tracking-[0.08em] text-primary" onClick={() => markAll.mutate()} data-testid="button-notifications-read-all">
              Mark all read
            </button>
          )}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto divide-y" data-testid="list-notifications">
          {items.length === 0 && <li className="px-3 py-6 text-sm text-muted-foreground text-center">Nothing yet. Debate invites and turns show up here.</li>}
          {items.map((n) => (
            <li key={n.id}>
              <button
                className={`w-full text-left px-3 py-2.5 hover:bg-muted ${n.isRead ? "" : "bg-primary/5"}`}
                onClick={() => {
                  if (!n.isRead) markOne.mutate(n.id);
                  if (n.debateRoomId) setLocation(`/debate-room/${n.debateRoomId}`);
                }}
                data-testid={`notification-${n.type}`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-label="unread" />}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-sm text-muted-foreground break-words">{n.message}</div>
                    <div className="text-[0.7rem] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

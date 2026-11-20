import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/queryClient";

/**
 * Live viewing (Nov 20 2026). Follows one debate room over the /ws socket — signed in or not — and refreshes
 * the room, its messages and ratings whenever something happens. Read-only: nothing is ever sent but watch/unwatch.
 * `asDebater` keeps a debater's own page in sync without counting them as a spectator.
 */
export function useWatchDebate(roomId: string | undefined, opts: { enabled?: boolean; asDebater?: boolean } = {}) {
  const enabled = opts.enabled !== false && !!roomId;
  const asDebater = !!opts.asDebater;
  const [state, setState] = useState<"connecting" | "live" | "offline" | "closed">("connecting");
  const [viewers, setViewers] = useState(0);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !roomId) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      queryClient.invalidateQueries({ queryKey: ["/api/debates/live"] });
    };

    const open = () => {
      if (stopped) return;
      setState("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.onopen = () => {
        attempts = 0;
        ws?.send(JSON.stringify({ type: "watch_debate", debateRoomId: roomId, asDebater }));
      };
      ws.onmessage = (ev) => {
        let m: any;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m?.debateRoomId !== roomId) return;
        if (m.type === "watching") { setState("live"); refresh(); }
        else if (m.type === "watch_error") { setState("closed"); stopped = true; ws?.close(1000); }
        else if (m.type === "debate_viewers") setViewers(Number(m.count) || 0);
        else if (m.type === "debate_update") {
          refresh();
          if (m.kind === "message") setTypingUserId(null);
        } else if (m.type === "debate_typing" && !asDebater) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          if (m.isTyping) {
            setTypingUserId(m.userId || null);
            typingTimer.current = setTimeout(() => setTypingUserId(null), 5000);
          } else setTypingUserId(null);
        }
      };
      ws.onclose = () => {
        ws = null;
        if (stopped) return;
        setState("offline");
        // Reconnect with backoff (1s, 2s, 4s … up to 30s); refresh on reconnect so nothing is missed.
        const delay = Math.min(1000 * 2 ** attempts++, 30000);
        retry = setTimeout(open, delay);
      };
    };
    open();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      try { ws?.send(JSON.stringify({ type: "unwatch_debate", debateRoomId: roomId })); } catch {}
      ws?.close(1000);
    };
  }, [roomId, enabled, asDebater]);

  return { state, viewers, typingUserId };
}

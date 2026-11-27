import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// One turn source for both debate views (the footer popup and the full debate page), Nov 27 2026.

export interface TurnRoom {
  status?: string | null;
  phase?: string | null;
  currentTurn?: string | null;
  participant1Id?: string;
  participant2Id?: string;
}

/** Who may post right now, from the server's room (`currentTurn` = the user id whose turn it is). */
export function debateTurn(room: TurnRoom | undefined | null, userId: string | undefined | null) {
  const isParticipant = !!room && !!userId && (room.participant1Id === userId || room.participant2Id === userId);
  const isOver = !!room && (room.status !== "active" || room.phase === "voting");
  const structured = room?.phase === "structured";
  const turnUserId = structured ? room?.currentTurn ?? null : null;
  const isMyTurn = isParticipant && !isOver && (!structured || !turnUserId || turnUserId === userId);
  return {
    isParticipant,
    isOver,
    structured,
    turnUserId,
    isMyTurn,
    canSend: isMyTurn,
    waiting: isParticipant && !isOver && structured && !!turnUserId && turnUserId !== userId,
  };
}

/**
 * The debate room, kept fresh: the socket's `debate_update` invalidates it; on top of that it refetches when the
 * tab regains focus, every 15s while visible and the debate is running, and whenever the message count changes
 * (a new message always means the turn moved). Before, only the socket refreshed the room, so a phone that missed
 * one socket event kept showing the old turn while the messages (which poll) moved on.
 */
export function useDebateRoom<T extends TurnRoom>(roomId: string | undefined, messageCount?: number, opts: { enabled?: boolean } = {}) {
  const query = useQuery<T>({
    queryKey: ["/api/debate-rooms", roomId],
    enabled: !!roomId && opts.enabled !== false,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const r = q.state.data as TurnRoom | undefined;
      return r && r.status === "active" && r.phase !== "voting" ? 15000 : false;
    },
  });
  const lastCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (messageCount === undefined || !roomId) return;
    if (lastCount.current !== undefined && lastCount.current !== messageCount) {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId], exact: true });
    }
    lastCount.current = messageCount;
  }, [messageCount, roomId]);
  return query;
}

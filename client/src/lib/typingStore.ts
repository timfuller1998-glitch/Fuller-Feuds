import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Live "opponent is typing" state, fed by the global debate WebSocket (opponent_typing events).
 * An entry expires 5s after the last start event, so a dropped "stop" never leaves a stuck bubble.
 */
const EXPIRE_MS = 5000;
const typing = new Map<string, { userId: string; timer: ReturnType<typeof setTimeout> }>(); // roomId → typer
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, string> = new Map();
const senders: Array<(msg: any) => void> = []; // every live debate socket; newest is used

function emit() {
  snapshot = new Map([...typing].map(([room, v]) => [room, v.userId]));
  listeners.forEach((l) => l());
}

export function setOpponentTyping(roomId: string, userId: string, isTyping: boolean) {
  const prev = typing.get(roomId);
  if (prev) clearTimeout(prev.timer);
  if (isTyping) {
    typing.set(roomId, { userId, timer: setTimeout(() => setOpponentTyping(roomId, userId, false), EXPIRE_MS) });
  } else if (!prev) {
    return;
  } else {
    typing.delete(roomId);
  }
  emit();
}

export function registerTypingSender(fn: (msg: any) => void) {
  senders.push(fn);
  return () => { const i = senders.lastIndexOf(fn); if (i >= 0) senders.splice(i, 1); };
}
const sender = { send: (msg: any) => senders[senders.length - 1]?.(msg) };

/** Map of roomId → userId currently typing to you. */
export function useTypingRooms(): ReadonlyMap<string, string> {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => snapshot,
  );
}

/**
 * Throttled typing sender for a debate input: sends "start" at most every 2s while keys are pressed,
 * "stop" 3s after the last key, on send, on blur, and on unmount.
 */
export function useTypingSender(roomId: string | undefined, enabled = true) {
  const lastStart = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const active = useRef(false);
  const send = (isTyping: boolean) => { if (roomId) sender.send({ type: 'typing', debateRoomId: roomId, isTyping }); };
  const stop = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (active.current) { active.current = false; lastStart.current = 0; send(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
  const onKey = useCallback(() => {
    if (!enabled || !roomId) return;
    const now = Date.now();
    if (now - lastStart.current > 2000) { lastStart.current = now; active.current = true; send(true); }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(stop, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, enabled, stop]);
  useEffect(() => stop, [stop]);
  return { onKey, stop };
}

/** Open the footer's single Debates list from anywhere (+N chip, Archive button). */
export const OPEN_DEBATES_TRAY_EVENT = "ff:open-debates-tray";
export function openDebatesTray(section: "active" | "archive" = "active") {
  window.dispatchEvent(new CustomEvent(OPEN_DEBATES_TRAY_EVENT, { detail: { section } }));
}

/** Answer a pending invite. */
export async function answerInvite(roomId: string, action: "accept" | "decline" | "withdraw") {
  const res = await fetch(`/api/debate-rooms/${roomId}/invite/${action}`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Couldn't answer the invite");
  return res.json();
}

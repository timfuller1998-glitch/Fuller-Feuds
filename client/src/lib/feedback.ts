/** Open the bug report / feature request form from anywhere (sidebar "Send feedback", Settings). */
export const OPEN_FEEDBACK_EVENT = "ff:open-feedback";
export function openFeedback(type: "bug" | "feature" = "bug") {
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { type } }));
}

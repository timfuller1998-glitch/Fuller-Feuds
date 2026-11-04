/** Open the first-run tutorial from anywhere (sidebar "How it works", Settings "Replay tutorial"). */
export const OPEN_TUTORIAL_EVENT = "ff:open-tutorial";
export function openTutorial() {
  window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT));
}

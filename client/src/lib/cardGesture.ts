/** Shared "this was a scroll or swipe, not a tap" flag for flippable cards. */

let lastGestureAt = 0;

/** Call when a card is being scrolled or swiped so the lift does not count as a tap. */
export function markCardGesture() {
  lastGestureAt = Date.now();
}

export function cardGestureJustHappened(withinMs = 450) {
  return Date.now() - lastGestureAt < withinMs;
}

export const CARD_GESTURE_LOCK_PX = 8;

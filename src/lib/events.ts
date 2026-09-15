// Tiny app-wide event bus so far-apart parts of the UI (e.g. the study session and
// the Dashboard's Lern-Historie) can react immediately to something happening,
// without a page navigation/remount in between.
const bus = new EventTarget();

export function emitReviewed() {
  bus.dispatchEvent(new Event("reviewed"));
}

/** Fires every time a card review is recorded, anywhere in the app. Returns an unsubscribe fn. */
export function onReviewed(cb: () => void) {
  bus.addEventListener("reviewed", cb);
  return () => bus.removeEventListener("reviewed", cb);
}

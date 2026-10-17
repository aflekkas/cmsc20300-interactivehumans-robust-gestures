const TOSS_THRESHHOLD = 2; // z index threshold for "oh, we're flying now"
const MINIMUM_TOSS_DURATION = 100; // ms

let tossStartedAt = null;

export function tossUpdate(z) {
  if (z < TOSS_THRESHHOLD) {
    if (tossStartedAt == null) tossStartedAt = Date.now();

    if (Date.now() - freeFallStartedAt > MINIMUM_TOSS_DURATION) {
      // trigger
      document.body.style.background = "red";
    }
  }
}

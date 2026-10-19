// Alexandros's original threshold-based toss detector, with a small event bridge.
// Detection threshold and minimum duration are unchanged.
const TOSS_THRESHHOLD = 2;
const MINIMUM_TOSS_DURATION = 100; // ms
const TOSS_COOLDOWN_MS = 1200;

let tossStartedAt = null;
let tossDetectedThisLowPeriod = false;
let lastTossAt = -Infinity;

export function tossUpdate(totalForce) {
  const now = Date.now();

  if (totalForce < TOSS_THRESHHOLD) {
    if (tossDetectedThisLowPeriod || now - lastTossAt < TOSS_COOLDOWN_MS) return;
    if (tossStartedAt == null) tossStartedAt = now;

    if (now - tossStartedAt > MINIMUM_TOSS_DURATION) {
      tossDetectedThisLowPeriod = true;
      lastTossAt = now;
      tossStartedAt = null;

      // NEW: notifing UI that a toss gesture was detected
      const detection = { gesture: "toss", timestamp_ms: now, source: "detector" };
      window.dispatchEvent(new CustomEvent("gesture-detected", { detail: detection }));
      console.debug("[toss.js] dispatched gesture-detected", detection);

      // Keep the original red flash in accuracy/demo mode; avoid changing
      // participant behavior by flashing during accidental-activation tests.
      if (document.body.dataset.studyPhase !== "accidental") {
        document.body.style.background = "red";
        setTimeout(() => { document.body.style.background = ""; }, 1000);
      }
    }
  } else {
    tossStartedAt = null;
    tossDetectedThisLowPeriod = false; // re-arm after exiting low-force period
  }
}

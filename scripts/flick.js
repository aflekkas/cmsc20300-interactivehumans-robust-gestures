const FLICK_THRESHOLD = 8;
const NEUTRAL_THRESHOLD = 3;
const MAX_FLICK_DURATION = 500;
const FLICK_COOLDOWN_MS = 1200;

let flickStartedAt = null;
let flickDirection = null;
let lastFlickAt = -Infinity;

export function flickUpdate(x) {
  const now = Date.now();
  const tilt = Math.abs(x);

  if (flickStartedAt == null) {
    if (tilt > FLICK_THRESHOLD && now - lastFlickAt > FLICK_COOLDOWN_MS) {
      flickStartedAt = now;
      flickDirection = x < 0 ? "left" : "right";
    }
    return;
  }

  if (tilt < NEUTRAL_THRESHOLD) {
    const duration = now - flickStartedAt;
    flickStartedAt = null;

    if (duration <= MAX_FLICK_DURATION) {
      lastFlickAt = now;
      reportFlick(now, duration);
    }
  }
}

function reportFlick(now, duration) {
  const detection = {
    gesture: "flick",
    timestamp_ms: now,
    source: "detector",
    direction: flickDirection,
    duration_ms: duration
  };
  window.dispatchEvent(new CustomEvent("gesture-detected", { detail: detection }));
  console.debug("[flick.js] dispatched gesture-detected", detection);

  if (document.body.dataset.studyPhase !== "accidental") {
    document.body.style.background = "#2e56d4";
    setTimeout(() => { document.body.style.background = ""; }, 1000);
  }
}
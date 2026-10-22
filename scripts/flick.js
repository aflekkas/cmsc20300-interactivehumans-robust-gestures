const FLICK_THRESHOLD = 8;
const NEUTRAL_THRESHOLD = 3;
const MAX_FLICK_DURATION = 500;
const CONFIRM_MS = 300;
const FLICK_COOLDOWN_MS = 1200;
const FREE_FALL_FORCE = 5;
const TOSS_BLOCK_MS = 1500;

let armed = false;
let flickStartedAt = null;
let flickDirection = null;
let pendingFlick = null;
let lastFlickAt = -Infinity;
let blockedUntil = -Infinity;

export function flickUpdate(x, totalForce) {
  const now = Date.now();
  const tilt = Math.abs(x);

  if (totalForce < FREE_FALL_FORCE) {
    armed = false;
    flickStartedAt = null;
    pendingFlick = null;
    blockedUntil = now + TOSS_BLOCK_MS;
    return;
  }

  if (pendingFlick && now - pendingFlick.at >= CONFIRM_MS) {
    reportFlick(pendingFlick);
    pendingFlick = null;
  }

  if (now < blockedUntil || now - lastFlickAt < FLICK_COOLDOWN_MS) return;

  if (flickStartedAt == null) {
    if (tilt < NEUTRAL_THRESHOLD) armed = true;

    if (armed && tilt > FLICK_THRESHOLD) {
      armed = false;
      flickStartedAt = now;
      flickDirection = x < 0 ? "left" : "right";
    }
    return;
  }

  const duration = now - flickStartedAt;

  if (duration > MAX_FLICK_DURATION) {
    flickStartedAt = null;
    return;
  }

  if (tilt < NEUTRAL_THRESHOLD) {
    flickStartedAt = null;
    lastFlickAt = now;
    pendingFlick = { at: now, direction: flickDirection, duration };
  }
}

function reportFlick({ at, direction, duration }) {
  const detection = {
    gesture: "flick",
    timestamp_ms: at,
    source: "detector",
    direction,
    duration_ms: duration
  };
  window.dispatchEvent(new CustomEvent("gesture-detected", { detail: detection }));
  console.debug("[flick.js] dispatched gesture-detected", detection);

  if (document.body.dataset.studyPhase !== "accidental") {
    document.body.style.background = "blue";
    setTimeout(() => { document.body.style.background = ""; }, 1000);
  }
}
// GENERAL SETTINGS

const get = (id) => document.getElementById(id);

const TOTAL_TRIALS = 10;
const ACTIVITY_DURATION_MS = 120000;
const REST_MS = 2000;

const screens = [
  "setup-screen",
  "accidental-screen",
  "intro-screen",
  "accuracy-screen",
  "survey-screen",
  "results-screen",
];

// every participant goes through these steps in order.
const STEPS = [
  "accidental",
  "toss-intro",
  "toss",
  "flick-intro",
  "flick",
  "survey",
];

const gestureNames = { toss: "Toss", flick: "Flick" };

const scenarios = {
  toss: "Imagine that tossing your phone wipes all your open tabs. Watch the demo, then toss your phone the same way.",
  flick:
    "Imagine that flicking your phone wipes all your open tabs. Watch the demo, then flick your phone the same way.",
};

let sensorsReady = false;
let study = null;
let activityTimer = null;
let nextTrialTimer = null;

// SCREEN MANAGEMENT
// Show the selected screen and hide the others.
function showScreen(screen) {
  for (const id of screens) {
    get(id).hidden = id !== screen;
  }

  // we do not want to bias by always showing sensor panel! (i think?)
  get("sensor-panel").hidden = screen !== "setup-screen";
}

// DATA LOGGING
// Send experiment information to the future logger.
function logEvent(type, extra = {}) {
  window.dispatchEvent(
    new CustomEvent("study-event", {
      detail: {
        event_type: type,
        timestamp_ms: Date.now(),
        participant_id: study.id,
        session_id: study.sessionId,
        mode: study.mode,
        phase: STEPS[study.step] ?? "setup",
        gesture: study.mode === "accuracy" ? study.gesture : null,
        ...extra,
      },
    }),
  );
}

// Record the beginning of a session only once.
function startSession() {
  if (study.started) return;

  study.started = true;
  logEvent("session_start");
}

// Display the results after an experiment finishes.
function showResults(message) {
  document.body.dataset.studyPhase = "finished";
  get("summary").textContent = message;
  showScreen("results-screen");
}

// this no longer is needed with new vers (continous)
/*
get("mode").addEventListener("change", () => {
  const accuracy = get("mode").value === "accuracy";

  get("gesture-choice").hidden = !accuracy;
  get("activity-choice").hidden = accuracy;
});
*/

// create a new participant session when the researcher presses Start Study.
get("setup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(nextTrialTimer);

  const id = get("participant").value.trim();
  if (!id) return;

  if (!sensorsReady) {
    alert("Enable motion sensors before starting.");
    return;
  }

  // store the current participant and experiment information.
  study = {
    id,
    sessionId: `${id}_${Date.now()}`,
    mode: null,
    gesture: null,
    step: -1,
    started: false,
    results: {},

    // accuracy test (reset for each gesture)
    trial: 1,
    correct: 0,
    trialActive: false,
    trialDetections: [],
    trialStartedAt: null,

    // accidental activation test
    counts: { toss: 0, flick: 0 },
    activityStartedAt: null,
    activityActive: false,
  };

  startSession();
  nextStep();
});

window.addEventListener("sensors-ready", () => {
  sensorsReady = true;
});

// STUDY SEQUENCE
// move to the next step and show its screen.
function nextStep() {
  study.step++;
  const step = STEPS[study.step];

  if (step === "accidental") {
    study.mode = "accidental";
    document.body.dataset.studyPhase = "intro";

    get("activity-participant").textContent = `Participant ${study.id}`;
    get("activity-clock").textContent = "02:00";
    get("recording-state").textContent = "Not recording yet.";
    get("recording-state").className = "recording-state";
    get("begin-activity").disabled = false;
    get("stop-activity").disabled = true;

    showScreen("accidental-screen");
  } else if (step.endsWith("-intro")) {
    study.mode = "accuracy";
    study.gesture = step.replace("-intro", "");
    document.body.dataset.studyPhase = "intro";

    get("intro-title").textContent = `${gestureNames[study.gesture]} gesture`;
    get("intro-scenario").textContent = scenarios[study.gesture];
    get("demo-video").src = `public/${study.gesture}.mp4`;

    showScreen("intro-screen");
  } else if (step === "toss" || step === "flick") {
    study.trial = 1;
    study.correct = 0;

    get("accuracy-title").textContent = `${gestureNames[study.gesture]} test`;
    get("accuracy-participant").textContent =
      `Participant ${study.id} · ${TOTAL_TRIALS} attempts`;
    get("trial-number").textContent = `1 / ${TOTAL_TRIALS}`;
    get("finish-trial").textContent = `I did the ${study.gesture}`;

    showScreen("accuracy-screen");
    startTrial();
  } else if (step === "survey") {
    study.mode = "survey";
    study.gesture = null;
    document.body.dataset.studyPhase = "survey";

    get("survey-form").reset();
    showScreen("survey-screen");
  }
}

get("start-attempts").addEventListener("click", () => {
  get("demo-video").pause();
  nextStep();
});

// ACCURACY TEST

// Begin one intentional gesture attempt.
function startTrial() {
  if (
    !study ||
    study.mode !== "accuracy" ||
    study.trialActive ||
    study.trial > TOTAL_TRIALS
  ) {
    return;
  }

  startSession();
  document.body.dataset.studyPhase = "accuracy";

  study.trialActive = true;
  study.trialDetections = [];
  study.trialStartedAt = Date.now();

  get("trial-message").textContent =
    `Attempt ${study.trial}: perform one ${study.gesture}.`;

  get("finish-trial").disabled = false;
  get("invalidate-trial").disabled = false;

  logEvent("trial_start", { trial_number: study.trial });
}

// Finish an attempt as success, miss or invalid.
function endTrial(invalid = false) {
  // researcher marks as invalid or not!
  if (!study || !study.trialActive) return;

  // Prevent the same attempt from being counted twice.
  study.trialActive = false;
  document.body.dataset.studyPhase = "between-attempts";

  const currentStudy = study;

  const trialInfo = {
    trial_number: study.trial,
    trial_started_at_ms: study.trialStartedAt,
    trial_ended_at_ms: Date.now(),
    detected_gestures: [...study.trialDetections],
  };

  get("finish-trial").disabled = true;
  get("invalidate-trial").disabled = true;

  if (invalid) {
    // Retry without increasing the attempt number.
    logEvent("trial_invalidated", {
      ...trialInfo,
      reason: "attempt_not_completed",
    });

    get("trial-message").textContent =
      "Invalid attempt. Retrying in 2 seconds...";
  } else {
    // success if the expected gesture fired at any point during the attempt.
    const outcome = study.trialDetections.includes(study.gesture)
      ? "success"
      : "miss";

    if (outcome === "success") {
      study.correct++;
    }

    logEvent("trial_result", {
      ...trialInfo,
      expected_gesture: study.gesture,
      outcome,
    });

    study.trial++;

    get("trial-message").textContent =
      "Attempt recorded. Next attempt in 2 seconds...";
  }

  // Finish after 10 valid attempts.
  if (study.trial > TOTAL_TRIALS) {
    study.results[study.gesture] = study.correct;

    logEvent("phase_end", {
      correct: study.correct,
      valid_attempts: TOTAL_TRIALS,
    });

    nextStep();
    return;
  }

  get("trial-number").textContent = `${study.trial} / ${TOTAL_TRIALS}`;

  // Wait 2 seconds before the next attempt.
  clearTimeout(nextTrialTimer);

  nextTrialTimer = setTimeout(() => {
    if (study === currentStudy) startTrial();
  }, REST_MS);
}

// Manual buttons for missed or invalid attempts.
get("finish-trial").addEventListener("click", () => {
  endTrial();
});

get("invalidate-trial").addEventListener("click", () => {
  endTrial(true); // true so invalid = true
});

// ACCIDENTAL ACTIVATION TEST

// Start recording the participant's everyday activity.
get("begin-activity").addEventListener("click", () => {
  // activityStartedAt is set once recording starts, so this only runs once.
  if (
    !study ||
    study.mode !== "accidental" ||
    study.activityActive ||
    study.activityStartedAt
  ) {
    return;
  }

  study.activityActive = true;
  study.activityStartedAt = Date.now();

  document.body.dataset.studyPhase = "accidental";

  get("recording-state").textContent = "Recording...";
  get("recording-state").className = "recording-state recording-active";

  get("begin-activity").disabled = true;
  get("stop-activity").disabled = false;

  logEvent("activity_start", {
    duration_target_ms: ACTIVITY_DURATION_MS,
  });

  // Update the remaining time using actual timestamps.
  activityTimer = setInterval(() => {
    const elapsed = Date.now() - study.activityStartedAt;

    const remaining = Math.max(
      0,
      Math.ceil((ACTIVITY_DURATION_MS - elapsed) / 1000),
    );

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");

    get("activity-clock").textContent = `${minutes}:${seconds}`;

    if (elapsed >= ACTIVITY_DURATION_MS) {
      endActivity();
    }
  }, 200);
});

// stop recording and move on to the toss intro.
function endActivity() {
  if (!study || !study.activityActive) return;

  study.activityActive = false;
  clearInterval(activityTimer);
  activityTimer = null;

  const durationMs = Date.now() - study.activityStartedAt;

  get("begin-activity").disabled = true;
  get("stop-activity").disabled = true;

  get("recording-state").textContent = "Recording stopped.";
  get("recording-state").className = "recording-state";

  logEvent("activity_end", {
    duration_ms: durationMs,
    false_toss: study.counts.toss,
    false_flick: study.counts.flick,
  });

  nextStep();
}

get("stop-activity").addEventListener("click", endActivity);

get("stop-activity").addEventListener("click", endActivity);

// SURVEY
// save the answers, end the session and download this participant's CSV.
get("survey-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!study || STEPS[study.step] !== "survey") return;

  const answers = Object.fromEntries(new FormData(get("survey-form")));
  logEvent("survey_response", answers);

  logEvent("session_end", {
    false_toss: study.counts.toss,
    false_flick: study.counts.flick,
    toss_correct: study.results.toss,
    flick_correct: study.results.flick,
  });

  let exportNote = "CSV downloaded.";
  try {
    const events = getSavedEvents().filter(
      (e) => e.session_id === study.sessionId,
    );
    exportCSV(
      events,
      `${study.id}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  } catch (error) {
    console.error("Auto-export failed:", error);
    exportNote = "Auto-export FAILED — tap Export CSV now.";
  }

  showResults(
    `Participant ${study.id} · Toss ${study.results.toss}/${TOTAL_TRIALS} · ` +
      `Flick ${study.results.flick}/${TOTAL_TRIALS} · ` +
      `False activations: toss ${study.counts.toss}, flick ${study.counts.flick}. ${exportNote}`,
  );
});

// START ANOTHER TEST

// START ANOTHER TEST

get("new-test").addEventListener("click", () => {
  clearTimeout(nextTrialTimer);
  clearInterval(activityTimer);

  study = null;
  document.body.dataset.studyPhase = "setup";

  showScreen("setup-screen");
});

// GESTURE DETECTION

// Receive recognition events from Alexandros's and Tigo's detectors.
window.addEventListener("gesture-detected", (event) => {
  const gesture = event.detail?.gesture;

  if (!study || (gesture !== "toss" && gesture !== "flick")) {
    return;
  }

  // accuracy: record every detection; the attempt is scored when the participant taps the button.
  if (study.mode === "accuracy" && study.trialActive) {
    study.trialDetections.push(gesture);

    logEvent("gesture_detected", {
      gesture_detected: gesture,
      detector_timestamp_ms: event.detail?.timestamp_ms ?? Date.now(),
      trial_number: study.trial,
      source: event.detail?.source ?? "detector",
    });
  }

  // accidental: count both gesture types while recording is active.
  if (study.mode === "accidental" && study.activityActive) {
    study.counts[gesture]++;

    logEvent("gesture_detected", {
      gesture_detected: gesture,
      detector_timestamp_ms: event.detail?.timestamp_ms ?? Date.now(),
      activity_elapsed_ms: Date.now() - study.activityStartedAt,
      source: event.detail?.source ?? "detector",
    });
  }
});

// INITIAL SCREEN

showScreen("setup-screen");
document.body.dataset.studyPhase = "setup";

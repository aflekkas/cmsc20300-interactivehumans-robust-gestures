// GENERAL SETTINGS

const get = (id) => document.getElementById(id);

const TOTAL_TRIALS = 10;
const ACTIVITY_DURATION_MS = 60000;
const REST_MS = 2000;

const screens = [
  "setup-screen",
  "accuracy-screen",
  "accidental-screen",
  "results-screen"
];

const activityNames = {
  walking: "Walking with phone",
  pickup: "Picking up / putting down",
  handling: "Moving phone between hands",
  screen: "Using phone normally"
};

let study = null;
let activityTimer = null;
let nextTrialTimer = null;


// SCREEN MANAGEMENT
// Show the selected screen and hide the others.
function showScreen(screen) {
  for (const id of screens) {
    get(id).hidden = id !== screen;
  }

  get("sensor-panel").hidden =
    screen === "setup-screen" || screen === "results-screen";
}


// DATA LOGGING
// Send experiment information to the future logger.
function logEvent(type, extra = {}) {
  window.dispatchEvent(new CustomEvent("study-event", {
    detail: {
      event_type: type,
      timestamp_ms: Date.now(),
      participant_id: study.id,
      session_id: study.sessionId,
      mode: study.mode,
      gesture: study.mode === "accuracy" ? study.gesture : null,
      activity: study.mode === "accidental" ? study.activity : null,
      ...extra
    }
  }));
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


// EXPERIMENT SETUP
// Change the available options depending on the test type.
get("mode").addEventListener("change", () => {
  const accuracy = get("mode").value === "accuracy";

  get("gesture-choice").hidden = !accuracy;
  get("activity-choice").hidden = accuracy;
});

// Create a new test when the researcher presses Start Study.
get("setup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(nextTrialTimer);

  const id = get("participant").value.trim();
  if (!id) return;

  // Store the current participant and experiment information.
  study = {
    id,
    sessionId: `${id}_${Date.now()}`,
    mode: get("mode").value,
    gesture: get("gesture").value,
    activity: get("activity").value,

    started: false,

    // Accuracy test
    trial: 1,
    correct: 0,
    trialActive: false,
    trialDetections: [],
    trialStartedAt: null,

    // Accidental activation test
    counts: { toss: 0, flick: 0 },
    activityStartedAt: null,
    activityActive: false
  };

  if (study.mode === "accuracy") {
    get("accuracy-title").textContent =
      `${study.gesture === "toss" ? "Toss" : "Flick"} test`;

    get("accuracy-participant").textContent =
      `Participant ${id} · ${TOTAL_TRIALS} attempts`;

    get("trial-number").textContent = `1 / ${TOTAL_TRIALS}`;
    get("accuracy-correct").textContent = "0";

    get("finish-trial").disabled = true;
    get("invalidate-trial").disabled = true;

    showScreen("accuracy-screen");
    startTrial();

  } else {
    get("activity-title").textContent = activityNames[study.activity];
    get("activity-participant").textContent = `Participant ${id}`;

    get("activity-clock").textContent = "01:00";
    get("toss-count").textContent = "0";
    get("flick-count").textContent = "0";

    get("recording-state").textContent = "Not recording yet.";
    get("recording-state").className = "recording-state";

    get("begin-activity").disabled = false;
    get("stop-activity").disabled = true;

    showScreen("accidental-screen");
  }
});


// ACCURACY TEST

// Begin one intentional gesture attempt.
function startTrial() {
  if (!study || study.mode !== "accuracy" ||
      study.trialActive || study.trial > TOTAL_TRIALS) {
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
function endTrial(outcome) {
  if (!study || !study.trialActive) return;

  // Prevent the same attempt from being counted twice.
  study.trialActive = false;
  document.body.dataset.studyPhase = "between-attempts";

  const currentStudy = study;

  const trialInfo = {
    trial_number: study.trial,
    trial_started_at_ms: study.trialStartedAt,
    trial_ended_at_ms: Date.now(),
    detected_gestures: [...study.trialDetections]
  };

  get("finish-trial").disabled = true;
  get("invalidate-trial").disabled = true;

  if (outcome === "invalid") {
    // Retry without increasing the attempt number.
    logEvent("trial_invalidated", {
      ...trialInfo,
      reason: "attempt_not_completed"
    });

    get("trial-message").textContent =
      "Invalid attempt. Retrying in 2 seconds...";

  } else {
    if (outcome === "success") {
      study.correct++;
    }

    logEvent("trial_result", {
      ...trialInfo,
      expected_gesture: study.gesture,
      outcome
    });

    study.trial++;

    get("accuracy-correct").textContent = String(study.correct);
    get("trial-message").textContent = outcome === "success"
      ? "Gesture detected! Next attempt in 2 seconds..."
      : "Miss recorded. Next attempt in 2 seconds...";
  }

  // Finish after 10 valid attempts.
  if (study.trial > TOTAL_TRIALS) {
    logEvent("session_end", {
      correct: study.correct,
      valid_attempts: TOTAL_TRIALS
    });

    const percentage = Math.round(
      100 * study.correct / TOTAL_TRIALS
    );

    showResults(
      `Participant ${study.id} · ${study.gesture}: ` +
      `${study.correct}/${TOTAL_TRIALS} correct (${percentage}%).`
    );

    return;
  }

  get("trial-number").textContent =
    `${study.trial} / ${TOTAL_TRIALS}`;

  // Wait 2 seconds before the next attempt.
  clearTimeout(nextTrialTimer);

  nextTrialTimer = setTimeout(() => {
    if (study === currentStudy) startTrial();
  }, REST_MS);
}

// Manual buttons for missed or invalid attempts.
get("finish-trial").addEventListener("click", () => {
  endTrial("miss");
});

get("invalidate-trial").addEventListener("click", () => {
  endTrial("invalid");
});


// ACCIDENTAL ACTIVATION TEST

// Start recording the participant's everyday activity.
get("begin-activity").addEventListener("click", () => {
  if (!study || study.mode !== "accidental" ||
      study.activityActive || study.started) {
    return;
  }

  startSession();

  study.activityActive = true;
  study.activityStartedAt = Date.now();

  // Tell toss.js not to flash red during accidental testing.
  document.body.dataset.studyPhase = "accidental";

  get("recording-state").textContent = "Recording...";
  get("recording-state").className =
    "recording-state recording-active";

  get("begin-activity").disabled = true;
  get("stop-activity").disabled = false;

  logEvent("activity_start", {
    duration_target_ms: ACTIVITY_DURATION_MS
  });

  // Update the remaining time using actual timestamps.
  activityTimer = setInterval(() => {
    const elapsed = Date.now() - study.activityStartedAt;

    const remaining = Math.max(
      0,
      Math.ceil((ACTIVITY_DURATION_MS - elapsed) / 1000)
    );

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");

    get("activity-clock").textContent = `${minutes}:${seconds}`;

    if (elapsed >= ACTIVITY_DURATION_MS) {
      endActivity();
    }
  }, 200);
});

// Stop recording and calculate the results.
function endActivity() {
  if (!study || !study.activityActive) return;

  study.activityActive = false;
  clearInterval(activityTimer);
  activityTimer = null;

  const durationMs = Date.now() - study.activityStartedAt;
  const minutes = durationMs / 60000;

  get("begin-activity").disabled = true;
  get("stop-activity").disabled = true;

  get("recording-state").textContent = "Recording stopped.";
  get("recording-state").className = "recording-state";

  logEvent("activity_end", {
    duration_ms: durationMs,
    counts: { ...study.counts }
  });

  logEvent("session_end", { duration_ms: durationMs });

  showResults(
    `Participant ${study.id} · ${activityNames[study.activity]} · ` +
    `${Math.round(durationMs / 1000)}s. ` +
    `Toss: ${study.counts.toss} ` +
    `(${(study.counts.toss / minutes).toFixed(2)}/min). ` +
    `Flick: ${study.counts.flick} ` +
    `(${(study.counts.flick / minutes).toFixed(2)}/min).`
  );
}

get("stop-activity").addEventListener("click", endActivity);


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

  // Accuracy: count a success only when the expected gesture is detected.
  if (study.mode === "accuracy" && study.trialActive) {
    study.trialDetections.push(gesture);

    logEvent("gesture_detected", {
      gesture_detected: gesture,
      detector_timestamp_ms: event.detail?.timestamp_ms ?? Date.now(),
      trial_number: study.trial,
      source: event.detail?.source ?? "detector"
    });

    if (gesture === study.gesture) {
      endTrial("success");
    } else {
      get("trial-message").textContent =
        `Detected ${gesture}, but expected ${study.gesture}. ` +
        `Tap Missed if the intended gesture was not recognized.`;
    }
  }

  // Accidental: count both gesture types while recording is active.
  if (study.mode === "accidental" && study.activityActive) {
    study.counts[gesture]++;

    get(`${gesture}-count`).textContent =
      String(study.counts[gesture]);

    logEvent("gesture_detected", {
      gesture_detected: gesture,
      detector_timestamp_ms: event.detail?.timestamp_ms ?? Date.now(),
      activity_elapsed_ms: Date.now() - study.activityStartedAt,
      source: event.detail?.source ?? "detector"
    });
  }
});


// INITIAL SCREEN

showScreen("setup-screen");
document.body.dataset.studyPhase = "setup";

// gathering and processing experiment statistics: Kirill Sakson

// calculating the recognition rate for completed attempts
function recognitionRate(trials) {
  if (trials.length === 0) return "N/A";

  const correct = trials.filter(t => t.outcome === "success").length;
  return (100 * correct / trials.length).toFixed(1) + "%";
}

// displaying statistics inside a container
function renderStatistics(container, events) {
  container.replaceChildren();

  if (events.length === 0) {
    container.textContent = "No recorded data available.";
    return;
  }

  const trials = events.filter(e => e.event_type === "trial_result");

  const detections = events.filter(e => e.event_type === "gesture_detected");

  const wrong = detections.filter(e => e.mode === "accuracy" && e.gesture_detected !== e.gesture);

  const accidental = detections.filter(e => e.mode === "accidental");

  const sessions = new Set(events.map(e => e.session_id));

  const stats = [
    ["Sessions recorded", sessions.size]
  ];

  // intentional gestures
  if (events.some(e => e.mode === "accuracy")) {
    const correct = trials.filter(t => t.outcome === "success").length;
    const missed = trials.filter(t => t.outcome === "miss").length;

    const invalid = events.filter(e => e.event_type === "trial_invalidated").length;

    stats.push(
      ["Valid attempts", trials.length],
      ["Correct detections", correct],
      ["Missed activations", missed],
      ["Recognition rate", recognitionRate(trials)],
      ["Wrong-gesture detections", wrong.length],
      ["Invalid attempts", invalid]
    );

    // calculating recognition rates separately for toss and flick
    for (const gesture of ["toss", "flick"]) {
      const gestureTrials = trials.filter(t => t.gesture === gesture);

      if (gestureTrials.length > 0) {
        stats.push([
          `${gesture} recognition rate`,
          recognitionRate(gestureTrials)
        ]);
      }
    }

    // time from the trial prompt to the correct detection
    const delays = trials.filter(t => t.outcome === "success").map(trial => {
        const detection = detections.find(d =>
          d.session_id === trial.session_id &&
          d.trial_number === trial.trial_number &&
          d.gesture_detected === trial.gesture
        );

        if (!detection) return null;

        const delay = detection.detector_timestamp_ms - trial.trial_started_at_ms;
        return Number.isFinite(delay) && delay >= 0 ? delay : null;
    }).filter(delay => delay !== null);

    const averageDelay = delays.length > 0 ? (delays.reduce((sum, d) => sum + d, 0) / delays.length / 1000).toFixed(2) + " s" : "N/A";
    stats.push(["Mean prompt-to-detection delay", averageDelay]);
  }

  // unintentional gestures
  if (events.some(e => e.mode === "accidental")) {
    const toss = accidental.filter(e => e.gesture_detected === "toss").length;
    const flick = accidental.filter(e => e.gesture_detected === "flick").length;

    // using completed activity sessions for the rate calculation
    const completed = new Map(events
        .filter(e => e.event_type === "activity_end")
        .map(e => [e.session_id, e])
    );

    const durationMs = [...completed.values()].reduce((sum, e) => sum + e.duration_ms, 0);

    const minutes = durationMs / 60000;

    const completedDetections = accidental.filter(e => completed.has(e.session_id));

    stats.push(
      ["False Toss activations", toss],
      ["False Flick activations", flick],
      ["Total false activations", toss + flick],
      ["Completed observation time", minutes.toFixed(2) + " min"],
      ["False activations/min (completed tests)", minutes > 0 ? (completedDetections.length / minutes).toFixed(2) : "N/A"]
    );
  }

  // creating result cards
  const grid = document.createElement("div");
  grid.className = "metrics";

  for (const [label, value] of stats) {
    const item = document.createElement("div");
    const title = document.createElement("span");
    const number = document.createElement("strong");

    title.textContent = label;
    number.textContent = value;

    item.append(title, number);
    grid.appendChild(item);
  }
  container.appendChild(grid);
}

// showing the current session's statistics when it finishes
window.addEventListener("study-event", (event) => {
  if (event.detail.event_type !== "session_end") return;

  try {
    const events = getSavedEvents().filter(e => e.session_id === event.detail.session_id);
    renderStatistics(document.getElementById("session-statistics"), events);
  } catch (error) {
    console.error("Statistics calculation failed:", error);
    document.getElementById("session-statistics").textContent = "Could not calculate statistics.";
  }
});

// showing or hiding statistics for all saved participants
document.getElementById("view-stats").addEventListener("click", () => {
  const panel = document.getElementById("all-results");
  const button = document.getElementById("view-stats");

  if (!panel.hidden) {
    panel.hidden = true;
    button.textContent = "View saved statistics";
    return;
  }

  try {
    renderStatistics(document.getElementById("all-statistics"), getSavedEvents());
    panel.hidden = false;
    button.textContent = "Hide saved statistics";
  } catch (error) {
    console.error("Could not load saved statistics:", error);
    alert("Could not read saved experiment data.");
  }
});

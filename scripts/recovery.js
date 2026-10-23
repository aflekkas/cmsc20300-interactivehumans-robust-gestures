// local data management and recovery of an interrupted attempt: Kirill Sakson

const recoveryPanel = document.getElementById("recovery-panel");
const recoveryList = document.getElementById("unfinished-sessions");
const clearButton = document.getElementById("clear-events");
const clearStatus = document.getElementById("clear-status");

// modified file to -> suich that one session covers the entire phase (since it's continuous now)

// identify sessions that never recorded a session_end event
function refreshRecovery() {
  const sessions = new Map();

  for (const event of getSavedEvents()) {
    if (!event.session_id) continue;

    if (!sessions.has(event.session_id)) {
      sessions.set(event.session_id, {
        participant: event.participant_id,
        mode: event.mode,
        gesture: event.gesture,
        activity: event.activity,
        completed: false,
        attempts: 0,
        detections: 0,
      });
    }

    const session = sessions.get(event.session_id);
    session.lastPhase = event.phase ?? session.lastPhase;

    if (event.event_type === "trial_result") {
      session.attempts++;
    }

    if (
      event.event_type === "gesture_detected" &&
      event.mode === "accidental"
    ) {
      session.detections++;
    }

    if (event.event_type === "session_end") {
      session.completed = true;
    }
  }

  const unfinished = [...sessions.values()].filter((s) => !s.completed);
  recoveryList.replaceChildren();
  recoveryPanel.hidden = unfinished.length === 0;

  for (const session of unfinished) {
    const item = document.createElement("li");

    if (session.mode === "accuracy") {
      item.textContent =
        `Participant ${session.participant} - stopped during ${session.lastPhase ?? session.mode}: ` +
        `${session.attempts} attempts, ${session.detections} accidental detections.`;
    }
    recoveryList.appendChild(item);
  }
}

// check saved sessions when the website opens
try {
  refreshRecovery();
} catch (error) {
  console.error("Recovery check failed:", error);
  recoveryPanel.hidden = false;
  recoveryList.textContent = "Could not read saved sessions.";
}

// update recovery information when a session finishes
window.addEventListener("study-event", (event) => {
  if (event.detail.event_type === "session_end") {
    refreshRecovery();
  }
});

// delete local records only after explicit confirmation
clearButton.addEventListener("click", () => {
  const phase = document.body.dataset.studyPhase;

  // do not delete records during an active experiment
  if (
    ["accuracy", "accidental", "between-attempts", "intro", "survey"].includes(
      phase,
    )
  ) {
    clearStatus.textContent = "Finish the current experiment first.";
    return;
  }

  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith("hci-study-event:"),
    );

    if (keys.length === 0) {
      clearStatus.textContent = "No saved events to delete.";
      return;
    }

    const confirmation = prompt(
      `You are about to delete ${keys.length} saved events.\n` +
        "First export and verify your CSV backup.\n" +
        "Type DELETE to confirm:",
    );

    if (confirmation !== "DELETE") return;

    for (const key of keys) {
      localStorage.removeItem(key);
    }

    refreshRecovery();

    // reset displayed information
    document.getElementById("all-results").hidden = true;
    document.getElementById("view-stats").textContent = "View saved statistics";
    document.getElementById("log-status").textContent =
      "Logging ready. 0 events saved locally.";
    document.getElementById("session-statistics").textContent =
      "Local records cleared.";
    clearStatus.textContent = `${keys.length} events deleted. Keep your CSV backup.`;
  } catch (error) {
    console.error("Could not clear saved events:", error);
    clearStatus.textContent = "Failed to clear saved data.";
  }
});

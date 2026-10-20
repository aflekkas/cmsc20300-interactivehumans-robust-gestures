// logging capabilities: Kirill Sakson


const STORAGE_PREFIX = "hci-study-event:";
const statusText = document.getElementById("log-status");

// check previously saved data
try {
  const savedCount = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX)).length;
  statusText.textContent = `Logging ready. ${savedCount} events saved locally.`;
} catch (error) {
  console.error("Storage unavailable:", error);
  statusText.textContent = "Logging unavailable. Check browser storage.";
  document.querySelector("#setup-form button[type='submit']").disabled = true;
}

// save every study event as a separate record
window.addEventListener("study-event", (event) => {
  const record = event.detail;

  try {
    const key = `${STORAGE_PREFIX}${record.session_id}:${crypto.randomUUID()}`; // to not overwrite prev events
    localStorage.setItem(key, JSON.stringify(record));
    statusText.textContent = `Saved locally: ${record.event_type}`;
  } catch (error) {
    console.error("Failed to save event:", error);
    statusText.textContent = "SAVE FAILED — stop the experiment!";
  }
});

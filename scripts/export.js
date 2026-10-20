// exporting the logged info into .csv file: Kirill Sakson

const EXPORT_PREFIX = "hci-study-event:";
const exportButton = document.getElementById("export-csv");
const exportStatus = document.getElementById("export-status");

// retrieve all previously saved events from localStorage in the browser
function getSavedEvents() {
  const events = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key.startsWith(EXPORT_PREFIX)) continue;

    try {
      const event = JSON.parse(localStorage.getItem(key));
      events.push(event);
    } catch (error) {
      console.warn("Could not read event:", key, error);
    }
  }

  // sort events chronologically
  events.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  return events;
}

// converting js values into properly escaped CSV values
function csvCell(value) {
  if (value === null || value === undefined) return '""';

  const text = typeof value === "object" ? JSON.stringify(value) : String(value);

  // prevent text from being interpreted as a spreadsheet formula
  const safe = typeof value === "string" && /^\s*[=+\-@]/.test(text) ? "'" + text : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

// convert all saved events into a CSV and download it
exportButton.addEventListener("click", () => { // async might be added
  try {
    const events = getSavedEvents();

    if (events.length === 0) {
      exportStatus.textContent = "No saved events to export.";
      return;
    }

    // include every field present in any event -> flexible for further changes
    const columns = [
      "timestamp_iso",
      ...new Set(events.flatMap(event => Object.keys(event)))
    ];

    const rows = [
      columns.map(csvCell).join(","),
      ...events.map(event =>
        columns.map(column => {
          const value = column === "timestamp_iso" ? new Date(event.timestamp_ms).toISOString() : event[column];
          return csvCell(value);
        }).join(",")
      )
    ];

    const csv = rows.join("\r\n");

    // create the CSV file in memory
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    // ask the browser to download the file
    const link = document.createElement("a");
    link.href = url;
    link.download = `hci-study-events-${Date.now()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);

    exportStatus.textContent = `Export requested: ${events.length} events. Check Downloads.`;

/*
    const filename = `hci-study-events-${Date.now()}.csv`;
    const file = new File(["\uFEFF", csv], filename, {type: "text/csv"});

    // use the native share menu when file sharing is supported
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: "HCI Study Results"
            });
            exportStatus.textContent = `Share completed for ${events.length} events. Check Files.`;
        } catch (error) {
            if (error.name === "AbortError") {
                exportStatus.textContent = "Export cancelled.";
            } else {
                console.error("File sharing failed:", error);
                exportStatus.textContent = "File sharing failed: " + error.message;
            }
        }
        return;
    }

    // fallback: regular browser download
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);

    exportStatus.textContent = `Download requested for ${events.length} events. Check Downloads.`;*/
  } catch (error) {
    console.error("CSV export failed:", error);
    exportStatus.textContent = "Export failed. Please try again.";
  }
});
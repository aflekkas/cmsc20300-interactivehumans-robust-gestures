const startButton = document.getElementById("start");
const statusText = document.getElementById("status"); // temporary status text until UI is added by Maria

// return bool based on if motion permissions are accepted by user
async function getPermissions() {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    const result = await DeviceMotionEvent.requestPermission();

    if (result !== "granted") {
      statusText.textContent = "Permission denied";
      return false;
    }

    statusText.textContent = "Permission granted";
    return true;
  }
}

startButton.addEventListener("click", async () => {
  if (!getPermissions) return; // if permissions are not granted, exit
});

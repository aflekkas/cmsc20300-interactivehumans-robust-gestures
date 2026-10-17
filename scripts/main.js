import { tossUpdate } from "./toss.js";

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
  }

  return true;
}

function handleMotion(event) {
  const acceleration = event.accelerationIncludingGravity; // 9.8 rest, z: 0 free fall (goal for total)

  if (!acceleration) {
    statusText.textContent = "No acceleration data detected, check device";
    return;
  }

  const { x, y, z } = acceleration; // seperate acceleration on x, y, and z axis
  const totalForce = Math.sqrt(x * x + y * y + z * z); // total strength across all axes to produce 1 number (9.8 is gravity, so still)

  statusText.textContent = `Acceleration: (x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}) | Total Force: ${totalForce}`;

  // flickUpdate(idk) <- Tigo, func goes here
  tossUpdate(totalForce);
}

startButton.addEventListener("click", async () => {
  if (!(await getPermissions())) return; // if permissions are not granted, exit

  window.addEventListener("devicemotion", handleMotion); // start listening for motion
});

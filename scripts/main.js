const startButton = document.getElementById("start");
const statsText = document.getElementById("stats"); // temporary text to show measurements working (TBD if removed)

function getPerms() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const result = await DeviceMotionEvent.requestPermission();

        if (result !== 'granted') {
            
        }
    }
}

startButton.addEventListener('click', async () => { // async is needed for device popup
    
})

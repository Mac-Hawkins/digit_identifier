// Get references to HTML elements
const canvas = document.getElementById("drawing-canvas");
const predictButton = document.getElementById("predict-button");
const clearButton = document.getElementById("clear-button");
const predictionResult = document.getElementById("prediction-result");
const predictionConfidence = document.getElementById("prediction-confidence");
const mediaQuery = window.matchMedia("(max-width: 560px)");
const statusText = document.getElementById("backend-status");
const spinner = document.querySelector(".spinner");

// Gets the context for drawing on the canvas
let context = canvas.getContext("2d");

// Update the canvas size when the window is resized
function updateCanvasSize() {
  // Update canvas internal pixel grid to match the display size.
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // Re-retrieve the context for drawing on the canvas
  context = canvas.getContext("2d");

  // Fill the canvas with a consistent black background first.
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Sets the drawing style on the canvas.
  context.strokeStyle = "white";
  context.lineCap = "round";
  context.lineWidth = canvas.width / 10;
}

// Run on startup.
updateCanvasSize();

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// -------------------------------
// Try to start Render server when the page loads.
// -------------------------------

function updateStatusTimer(timeRemaining) {
  let minutes = Math.floor(timeRemaining / 60);
  let seconds = timeRemaining % 60;
  statusText.innerText =
    "Waking up backend. Please wait. May take up to 2 mins. \n Timer: " +
    minutes +
    ":" +
    seconds.toString().padStart(2, "0");
}

async function wakeBackend() {
  try {
    const response = await fetch(
      "https://digit-identifier-kgto.onrender.com/status",
    );
    return response.ok;
  } catch (error) {
    console.error("Error waking backend:", error);
    return false;
  }
}

window.addEventListener("load", async () => {
  // Disable the predict button until the backend is ready.
  predictButton.disabled = true;
  clearButton.disabled = true;

  let timeRemaining = 120;
  updateStatusTimer(timeRemaining);

  let ready = false;

  // Start countdown timer to update the status text every second while waiting for the backend to wake up.
  const countdown = setInterval(() => {
    timeRemaining -= 1;
    updateStatusTimer(timeRemaining);

    if (timeRemaining <= 0) {
      clearInterval(countdown);
    }
  }, 1000);

  // Begin waking up the backend, and try to get its status
  // for up to ~120 seconds
  for (let i = 0; i < 40; i++) {
    ready = await wakeBackend();
    if (ready) break;
    await new Promise((r) => setTimeout(r, 3000)); // wait 3 seconds
  }

  // Stop countdown when backend is ready or attempts end
  clearInterval(countdown);

  // Remove the spinner.
  if (spinner) {
    spinner.style.display = "none";
  }

  //  Update the status text based on whether the backend is ready or not
  statusText.innerText = ready
    ? "Backend is online"
    : "Backend is not responding";

  if (ready) {
    predictButton.disabled = false;
    clearButton.disabled = false;
    statusText.style.backgroundColor = "green";
  } else {
    statusText.style.backgroundColor = "red";
  }

  console.log("Backend ready:", ready);
});

// -------------------------------
// Common Canvas Drawing Functions
// -------------------------------

// The cavas doesn't start at (0, 0) of entire webpage (client),
// so I need to calculate where the mouse is inside of the canvas relative to the entire webpage.
function getCanvasCoordinates(event) {
  const canvasRect = canvas.getBoundingClientRect();
  console.log("canvas left:", canvasRect.left, "canvas top:", canvasRect.top);
  console.log("clientX:", event.clientX, "clientY:", event.clientY);
  return {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  };
}

function recordLastCanvasCoordinates(x, y) {
  lastX = x;
  lastY = y;
}

function clearCanvas() {
  // Fill the canvas with a consistent black background.
  // Apparently just clearing the canvas will make it internally use a transparent background,
  // even though it will appear black due to the CSS styling.
  // So we need to explicitly fill it with black.
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCanvasLine(x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

// -------------------------------
// Mouse Event Listeners
// -------------------------------

// Puts the canvas into drawing mode if the mouse is down.
canvas.addEventListener("mousedown", (event) => {
  isDrawing = true;

  // Clear the canvas when starting to draw.
  // I don't want the user to draw dots or other items around the number, as that would interfere with the prediction.
  // This also helps prevent the user from having to click a button to clear it.
  clearCanvas();

  const canvasCoords = getCanvasCoordinates(event);
  recordLastCanvasCoordinates(canvasCoords.x, canvasCoords.y);

  // Maybe draw a dot here in the future, just to make it look nicer when the user clicks without moving the mouse.
});

// Performs the drawing if the mouse is down and moving
canvas.addEventListener("mousemove", (event) => {
  if (!isDrawing) return;

  const canvasCoords = getCanvasCoordinates(event);
  const currentX = canvasCoords.x;
  const currentY = canvasCoords.y;

  // Draw a line from the last position to the current position.
  drawCanvasLine(lastX, lastY, currentX, currentY);

  recordLastCanvasCoordinates(currentX, currentY);
});

// Stop drawing if the mouse is up or leaves the canvas.
canvas.addEventListener("mouseup", () => (isDrawing = false));
canvas.addEventListener("mouseleave", () => (isDrawing = false));

// -------------------------------
// Mobile Event Listeners
// -------------------------------

// Mobile: Puts the canvas into drawing mode if touching.
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevents scrolling when touching the canvas.

  isDrawing = true;

  // Clear the canvas when starting to draw.
  // I don't want the user to draw dots or other items around the number, as that would interfere with the prediction.
  // This also helps prevent the user from having to click a button to clear it.
  clearCanvas();

  const touchEvent = event.touches[0]; // Get the first touch point event.
  const canvasCoords = getCanvasCoordinates(touchEvent);
  recordLastCanvasCoordinates(canvasCoords.x, canvasCoords.y);
});

// Mobile: Performs the drawing if touching and moving
canvas.addEventListener("touchmove", (event) => {
  event.preventDefault(); // Prevents scrolling when touching the canvas.

  if (!isDrawing) return;

  const touchEvent = event.touches[0]; // Get the first touch point event.
  const canvasCoords = getCanvasCoordinates(touchEvent);
  const currentX = canvasCoords.x;
  const currentY = canvasCoords.y;

  // Draw a line from the last position to the current position.
  drawCanvasLine(lastX, lastY, currentX, currentY);

  recordLastCanvasCoordinates(currentX, currentY);
});

// Mobile: Stop drawing if the touch ends or leaves the canvas.
canvas.addEventListener("touchend", () => (isDrawing = false));
canvas.addEventListener("touchcancel", () => (isDrawing = false));

// -------------------------------
// Button Event Listeners
// -------------------------------

predictButton.addEventListener("click", async () => {
  predictionResult.textContent = "Predicting...";
  predictionConfidence.textContent = "Predicting...";

  // Should get the pixel data and convert it to a base64 string to send to the backend for prediction.
  const pixelDataBase64 = canvas.toDataURL("image/png").split(",")[1];

  try {
    const response = await fetch(
      "https://digit-identifier-kgto.onrender.com/predict",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: pixelDataBase64 }),
      },
    );

    if (!response.ok) {
      console.error("Prediction request failed:", response.statusText);
      return;
    }

    const result = await response.json();

    // Display the prediction result in the paragraph element.
    predictionResult.textContent = `Prediction: ${result.prediction}`;
    predictionConfidence.textContent = `Confidence: ${result.confidence}`;
  } catch (error) {
    console.error("Error during prediction:", error);
    predictionResult.textContent = `Error during prediction: ${error.message}`;
    predictionConfidence.textContent = `Error during prediction: ${error.message}`;
  }
});

clearButton.addEventListener("click", () => {
  clearCanvas();
  predictionResult.textContent = "Prediction:";
  predictionConfidence.textContent = "Confidence:";
});

// -------------------------------
// Media Query Listeners
// -------------------------------

mediaQuery.addEventListener("change", (event) => {
  updateCanvasSize();
});

// Get references to HTML elements
const canvas = document.getElementById("drawing-canvas");
const predictButton = document.getElementById("predict-button");
const predictionParagraph = document.getElementById("prediction-result");
const predictionHeading = document.getElementById("prediction-result-heading");

// Gets the context for drawing on the canvas
const context = canvas.getContext("2d");

// Sets the drawing style on the canvas
context.fillStyle = "white";
context.strokeStyle = "white";
context.lineCap = "round";
context.lineWidth = 15;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// -------------------------------
// Try to start Render server when the page loads.
// -------------------------------

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

  const statusText = document.getElementById("backend-status");
  statusText.innerText = "Waking up backend…please wait";

  let ready = false;

  // Try for up to ~120 seconds
  for (let i = 0; i < 40; i++) {
    ready = await wakeBackend();
    if (ready) break;
    await new Promise((r) => setTimeout(r, 3000)); // wait 3 seconds
  }

  statusText.innerText = ready
    ? "Backend is online"
    : "Backend is not responding";

  if (ready) {
    predictButton.disabled = false;
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
  context.clearRect(0, 0, canvas.width, canvas.height);
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
// Predict Button Event Listener
// -------------------------------

predictButton.addEventListener("click", async () => {
  //predictionParagraph.textContent = `Predicting...please wait.`;
  predictionHeading.textContent = `Predicting...please wait.`;

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
    //predictionParagraph.textContent = `Predicted Digit: ${result.prediction}`;
    predictionHeading.textContent = `Prediction Result: ${result.prediction}`;
  } catch (error) {
    console.error("Error during prediction:", error);
    //predictionParagraph.textContent = `Error during prediction: ${error.message}`;
    predictionHeading.textContent = `Error during prediction: ${error.message}`;
  }
});

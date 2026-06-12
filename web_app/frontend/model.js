// Get references to HTML elements
const canvas = document.getElementById("drawing-canvas");

// Gets the context for drawing on the canvas
let canvasContext = canvas.getContext("2d");

// Constants
const MNIST_IMAGE_DIMENSION = 28;
const IMAGE_CHANNELS = 1;
const MAX_PIXEL_VALUE = 255.0;
const MODEL_PATH = "./models/mnist_cnn_model/converted/model.json";

let model = null;

// Load the pre-trained model in.
export async function loadModel() {
  try {
    model = await tf.loadGraphModel(MODEL_PATH);
  } catch (error) {
    console.error("Error loading model:", error);
  }
  return model !== null;
}

async function cropImageToDigit(image) {
  // greater and squeeze can create tensors that we need to dispose of to free memory,
  // so we wrap them in tf.tidy to automatically clean up intermediate tensors.
  const mask = tf.tidy(() => {
    // Create a binary mask where non-zero pixels are marked as 1 (true) and zero pixels are marked as 0 (false).
    const maskedPixels = image.greater(0);

    // Remove the channel dimension if it exists, since we only need a 2D mask for cropping.
    // The original image has shape (height, width, channels),
    // and we want to work with a 2D mask of shape (height, width).
    return maskedPixels.squeeze(-1);
  });

  // Get the non-zero rows and columns in the mask to determine the bounding box of the digit.
  const nonzeroRows = tf.tidy(() => mask.any(1)); // axis 1 = rows
  const nonzeroCols = tf.tidy(() => mask.any(0)); // axis 0 = columns

  // Get the boolean masks as arrays to find the indices of non-zero rows and columns.
  const rowMask = await nonzeroRows.data();
  const colMask = await nonzeroCols.data();

  // Get the indices of the non-zero rows and columns
  const rowIdxs = [];
  for (let i = 0; i < rowMask.length; i++) {
    if (rowMask[i]) rowIdxs.push(i);
  }

  const colIdxs = [];
  for (let i = 0; i < colMask.length; i++) {
    if (colMask[i]) colIdxs.push(i);
  }

  const rowSize = rowIdxs.length;
  const colSize = colIdxs.length;

  // This shouldn't happen since we check for empty canvas before calling predict,
  // but if it does, we return the original image to avoid errors in cropping.
  if (rowSize === 0 || colSize === 0) {
    console.warn(
      "WARNING: No non-zero pixels found. Returning original image.",
    );
    mask.dispose();
    nonzeroRows.dispose();
    nonzeroCols.dispose();
    return image;
  }

  // Find the bounding box of the digit by taking the min and max indices of the non-zero rows and columns.
  const top = rowIdxs[0];
  const bottom = rowIdxs[rowIdxs.length - 1];
  const left = colIdxs[0];
  const right = colIdxs[colIdxs.length - 1];

  if (bottom < top || right < left) {
    console.warn("Invalid crop bounds detected", { top, bottom, left, right });
    mask.dispose();
    nonzeroRows.dispose();
    nonzeroCols.dispose();
    return image;
  }

  // Crop the image to the bounding box of the digit. We add 1 to bottom and right because slice is exclusive on the end index.
  // The slice is from (top, left, 0) to size (bottom - top + 1, right - left + 1, number of channels) as dimensions are (height, width, channels).
  const cropped = image.slice(
    [top, left, 0],
    [bottom - top + 1, right - left + 1, image.shape[2]],
  );

  mask.dispose();
  nonzeroRows.dispose();
  nonzeroCols.dispose();
  return cropped;
}

// Pad the cropped image to be centered in a 28x28 box
function padAndCenterDigit(cropped) {
  // MNIST digits typically have a small margin around them, so we can add a padding of 2 pixels on each side.
  const padding = 2;

  // Get the height and width of the cropped image
  const height = cropped.shape[0];
  const width = cropped.shape[1];

  // Calculate scale to fit in target size with padding
  // We do 2 * padding because we want to leave a margin of 'padding' pixels on each side
  // as the MNIST data has a standard size of 28x28 pixels with a small margin
  // probably around 2 pixels on each side.
  const maxDim = Math.max(height, width);
  const scaleFactor = (MNIST_IMAGE_DIMENSION - 2 * padding) / maxDim;

  // Get the new dimensions for the cropped image to fit within the 28x28 box while maintaining aspect ratio
  const newHeight = Math.round(height * scaleFactor);
  const newWidth = Math.round(width * scaleFactor);

  // Resize cropped image to newly scaled dimensions.
  // Resize Billinear is a good choice for resizing images as it provides a balance between quality and performance.
  const resized = tf.image.resizeBilinear(cropped, [newHeight, newWidth]);

  // Calculate padding needed to center the resized image in a 28x28 box.
  // We want to split the remaining space evenly on top/bottom and left/right.
  const remainingHeight = MNIST_IMAGE_DIMENSION - padding * 2 - newHeight; // Calculate remaining height after accounting for padding and resized image
  const paddingTop = Math.floor(remainingHeight / 2) + padding; // / 2 to split remaining space evenly on top and bottom, + padding to account for initial padding
  const paddingBottom = MNIST_IMAGE_DIMENSION - newHeight - paddingTop; // Calculate bottom padding to fill the rest of the space after accounting for resized image and top padding
  const remainingWidth = MNIST_IMAGE_DIMENSION - padding * 2 - newWidth;
  const paddingLeft = Math.floor(remainingWidth / 2) + padding;
  const paddingRight = MNIST_IMAGE_DIMENSION - newWidth - paddingLeft;

  // Pad the resized image to be centered in a 28x28 box
  // The padding is applied in the order of height, width, and channels.
  const padded = tf.pad(resized, [
    [paddingTop, paddingBottom], // height padding
    [paddingLeft, paddingRight], // width padding
    [0, 0], // no padding for channels
  ]);

  // Dispose intermediate tensor 'resized' but keep 'padded'
  resized.dispose();

  return padded;
}

async function preprocessImage(img) {
  // Create a tensor from the image
  // '1' forces conversion to Grayscale immediately.
  let imageTensor = tf.browser.fromPixels(img, 1);

  // Crop to content and center
  imageTensor = await cropImageToDigit(imageTensor);
  imageTensor = await padAndCenterDigit(imageTensor);

  // Add a batch dimension to the image so that it has the shape (1, height, width, channels).
  // The model expects a batch of images as input, even if we are only predicting on one image, so we need to add this extra dimension.
  imageTensor = tf.expandDims(imageTensor, 0);

  // At this point `pad_and_center_digit` ensures image is MNIST-sized.
  // Normalize the pixel values to the range [0, 1].
  imageTensor = tf.cast(imageTensor, "float32").div(MAX_PIXEL_VALUE);

  return imageTensor;
}

export async function predictDigit() {
  if (!model) {
    throw new Error("Model not loaded yet");
  }

  // Convert canvas to an image URL (data URI).
  const dataUrl = canvas.toDataURL("image/png");

  // Create the image element.
  const img = new Image();
  img.src = dataUrl;

  // Wait for the image to load before reading the pixels.
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const processedImage = await preprocessImage(img);

  // Make a prediction using the model. The output will be a tensor of shape (1, 10) containing the probabilities for each digit class.
  const prediction = model.predict(processedImage);

  // Get the predicted class (the index of the highest probability)
  const predictedClass = prediction.argMax(1).dataSync()[0];

  // Calculate confidence: get the probability of the predicted class
  // .dataSync() returns Float32Array. We take the value at the index of the prediction.
  const maxProb = prediction.dataSync()[predictedClass];
  const confidence = Math.round(maxProb * 100); // Convert to percentage

  // Clean up tensors to free memory
  processedImage.dispose();
  prediction.dispose();
  return { class: predictedClass, confidence: confidence + "%" };
}

from fastapi import FastAPI
from pydantic import BaseModel
import tensorflow as tf
import base64
from fastapi.middleware.cors import CORSMiddleware

# Constants
MNIST_IMAGE_DIMENSION = 28
IMAGE_CHANNELS = 1
MAX_PIXEL_VALUE = 255.0

# Class to represent pixel data from the frontend.
class Image(BaseModel):
    data: str  # base64 string from the frontend. Each pixel value will be represented by it's corresponding char.

# Load the pre-trained model in.
model = tf.keras.models.load_model('models/mnist_cnn_model/mnist_cnn_model.keras')

app = FastAPI()

# Needed to allow for CORS (Cross-Origin Resource Sharing) so that the frontend can communicate with the backend without issues.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",            # local dev
        "http://localhost:3000",
        "https://mac-hawkins.github.io",    # my repo / pages
        "https://mac-hawkins.github.io/digit_identifier/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/status")
def root():
    return {"message": "Backend is running"}

def crop_image_to_digit(image: tf.Tensor):

    # Determine which rows / cols contain any non-zero pixel (across width/channels or height/channels)
    # tf.reduce_any returns a boolean tensor indicating which elements (rows/cols) are non-zero
    # image should currently be in the shape of (height, width, channels)
    nonzero_rows = tf.reduce_any(image > 0, axis=[1, 2])  # shape (height,)
    nonzero_cols = tf.reduce_any(image > 0, axis=[0, 2])  # shape (width,)

    # Find the indices of the rows and columns that contain non-zero elements
    row_idxs = tf.where(nonzero_rows)
    col_idxs = tf.where(nonzero_cols)

    if tf.size(row_idxs) == 0 or tf.size(col_idxs) == 0:
        return image

    top = int(tf.reduce_min(row_idxs).numpy())
    bottom = int(tf.reduce_max(row_idxs).numpy())
    left = int(tf.reduce_min(col_idxs).numpy())
    right = int(tf.reduce_max(col_idxs).numpy())

    # Crop to bounding box
    # The first param "top:bottom" selects elements from the top to the bottom (row dimension)
    # The second param "left:right" selects elements from the left to the right (column dimension)
    # The third param ":" selects all elements along the channel dimension
    cropped = image[top:(bottom+1), left:(right+1), :]

    return cropped


# Pad and center the digit in the image as MNIST data doesn't have digits touching edges.
# They have a small margin instead.
def pad_and_center_digit(image: tf.Tensor) -> tf.Tensor:
    padding = 2

    # Get current dimensions.
    # Remember that the image has shape (height, width, channels),
    # so we access the height and width using indices [1] and [2] respectively.
    height = tf.cast(tf.shape(image)[0], tf.float32)
    width = tf.cast(tf.shape(image)[1], tf.float32)

    # Calculate scale to fit in target size with padding
    # We do 2 * padding because we want to leave a margin of 'padding' pixels on each side
    # as the MNIST data has a standard size of 28x28 pixels with a small margin 
    # probably around 2 pixels on each side.
    max_dimension = tf.maximum(height, width)
    scale = (MNIST_IMAGE_DIMENSION - 2 * padding) / max_dimension
    
    new_height = tf.cast(height * scale, tf.int32)
    new_width = tf.cast(width * scale, tf.int32)
    
    # Resize cropped image to newly scaled dimensions
    resized = tf.image.resize(image, (new_height, new_width))
    
    # Pad to center in target size to make it more similiar to MNIST dataset.
    remaining_height = MNIST_IMAGE_DIMENSION - padding * 2 - new_height
    pad_top = padding + remaining_height // 2
    pad_bottom = MNIST_IMAGE_DIMENSION - new_height - pad_top
    remaining_width = MNIST_IMAGE_DIMENSION - padding * 2 - new_width
    pad_left = padding + remaining_width // 2
    pad_right = MNIST_IMAGE_DIMENSION - new_width - pad_left
    
    centered = tf.pad(resized, [[pad_top, pad_bottom], [pad_left, pad_right], [0, 0]])

    return centered


def preprocess_image(image_data: str) -> tf.Tensor:

    # Remove the data URL prefix. Not sure if I need this, but I'll keep it commented out just in case.
    #image_data = image_data.split(",")[1]

    # Clean whitespace and escaped characters
    image_data = (
        image_data
        .replace("\n", "")
        .replace("\r", "")
        .replace(" ", "")
        .replace("\\/", "/")
    )

    # Convert the cleaned base64 string to bytes. The base64.b64decode function will handle any necessary padding.
    image_bytes = base64.b64decode(image_data)

    # Decode PNG to tensor. The 'channels=1' argument ensures that the image is treated as grayscale, which is appropriate for MNIST data.
    image = tf.io.decode_png(image_bytes, channels=1)
    
    # Crop to content and center
    image = crop_image_to_digit(image)
    image = pad_and_center_digit(image)

    # Add a batch dimension to the image so that it has the shape (1, height, width, channels).
    image = tf.expand_dims(image, axis=0)

    # At this point `pad_and_center_digit` ensures image is MNIST-sized.
    # Normalize the pixel values to the range [0, 1].
    image = tf.cast(image, tf.float32) / MAX_PIXEL_VALUE

    return image

@app.post("/predict")
def predict(image: Image):

    image = preprocess_image(image.data)
    
    # prediction will contain a list of probabilities for each digit, where each index corresponds to a digit (0-9).
    prediction = model.predict(image)

    # Get the index of the highest probability, which corresponds to its predicted digit.
    most_likely_digit = tf.argmax(prediction, axis=1).numpy()[0]
    predicted_digit = int(most_likely_digit)
    confidence = round(float(tf.reduce_max(prediction).numpy()), 2)

    return {"prediction": predicted_digit, "confidence": confidence}
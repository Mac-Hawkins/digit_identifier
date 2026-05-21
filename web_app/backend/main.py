from fastapi import FastAPI
from pydantic import BaseModel
import tensorflow as tf
import base64
from fastapi.middleware.cors import CORSMiddleware

# Constants
IMAGE_HEIGHT = 28
IMAGE_WIDTH = 28
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

    # Downscale the image to the expected dimensions (uses bilinear interpolation by default) and add a channel dimension.
    image = tf.image.resize(image, (IMAGE_HEIGHT, IMAGE_WIDTH))
    
    # Normalize the pixel values to the range [0, 1].
    image = tf.cast(image, tf.float32) / MAX_PIXEL_VALUE

    # Add a batch dimension to the image array to match the input shape expected by the model (1, 28, 28, 1).
    image = tf.expand_dims(image, axis=0) 

    return image

@app.post("/predict")
def predict(image: Image):

    image = preprocess_image(image.data)
    
    # prediction will contain a list of probabilities for each digit, where each index corresponds to a digit (0-9).
    prediction = model.predict(image)

    # Get the index of the highest probability, which corresponds to its predicted digit.
    most_likely_digit = tf.argmax(prediction, axis=1).numpy()[0]
    predicted_digit = int(most_likely_digit)

    return {"prediction": predicted_digit}
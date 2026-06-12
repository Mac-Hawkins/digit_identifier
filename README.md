# Welcome to Digit Identifier

This project is web [page](https://mac-hawkins.github.io/digit_identifier/) that allows users draw a number from 0-9. A Convolutional Neural Network (CNN) will then predict what number was drawn and display that prediction to the user.

I originally made this project to gain more experience in Python, TensorFlow, Numpy, and machine learning. However, I realized that the free tier of many web hosting services required time to spin up the server, and I wanted the user to be able to draw a digit and start the prediction immediately instead of having to wait. To reduce this wait time, I decided to convert the logic from Python to JavaScript, removing the need for the backend server entirely.

This project taught me about the tradeoffs between server-side and client-side ML inference, model format conversion, and the importance of formatting input data to match training data for accurate model predictions.

## Dataset

The CNN was trained using TensorFlow and the [MNIST](https://en.wikipedia.org/wiki/MNIST_database) dataset. This dataset contains greyscale images of white numbers on a black background. These images are of size 28x28 pixels.

Samples from MNIST Dataset.
![Images of MNIST Dataset Digits](https://upload.wikimedia.org/wikipedia/commons/b/b1/MNIST_dataset_example.png)

## Tech Stack

- **Machine Learning**: TensorFlow / TensorFlow.js
- **Frontend**: HTML, CSS, JavaScript
- **Hosting**: GitHub Pages

## How it Works

1. The model was trained in Python using Keras on the MNIST dataset.

2. It was converted to TensorFlow.js format using the tensorflowjs_converter.

3. The web app loads the model directly in the browser via CDN, allowing for instant predictions without any backend server.

4. Users draw on an HTML5 Canvas, which is preprocessed (cropped, resized, normalized) before being passed to the model.

5. The model performs the prediction on the pre-processed image and returns the prediction class and confidence of the prediction.

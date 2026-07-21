import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export async function loadFaceApiModels() {
  if (modelsLoaded) return true;
  try {
    const MODEL_URL = '/models';
    
    // Tải các model phát hiện mặt, 68 điểm mốc và nhận diện đặc trưng
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    
    modelsLoaded = true;
    return true;
  } catch (error) {
    console.error('Failed to load Face API models:', error);
    return false;
  }
}

export { faceapi };

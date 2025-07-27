// DOM Elements
const webcam = document.getElementById('webcam');
const capturedImage = document.getElementById('capturedImage');
const startButton = document.getElementById('startButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const captureButton = document.getElementById('captureButton');
const countButton = document.getElementById('countButton');
const resetButton = document.getElementById('resetButton');
const countDisplay = document.querySelector('.count-number');
const processingInfo = document.getElementById('processingInfo');
const cameraInfo = document.getElementById('cameraInfo');

// Global Variables
let stream = null;
let session = null;
let currentImageData = null;
let currentDeviceId = null;
let availableCameras = [];
let currentCameraIndex = 0;

// YOLO Model Configuration
const MODEL_PATH = './models/pen_best2.onnx';
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.4;
const NMS_THRESHOLD = 0.4;
const CLASS_NAMES = ['Pen'];

/**
 * Debug function untuk mobile troubleshooting
 */
function debugMobileSupport() {
    console.log('=== MOBILE DEBUG INFO ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('HTTPS:', location.protocol === 'https:');
    console.log('MediaDevices available:', !!navigator.mediaDevices);
    console.log('getUserMedia available:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
    
    // Check for deprecated getUserMedia
    console.log('Legacy getUserMedia:', !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia));
    
    // Screen info
    console.log('Screen size:', screen.width, 'x', screen.height);
    console.log('Viewport size:', window.innerWidth, 'x', window.innerHeight);
    
    // Device detection
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    console.log('Mobile detected:', isMobile);
    console.log('iOS detected:', isIOS);
    console.log('Android detected:', isAndroid);
    
    // Browser detection
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    
    console.log('Chrome:', isChrome);
    console.log('Safari:', isSafari);
    console.log('Firefox:', isFirefox);
}

/**
 * Enhanced mobile error handling
 */
function handleCameraError(error) {
    let message = '';
    
    if (error.name === 'NotAllowedError') {
        message = 'Camera access denied. Please allow camera permission and try again.';
    } else if (error.name === 'NotFoundError') {
        message = 'No camera found on this device.';
    } else if (error.name === 'NotSupportedError') {
        message = 'Camera not supported on this browser.';
    } else if (error.name === 'NotReadableError') {
        message = 'Camera is being used by another app. Please close other apps and try again.';
    } else if (error.message.includes('getUserMedia not supported')) {
        message = 'This browser does not support camera access. Please use Chrome, Safari, or Firefox.';
    } else {
        message = `Camera error: ${error.message}`;
    }
    
    processingInfo.textContent = `❌ ${message}`;
    
    // Show user-friendly alert with mobile-specific instructions
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        alert(`${message}\n\nMobile Instructions:\n1. Make sure you're using HTTPS (not HTTP)\n2. Allow camera permission when prompted\n3. Close other apps using the camera\n4. Try refreshing the page\n5. Make sure you're using a supported browser (Chrome, Safari, Firefox)`);
    } else {
        alert(`${message}\n\nDesktop Instructions:\n1. Allow camera permission\n2. Make sure no other app is using the camera\n3. Try refreshing the page`);
    }
}

/**
 * Mobile-first camera detection with enhanced error handling
 */
async function detectCameras() {
    try {
        // Check if mediaDevices is available (critical for mobile)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported on this browser/device');
        }

        // Mobile-specific permission request
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            console.log('Mobile device detected, using mobile-optimized approach');
            
            // For mobile, try basic permission first
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 640, max: 1280 },
                        height: { ideal: 480, max: 720 }
                    }, 
                    audio: false 
                });
                tempStream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                console.error('Permission request failed:', permError);
                throw new Error('Camera permission denied or not available');
            }
        } else {
            // Desktop approach
            const tempStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: false 
            });
            tempStream.getTracks().forEach(track => track.stop());
        }

        // Get available devices after permission granted
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', availableCameras);
        
        if (availableCameras.length === 0) {
            throw new Error('No cameras found on this device');
        }

        // Update UI based on available cameras
        if (availableCameras.length > 1) {
            switchCameraButton.style.display = 'inline-block';
        } else {
            switchCameraButton.style.display = 'none';
        }

        return availableCameras;
    } catch (error) {
        console.error('Error detecting cameras:', error);
        handleCameraError(error);
        throw error;
    }
}

/**
 * Enhanced mobile camera constraints
 */
function getCameraConstraints(deviceId = null) {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let constraints = {
        video: {},
        audio: false
    };

    if (isMobile) {
        // Mobile-optimized constraints
        constraints.video = {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 },
            aspectRatio: { ideal: 4/3 }
        };

        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            // Default to back camera on mobile
            constraints.video.facingMode = { ideal: 'environment' };
        }

        // iOS specific optimizations
        if (isIOS) {
            constraints.video.width = { ideal: 640, max: 1024 };
            constraints.video.height = { ideal: 480, max: 768 };
            constraints.video.frameRate = { ideal: 15, max: 24 };
        }

        // Android specific optimizations
        if (isAndroid) {
            constraints.video.focusMode = { ideal: 'continuous' };
        }
    } else {
        // Desktop constraints
        constraints.video = {
            width: { ideal: 640, max: 1920 },
            height: { ideal: 480, max: 1080 },
            frameRate: { ideal: 30 }
        };

        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        }
    }

    console.log('Camera constraints for', isMobile ? 'mobile' : 'desktop', ':', constraints);
    return constraints;
}

/**
 * Mobile-optimized camera start function
 */
async function startCamera(deviceId = null) {
    try {
        // Stop existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Check browser support first
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported on this browser');
        }

        const constraints = getCameraConstraints(deviceId);
        
        processingInfo.textContent = 'Starting camera...';
        
        // Show loading animation
        startButton.textContent = '⏳ Starting...';
        
        // Try to get camera stream
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Assign to video element
        webcam.srcObject = stream;
        currentDeviceId = deviceId;

        // Wait for video to be ready with timeout
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Camera initialization timeout'));
            }, 10000); // 10 second timeout

            webcam.onloadedmetadata = () => {
                clearTimeout(timeout);
                webcam.play()
                    .then(resolve)
                    .catch(reject);
            };
            
            webcam.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });

        // Update UI on success
        startButton.textContent = '✅ Camera Active';
        startButton.disabled = true;
        captureButton.disabled = false;
        switchCameraButton.disabled = availableCameras.length <= 1;
        
        // Update camera info
        const activeTrack = stream.getVideoTracks()[0];
        const settings = activeTrack.getSettings();
        cameraInfo.textContent = `📹 ${settings.width}x${settings.height} - ${activeTrack.label || 'Camera Active'}`;
        
        processingInfo.textContent = '✅ Camera ready! Click "Capture Photo" to take a picture.';
        
        console.log('Camera started successfully:', settings);
        
    } catch (error) {
        console.error('Error starting camera:', error);
        
        // Mobile fallback attempts
        if (!deviceId) {
            const fallbackAttempts = [
                // Attempt 1: Basic mobile constraints
                {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    },
                    audio: false
                },
                // Attempt 2: Any camera
                {
                    video: {
                        width: { ideal: 320 },
                        height: { ideal: 240 }
                    },
                    audio: false
                },
                // Attempt 3: Minimal constraints
                {
                    video: true,
                    audio: false
                }
            ];

            for (let i = 0; i < fallbackAttempts.length; i++) {
                try {
                    console.log(`Trying fallback attempt ${i + 1}...`);
                    stream = await navigator.mediaDevices.getUserMedia(fallbackAttempts[i]);
                    webcam.srcObject = stream;
                    
                    startButton.textContent = '✅ Camera Active (Fallback)';
                    startButton.disabled = true;
                    captureButton.disabled = false;
                    processingInfo.textContent = '✅ Camera ready with fallback settings!';
                    
                    return; // Success, exit function
                } catch (fallbackError) {
                    console.error(`Fallback attempt ${i + 1} failed:`, fallbackError);
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        stream = null;
                    }
                }
            }
        }
        
        // All attempts failed
        startButton.textContent = '❌ Camera Failed';
        startButton.disabled = false;
        handleCameraError(error);
    }
}

/**
 * Switch between available cameras
 */
async function switchCamera() {
    if (availableCameras.length <= 1) return;
    
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    const newDeviceId = availableCameras[currentCameraIndex].deviceId;
    
    switchCameraButton.disabled = true;
    switchCameraButton.textContent = '🔄 Switching...';
    
    try {
        await startCamera(newDeviceId);
        switchCameraButton.textContent = '🔄 Switch Camera';
    } catch (error) {
        console.error('Error switching camera:', error);
        switchCameraButton.textContent = '❌ Switch Failed';
        setTimeout(() => {
            switchCameraButton.textContent = '🔄 Switch Camera';
        }, 2000);
    } finally {
        switchCameraButton.disabled = false;
    }
}

/**
 * Initialize cameras and start default camera
 */
async function initializeCamera() {
    try {
        await detectCameras();
        // Don't auto-start camera, let user click the button
        processingInfo.textContent = `Found ${availableCameras.length} camera(s). Click "Start Camera" to begin.`;
    } catch (error) {
        console.error('Camera initialization failed:', error);
        processingInfo.textContent = 'Camera initialization failed. Please check permissions.';
    }
}

/**
 * Capture image with enhanced mobile support
 */
function captureImage() {
    if (!stream) {
        alert('Camera not active. Please start camera first.');
        return;
    }

    const canvas = capturedImage;
    const ctx = canvas.getContext('2d');
    
    // Get actual video dimensions
    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;
    
    console.log('Video dimensions:', videoWidth, 'x', videoHeight);
    
    // Set canvas size to match video
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    // Clear canvas and draw current frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    
    // Get image data for inference
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Enable count button
    countButton.disabled = false;
    processingInfo.textContent = 'Photo captured successfully! Click "Count Objects" to analyze.';
    
    // Add visual feedback
    canvas.style.border = '3px solid #4CAF50';
    setTimeout(() => {
        canvas.style.border = '3px solid #e2e8f0';
    }, 1000);
}

/**
 * Debug model structure
 */
async function debugModelStructure() {
    if (!session) {
        console.log('Model not loaded yet');
        return;
    }

    console.log('=== MODEL DEBUG INFO ===');
    console.log('Input names:', session.inputNames);
    console.log('Output names:', session.outputNames);
    
    // Test with dummy input
    const dummyInput = new Float32Array(1 * 3 * 640 * 640).fill(0.5);
    const feeds = {};
    feeds[session.inputNames[0]] = new ort.Tensor('float32', dummyInput, [1, 3, 640, 640]);
    
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];
    
    console.log('Output tensor shape:', output.dims);
    console.log('Output data type:', output.type);
    console.log('Expected for single class: [1, 5, 8400]');
    console.log('Total output elements:', output.data.length);
    console.log('First 20 values:', Array.from(output.data.slice(0, 20)));
}

/**
 * Initialize ONNX Runtime session
 */
async function initializeModel() {
    try {
        processingInfo.textContent = 'Loading AI model...';
        
        // Test model file access
        const response = await fetch(MODEL_PATH);
        if (!response.ok) {
            throw new Error(`Cannot access model file: ${MODEL_PATH}`);
        }
        
        console.log('Model file accessible:', MODEL_PATH);
        
        session = await ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['webgl', 'wasm']
        });
        
        processingInfo.textContent = 'AI model loaded successfully!';
        console.log('ONNX Runtime session created successfully');
        
        // Debug model structure
        await debugModelStructure();
        
    } catch (error) {
        console.error('Error loading model:', error);
        processingInfo.textContent = `Error loading AI model: ${error.message}`;
        alert(`Error loading AI model: ${error.message}`);
    }
}

/**
 * Preprocess image for YOLO inference
 */
function preprocessImage(imageData) {
    const { data, width, height } = imageData;
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    
    // Create ImageData from original data
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');
    originalCanvas.width = width;
    originalCanvas.height = height;
    originalCtx.putImageData(imageData, 0, 0);
    
    // Resize to model input size with letterboxing
    const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (INPUT_SIZE - scaledWidth) / 2;
    const offsetY = (INPUT_SIZE - scaledHeight) / 2;
    
    // Fill with gray background
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    
    // Draw scaled image
    ctx.drawImage(originalCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    
    const resizedImageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    
    // Convert to tensor format [1, 3, 640, 640]
    const tensor = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const pixelData = resizedImageData.data;
    
    // Normalize pixel values (0-255 to 0-1) and arrange in CHW format
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        tensor[i] = pixelData[i * 4] / 255.0; // R
        tensor[INPUT_SIZE * INPUT_SIZE + i] = pixelData[i * 4 + 1] / 255.0; // G
        tensor[2 * INPUT_SIZE * INPUT_SIZE + i] = pixelData[i * 4 + 2] / 255.0; // B
    }
    
    return tensor;
}

/**
 * Run YOLO inference
 */
async function runInference(inputTensor) {
    try {
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];
        
        console.log('Input name:', inputName);
        console.log('Output name:', outputName);
        
        const feeds = {};
        feeds[inputName] = new ort.Tensor('float32', inputTensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
        
        const results = await session.run(feeds);
        const output = results[outputName];
        
        console.log('Output shape:', output.dims);
        console.log('Output data length:', output.data.length);
        
        return output.data;
    } catch (error) {
        console.error('Error during inference:', error);
        throw error;
    }
}

/**
 * Post-process YOLO output
 */
function postprocessOutput(output) {
    const detections = [];
    const numAnchors = 8400;
    
    console.log('Processing output with length:', output.length);
    console.log('Expected anchors:', numAnchors);
    
    // Parse data from [1, 5, 8400] format
    for (let i = 0; i < numAnchors; i++) {
        const x = output[i];
        const y = output[numAnchors + i];
        const w = output[2 * numAnchors + i];
        const h = output[3 * numAnchors + i];
        const confidence = output[4 * numAnchors + i];
        
        if (confidence > CONFIDENCE_THRESHOLD) {
            detections.push({
                x: x - w / 2,
                y: y - h / 2,
                width: w,
                height: h,
                confidence: confidence,
                classId: 0
            });
        }
    }
    
    console.log(`Found ${detections.length} detections before NMS`);
    return detections;
}

/**
 * Apply Non-Maximum Suppression
 */
function applyNMS(detections) {
    if (detections.length === 0) return [];
    
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const keepIndices = [];
    const suppressed = new Array(detections.length).fill(false);
    
    for (let i = 0; i < detections.length; i++) {
        if (suppressed[i]) continue;
        
        keepIndices.push(i);
        
        for (let j = i + 1; j < detections.length; j++) {
            if (suppressed[j]) continue;
            
            const iou = calculateIoU(detections[i], detections[j]);
            if (iou > NMS_THRESHOLD) {
                suppressed[j] = true;
            }
        }
    }
    
    const finalDetections = keepIndices.map(i => detections[i]);
    console.log(`After NMS: ${finalDetections.length} detections remaining`);
    return finalDetections;
}

/**
 * Calculate Intersection over Union
 */
function calculateIoU(box1, box2) {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
}

/**
 * Draw detection results on canvas
 */
function drawDetections(detections) {
    const canvas = capturedImage;
    const ctx = canvas.getContext('2d');
    
    // Redraw original image
    ctx.putImageData(currentImageData, 0, 0);
    
    // Scale factors
    const scaleX = canvas.width / INPUT_SIZE;
    const scaleY = canvas.height / INPUT_SIZE;
    
    console.log(`Drawing ${detections.length} detections`);
    
    // Draw bounding boxes
    detections.forEach((detection, index) => {
        const x = detection.x * scaleX;
        const y = detection.y * scaleY;
        const width = detection.width * scaleX;
        const height = detection.height * scaleY;
        
        // Draw bounding box
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        ctx.fillStyle = '#ff6b35';
        const className = CLASS_NAMES[detection.classId] || 'Unknown';
        const label = `${className} ${Math.round(detection.confidence * 100)}%`;
        ctx.font = '14px Arial';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        
        // Draw label text
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 5, y - 8);
        
        console.log(`Detection ${index}: ${label} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    });
}

/**
 * Main counting function
 */
async function countObjects() {
    if (!currentImageData || !session) {
        alert('Please capture an image and ensure AI model is loaded');
        return;
    }

    try {
        countButton.disabled = true;
        countButton.textContent = '⏳ Processing...';
        processingInfo.textContent = 'Processing image...';
        
        // Preprocess image
        const inputTensor = preprocessImage(currentImageData);
        console.log('Input tensor prepared, length:', inputTensor.length);
        
        // Run inference
        processingInfo.textContent = 'Running AI inference...';
        const output = await runInference(inputTensor);
        
        // Post-process results
        processingInfo.textContent = 'Processing results...';
        let detections = postprocessOutput(output);
        detections = applyNMS(detections);
        
        // Draw results
        drawDetections(detections);
        
        // Update count display
        countDisplay.textContent = detections.length;
        processingInfo.textContent = `✅ Found ${detections.length} Pen objects with confidence > ${CONFIDENCE_THRESHOLD * 100}%`;
        
        // Log final results
        console.log('=== FINAL RESULTS ===');
        console.log(`Total detections: ${detections.length}`);
        detections.forEach((det, i) => {
            console.log(`${i + 1}. Pen ${(det.confidence * 100).toFixed(1)}%`);
        });
        
    } catch (error) {
        console.error('Error during counting:', error);
        processingInfo.textContent = `❌ Error during processing: ${error.message}`;
        alert(`Error during processing: ${error.message}`);
    } finally {
        countButton.disabled = false;
        countButton.textContent = '🔢 Count Objects';
    }
}

/**
 * Reset application
 */
function resetApplication() {
    // Stop webcam
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // Reset UI
    startButton.textContent = '🎥 Start Camera';
    startButton.disabled = false;
    captureButton.disabled = true;
    countButton.disabled = true;
    switchCameraButton.disabled = true;
    countDisplay.textContent = '0';
    processingInfo.textContent = 'Ready to start...';
    cameraInfo.textContent = 'Camera not active';
    
    // Clear canvas
    const ctx = capturedImage.getContext('2d');
    ctx.clearRect(0, 0, capturedImage.width, capturedImage.height);
    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, capturedImage.width, capturedImage.height);
    
    // Reset variables
    currentImageData = null;
    currentDeviceId = null;
    currentCameraIndex = 0;
    
    console.log('Application reset completed');
    
    // Re-initialize cameras
    initializeCamera();
}

// Event Listeners
startButton.addEventListener('click', () => startCamera());
switchCameraButton.addEventListener('click', switchCamera);
captureButton.addEventListener('click', captureImage);
countButton.addEventListener('click', countObjects);
resetButton.addEventListener('click', resetApplication);

// Initialize when page loads
window.addEventListener('load', async () => {
    debugMobileSupport();
    await initializeModel();
    await initializeCamera();
});

// Handle orientation change on mobile
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (stream && webcam.srcObject) {
            // Restart camera after orientation change
            const currentDevice = currentDeviceId;
            setTimeout(() => {
                startCamera(currentDevice);
            }, 500);
        }
    }, 100);
});

// Handle visibility change (when user switches apps)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause when hidden
        if (webcam && !webcam.paused) {
            webcam.pause();
        }
    } else {
        // Resume when visible
        if (webcam && webcam.paused) {
            webcam.play().catch(console.error);
        }
    }
});

// iOS Safari specific fixes
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIOS) {
    // iOS requires user interaction before camera access
    document.addEventListener('touchstart', function onFirstTouch() {
        // Remove the event listener
        document.removeEventListener('touchstart', onFirstTouch);
        
        // Add iOS-specific video attributes
        webcam.setAttribute('playsinline', 'true');
        webcam.setAttribute('webkit-playsinline', 'true');
    });
}

// Android Chrome specific fixes
const isAndroid = /Android/.test(navigator.userAgent);
if (isAndroid) {
    // Android-specific optimizations
    webcam.setAttribute('playsinline', true);
    webcam.setAttribute('webkit-playsinline', true);
}

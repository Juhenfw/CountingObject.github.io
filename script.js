// DOM Elements
const webcam = document.getElementById('webcam');
const capturedImage = document.getElementById('capturedImage');
const startButton = document.getElementById('startButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const captureButton = document.getElementById('captureButton');
const countButton = document.getElementById('countButton');
const resetButton = document.getElementById('resetButton');
const retakeButton = document.getElementById('retakeButton');
const downloadButton = document.getElementById('downloadButton');
const selectAllButton = document.getElementById('selectAllButton');
const deselectAllButton = document.getElementById('deselectAllButton');
const countDisplay = document.querySelector('.count-number');
const processingInfo = document.getElementById('processingInfo');
const cameraInfo = document.getElementById('cameraInfo');
const imageInfo = document.getElementById('imageInfo');
const modelStatus = document.getElementById('modelStatus');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorModal = document.getElementById('errorModal');
const toast = document.getElementById('toast');
const performanceMonitor = document.getElementById('performanceMonitor');

// Global Variables
let stream = null;
let session = null;
let currentImageData = null;
let currentDeviceId = null;
let availableCameras = [];
let currentCameraIndex = 0;
let isProcessing = false;
let performanceData = {
    cameraResolution: '',
    inferenceTime: 0,
    totalProcessingTime: 0,
    memoryUsage: 0
};

// YOLO Model Configuration
const MODEL_PATH = './models/pen_best3.onnx';
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.4;
const NMS_THRESHOLD = 0.4;
const CLASS_NAMES = ['eraser', 'pencil', 'pencil sharpener', 'ruler', 'pen'];

// Filter Variables
let selectedClasses = new Set(['eraser', 'pencil', 'pencil sharpener', 'ruler', 'pen']);

/**
 * Enhanced utility functions
 */
function showToast(message, type = 'info', duration = 3000) {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, duration);
}

function showError(message, canRetry = true) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('retryButton').style.display = canRetry ? 'inline-block' : 'none';
    errorModal.style.display = 'block';
}

function hideError() {
    errorModal.style.display = 'none';
}

function updateModelStatus(status, text) {
    const statusDot = modelStatus.querySelector('.status-dot');
    const statusText = modelStatus.querySelector('.status-text');
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

function updatePerformanceMonitor() {
    if (performanceMonitor.style.display !== 'none') {
        document.getElementById('cameraRes').textContent = performanceData.cameraResolution;
        document.getElementById('inferenceTime').textContent = `${performanceData.inferenceTime}ms`;
        document.getElementById('totalTime').textContent = `${performanceData.totalProcessingTime}ms`;
        document.getElementById('memoryUsage').textContent = `${performanceData.memoryUsage}MB`;
    }
}

function getMemoryUsage() {
    if (performance.memory) {
        return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
}

/**
 * Enhanced object selection handlers
 */
function initializeObjectSelection() {
    const checkboxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]');
    const selectionCount = document.getElementById('selectionCount');
    
    function updateSelectionCount() {
        const checkedBoxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]:checked');
        selectionCount.textContent = `${checkedBoxes.length} objek dipilih`;
        
        // Update selected classes
        selectedClasses.clear();
        checkedBoxes.forEach(checkbox => {
            selectedClasses.add(checkbox.value);
        });
        
        // Update class breakdown display
        updateClassBreakdown();
        
        console.log('Selected classes:', Array.from(selectedClasses));
    }
    
    function updateClassBreakdown() {
        const classBreakdown = document.getElementById('classBreakdown');
        classBreakdown.innerHTML = '';
        
        CLASS_NAMES.forEach((className, index) => {
            const isSelected = selectedClasses.has(className);
            const card = document.createElement('div');
            card.className = `class-card ${isSelected ? 'active' : ''}`;
            
            const icons = ['🧹', '✏️', '🔧', '📏', '🖊️'];
            
            card.innerHTML = `
                <span class="class-card-icon">${icons[index]}</span>
                <div class="class-card-name">${className}</div>
                <div class="class-card-count">0</div>
            `;
            
            classBreakdown.appendChild(card);
        });
    }
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectionCount);
    });
    
    // Select/Deselect all buttons
    selectAllButton.addEventListener('click', () => {
        checkboxes.forEach(checkbox => checkbox.checked = true);
        updateSelectionCount();
        showToast('All objects selected', 'success');
    });
    
    deselectAllButton.addEventListener('click', () => {
        checkboxes.forEach(checkbox => checkbox.checked = false);
        updateSelectionCount();
        showToast('All objects deselected', 'info');
    });
    
    // Initialize
    updateSelectionCount();
}

/**
 * Enhanced mobile troubleshooting
 */
function debugMobileSupport() {
    console.log('=== ENHANCED MOBILE DEBUG INFO ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('HTTPS:', location.protocol === 'https:');
    console.log('MediaDevices available:', !!navigator.mediaDevices);
    console.log('getUserMedia available:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
    
    // Enhanced device detection
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isTablet = /iPad|Android(?=.*Mobile)/i.test(navigator.userAgent);
    
    console.log('Mobile detected:', isMobile);
    console.log('iOS detected:', isIOS);
    console.log('Android detected:', isAndroid);
    console.log('Tablet detected:', isTablet);
    
    // Screen and hardware info
    console.log('Screen size:', screen.width, 'x', screen.height);
    console.log('Viewport size:', window.innerWidth, 'x', window.innerHeight);
    console.log('Device pixel ratio:', window.devicePixelRatio);
    console.log('Hardware concurrency:', navigator.hardwareConcurrency);
    console.log('Memory:', navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown');
    
    // Network info
    if (navigator.connection) {
        console.log('Connection type:', navigator.connection.effectiveType);
        console.log('Downlink:', navigator.connection.downlink);
    }
    
    // Performance info
    if (performance.memory) {
        console.log('JS Heap Size:', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), 'MB');
        console.log('JS Heap Limit:', Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), 'MB');
    }
}

/**
 * Enhanced camera error handling
 */
function handleCameraError(error) {
    let message = '';
    let canRetry = true;
    
    if (error.name === 'NotAllowedError') {
        message = 'Camera access denied. Please allow camera permission and try again.';
    } else if (error.name === 'NotFoundError') {
        message = 'No camera found on this device.';
        canRetry = false;
    } else if (error.name === 'NotSupportedError') {
        message = 'Camera not supported on this browser.';
        canRetry = false;
    } else if (error.name === 'NotReadableError') {
        message = 'Camera is being used by another app. Please close other apps and try again.';
    } else if (error.message.includes('getUserMedia not supported')) {
        message = 'This browser does not support camera access. Please use Chrome, Safari, or Firefox.';
        canRetry = false;
    } else {
        message = `Camera error: ${error.message}`;
    }
    
    processingInfo.textContent = `❌ ${message}`;
    showError(message, canRetry);
    
    console.error('Camera error details:', {
        name: error.name,
        message: error.message,
        constraint: error.constraint
    });
}

/**
 * Enhanced camera detection with capabilities
 */
async function detectCameras() {
    try {
        updateModelStatus('loading', 'Detecting cameras...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported on this browser/device');
        }
        
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            console.log('Mobile device detected, using mobile-optimized approach');
            
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 }
                    },
                    audio: false
                });
                tempStream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                console.error('Permission request failed:', permError);
                throw new Error('Camera permission denied or not available');
            }
        } else {
            const tempStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            tempStream.getTracks().forEach(track => track.stop());
        }
        
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
        
        // Detect camera capabilities
        await detectCameraCapabilities();
        
        return availableCameras;
        
    } catch (error) {
        console.error('Error detecting cameras:', error);
        handleCameraError(error);
        throw error;
    }
}

/**
 * Enhanced camera capabilities detection
 */
async function detectCameraCapabilities() {
    const capabilities = [];
    
    for (const device of availableCameras) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: device.deviceId }
            });
            
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities();
            
            capabilities.push({
                deviceId: device.deviceId,
                label: device.label,
                maxWidth: caps.width?.max || 'Unknown',
                maxHeight: caps.height?.max || 'Unknown',
                maxFrameRate: caps.frameRate?.max || 'Unknown',
                focusMode: caps.focusMode || [],
                exposureMode: caps.exposureMode || []
            });
            
            stream.getTracks().forEach(track => track.stop());
            
        } catch (error) {
            console.log(`Could not get capabilities for ${device.label}`);
        }
    }
    
    console.log('Camera capabilities:', capabilities);
    
    // Update camera capabilities display
    const capabilitiesDiv = document.getElementById('cameraCapabilities');
    if (capabilities.length > 0) {
        const bestCam = capabilities.reduce((best, current) => 
            (current.maxWidth > best.maxWidth) ? current : best
        );
        capabilitiesDiv.textContent = `Best: ${bestCam.maxWidth}x${bestCam.maxHeight}`;
    }
}

/**
 * Enhanced mobile camera constraints for high quality
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
        // Enhanced mobile constraints for high quality
        constraints.video = {
            width: { 
                ideal: 1280, 
                max: 1920,     // Allow Full HD
                min: 640 
            },
            height: { 
                ideal: 720, 
                max: 1080,     // Allow Full HD
                min: 480 
            },
            frameRate: { 
                ideal: 30, 
                max: 60,       // Allow 60fps if supported
                min: 15 
            },
            aspectRatio: { ideal: 16/9 },
            
            // Enhanced mobile optimizations
            focusMode: { ideal: "continuous" },
            exposureMode: { ideal: "continuous" },
            whiteBalanceMode: { ideal: "continuous" }
        };
        
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            constraints.video.facingMode = { ideal: 'environment' };
        }
        
        // iOS specific high-quality optimizations
        if (isIOS) {
            constraints.video.width = { ideal: 1280, max: 1920, min: 640 };
            constraints.video.height = { ideal: 720, max: 1080, min: 480 };
            constraints.video.frameRate = { ideal: 30, max: 60, min: 24 };
            constraints.video.resizeMode = { ideal: "crop-and-scale" };
        }
        
        // Android specific high-quality optimizations
        if (isAndroid) {
            constraints.video.focusMode = { ideal: 'continuous' };
            constraints.video.focusDistance = { ideal: 0 };
            constraints.video.torch = false;
            constraints.video.zoom = { ideal: 1.0 };
        }
        
    } else {
        // Desktop constraints (enhanced)
        constraints.video = {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
        };
        
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        }
    }
    
    console.log('Enhanced camera constraints for', isMobile ? 'mobile' : 'desktop', ':', constraints);
    return constraints;
}

/**
 * Enhanced mobile-optimized camera start function
 */
async function startCamera(deviceId = null) {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported on this browser');
        }
        
        const constraints = getCameraConstraints(deviceId);
        processingInfo.textContent = 'Starting high-quality camera...';
        startButton.textContent = '⏳ Starting...';
        
        // Try high-quality first, then fallback
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (highQualityError) {
            console.warn('High-quality failed, trying fallback:', highQualityError);
            
            const fallbackConstraints = {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 25, max: 30 },
                    facingMode: deviceId ? undefined : { ideal: 'environment' }
                },
                audio: false
            };
            
            if (deviceId) {
                fallbackConstraints.video.deviceId = { exact: deviceId };
            }
            
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
        
        webcam.srcObject = stream;
        currentDeviceId = deviceId;
        
        // Enhanced video loading with smooth playback
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Camera initialization timeout'));
            }, 15000);
            
            webcam.onloadedmetadata = () => {
                clearTimeout(timeout);
                
                // Optimize video element for smooth playback
                webcam.playsInline = true;
                webcam.muted = true;
                webcam.autoplay = true;
                
                webcam.play()
                    .then(() => {
                        if (webcam.videoWidth && webcam.videoHeight) {
                            console.log(`Camera resolution: ${webcam.videoWidth}x${webcam.videoHeight}`);
                            
                            // Update performance data
                            performanceData.cameraResolution = `${webcam.videoWidth}x${webcam.videoHeight}`;
                            updatePerformanceMonitor();
                            
                            // Smooth rendering optimization
                            webcam.style.imageRendering = 'auto';
                            webcam.style.transform = 'translateZ(0)';
                        }
                        resolve();
                    })
                    .catch(reject);
            };
            
            webcam.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
        
        // Update UI on success
        const activeTrack = stream.getVideoTracks()[0];
        const settings = activeTrack.getSettings();
        
        startButton.textContent = '✅ Camera Active (HD)';
        startButton.disabled = true;
        captureButton.disabled = false;
        switchCameraButton.disabled = availableCameras.length <= 1;
        
        // Enhanced camera info display
        const resolution = `${settings.width}x${settings.height}`;
        const fps = settings.frameRate ? `@${Math.round(settings.frameRate)}fps` : '';
        cameraInfo.textContent = `📹 ${resolution}${fps} - ${activeTrack.label || 'Camera Active'}`;
        
        processingInfo.textContent = '✅ High-quality camera ready! Click "Capture Photo" to take a picture.';
        showToast('Camera started successfully', 'success');
        
        console.log('Enhanced camera started successfully:', settings);
        
    } catch (error) {
        console.error('Error starting camera:', error);
        
        // Enhanced fallback attempts for mobile
        if (!deviceId) {
            const enhancedFallbacks = [
                {
                    video: {
                        width: { ideal: 960, max: 1280 },
                        height: { ideal: 540, max: 720 },
                        frameRate: { ideal: 25, max: 30 },
                        facingMode: 'environment'
                    },
                    audio: false
                },
                {
                    video: {
                        width: { ideal: 640, max: 960 },
                        height: { ideal: 480, max: 540 },
                        frameRate: { ideal: 20, max: 25 },
                        facingMode: 'environment'
                    },
                    audio: false
                },
                {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    },
                    audio: false
                }
            ];
            
            for (let i = 0; i < enhancedFallbacks.length; i++) {
                try {
                    console.log(`Trying enhanced fallback ${i + 1}...`);
                    stream = await navigator.mediaDevices.getUserMedia(enhancedFallbacks[i]);
                    webcam.srcObject = stream;
                    
                    startButton.textContent = `✅ Camera Active (Fallback ${i + 1})`;
                    startButton.disabled = true;
                    captureButton.disabled = false;
                    processingInfo.textContent = '✅ Camera ready with optimized settings!';
                    showToast(`Camera started with fallback mode ${i + 1}`, 'warning');
                    return;
                    
                } catch (fallbackError) {
                    console.error(`Enhanced fallback ${i + 1} failed:`, fallbackError);
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        stream = null;
                    }
                }
            }
        }
        
        startButton.textContent = '❌ Camera Failed';
        startButton.disabled = false;
        handleCameraError(error);
    }
}

/**
 * Enhanced camera switching
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
        showToast(`Switched to camera ${currentCameraIndex + 1}`, 'success');
    } catch (error) {
        console.error('Error switching camera:', error);
        switchCameraButton.textContent = '❌ Switch Failed';
        showToast('Failed to switch camera', 'error');
        setTimeout(() => {
            switchCameraButton.textContent = '🔄 Switch Camera';
        }, 2000);
    } finally {
        switchCameraButton.disabled = false;
    }
}

/**
 * Enhanced camera initialization
 */
async function initializeCamera() {
    try {
        await detectCameras();
        processingInfo.textContent = `Found ${availableCameras.length} camera(s). Click "Start Camera" to begin.`;
        showToast(`Found ${availableCameras.length} camera(s)`, 'info');
    } catch (error) {
        console.error('Camera initialization failed:', error);
        processingInfo.textContent = 'Camera initialization failed. Please check permissions.';
    }
}

/**
 * Enhanced image capture with quality optimization
 */
function captureImage() {
    if (!stream) {
        showError('Camera not active. Please start camera first.');
        return;
    }
    
    const canvas = capturedImage;
    const ctx = canvas.getContext('2d');
    
    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;
    
    console.log('Video dimensions:', videoWidth, 'x', videoHeight);
    
    // Set canvas size to match video for best quality
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    // Enhanced canvas rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    
    // Get image data for inference
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Update performance data
    performanceData.memoryUsage = getMemoryUsage();
    updatePerformanceMonitor();
    
    // Enable buttons
    countButton.disabled = false;
    downloadButton.disabled = false;
    retakeButton.disabled = false;
    
    // Update image info
    imageInfo.textContent = `📷 ${videoWidth}x${videoHeight} - ${Math.round(currentImageData.data.length / 1024)}KB`;
    
    processingInfo.textContent = 'Photo captured successfully! Click "Count Objects" to analyze.';
    showToast('Photo captured successfully', 'success');
    
    // Visual feedback
    canvas.style.border = '3px solid #4CAF50';
    setTimeout(() => {
        canvas.style.border = '3px solid #e2e8f0';
    }, 1000);
}

/**
 * Enhanced model structure debugging for 5 classes
 */
async function debugModelStructure() {
    if (!session) {
        console.log('Model not loaded yet');
        return;
    }
    
    console.log('=== ENHANCED MODEL DEBUG INFO ===');
    console.log('Input names:', session.inputNames);
    console.log('Output names:', session.outputNames);
    
    const dummyInput = new Float32Array(1 * 3 * 640 * 640).fill(0.5);
    const feeds = {};
    feeds[session.inputNames[0]] = new ort.Tensor('float32', dummyInput, [1, 3, 640, 640]);
    
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];
    
    console.log('Output tensor shape:', output.dims);
    console.log('Output data type:', output.type);
    console.log('Expected for 5 classes: [1, 9, 8400]');
    console.log('Total output elements:', output.data.length);
    console.log('First 20 values:', Array.from(output.data.slice(0, 20)));
    
    // Enhanced verification
    const expectedSize = 1 * 9 * 8400; // 75,600
    if (output.data.length === expectedSize) {
        console.log('✅ Output structure matches 5-class model');
        updateModelStatus('ready', 'AI Model Ready (5 Classes)');
    } else {
        console.log('❌ Output structure mismatch. Expected:', expectedSize, 'Got:', output.data.length);
        updateModelStatus('error', 'Model Structure Mismatch');
    }
}

/**
 * Enhanced ONNX Runtime session initialization
 */
async function initializeModel() {
    try {
        loadingOverlay.style.display = 'flex';
        updateModelStatus('loading', 'Loading AI model...');
        processingInfo.textContent = 'Loading AI model...';
        
        // Test model file access
        const response = await fetch(MODEL_PATH);
        if (!response.ok) {
            throw new Error(`Cannot access model file: ${MODEL_PATH} (${response.status})`);
        }
        
        console.log('Model file accessible:', MODEL_PATH);
        
        // Enhanced session creation with optimizations
        session = await ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['webgl', 'wasm'],
            graphOptimizationLevel: 'all',
            executionMode: 'parallel'
        });
        
        loadingOverlay.style.display = 'none';
        updateModelStatus('ready', 'AI Model Ready');
        processingInfo.textContent = 'AI model loaded successfully!';
        showToast('AI model loaded successfully', 'success');
        
        console.log('ONNX Runtime session created successfully');
        
        // Debug model structure
        await debugModelStructure();
        
    } catch (error) {
        console.error('Error loading model:', error);
        loadingOverlay.style.display = 'none';
        updateModelStatus('error', 'Model Load Failed');
        processingInfo.textContent = `Error loading AI model: ${error.message}`;
        showError(`Error loading AI model: ${error.message}`, true);
    }
}

/**
 * Enhanced preprocessing with quality optimization
 */
function preprocessImage(imageData) {
    const startTime = performance.now();
    const { data, width, height } = imageData;
    
    // Create canvas for resizing with quality optimization
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    
    // Enhanced context settings for quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d');
    originalCanvas.width = width;
    originalCanvas.height = height;
    originalCtx.putImageData(imageData, 0, 0);
    
    // Calculate letterboxing with aspect ratio preservation
    const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (INPUT_SIZE - scaledWidth) / 2;
    const offsetY = (INPUT_SIZE - scaledHeight) / 2;
    
    // Fill with gray background (model expects gray padding)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    
    // Draw scaled image with high quality
    ctx.drawImage(originalCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    
    const resizedImageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    
    // Convert to tensor format [1, 3, 640, 640] with optimized loop
    const tensor = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const pixelData = resizedImageData.data;
    
    // Optimized tensor conversion
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        const pixelIndex = i * 4;
        tensor[i] = pixelData[pixelIndex] / 255.0; // R
        tensor[INPUT_SIZE * INPUT_SIZE + i] = pixelData[pixelIndex + 1] / 255.0; // G
        tensor[2 * INPUT_SIZE * INPUT_SIZE + i] = pixelData[pixelIndex + 2] / 255.0; // B
    }
    
    const preprocessTime = performance.now() - startTime;
    console.log(`Preprocessing completed in ${preprocessTime.toFixed(2)}ms`);
    
    return tensor;
}

/**
 * Enhanced YOLO inference with timing
 */
async function runInference(inputTensor) {
    try {
        const startTime = performance.now();
        
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];
        
        console.log('Input name:', inputName);
        console.log('Output name:', outputName);
        
        const feeds = {};
        feeds[inputName] = new ort.Tensor('float32', inputTensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
        
        const results = await session.run(feeds);
        const output = results[outputName];
        
        const inferenceTime = performance.now() - startTime;
        performanceData.inferenceTime = Math.round(inferenceTime);
        
        console.log('Output shape:', output.dims);
        console.log('Output data length:', output.data.length);
        console.log(`Inference completed in ${inferenceTime.toFixed(2)}ms`);
        
        return output.data;
        
    } catch (error) {
        console.error('Error during inference:', error);
        throw error;
    }
}

/**
 * Enhanced post-processing for 5 classes with improved filtering
 */
// Fungsi yang WAJIB ada untuk detection berfungsi:

// 1. postprocessOutput() - parsing hasil model YOLO
function postprocessOutput(output) {
    const detections = [];
    const numAnchors = 8400;
    const numClasses = CLASS_NAMES.length;
    
    for (let i = 0; i < numAnchors; i++) {
        const x = output[i];
        const y = output[numAnchors + i];
        const w = output[2 * numAnchors + i];
        const h = output[3 * numAnchors + i];
        
        for (let classIdx = 0; classIdx < numClasses; classIdx++) {
            const confidence = output[(4 + classIdx) * numAnchors + i];
            const className = CLASS_NAMES[classIdx];
            
            if (confidence > CONFIDENCE_THRESHOLD && selectedClasses.has(className)) {
                detections.push({
                    x: x - w / 2,
                    y: y - h / 2,
                    width: w,
                    height: w,
                    confidence: confidence,
                    classId: classIdx,
                    className: className
                });
            }
        }
    }
    return detections;
}

// 2. runInference() - menjalankan model AI
async function runInference(inputTensor) {
    const inputName = session.inputNames[0];
    const feeds = {};
    feeds[inputName] = new ort.Tensor('float32', inputTensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    
    const results = await session.run(feeds);
    return results[session.outputNames[0]].data;
}

// 3. countObjects() - fungsi utama detection
async function countObjects() {
    if (!currentImageData || !session) {
        showError('Please capture an image and ensure AI model is loaded');
        return;
    }
    
    try {
        countButton.disabled = true;
        countButton.textContent = '⏳ Processing...';
        
        const inputTensor = preprocessImage(currentImageData);
        const output = await runInference(inputTensor);
        let detections = postprocessOutput(output);
        detections = applyNMS(detections);
        
        drawDetections(detections);
        
        // Update display
        const totalCount = detections.length;
        countDisplay.innerHTML = `${totalCount}`;
        
        processingInfo.textContent = `✅ Found ${totalCount} objects`;
        
    } catch (error) {
        console.error('Error during counting:', error);
        processingInfo.textContent = `❌ Error: ${error.message}`;
    } finally {
        countButton.disabled = false;
        countButton.textContent = '🔢 Count Objects';
    }
}

/**
 * Enhanced Non-Maximum Suppression with class-aware filtering
 */
function applyNMS(detections) {
    if (detections.length === 0) return [];
    
    // Sort by confidence (highest first)
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const keepIndices = [];
    const suppressed = new Array(detections.length).fill(false);
    
    for (let i = 0; i < detections.length; i++) {
        if (suppressed[i]) continue;
        
        keepIndices.push(i);
        
        // Check against all remaining detections
        for (let j = i + 1; j < detections.length; j++) {
            if (suppressed[j]) continue;
            
            // Calculate IoU
            const iou = calculateIoU(detections[i], detections[j]);
            
            // Suppress if IoU is too high and same class
            if (iou > NMS_THRESHOLD && detections[i].classId === detections[j].classId) {
                suppressed[j] = true;
            }
        }
    }
    
    const finalDetections = keepIndices.map(i => detections[i]);
    console.log(`After NMS: ${finalDetections.length} detections remaining`);
    return finalDetections;
}

/**
 * Enhanced IoU calculation with error handling
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
    
    return union > 0 ? intersection / union : 0;
}

/**
 * Enhanced detection drawing with improved colors and labels
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
    
    // Enhanced color mapping with gradients
    const classColors = {
        'eraser': '#ff6b35',
        'pencil': '#4facfe',
        'pencil sharpener': '#7b68ee',
        'ruler': '#32cd32',
        'pen': '#ff1493'
    };
    
    const classIcons = {
        'eraser': '🧹',
        'pencil': '✏️',
        'pencil sharpener': '🔧',
        'ruler': '📏',
        'pen': '🖊️'
    };
    
    // Enhanced drawing with better visibility
    detections.forEach((detection, index) => {
        const x = detection.x * scaleX;
        const y = detection.y * scaleY;
        const width = detection.width * scaleX;
        const height = detection.height * scaleY;
        
        const color = classColors[detection.className] || '#ff6b35';
        const icon = classIcons[detection.className] || '📦';
        
        // Draw enhanced bounding box with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Reset shadow for text
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw enhanced label with icon
        const label = `${icon} ${detection.className} ${Math.round(detection.confidence * 100)}%`;
        ctx.font = 'bold 14px Arial';
        const textWidth = ctx.measureText(label).width;
        
        // Label background with gradient effect
        const gradient = ctx.createLinearGradient(x, y - 30, x + textWidth + 15, y - 5);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80'); // Add transparency
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y - 30, textWidth + 15, 25);
        
        // Label text with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 1;
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 7, y - 10);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        console.log(`Detection ${index}: ${label} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    });
}

/**
 * Enhanced counting function with detailed statistics
 */
async function countObjects() {
    if (!currentImageData || !session) {
        showError('Please capture an image and ensure AI model is loaded');
        return;
    }
    
    if (selectedClasses.size === 0) {
        showError('Pilih minimal satu objek untuk dihitung!');
        return;
    }
    
    if (isProcessing) {
        showToast('Processing already in progress...', 'warning');
        return;
    }
    
    isProcessing = true;
    const startTime = performance.now();
    
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
        
        // Enhanced count analysis
        const classCounts = {};
        const confidenceStats = {};
        
        detections.forEach(detection => {
            const className = detection.className;
            classCounts[className] = (classCounts[className] || 0) + 1;
            
            if (!confidenceStats[className]) {
                confidenceStats[className] = {
                    total: 0,
                    count: 0,
                    min: 1,
                    max: 0
                };
            }
            
            confidenceStats[className].total += detection.confidence;
            confidenceStats[className].count++;
            confidenceStats[className].min = Math.min(confidenceStats[className].min, detection.confidence);
            confidenceStats[className].max = Math.max(confidenceStats[className].max, detection.confidence);
        });
        
        // Update enhanced count display
        const totalCount = detections.length;
        const totalTime = performance.now() - startTime;
        performanceData.totalProcessingTime = Math.round(totalTime);
        performanceData.memoryUsage = getMemoryUsage();
        updatePerformanceMonitor();
        
        countDisplay.innerHTML = `${totalCount}`;
        document.querySelector('.count-label').textContent = 'Total Objek';
        
        // Enhanced breakdown display
        const breakdownHtml = Object.entries(classCounts).map(([className, count]) => {
            const avgConf = confidenceStats[className] ? 
                Math.round(confidenceStats[className].total / confidenceStats[className].count * 100) : 0;
            return `<span class="class-count">${className}: ${count} (${avgConf}%)</span>`;
        }).join(' ');
        
        document.querySelector('.count-breakdown').innerHTML = breakdownHtml;
        
        // Confidence info
        const avgConfidence = detections.length > 0 ? 
            Math.round(detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length * 100) : 0;
        document.querySelector('.confidence-info').textContent = 
            `Average confidence: ${avgConfidence}% | Processing time: ${totalTime.toFixed(0)}ms`;
        
        // Update class breakdown cards
        updateClassBreakdownCards(classCounts, confidenceStats);
        
        // Update processing info
        const selectedClassesArray = Array.from(selectedClasses);
        processingInfo.textContent = 
            `✅ Found ${totalCount} objects (${selectedClassesArray.join(', ')}) with confidence > ${CONFIDENCE_THRESHOLD * 100}%`;
        
        showToast(`Found ${totalCount} objects in ${totalTime.toFixed(0)}ms`, 'success');
        
        // Log enhanced results
        console.log('=== ENHANCED FINAL RESULTS ===');
        console.log(`Total detections: ${totalCount}`);
        console.log(`Processing time: ${totalTime.toFixed(2)}ms`);
        console.log('Class breakdown:', classCounts);
        console.log('Confidence statistics:', confidenceStats);
        
        detections.forEach((det, i) => {
            console.log(`${i + 1}. ${det.className} ${(det.confidence * 100).toFixed(1)}% at (${det.x.toFixed(2)}, ${det.y.toFixed(2)})`);
        });
        
    } catch (error) {
        console.error('Error during counting:', error);
        processingInfo.textContent = `❌ Error during processing: ${error.message}`;
        showError(`Error during processing: ${error.message}`);
    } finally {
        isProcessing = false;
        countButton.disabled = false;
        countButton.textContent = '🔢 Count Objects';
    }
}

/**
 * Update class breakdown cards with detection results
 */
function updateClassBreakdownCards(classCounts, confidenceStats) {
    const cards = document.querySelectorAll('.class-card');
    
    cards.forEach((card, index) => {
        const className = CLASS_NAMES[index];
        const count = classCounts[className] || 0;
        const countElement = card.querySelector('.class-card-count');
        
        countElement.textContent = count;
        
        if (count > 0) {
            card.classList.add('active');
            const avgConf = confidenceStats[className] ? 
                Math.round(confidenceStats[className].total / confidenceStats[className].count * 100) : 0;
            card.title = `${count} detected with ${avgConf}% average confidence`;
        } else {
            card.classList.remove('active');
            card.title = 'No objects detected';
        }
    });
}

/**
 * Enhanced download functionality
 */
function downloadResult() {
    if (!currentImageData) {
        showError('No image to download');
        return;
    }
    
    try {
        const canvas = capturedImage;
        const link = document.createElement('a');
        
        // Add timestamp to filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `object-detection-result-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Image downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading image:', error);
        showError('Failed to download image');
    }
}

/**
 * Enhanced reset functionality
 */
function resetApplication() {
    // Stop webcam
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset UI elements
    startButton.textContent = '🎥 Start Camera';
    startButton.disabled = false;
    captureButton.disabled = true;
    countButton.disabled = true;
    downloadButton.disabled = true;
    retakeButton.disabled = true;
    switchCameraButton.disabled = true;
    
    // Reset displays
    countDisplay.innerHTML = '0';
    document.querySelector('.count-label').textContent = 'Total Objek';
    document.querySelector('.count-breakdown').innerHTML = '';
    document.querySelector('.confidence-info').textContent = '';
    
    processingInfo.textContent = 'Ready to start...';
    cameraInfo.textContent = 'Camera not active';
    imageInfo.textContent = 'No image captured';
    
    // Clear canvas
    const ctx = capturedImage.getContext('2d');
    ctx.clearRect(0, 0, capturedImage.width, capturedImage.height);
    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, capturedImage.width, capturedImage.height);
    
    // Reset variables
    currentImageData = null;
    currentDeviceId = null;
    currentCameraIndex = 0;
    isProcessing = false;
    
    // Reset performance data
    performanceData = {
        cameraResolution: '',
        inferenceTime: 0,
        totalProcessingTime: 0,
        memoryUsage: 0
    };
    updatePerformanceMonitor();
    
    // Reset class breakdown
    updateClassBreakdownCards({}, {});
    
    console.log('Application reset completed');
    showToast('Application reset successfully', 'info');
    
    // Re-initialize cameras
    initializeCamera();
}

/**
 * Retake photo function
 */
function retakePhoto() {
    // Clear captured image
    const ctx = capturedImage.getContext('2d');
    ctx.clearRect(0, 0, capturedImage.width, capturedImage.height);
    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, capturedImage.width, capturedImage.height);
    
    // Reset related variables and UI
    currentImageData = null;
    countButton.disabled = true;
    downloadButton.disabled = true;
    retakeButton.disabled = true;
    
    imageInfo.textContent = 'No image captured';
    processingInfo.textContent = 'Take a new photo to analyze objects.';
    
    // Reset count display
    countDisplay.innerHTML = '0';
    document.querySelector('.count-label').textContent = 'Total Objek';
    document.querySelector('.count-breakdown').innerHTML = '';
    document.querySelector('.confidence-info').textContent = '';
    
    // Reset class breakdown
    updateClassBreakdownCards({}, {});
    
    showToast('Ready for new photo', 'info');
}

// Enhanced Event Listeners
startButton.addEventListener('click', () => startCamera());
switchCameraButton.addEventListener('click', switchCamera);
captureButton.addEventListener('click', captureImage);
countButton.addEventListener('click', countObjects);
resetButton.addEventListener('click', resetApplication);
retakeButton.addEventListener('click', retakePhoto);
downloadButton.addEventListener('click', downloadResult);

// Modal event listeners
document.querySelector('.close').addEventListener('click', hideError);
document.getElementById('dismissButton').addEventListener('click', hideError);
document.getElementById('retryButton').addEventListener('click', () => {
    hideError();
    initializeModel();
});

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !captureButton.disabled) {
        event.preventDefault();
        captureImage();
    } else if (event.code === 'Enter' && !countButton.disabled) {
        event.preventDefault();
        countObjects();
    } else if (event.code === 'KeyR' && event.ctrlKey) {
        event.preventDefault();
        resetApplication();
    }
});

// Enhanced initialization when page loads
window.addEventListener('load', async () => {
    console.log('🚀 Starting Enhanced Object Detection Application');
    debugMobileSupport();
    
    // Show dev mode toggle
    const isDevMode = window.location.search.includes('dev=true');
    if (isDevMode) {
        performanceMonitor.style.display = 'block';
        console.log('🔧 Developer mode enabled');
    }
    
    try {
        await initializeModel();
        await initializeCamera();
        initializeObjectSelection();
        
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
});

// Enhanced mobile event handlers (lanjutan dari script.js)

// Enhanced orientation change handling
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (stream && webcam.srcObject) {
            // Restart camera after orientation change with current device
            const currentDevice = currentDeviceId;
            setTimeout(async () => {
                try {
                    await startCamera(currentDevice);
                    showToast('Camera restarted after orientation change', 'info');
                } catch (error) {
                    console.error('Error restarting camera after orientation change:', error);
                    showToast('Camera restart failed', 'error');
                }
            }, 500);
        }
    }, 100);
});

// Enhanced visibility change handling
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause when hidden to save resources
        if (webcam && !webcam.paused) {
            webcam.pause();
            console.log('Camera paused - page hidden');
        }
    } else {
        // Resume when visible
        if (webcam && webcam.paused && stream) {
            webcam.play().catch(error => {
                console.error('Error resuming camera:', error);
                showToast('Camera resume failed', 'error');
            });
            console.log('Camera resumed - page visible');
        }
    }
});

// Enhanced page unload handling
window.addEventListener('beforeunload', () => {
    // Clean up resources before page unload
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log('Camera resources cleaned up');
    }
    
    if (session) {
        // Note: ONNX Runtime sessions are automatically cleaned up
        console.log('ONNX session cleanup initiated');
    }
});

// Enhanced error handling for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    
    // Show user-friendly error for critical failures
    if (event.error.message.includes('ONNX') || 
        event.error.message.includes('WebGL') ||
        event.error.message.includes('camera')) {
        showError(`Application error: ${event.error.message}`, true);
    }
});

// Enhanced promise rejection handling
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Prevent default browser error dialog
    event.preventDefault();
    
    // Show user-friendly error
    if (event.reason && event.reason.message) {
        showToast(`Error: ${event.reason.message}`, 'error', 5000);
    }
});

// iOS Safari specific enhancements
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIOS) {
    // iOS requires user interaction before camera access
    let hasUserInteracted = false;
    
    function onFirstTouch() {
        if (!hasUserInteracted) {
            hasUserInteracted = true;
            
            // Add iOS-specific video attributes
            webcam.setAttribute('playsinline', 'true');
            webcam.setAttribute('webkit-playsinline', 'true');
            webcam.setAttribute('autoplay', 'true');
            webcam.setAttribute('muted', 'true');
            
            // Remove the event listeners
            document.removeEventListener('touchstart', onFirstTouch);
            document.removeEventListener('click', onFirstTouch);
            
            console.log('iOS user interaction detected - camera optimizations applied');
            showToast('iOS optimizations applied', 'success', 2000);
        }
    }
    
    document.addEventListener('touchstart', onFirstTouch, { passive: true });
    document.addEventListener('click', onFirstTouch);
    
    // iOS specific viewport handling
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
        viewport.setAttribute('content', 
            'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    
    // iOS PWA support
    if (window.navigator.standalone) {
        document.body.classList.add('standalone');
        console.log('Running as iOS PWA');
    }
}

// Android Chrome specific enhancements
const isAndroid = /Android/.test(navigator.userAgent);
if (isAndroid) {
    // Android-specific optimizations
    webcam.setAttribute('playsinline', true);
    webcam.setAttribute('webkit-playsinline', true);
    
    // Android performance optimizations
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 4) {
        // High-performance Android device
        console.log('High-performance Android device detected');
        performanceMonitor.style.display = 'block';
    }
    
    // Android memory management
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        // Low memory device - apply optimizations
        console.log('Low memory Android device - applying optimizations');
        
        // Reduce image processing quality for low-end devices
        const originalPreprocess = preprocessImage;
        preprocessImage = function(imageData) {
            // Reduce resolution for low-end devices
            const maxSize = 480;
            if (imageData.width > maxSize || imageData.height > maxSize) {
                const scale = Math.min(maxSize / imageData.width, maxSize / imageData.height);
                const newWidth = Math.floor(imageData.width * scale);
                const newHeight = Math.floor(imageData.height * scale);
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = imageData.width;
                tempCanvas.height = imageData.height;
                tempCtx.putImageData(imageData, 0, 0);
                
                ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
                imageData = ctx.getImageData(0, 0, newWidth, newHeight);
            }
            
            return originalPreprocess.call(this, imageData);
        };
    }
}

// Enhanced PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful:', registration.scope);
                showToast('App ready for offline use', 'success', 2000);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Enhanced network status monitoring
function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!isOnline) {
        showToast('You are offline. Some features may not work.', 'warning', 5000);
        processingInfo.textContent = '📡 Offline mode - limited functionality';
    } else {
        if (connection) {
            const effectiveType = connection.effectiveType;
            const downlink = connection.downlink;
            
            console.log(`Network: ${effectiveType}, Speed: ${downlink}Mbps`);
            
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                showToast('Slow network detected. Performance may be affected.', 'warning', 3000);
            }
        }
    }
}

window.addEventListener('online', () => {
    showToast('Back online', 'success');
    updateNetworkStatus();
});

window.addEventListener('offline', () => {
    showToast('You are now offline', 'warning');
    updateNetworkStatus();
});

// Enhanced memory management
function performMemoryCleanup() {
    // Clean up any large objects that might be lingering
    if (window.gc && typeof window.gc === 'function') {
        window.gc();
        console.log('Manual garbage collection triggered');
    }
    
    // Update memory usage
    performanceData.memoryUsage = getMemoryUsage();
    updatePerformanceMonitor();
}

// Memory cleanup on low memory (if supported)
if ('memory' in performance) {
    setInterval(() => {
        const memUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (memUsage > 0.8) {
            console.warn('High memory usage detected:', memUsage);
            performMemoryCleanup();
        }
    }, 30000); // Check every 30 seconds
}

// Enhanced battery status monitoring (if supported)
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        function updateBatteryStatus() {
            const level = Math.round(battery.level * 100);
            const charging = battery.charging;
            
            if (level < 20 && !charging) {
                showToast('Low battery detected. Consider reducing usage.', 'warning', 5000);
                
                // Reduce frame rate for low battery
                if (stream) {
                    const tracks = stream.getVideoTracks();
                    tracks.forEach(track => {
                        const constraints = track.getConstraints();
                        if (constraints.frameRate && constraints.frameRate.ideal > 15) {
                            track.applyConstraints({
                                frameRate: { ideal: 15, max: 20 }
                            }).catch(console.error);
                        }
                    });
                }
            }
            
            console.log(`Battery: ${level}% ${charging ? '(charging)' : ''}`);
        }
        
        battery.addEventListener('levelchange', updateBatteryStatus);
        battery.addEventListener('chargingchange', updateBatteryStatus);
        updateBatteryStatus();
    }).catch(error => {
        console.log('Battery API not supported:', error);
    });
}

// Enhanced device motion detection (for camera stability)
if ('DeviceMotionEvent' in window) {
    let motionStable = true;
    let lastMotionTime = 0;
    
    window.addEventListener('devicemotion', (event) => {
        const acceleration = event.acceleration;
        if (acceleration) {
            const totalAcceleration = Math.sqrt(
                acceleration.x * acceleration.x +
                acceleration.y * acceleration.y +
                acceleration.z * acceleration.z
            );
            
            const currentTime = Date.now();
            if (totalAcceleration > 2 && currentTime - lastMotionTime > 1000) {
                motionStable = false;
                lastMotionTime = currentTime;
                
                if (currentImageData) {
                    showToast('Device motion detected. Keep steady for better results.', 'info', 2000);
                }
                
                setTimeout(() => {
                    motionStable = true;
                }, 2000);
            }
        }
    });
    
    // Override capture function to check motion stability
    const originalCaptureImage = captureImage;
    captureImage = function() {
        if (!motionStable) {
            showToast('Please keep device steady before capturing', 'warning');
            return;
        }
        originalCaptureImage.call(this);
    };
}

// Enhanced accessibility support
function initializeAccessibility() {
    // Add ARIA labels and roles
    webcam.setAttribute('aria-label', 'Camera preview');
    capturedImage.setAttribute('aria-label', 'Captured image with detection results');
    
    // Add keyboard navigation for checkboxes
    const checkboxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                const nextIndex = (index + 1) % checkboxes.length;
                checkboxes[nextIndex].focus();
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const prevIndex = (index - 1 + checkboxes.length) % checkboxes.length;
                checkboxes[prevIndex].focus();
            }
        });
    });
    
    // Add high contrast mode detection
    if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
        document.body.classList.add('high-contrast');
        console.log('High contrast mode detected');
    }
    
    // Add reduced motion detection
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('reduced-motion');
        console.log('Reduced motion preference detected');
    }
}

// Enhanced performance monitoring for development
function initializePerformanceMonitoring() {
    if (window.location.search.includes('debug=true')) {
        // Enable advanced debugging
        window.DEBUG_MODE = true;
        performanceMonitor.style.display = 'block';
        
        // Add performance timing
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.log(`Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
            }
        });
        
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
        
        // Add memory leak detection
        let objectCount = 0;
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            objectCount++;
            const element = originalCreateElement.call(this, tagName);
            
            if (objectCount % 100 === 0) {
                console.log(`DOM elements created: ${objectCount}`);
            }
            
            return element;
        };
        
        console.log('🔧 Debug mode enabled - Advanced monitoring active');
    }
}

// Final initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeAccessibility();
    initializePerformanceMonitoring();
    updateNetworkStatus();
    
    console.log('🎯 Enhanced Object Detection App - Full initialization complete');
    showToast('Application ready', 'success', 2000);
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCameraConstraints,
        preprocessImage,
        postprocessOutput,
        applyNMS,
        calculateIoU,
        debugMobileSupport
    };
}

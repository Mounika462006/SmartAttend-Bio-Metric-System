import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { biometricAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import {
  Camera, CheckCircle, XCircle, RefreshCw, ShieldCheck,
  AlertTriangle, User, Loader
} from 'lucide-react';
import toast from 'react-hot-toast';

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.25,
});
const CAMERA_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};

const STEPS = [
  { label: 'Load Models', desc: 'Initializing face recognition models' },
  { label: 'Face Capture 1', desc: 'Look directly at the camera' },
  { label: 'Face Capture 2', desc: 'Slightly turn your head to the side' },
  { label: 'Verification', desc: 'Comparing face images' },
  { label: 'Complete', desc: 'Biometric registration successful' },
];

export default function BiometricRegister() {
  const { user, updateUser } = useAuth();
  const webcamRef = useRef(null);
  const [step, setStep] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capturedImages, setCapturedImages] = useState({ first: null, second: null });
  const [descriptors, setDescriptors] = useState({ first: null, second: null });
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const detectionInterval = useRef(null);

  // Check if already registered (skip if we just completed registration and are at step 4 success page)
  if (user?.biometric_registered && step !== 4) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Biometric Registered</h2>
          <p className="text-surface-500">Your face biometric is registered and active. You can use it to mark attendance.</p>
        </div>
      </div>
    );
  }

  // Load face-api.js models
  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        setModelsLoaded(true);
        setStep(1);
        toast.success('Face recognition models loaded.');
      } catch (err) {
        setError('Failed to load face recognition models. Check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
    loadModels();
    return () => { if (detectionInterval.current) clearInterval(detectionInterval.current); };
  }, []);

  // Real-time face detection indicator
  useEffect(() => {
    if (!modelsLoaded || !cameraReady || step === 0 || step >= 3) return;

    detectionInterval.current = setInterval(async () => {
      const video = webcamRef.current?.video;
      if (video?.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const detection = await faceapi
            .detectSingleFace(video, DETECTOR_OPTIONS)
            .withFaceLandmarks();
          setFaceDetected(!!detection);
        } catch {
          setFaceDetected(false);
        }
      }
    }, 700);

    return () => clearInterval(detectionInterval.current);
  }, [modelsLoaded, cameraReady, step]);

  const captureAndProcess = useCallback(async (captureStep) => {
    setError('');
    setLoading(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error('Failed to capture image. Ensure camera is active.');

      // Detect face
      const img = await faceapi.fetchImage(imageSrc);
      const detection = await faceapi
        .detectSingleFace(img, DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error('No face detected. Please ensure your face is clearly visible and well-lit.');

      const descriptor = Array.from(detection.descriptor);

      if (captureStep === 1) {
        setCapturedImages(prev => ({ ...prev, first: imageSrc }));
        setDescriptors(prev => ({ ...prev, first: descriptor }));
        setStep(2);
        toast.success('First image captured. Now slightly turn your head.');
      } else if (captureStep === 2) {
        // Compare with first descriptor
        const distance = faceapi.euclideanDistance(descriptors.first, descriptor);
        const similarity = Math.max(0, Math.round((1 - distance) * 100));

        if (similarity < 50) {
          throw new Error(`Face mismatch detected. Similarity: ${similarity}%. Both images must be of the same person.`);
        }

        setCapturedImages(prev => ({ ...prev, second: imageSrc }));
        setDescriptors(prev => ({ ...prev, second: descriptor }));
        setStep(3);

        // Upload to backend
        await submitBiometric(capturedImages.first, imageSrc, descriptors.first, similarity);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during face capture. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [descriptors, capturedImages, submitBiometric]);

  const submitBiometric = useCallback(async (firstImg, secondImg, descriptor, similarity) => {
    setLoading(true);
    try {
      // Convert base64 to blob
      function b64ToBlob(b64) {
        if (!b64 || !b64.includes(',')) throw new Error('Invalid image format captured.');
        const byteString = atob(b64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        return new Blob([ab], { type: 'image/jpeg' });
      }

      const formData = new FormData();
      formData.append('face_image', b64ToBlob(firstImg), 'face_image.jpg');
      formData.append('validation_image', b64ToBlob(secondImg), 'validation_image.jpg');
      formData.append('face_descriptor', JSON.stringify(descriptor));
      formData.append('similarity_score', similarity.toString());

      await biometricAPI.register(formData);
      updateUser({ biometric_registered: true });
      setStep(4);
      toast.success('Biometric registration successful!');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save biometric data. Please try again.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  const reset = () => {
    setStep(1);
    setCapturedImages({ first: null, second: null });
    setDescriptors({ first: null, second: null });
    setError('');
    setFaceDetected(false);
  };

  const handleCameraReady = () => {
    setCameraReady(true);
    setError('');
  };

  const handleCameraError = (err) => {
    setCameraReady(false);
    setFaceDetected(false);

    const name = err?.name || '';
    let message = '';
    
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      message = 'Camera access denied. To fix:\n1. Click the camera/lock icon in your address bar\n2. Change camera permission to "Allow"\n3. Refresh the page and try again\n\nIf permanently blocked, clear site permissions in browser settings.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      message = 'No camera detected. Please connect or enable your camera.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      message = 'Camera is in use by another app. Close other camera applications and retry.';
    } else {
      message = 'Camera unavailable. Check browser permissions, ensure no other apps are using the camera, and try again.';
    }
    
    setError(message);
  };

  const requestCameraAccess = async () => {
    setError('');
    setCameraReady(false);
    setFaceDetected(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser. Please use Chrome, Edge, or Firefox.');
      return;
    }

    // Check current permission status if available
    if (navigator.permissions?.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'camera' });
        if (permStatus.state === 'denied') {
          setError('Camera permission is permanently denied. To fix:\n1. Go to browser settings\n2. Find this website in Permissions/Site Permissions\n3. Change camera to "Allow"\n4. Refresh the page');
          return;
        }
      } catch (err) {
        // Permission query might not be supported, continue with getUserMedia
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      stream.getTracks().forEach(track => track.stop());
      setCameraEnabled(true);
      setCameraRetryKey(prev => prev + 1);
    } catch (err) {
      handleCameraError(err);
    }
  };

  const retryCamera = () => {
    setCameraReady(false);
    setFaceDetected(false);
    setError('');
    setCameraEnabled(false);
    requestCameraAccess();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Biometric Face Registration</h1>
        <p className="page-subtitle">Register your face for secure attendance verification</p>
      </div>

      {/* Step Progress */}
      <div className="card card-body">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-colors
                ${i < step ? 'bg-green-500 text-white'
                  : i === step ? 'bg-blue-500 text-white'
                  : 'bg-surface-200 text-surface-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <div className={`text-xs hidden sm:block ${i === step ? 'text-surface-800 font-medium' : 'text-surface-400'}`}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        {step < STEPS.length && (
          <p className="text-sm text-surface-500 text-center mt-3">{STEPS[step]?.desc}</p>
        )}
      </div>

      {/* Main content */}
      <div className="card">
        {/* Loading models */}
        {step === 0 && (
          <div className="card-body flex flex-col items-center py-12 gap-4">
            <Loader size={40} className="text-blue-500 animate-spin" />
            <p className="text-surface-600">Loading face recognition models...</p>
            <p className="text-sm text-surface-400">This may take a moment on first load.</p>
          </div>
        )}

        {/* Camera step */}
        {(step === 1 || step === 2) && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-surface-900">
                {step === 1 ? 'Step 1: Primary Face Capture' : 'Step 2: Validation Capture'}
              </h3>
              <div className={`flex items-center gap-1.5 text-sm ${faceDetected ? 'text-green-600' : 'text-amber-600'}`}>
                <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
                {faceDetected ? 'Face Detected' : 'No Face Detected'}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              {!cameraEnabled ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Camera size={36} className="text-white/80" />
                  <p className="text-sm text-white/70">Camera access is required for live biometric registration.</p>
                  <button type="button" onClick={requestCameraAccess} className="btn-primary">
                    <Camera size={15} />
                    Enable Camera
                  </button>
                </div>
              ) : (
                <>
                  <Webcam
                    key={cameraRetryKey}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.95}
                    forceScreenshotSourceSize
                    onUserMedia={handleCameraReady}
                    onUserMediaError={handleCameraError}
                    className="w-full h-full object-cover"
                    videoConstraints={CAMERA_CONSTRAINTS}
                    mirrored
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-56 border-2 border-white/60 rounded-full" />
                  </div>
                  {faceDetected && (
                    <div className="absolute top-3 left-3 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md">
                      Face Locked
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-surface-50 rounded-lg p-3 text-sm text-surface-600">
              {!cameraReady
                ? 'Waiting for camera access. Allow camera permission if prompted.'
                : step === 1
                  ? 'Position your face within the oval guide. Look directly at the camera in good lighting.'
                  : 'Now slightly turn your head to the left or right to capture a different angle.'}
            </div>

            <div className="flex gap-3">
              {!cameraReady && (
                <button type="button" onClick={retryCamera} className="btn-secondary flex-1">
                  <RefreshCw size={15} /> Retry Camera
                </button>
              )}
              {step === 2 && (
                <button onClick={reset} className="btn-secondary flex-1">
                  <RefreshCw size={15} /> Restart
                </button>
              )}
              <button
                onClick={() => captureAndProcess(step)}
                disabled={loading || !cameraReady}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <><Camera size={16} /> {step === 1 ? 'Capture First Image' : 'Capture Second Image'}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 3 && (
          <div className="card-body flex flex-col items-center py-12 gap-4">
            <Loader size={40} className="text-blue-500 animate-spin" />
            <p className="text-surface-700 font-medium">Verifying and saving biometric data...</p>
          </div>
        )}

        {/* Success */}
        {step === 4 && (
          <div className="card-body flex flex-col items-center py-12 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-surface-900">Biometric Registration Complete</h3>
            <p className="text-surface-500 max-w-xs">
              Your face is registered as your attendance identifier. You can now mark attendance using live face verification.
            </p>
            <Link to="/student/attendance" className="btn-primary">
              Go to Mark Attendance
            </Link>
          </div>
        )}
      </div>

      {/* Guidelines */}
      {(step === 1 || step === 2) && (
        <div className="card card-body">
          <h4 className="text-sm font-semibold text-surface-800 mb-2">Registration Guidelines</h4>
          <ul className="text-xs text-surface-500 space-y-1">
            <li>• Ensure good, even lighting on your face</li>
            <li>• Remove glasses or accessories if possible</li>
            <li>• Only one face should be visible in the frame</li>
            <li>• Do not use a photo or screenshot — live capture only</li>
            <li>• The first image becomes your permanent biometric reference</li>
          </ul>
        </div>
      )}
    </div>
  );
}

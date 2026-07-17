import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { attendanceAPI, biometricAPI, generalAPI } from '../../api/services';
import {
  MapPin, Camera, CheckCircle, XCircle, Loader,
  ShieldCheck, Navigation, AlertTriangle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBlinkDetection } from '../../hooks/useBlinkDetection';

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
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

function VerificationStep({ icon: Icon, label, status }) {
  const statusMap = {
    pending: { color: 'text-surface-400', bg: 'bg-surface-100' },
    checking: { color: 'text-blue-500', bg: 'bg-blue-50' },
    success: { color: 'text-green-600', bg: 'bg-green-50' },
    failed: { color: 'text-red-600', bg: 'bg-red-50' },
  };
  const s = statusMap[status] || statusMap.pending;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${s.bg} transition-colors`}>
      <Icon size={18} className={s.color} />
      <span className={`text-sm font-medium ${s.color}`}>{label}</span>
      <div className="ml-auto">
        {status === 'checking' && <Loader size={14} className="text-blue-500 animate-spin" />}
        {status === 'success' && <CheckCircle size={16} className="text-green-600" />}
        {status === 'failed' && <XCircle size={16} className="text-red-600" />}
      </div>
    </div>
  );
}

export default function MarkAttendance() {
  const webcamRef = useRef(null);
  const [phase, setPhase] = useState('init'); // init | location | camera | verifying | success | failed
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [matchScore, setMatchScore] = useState(null);
  const [campusGeo, setCampusGeo] = useState(null);
  // Loading flag while fetching live location
  const [locationLoading, setLocationLoading] = useState(false);
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [markedDistance, setMarkedDistance] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const { livenessStatus, livenessError, startBlinkDetection, resetBlinkDetection } = useBlinkDetection();
  const [steps, setSteps] = useState({
    location: 'pending',
    face: 'pending',
    submission: 'pending',
  });
  const [faceDetected, setFaceDetected] = useState(false);
  const detectionInterval = useRef(null);

  const updateStep = (key, status) => setSteps(prev => ({ ...prev, [key]: status }));

  // Load models
  useEffect(() => {
    async function load() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        setModelsLoaded(true);
      } catch {
        setError('Could not load face recognition models. Please refresh the page.');
      }
    }
    load();
    return () => { if (detectionInterval.current) clearInterval(detectionInterval.current); };
  }, []);

  useEffect(() => {
    generalAPI.getCampusGeoFence()
      .then(({ data }) => setCampusGeo(data.data || null))
      .catch(() => {});
  }, []);

  // Face detection indicator when camera is open
  useEffect(() => {
    if (phase !== 'camera' || !modelsLoaded) return;
    detectionInterval.current = setInterval(async () => {
      if (webcamRef.current?.video?.readyState === 4) {
        try {
          const det = await faceapi
            .detectSingleFace(webcamRef.current.video, DETECTOR_OPTIONS)
            .withFaceLandmarks();
          setFaceDetected(!!det);
        } catch {
          setFaceDetected(false);
        }
      }
    }, 700);
    return () => clearInterval(detectionInterval.current);
  }, [phase, modelsLoaded]);

  // Step 1: Get GPS location
  const verifyLocation = useCallback(() => {
    // Start location flow
    setPhase('location');
    updateStep('location', 'checking');
    setError('');

    if (!navigator.geolocation) {
      // Browser doesn't support geolocation
      const msg = 'Location unavailable';
      setError(msg);
      toast.error(msg);
      updateStep('location', 'failed');
      setPhase('failed');
      return;
    }

    // Inform user we're attempting to get a live location
    const toastId = toast.loading('Getting your live location...');
    setLocationLoading(true);

    // Request a high-accuracy position with a sensible timeout
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(toastId);
        setLocationLoading(false);
        toast.success('Live location acquired.');

        const nextLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(nextLocation);

        // Compute distance to campus if geo is configured
        if (campusGeo) {
          const distance = calculateDistance(
            nextLocation.latitude,
            nextLocation.longitude,
            parseFloat(campusGeo.latitude),
            parseFloat(campusGeo.longitude)
          );
          setDistanceInfo({
            distance,
            allowed: parseInt(campusGeo.radius_meters),
            isWithin: distance <= parseInt(campusGeo.radius_meters),
            collegeName: campusGeo.college_name,
          });
        }

        updateStep('location', 'success');
        setPhase('camera');
      },
      (err) => {
        // Dismiss loading toast and set loading flag
        toast.dismiss(toastId);
        setLocationLoading(false);

        // Map the error code to friendly messages required by the spec
        let msg = 'Location unavailable';
        if (err.code === 1) {
          msg = 'Location permission denied. Please enable GPS and allow browser permission.';
        } else if (err.code === 2) {
          msg = 'Location unavailable';
        } else if (err.code === 3) {
          msg = 'Location request timeout';
        }

        setError(msg);
        toast.error(msg);
        updateStep('location', 'failed');
        setPhase('failed');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [campusGeo]);

  // Allow a quick manual coordinate fallback if geolocation fails on mobile
  const handleManualCoordinates = useCallback(() => {
    // Prompt user to paste coordinates as `lat,lon`
    const input = window.prompt('Enter coordinates as latitude,longitude (example: 11.0168,76.9558)');
    if (!input) return;
    const parts = input.split(',').map(s => s.trim());
    if (parts.length !== 2) {
      toast.error('Invalid input. Use format latitude,longitude');
      return;
    }
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!isFinite(lat) || !isFinite(lon)) {
      toast.error('Invalid numeric coordinates.');
      return;
    }

    // Apply manual coords and compute distance like a successful geolocation
    const nextLocation = { latitude: lat, longitude: lon };
    setLocation(nextLocation);
    if (campusGeo) {
      const distance = calculateDistance(
        nextLocation.latitude,
        nextLocation.longitude,
        parseFloat(campusGeo.latitude),
        parseFloat(campusGeo.longitude)
      );
      setDistanceInfo({
        distance,
        allowed: parseInt(campusGeo.radius_meters),
        isWithin: distance <= parseInt(campusGeo.radius_meters),
        collegeName: campusGeo.college_name,
      });
    }
    toast.success('Manual location applied.');
    updateStep('location', 'success');
    setPhase('camera');
  }, [campusGeo]);

  // Development mode: use a test location from campus geo config
  const useTestLocation = useCallback(() => {
    if (!campusGeo) {
      toast.error('Campus location not configured.');
      return;
    }
    // Use campus center as test location (user is assumed to be at the campus)
    const nextLocation = {
      latitude: parseFloat(campusGeo.latitude),
      longitude: parseFloat(campusGeo.longitude),
    };
    setLocation(nextLocation);
    // Distance will be ~0 since we're using the exact campus center
    setDistanceInfo({
      distance: 0,
      allowed: parseInt(campusGeo.radius_meters),
      isWithin: true,
      collegeName: campusGeo.college_name,
    });
    toast.success('Test location applied (campus center).');
    updateStep('location', 'success');
    setPhase('camera');
  }, [campusGeo]);

  // Step 2+3: Capture face and verify
  const captureAndVerify = useCallback(async () => {
    setError('');
    updateStep('face', 'checking');
    
    try {
      // Blink verification gate
      const livenessResult = await startBlinkDetection(webcamRef);
      if (!livenessResult.success) {
        throw new Error(livenessResult.reason || 'Liveness check failed.');
      }

      const { imageSrc, descriptor: liveDescriptor } = livenessResult;

      toast.success('Face captured successfully. Verifying identity...');
      setPhase('verifying');
      // Get stored biometric descriptor
      const { data: bData } = await biometricAPI.getDescriptor();
      const storedDescriptor = new Float32Array(bData.data.face_descriptor);

      const distance = faceapi.euclideanDistance(storedDescriptor, liveDescriptor);
      const similarity = Math.max(0, Math.round((1 - distance) * 100));
      setMatchScore(similarity);

      if (similarity < 60) {
        throw new Error(`Face verification failed. Match score: ${similarity}%. Required: 60%.`);
      }

      updateStep('face', 'success');
      updateStep('submission', 'checking');

      // Submit attendance
      const { data: attendanceData } = await attendanceAPI.mark({
        latitude: location.latitude,
        longitude: location.longitude,
        face_match_score: similarity,
        session: getSession(),
      });
      setMarkedDistance(attendanceData.data?.distance_from_campus ?? distanceInfo?.distance ?? null);

      updateStep('submission', 'success');
      setPhase('success');
      toast.success('Attendance marked successfully!');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Verification failed.';
      setError(msg);
      updateStep('face', 'failed');
      setPhase('failed');
    }
  }, [location, distanceInfo, startBlinkDetection]);

  // Auto-start verification when camera is ready
  useEffect(() => {
    if (phase === 'camera' && cameraReady && steps.face === 'pending' && !error) {
      captureAndVerify();
    }
  }, [phase, cameraReady, steps.face, error, captureAndVerify]);

  const reset = () => {
    resetBlinkDetection();
    setPhase('init');
    setSteps({ location: 'pending', face: 'pending', submission: 'pending' });
    setError('');
    setMatchScore(null);
    setMarkedDistance(null);
    setCameraReady(false);
    setCameraEnabled(false);
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

    // Enable webcam component directly to let it request stream natively.
    // This avoids the double getUserMedia lock race condition.
    setCameraEnabled(true);
    setCameraRetryKey(prev => prev + 1);
  };

  const retryCamera = () => {
    setCameraReady(false);
    setFaceDetected(false);
    setError('');
    setCameraEnabled(false);
    requestCameraAccess();
  };

  const getSession = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Morning';
    if (hours < 16) return 'Afternoon';
    return 'Evening';
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const session = getSession();

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Mark Attendance</h1>
        <p className="page-subtitle">{today} — {session} Session</p>
      </div>

      {/* Verification Steps Status */}
      <div className="card card-body space-y-2">
        <VerificationStep icon={Navigation} label="GPS Location Verified" status={steps.location} />
        <VerificationStep icon={ShieldCheck} label="Face Identity Verified" status={steps.face} />
        <VerificationStep icon={CheckCircle} label="Attendance Submitted" status={steps.submission} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Location fallback actions when geolocation fails */}
      {steps.location === 'failed' && (
        <div className="flex flex-col gap-2">
          <button onClick={verifyLocation} disabled={locationLoading} className="btn-secondary">
            Retry location
          </button>
          <button onClick={useTestLocation} className="btn-primary">
            Use Test Location
          </button>
          <button onClick={handleManualCoordinates} className="btn-outline">
            Enter coordinates manually
          </button>
        </div>
      )}

      {/* Phase: Init */}
      {phase === 'init' && (
        <div className="card card-body space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <MapPin size={28} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900">Ready to Mark Attendance?</h3>
          <p className="text-sm text-surface-500">
            The system will verify your GPS location and face identity before marking your attendance.
          </p>
          {!modelsLoaded && (
            <div className="flex items-center justify-center gap-2 text-sm text-surface-500">
              <Loader size={14} className="animate-spin" />
              Loading face recognition models...
            </div>
          )}
          <button
            onClick={verifyLocation}
            disabled={!modelsLoaded || locationLoading}
            className="btn-primary w-full justify-center py-3"
          >
            <Navigation size={16} />
            {locationLoading ? 'Getting your live location...' : 'Begin Attendance Verification'}
          </button>
        </div>
      )}

      {/* Phase: Location checking */}
      {phase === 'location' && (
        <div className="card card-body text-center py-10">
          <Loader size={32} className="text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-surface-700 font-medium">Verifying your location...</p>
          <p className="text-sm text-surface-400 mt-1">Please allow location access if prompted.</p>
        </div>
      )}

      {/* Phase: Camera */}
      {phase === 'camera' && (
        <div className="card p-6 space-y-4">
          {distanceInfo && (
            <div className={`flex items-start gap-2 rounded-lg border p-3 ${
              distanceInfo.isWithin
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              {distanceInfo.isWithin ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
              <div className="text-sm">
                <p className="font-medium">
                  You are {distanceInfo.distance}m from {distanceInfo.collegeName || 'campus'}.
                </p>
                <p className="text-xs opacity-80">
                  Allowed attendance radius: {distanceInfo.allowed}m.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-surface-900">Face Verification</h3>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${faceDetected ? 'text-green-600' : 'text-amber-600'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${faceDetected ? 'bg-green-500' : 'bg-amber-500'}`} />
              {faceDetected ? 'Face Detected' : 'Looking for face...'}
            </div>
          </div>

          <div className="relative rounded-lg bg-white border border-surface-200 p-6 flex flex-col items-center justify-center min-h-[340px]">
            {!cameraEnabled ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <Camera size={36} className="text-surface-400" />
                <p className="text-sm text-surface-600">Camera access is required for live face verification.</p>
                <button type="button" onClick={requestCameraAccess} className="btn-primary">
                  <Camera size={15} />
                  Enable Camera
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full gap-4">
                {/* Dynamic liveness instruction displayed above the oval */}
                {livenessStatus && !livenessError && (
                  <div className="bg-blue-600 text-white font-semibold text-xs px-5 py-2 rounded-full shadow-sm animate-pulse text-center whitespace-nowrap">
                    {livenessStatus}
                  </div>
                )}

                {/* Dynamic liveness error displayed above the oval */}
                {livenessError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 font-semibold text-xs px-4 py-2 rounded-lg shadow-sm text-center max-w-sm leading-tight">
                    {livenessError}
                  </div>
                )}

                <div className="w-60 h-72 rounded-[50%] overflow-hidden relative border-2 border-surface-300 bg-surface-50 shadow-md flex items-center justify-center">
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
                    <div className={`w-[85%] h-[85%] border border-dashed rounded-[50%] transition-colors ${faceDetected ? 'border-green-400' : 'border-white/50'}`} />
                  </div>

                  {faceDetected && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm z-10">
                      Face Locked
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {cameraReady ? (
            <button
              disabled
              className="btn-primary w-full justify-center bg-blue-500/80 cursor-not-allowed opacity-90 py-3"
            >
              <Loader size={16} className="animate-spin mr-1.5" /> Auto Verifying on Blink...
            </button>
          ) : (
            <button type="button" onClick={retryCamera} className="btn-secondary w-full justify-center py-3">
              <RefreshCw size={15} />
              Retry Camera
            </button>
          )}
        </div>
      )}

      {/* Phase: Verifying */}
      {phase === 'verifying' && (
        <div className="card card-body text-center py-10">
          <Loader size={32} className="text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-surface-700 font-medium">Verifying your identity...</p>
          <p className="text-sm text-surface-400 mt-1">Comparing with registered biometric data.</p>
        </div>
      )}

      {/* Phase: Success */}
      {phase === 'success' && (
        <div className="card card-body text-center py-10 space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-surface-900">Attendance Marked</h3>
            <p className="text-surface-500 text-sm mt-1">
              {today} — {session} Session
            </p>
          </div>
          {matchScore && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-sm text-green-700 font-medium">
              <ShieldCheck size={15} />
              Face Match: {matchScore}%
            </div>
          )}
          {markedDistance !== null && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-sm text-blue-700 font-medium">
              <Navigation size={15} />
              Distance from Campus: {markedDistance}m
            </div>
          )}
          <div className="space-y-2 text-left">
            <VerificationStep icon={Navigation} label="Location Verified" status="success" />
            <VerificationStep icon={ShieldCheck} label="Face Verified" status="success" />
            <VerificationStep icon={CheckCircle} label="Attendance Recorded" status="success" />
          </div>
        </div>
      )}

      {/* Phase: Failed */}
      {phase === 'failed' && (
        <div className="card card-body text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <XCircle size={32} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-900">Verification Failed</h3>
          <p className="text-sm text-surface-500">{error}</p>
          <button onClick={reset} className="btn-secondary">
            <RefreshCw size={15} /> Try Again
          </button>
        </div>
      )}
    </div>
  );
}

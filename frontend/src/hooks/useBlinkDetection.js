import { useState, useCallback, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// ─────────────────────────────────────────────────────────────────────────────
// IoU-based Non-Maximum Suppression deduplication
// ROOT CAUSE FIX for "Multiple faces detected" with one real face:
// TinyFaceDetector at inputSize=416 runs multiple internal scale pyramids.
// A single close-up face produces 2-3 overlapping detections at different
// scales. With scoreThreshold=0.25 all of them pass — hence detections.length>1
// even with just one person. This deduplication merges overlapping boxes,
// keeping only the highest-confidence detection per face region.
// ─────────────────────────────────────────────────────────────────────────────
const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width,  b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  return inter / (aArea + bArea - inter);
};

const deduplicateDetections = (detections, iouThreshold = 0.40) => {
  // Sort by score descending so highest-confidence comes first
  const sorted = [...detections].sort(
    (a, b) => b.detection.score - a.detection.score
  );
  const kept = [];
  for (const det of sorted) {
    const box = det.detection.box;
    const overlapsKept = kept.some(k => iou(k.detection.box, box) > iouThreshold);
    if (!overlapsKept) kept.push(det);
  }
  return kept;
};

// ─────────────────────────────────────────────────────────────────────────────
// Oval guide coordinate mapping
// Maps the visual oval (displayed via CSS object-cover) back to raw video space
// ─────────────────────────────────────────────────────────────────────────────
const isFaceInOval = (box, videoWidth, videoHeight) => {
  const W_c = 240;
  const H_c = 288;
  const scale = Math.max(W_c / videoWidth, H_c / videoHeight);
  const offsetX = (videoWidth  * scale - W_c) / 2;
  const offsetY = (videoHeight * scale - H_c) / 2;

  const ovalLeftV   = (W_c * 0.075 + offsetX) / scale;
  const ovalRightV  = (W_c * 0.925 + offsetX) / scale;
  const ovalTopV    = (H_c * 0.075 + offsetY) / scale;
  const ovalBottomV = (H_c * 0.925 + offsetY) / scale;

  const isInside =
    box.x                  >= (ovalLeftV   - box.width  * 0.15) &&
    (box.x + box.width)   <= (ovalRightV  + box.width  * 0.15) &&
    box.y                  >= (ovalTopV    - box.height * 0.15) &&
    (box.y + box.height)  <= (ovalBottomV + box.height * 0.15);

  const faceArea = box.width * box.height;
  const ovalArea = (ovalRightV - ovalLeftV) * (ovalBottomV - ovalTopV);
  const sizeRatio = faceArea / ovalArea;

  return { isInside, sizeRatio };
};

export function useBlinkDetection() {
  const [livenessStatus, setLivenessStatus] = useState('');
  const [livenessError,  setLivenessError]  = useState('');
  const [isFaceValid,    setIsFaceValid]    = useState(false);

  const activeTimeout     = useRef(null);
  const canvasRef         = useRef(null);
  const smoothedScoreRef  = useRef(0.85);

  const lastNosePos      = useRef(null);
  const stableSince      = useRef(null);
  const calibrationEARs  = useRef([]);
  const calibrationMARs  = useRef([]);
  const calibrationYaws  = useRef([]);
  const calibrationSmiles = useRef([]);
  const calibrationBrows = useRef([]);
  const noseHistory      = useRef([]);

  // ── Shared detector options ───────────────────────────────────────────────
  const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.25,
  });

  // ── Helper to calculate distance ──────────────────────────────────────────
  const getDist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // ── EAR helper ───────────────────────────────────────────────────────────
  const calculateEAR = (eye) => {
    const dV1 = getDist(eye[1], eye[5]);
    const dV2 = getDist(eye[2], eye[4]);
    const dH  = getDist(eye[0], eye[3]);
    if (dH < 0.001) return 0.30;
    return (dV1 + dV2) / (2.0 * dH);
  };

  // ── Brightness helper ────────────────────────────────────────────────────
  const checkBrightness = (video) => {
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width  = 40;
        canvasRef.current.height = 30;
      }
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(video, 0, 0, 40, 30);
      const data = ctx.getImageData(0, 0, 40, 30).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return total / (data.length / 4);
    } catch {
      return 120;
    }
  };

  // ── Status/Error update helpers (avoid unnecessary re-renders) ───────────
  const lastStatus = useRef('');
  const lastError  = useRef('');

  const updateStatus = (text) => {
    if (text !== lastStatus.current) { lastStatus.current = text; setLivenessStatus(text); }
  };
  const updateError = (text) => {
    if (text !== lastError.current) { lastError.current = text; setLivenessError(text); }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW 1: Face validation loop for MANUAL image capture (Registration)
  // ──────────────────────────────────────────────────────────────────────────
  const startFaceValidation = useCallback((webcamRef) => {
    if (activeTimeout.current) clearTimeout(activeTimeout.current);

    setLivenessStatus('');
    setLivenessError('');
    setIsFaceValid(false);
    lastNosePos.current    = null;
    stableSince.current    = null;
    noseHistory.current    = [];
    smoothedScoreRef.current = 0.85;

    const videoElement = webcamRef?.current?.video;
    if (!videoElement) { updateError('No camera detected.'); return; }

    let isRunning = true;
    updateStatus('Position your face inside the oval.');

    const loop = async () => {
      if (!isRunning) return;

      if (window.location.search.includes('mock=true')) {
        updateError('');
        updateStatus('Face detected successfully.');
        setIsFaceValid(true);
        activeTimeout.current = setTimeout(loop, 1000);
        return;
      }

      if (!webcamRef.current?.video) { isRunning = false; return; }

      const video  = webcamRef.current.video;
      const stream = video.srcObject;
      const isStreamActive = stream && stream.getTracks && stream.getTracks().some(t => t.readyState === 'live');
      if (video.ended || (stream && !isStreamActive)) {
        isRunning = false;
        updateError('Camera permission is required to continue.');
        return;
      }

      if (video.readyState < 2) { activeTimeout.current = setTimeout(loop, 40); return; }

      try {
        const brightness = checkBrightness(video);
        if (brightness < 40) {
          updateError('Lighting is too low. Move to a brighter area.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const raw = await faceapi.detectAllFaces(video, DETECTOR_OPTIONS).withFaceLandmarks();
        const detections = deduplicateDetections(raw);

        if (detections.length === 0) {
          updateError('No face detected. Please position your face inside the oval.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }
        if (detections.length > 1) {
          updateError('Multiple faces detected. Only one person should be visible.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const det  = detections[0];
        const score = det.detection.score;
        smoothedScoreRef.current = smoothedScoreRef.current * 0.75 + score * 0.25;

        if (smoothedScoreRef.current < 0.65) {
          updateError('Face confidence low. Please look straight and keep steady.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const box       = det.detection.box;
        const landmarks = det.landmarks.positions;
        const { isInside, sizeRatio } = isFaceInOval(box, video.videoWidth, video.videoHeight);

        if (!isInside) {
          updateError('Move your face inside the oval guide.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }
        if (sizeRatio > 0.92) {
          updateError('You are too close. Move slightly backward.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }
        if (sizeRatio < 0.35) {
          updateError('You are too far away. Move closer to the camera.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const noseX      = landmarks[27].x;
        const faceLeft   = landmarks[0].x;
        const faceRight  = landmarks[16].x;
        const faceW      = Math.abs(faceRight - faceLeft);
        const yawRatio   = faceW > 0 ? Math.abs(noseX - faceLeft) / faceW : 0.5;
        if (yawRatio < 0.23 || yawRatio > 0.77) {
          updateError('Please look directly at the camera.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const currentNose = landmarks[27];
        noseHistory.current.push({ x: currentNose.x, y: currentNose.y });
        if (noseHistory.current.length > 5) noseHistory.current.shift();

        let frameMove = 0;
        if (lastNosePos.current) {
          frameMove = Math.hypot(
            currentNose.x - lastNosePos.current.x,
            currentNose.y - lastNosePos.current.y
          );
        }
        lastNosePos.current = currentNose;

        if (frameMove > box.width * 0.07) {
          stableSince.current = null;
          setIsFaceValid(false);
          updateError('Keep your head still.');
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        if (!stableSince.current) stableSince.current = Date.now();

        updateError('');
        updateStatus('Face detected successfully.');
        setIsFaceValid(true);
        activeTimeout.current = setTimeout(loop, 40);

      } catch (err) {
        console.error('[Face Validation Error]', err);
        activeTimeout.current = setTimeout(loop, 40);
      }
    };

    activeTimeout.current = setTimeout(loop, 50);
    return () => { isRunning = false; };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Post-capture quality validation (Registration)
  // ──────────────────────────────────────────────────────────────────────────
  const validateCaptureQuality = useCallback(async (imageSrc) => {
    if (window.location.search.includes('mock=true')) {
      const d = new Float32Array(128); d.fill(0.1);
      return Array.from(d);
    }

    const img        = await faceapi.fetchImage(imageSrc);
    const raw        = await faceapi.detectAllFaces(img, DETECTOR_OPTIONS).withFaceLandmarks().withFaceDescriptors();
    const detections = deduplicateDetections(raw);

    if (detections.length === 0) throw new Error('No face detected. Please position your face inside the oval.');
    if (detections.length > 1)  throw new Error('Multiple faces detected. Only one person should be visible.');

    const det       = detections[0];
    const box       = det.detection.box;
    const landmarks = det.landmarks.positions;

    const faceX = (box.x + box.width  / 2) / img.width;
    const faceY = (box.y + box.height / 2) / img.height;
    const faceW = box.width  / img.width;

    if (faceX < 0.28 || faceX > 0.72 || faceY < 0.22 || faceY > 0.78) throw new Error('Move your face inside the oval guide.');
    if (faceW < 0.18) throw new Error('You are too far away. Move closer to the camera.');
    if (faceW > 0.72) throw new Error('You are too close. Move slightly backward.');

    const leftEye = landmarks.slice(36, 42);
    const rightEye = landmarks.slice(42, 48);
    if (!leftEye.length || !rightEye.length) throw new Error('Eyes are not fully visible. Remove items blocking your face.');

    // Development debug logging
    console.log('[Biometric Debug] Captured image validated:');
    console.log(`  - Embedding dimensions: ${det.descriptor.length}`);
    console.log(`  - Face quality score (detector confidence): ${det.detection.score.toFixed(3)}`);

    return Array.from(det.descriptor);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW 2: Automatic Biometric Liveness Capture (Attendance)
  // ──────────────────────────────────────────────────────────────────────────
  const startBlinkDetection = useCallback((webcamRef) => {
    return new Promise((resolve) => {
      if (activeTimeout.current) clearTimeout(activeTimeout.current);

      updateStatus('Position your face inside the oval.');
      updateError('');
      lastNosePos.current      = null;
      stableSince.current      = null;
      calibrationEARs.current  = [];
      calibrationMARs.current  = [];
      calibrationYaws.current  = [];
      calibrationSmiles.current = [];
      calibrationBrows.current  = [];
      noseHistory.current      = [];
      smoothedScoreRef.current = 0.85;

      const videoElement = webcamRef?.current?.video;
      if (!videoElement) {
        const err = 'No camera detected.';
        updateError(err);
        resolve({ success: false, reason: err });
        return;
      }

      // ── Challenge List ────────────────────────────────────────────────────
      const CHALLENGES = [
        { type: 'blink', instruction: 'Please blink naturally once.' },
        { type: 'turn_left', instruction: 'Turn your head to the left.' },
        { type: 'turn_right', instruction: 'Turn your head to the right.' },
        { type: 'open_mouth', instruction: 'Please open your mouth.' },
        { type: 'smile', instruction: 'Please smile.' },
        { type: 'raise_eyebrows', instruction: 'Please raise your eyebrows.' }
      ];

      // ── Loop state ────────────────────────────────────────────────────────
      let isRunning = true;
      let phase = 'align'; // 'align' | 'calib' | 'challenge' | 'done'
      let activeChallenge = null;

      // Challenge validation state variables
      let blinkState = 0;        // 0=OPEN, 1=CLOSING, 2=CLOSED, 3=OPENING
      let challengeSuccessFrames = 0; // consecutive frames verifying the condition
      let closedFrameCount = 0;
      let openFrameCount = 0;

      let challengeTimeoutAt = 0;
      let frameCount = 0;

      // ── Main loop ─────────────────────────────────────────────────────────
      const loop = async () => {
        if (!isRunning) return;

        if (window.location.search.includes('mock=true')) {
          isRunning = false;
          const d = new Float32Array(128); d.fill(0.1);
          updateStatus('Face captured successfully.');
          resolve({
            success: true,
            imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            descriptor: Array.from(d)
          });
          return;
        }

        if (!webcamRef.current?.video) {
          isRunning = false;
          resolve({ success: false, reason: 'Camera feed unavailable.' });
          return;
        }

        const video  = webcamRef.current.video;
        const stream = video.srcObject;
        const isStreamActive = stream && stream.getTracks && stream.getTracks().some(t => t.readyState === 'live');
        if (video.ended || (stream && !isStreamActive)) {
          isRunning = false;
          const err = 'Camera permission is required to continue.';
          updateError(err);
          resolve({ success: false, reason: err });
          return;
        }

        if (video.readyState < 2) {
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        frameCount++;
        const now = Date.now();

        try {
          // ── 1. Brightness ───────────────────────────────────────────────
          const brightness = checkBrightness(video);
          if (brightness < 35) {
            updateError('Lighting is too low. Move to a brighter area.');
            updateStatus('Position your face inside the oval.');
            if (phase === 'align') stableSince.current = null;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // ── 2. Face detection ─────────────────────────────────────────────
          const raw        = await faceapi.detectAllFaces(video, DETECTOR_OPTIONS).withFaceLandmarks();
          const detections = deduplicateDetections(raw);

          if (detections.length === 0) {
            updateError('No face detected. Please position your face inside the oval.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            phase = 'align';
            activeChallenge = null;
            blinkState = 0;
            challengeSuccessFrames = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          if (detections.length > 1) {
            updateError('Multiple faces detected. Only one person should be visible.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            phase = 'align';
            activeChallenge = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          const det   = detections[0];
          const score = det.detection.score;

          // ── 3. EMA confidence ───────────────────────────────────────────
          smoothedScoreRef.current = smoothedScoreRef.current * 0.75 + score * 0.25;
          const minConfidence = phase === 'challenge' ? 0.40 : 0.50;
          if (smoothedScoreRef.current < minConfidence) {
            updateError('Face confidence low. Please look straight and keep steady.');
            if (phase === 'align') stableSince.current = null;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          const box       = det.detection.box;
          const landmarks = det.landmarks.positions;

          // ── 4. Face in oval ─────────────────────────────────────────────
          const { isInside, sizeRatio } = isFaceInOval(box, video.videoWidth, video.videoHeight);
          if (!isInside) {
            updateError('Move your face inside the oval guide.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            phase = 'align'; activeChallenge = null; blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // ── 5. Face size ────────────────────────────────────────────────
          if (sizeRatio > 0.96) {
            updateError('You are too close. Move slightly backward.');
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }
          if (sizeRatio < 0.32) {
            updateError('You are too far away. Move closer to the camera.');
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // ── 6. Pose/Yaw ratio ───────────────────────────────────────────
          const noseX     = landmarks[27].x;
          const faceLeft  = landmarks[0].x;
          const faceRight = landmarks[16].x;
          const faceW     = Math.abs(faceRight - faceLeft);
          const yawRatio  = faceW > 0 ? Math.abs(noseX - faceLeft) / faceW : 0.5;

          // Lenient bounds during active side-turns
          const isTurnChallenge = activeChallenge?.type === 'turn_left' || activeChallenge?.type === 'turn_right';
          const yawMin = (phase === 'challenge' && isTurnChallenge) ? 0.12 : 0.22;
          const yawMax = (phase === 'challenge' && isTurnChallenge) ? 0.88 : 0.78;

          if (yawRatio < yawMin || yawRatio > yawMax) {
            updateError('Please look directly at the camera.');
            if (phase === 'align') { stableSince.current = null; }
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // ── 7. Head stability ────────────────────────────────────────────
          const currentNose = landmarks[27];
          let frameMove = 0;
          if (lastNosePos.current) {
            frameMove = Math.hypot(
              currentNose.x - lastNosePos.current.x,
              currentNose.y - lastNosePos.current.y
            );
          }
          lastNosePos.current = currentNose;

          noseHistory.current.push({ x: currentNose.x, y: currentNose.y });
          if (noseHistory.current.length > 6) noseHistory.current.shift();

          let frameThresh;
          if (phase !== 'challenge') frameThresh = box.width * 0.05;
          else if (activeChallenge?.type === 'blink') frameThresh = box.width * 0.12; // allow minor eye blink movement
          else frameThresh = box.width * 0.25; // other challenges naturally involve some movement

          if (frameMove > frameThresh) {
            if (phase !== 'challenge') {
              stableSince.current = null;
              updateError('Keep your head steady.');
              activeTimeout.current = setTimeout(loop, 40);
              return;
            }
            // Extreme movement abort check
            if (frameMove > box.width * 0.45) {
              phase = 'align';
              stableSince.current = null;
              activeChallenge = null;
              updateError('Too much motion. Please hold still and try again.');
              activeTimeout.current = setTimeout(loop, 40);
              return;
            }
          }

          if (!stableSince.current) stableSince.current = now;
          const stableDuration = now - stableSince.current;

          // ── 8. Landmark metrics calculations ──────────────────────────────
          // EAR (Eyes)
          const leftEyePoints  = landmarks.slice(36, 42);
          const rightEyePoints = landmarks.slice(42, 48);
          const ear = (calculateEAR(leftEyePoints) + calculateEAR(rightEyePoints)) / 2.0;

          // MAR (Mouth inner aspect ratio)
          const mar = getDist(landmarks[62], landmarks[66]) / Math.max(0.001, getDist(landmarks[60], landmarks[64]));

          // Smile ratio (mouth width relative to face width)
          const smileRatio = getDist(landmarks[48], landmarks[54]) / Math.max(0.001, faceW);

          // Eyebrow ratio (eyebrows to eyes vertical distance)
          const eyebrowDist = (getDist(landmarks[19], landmarks[37]) + getDist(landmarks[24], landmarks[44])) / 2.0 / Math.max(0.001, faceW);

          // ── 9. Calibration phase ─────────────────────────────────────────
          if (phase === 'align' || phase === 'calib') {
            if (stableDuration < 600) {
              phase = 'calib';
              updateStatus('Hold still...');
              updateError('');
              if (ear >= 0.16 && ear <= 0.55) calibrationEARs.current.push(ear);
              calibrationMARs.current.push(mar);
              calibrationYaws.current.push(yawRatio);
              calibrationSmiles.current.push(smileRatio);
              calibrationBrows.current.push(eyebrowDist);
              activeTimeout.current = setTimeout(loop, 40);
              return;
            }

            // Enter challenge phase and randomly select one
            phase = 'challenge';
            const randomIndex = Math.floor(Math.random() * CHALLENGES.length);
            activeChallenge = CHALLENGES[randomIndex];
            challengeTimeoutAt = now + 9000; // 9 seconds to complete the challenge
            challengeSuccessFrames = 0;
            blinkState = 0;
            closedFrameCount = 0;
            openFrameCount = 0;
            updateStatus(activeChallenge.instruction);
            updateError('');
          }

          // ── 10. Baselines and Thresholds ──────────────────────────────────
          const getBase = (arr, def) => arr.length >= 3 ? arr.reduce((a,b)=>a+b,0)/arr.length : def;
          const baseEAR = getBase(calibrationEARs.current, 0.27);
          const baseMAR = getBase(calibrationMARs.current, 0.10);
          const baseYaw = getBase(calibrationYaws.current, 0.50);
          const baseSmile = getBase(calibrationSmiles.current, 0.32);
          const baseBrows = getBase(calibrationBrows.current, 0.20);

          const closeThreshold   = baseEAR * 0.60;
          const closingThreshold = baseEAR * 0.74;
          const openThreshold    = baseEAR * 0.84;

          // ── 11. Challenge verification state machine ──────────────────────
          let verified = false;

          if (activeChallenge.type === 'blink') {
            // Blink Sequence State Machine
            if (blinkState === 0) {
              if (ear > openThreshold) openFrameCount++;
              else openFrameCount = 0;
              if (ear < closingThreshold) { blinkState = 1; closedFrameCount = 0; }
            } else if (blinkState === 1) {
              if (ear < closeThreshold) {
                closedFrameCount++;
                if (closedFrameCount >= 1) blinkState = 2;
              } else if (ear > openThreshold) {
                blinkState = 0;
              }
            } else if (blinkState === 2) {
              if (ear < closeThreshold) closedFrameCount++;
              if (ear > closingThreshold) {
                if (closedFrameCount >= 1 && closedFrameCount <= 20) {
                  blinkState = 3;
                  openFrameCount = 0;
                } else {
                  blinkState = 0;
                  closedFrameCount = 0;
                }
              }
            } else if (blinkState === 3) {
              openFrameCount++;
              if (ear > openThreshold && openFrameCount >= 1) {
                verified = true;
              }
            }

          } else if (activeChallenge.type === 'turn_left') {
            // Look for yaw shift (user turns head left: nose shifts in video frame)
            // Handles both normal and mirrored cameras by looking for deviation in either direction
            const deviation = yawRatio - baseYaw;
            if (Math.abs(deviation) > 0.08) {
              challengeSuccessFrames++;
              if (challengeSuccessFrames >= 3) verified = true;
            } else {
              challengeSuccessFrames = 0;
            }

          } else if (activeChallenge.type === 'turn_right') {
            const deviation = yawRatio - baseYaw;
            if (Math.abs(deviation) > 0.08) {
              challengeSuccessFrames++;
              if (challengeSuccessFrames >= 3) verified = true;
            } else {
              challengeSuccessFrames = 0;
            }

          } else if (activeChallenge.type === 'open_mouth') {
            // Mouth Aspect Ratio (MAR) goes above baseline
            if (mar > baseMAR + 0.18 || mar > 0.35) {
              challengeSuccessFrames++;
              if (challengeSuccessFrames >= 3) verified = true;
            } else {
              challengeSuccessFrames = 0;
            }

          } else if (activeChallenge.type === 'smile') {
            // Smile pulls outer corners outward, increasing smileRatio
            if (smileRatio > baseSmile + 0.03) {
              challengeSuccessFrames++;
              if (challengeSuccessFrames >= 3) verified = true;
            } else {
              challengeSuccessFrames = 0;
            }

          } else if (activeChallenge.type === 'raise_eyebrows') {
            // Eyebrow distance increases relative to eye center
            if (eyebrowDist > baseBrows + 0.02) {
              challengeSuccessFrames++;
              if (challengeSuccessFrames >= 3) verified = true;
            } else {
              challengeSuccessFrames = 0;
            }
          }

          // Log debugging values requested by user
          console.log(
            `[Liveness] challenge:${activeChallenge.type} f:${frameCount} successF:${challengeSuccessFrames}` +
            ` | EAR:${ear.toFixed(3)} baseEAR:${baseEAR.toFixed(3)}` +
            ` | MAR:${mar.toFixed(3)} baseMAR:${baseMAR.toFixed(3)}` +
            ` | Yaw:${yawRatio.toFixed(3)} baseYaw:${baseYaw.toFixed(3)}` +
            ` | Smile:${smileRatio.toFixed(3)} baseSmile:${baseSmile.toFixed(3)}` +
            ` | Brows:${eyebrowDist.toFixed(3)} baseBrows:${baseBrows.toFixed(3)}` +
            ` | blinkState:${blinkState} conf:${smoothedScoreRef.current.toFixed(2)}`
          );

          // ── 12. Handle verified status ────────────────────────────────────
          if (verified && phase === 'challenge') {
            phase = 'capture_align';
            stableSince.current = null; // reset stability timer for the final capture
            updateStatus('Liveness verified! Look straight and hold still...');
            updateError('');
          }

          if (phase === 'capture_align') {
            // Wait until the user is looking straight and holding still
            const noseX     = landmarks[27].x;
            const faceLeft  = landmarks[0].x;
            const faceRight = landmarks[16].x;
            const faceW     = Math.abs(faceRight - faceLeft);
            const yawRatio  = faceW > 0 ? Math.abs(noseX - faceLeft) / faceW : 0.5;

            // Must look straight (yaw close to 0.5)
            const isLookingStraight = yawRatio >= 0.40 && yawRatio <= 0.60;

            const currentNose = landmarks[27];
            let frameMove = 0;
            if (lastNosePos.current) {
              frameMove = Math.hypot(
                currentNose.x - lastNosePos.current.x,
                currentNose.y - lastNosePos.current.y
              );
            }
            lastNosePos.current = currentNose;

            const isStable = frameMove < box.width * 0.02; // strict stability threshold

            if (!isLookingStraight) {
              updateError('Please look straight at the camera.');
              stableSince.current = null;
            } else if (!isStable) {
              updateError('Hold still...');
              stableSince.current = null;
            } else {
              updateError('');
              if (!stableSince.current) stableSince.current = now;
            }

            if (stableSince.current && (now - stableSince.current) >= 600) {
              // Stable and looking straight for 600ms! Safe to capture.
              isRunning = false;
              phase = 'done';
              updateStatus('Capturing face biometric...');

              try {
                // Generate high quality descriptor
                const rawFinal = await faceapi.detectAllFaces(video, DETECTOR_OPTIONS).withFaceLandmarks().withFaceDescriptors();
                const finalDets = deduplicateDetections(rawFinal);

                if (finalDets.length === 0) {
                  resolve({ success: false, reason: 'Face lost during capture. Please try again.' });
                  return;
                }

                const fd = finalDets[0];
                const imageSrc = webcamRef.current?.getScreenshot();
                if (!imageSrc) {
                  resolve({ success: false, reason: 'Screenshot failed. Please try again.' });
                  return;
                }

                // Development debug logging
                console.log('[Biometric Debug] Face capture success:');
                console.log(`  - Embedding dimensions: ${fd.descriptor.length}`);
                console.log(`  - Face quality score (detector confidence): ${fd.detection.score.toFixed(3)}`);
                console.log(`  - Face alignment score (yaw deviation): ${Math.abs(yawRatio - 0.5).toFixed(3)}`);

                resolve({ success: true, imageSrc, descriptor: Array.from(fd.descriptor) });
              } catch (captureErr) {
                console.error('[Capture error]', captureErr);
                resolve({ success: false, reason: 'Biometric capture failed.' });
              }
              return;
            }
          }

          // ── 13. Handle Timeout/Failure ────────────────────────────────────
          if (now > challengeTimeoutAt) {
            updateError(`Challenge timed out. Selecting new challenge...`);
            calibrationEARs.current = [];
            calibrationMARs.current = [];
            calibrationYaws.current = [];
            calibrationSmiles.current = [];
            calibrationBrows.current = [];
            stableSince.current = now;
            phase = 'calib';
            activeChallenge = null;
          }

          activeTimeout.current = setTimeout(loop, 40);

        } catch (err) {
          console.error('[Liveness Error]', err);
          activeTimeout.current = setTimeout(loop, 40);
        }
      };

      activeTimeout.current = setTimeout(loop, 50);
    });
  }, []);

  const resetBlinkDetection = useCallback(() => {
    if (activeTimeout.current) {
      clearTimeout(activeTimeout.current);
      activeTimeout.current = null;
    }
    setLivenessStatus('');
    setLivenessError('');
    setIsFaceValid(false);
    lastNosePos.current   = null;
    stableSince.current   = null;
    calibrationEARs.current = [];
    calibrationMARs.current = [];
    calibrationYaws.current = [];
    calibrationSmiles.current = [];
    calibrationBrows.current = [];
    noseHistory.current   = [];
  }, []);

  useEffect(() => {
    return () => {
      if (activeTimeout.current) clearTimeout(activeTimeout.current);
    };
  }, []);

  return {
    livenessStatus,
    livenessError,
    isFaceValid,
    startFaceValidation,
    validateCaptureQuality,
    startBlinkDetection,
    resetBlinkDetection,
  };
}

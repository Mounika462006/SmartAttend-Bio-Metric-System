import { useState, useCallback, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export function useBlinkDetection() {
  const [livenessStatus, setLivenessStatus] = useState('');
  const [livenessError, setLivenessError] = useState('');
  const [isFaceValid, setIsFaceValid] = useState(false);
  const activeTimeout = useRef(null);
  const canvasRef = useRef(null);
  
  // Tracking history for stability, calibration and blink sequence
  const lastNosePos = useRef(null);
  const stableSince = useRef(null);
  const calibrationEARs = useRef([]);
  const noseHistory = useRef([]); // tracks nose coordinates over the last 5 frames for blur/shake checks

  // Helper to calculate Eye Aspect Ratio (EAR)
  const calculateEAR = (eye) => {
    const dV1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const dV2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const dH = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (dV1 + dV2) / (2.0 * dH);
  };

  // Helper to calculate average pixel brightness of a video element using a small canvas
  const checkBrightness = (video) => {
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 40;
        canvasRef.current.height = 30;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 40, 30);
      const imgData = ctx.getImageData(0, 0, 40, 30).data;
      
      let totalBrightness = 0;
      const pixelsCount = imgData.length / 4;
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
      }
      return totalBrightness / pixelsCount; // Scale of 0 - 255
    } catch (e) {
      return 120; // safe fallback
    }
  };

  // Dynamic liveness status update helpers to avoid unnecessary renders
  const lastStatus = useRef('');
  const lastError = useRef('');
  const updateStatus = (statusText) => {
    if (statusText !== lastStatus.current) {
      lastStatus.current = statusText;
      setLivenessStatus(statusText);
    }
  };
  const updateError = (errorText) => {
    if (errorText !== lastError.current) {
      lastError.current = errorText;
      setLivenessError(errorText);
    }
  };

  // WORKFLOW 1: Face validation loop for MANUAL image capture (Registration)
  const startFaceValidation = useCallback((webcamRef) => {
    // Clear any existing active timeouts
    if (activeTimeout.current) {
      clearTimeout(activeTimeout.current);
    }
    
    setLivenessStatus('');
    setLivenessError('');
    setIsFaceValid(false);
    lastNosePos.current = null;
    stableSince.current = null;
    noseHistory.current = [];

    const videoElement = webcamRef?.current?.video;
    if (!videoElement) {
      updateError('No camera detected.');
      return;
    }

    const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.25,
    });

    let isRunning = true;

    updateStatus('Position your face inside the oval.');

    const loop = async () => {
      if (!isRunning) return;

      // Mock mode bypass check for automation testing
      if (window.location.search.includes('mock=true')) {
        updateError('');
        updateStatus('Face detected successfully.');
        setIsFaceValid(true);
        activeTimeout.current = setTimeout(loop, 1000);
        return;
      }

      // Unmount safety check
      if (!webcamRef.current?.video) {
        isRunning = false;
        return;
      }

      const video = webcamRef.current.video;

      // Check stream state
      const stream = video.srcObject;
      const isStreamActive = stream && stream.getTracks && stream.getTracks().some(track => track.readyState === 'live');
      if (video.ended || (stream && !isStreamActive)) {
        isRunning = false;
        updateError('Camera permission is required to continue.');
        return;
      }

      if (video.readyState < 2) {
        activeTimeout.current = setTimeout(loop, 40);
        return;
      }

      try {
        // Lighting Check
        const brightness = checkBrightness(video);
        if (brightness < 45) {
          updateError('Lighting is too low. Move to a brighter area.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const detections = await faceapi
          .detectAllFaces(video, DETECTOR_OPTIONS)
          .withFaceLandmarks();

        // 1. No Face Detected
        if (detections.length === 0) {
          updateError('No face detected. Please position your face inside the oval.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        // 2. Multiple Faces Detected
        if (detections.length > 1) {
          updateError('Multiple faces detected. Only one person should be visible.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const detection = detections[0];

        // 3. Score confidence checks
        if (detection.detection.score < 0.95) {
          updateError('Face confidence low. Please look straight and keep steady.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const box = detection.detection.box;
        const landmarks = detection.landmarks.positions;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Normalized coordinates
        const faceX = (box.x + box.width / 2) / videoWidth;
        const faceY = (box.y + box.height / 2) / videoHeight;
        const faceW = box.width / videoWidth;
        const faceH = box.height / videoHeight;

        // 4. Face proximity check (Too close / Too far)
        if (faceW > 0.65 || faceH > 0.75) {
          updateError('You are too close. Move slightly backward.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }
        if (faceW < 0.23 || faceH < 0.32) {
          updateError('You are too far away. Move closer to the camera.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        // 5. Centered check
        if (faceX < 0.35 || faceX > 0.65 || faceY < 0.30 || faceY > 0.70) {
          updateError('Move your face inside the oval guide.');
          updateStatus('Position your face inside the oval.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        // 6. Pose Orientation yaw checks (Straight head)
        const noseX = landmarks[27].x;
        const leftEdgeX = landmarks[0].x;
        const rightEdgeX = landmarks[16].x;
        const distLeft = Math.abs(noseX - leftEdgeX);
        const distRight = Math.abs(rightEdgeX - noseX);
        const totalWidth = distLeft + distRight;
        const yawRatio = totalWidth > 0 ? distLeft / totalWidth : 0.5;

        if (yawRatio < 0.42 || yawRatio > 0.58) {
          updateError('Please look directly at the camera.');
          updateStatus('Look directly at the camera.');
          setIsFaceValid(false);
          stableSince.current = null;
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        // 7. Face position stability checks
        const currentNose = landmarks[27];
        let isStable = false;

        noseHistory.current.push({ x: currentNose.x, y: currentNose.y });
        if (noseHistory.current.length > 5) {
          noseHistory.current.shift();
        }

        if (lastNosePos.current) {
          const movement = Math.hypot(currentNose.x - lastNosePos.current.x, currentNose.y - lastNosePos.current.y);
          if (movement < box.width * 0.02) {
            isStable = true;
          }
        } else {
          isStable = true;
        }
        lastNosePos.current = currentNose;

        if (noseHistory.current.length >= 4) {
          const xs = noseHistory.current.map(p => p.x);
          const ys = noseHistory.current.map(p => p.y);
          const maxDX = Math.max(...xs) - Math.min(...xs);
          const maxDY = Math.max(...ys) - Math.min(...ys);
          if (maxDX > box.width * 0.04 || maxDY > box.width * 0.04) {
            isStable = false; // motion/camera shake detected
          }
        }

        if (!isStable) {
          stableSince.current = null;
          setIsFaceValid(false);
          updateError('Keep your head still.');
          updateStatus('Look directly at the camera.');
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        const now = Date.now();
        if (!stableSince.current) {
          stableSince.current = now;
        }

        // Complete Validation confirmed
        updateError('');
        updateStatus('Face detected successfully.');
        setIsFaceValid(true);

        activeTimeout.current = setTimeout(loop, 40);
      } catch (err) {
        console.error('[Face Validation Loop Error]', err);
        activeTimeout.current = setTimeout(loop, 40);
      }
    };

    activeTimeout.current = setTimeout(loop, 50);

    return () => {
      isRunning = false;
    };
  }, []);

  // Post-capture quality validation helper (Registration manual verification)
  const validateCaptureQuality = useCallback(async (imageSrc) => {
    if (window.location.search.includes('mock=true')) {
      const dummyDescriptor = new Float32Array(128);
      dummyDescriptor.fill(0.1);
      return Array.from(dummyDescriptor);
    }

    const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.25,
    });

    const img = await faceapi.fetchImage(imageSrc);
    const detections = await faceapi
      .detectAllFaces(img, DETECTOR_OPTIONS)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      throw new Error('No face detected. Please position your face inside the oval.');
    }
    if (detections.length > 1) {
      throw new Error('Multiple faces detected. Only one person should be visible.');
    }

    const finalDet = detections[0];
    const box = finalDet.detection.box;
    const landmarks = finalDet.landmarks.positions;

    const faceX = (box.x + box.width / 2) / img.width;
    const faceY = (box.y + box.height / 2) / img.height;
    const faceW = box.width / img.width;
    const faceH = box.height / img.height;

    // Visibility of key features
    // Eyes: 36-47, Nose: 27-35, Mouth: 48-67
    const leftEye = landmarks.slice(36, 42);
    const rightEye = landmarks.slice(42, 48);
    const noseBridge = landmarks.slice(27, 31);
    const mouth = landmarks.slice(48, 68);

    if (leftEye.length === 0 || rightEye.length === 0) {
      throw new Error('Eyes are not fully visible. Remove items blocking your face.');
    }
    if (noseBridge.length === 0) {
      throw new Error('Nose is not fully visible.');
    }
    if (mouth.length === 0) {
      throw new Error('Mouth is not fully visible.');
    }

    // Alignment and size checks
    if (faceX < 0.35 || faceX > 0.65 || faceY < 0.30 || faceY > 0.70) {
      throw new Error('Move your face inside the oval guide.');
    }
    if (faceW < 0.23) {
      throw new Error('You are too far away. Move closer to the camera.');
    }
    if (faceW > 0.65) {
      throw new Error('You are too close. Move slightly backward.');
    }

    return Array.from(finalDet.descriptor);
  }, []);


  // WORKFLOW 2: AUTOMATIC Biometric Liveness Capture (Attendance)
  const startBlinkDetection = useCallback((webcamRef) => {
    return new Promise((resolve) => {
      // Clear any existing active timeouts
      if (activeTimeout.current) {
        clearTimeout(activeTimeout.current);
      }
      
      updateStatus('Position your face inside the oval.');
      updateError('');
      lastNosePos.current = null;
      stableSince.current = null;
      calibrationEARs.current = [];
      noseHistory.current = [];

      const videoElement = webcamRef?.current?.video;
      if (!videoElement) {
        const err = 'No camera detected.';
        updateError(err);
        resolve({ success: false, reason: err });
        return;
      }

      const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.25,
      });

      // Liveness tracking state variables
      let isRunning = true;
      let isLivenessVerified = false;

      // Advanced Blink Validation State Machine Sequence
      // Sequence states: 
      // 0 = OPEN
      // 1 = CLOSING
      // 2 = CLOSED
      // 3 = OPENING
      // 4 = VERIFIED (Success)
      let blinkState = 0; 
      let openFramesCount = 0;
      let closedStartTime = 0;
      let blinkFailuresCount = 0;
      let blinkFailureTimestamp = 0;

      const loop = async () => {
        if (!isRunning) return;

        // Unmount safety check
        if (!webcamRef.current?.video) {
          isRunning = false;
          resolve({ success: false, reason: 'Camera feed unavailable.' });
          return;
        }

        const video = webcamRef.current.video;

        // Check if stream stopped
        const stream = video.srcObject;
        const isStreamActive = stream && stream.getTracks && stream.getTracks().some(track => track.readyState === 'live');
        if (video.ended || (stream && !isStreamActive)) {
          isRunning = false;
          const err = 'Camera permission is required to continue.';
          updateError(err);
          resolve({ success: false, reason: err });
          return;
        }

        // Wait until video has valid frames
        if (video.readyState < 2) {
          activeTimeout.current = setTimeout(loop, 40);
          return;
        }

        try {
          // 1. Lighting Check
          const brightness = checkBrightness(video);
          if (brightness < 45) {
            updateError('Lighting is too low. Move to a brighter area.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          const detections = await faceapi
            .detectAllFaces(video, DETECTOR_OPTIONS)
            .withFaceLandmarks();

          // 2. No Face Detected
          if (detections.length === 0) {
            updateError('No face detected. Please position your face inside the oval.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // 3. Multiple Faces Detected
          if (detections.length > 1) {
            updateError('Multiple faces detected. Only one person should be visible.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          const detection = detections[0];

          // 4. Face confidence check
          if (detection.detection.score < 0.95) {
            updateError('Face confidence low. Please look straight and keep steady.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          const box = detection.detection.box;
          const landmarks = detection.landmarks.positions;
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          // Normalized dimensions
          const faceX = (box.x + box.width / 2) / videoWidth;
          const faceY = (box.y + box.height / 2) / videoHeight;
          const faceW = box.width / videoWidth;
          const faceH = box.height / videoHeight;

          // 5. Face Size Checks (Too close / Too far)
          if (faceW > 0.65 || faceH > 0.75) {
            updateError('You are too close. Move slightly backward.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }
          if (faceW < 0.23 || faceH < 0.32) {
            updateError('You are too far away. Move closer to the camera.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // 6. Face bounds alignment checks (Centered)
          if (faceX < 0.35 || faceX > 0.65 || faceY < 0.30 || faceY > 0.70) {
            updateError('Move your face inside the oval guide.');
            updateStatus('Position your face inside the oval.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // 7. Pose Orientation Checks (Yaw, Pitch, Roll straight)
          // Yaw: nose bridge vs face edges
          const noseX = landmarks[27].x;
          const leftEdgeX = landmarks[0].x;
          const rightEdgeX = landmarks[16].x;
          const distLeft = Math.abs(noseX - leftEdgeX);
          const distRight = Math.abs(rightEdgeX - noseX);
          const totalWidth = distLeft + distRight;
          const yawRatio = totalWidth > 0 ? distLeft / totalWidth : 0.5;

          // Pitch: nose bridge vs nose tip vs chin vertical distribution
          const distUpper = Math.abs(landmarks[27].y - landmarks[33].y);
          const distLower = Math.abs(landmarks[33].y - landmarks[8].y);
          const pitchRatio = distLower > 0 ? distUpper / distLower : 0.35;

          // Roll: Eye centers tilt angle
          const leftEyePoints = landmarks.slice(36, 42);
          const rightEyePoints = landmarks.slice(42, 48);
          const leftEyeCenter = {
            x: leftEyePoints.reduce((acc, p) => acc + p.x, 0) / 6,
            y: leftEyePoints.reduce((acc, p) => acc + p.y, 0) / 6,
          };
          const rightEyeCenter = {
            x: rightEyePoints.reduce((acc, p) => acc + p.x, 0) / 6,
            y: rightEyePoints.reduce((acc, p) => acc + p.y, 0) / 6,
          };
          const rollAngle = Math.abs(Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x) * (180 / Math.PI));

          // Enforce straight head pose
          if (yawRatio < 0.42 || yawRatio > 0.58) {
            updateError('Please look directly at the camera.');
            updateStatus('Look directly at the camera.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }
          if (pitchRatio < 0.20 || pitchRatio > 0.55) {
            updateError('Please look directly at the camera.');
            updateStatus('Look directly at the camera.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }
          if (rollAngle > 10) {
            updateError('Please look directly at the camera.');
            updateStatus('Look directly at the camera.');
            stableSince.current = null;
            blinkState = 0;
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // 8. Stability and Motion Blur Checks
          const currentNose = landmarks[27];
          let isStable = false;

          noseHistory.current.push({ x: currentNose.x, y: currentNose.y });
          if (noseHistory.current.length > 5) {
            noseHistory.current.shift();
          }

          if (lastNosePos.current) {
            const movement = Math.hypot(currentNose.x - lastNosePos.current.x, currentNose.y - lastNosePos.current.y);
            // Must not move more than 2% of face width
            if (movement < box.width * 0.02) {
              isStable = true;
            }
          } else {
            isStable = true;
          }
          lastNosePos.current = currentNose;

          if (noseHistory.current.length >= 4) {
            const xs = noseHistory.current.map(p => p.x);
            const ys = noseHistory.current.map(p => p.y);
            const maxDX = Math.max(...xs) - Math.min(...xs);
            const maxDY = Math.max(...ys) - Math.min(...ys);
            if (maxDX > box.width * 0.04 || maxDY > box.width * 0.04) {
              isStable = false; // Camera shake detected
            }
          }

          if (!isStable) {
            stableSince.current = null;
            blinkState = 0;
            updateError('Keep your head steady.');
            updateStatus('Look directly at the camera.');
            activeTimeout.current = setTimeout(loop, 40);
            return;
          }

          // Start stable timer
          const now = Date.now();
          if (!stableSince.current) {
            stableSince.current = now;
          }

          const stableDuration = now - stableSince.current;

          // Clear any error states since alignment is fully confirmed
          // Unless we are actively displaying the friendly warning about a failed blink
          const isWarningBlinkFailure = blinkFailuresCount > 0 && (now - blinkFailureTimestamp < 6000);
          if (!isWarningBlinkFailure) {
            updateError('');
          }

          // 9. Dynamic baseline calibration (First 2000ms is calibration/stability)
          const leftEAR = calculateEAR(leftEyePoints);
          const rightEAR = calculateEAR(rightEyePoints);
          const ear = (leftEAR + rightEAR) / 2.0;

          if (stableDuration < 2000) {
            updateStatus('Keep your head steady.');
            if (ear >= 0.24 && ear <= 0.42) {
              calibrationEARs.current.push(ear);
              if (calibrationEARs.current.length > 25) {
                calibrationEARs.current.shift();
              }
            }
          } else {
            // Stability achieved and baseline calibrated
            if (!isWarningBlinkFailure) {
              updateStatus('Please blink naturally once.');
            }

            const maxEAR = calibrationEARs.current.length >= 5
              ? Math.max(...calibrationEARs.current)
              : 0.28;

            const closeThreshold = maxEAR * 0.70;      // Fully closed
            const closingThreshold = maxEAR * 0.76;    // Midpoint down
            const openingThreshold = maxEAR * 0.76;    // Midpoint up
            const openThreshold = maxEAR * 0.82;       // Fully open

            // Blink sequence state machine transitions
            if (blinkState === 0) { // OPEN
              if (ear > openThreshold) {
                openFramesCount++;
              } else {
                openFramesCount = 0;
              }
              
              if (ear < closingThreshold && openFramesCount >= 3) {
                blinkState = 1; // Transition: CLOSING
                console.log('[Liveness] State: OPEN -> CLOSING', ear.toFixed(3));
              }
            } else if (blinkState === 1) { // CLOSING
              if (ear < closeThreshold) {
                blinkState = 2; // Transition: CLOSED
                closedStartTime = now;
                console.log('[Liveness] State: CLOSING -> CLOSED', ear.toFixed(3));
              } else if (ear > openThreshold) {
                // Aborted/incomplete blink, reset
                blinkState = 0;
                openFramesCount = 0;
              }
            } else if (blinkState === 2) { // CLOSED
              if (ear > openingThreshold) {
                const duration = now - closedStartTime;
                if (duration >= 80 && duration <= 500) {
                  blinkState = 3; // Transition: OPENING
                  console.log('[Liveness] State: CLOSED -> OPENING', ear.toFixed(3), `duration: ${duration}ms`);
                } else {
                  console.log('[Liveness] State: CLOSED -> OPEN (Blink duration out of range)', duration);
                  blinkState = 0;
                  openFramesCount = 0;
                }
              }
            } else if (blinkState === 3) { // OPENING
              if (ear > openThreshold) {
                blinkState = 4; // Transition: VERIFIED
                updateStatus('Blink detected.');
                console.log('[Liveness] State: OPENING -> VERIFIED. Blink sequence fully validated!');
                
                isRunning = false; // Stop active check loop

                // Wait 500ms and run dynamic re-verification capture logic
                setTimeout(async () => {
                  try {
                    // Double check stream validity
                    if (!webcamRef.current?.video) {
                      resolve({ success: false, reason: 'Face lost. Please position your face inside the oval again.' });
                      return;
                    }
                    
                    const verifyVideo = webcamRef.current.video;
                    const finalDetections = await faceapi
                      .detectAllFaces(verifyVideo, DETECTOR_OPTIONS)
                      .withFaceLandmarks()
                      .withFaceDescriptors();

                    if (finalDetections.length === 0) {
                      resolve({ success: false, reason: 'Face lost. Please position your face inside the oval again.' });
                      return;
                    }

                    const finalDet = finalDetections[0];
                    const finalBox = finalDet.detection.box;
                    const finalLms = finalDet.landmarks.positions;

                    // Re-verify centering
                    const fX = (finalBox.x + finalBox.width / 2) / verifyVideo.videoWidth;
                    const fY = (finalBox.y + finalBox.height / 2) / verifyVideo.videoHeight;
                    if (fX < 0.35 || fX > 0.65 || fY < 0.30 || fY > 0.70) {
                      resolve({ success: false, reason: 'Face lost. Please position your face inside the oval again.' });
                      return;
                    }

                    // Re-verify eye state (Reopened)
                    const fLeftEye = finalLms.slice(36, 42);
                    const fRightEye = finalLms.slice(42, 48);
                    const finalEAR = (calculateEAR(fLeftEye) + calculateEAR(fRightEye)) / 2.0;

                    if (finalEAR < openThreshold) {
                      resolve({ success: false, reason: 'Blink not detected. Please keep looking directly at the camera.' });
                      return;
                    }

                    // Verify image sharp and no motion blur
                    const currentNoseFinal = finalLms[27];
                    if (lastNosePos.current) {
                      const finalMove = Math.hypot(currentNoseFinal.x - lastNosePos.current.x, currentNoseFinal.y - lastNosePos.current.y);
                      if (finalMove > finalBox.width * 0.02) {
                        resolve({ success: false, reason: 'Face lost. Please position your face inside the oval again.' });
                        return;
                      }
                    }

                    // Proceed to get base64 screen grab
                    const imageSrc = webcamRef.current?.getScreenshot();
                    if (!imageSrc) {
                      resolve({ success: false, reason: 'Face lost. Please position your face inside the oval again.' });
                      return;
                    }

                    updateStatus('Face captured successfully.');
                    resolve({
                      success: true,
                      imageSrc,
                      descriptor: Array.from(finalDet.descriptor)
                    });
                  } catch (e) {
                    resolve({ success: false, reason: 'Blink not detected. The system will continue monitoring automatically.' });
                  }
                }, 500);
                return;
              }
            }

            // If the user has been waiting for a blink for too long (e.g. 8 seconds since calibration), show friendly help prompt
            const monitoringDuration = now - (stableSince.current + 2000);
            if (monitoringDuration > 8000 && blinkState === 0 && !isWarningBlinkFailure) {
              blinkFailuresCount++;
              blinkFailureTimestamp = now;
              updateError('Blink not detected. Please blink slowly and naturally while looking directly at the camera. Keep your head still and avoid moving during the blink.');
              calibrationEARs.current = []; // Re-calibrate baseline
              stableSince.current = now; // Reset timer for fresh calibration
            }
          }

          // Continue loop at 40ms interval
          activeTimeout.current = setTimeout(loop, 40);

        } catch (err) {
          console.error('[Liveness Loop Error]', err);
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
  }, []);

  useEffect(() => {
    return () => {
      if (activeTimeout.current) {
        clearTimeout(activeTimeout.current);
      }
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

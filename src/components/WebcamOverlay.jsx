import { useRef, useEffect, useCallback, useState } from "react";
import { PoseLandmarker, HandLandmarker, FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { send } from "../ws/client";
import SkeletonOverlay from "./SkeletonOverlay";
import "./WebcamOverlay.css";

const POSE_MODEL = "/models/pose_landmarker_lite.task";
const HAND_MODEL = "/models/hand_landmarker.task";
const FACE_MODEL  = "/models/face_landmarker.task";

let poseLandmarker = null;
let handLandmarker = null;
let faceLandmarker  = null;

async function initModels() {
  if (poseLandmarker && handLandmarker && faceLandmarker) return;

  let vision;
  try {
    vision = await FilesetResolver.forVisionTasks("/wasm");
  } catch (e) {
    throw new Error("WASM_LOAD_FAILED: " + e.message);
  }

  const tryCreate = async (name, factory) => {
    try {
      return await factory();
    } catch (e) {
      console.warn(`${name} failed with GPU delegate, trying CPU...`, e.message);
      try {
        return await factory("CPU");
      } catch (e2) {
        throw new Error(`MODEL_${name}_FAILED: ` + e2.message);
      }
    }
  };

  if (!poseLandmarker) {
    poseLandmarker = await tryCreate("POSE", (delegate = "GPU") =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: "VIDEO", numPoses: 1,
      })
    );
  }
  if (!handLandmarker) {
    handLandmarker = await tryCreate("HAND", (delegate = "GPU") =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: "VIDEO", numHands: 2,
      })
    );
  }
  if (!faceLandmarker) {
    faceLandmarker = await tryCreate("FACE", (delegate = "GPU") =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO", numFaces: 1,
        outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
      })
    );
  }
}

export default function WebcamOverlay({ onSignalData }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error-camera | error-models | stream-ended
  const [poseLms, setPoseLms] = useState(null);
  const [handLms, setHandLms] = useState(null);
  const [faceLms, setFaceLms] = useState(null);
  const lastFrameRef = useRef(0);
  const mountedRef = useRef(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    try {
      await initModels();
    } catch {
      setStatus("error-models");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } },
      });
      const video = videoRef.current;
      if (!video || !mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = stream;
      streamRef.current = stream;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(reject);
        };
        video.onerror = reject;
        setTimeout(() => reject(new Error("video timeout")), 5000);
      });

      setStatus("ready");
    } catch {
      setStatus("error-camera");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [startCamera, stopStream]);

  const processFrame = useCallback(() => {
    if (!animRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      animRef.current = requestAnimationFrame(processFrame);
      return;
    }
    const now = performance.now();
    if (now - lastFrameRef.current < 30) {
      animRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameRef.current = now;
    const ts = now / 1000;
    const w = video.videoWidth;
    const h = video.videoHeight;

    try {
      let currentPose = null;
      let currentHands = { left: null, right: null };
      let currentFace = null;
      let roiMean = 0;

      if (faceLandmarker) {
        const faceResult = faceLandmarker.detectForVideo(video, now);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          currentFace = faceResult.faceLandmarks[0];
          const fx = Math.floor(w * 0.30), fy = Math.floor(h * 0.05);
          const fw = Math.floor(w * 0.40), fh = Math.floor(h * 0.25);
          
          if (!window._roiCanvas) {
            window._roiCanvas = document.createElement("canvas");
          }
          const canvas = window._roiCanvas;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const imgData = ctx.getImageData(fx, fy, fw, fh).data;
          let rSum = 0, gSum = 0, count = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            rSum += imgData[i];
            gSum += imgData[i+1];
            count++;
          }
          const rMean = count > 0 ? rSum / count : 0;
          const gMean = count > 0 ? gSum / count : 0;
          roiMean = (gMean - rMean) / (1e-7 + Math.abs(gMean + rMean));
        }
      }

      if (poseLandmarker) {
        const poseResult = poseLandmarker.detectForVideo(video, now);
        if (poseResult.landmarks && poseResult.landmarks.length > 0) {
          currentPose = poseResult.landmarks[0];
        }
      }
      if (handLandmarker) {
        const handResult = handLandmarker.detectForVideo(video, now);
        if (handResult.landmarks && handResult.landmarks.length > 0) {
          for (let h = 0; h < handResult.landmarks.length; h++) {
            const handLm = handResult.landmarks[h];
            const handednessList = handResult.handednesses?.[h];
            let side = "right";
            if (handednessList && handednessList.length > 0) {
              side = handednessList[0].categoryName === "Left" ? "left" : "right";
            }
            if (side === "left") currentHands.left = handLm;
            else currentHands.right = handLm;
          }
        }
      }

      setPoseLms(currentPose);
      setHandLms(currentHands);
      setFaceLms(currentFace);
      onSignalData?.(roiMean);

      const landmarksArray = currentFace
        ? currentFace.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z || 0 }))
        : [];

      send({
        timestamp: ts,
        roi_mean: roiMean,
        frame_width: w,
        frame_height: h,
        landmarks: landmarksArray,
        pose_landmarks: currentPose ? currentPose.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) : null,
        left_hand: currentHands.left ? currentHands.left.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })) : null,
        right_hand: currentHands.right ? currentHands.right.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })) : null,
      });
    } catch {
      // skip frame on error
    }

    animRef.current = requestAnimationFrame(processFrame);
  }, [onSignalData]);

  useEffect(() => {
    if (status !== "ready") return;
    animRef.current = requestAnimationFrame(processFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [status, processFrame]);

  const handleRetry = () => { stopStream(); startCamera(); };

  return (
    <div className="webcam-container">
      <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
      {status === "ready" && (
        <>
          <div className="webcam-live-badge">
            <span className="webcam-live-badge-dot" />
            <span>AI Stream Active</span>
          </div>
          <SkeletonOverlay poseLandmarks={poseLms} handLandmarks={handLms} visible={true} />
        </>
      )}


      {status === "loading" && (
        <div className="webcam-status" role="status">
          <div className="webcam-spinner" />
          <span>Initializing camera and vision models...</span>
        </div>
      )}

      {status === "error-models" && (
        <div className="webcam-status" role="alert">
          <span className="webcam-error-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <span>Could not load vision models. The model files (~10MB) download from Google CDN. Check your firewall or try a different network.</span>
          <button className="ios-btn ios-btn--ghost ios-btn--sm" onClick={handleRetry} style={{ marginTop: 12 }}>Retry</button>
        </div>
      )}

      {status === "error-camera" && (
        <div className="webcam-status" role="alert">
          <span className="webcam-error-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </span>
          <span>Camera access denied or not available. Allow camera permission in browser settings and reload.</span>
          <button className="ios-btn ios-btn--ghost ios-btn--sm" onClick={handleRetry} style={{ marginTop: 12 }}>Retry</button>
        </div>
      )}
    </div>
  );
}

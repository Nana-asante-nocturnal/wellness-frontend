import { useEffect, useRef } from "react";
import "./SkeletonOverlay.css";

const POSE_CONNECTIONS = [
  [11,12],[12,24],[11,23],[23,24],[24,26],[23,25],[26,28],[25,27],
  [28,32],[27,31],[12,14],[11,13],[14,16],[13,15],
];

export default function SkeletonOverlay({ poseLandmarks, handLandmarks, width, height, visible }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width || 640;
    canvas.height = height || 480;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!visible) return;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (poseLandmarks && poseLandmarks.length >= 33) {
      for (const [i, j] of POSE_CONNECTIONS) {
        const a = poseLandmarks[i];
        const b = poseLandmarks[j];
        if (!a || !b || (a.visibility != null && a.visibility < 0.5) || (b.visibility != null && b.visibility < 0.5)) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.stroke();
      }
      for (const lm of poseLandmarks) {
        if (!lm || (lm.visibility != null && lm.visibility < 0.5)) continue;
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fill();
      }
    }

    if (handLandmarks) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1.5;
      const drawHand = (lms) => {
        if (!lms || lms.length < 21) return;
        for (let i = 0; i < lms.length; i++) {
          const lm = lms[i];
          if (!lm) continue;
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fill();
        }
      };
      if (Array.isArray(handLandmarks)) drawHand(handLandmarks);
      else {
        drawHand(handLandmarks.left);
        drawHand(handLandmarks.right);
      }
    }
  }, [poseLandmarks, handLandmarks, width, height, visible]);

  return (
    <canvas ref={canvasRef} className="skeleton-overlay" aria-hidden="true" />
  );
}

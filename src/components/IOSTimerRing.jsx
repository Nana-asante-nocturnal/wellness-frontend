import { useEffect, useRef } from "react";
import "./IOSTimerRing.css";

export default function IOSTimerRing({ progress, size = 120, strokeWidth = 8, label, sublabel }) {
  const canvasRef = useRef(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "var(--border-subtle)";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(Math.max(progress, 0), 1));
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }, [progress, size, strokeWidth, circumference, radius]);

  return (
    <div className="ios-timer-ring" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} width={size} height={size} className="ios-timer-canvas" aria-hidden="true" />
      <div className="ios-timer-label">
        {label && <span className="ios-timer-value">{label}</span>}
        {sublabel && <span className="ios-timer-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

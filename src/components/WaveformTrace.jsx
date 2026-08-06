import { useRef, useEffect, useCallback } from "react";
import "./WaveformTrace.css";

const TRACE_LENGTH = 450;
const MIN_Y = -1.5;
const MAX_Y = 1.5;

export default function WaveformTrace({ signalData }) {
  const canvasRef = useRef(null);
  const bufferRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    const buf = bufferRef.current;
    if (buf.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = "var(--accent, #6C5CE7)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(108, 92, 231, 0.4)";
    ctx.shadowBlur = 8;

    const stepX = width / Math.max(buf.length - 1, 1);
    const midY = height / 2;
    const scaleY = height / (MAX_Y - MIN_Y);

    ctx.moveTo(0, midY - (buf[0] || 0) * scaleY * 0.3);
    for (let i = 1; i < buf.length; i++) {
      const x = i * stepX;
      const y = midY - (buf[i] || 0) * scaleY * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, []);

  useEffect(() => {
    const t = setInterval(draw, 50);
    return () => clearInterval(t);
  }, [draw]);

  useEffect(() => {
    if (signalData == null) return;
    bufferRef.current.push(signalData);
    if (bufferRef.current.length > TRACE_LENGTH) {
      bufferRef.current = bufferRef.current.slice(-TRACE_LENGTH);
    }
  }, [signalData]);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-trace"
      width={600}
      height={120}
      aria-label="Live pulse waveform trace"
    />
  );
}

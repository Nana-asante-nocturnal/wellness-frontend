import { useState, useEffect, useCallback, useRef } from "react";
import { on, send } from "../ws/client";
import IOSButton from "../components/IOSButton";
import IOSStatusBadge from "../components/IOSStatusBadge";
import IOSTimerRing from "../components/IOSTimerRing";
import "./Calibration.css";

const CALIB_TOTAL_SEC = 90;

export default function Calibration({ onComplete, onCancel }) {
  const [phase, setPhase] = useState("notice"); // notice | monitoring | complete
  const [elapsed, setElapsed] = useState(0);
  const [baselineData, setBaselineData] = useState(null);
  const timerRef = useRef(null);

  // Listen for WebSocket calibration responses
  useEffect(() => {
    const unsubStatus = on("calibration_status", (msg) => {
      if (msg.status === "started") {
        setPhase("monitoring");
      } else if (msg.status === "collecting" && msg.elapsed != null) {
        setElapsed(Math.min(msg.elapsed, CALIB_TOTAL_SEC));
      }
    });

    const unsubComplete = on("calibration_complete", (msg) => {
      setBaselineData({
        baselineRmssd: msg.baseline_rmssd,
        interocularPx: msg.interocular_px,
      });
      setPhase("complete");
      setElapsed(CALIB_TOTAL_SEC);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    return () => {
      unsubStatus();
      unsubComplete();
    };
  }, []);

  // Countdown timer for continuous 90s monitoring
  const startMonitoring = useCallback(() => {
    setPhase("monitoring");
    setElapsed(0);
    send({ type: "calibration_start" });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= CALIB_TOTAL_SEC) {
          clearInterval(timerRef.current);
          send({ type: "calibration_end" });
          return CALIB_TOTAL_SEC;
        }
        return next;
      });
    }, 1000);
  }, []);

  // Early end if user triggers or enough data has been collected (>= 15s)
  const handleEndEarly = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    send({ type: "calibration_end" });
  }, []);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    send({ type: "calibration_end" });
    onCancel?.();
  }, [onCancel]);

  const handleFinish = useCallback(() => {
    onComplete?.(baselineData);
  }, [onComplete, baselineData]);

  // Auto finish 2.5s after complete
  useEffect(() => {
    if (phase === "complete") {
      const timeout = setTimeout(() => {
        onComplete?.(baselineData);
      }, 2800);
      return () => clearTimeout(timeout);
    }
  }, [phase, onComplete, baselineData]);

  const remaining = Math.max(0, CALIB_TOTAL_SEC - Math.floor(elapsed));
  const progressPct = Math.min(100, Math.round((elapsed / CALIB_TOTAL_SEC) * 100));
  const hasEnoughData = elapsed >= 15;

  return (
    <div className="calibration-overlay">
      <div className="calibration-card">

        {/* PHASE 1: PRE-MONITORING 90-SECOND NOTICE */}
        {phase === "notice" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                Baseline Calibration
              </h2>
              <IOSStatusBadge variant="warning" label="90s Monitoring Required" />
            </div>

            <div className="calibration-notice-banner">
              <span className="calibration-notice-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <div className="calibration-notice-content">
                <span className="calibration-notice-title">Important Notice: 90 Seconds Duration</span>
                <p className="calibration-notice-text">
                  Baseline calibration requires <strong>90 seconds of continuous monitoring</strong>.
                  Please sit comfortably, face your webcam directly, and remain still with normal breathing.
                </p>
              </div>
            </div>

            <p className="text-secondary text-sm" style={{ lineHeight: 1.5 }}>
              This 90-second capture records your resting heart rate variability (HRV RMSSD) and comfortable screen distance.
              It establishes your personal baseline for accurate stress and eye strain evaluations.
            </p>

            <div className="calibration-actions">
              <IOSButton variant="filled" size="lg" full onClick={startMonitoring}>
                Begin 90s Baseline Calibration
              </IOSButton>
              <IOSButton variant="outline" full onClick={handleCancel}>
                Cancel
              </IOSButton>
            </div>
          </>
        )}

        {/* PHASE 2: ACTIVE 90-SECOND MONITORING */}
        {phase === "monitoring" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                Recording Baseline
              </h2>
              <IOSStatusBadge variant="warning" label="Recording Active" />
            </div>

            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <IOSTimerRing
                progress={1 - (remaining / CALIB_TOTAL_SEC)}
                label={remaining > 0 ? remaining : ""}
                sublabel={remaining > 0 ? "SEC REMAINING" : "ANALYZING"}
              />
            </div>

            <div className="calibration-progress">
              <div className="calibration-bar-bg">
                <div
                  className="calibration-bar-fill"
                  style={{ width: `${progressPct}%` }}
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="calibration-status-row">
                <span className="text-secondary text-xs">
                  Recording rPPG pulse & landmark geometry...
                </span>
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>
                  {progressPct}% ({Math.floor(elapsed)}s / 90s)
                </span>
              </div>
            </div>

            <div className="calibration-actions">
              {hasEnoughData ? (
                <IOSButton variant="filled" full onClick={handleEndEarly}>
                  Finish Calibration Now (Enough Details Collected)
                </IOSButton>
              ) : (
                <p className="text-tertiary text-xs text-center">
                  Collecting initial baseline frames (minimum 15s required)...
                </p>
              )}
              <IOSButton variant="outline" full onClick={handleCancel}>
                Cancel Calibration
              </IOSButton>
            </div>
          </>
        )}

        {/* PHASE 3: CALIBRATION COMPLETE */}
        {phase === "complete" && (
          <>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px", color: "var(--green)" }}>✓</div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                Calibration Complete!
              </h2>
              <p className="text-secondary text-sm">
                Your personal resting baseline has been successfully calculated and stored for this session.
              </p>
            </div>

            <div className="calibration-metric-pill">
              <span className="text-sm font-medium">Baseline HRV (RMSSD)</span>
              <span className="font-mono text-lg font-semibold" style={{ color: "var(--accent-light)" }}>
                {baselineData?.baselineRmssd != null ? `${Math.round(baselineData.baselineRmssd)} ms` : "Established"}
              </span>
            </div>

            <div className="calibration-metric-pill">
              <span className="text-sm font-medium">Interocular Ref Distance</span>
              <span className="font-mono text-lg font-semibold" style={{ color: "var(--info)" }}>
                {baselineData?.interocularPx != null ? `${Math.round(baselineData.interocularPx)} px` : "Recorded"}
              </span>
            </div>

            <div className="calibration-actions" style={{ marginTop: "12px" }}>
              <IOSButton variant="filled" size="lg" full onClick={handleFinish}>
                Continue to Dashboard
              </IOSButton>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

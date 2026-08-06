import { useState, useEffect, useCallback, useRef } from "react";
import { on, send, connect } from "../ws/client";
import WebcamOverlay from "../components/WebcamOverlay";
import WaveformTrace from "../components/WaveformTrace";
import IOSCard from "../components/IOSCard";
import IOSButton from "../components/IOSButton";
import IOSStatusBadge from "../components/IOSStatusBadge";
import InfoTip from "../components/InfoTip";
import BackendStatus from "../components/BackendStatus";
import TestRunner from "../components/TestRunner";
import "./Wellness.css";

export default function Wellness({ calibrated, baselineRmssd, onCalibrate, wsConnected }) {
  const [signalData, setSignalData] = useState(null);
  const [frameResult, setFrameResult] = useState(null);
  const [sessionActive, setSessionActive] = useState(true);
  const [sessionSummary, setSessionSummary] = useState(null);
  const sessionKey = useRef(0);

  useEffect(() => {
    const unsub = on("frame_result", (msg) => { if (sessionActive) setFrameResult(msg.data); });
    const unsub4 = on("session_summary", (msg) => setSessionSummary(msg.summary));
    return () => { unsub(); unsub4(); };
  }, [sessionActive]);

  const handleSignalData = useCallback((val) => setSignalData(val), []);

  const handleEndSession = useCallback(() => {
    setSessionActive(false);
    setFrameResult(null);
    setSignalData(null);
    send({ type: "get_summary" });
  }, []);

  const handleStartNew = useCallback(() => {
    setSessionActive(true);
    setSessionSummary(null);
    setFrameResult(null);
    setSignalData(null);
    sessionKey.current += 1;
    connect();
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!sessionSummary) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/report/wellness`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionSummary),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "wellness_report.pdf"; a.click();
      URL.revokeObjectURL(url);
    } catch { }
  }, [sessionSummary]);

  const data = frameResult || {};
  const hr = data.heart_rate || {};
  const resp = data.respiratory_rate || {};
  const hrv = data.hrv || {};
  const drowsiness = data.drowsiness || {};
  const eyeStrain = data.eye_strain || {};

  return (
    <div className="ios-content" key={sessionKey.current}>
      <div className="wellness-header">
        <div>
          <h1 className="ios-large-title">Wellness Monitor</h1>
          <p className="text-secondary text-sm">Real-time non-contact rPPG vital signs and neuro-fatigue assessment</p>
        </div>
      </div>

      <div className="wellness-layout">
        <div className="wellness-col">
          {sessionActive ? (
            <div className="wellness-webcam">
              <WebcamOverlay onSignalData={handleSignalData} />
            </div>
          ) : (
            <IOSCard elevated>
              <div className="ios-card-body" style={{ textAlign: "center", padding: "clamp(32px, 6vw, 64px)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--accent)" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                </div>
                <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, marginBottom: "8px" }}>Session Complete</h2>
                <p className="text-secondary" style={{ marginBottom: "24px" }}>Your session metrics have been recorded and saved to History.</p>
                <div style={{ maxWidth: 300, margin: "0 auto" }}>
                  <IOSButton variant="filled" full onClick={handleStartNew}>Start New Session</IOSButton>
                </div>
              </div>
            </IOSCard>
          )}

          {sessionActive && (
            <>
              <IOSCard>
                <div className="ios-card-body">
                  <div className="wellness-hr-row">
                    <div className="wellness-bpm-block">
                      <div className="wellness-bpm-value">{hr.bpm != null ? Math.round(hr.bpm) : "--"}</div>
                      <div className="wellness-bpm-unit">HEART RATE (BPM)</div>
                      {hr.bpm != null && <div className="wellness-live-dot" />}
                    </div>
                    <div className="wellness-waveform-wrap">
                      <WaveformTrace signalData={signalData} />
                    </div>
                  </div>
                </div>
              </IOSCard>

              <div className="wellness-metrics-grid">
                {[
                  {
                    label: "Breathing",
                    value: resp.brpm != null ? `${resp.brpm}` : null,
                    unit: "br/min",
                    status: resp.brpm != null ? "Optimal" : (resp.status === "insufficient_data" ? "Analyzing" : resp.status || "Analyzing"),
                    variant: resp.brpm != null ? "success" : "neutral",
                  },
                  {
                    label: "HRV Stress",
                    value: hrv.status === "calibrating" ? "Need Baseline" : hrv.status === "insufficient_beats" ? "Analyzing" : hrv.status ? hrv.status.replace(/_/g, " ") : "Analyzing",
                    sub: hrv.rmssd ? `RMSSD: ${hrv.rmssd} ms` : null,
                    status: hrv.status === "calibrating" ? "Calibrating" : hrv.status === "insufficient_beats" ? "Collecting" : hrv.status ? "Tracking" : "Waiting",
                    variant: hrv.status === "lower_than_baseline" ? "warning"
                      : hrv.status === "within_normal" || hrv.status === "higher_than_baseline" ? "success"
                      : "neutral",
                  },
                  {
                    label: "Drowsiness",
                    value: drowsiness.blink_rate != null ? `${drowsiness.blink_rate.toFixed(1)}` : null,
                    unit: "blinks/min",
                    status: drowsiness.status === "drowsy" ? "Drowsy" : drowsiness.status === "mild_fatigue" ? "Mild Fatigue" : drowsiness.status || "Alert",
                    variant: drowsiness.status === "drowsy" ? "danger" : drowsiness.status === "mild_fatigue" ? "warning" : "success",
                  },
                  {
                    label: "Eye Strain Risk",
                    value: eyeStrain.risk ? eyeStrain.risk.charAt(0).toUpperCase() + eyeStrain.risk.slice(1) : "Low",
                    status: eyeStrain.risk === "high" ? "High" : eyeStrain.risk === "moderate" ? "Moderate" : "Low",
                    variant: eyeStrain.risk === "high" ? "danger" : eyeStrain.risk === "moderate" ? "warning" : "success",
                    factors: eyeStrain.factors,
                  },
                ].map((m, i) => (
                  <IOSCard key={i}>
                    <div className="ios-card-body">
                      <div className="wellness-metric-card">
                        <div className="wellness-metric-left">
                          <span className="wellness-metric-label">{m.label}</span>
                          {m.sub && <span className="wellness-metric-sub">{m.sub}</span>}
                          {m.factors && m.factors.map((f, j) => (
                            <span key={j} className="wellness-metric-sub">{f}</span>
                          ))}
                        </div>
                        <div className="wellness-metric-right">
                          {m.value != null && (
                            <span className="wellness-metric-value">
                              {m.value}
                              {m.unit && <span className="wellness-metric-unit">{m.unit}</span>}
                            </span>
                          )}
                          {m.status && (
                            <span className={`wellness-status-pill wellness-status-pill--${m.variant}`}>
                              {m.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </IOSCard>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="wellness-sidebar">
          <BackendStatus wsConnected={wsConnected} />

          <IOSCard elevated>
            <div className="ios-card-body">
              <h3 className="text-sm font-semibold text-secondary mb-sm" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Session Controls
              </h3>
              <div className="wellness-actions">
                {!sessionActive && sessionSummary && (
                  <div className="wellness-action-row">
                    <div className="wellness-action-btn">
                      <IOSButton variant="filled" size="lg" full onClick={handleExportPDF}>
                        Export PDF Report
                      </IOSButton>
                    </div>
                    <InfoTip text="Downloads a professionally formatted PDF with all session metrics: average heart rate, breathing rate, drowsiness events, eye strain timeline, and a disclaimer. Ready for reports or panel demos." />
                  </div>
                )}
                {sessionActive && !calibrated && (
                  <div className="wellness-action-row">
                    <div className="wellness-action-btn">
                      <IOSButton variant="filled" size="lg" full onClick={onCalibrate}>
                        Start Baseline Calibration
                      </IOSButton>
                    </div>
                    <InfoTip text="Runs a 90-second baseline capture. Sit still, face the camera, and breathe normally. This establishes your personal heart rate variability (HRV) baseline and your comfortable screen distance reference. Without calibration, stress metrics show 'Calibrating.'" />
                  </div>
                )}
                {sessionActive && (
                  <div className="wellness-action-row">
                    <div className="wellness-action-btn">
                      <IOSButton variant="outline" full onClick={handleEndSession}>
                        End Session
                      </IOSButton>
                    </div>
                    <InfoTip text="Stops live monitoring and saves all collected data (heart rate, breathing rate, blinks, drowsiness events, eye strain) to your History. The Export PDF button becomes available after ending. You can start a fresh session afterward." />
                  </div>
                )}
                {!sessionActive && (
                  <IOSButton variant="filled" size="lg" full onClick={handleStartNew}>
                    Start New Session
                  </IOSButton>
                )}
              </div>
            </div>
          </IOSCard>

          <div className="wellness-test-section">
            <TestRunner wsConnected={wsConnected} />
          </div>
        </div>
      </div>
    </div>
  );
}

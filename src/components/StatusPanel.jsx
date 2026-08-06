import "./StatusPanel.css";

export default function StatusPanel({ data }) {
  if (!data) {
    return (
      <div className="status-panel">
        <p className="status-waiting">Waiting for data...</p>
      </div>
    );
  }

  const hr = data.heart_rate || {};
  const hrv = data.hrv || {};
  const drowsiness = data.drowsiness || {};
  const eyeStrain = data.eye_strain || {};
  const frameStatus = data.frame_status || "ok";

  return (
    <div className="status-panel">
      {frameStatus === "no_face" && (
        <div className="status-alert status-alert--warn" role="status">
          No face detected in current frame
        </div>
      )}

      <div className="status-section status-section--hr">
        <h3 className="status-label">Heart Rate</h3>
        <div className="status-value">
          {hr.bpm != null ? (
            <span className="mono">
              <span className="status-bpm">{Math.round(hr.bpm)}</span>
              <span className="status-unit"> BPM</span>
            </span>
          ) : (
            <span className="status-muted">{hr.status === "insufficient_data" ? "Gathering data..." : "--"}</span>
          )}
        </div>
      </div>

      <div className="status-section status-section--hrv">
        <h3 className="status-label">Stress (HRV)</h3>
        <div className="status-value">
          <span className={`status-tag status-tag--${hrv.status || "calibrating"}`}>
            {hrv.label || "Calibrating..."}
          </span>
          {hrv.rmssd != null && (
            <span className="status-detail mono">RMSSD: {hrv.rmssd}</span>
          )}
        </div>
      </div>

      <div className="status-section status-section--drowsiness">
        <h3 className="status-label">Drowsiness</h3>
        <div className="status-value">
          <span className={`status-tag status-tag--${drowsiness.status || "alert"}`}>
            {drowsiness.status === "alert" ? "Alert" : drowsiness.status === "mild_fatigue" ? "Mild Fatigue" : drowsiness.status === "drowsy" ? "Drowsy" : "--"}
          </span>
          {drowsiness.blink_rate != null && (
            <span className="status-detail mono">{drowsiness.blink_rate.toFixed(1)} blinks/min</span>
          )}
        </div>
      </div>

      <div className="status-section status-section--eyestrain">
        <h3 className="status-label">Eye Strain</h3>
        <div className="status-value">
          <span className={`status-tag status-tag--${eyeStrain.risk || "low"}`}>
            {eyeStrain.risk === "high" ? "High Risk" : eyeStrain.risk === "moderate" ? "Moderate" : "Low"}
          </span>
          {eyeStrain.factors && eyeStrain.factors.length > 0 && (
            <ul className="status-factors">
              {eyeStrain.factors.map((f, i) => (
                <li key={i} className="status-factor-item">{f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

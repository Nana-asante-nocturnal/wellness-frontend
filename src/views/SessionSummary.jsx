import "./SessionSummary.css";

export default function SessionSummary({ summary, onBack }) {
  if (!summary) return null;

  return (
    <div className="summary">
      <div className="summary-card">
        <h2 className="summary-title">Session Report</h2>
        <p className="summary-disclaimer">
          Wellness indicator, not a medical device. All metrics are relative/qualitative estimates from signal processing.
        </p>

        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Duration</span>
            <span className="summary-value mono">{summary.session_duration_min} min</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Avg Heart Rate</span>
            <span className="summary-value mono">
              {summary.average_heart_rate_bpm != null ? `${Math.round(summary.average_heart_rate_bpm)} BPM` : "Insufficient data"}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Blinks</span>
            <span className="summary-value mono">{summary.total_blinks}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Frames Processed</span>
            <span className="summary-value mono">{summary.total_frames_processed}</span>
          </div>
        </div>

        {summary.drowsiness_events && summary.drowsiness_events.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Drowsiness Events</h3>
            <ul className="summary-event-list">
              {summary.drowsiness_events.map(([ts, status], i) => (
                <li key={i} className="summary-event">
                  <span className="mono">{ts}s</span>
                  <span className={`status-tag status-tag--${status}`}>{status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.eye_strain_timeline && summary.eye_strain_timeline.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Eye Strain Timeline</h3>
            <div className="summary-timeline">
              {summary.eye_strain_timeline.map(([ts, risk], i) => (
                <div key={i} className={`timeline-marker timeline-marker--${risk}`} title={`${ts}s: ${risk}`} />
              ))}
            </div>
          </div>
        )}

        {summary.rmssd_trend && summary.rmssd_trend.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">HRV (RMSSD) Trend</h3>
            <div className="summary-rmssd-list mono">
              {summary.rmssd_trend.slice(-10).map(([t, r], i) => (
                <span key={i}>{r}</span>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn--secondary" onClick={onBack}>
          Back to Monitor
        </button>
      </div>
    </div>
  );
}

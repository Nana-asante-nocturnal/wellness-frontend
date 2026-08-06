import { useState, useEffect, useCallback } from "react";
import { on } from "../ws/client";
import WebcamOverlay from "../components/WebcamOverlay";
import WaveformTrace from "../components/WaveformTrace";
import StatusPanel from "../components/StatusPanel";
import BackendStatus from "../components/BackendStatus";
import TestRunner from "../components/TestRunner";
import "./LiveSession.css";

export default function LiveSession({ wsConnected, calibrated, baselineRmssd, onCalibrate, onSummary }) {
  const [signalData, setSignalData] = useState(null);
  const [frameResult, setFrameResult] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = on("frame_result", (msg) => {
      setFrameResult(msg.data);
    });
    const unsub2 = on("connected", () => setConnected(true));
    const unsub3 = on("disconnected", () => setConnected(false));
    setConnected(wsConnected);
    return () => { unsub(); unsub2(); unsub3(); };
  }, [wsConnected]);

  const handleSignalData = useCallback((val) => {
    setSignalData(val);
  }, []);

  return (
    <div className="live-session">
      <header className="session-header">
        <h1 className="session-title">Wellness Monitor</h1>
        <div className="session-controls">
          <span className={`connection-dot ${connected ? "connection-dot--active" : ""}`} aria-label={connected ? "Connected" : "Disconnected"} />
          <span className="mono connection-label">{connected ? "Live" : "Disconnected"}</span>
        </div>
      </header>

      <div className="session-layout">
        <div className="session-left">
          <BackendStatus wsConnected={connected} />
          <WebcamOverlay onSignalData={handleSignalData} onFrameResult={setFrameResult} />
          <div className="waveform-section">
            <WaveformTrace signalData={signalData} />
            <p className="waveform-label">Pulse waveform — {signalData != null ? "live trace" : "waiting for signal"}</p>
          </div>
        </div>

        <div className="session-right">
          <StatusPanel data={frameResult} />

          <div className="session-actions">
            {!calibrated && (
              <button className="btn btn--primary" onClick={onCalibrate}>
                Start Calibration
              </button>
            )}
            <button className="btn btn--secondary" onClick={onSummary}>
              End Session & View Report
            </button>
          </div>

          <TestRunner wsConnected={connected} />
        </div>
      </div>
    </div>
  );
}

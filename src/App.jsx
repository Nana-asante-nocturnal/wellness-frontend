import { useState, useEffect, useCallback } from "react";
import { connect, disconnect, on, send } from "./ws/client";
import IOSTabBar from "./components/IOSTabBar";
import Disclaimer from "./components/Disclaimer";
import Wellness from "./views/Wellness";
import NeuroExam from "./views/NeuroExam";
import History from "./views/History";
import Calibration from "./views/Calibration";
import IOSStatusBadge from "./components/IOSStatusBadge";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = useState("wellness");
  const [wsConnected, setWsConnected] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [sessionData, setSessionData] = useState({
    calibrated: false,
    baselineRmssd: null,
    interocularPx: 0,
  });

  useEffect(() => {
    connect();
    const unsub1 = on("connected", () => setWsConnected(true));
    const unsub2 = on("disconnected", () => setWsConnected(false));
    const unsub3 = on("calibration_complete", (msg) => {
      setSessionData((d) => ({
        ...d,
        calibrated: true,
        baselineRmssd: msg.baseline_rmssd,
        interocularPx: msg.interocular_px,
      }));
    });
    return () => {
      unsub1(); unsub2(); unsub3();
      disconnect();
    };
  }, []);

  const openCalibration = useCallback(() => {
    setShowCalibrationModal(true);
  }, []);

  const handleCalibrationComplete = useCallback((data) => {
    setShowCalibrationModal(false);
    if (data) {
      setSessionData((d) => ({
        ...d,
        calibrated: true,
        baselineRmssd: data.baselineRmssd ?? d.baselineRmssd,
        interocularPx: data.interocularPx ?? d.interocularPx,
      }));
    }
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand-logo" style={{ display: "flex", alignItems: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
          </div>
          <span className="app-brand-title">NEURO-VITAL AI</span>
        </div>
        <div className="app-header-status">
          <IOSStatusBadge
            variant={wsConnected ? "success" : "danger"}
            label={wsConnected ? "System Online" : "Disconnected"}
          />
        </div>
      </header>

      <div className="app-viewport">
        {activeTab === "wellness" && (
          <Wellness
            calibrated={sessionData.calibrated}
            baselineRmssd={sessionData.baselineRmssd}
            wsConnected={wsConnected}
            onCalibrate={openCalibration}
          />
        )}
        {activeTab === "motor" && <NeuroExam />}
        {activeTab === "history" && <History />}
      </div>

      {showCalibrationModal && (
        <Calibration
          onComplete={handleCalibrationComplete}
          onCancel={() => setShowCalibrationModal(false)}
        />
      )}

      <Disclaimer />
      <IOSTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}


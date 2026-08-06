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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
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


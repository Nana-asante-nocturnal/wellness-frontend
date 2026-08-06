import { useState, useEffect, useCallback, useRef } from "react";
import { on, send } from "../ws/client";
import WebcamOverlay from "../components/WebcamOverlay";
import IOSCard from "../components/IOSCard";
import IOSButton from "../components/IOSButton";
import IOSStatusBadge from "../components/IOSStatusBadge";
import IOSTimerRing from "../components/IOSTimerRing";
import InfoTip from "../components/InfoTip";
import "./NeuroExam.css";

const TESTS_CONFIG = {
  finger_nose: {
    id: "finger_nose",
    title: "Finger-to-Nose Test",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    description: "Measures tremor frequency (3-12 Hz), RMS tremor amplitude, dysmetria (target overshoot), and reach movement duration.",
    duration: 10,
    requiresSide: true,
    instructions: [
      "Sit 2-3 feet from the camera so your face and upper body are fully visible.",
      "Extend your testing arm completely straight out to your side at shoulder height.",
      "Using only your index finger, smoothly and accurately touch the tip of your nose.",
      "Fully extend your arm back out, then touch your nose again. Repeat at a steady pace for 10 seconds.",
    ],
  },
  dysdiadochokinesia: {
    id: "dysdiadochokinesia",
    title: "Rapid Alternating Movements (DDK)",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
    description: "Evaluates upper limb motor coordination via wrist pronation/supination rate (Hz), rhythm regularity (CV), and amplitude decay.",
    duration: 10,
    requiresSide: true,
    instructions: [
      "Hold one hand up in front of the webcam with palm facing forward.",
      "Rapidly rotate wrist back and forth (pronation and supination).",
      "Maintain maximum speed and consistent amplitude for 10 seconds.",
    ],
  },
  romberg: {
    id: "romberg",
    title: "Romberg Postural Sway Test",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
    description: "Quantifies postural steadiness and balance by tracking Center of Mass (CoM) sway ellipse area with Eyes Open vs. Eyes Closed.",
    duration: 30, // 15s eyes open + 15s eyes closed
    requiresSide: false,
    instructions: [
      "Stand upright facing camera with feet together and arms at sides.",
      "Ensure your full upper body (hips to head) is visible.",
      "Phase 1 (15 sec): Stand still with eyes open looking straight ahead.",
      "Phase 2 (15 sec): Close eyes when prompted and maintain balance.",
    ],
  },
};

export default function NeuroExam() {
  const [screen, setScreen] = useState("menu"); // menu | prep | testing | results | summary
  const [selectedTestId, setSelectedTestId] = useState("finger_nose");
  const [selectedSide, setSelectedSide] = useState("right");
  const [testPhase, setTestPhase] = useState("idle"); // idle | eyes_open | eyes_closed | complete
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [examResults, setExamResults] = useState({
    finger_nose: null,
    dysdiadochokinesia: null,
    romberg: null,
  });
  const [activeResult, setActiveResult] = useState(null);
  const [examSummary, setExamSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeTest = TESTS_CONFIG[selectedTestId];
  const timerRef = useRef(null);

  // WebSocket event handlers
  useEffect(() => {
    const unsub1 = on("neuro_status", (msg) => {
      if (msg.status === "started") {
        setErrorMessage(null);
      }
    });

    const unsub2 = on("neuro_result", (msg) => {
      if (msg.test && msg.data) {
        setExamResults((prev) => ({
          ...prev,
          [msg.test]: msg.data,
        }));
        setActiveResult(msg.data);
        setScreen("results");
      }
    });

    const unsub3 = on("neuro_report", (msg) => {
      if (msg.data) {
        setExamSummary(msg.data);
        setScreen("summary");
      }
    });

    const unsub4 = on("neuro_error", (msg) => {
      setErrorMessage(msg.error || "An error occurred during testing");
      setScreen("prep");
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
    };
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSelectTest = (testId) => {
    setSelectedTestId(testId);
    setScreen("prep");
  };

  const handleStartTest = () => {
    setScreen("testing");
    setErrorMessage(null);

    send({
      type: "neuro_start",
      test: selectedTestId,
      side: activeTest.requiresSide ? selectedSide : undefined,
    });

    if (selectedTestId === "romberg") {
      setTestPhase("eyes_open");
      setTimeRemaining(15);
      send({ type: "neuro_phase_change", phase: "eyes_open" });

      let elapsed = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        elapsed += 1;
        if (elapsed < 15) {
          setTimeRemaining(15 - elapsed);
        } else if (elapsed === 15) {
          setTestPhase("eyes_closed");
          setTimeRemaining(15);
          send({ type: "neuro_phase_change", phase: "eyes_closed" });
        } else if (elapsed < 30) {
          setTimeRemaining(30 - elapsed);
        } else {
          clearInterval(timerRef.current);
          setTestPhase("complete");
          send({ type: "neuro_phase_change", phase: "results" });
        }
      }, 1000);

    } else {
      setTestPhase("testing");
      setTimeRemaining(activeTest.duration);

      let count = activeTest.duration;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setTimeRemaining(count);
        } else {
          clearInterval(timerRef.current);
          send({
            type: "neuro_phase_change",
            phase: "complete",
            side: selectedSide,
          });
          send({
            type: "neuro_cancel", // Triggers result computation on backend
          });
        }
      }, 1000);
    }
  };

  const handleCancelTest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    send({ type: "neuro_cancel" });
    setScreen("prep");
  };

  const handleFinishExam = () => {
    send({ type: "neuro_complete" });
  };

  const handleExportPDF = async () => {
    const summaryData = examSummary || {
      exam_duration_s: 120,
      tests_completed: Object.keys(examResults).filter((k) => examResults[k]),
      finger_to_nose: examResults.finger_nose,
      dysdiadochokinesia: examResults.dysdiadochokinesia,
      romberg: examResults.romberg,
      disclaimer: "Quantitative motor screen using computer vision. Not a clinical diagnostic device.",
    };

    setIsExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/report/neuro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summaryData),
      });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "neurological_motor_exam_report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Could not generate PDF report: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetExam = () => {
    setExamResults({ finger_nose: null, dysdiadochokinesia: null, romberg: null });
    setExamSummary(null);
    setActiveResult(null);
    setScreen("menu");
  };

  const completedCount = Object.values(examResults).filter(Boolean).length;

  return (
    <div className="ios-content neuro-page">
      {/* Header */}
      <div className="wellness-header">
        <div>
          <h1 className="ios-large-title">Neurological Motor Exam</h1>
          <p className="text-secondary text-sm">
            Quantitative upper-limb motor & postural steadiness screening
          </p>
        </div>
        {completedCount > 0 && screen === "menu" && (
          <IOSButton variant="filled" onClick={handleFinishExam}>
            View Exam Summary ({completedCount}/3)
          </IOSButton>
        )}
      </div>

      {errorMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--red)", padding: "12px", background: "rgba(255, 59, 48, 0.1)", borderRadius: "var(--radius-md)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {errorMessage}
        </div>
      )}

      {/* SCREEN 1: MENU */}
      {screen === "menu" && (
        <div className="neuro-test-list">
          {Object.values(TESTS_CONFIG).map((test) => {
            const hasResult = Boolean(examResults[test.id]);
            return (
              <IOSCard key={test.id} interactive onClick={() => handleSelectTest(test.id)}>
                <div className="ios-card-body neuro-test-card">
                  <div className="neuro-test-icon">{test.icon}</div>
                  <div className="neuro-test-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <h2 style={{ fontSize: "17px", fontWeight: "600", margin: 0 }}>{test.title}</h2>
                      {hasResult && <IOSStatusBadge variant="success" label="Completed" />}
                    </div>
                    <p className="text-secondary text-xs" style={{ margin: 0 }}>
                      {test.description}
                    </p>
                  </div>
                  <span className="neuro-chevron">›</span>
                </div>
              </IOSCard>
            );
          })}
        </div>
      )}

      {/* SCREEN 2: PREP / INSTRUCTIONS */}
      {screen === "prep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <button className="neuro-back-btn" onClick={() => setScreen("menu")}>
            ‹ Back to Tests
          </button>

          <IOSCard elevated>
            <div className="ios-card-body">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontSize: "32px" }}>{activeTest.icon}</span>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>{activeTest.title}</h2>
                  <span className="text-secondary text-xs">Estimated duration: {activeTest.duration}s</span>
                </div>
              </div>

              <p className="text-secondary" style={{ marginBottom: "16px" }}>
                {activeTest.description}
              </p>

              {activeTest.requiresSide && (
                <div className="neuro-side-indicator">
                  <label style={{ fontSize: "14px", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                    Select Hand/Arm to Screen:
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <IOSButton
                      variant={selectedSide === "right" ? "filled" : "outline"}
                      onClick={() => setSelectedSide("right")}
                    >
                      Right Hand
                    </IOSButton>
                    <IOSButton
                      variant={selectedSide === "left" ? "filled" : "outline"}
                      onClick={() => setSelectedSide("left")}
                    >
                      Left Hand
                    </IOSButton>
                  </div>
                </div>
              )}

              <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>Instructions:</h3>
              <ol className="neuro-instruction-list">
                {activeTest.instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>

              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <IOSButton variant="filled" full onClick={handleStartTest}>
                  Begin Test
                </IOSButton>
              </div>
            </div>
          </IOSCard>
        </div>
      )}

      {/* SCREEN 3: LIVE TESTING */}
      {screen === "testing" && (
        <div className="neuro-live-grid">
          <div className="neuro-live-camera">
            <WebcamOverlay />
          </div>

          <div className="neuro-live-panel">
            <IOSCard elevated style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div className="ios-card-body" style={{ textAlign: "center" }}>
                <IOSStatusBadge
                  variant="warning"
                  label={
                    selectedTestId === "romberg"
                      ? testPhase === "eyes_open"
                        ? "Phase 1: Eyes Open (15s)"
                        : "Phase 2: Eyes Closed (15s)"
                      : `Testing ${selectedSide} Side`
                  }
                />

                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "16px 0 8px" }}>{activeTest.title}</h3>
                <p className="text-secondary text-xs" style={{ marginBottom: "20px" }}>
                  Keep motion smooth and stay within webcam frame
                </p>

                <div className="neuro-timer-center">
                  <IOSTimerRing
                    progress={1 - (timeRemaining / (selectedTestId === "romberg" ? 15 : activeTest.duration))}
                    label={timeRemaining > 0 ? timeRemaining : ""}
                    sublabel={timeRemaining > 0 ? "SEC REMAINING" : "ANALYZING"}
                  />
                </div>
              </div>

              <div className="ios-card-body" style={{ paddingTop: 0 }}>
                <IOSButton variant="destructive" full onClick={handleCancelTest}>
                  Cancel Test
                </IOSButton>
              </div>
            </IOSCard>
          </div>
        </div>
      )}

      {/* SCREEN 4: INDIVIDUAL TEST RESULTS */}
      {screen === "results" && activeResult && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <button className="neuro-back-btn" onClick={() => setScreen("menu")}>
            ‹ Back to Test Menu
          </button>

          <IOSCard elevated>
            <div className="ios-card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                  {activeTest.title} — Results
                </h2>
                <IOSStatusBadge variant="success" label="Analyzed" />
              </div>

              {/* Finger-to-Nose Results */}
              {selectedTestId === "finger_nose" && (
                <div className="neuro-results-grid">
                  {["right", "left"].map((side) => {
                    const res = activeResult[side];
                    if (!res) return null;
                    return (
                      <IOSCard key={side}>
                        <div className="ios-card-body">
                          <h4 style={{ fontSize: "15px", fontWeight: 600, textTransform: "capitalize", margin: "0 0 8px" }}>
                            {side} Arm Assessment
                          </h4>
                          <div className="neuro-metric-mini">
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Tremor Freq</span>
                                <InfoTip text="Tremor Frequency: The dominant frequency of involuntary shaking detected during the test. Resting or action tremors often fall between 3 and 12 Hz." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: res.tremor_frequency_hz > 12 ? "var(--error)" : "inherit" }}>
                                {res.tremor_frequency_hz > 12 && "⚠️ "}
                                {res.tremor_frequency_hz != null ? `${res.tremor_frequency_hz} Hz` : "Normal / Low"}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Tremor Amp</span>
                                <InfoTip text="Tremor Amplitude: The physical size (in pixels) of the shaking movement. Higher values indicate more pronounced tremor severity." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: res.tremor_amplitude_px > 4.0 ? "var(--error)" : "inherit" }}>
                                {res.tremor_amplitude_px > 4.0 && "⚠️ "}
                                {res.tremor_amplitude_px != null ? `${res.tremor_amplitude_px} px` : "--"}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Dysmetria</span>
                                <InfoTip text="Dysmetria: The distance by which your finger missed the exact center of your nose (overshoot/undershoot). Evaluates cerebellar coordination." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: res.dysmetria_px > 30.0 ? "var(--error)" : "inherit" }}>
                                {res.dysmetria_px > 30.0 && "⚠️ "}
                                {res.dysmetria_px != null ? `${res.dysmetria_px} px` : "--"}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Reach Time</span>
                                <InfoTip text="Reach Time: Total seconds taken to complete the movement. Slower times can indicate bradykinesia (slowness of movement)." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: res.movement_time_s > 5.0 ? "var(--error)" : "inherit" }}>
                                {res.movement_time_s > 5.0 && "⚠️ "}
                                {res.movement_time_s != null ? `${res.movement_time_s}s` : "--"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </IOSCard>
                    );
                  })}

                  {activeResult.asymmetry_flags && activeResult.asymmetry_flags.length > 0 && (
                    <div className="neuro-flags">
                      {activeResult.asymmetry_flags.map((flag, idx) => (
                        <IOSStatusBadge key={idx} variant="warning" label={`Flag: ${flag}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dysdiadochokinesia Results */}
              {selectedTestId === "dysdiadochokinesia" && (
                <div className="neuro-results-grid">
                  {["right", "left"].map((side) => {
                    const res = activeResult[side];
                    if (!res) return null;
                    return (
                      <IOSCard key={side}>
                        <div className="ios-card-body">
                          <h4 style={{ fontSize: "15px", fontWeight: 600, textTransform: "capitalize", margin: "0 0 8px" }}>
                            {side} Hand Coordination (DDK)
                          </h4>
                          <div className="neuro-metric-mini">
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Rotation Rate</span>
                                <InfoTip text="Pronation/Supination Rate: The speed of alternating hand movements. Normal adult rates are typically 2-5 cycles per second (Hz)." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: (res.rate_hz != null && res.rate_hz < 0.5) ? "var(--error)" : "inherit" }}>
                                {(res.rate_hz != null && res.rate_hz < 0.5) && "⚠️ "}
                                {res.rate_hz != null ? `${res.rate_hz} Hz` : "--"}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Rhythm Reg (CV)</span>
                                <InfoTip text="Rhythm Regularity (Coefficient of Variation): Measures the consistency of the movement timing. Values > 0.3 indicate irregular rhythm (dysrhythmia)." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: (res.rhythm_cv != null && res.rhythm_cv > 0.3) ? "var(--error)" : "inherit" }}>
                                {(res.rhythm_cv != null && res.rhythm_cv > 0.3) && "⚠️ "}
                                {res.rhythm_cv != null ? res.rhythm_cv : "--"}
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <span className="text-secondary text-xs">Amplitude Decay</span>
                                <InfoTip text="Amplitude Decay: Measures how much the hand rotation shrinks over time. A large decay (>30%) indicates fatigue or pathological slowing." />
                              </div>
                              <div style={{ fontSize: "16px", fontWeight: 700, color: (res.amplitude_decay_pct != null && Math.abs(res.amplitude_decay_pct) > 30.0) ? "var(--error)" : "inherit" }}>
                                {(res.amplitude_decay_pct != null && Math.abs(res.amplitude_decay_pct) > 30.0) && "⚠️ "}
                                {res.amplitude_decay_pct != null ? `${Math.abs(res.amplitude_decay_pct)}%` : "--"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </IOSCard>
                    );
                  })}
                </div>
              )}

              {/* Romberg Results */}
              {selectedTestId === "romberg" && (
                <div className="neuro-results-grid">
                  <div className="neuro-metric-mini">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                        <span className="text-secondary text-xs">Eyes Open Sway Area</span>
                        <InfoTip text="Sway Area (Eyes Open): The total area covered by your center of mass while balancing with eyes open." />
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700 }}>
                        {activeResult.open_ellipse_area != null ? `${activeResult.open_ellipse_area} px²` : "--"}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                        <span className="text-secondary text-xs">Eyes Closed Sway Area</span>
                        <InfoTip text="Sway Area (Eyes Closed): The total area covered by your center of mass while balancing with eyes closed." />
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700 }}>
                        {activeResult.closed_ellipse_area != null ? `${activeResult.closed_ellipse_area} px²` : "--"}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                        <span className="text-secondary text-xs">Romberg Quotient (RQ)</span>
                        <InfoTip text="Romberg Quotient (RQ): The ratio of closed-eye sway to open-eye sway. Normal is < 2.0. Values > 3.0 indicate significant visual dependence." />
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: (activeResult.romberg_quotient != null && activeResult.romberg_quotient > 3.0) ? "var(--error)" : (activeResult.romberg_quotient > 2.0 ? "var(--warning)" : "var(--accent-light)") }}>
                        {(activeResult.romberg_quotient != null && activeResult.romberg_quotient > 2.0) && "⚠️ "}
                        {activeResult.romberg_quotient != null ? activeResult.romberg_quotient : "--"}
                      </div>
                    </div>
                  </div>

                  {activeResult.interpretation && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "var(--bg-card)", borderRadius: "var(--radius-sm)" }}>
                      <span className="text-secondary text-xs" style={{ display: "block", marginBottom: "4px" }}>
                        Clinical Steadiness Impression:
                      </span>
                      <strong style={{ fontSize: "14px" }}>{activeResult.interpretation}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="neuro-result-actions">
                <IOSButton variant="filled" full onClick={() => setScreen("menu")}>
                  Run Another Test
                </IOSButton>
                <IOSButton variant="outline" full onClick={handleFinishExam}>
                  Complete Exam & View Report
                </IOSButton>
              </div>
            </div>
          </IOSCard>
        </div>
      )}

      {/* SCREEN 5: FINAL EXAM SUMMARY & PDF EXPORT */}
      {screen === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <IOSCard elevated>
            <div className="ios-card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Neurological Motor Exam Report</h2>
                  <span className="text-secondary text-xs">Quantitative screening summary</span>
                </div>
                <IOSStatusBadge variant="success" label="Complete" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "20px 0" }}>
                {Object.values(TESTS_CONFIG).map((test) => {
                  const hasRes = Boolean(examResults[test.id]);
                  return (
                    <div
                      key={test.id}
                      style={{
                        display: "flex",
                        justify: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--bg-card)",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span>{test.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: "15px" }}>{test.title}</span>
                      </div>
                      <IOSStatusBadge
                        variant={hasRes ? "success" : "neutral"}
                        label={hasRes ? "Evaluated" : "Not Tested"}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="neuro-result-actions">
                <IOSButton variant="filled" full onClick={handleExportPDF} disabled={isExporting}>
                  {isExporting ? "Generating PDF..." : "Export PDF Report"}
                </IOSButton>
                <IOSButton variant="outline" full onClick={handleResetExam}>
                  Start New Motor Exam
                </IOSButton>
              </div>
            </div>
          </IOSCard>
          <InfoTip text="This assessment provides quantitative geometric motor estimates for wellness informing purposes and does not substitute formal clinical neurological examination." />
        </div>
      )}
    </div>
  );
}
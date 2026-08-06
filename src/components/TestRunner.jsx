import { useState, useEffect, useCallback } from "react";
import { send, on } from "../ws/client";
import InfoTip from "./InfoTip";
import "./TestRunner.css";

export default function TestRunner({ wsConnected }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const fetchResults = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/tests/run`, {
        method: "POST",
        signal: AbortSignal.timeout(35000),
      });
      const data = await res.json();
      if (data.status === "error") {
        setError(data.error);
        setResults(null);
      } else {
        setResults(data);
        setError(null);
      }
    } catch (e) {
      setError(e.message || "Failed to reach backend");
      setResults(null);
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    const unsub = on("test_results", (msg) => {
      setResults(msg.data);
      setError(null);
      setRunning(false);
    });
    return unsub;
  }, []);

  const run = useCallback(() => {
    setRunning(true);
    setResults(null);
    setError(null);
    if (wsConnected) {
      send({ type: "run_tests" });
    } else {
      fetchResults();
    }
  }, [wsConnected, fetchResults]);

  return (
    <div className="test-runner">
      <div className="test-runner-header">
        <h3 className="test-runner-title">Test Suite</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="btn-cta"
            onClick={run}
            disabled={running}
          >
            {running ? "Running..." : "Run Tests"}
          </button>
          <InfoTip text="Executes the backend automated test suite (pytest) to verify all mathematical signal processing and vision models are operating correctly." />
        </div>
      </div>

      {error && (
        <div className="test-error" role="alert">
          {error}
        </div>
      )}

      {results && (
        <div className="test-summary">
          <div className={`test-badge ${results.status === "ok" ? "test-badge--pass" : "test-badge--fail"}`}>
            {results.status === "ok" ? "PASSED" : "FAILED"} — {results.passed}/{results.total}
          </div>

          {results.tests && results.failed > 0 && (
            <ul className="test-detail-list">
              {results.tests
                .filter((t) => t.status === "failed")
                .map((t, i) => (
                  <li key={i} className="test-detail-item test-detail-item--fail">
                    {t.name}
                  </li>
                ))}
            </ul>
          )}

          {results.output && (
            <pre className="test-output mono">{results.output}</pre>
          )}
        </div>
      )}
    </div>
  );
}

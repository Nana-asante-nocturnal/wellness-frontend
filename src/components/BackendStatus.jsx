import { useState, useEffect, useCallback } from "react";
import "./BackendStatus.css";

const STATUS_URL = "http://localhost:8000/api/status";

export default function BackendStatus({ wsConnected }) {
  const [status, setStatus] = useState({ online: false, loading: true, data: null });

  const poll = useCallback(async () => {
    try {
      const res = await fetch(STATUS_URL, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setStatus({ online: data.status === "online", loading: false, data });
    } catch {
      setStatus({ online: false, loading: false, data: null });
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  const online = status.online && wsConnected;

  return (
    <div className="backend-status">
      <div className={`backend-indicator ${online ? "backend-indicator--online" : "backend-indicator--offline"}`}>
        <span className="backend-dot" />
        <span className="backend-label mono">
          {status.loading ? "Checking..." : online ? "Backend Online" : "Backend Offline"}
        </span>
      </div>
      {status.data && online && (
        <div className="backend-details">
          <span className="mono">v{status.data.version}</span>
          <span className="mono">Uptime: {Math.round(status.data.uptime_seconds)}s</span>
          <span className="mono">Sessions: {status.data.active_sessions}</span>
        </div>
      )}
    </div>
  );
}

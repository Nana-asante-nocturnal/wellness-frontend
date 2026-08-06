import { useState, useEffect, useCallback } from "react";
import IOSCard from "../components/IOSCard";
import IOSStatusBadge from "../components/IOSStatusBadge";
import "./History.css";

const API = "http://localhost:8000/api/history";

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const url = filter ? `${API}?session_type=${filter}` : API;
      const res = await fetch(url);
      if (!res.ok) { setSessions([]); setLoading(false); return; }
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch { setSessions([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDelete = async (id) => {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    setSessions((s) => s.filter((r) => r.id !== id));
    setExpanded(null);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="ios-content history-page">
      <h1 className="ios-large-title">History</h1>

      <div className="history-filters">
        {[null, "wellness", "neuro_exam"].map((f) => (
          <button
            key={f || "all"}
            className={`history-filter-chip ${filter === f ? "history-filter-chip--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === null ? "All" : f === "wellness" ? "Wellness" : "Neuro Exams"}
          </button>
        ))}
      </div>

      {loading && <p className="text-secondary text-center py-lg">Loading...</p>}
      {!loading && sessions.length === 0 && (
        <p className="text-secondary text-center py-lg">No sessions recorded yet</p>
      )}

      <div className="history-list">
        {sessions.map((s) => (
          <IOSCard key={s.id} elevated>
            <div className="ios-card-body">
              <div
                className="history-row"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                role="button"
                tabIndex={0}
              >
                <div className="history-info">
                  <h3 className="text-md font-medium">
                    {s.session_type === "wellness" ? "Wellness" : "Neuro Exam"}
                  </h3>
                  <p className="text-sm text-secondary font-mono">
                    {formatDate(s.created_at)}
                    {s.duration_sec ? ` · ${Math.round(s.duration_sec)}s` : ""}
                  </p>
                </div>
                <span className="neuro-chevron">{expanded === s.id ? "⌃" : "›"}</span>
              </div>

              {expanded === s.id && (
                <div className="history-detail">
                  {s.session_type === "wellness" && s.summary && (
                    <div className="history-metrics">
                      <div className="history-metric">
                        <span className="text-xs text-tertiary">Avg BPM</span>
                        <span className="text-lg font-semibold font-mono">{s.summary.average_heart_rate_bpm || "--"}</span>
                      </div>
                      <div className="history-metric">
                        <span className="text-xs text-tertiary">Blinks</span>
                        <span className="text-lg font-semibold font-mono">{s.summary.total_blinks || 0}</span>
                      </div>
                      <div className="history-metric">
                        <span className="text-xs text-tertiary">No Face %</span>
                        <span className="text-lg font-semibold font-mono">{s.summary.no_face_percentage || 0}%</span>
                      </div>
                    </div>
                  )}
                  {s.session_type === "neuro_exam" && s.summary && (
                    <div className="history-metrics">
                      <div className="history-metric">
                        <span className="text-xs text-tertiary">Tests</span>
                        <span className="text-lg font-semibold font-mono">{s.summary.tests_completed?.length || 0}</span>
                      </div>
                      <div className="history-metric">
                        <span className="text-xs text-tertiary">Duration</span>
                        <span className="text-lg font-semibold font-mono">{s.summary.exam_duration_s}s</span>
                      </div>
                      {s.summary.romberg && (
                        <div className="history-metric">
                          <span className="text-xs text-tertiary">Romberg</span>
                          <IOSStatusBadge
                            variant={s.summary.romberg.status === "normal" ? "success" : "warning"}
                            label={s.summary.romberg.status}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="history-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </IOSCard>
        ))}
      </div>
    </div>
  );
}

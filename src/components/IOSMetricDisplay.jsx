import "./IOSMetricDisplay.css";

const STATUS_COLORS = {
  normal: "var(--success)",
  caution: "var(--warning)",
  alert: "var(--danger)",
};

export default function IOSMetricDisplay({ value, unit, label, status, trend }) {
  return (
    <div className={`ios-metric ${status ? `ios-metric--${status}` : ""}`}>
      <div className="ios-metric-value-row">
        <span className="ios-metric-number font-mono">{value}</span>
        {unit && <span className="ios-metric-unit">{unit}</span>}
      </div>
      {label && <span className="ios-metric-label">{label}</span>}
      {trend && <span className="ios-metric-trend">{trend}</span>}
      {status && (
        <span className="ios-metric-dot" style={{ background: STATUS_COLORS[status] }} aria-hidden="true" />
      )}
    </div>
  );
}

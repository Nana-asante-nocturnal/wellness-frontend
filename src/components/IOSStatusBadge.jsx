import "./IOSStatusBadge.css";

const VARIANTS = {
  success: { bg: "var(--success-bg)", color: "var(--success)", icon: "✓" },
  warning: { bg: "var(--warning-bg)", color: "var(--warning)", icon: "!" },
  danger:  { bg: "var(--danger-bg)", color: "var(--danger)", icon: "✕" },
  info:    { bg: "var(--info-bg)", color: "var(--info)", icon: "i" },
  neutral: { bg: "var(--bg-elevated)", color: "var(--text-secondary)", icon: "" },
};

export default function IOSStatusBadge({ variant = "neutral", label, showIcon }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span className="ios-badge" style={{ background: v.bg, color: v.color }}>
      {showIcon && v.icon && <span className="ios-badge-icon">{v.icon}</span>}
      {label}
    </span>
  );
}

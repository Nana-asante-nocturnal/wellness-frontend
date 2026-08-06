import "./IOSButton.css";

export default function IOSButton({ children, variant = "filled", size, full, disabled, onClick, style }) {
  return (
    <button
      className={`ios-btn ios-btn--${variant} ${full ? "ios-btn--full" : ""} ${size === "lg" ? "ios-btn--lg" : size === "sm" ? "ios-btn--sm" : ""}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}

import "./IOSCard.css";

export default function IOSCard({ children, elevated, float, interactive, onClick, style, className }) {
  const cls = [
    "ios-card",
    elevated && "ios-card--elevated",
    float && "ios-card--float",
    interactive && "ios-card--interactive",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} onClick={onClick} style={style} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}

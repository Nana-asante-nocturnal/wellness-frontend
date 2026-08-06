import "./IOSTabBar.css";

const TABS = [
  { id: "motor", icon: "⊙", label: "Motor Exam" },
  { id: "wellness", icon: "♡", label: "Wellness" },
  { id: "history", icon: "☰", label: "History" },
];

export default function IOSTabBar({ activeTab, onTabChange }) {
  return (
    <nav className="ios-tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`ios-tab-item ${activeTab === tab.id ? "ios-tab-item--active" : "ios-tab-item--inactive"}`}
          onClick={() => onTabChange(tab.id)}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          <span className="ios-tab-icon">{tab.icon}</span>
          <span className="ios-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

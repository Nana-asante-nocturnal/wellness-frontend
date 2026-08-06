import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./InfoTip.css";

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, isMobile: false });

  useEffect(() => {
    if (!open) return;
    
    const updatePos = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const isMobile = window.innerWidth <= 480;
        setPos({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
          isMobile
        });
      }
    };
    
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);

    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.infotip-popover')) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  return (
    <span className="infotip-wrap" ref={ref}>
      <button
        className="infotip-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label="More information"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      </button>
      {open && createPortal(
        <span 
          className="infotip-popover" 
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.isMobile ? 'auto' : pos.left,
            right: pos.isMobile ? '12px' : 'auto',
            transform: pos.isMobile ? 'translateY(-100%)' : 'translate(-50%, -100%)',
            bottom: 'auto'
          }}
        >
          <span className="infotip-arrow" />
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}

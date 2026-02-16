import { useEffect, useState } from 'react';

/**
 * Custom window controls for frameless mode on Windows/Linux.
 * Hidden on macOS where native traffic lights are used.
 */
export default function WindowControls() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.api?.isMac) {
      window.api.isMac().then(mac => { if (!mac) setVisible(true); });
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="window-controls">
      <button
        className="wc-btn wc-minimize"
        onClick={() => window.api?.windowMinimize()}
        title="Minimizza"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button
        className="wc-btn wc-maximize"
        onClick={() => window.api?.windowMaximize()}
        title="Massimizza"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
      </button>
      <button
        className="wc-btn wc-close"
        onClick={() => window.api?.windowClose()}
        title="Chiudi"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18"/>
          <line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

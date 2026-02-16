import { useState, useEffect, useRef } from 'react';
import { Lock, Fingerprint, Eye, EyeOff } from 'lucide-react';

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [bioFailed, setBioFailed] = useState(0);        // contatore tentativi bio falliti
  const [showPasswordField, setShowPasswordField] = useState(false); // mostra password solo dopo 3 fallimenti
  const bioTriggered = useRef(false);

  const MAX_BIO_ATTEMPTS = 3;

  // Check biometrics on mount → auto-prompt Touch ID
  useEffect(() => {
    (async () => {
      try {
        const available = await window.api.checkBio();
        setBioAvailable(available);
        if (available) {
          const saved = await window.api.hasBioSaved();
          setBioSaved(saved);
          // Auto-trigger Touch ID se disponibile e salvata
          if (saved && !bioTriggered.current) {
            bioTriggered.current = true;
            // Piccolo delay per far montare la UI
            setTimeout(() => handleBioLogin(true), 400);
          }
        } else {
          setShowPasswordField(true); // no bio → mostra password subito
        }
      } catch {
        setShowPasswordField(true);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!password.trim() || loading) return;
    
    setLoading(true);
    setError(false);
    try {
      const ok = await window.api.verifyPin(password);
      if (ok) {
        // Save password for biometrics if available
        if (bioAvailable) {
          try { await window.api.saveBio(password); } catch {}
        }
        setTimeout(onUnlock, 200);
      } else {
        setError(true);
        setTimeout(() => { setLoading(false); }, 500);
      }
    } catch {
      setError(true);
      setTimeout(() => { setLoading(false); }, 500);
    }
  };

  const handleBioLogin = async (isAutomatic = false) => {
    setLoading(true);
    setError(false);
    try {
      const savedPassword = await window.api.loginBio();
      if (savedPassword) {
        const ok = await window.api.verifyPin(savedPassword);
        if (ok) {
          setLoading(false);
          setTimeout(onUnlock, 200);
          return;
        }
      }
      // Bio fallita — incrementa contatore
      const newCount = bioFailed + 1;
      setBioFailed(newCount);
      if (newCount >= MAX_BIO_ATTEMPTS) {
        setShowPasswordField(true);
      }
      if (!isAutomatic) setError(true);
      setLoading(false);
    } catch {
      // User cancelled Touch ID
      const newCount = bioFailed + 1;
      setBioFailed(newCount);
      if (newCount >= MAX_BIO_ATTEMPTS) {
        setShowPasswordField(true);
      }
      setLoading(false);
    }
  };

  // Keyboard support - Enter to submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Focus input when password field appears
  useEffect(() => {
    if (showPasswordField) {
      setTimeout(() => {
        const el = document.getElementById('ff-lock-input');
        if (el) el.focus();
      }, 100);
    }
  }, [showPasswordField]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0c0d14]/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-slide-up">
      {/* Icon */}
      <div className="mb-8 p-5 bg-primary/20 rounded-full shadow-[0_0_50px_rgba(79,45,128,0.4)]">
        <Lock className={`w-8 h-8 ${error ? 'text-danger animate-shake' : 'text-primary'}`} />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">FinanceFlow</h2>
      <p className="text-text-muted text-sm mb-8">
        {showPasswordField ? 'Inserisci la password per accedere' : 'Autenticazione biometrica…'}
      </p>

      {/* Biometrics — auto-triggered, retry silently if still available */}
      {bioAvailable && bioSaved && bioFailed < MAX_BIO_ATTEMPTS && !showPasswordField && (
        <button
          onClick={() => handleBioLogin(false)}
          disabled={loading}
          className="flex items-center gap-3 px-8 py-4 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-2xl transition group mb-6"
        >
          <Fingerprint size={24} className="text-primary group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-primary">Riprova Biometria</span>
        </button>
      )}

      {/* Password field — secondario, appare dopo 3 fallimenti bio o se bio non disponibile */}
      {showPasswordField && (
        <>
          <div className="w-72 relative mb-4">
            <input
              id="ff-lock-input"
              type={showPwd ? 'text' : 'password'}
              placeholder="Master Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border text-white text-sm text-center outline-none transition-all"
              style={{
                borderColor: error ? '#f87171' : 'rgba(255,255,255,0.1)',
                letterSpacing: showPwd ? '0' : '2px',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-danger text-xs font-semibold mb-4 animate-shake">Password errata</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password.trim()}
            className="w-72 py-3 rounded-xl bg-primary/80 hover:bg-primary text-white text-sm font-bold transition-all disabled:opacity-40 mb-4"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sblocco…
              </span>
            ) : 'Sblocca'}
          </button>
        </>
      )}

      {/* Security footer */}
      <div className="mt-10 flex items-center gap-2 text-white/15 text-[10px]">
        <Lock size={9} />
        <span>AES-256-GCM · PBKDF2 · Zero-Knowledge</span>
      </div>
    </div>
  );
}

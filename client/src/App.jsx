import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import WindowControls from './components/WindowControls';
import LockScreen from './components/LockScreen';
import AddTransactionModal from './components/AddTransactionModal';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Investments from './pages/Investments';
import Budget from './pages/Budget';
import Settings from './pages/Settings';
import BankConnect from './pages/BankConnect';
import { Plus } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isModalOpen, setModalOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);

  // Check PIN on startup + load privacy setting
  useEffect(() => {
    (async () => {
      try {
        const has = await window.api.hasPin();
        if (has) setIsLocked(true);
      } catch {}
      try {
        const s = await window.api.getSettings();
        if (s && typeof s.privacyBlurEnabled === 'boolean') {
          setPrivacyEnabled(s.privacyBlurEnabled);
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  // Listen for privacy setting changes from Settings page
  useEffect(() => {
    const handler = (e) => setPrivacyEnabled(e.detail);
    window.addEventListener('ff-privacy-changed', handler);
    return () => window.removeEventListener('ff-privacy-changed', handler);
  }, []);

  // Privacy blur listener
  useEffect(() => {
    if (window.api?.onBlur) {
      window.api.onBlur((val) => {
        if (privacyEnabled) setIsBlurred(val);
        else setIsBlurred(false);
      });
    }
    // Auto-lock dopo 30s fuori focus (se il PIN è impostato)
    if (window.api?.onLock) {
      window.api.onLock(async () => {
        if (!privacyEnabled) return;
        try {
          const has = await window.api.hasPin();
          if (has) {
            setIsBlurred(false);
            setIsLocked(true);
          }
        } catch {}
      });
    }
  }, [privacyEnabled]);

  // Load accounts for sidebar
  const loadAccounts = useCallback(async () => {
    try {
      const accs = await window.api.getAccounts();
      setAccounts(accs);
    } catch {}
  }, []);

  useEffect(() => { if (!isLocked && ready) loadAccounts(); }, [isLocked, ready, loadAccounts]);

  const handleSaveTransaction = async (data) => {
    try {
      await window.api.createTransaction(data);
      loadAccounts(); // Refresh balances
      window.dispatchEvent(new CustomEvent('ff-data-changed'));
    } catch (e) { console.error(e); }
  };

  if (!ready) return null;

  if (isLocked) {
    return <LockScreen onUnlock={() => { setIsBlurred(false); setIsLocked(false); }} />;
  }

  return (
    <>
      {/* PRIVACY SHIELD — click richiede password se attiva */}
      {privacyEnabled && (
        <div 
          className={`fixed inset-0 z-[9999] bg-[#0c0d14]/60 backdrop-blur-2xl flex items-center justify-center transition-opacity duration-300 ${isBlurred ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={async () => {
            // Se la password è attiva, blocca l'app al click
            try {
              const has = await window.api.hasPin();
              if (has) {
                setIsBlurred(false);
                setIsLocked(true);
                return;
              }
            } catch {}
            // Nessuna password → dismiss dello shield
            setIsBlurred(false);
          }}
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f2d80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Protetto</h2>
            <p className="text-text-muted text-xs mt-2">Clicca per sbloccare</p>
          </div>
        </div>
      )}

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(19, 20, 30, 0.8)',
            backdropFilter: 'blur(12px)',
            color: '#e2e4ef',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            fontSize: '13px',
            padding: '12px 16px',
          },
          success: {
            style: { borderColor: 'rgba(52, 211, 153, 0.3)' },
            iconTheme: { primary: '#198d63', secondary: '#0c0d14' },
          },
          error: {
            style: { borderColor: 'rgba(248, 113, 113, 0.3)' },
            iconTheme: { primary: '#f87171', secondary: '#0c0d14' },
          },
        }}
      />

      <WindowControls />

      <div className="app-layout">
        <Sidebar active={activePage} onChange={setActivePage} accounts={accounts} />

        <main className="main-content">
          {/* FAB */}
          <button
            onClick={() => setModalOpen(true)}
            className="fixed bottom-8 right-8 w-14 h-14 bg-primary rounded-2xl shadow-[0_0_20px_rgba(79,45,128,0.6)] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40"
            title="Aggiungi Transazione"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>

          {/* Pages */}
          {activePage === 'dashboard' && <Dashboard onNavigate={setActivePage} />}
          {activePage === 'transactions' && <Transactions onOpenAdd={() => setModalOpen(true)} />}
          {activePage === 'investments' && <Investments />}
          {activePage === 'budget' && <Budget />}
          {activePage === 'settings' && <Settings />}
          {activePage === 'banksync' && <BankConnect />}
        </main>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTransaction}
        accounts={accounts}
      />
    </>
  );
}

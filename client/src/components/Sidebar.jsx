import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  PieChart, 
  Building2, 
  Settings, 
  PlusCircle, 
  Info 
} from 'lucide-react';
import logoSrc from '../assets/financeflow-icon.png';
import api from '../api';

const Icons = {
  Dashboard: () => <LayoutDashboard className="sidebar-icon" strokeWidth={2} />,
  Transactions: () => <Wallet className="sidebar-icon" strokeWidth={2} />,
  Budget: () => <PieChart className="sidebar-icon" strokeWidth={2} />,
  Investments: () => <TrendingUp className="sidebar-icon" strokeWidth={2} />,
  BankSync: () => <Building2 className="sidebar-icon" strokeWidth={2} />,
  Settings: () => <Settings className="sidebar-icon" strokeWidth={2} />,
  Logo: () => (
    <img 
      src={logoSrc} 
      alt="FinanceFlow" 
      className="sidebar-logo-svg no-drag" 
      style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
    />
  )
};

export default function Sidebar({ version = '1.0' }) {
  const [accounts, setAccounts] = useState([]);

  const load = async () => { 
    try { 
      const data = await api.getAccounts(); 
      setAccounts(data); 
    } catch {} 
  };

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, []);

  const totalBalance = (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);

  return (
    <nav className="sidebar">
      {/* Spacer per il drag della finestra su Electron/Desktop */}
      <div className="sidebar-traffic-spacer drag-region" style={{ height: '32px', flexShrink: 0 }} />
      
      <div className="sidebar-brand no-drag">
        <Icons.Logo />
        <span className="sidebar-title">FinanceFlow</span>
      </div>

      <div className="sidebar-content no-drag">
        <NavLink to="/" end className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Dashboard />
          <span>Dashboard</span>
        </NavLink>

        <div className="sidebar-section-label">Gestione</div>

        <NavLink to="/transactions" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Transactions />
          <span>Transazioni</span>
        </NavLink>

        <NavLink to="/budget" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Budget />
          <span>Budget & Report</span>
        </NavLink>

        <NavLink to="/investments" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Investments />
          <span>Investimenti</span>
        </NavLink>

        <NavLink to="/banksync" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.BankSync />
          <span>Bank Sync</span>
        </NavLink>

        <div className="sidebar-section-label flex justify-between items-center">
          <span>I Tuoi Conti</span>
          <PlusCircle size={14} className="opacity-30 hover:opacity-100 cursor-pointer transition-opacity" />
        </div>

        {/* Lista Conti - Allineata allo stile FinanceFlow */}
        <div className="flex flex-col gap-0.5 pb-2">
          {accounts.length > 0 ? accounts.map((acc, idx) => (
            <div key={idx} className="sidebar-link group" style={{ cursor: 'default', height: 'auto', padding: '8px 12px' }}>
              <div 
                className="w-2 h-2 rounded-full mr-3 shrink-0 transition-transform group-hover:scale-125" 
                style={{ backgroundColor: acc.color, boxShadow: `0 0 8px ${acc.color}` }} 
              />
              <div className="flex flex-col overflow-hidden">
                <span className="text-[11px] font-medium truncate text-white/70 group-hover:text-white transition-colors">
                  {acc.name}
                </span>
                <span className="text-[10px] opacity-40 font-mono tracking-tighter">
                  €{acc.balance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )) : (
            <div className="px-3 py-2 text-[10px] text-gray-500 italic">Nessun conto attivo</div>
          )}
        </div>

        {/* Box Patrimonio Netto - Usa var(--accent) per il colore successo */}
        <div 
          className="animate-slide-up"
          style={{ 
            margin: '12px 8px', 
            padding: '16px', 
            background: 'var(--bg-surface)', 
            borderRadius: 'var(--radius)', 
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
          }}
        >
          <div className="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-bold mb-1">Net Worth</div>
          <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            € {totalBalance.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Footer Unificato - Coerente con LexFlow e SubTracker */}
      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
        <NavLink to="/settings" className={({isActive}) => `sidebar-link sidebar-settings-icon no-drag${isActive ? ' active' : ''}`} title="Impostazioni">
          <Icons.Settings />
        </NavLink>
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.3, fontSize: '10px', padding: '6px 12px' }}>
          <Info size={10} />
          <span>v{version}</span>
        </div>
      </div>
    </nav>
  );
}
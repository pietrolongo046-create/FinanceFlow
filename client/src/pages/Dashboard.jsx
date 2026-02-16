import { TrendingUp, PieChart, ArrowUpRight, ArrowDownRight, Wallet, Plus, Building2 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useEffect } from 'react';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const load = async () => {
    try {
      const [s, h, tx, acc] = await Promise.all([
        window.api.getDashboardStats(),
        window.api.getNetWorthHistory(),
        window.api.getTransactions({ limit: 6 }),
        window.api.getAccounts(),
      ]);
      setStats(s);
      setHistory(h);
      setRecentTx(tx);
      setAccounts(acc);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('ff-data-changed', h);
    return () => window.removeEventListener('ff-data-changed', h);
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" /></div>;

  const fmt = (v) => {
    if (v == null || isNaN(v)) return '€ 0,00';
    return '€ ' + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtCompact = (v) => {
    if (!v || isNaN(v)) return '€ 0';
    if (v >= 1000) return '€ ' + (v / 1000).toFixed(1) + 'k';
    return '€ ' + v.toFixed(0);
  };

  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || '';
  const getAccountColor = (id) => accounts.find(a => a.id === id)?.color || '#4f2d80';

  const totalAlloc = stats.allocation.reduce((s, a) => s + a.value, 0) || 1;
  const hasData = accounts.length > 0 || recentTx.length > 0;
  const hasHistory = history.length > 0;
  const hasAllocation = stats.allocation.some(a => a.value > 0);

  // Welcome empty state
  if (!hasData) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-3xl font-bold text-white">Benvenuto in FinanceFlow</h1>
          <p className="text-text-muted text-sm leading-relaxed">
            Il tuo centro di comando finanziario. Inizia collegando un conto bancario o aggiungendo la tua prima transazione.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onNavigate('banksync')} className="btn-primary px-6 py-3 text-sm font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Collega Banca
          </button>
          <button onClick={() => onNavigate('transactions')} className="px-6 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-white hover:bg-white/5 border border-border transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Aggiungi Manualmente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header: Net Worth */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Patrimonio Totale</h1>
          <p className="text-text-muted text-sm">
            {stats.accountCount > 0
              ? `Aggregato di ${stats.accountCount} ${stats.accountCount === 1 ? 'conto' : 'conti'}.`
              : 'Aggiungi conti per vedere il tuo patrimonio.'}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-black text-white tracking-tighter">{fmt(stats.netWorth)}</h2>
          {(stats.totalBalance > 0 || stats.investmentValue > 0) && (
            <p className="text-sm text-emerald-500 font-bold flex items-center justify-end gap-1">
              <TrendingUp className="w-4 h-4" /> Liquidità {fmtCompact(stats.totalBalance)} • Investito {fmtCompact(stats.investmentValue)}
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xs text-text-muted font-bold uppercase">Entrate Mese</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(stats.income)}</p>
          {stats.income > 0 && (
            <p className={`text-xs font-bold mt-1 ${stats.incomeChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.incomeChange >= 0 ? '+' : ''}{stats.incomeChange}% vs mese scorso
            </p>
          )}
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xs text-text-muted font-bold uppercase">Uscite Mese</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(stats.expense)}</p>
          {stats.expense > 0 && (
            <p className={`text-xs font-bold mt-1 ${stats.expenseChange <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.expenseChange >= 0 ? '+' : ''}{stats.expenseChange}% vs mese scorso
            </p>
          )}
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs text-text-muted font-bold uppercase">Bilancio Netto</p>
          </div>
          <p className={`text-2xl font-bold ${(stats.income - stats.expense) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(stats.income - stats.expense) >= 0 ? '+' : ''}{fmt(stats.income - stats.expense)}
          </p>
          <p className="text-xs text-text-dim mt-1">Entrate − Uscite</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart: Patrimonio nel tempo */}
        <div className="glass-card p-6 col-span-2 min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Crescita Patrimonio
            </h3>
            {hasHistory && (
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-[10px] text-text-muted"><div className="w-2 h-2 rounded-full bg-primary"></div> Investito</span>
                <span className="flex items-center gap-1 text-[10px] text-text-muted"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Liquido</span>
              </div>
            )}
          </div>
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            {hasHistory ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorInvest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f2d80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f2d80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLiquid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#198d63" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#198d63" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: '#7c8099', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#13141e', borderColor: '#22263a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="invest" stackId="1" stroke="#4f2d80" strokeWidth={2} fill="url(#colorInvest)" />
                  <Area type="monotone" dataKey="liquid" stackId="1" stroke="#198d63" strokeWidth={2} fill="url(#colorLiquid)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-text-dim">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Il grafico apparirà con le prime transazioni</p>
              </div>
            )}
          </div>
        </div>

        {/* Allocation */}
        <div className="glass-card p-6 flex flex-col">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-warning" /> Allocazione
          </h3>
          {hasAllocation ? (
            <>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={stats.allocation} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#7c8099', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#13141e', borderColor: '#22263a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v) => fmt(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {stats.allocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {stats.allocation.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs border-b border-white/5 pb-2 last:border-0">
                    <span className="text-text-muted flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: a.color }}></div>
                      {a.name}
                    </span>
                    <span className="text-white font-bold">{((a.value / totalAlloc) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-text-dim">
              <div>
                <PieChart className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nessun dato di allocazione</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card col-span-3 p-0 flex flex-col">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white">Ultimi Movimenti</h3>
            <button onClick={() => onNavigate('transactions')} className="text-xs text-primary hover:text-white transition-colors">Vedi tutti →</button>
          </div>
          {recentTx.length > 0 ? (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentTx.map(tx => {
                const accColor = getAccountColor(tx.accountId);
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer"
                    style={{ borderLeftWidth: '4px', borderLeftColor: accColor }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                        tx.type === 'income' ? 'bg-emerald-500/20 text-emerald-400'
                        : tx.type === 'investment' ? 'bg-white/10 text-white'
                        : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{tx.title}</p>
                        <p className="text-[10px] text-text-muted">{getAccountName(tx.accountId)} • {tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm ml-2 flex-shrink-0 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.amount >= 0 ? '+' : '−'} € {Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-text-dim">
              <ArrowDownRight className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nessun movimento ancora</p>
              <p className="text-xs mt-1 opacity-60">I movimenti appariranno qui dopo la prima sincronizzazione</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

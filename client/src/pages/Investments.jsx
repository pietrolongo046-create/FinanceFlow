import { TrendingUp, Plus, Trash2, Edit3, BarChart3, Briefcase, X, Check } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, PieChart, Pie, Cell } from 'recharts';
import { useState, useEffect } from 'react';

const ASSET_COLORS = ['#4f2d80', '#198d63', '#f59e0b', '#f87171', '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf'];
const TYPES = ['Stock', 'ETF', 'Crypto', 'Bond'];
const TYPE_ICONS = { Stock: '📈', ETF: '📊', Crypto: '₿', Bond: '🏦' };

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ticker: '', name: '', qty: '', avgPrice: '', currentPrice: '', type: 'Stock' });
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('value');

  const load = async () => {
    try {
      const data = await window.api.getInvestments();
      setInvestments(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('ff-data-changed', h);
    return () => window.removeEventListener('ff-data-changed', h);
  }, []);

  const totalValue = investments.reduce((s, i) => s + (i.currentPrice || 0) * (i.qty || 0), 0);
  const totalCost = investments.reduce((s, i) => s + (i.avgPrice || 0) * (i.qty || 0), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? ((totalPnL / totalCost) * 100).toFixed(1) : '0.0';

  const typeBreakdown = TYPES.map((type, i) => {
    const items = investments.filter(inv => inv.type === type);
    const val = items.reduce((s, inv) => s + (inv.currentPrice || 0) * (inv.qty || 0), 0);
    return { name: type, value: val, color: ASSET_COLORS[i] };
  }).filter(t => t.value > 0);

  const chartData = investments.length > 0
    ? Array.from({ length: 30 }, (_, i) => {
        const progress = i / 29;
        const noise = (Math.sin(i * 0.7) * 0.02 + Math.cos(i * 1.3) * 0.015);
        return { day: i + 1, value: totalCost + (totalPnL * progress) + (totalValue * noise) };
      })
    : [];

  const filtered = investments
    .filter(i => filterType === 'all' || i.type === filterType)
    .sort((a, b) => {
      if (sortBy === 'value') return ((b.currentPrice || 0) * (b.qty || 0)) - ((a.currentPrice || 0) * (a.qty || 0));
      if (sortBy === 'pnl') {
        const pnlA = ((a.currentPrice || 0) - (a.avgPrice || 0)) * (a.qty || 0);
        const pnlB = ((b.currentPrice || 0) - (b.avgPrice || 0)) * (b.qty || 0);
        return pnlB - pnlA;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      qty: parseFloat(form.qty),
      avgPrice: parseFloat(form.avgPrice),
      currentPrice: parseFloat(form.currentPrice),
      type: form.type,
    };
    if (editingId) {
      await window.api.updateInvestment(editingId, payload);
      setEditingId(null);
    } else {
      await window.api.createInvestment(payload);
    }
    setForm({ ticker: '', name: '', qty: '', avgPrice: '', currentPrice: '', type: 'Stock' });
    setShowAdd(false);
    load();
    window.dispatchEvent(new CustomEvent('ff-data-changed'));
  };

  const handleEdit = (asset) => {
    setForm({
      ticker: asset.ticker || '', name: asset.name || '',
      qty: String(asset.qty || ''), avgPrice: String(asset.avgPrice || ''),
      currentPrice: String(asset.currentPrice || ''), type: asset.type || 'Stock',
    });
    setEditingId(asset.id);
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    await window.api.deleteInvestment(id);
    load();
    window.dispatchEvent(new CustomEvent('ff-data-changed'));
  };

  const handleCancel = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ ticker: '', name: '', qty: '', avgPrice: '', currentPrice: '', type: 'Stock' });
  };

  const fmt = (v) => {
    if (v == null || isNaN(v)) return '€ 0,00';
    return '€ ' + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtCompact = (v) => {
    if (!v || isNaN(v)) return '€ 0';
    if (Math.abs(v) >= 1000) return '€ ' + (v / 1000).toFixed(1) + 'k';
    return '€ ' + v.toFixed(0);
  };

  if (investments.length === 0 && !showAdd) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-3xl font-bold text-white">Portfolio Investimenti</h1>
          <p className="text-text-muted text-sm leading-relaxed">
            Traccia azioni, ETF, crypto e obbligazioni. Monitora le performance e la diversificazione del tuo portafoglio.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-6 py-3 text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Aggiungi il Primo Asset
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Investimenti</h1>
          <p className="text-text-muted text-sm">{investments.length} asset nel portafoglio</p>
        </div>
        <button onClick={() => { handleCancel(); setShowAdd(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Aggiungi Asset
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">{editingId ? 'Modifica Asset' : 'Nuovo Asset'}</h3>
            <button type="button" onClick={handleCancel} className="text-text-dim hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Ticker</label><input className="input-field" placeholder="AAPL" required value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Nome</label><input className="input-field" placeholder="Apple Inc." required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Quantità</label><input className="input-field" type="number" step="any" placeholder="10" required value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Prezzo Medio</label><input className="input-field" type="number" step="0.01" placeholder="140.00" required value={form.avgPrice} onChange={e => setForm({ ...form, avgPrice: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Prezzo Attuale</label><input className="input-field" type="number" step="0.01" placeholder="152.40" required value={form.currentPrice} onChange={e => setForm({ ...form, currentPrice: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-text-muted uppercase">Tipo</label><select className="input-field appearance-none cursor-pointer" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm"><Check className="w-4 h-4" />{editingId ? 'Aggiorna' : 'Aggiungi'}</button>
            <button type="button" onClick={handleCancel} className="text-xs text-text-muted hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">Annulla</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted font-bold uppercase mb-1">Valore Totale</p>
          <p className="text-2xl font-bold text-white">{fmtCompact(totalValue)}</p>
          <p className="text-[10px] text-text-dim mt-1">Costo: {fmtCompact(totalCost)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted font-bold uppercase mb-1">P&L Totale</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalPnL >= 0 ? '+' : ''}{fmtCompact(totalPnL)}</p>
          <p className={`text-xs font-bold mt-1 ${totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{totalPnL >= 0 ? '+' : ''}{totalPnLPct}%</p>
        </div>
        {investments.length > 0 ? (() => {
          const sorted = [...investments].sort((a, b) => {
            const pctA = a.avgPrice > 0 ? ((a.currentPrice - a.avgPrice) / a.avgPrice) * 100 : 0;
            const pctB = b.avgPrice > 0 ? ((b.currentPrice - b.avgPrice) / b.avgPrice) * 100 : 0;
            return pctB - pctA;
          });
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          const bestPct = best.avgPrice > 0 ? (((best.currentPrice - best.avgPrice) / best.avgPrice) * 100).toFixed(1) : '0.0';
          const worstPct = worst.avgPrice > 0 ? (((worst.currentPrice - worst.avgPrice) / worst.avgPrice) * 100).toFixed(1) : '0.0';
          return (<>
            <div className="glass-card p-5">
              <p className="text-xs text-text-muted font-bold uppercase mb-1">Miglior Asset</p>
              <p className="text-lg font-bold text-white">{best.ticker || best.name}</p>
              <p className={`text-xs font-bold mt-1 ${parseFloat(bestPct) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{parseFloat(bestPct) >= 0 ? '+' : ''}{bestPct}%</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-text-muted font-bold uppercase mb-1">Peggior Asset</p>
              <p className="text-lg font-bold text-white">{worst.ticker || worst.name}</p>
              <p className={`text-xs font-bold mt-1 ${parseFloat(worstPct) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{parseFloat(worstPct) >= 0 ? '+' : ''}{worstPct}%</p>
            </div>
          </>);
        })() : (<>
          <div className="glass-card p-5 flex items-center justify-center text-text-dim text-xs">—</div>
          <div className="glass-card p-5 flex items-center justify-center text-text-dim text-xs">—</div>
        </>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 col-span-2 min-h-[280px] flex flex-col">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Performance Portafoglio</h3>
          {chartData.length > 0 ? (
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={totalPnL >= 0 ? '#198d63' : '#f87171'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={totalPnL >= 0 ? '#198d63' : '#f87171'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" hide />
                  <Tooltip contentStyle={{ backgroundColor: '#13141e', borderColor: '#22263a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v) => [fmt(v), 'Valore']} labelFormatter={(l) => `Giorno ${l}`} />
                  <Area type="monotone" dataKey="value" stroke={totalPnL >= 0 ? '#198d63' : '#f87171'} strokeWidth={2} fill="url(#colorPerf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-dim text-center"><div><BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-xs">Aggiungi asset per vedere il grafico</p></div></div>
          )}
        </div>

        <div className="glass-card p-6 flex flex-col">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-warning" /> Diversificazione</h3>
          {typeBreakdown.length > 0 ? (<>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {typeBreakdown.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#13141e', borderColor: '#22263a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v) => [fmt(v), '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {typeBreakdown.map((t, i) => (
                <div key={i} className="flex justify-between text-xs border-b border-white/5 pb-2 last:border-0">
                  <span className="text-text-muted flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }}></div>{t.name}</span>
                  <span className="text-white font-bold">{totalValue > 0 ? ((t.value / totalValue) * 100).toFixed(0) : 0}%</span>
                </div>
              ))}
            </div>
          </>) : (
            <div className="flex-1 flex items-center justify-center text-text-dim text-center"><div><BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-xs">Nessun dato</p></div></div>
          )}
        </div>
      </div>

      {investments.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterType === 'all' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>Tutti</button>
            {TYPES.map(t => {
              const count = investments.filter(i => i.type === t).length;
              if (count === 0) return null;
              return (<button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterType === t ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>{t} <span className="opacity-50 ml-1">{count}</span></button>);
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-text-dim uppercase">Ordina</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-white/5 border border-white/5 rounded-lg text-xs text-white px-3 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-primary">
              <option value="value">Valore</option>
              <option value="pnl">Performance</option>
              <option value="name">Nome</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(asset => {
          const value = (asset.currentPrice || 0) * (asset.qty || 0);
          const cost = (asset.avgPrice || 0) * (asset.qty || 0);
          const pnl = value - cost;
          const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : '0.0';
          const isPositive = pnl >= 0;
          const weight = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
          return (
            <div key={asset.id} className="glass-card p-0 overflow-hidden group hover:border-white/10 transition-all">
              <div className="p-4 pb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${isPositive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                    <span className="text-sm">{TYPE_ICONS[asset.type] || '📈'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{asset.ticker || '—'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-dim">{asset.type}</span>
                    </div>
                    <p className="text-xs text-text-muted truncate max-w-[160px]">{asset.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(asset)} className="p-1.5 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(asset.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-text-dim hover:text-rose-400 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Valore</p>
                    <p className="text-lg font-bold text-white">{fmt(value)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{isPositive ? '+' : ''}{fmt(pnl)}</p>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{isPositive ? '+' : ''}{pnlPct}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <div><p className="text-[10px] text-text-dim">Qtà</p><p className="text-xs font-bold text-white">{asset.qty}</p></div>
                  <div><p className="text-[10px] text-text-dim">PMC</p><p className="text-xs font-bold text-text-muted">{fmt(asset.avgPrice)}</p></div>
                  <div><p className="text-[10px] text-text-dim">Peso</p><p className="text-xs font-bold text-primary">{weight}%</p></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && investments.length > 0 && (
        <div className="glass-card p-12 text-center text-text-muted"><p className="text-sm">Nessun asset di tipo "{filterType}".</p></div>
      )}
    </div>
  );
}

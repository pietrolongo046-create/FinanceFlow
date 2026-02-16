import { useState, useEffect } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, TrendingUp, Download, Plus, Trash2 } from 'lucide-react';

export default function Transactions({ onOpenAdd }) {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const load = async () => {
    try {
      const [tx, acc] = await Promise.all([
        window.api.getTransactions(),
        window.api.getAccounts(),
      ]);
      setTransactions(tx);
      setAccounts(acc);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  // Listen for data changes (after adding transactions)
  useEffect(() => {
    const h = () => load();
    window.addEventListener('ff-data-changed', h);
    return () => window.removeEventListener('ff-data-changed', h);
  }, []);

  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || '—';
  const getAccountColor = (id) => accounts.find(a => a.id === id)?.color || '#4f2d80';

  const filtered = transactions.filter(t => {
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id) => {
    await window.api.deleteTransaction(id);
    load();
  };

  const handleExport = async () => {
    await window.api.exportData();
  };

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Transazioni</h1>
          <p className="text-text-muted text-sm">Gestisci e categorizza le tue spese. {filtered.length} movimenti.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Cerca transazione..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
            <Search className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Filters */}
          <div className="flex bg-black/20 rounded-xl p-1 border border-border">
            {[
              { key: 'all', label: 'Tutti', color: '' },
              { key: 'income', label: 'Entrate', color: 'bg-emerald-500/20 text-emerald-400' },
              { key: 'expense', label: 'Uscite', color: 'bg-rose-500/20 text-rose-400' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === f.key
                    ? f.key === 'all' ? 'bg-white/10 text-white' : f.color
                    : 'text-text-muted hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button onClick={handleExport} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-white/5 transition-colors text-text-muted hover:text-white" title="Esporta">
            <Download className="w-4 h-4" />
          </button>

          <button onClick={onOpenAdd} className="btn-primary px-3" title="Aggiungi">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="glass-card overflow-hidden p-0">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-text-muted uppercase tracking-wider">
          <div className="col-span-4">Dettaglio</div>
          <div className="col-span-2 hidden md:block">Categoria</div>
          <div className="col-span-2">Conto</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-2 text-right">Importo</div>
        </div>

        <div className="divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-text-muted">Nessuna transazione trovata.</div>
          ) : (
            filtered.map(t => (
              <div key={t.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors group">
                <div className="col-span-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500'
                    : t.type === 'investment' ? 'bg-white/10 text-white'
                    : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> :
                     t.type === 'investment' ? <TrendingUp className="w-5 h-5" /> :
                     <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{t.title}</p>
                  </div>
                </div>

                <div className="col-span-2 hidden md:flex items-center">
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-text-dim group-hover:text-white transition-colors">
                    {t.category || '—'}
                  </span>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getAccountColor(t.accountId) }}></div>
                  <span className="text-xs text-text-muted">{getAccountName(t.accountId)}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-xs text-text-dim">{t.date}</span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className={`font-mono font-bold text-sm ${
                    (t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {(t.amount || 0) >= 0 ? '+' : '−'} € {Math.abs(t.amount || 0).toFixed(2)}
                  </span>
                  <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-all p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

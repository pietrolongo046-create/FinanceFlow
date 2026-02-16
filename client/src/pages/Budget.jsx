import { useState, useEffect } from 'react';
import { PieChart, AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

export default function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: '', budget: '', color: '#4f2d80' });

  const load = async () => {
    try {
      const [b, tx] = await Promise.all([
        window.api.getBudgets(),
        window.api.getTransactions(),
      ]);
      setBudgets(b);
      setTransactions(tx);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  // Calculate spent per category (current month only)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTx = transactions.filter(t => t.type === 'expense' && (t.date || '').startsWith(thisMonth));

  const budgetData = budgets.map(b => {
    const spent = monthTx
      .filter(t => (t.category || '').toLowerCase() === b.category.toLowerCase())
      .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return { ...b, spent };
  });

  const totalBudget = budgetData.reduce((s, b) => s + (b.budget || 0), 0);
  const totalSpent = budgetData.reduce((s, b) => s + b.spent, 0);
  const progress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Radar data
  const radarData = budgetData.map(b => ({
    subject: b.category,
    A: b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0,
    fullMark: 150,
  }));

  const handleAdd = async (e) => {
    e.preventDefault();
    await window.api.createBudget({
      category: form.category,
      budget: parseFloat(form.budget),
      color: form.color,
    });
    setForm({ category: '', budget: '', color: '#4f2d80' });
    setShowAdd(false);
    load();
  };

  const handleDelete = async (id) => {
    await window.api.deleteBudget(id);
    load();
  };

  return (
    <div className="animate-slide-up space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Budget & Report</h1>
          <p className="text-text-muted text-sm">Analisi mensile delle tue abitudini di spesa.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          <Plus className="w-4 h-4" /> Aggiungi Categoria
        </button>
      </header>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="glass-card p-5 relative">
          <button type="button" onClick={() => setShowAdd(false)} className="absolute top-3 right-3 text-text-dim hover:text-danger transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="grid grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Categoria</label>
            <input className="input-field" placeholder="es. Ristoranti" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Budget Mensile (€)</label>
            <input className="input-field" type="number" step="1" placeholder="200" required value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Colore</label>
            <input type="color" className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-border" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary col-span-3 justify-center">Salva Budget</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Summary Card */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-text-muted uppercase mb-2">Budget Totale</p>
            <h2 className="text-4xl font-bold text-white">
              € {totalSpent.toFixed(0)} <span className="text-lg text-text-dim font-normal">/ {totalBudget}</span>
            </h2>
          </div>
          <div className="mt-8">
            <div className="flex justify-between text-xs mb-2">
              <span className={progress > 100 ? 'text-danger' : 'text-white'}>{progress.toFixed(0)}% Utilizzato</span>
              <span className="text-text-muted">Rimangono € {Math.max(0, totalBudget - totalSpent).toFixed(0)}</span>
            </div>
            <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${progress > 100 ? 'bg-danger' : 'bg-primary'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="glass-card p-4 col-span-2 row-span-2 flex flex-col">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" /> Radar delle Spese
          </h3>
          <div className="flex-1 min-h-[300px]">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#ffffff20" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar name="Spesa %" dataKey="A" stroke="#4f2d80" strokeWidth={3} fill="#4f2d80" fillOpacity={0.4} />
                  <Tooltip contentStyle={{ backgroundColor: '#13141e', borderColor: '#22263a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v) => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">Aggiungi categorie budget per vedere il radar.</div>
            )}
          </div>
        </div>

        {/* Category List */}
        <div className="glass-card p-0 flex flex-col">
          <div className="p-4 border-b border-white/5 font-bold text-white">Dettaglio Categorie</div>
          <div className="p-2 overflow-y-auto max-h-[400px] no-scrollbar">
            {budgetData.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">Nessun budget impostato.</div>
            ) : (
              budgetData.map(item => {
                const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
                const isOver = pct > 100;

                return (
                  <div key={item.id} className="p-3 hover:bg-white/5 rounded-xl transition-colors group">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
                        {item.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${isOver ? 'text-danger font-bold' : 'text-text-muted'}`}>
                          €{item.spent.toFixed(0)} / {item.budget}
                        </span>
                        <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, background: isOver ? '#f87171' : item.color }}
                      ></div>
                    </div>
                    {isOver && (
                      <div className="text-[10px] text-danger mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Budget superato di €{(item.spent - item.budget).toFixed(0)}!
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { X, Check } from 'lucide-react';
import { useState } from 'react';

export default function AddTransactionModal({ isOpen, onClose, onSave, accounts }) {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    type: 'expense',
    category: 'Altro',
    accountId: accounts?.[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
  });

  if (!isOpen) return null;

  const categories = ['Casa', 'Spesa', 'Svago', 'Trasporti', 'Salute', 'Abbonamenti', 'Lavoro', 'Investimenti', 'Dividendi', 'Altro'];

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!formData.title || isNaN(amount)) return;

    onSave({
      ...formData,
      amount: formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    });

    setFormData({ title: '', amount: '', type: 'expense', category: 'Altro', accountId: accounts?.[0]?.id || '', date: new Date().toISOString().slice(0, 10) });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Nuova Transazione</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-3 gap-2 bg-black/20 p-1 rounded-xl">
            {[
              { key: 'expense', label: 'Uscita', color: 'bg-rose-500' },
              { key: 'income', label: 'Entrata', color: 'bg-emerald-500' },
              { key: 'investment', label: 'Invest.', color: 'bg-primary' },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormData({ ...formData, type: key })}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  formData.type === key ? `${color} text-white` : 'text-text-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted uppercase">Titolo</label>
            <input
              type="text"
              className="input-field"
              placeholder="es. Spesa Carrefour"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase">Importo (€)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                required
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase">Data</label>
              <input
                type="date"
                className="input-field"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase">Categoria</label>
              <select
                className="input-field appearance-none cursor-pointer"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Account */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase">Conto</label>
              <select
                className="input-field appearance-none cursor-pointer"
                value={formData.accountId}
                onChange={e => setFormData({ ...formData, accountId: e.target.value })}
              >
                {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full mt-4 justify-center">
            <Check className="w-4 h-4" /> Conferma
          </button>
        </form>
      </div>
    </div>
  );
}

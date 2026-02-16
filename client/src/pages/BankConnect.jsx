import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Link2, Unlink, RefreshCw, Search, ChevronRight,
  Check, AlertCircle, Key, Trash2, ArrowDownToLine, Loader2,
  Shield, Globe, CreditCard, Landmark, ArrowLeft, Info, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = {
  HOME: 'home',
  SETUP: 'setup',
  BANKS: 'banks',
  PENDING: 'pending',
};

export default function BankConnect() {
  const [step, setStep] = useState(STEPS.HOME);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ secretId: '', secretKey: '' });
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [pendingReq, setPendingReq] = useState(null);
  const [syncing, setSyncing] = useState(null); // goCardlessId being synced
  const [syncResult, setSyncResult] = useState(null);
  const [country, setCountry] = useState('IT');

  // ───── Load state ─────
  const loadState = useCallback(async () => {
    try {
      const has = await window.api.bankHasCredentials();
      setHasCredentials(has);
      if (has) {
        const creds = await window.api.bankGetCredentials();
        setCredentials(creds);
        const linked = await window.api.bankGetLinked();
        setLinkedAccounts(linked);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  // ───── Credentials ─────
  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    if (!credentials.secretId.trim() || !credentials.secretKey.trim()) {
      toast.error('Inserisci entrambe le chiavi API.');
      return;
    }
    await window.api.bankSetCredentials(credentials.secretId.trim(), credentials.secretKey.trim());
    setHasCredentials(true);
    toast.success('Chiavi API salvate!');
    setStep(STEPS.HOME);
    loadState();
  };

  const handleRemoveCredentials = async () => {
    if (!confirm('Rimuovere le chiavi API e scollegare tutte le banche?')) return;
    await window.api.bankRemoveCredentials();
    setHasCredentials(false);
    setCredentials({ secretId: '', secretKey: '' });
    setLinkedAccounts([]);
    toast.success('Chiavi rimosse.');
    setStep(STEPS.HOME);
  };

  // ───── Load banks ─────
  const handleLoadBanks = async () => {
    setBanksLoading(true);
    setBanks([]);
    try {
      const result = await window.api.bankGetList(country);
      if (result.success) {
        setBanks(result.data);
        setStep(STEPS.BANKS);
      } else {
        toast.error(result.error || 'Errore caricamento banche.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBanksLoading(false);
    }
  };

  // ───── Connect bank ─────
  const handleConnectBank = async (bank) => {
    try {
      const result = await window.api.bankConnect(bank.id);
      if (result.success) {
        setPendingReq({ ...result.data, bankName: bank.name, bankLogo: bank.logo });
        setStep(STEPS.PENDING);
        toast.success('Pagina di autorizzazione aperta nel browser!');
      } else {
        toast.error(result.error || 'Errore connessione.');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ───── Finalize connection ─────
  const handleFinalize = async () => {
    if (!pendingReq) return;
    try {
      const result = await window.api.bankFinalize(
        pendingReq.requisitionId,
        pendingReq.bankName,
        pendingReq.bankLogo
      );
      if (result.success) {
        toast.success(`${result.accounts.length} conto/i collegato/i!`);
        setPendingReq(null);
        setStep(STEPS.HOME);
        loadState();
      } else {
        toast.error(result.message || 'Autorizzazione non ancora completata. Riprova.');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ───── Unlink ─────
  const handleUnlink = async (goCardlessId, name) => {
    if (!confirm(`Scollegare ${name}?`)) return;
    await window.api.bankUnlink(goCardlessId);
    toast.success('Conto scollegato.');
    loadState();
  };

  // ───── Sync ─────
  const handleSync = async (acc) => {
    setSyncing(acc.goCardlessId);
    setSyncResult(null);

    // Get FinanceFlow accounts to find matching one
    let ffAccountId = null;
    try {
      const ffAccounts = await window.api.getAccounts();
      // Try to match by name
      const match = ffAccounts.find(a => a.name.toLowerCase().includes(acc.bankName.toLowerCase()));
      ffAccountId = match?.id || null;
    } catch {}

    // Default: sync last 90 days
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);

    try {
      const result = await window.api.bankSync({
        goCardlessId: acc.goCardlessId,
        accountId: ffAccountId,
        accountName: acc.bankName,
        dateFrom: dateFrom.toISOString().slice(0, 10),
      });

      if (result.success) {
        setSyncResult(result);
        if (result.imported > 0) {
          toast.success(`${result.imported} nuove transazioni importate!`);
          window.dispatchEvent(new CustomEvent('ff-data-changed'));
        } else {
          toast('Nessuna nuova transazione da importare.', { icon: '📭' });
        }
      } else {
        toast.error(result.error || 'Errore sync.');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(null);
    }
  };

  // ───── Filter banks ─────
  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const countries = [
    { code: 'IT', name: '🇮🇹 Italia' },
    { code: 'DE', name: '🇩🇪 Germania' },
    { code: 'FR', name: '🇫🇷 Francia' },
    { code: 'ES', name: '🇪🇸 Spagna' },
    { code: 'NL', name: '🇳🇱 Olanda' },
    { code: 'PT', name: '🇵🇹 Portogallo' },
    { code: 'AT', name: '🇦🇹 Austria' },
    { code: 'BE', name: '🇧🇪 Belgio' },
    { code: 'IE', name: '🇮🇪 Irlanda' },
    { code: 'GB', name: '🇬🇧 UK' },
  ];

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════

  // ─── Banks List ───
  if (step === STEPS.BANKS) {
    return (
      <div className="animate-slide-up space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(STEPS.HOME)} className="text-text-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Scegli la Banca</h1>
            <p className="text-text-muted text-sm">Seleziona il tuo istituto per avviare il collegamento PSD2</p>
          </div>
        </div>

        {/* Search + Country */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Cerca banca..."
              value={bankSearch}
              onChange={e => setBankSearch(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <select
            value={country}
            onChange={e => { setCountry(e.target.value); }}
            className="input-field w-40"
          >
            {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button onClick={handleLoadBanks} className="btn-primary px-4 text-sm flex items-center gap-2" disabled={banksLoading}>
            {banksLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Aggiorna
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredBanks.map(bank => (
            <button
              key={bank.id}
              onClick={() => handleConnectBank(bank)}
              className="glass-card p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(79,45,128,0.15)] transition-all text-left group"
            >
              {bank.logo ? (
                <img src={bank.logo} alt="" className="w-10 h-10 rounded-lg bg-white p-1 object-contain flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate group-hover:text-primary transition-colors">{bank.name}</p>
                <p className="text-[10px] text-text-muted">Max {bank.maxHistoryDays} giorni storico</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-primary transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>

        {filteredBanks.length === 0 && !banksLoading && (
          <div className="text-center py-12 text-text-muted">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nessuna banca trovata</p>
            <p className="text-xs">Prova con un altro paese o termine di ricerca</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Pending Authorization ───
  if (step === STEPS.PENDING && pendingReq) {
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center min-h-[60vh] space-y-8">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-bold text-white">Autorizzazione in corso</h2>
          <p className="text-text-muted text-sm leading-relaxed">
            Una pagina di login si è aperta nel tuo browser.
            Accedi al sito di <strong className="text-white">{pendingReq.bankName}</strong> e autorizza FinanceFlow a leggere i tuoi dati.
          </p>
          <p className="text-text-dim text-xs mt-2">
            Quando hai finito, clicca il pulsante qui sotto.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleFinalize} className="btn-primary px-6 py-3 text-sm font-bold flex items-center gap-2">
            <Check className="w-4 h-4" />
            Ho Autorizzato
          </button>
          <button onClick={() => { setPendingReq(null); setStep(STEPS.HOME); }} className="px-6 py-3 rounded-xl text-sm text-text-muted hover:text-white hover:bg-white/5 transition-all">
            Annulla
          </button>
        </div>

        <div className="glass-card p-4 max-w-sm">
          <p className="text-[10px] text-text-dim leading-relaxed">
            <Info className="w-3 h-3 inline mr-1" />
            FinanceFlow non vede mai le tue credenziali bancarie. L'autorizzazione avviene direttamente sul sito della banca tramite il protocollo PSD2 europeo.
          </p>
        </div>
      </div>
    );
  }

  // ─── API Setup ───
  if (step === STEPS.SETUP) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(STEPS.HOME)} className="text-text-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Configurazione API</h1>
            <p className="text-text-muted text-sm">Inserisci le chiavi GoCardless per abilitare il Bank Sync</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="glass-card p-5 border-primary/20 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Come ottenere le chiavi</h3>
              <p className="text-[11px] text-text-muted">Piano gratuito disponibile per sviluppatori</p>
            </div>
          </div>
          <ol className="text-xs text-text-muted space-y-1 ml-4 list-decimal">
            <li>Vai su <button onClick={() => window.api.openExternal('https://gocardless.com/bank-account-data/')} className="text-primary hover:underline cursor-pointer">gocardless.com/bank-account-data</button></li>
            <li>Registrati e vai nella sezione <strong className="text-white">API Keys</strong></li>
            <li>Crea un nuovo "Secret" e copia <strong className="text-white">Secret ID</strong> e <strong className="text-white">Secret Key</strong></li>
            <li>Incollali qui sotto</li>
          </ol>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">Secret ID</label>
            <input
              type="text"
              value={credentials.secretId}
              onChange={e => setCredentials(prev => ({ ...prev, secretId: e.target.value }))}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="input-field w-full font-mono text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">Secret Key</label>
            <input
              type="password"
              value={credentials.secretKey}
              onChange={e => setCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
              placeholder="••••••••••••••••••••••••••"
              className="input-field w-full font-mono text-sm"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2">
              <Key className="w-4 h-4" />
              Salva Chiavi
            </button>
            {hasCredentials && (
              <button
                type="button"
                onClick={handleRemoveCredentials}
                className="px-6 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/10 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Rimuovi
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  HOME
  // ═══════════════════════════════════════════════════════
  return (
    <div className="animate-slide-up space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Bank Sync</h1>
        <p className="text-text-muted text-sm">Collega i tuoi conti bancari per importare transazioni automaticamente tramite PSD2</p>
      </header>

      {/* Status Card */}
      <div className="glass-card p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasCredentials ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-primary/10 border border-primary/20'}`}>
            {hasCredentials ? <Check className="w-6 h-6 text-emerald-400" /> : <Key className="w-6 h-6 text-primary" />}
          </div>
          <div>
            <h3 className="font-bold text-white">
              {hasCredentials ? 'API Configurata' : 'Configurazione Richiesta'}
            </h3>
            <p className="text-xs text-text-muted">
              {hasCredentials
                ? `GoCardless · ${linkedAccounts.length} conto/i collegato/i`
                : 'Inserisci le chiavi GoCardless per iniziare'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setStep(STEPS.SETUP)}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2"
        >
          <Key className="w-4 h-4" />
          {hasCredentials ? 'Modifica' : 'Configura'}
        </button>
      </div>

      {/* Quick Actions */}
      {hasCredentials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Add Bank */}
          <button
            onClick={handleLoadBanks}
            disabled={banksLoading}
            className="glass-card p-5 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(79,45,128,0.1)] transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              {banksLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Link2 className="w-5 h-5 text-primary" />}
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-primary transition-colors">Collega Banca</h3>
            <p className="text-[10px] text-text-muted mt-1">Aggiungi un nuovo conto bancario</p>
          </button>

          {/* Sync All */}
          <button
            onClick={async () => {
              for (const acc of linkedAccounts) {
                await handleSync(acc);
              }
            }}
            disabled={!linkedAccounts.length || syncing}
            className="glass-card p-5 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] transition-all text-left group disabled:opacity-40"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">Sync Tutti</h3>
            <p className="text-[10px] text-text-muted mt-1">Sincronizza tutti i conti collegati</p>
          </button>

          {/* Info */}
          <div className="glass-card p-5 border-dashed">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-bold text-white text-sm">PSD2 Sicuro</h3>
            <p className="text-[10px] text-text-muted mt-1">Le tue credenziali bancarie non passano mai da FinanceFlow</p>
          </div>
        </div>
      )}

      {/* Linked Accounts List */}
      {linkedAccounts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Conti Collegati</h2>
            <span className="text-xs text-text-dim">{linkedAccounts.length} conto/i</span>
          </div>

          <div className="space-y-3">
            {linkedAccounts.map((acc) => (
              <div
                key={acc.goCardlessId}
                className="glass-card p-5 flex items-center justify-between group hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  {acc.bankLogo ? (
                    <img src={acc.bankLogo} alt="" className="w-10 h-10 rounded-lg bg-white p-1 object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-sm">{acc.product || acc.bankName}</h3>
                    <p className="text-[10px] text-text-muted">
                      {acc.iban ? `${acc.iban.slice(0, 4)} •••• ${acc.iban.slice(-4)}` : acc.bankName}
                      {acc.ownerName ? ` · ${acc.ownerName}` : ''}
                    </p>
                    <p className="text-[9px] text-text-dim mt-0.5">
                      Collegato il {new Date(acc.linkedAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sync button */}
                  <button
                    onClick={() => handleSync(acc)}
                    disabled={syncing === acc.goCardlessId}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {syncing === acc.goCardlessId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                    )}
                    {syncing === acc.goCardlessId ? 'Sync...' : 'Sincronizza'}
                  </button>

                  {/* Unlink */}
                  <button
                    onClick={() => handleUnlink(acc.goCardlessId, acc.bankName)}
                    className="p-2 rounded-lg text-text-dim hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className="glass-card p-4 border-emerald-500/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Ultima Sincronizzazione</h3>
            <p className="text-xs text-text-muted">
              <strong className="text-emerald-400">{syncResult.imported}</strong> nuove transazioni importate ·
              {' '}{syncResult.skipped} già presenti ·
              {' '}{syncResult.total} totali dalla banca
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {hasCredentials && linkedAccounts.length === 0 && (
        <div className="text-center py-16">
          <CreditCard className="w-16 h-16 mx-auto text-text-dim mb-4 opacity-20" />
          <h3 className="text-lg font-bold text-white mb-1">Nessun conto collegato</h3>
          <p className="text-sm text-text-muted mb-6">Collega la tua prima banca per iniziare a sincronizzare le transazioni</p>
          <button onClick={handleLoadBanks} className="btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Collega Banca
          </button>
        </div>
      )}

      {/* Not configured empty state */}
      {!hasCredentials && (
        <div className="text-center py-16">
          <Shield className="w-16 h-16 mx-auto text-text-dim mb-4 opacity-20" />
          <h3 className="text-lg font-bold text-white mb-1">Inizia con il Bank Sync</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
            Configura le tue chiavi API GoCardless per collegare i conti bancari e importare automaticamente tutte le transazioni. Gratuito e sicuro grazie al protocollo PSD2 europeo.
          </p>
          <button onClick={() => setStep(STEPS.SETUP)} className="btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center gap-2">
            <Key className="w-4 h-4" />
            Configura API
          </button>
        </div>
      )}
    </div>
  );
}

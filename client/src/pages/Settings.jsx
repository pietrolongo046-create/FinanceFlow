import { useState, useEffect } from 'react';
import { Shield, Key, Download, Upload, Trash2, Info, Eye, EyeOff, Fingerprint, Lock } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({ pinEnabled: false, currency: 'EUR', privacyBlurEnabled: true });
  const [showPwdSetup, setShowPwdSetup] = useState(false);
  const [pwdForm, setPwdForm] = useState({ password: '', confirm: '' });
  const [changePwdForm, setChangePwdForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState(null); // mostrato una sola volta dopo setup

  const load = async () => {
    try {
      const s = await window.api.getSettings();
      setSettings({ privacyBlurEnabled: true, ...s });
    } catch {}
    try {
      const v = await window.api.getAppVersion();
      setAppVersion(v);
    } catch {}
    try {
      const available = await window.api.checkBio();
      setBioAvailable(available);
      if (available) {
        const saved = await window.api.hasBioSaved();
        setBioSaved(saved);
      }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const getStrength = (pwd) => {
    if (!pwd) return { label: '', color: '', pct: 0 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Debole', color: '#f87171', pct: 20 };
    if (score <= 2) return { label: 'Sufficiente', color: '#fbbf24', pct: 40 };
    if (score <= 3) return { label: 'Buona', color: '#60a5fa', pct: 60 };
    if (score <= 4) return { label: 'Forte', color: '#34d399', pct: 80 };
    return { label: 'Eccellente', color: '#34d399', pct: 100 };
  };

  const isPasswordStrong = (pwd) => {
    return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);
  };

  const handleSetupPassword = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong(pwdForm.password)) {
      setMsg('La password deve avere: 8+ caratteri, maiuscole, minuscole e numeri.');
      return;
    }
    if (pwdForm.password !== pwdForm.confirm) {
      setMsg('Le password non corrispondono.');
      return;
    }
    const result = await window.api.setupPin(pwdForm.password);
    await window.api.saveSettings({ ...settings, pinEnabled: true });
    // Cancella biometria vecchia (la nuova password verrà salvata al prossimo sblocco)
    try { await window.api.clearBio(); } catch {}
    setPwdForm({ password: '', confirm: '' });
    setShowPwdSetup(false);
    // Mostra recovery code (una sola volta!)
    if (result && result.recoveryCode) {
      setRecoveryCode(result.recoveryCode);
    }
    setMsg('Password di sicurezza impostata con successo!');
    load();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong(changePwdForm.newPassword)) {
      setMsg('La nuova password deve avere: 8+ caratteri, maiuscole, minuscole e numeri.');
      return;
    }
    if (changePwdForm.newPassword !== changePwdForm.confirm) {
      setMsg('Le nuove password non corrispondono.');
      return;
    }
    const ok = await window.api.changePin(changePwdForm.oldPassword, changePwdForm.newPassword);
    if (!ok) { setMsg('Password attuale non corretta.'); return; }
    // Cancella biometria vecchia
    try { await window.api.clearBio(); } catch {}
    setChangePwdForm({ oldPassword: '', newPassword: '', confirm: '' });
    setShowChangePwd(false);
    setMsg('Password aggiornata! La biometria verrà aggiornata al prossimo sblocco.');
  };

  const handleRemovePassword = async () => {
    const pwd = prompt('Inserisci la password attuale per rimuoverla:');
    if (!pwd) return;
    const ok = await window.api.removePin(pwd);
    if (!ok) { setMsg('Password non corretta.'); return; }
    await window.api.saveSettings({ ...settings, pinEnabled: false });
    try { await window.api.clearBio(); } catch {}
    setMsg('Password di sicurezza rimossa.');
    load();
  };

  const handleExport = async () => {
    const ok = await window.api.exportData();
    if (ok) setMsg('Backup esportato con successo!');
  };

  const handleImport = async () => {
    const ok = await window.api.importData();
    if (ok) { setMsg('Dati importati! Ricarica in corso...'); setTimeout(() => window.location.reload(), 1000); }
  };

  const handleReset = async () => {
    if (!confirm('SEI SICURO? Questo cancellerà TUTTI i dati finanziari. L\'azione è irreversibile.')) return;
    if (!confirm('Ultima conferma: vuoi davvero cancellare tutto?')) return;
    await window.api.resetAllData();
    setMsg('Dati resettati.');
    setTimeout(() => window.location.reload(), 1000);
  };

  const togglePrivacy = async () => {
    const updated = { ...settings, privacyBlurEnabled: !settings.privacyBlurEnabled };
    setSettings(updated);
    await window.api.saveSettings(updated);
    setMsg(updated.privacyBlurEnabled ? 'Protezione privacy attivata' : 'Protezione privacy disattivata');
    window.dispatchEvent(new CustomEvent('ff-privacy-changed', { detail: updated.privacyBlurEnabled }));
  };

  const toggleBio = async () => {
    if (bioSaved) {
      await window.api.clearBio();
      setBioSaved(false);
      setMsg('Biometria rimossa');
    } else {
      setMsg('La biometria verrà salvata al prossimo sblocco con password');
    }
  };

  const strength = getStrength(showPwdSetup ? pwdForm.password : changePwdForm.newPassword);

  const SettingItem = ({ icon: Icon, title, desc, action, danger }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${danger ? 'text-danger' : 'text-primary'}`} />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">{title}</h3>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
      </div>
      {action}
    </div>
  );

  return (
    <div className="animate-slide-up max-w-3xl mx-auto space-y-8">
      {/* Recovery Code Modal — mostrato una sola volta dopo setup password */}
      {recoveryCode && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-[#13141e] border border-primary/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Codice di Recupero</h2>
            <p className="text-text-muted text-xs mb-6">
              Salva questo codice in un luogo sicuro. <strong className="text-danger">Viene mostrato UNA SOLA VOLTA</strong> e ti permetterà di resettare la password in caso di emergenza.
            </p>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6 select-all">
              <p className="font-mono text-lg text-primary tracking-[3px] break-all">{recoveryCode}</p>
            </div>
            <p className="text-[10px] text-text-dim mb-6">32 caratteri · Non sarà più recuperabile</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(recoveryCode);
                setRecoveryCode(null);
                setMsg('Codice copiato! Salvalo in un luogo sicuro.');
              }}
              className="btn-primary w-full justify-center"
            >
              Copia e Chiudi
            </button>
          </div>
        </div>
      )}

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Impostazioni</h1>
        <p className="text-text-muted text-sm">Gestisci sicurezza, dati e preferenze.</p>
      </header>

      {msg && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium flex items-center gap-2">
          <Info className="w-4 h-4" /> {msg}
          <button onClick={() => setMsg('')} className="ml-auto text-text-muted hover:text-white">✕</button>
        </div>
      )}

      {/* Security */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Sicurezza & Privacy</h2>

        <SettingItem
          icon={Shield}
          title="Password di Sicurezza"
          desc={settings.pinEnabled ? 'Attiva — Richiesta all\'apertura dell\'app.' : 'Disattivata — Chiunque può aprire l\'app.'}
          action={
            settings.pinEnabled ? (
              <div className="flex gap-2">
                <button onClick={handleRemovePassword} className="text-xs text-danger hover:text-white border border-danger/20 px-3 py-1.5 rounded-lg transition-all">Rimuovi</button>
              </div>
            ) : (
              <button onClick={() => setShowPwdSetup(true)} className="text-xs font-bold text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all">Attiva</button>
            )
          }
        />

        {showPwdSetup && (
          <form onSubmit={handleSetupPassword} className="glass-card p-5 space-y-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Nuova Password</label>
                <div className="relative">
                  <input 
                    type={showPwd ? 'text' : 'password'} 
                    className="input-field pr-10" 
                    placeholder="Min. 8 caratteri, maiuscole, minuscole, numeri"
                    required 
                    value={pwdForm.password} 
                    onChange={e => setPwdForm({ ...pwdForm, password: e.target.value })} 
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text transition">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {pwdForm.password && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                  <p className="text-[10px] text-right" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Conferma Password</label>
                <input type={showPwd ? 'text' : 'password'} className="input-field" placeholder="Ripeti la password" required value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">Conferma</button>
              <button type="button" onClick={() => { setShowPwdSetup(false); setPwdForm({ password: '', confirm: '' }); }} className="text-xs text-text-muted hover:text-white">Annulla</button>
            </div>
          </form>
        )}

        {settings.pinEnabled && (
          <SettingItem
            icon={Key}
            title="Modifica Password"
            desc="Cambia la password di sicurezza."
            action={<button onClick={() => setShowChangePwd(!showChangePwd)} className="text-xs font-bold text-white hover:underline bg-white/10 px-3 py-1.5 rounded-lg">Cambia</button>}
          />
        )}

        {showChangePwd && (
          <form onSubmit={handleChangePassword} className="glass-card p-5 space-y-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Password Attuale</label>
                <input type="password" className="input-field" required value={changePwdForm.oldPassword} onChange={e => setChangePwdForm({ ...changePwdForm, oldPassword: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Nuova Password</label>
                <input type={showPwd ? 'text' : 'password'} className="input-field" placeholder="Min. 8 caratteri" required value={changePwdForm.newPassword} onChange={e => setChangePwdForm({ ...changePwdForm, newPassword: e.target.value })} />
              </div>
              {changePwdForm.newPassword && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${getStrength(changePwdForm.newPassword).pct}%`, background: getStrength(changePwdForm.newPassword).color }} />
                  </div>
                  <p className="text-[10px] text-right" style={{ color: getStrength(changePwdForm.newPassword).color }}>{getStrength(changePwdForm.newPassword).label}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Conferma Nuova Password</label>
                <input type={showPwd ? 'text' : 'password'} className="input-field" required value={changePwdForm.confirm} onChange={e => setChangePwdForm({ ...changePwdForm, confirm: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-primary text-sm">Aggiorna Password</button>
          </form>
        )}

        <SettingItem
          icon={Eye}
          title="Protezione Privacy"
          desc={settings.privacyBlurEnabled
            ? 'Attiva — Lo schermo si offusca quando cambi app. Dopo 30s richiede la password.'
            : 'Disattivata — Lo schermo rimane visibile quando cambi app.'
          }
          action={
            <button
              onClick={togglePrivacy}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                settings.privacyBlurEnabled ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                settings.privacyBlurEnabled ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          }
        />

      </section>

      {/* Data & Backup */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Dati & Backup</h2>

        <SettingItem
          icon={Download}
          title="Esporta Dati"
          desc="Scarica un backup JSON completo."
          action={<button onClick={handleExport} className="text-xs font-bold text-primary hover:text-white transition-colors">Scarica</button>}
        />

        <SettingItem
          icon={Upload}
          title="Importa Backup"
          desc="Ripristina da un file JSON precedente."
          action={<button onClick={handleImport} className="text-xs font-bold text-primary hover:text-white transition-colors">Importa</button>}
        />

        <SettingItem
          icon={Trash2}
          title="Reset Totale"
          desc="Cancella tutti i dati (conti, transazioni, investimenti, budget)."
          danger={true}
          action={
            <button onClick={handleReset} className="text-xs font-bold text-danger border border-danger/20 hover:bg-danger hover:text-white px-3 py-1.5 rounded-lg transition-all">
              Reset
            </button>
          }
        />
      </section>

      {/* App Info */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">App Info</h2>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-xs text-text-muted">FinanceFlow v{appVersion || '...'} (Electron Desktop)</p>
          <p className="text-[10px] text-text-dim mt-1">Parte dell'ecosistema TechnoJaw — SubTracker · StudyPlan · FinanceFlow</p>
        </div>
      </section>
    </div>
  );
}

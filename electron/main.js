const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const keychainService = require('./services/keychain');
const biometrics = require('./biometrics');

const IS_MAC = process.platform === 'darwin';

// ===== Traduzioni menu automatiche =====
const menuTranslations = {
  it: { about: 'Informazioni su FinanceFlow', hide: 'Nascondi FinanceFlow', hideOthers: 'Nascondi altri', showAll: 'Mostra tutti', quit: 'Esci da FinanceFlow', edit: 'Modifica', undo: 'Annulla', redo: 'Ripeti', cut: 'Taglia', copy: 'Copia', paste: 'Incolla', selectAll: 'Seleziona tutto', view: 'Vista', reload: 'Ricarica', forceReload: 'Ricarica forzata', zoomIn: 'Zoom avanti', zoomOut: 'Zoom indietro', resetZoom: 'Zoom predefinito', fullscreen: 'Schermo intero', window: 'Finestra', minimize: 'Riduci', close: 'Chiudi' },
  en: { about: 'About FinanceFlow', hide: 'Hide FinanceFlow', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit FinanceFlow', edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', view: 'View', reload: 'Reload', forceReload: 'Force Reload', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Actual Size', fullscreen: 'Toggle Full Screen', window: 'Window', minimize: 'Minimize', close: 'Close' },
};
function getMenuT() { const l = (app.getLocale() || 'en').substring(0, 2); return menuTranslations[l] || menuTranslations.en; }

// Force app user model ID
app.setAppUserModelId('com.technojaw.financeflow');

// Data directory
const DATA_DIR = path.join(app.getPath('userData'), 'financeflow-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize data layer
const data = require('./data-layer');
data.init(DATA_DIR);

// Initialize banking service
const bankingService = require('./services/banking');
const { normalizeGoCardlessTransactions, deduplicateTransactions } = require('./services/transaction-adapter');
bankingService.init(DATA_DIR);

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ===== IPC Handlers — all data operations via IPC =====

// Accounts
ipcMain.handle('get-accounts', () => data.getAccounts());
ipcMain.handle('create-account', (_, d) => data.createAccount(d));
ipcMain.handle('update-account', (_, id, d) => data.updateAccount(id, d));
ipcMain.handle('delete-account', (_, id) => data.deleteAccount(id));

// Transactions
ipcMain.handle('get-transactions', (_, filters) => data.getTransactions(filters));
ipcMain.handle('create-transaction', (_, d) => data.createTransaction(d));
ipcMain.handle('update-transaction', (_, id, d) => data.updateTransaction(id, d));
ipcMain.handle('delete-transaction', (_, id) => data.deleteTransaction(id));

// Investments
ipcMain.handle('get-investments', () => data.getInvestments());
ipcMain.handle('create-investment', (_, d) => data.createInvestment(d));
ipcMain.handle('update-investment', (_, id, d) => data.updateInvestment(id, d));
ipcMain.handle('delete-investment', (_, id) => data.deleteInvestment(id));

// Budget
ipcMain.handle('get-budgets', () => data.getBudgets());
ipcMain.handle('create-budget', (_, d) => data.createBudget(d));
ipcMain.handle('update-budget', (_, id, d) => data.updateBudget(id, d));
ipcMain.handle('delete-budget', (_, id) => data.deleteBudget(id));

// Stats / aggregated
ipcMain.handle('get-dashboard-stats', () => data.getDashboardStats());
ipcMain.handle('get-net-worth-history', () => data.getNetWorthHistory());

// Settings
ipcMain.handle('get-settings', () => data.getSettings());
ipcMain.handle('save-settings', (_, d) => data.saveSettings(d));

// Security (PIN)
ipcMain.handle('has-pin', () => data.hasPin());
ipcMain.handle('setup-pin', (_, pin) => data.setupPin(pin));
ipcMain.handle('verify-pin', (_, pin) => data.verifyPin(pin));
ipcMain.handle('change-pin', (_, oldPin, newPin) => data.changePin(oldPin, newPin));
ipcMain.handle('remove-pin', (_, pin) => data.removePin(pin));
ipcMain.handle('recovery-reset', (_, code) => data.resetWithRecovery(code));

// Export / Import
ipcMain.handle('export-data', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Esporta Backup',
    defaultPath: `financeflow-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return null;
  return data.exportData(result.filePath);
});

ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importa Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return data.importData(result.filePaths[0]);
});

ipcMain.handle('reset-all-data', () => data.resetAll());

// Platform
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-is-mac', () => IS_MAC);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:'))) {
    shell.openExternal(url);
  }
});

// Biometrics
ipcMain.handle('bio-check', () => biometrics.isAvailable());
ipcMain.handle('bio-has-saved', () => biometrics.hasSaved());
ipcMain.handle('bio-save', (_, pwd) => biometrics.savePassword(pwd));
ipcMain.handle('bio-login', () => biometrics.retrievePassword());
ipcMain.handle('bio-clear', () => biometrics.clear());

// ===== Bank Sync (GoCardless) =====

// Credentials
ipcMain.handle('bank-has-credentials', () => bankingService.hasCredentials());
ipcMain.handle('bank-get-credentials', () => bankingService.getCredentials());
ipcMain.handle('bank-set-credentials', (_, secretId, secretKey) => bankingService.setCredentials(secretId, secretKey));
ipcMain.handle('bank-remove-credentials', () => bankingService.removeCredentials());

// Banks list
ipcMain.handle('bank-get-list', async (_, country) => {
  try { return { success: true, data: await bankingService.getBanks(country || 'IT') }; }
  catch (e) { return { success: false, error: e.message }; }
});

// Create connection link
ipcMain.handle('bank-connect', async (_, bankId) => {
  try {
    const result = await bankingService.createRequisition(bankId);
    // Open the bank auth page in default browser
    if (result.link) shell.openExternal(result.link);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

// Finalize after user authorises
ipcMain.handle('bank-finalize', async (_, requisitionId, bankName, bankLogo) => {
  try {
    const result = await bankingService.finalizeConnection(requisitionId, bankName, bankLogo);
    return result;
  } catch (e) { return { success: false, error: e.message }; }
});

// Linked accounts
ipcMain.handle('bank-get-linked', () => bankingService.getLinkedAccounts());
ipcMain.handle('bank-unlink', (_, goCardlessId) => bankingService.unlinkAccount(goCardlessId));

// Sync transactions from a linked bank account
ipcMain.handle('bank-sync', async (_, { goCardlessId, accountId, accountName, dateFrom, dateTo }) => {
  try {
    // 1. Fetch raw transactions from GoCardless
    const rawData = await bankingService.getTransactions(goCardlessId, dateFrom, dateTo);

    // 2. Normalize via adapter
    const normalizedTxs = normalizeGoCardlessTransactions(rawData, accountName, accountId);

    // 3. Deduplicate against existing FinanceFlow transactions
    const existingTxs = data.getTransactions();
    const newTxs = deduplicateTransactions(normalizedTxs, existingTxs);

    // 4. Save each new transaction (updates account balance automatically)
    let imported = 0;
    for (const tx of newTxs) {
      data.createTransaction(tx);
      imported++;
    }

    return { success: true, imported, total: normalizedTxs.length, skipped: normalizedTxs.length - imported };
  } catch (e) {
    console.error('Bank sync error:', e);
    return { success: false, error: e.message };
  }
});

// Get balance from GoCardless
ipcMain.handle('bank-get-balance', async (_, goCardlessId) => {
  try {
    const balance = await bankingService.getBalance(goCardlessId);
    return { success: true, balance };
  } catch (e) { return { success: false, error: e.message }; }
});

// Stored requisitions
ipcMain.handle('bank-get-requisitions', () => bankingService.getStoredRequisitions());

// ===== Window =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1000, minHeight: 700,
    title: 'FinanceFlow',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'hidden',
    ...(IS_MAC ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    frame: IS_MAC,
    backgroundColor: '#0c0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false,
    },
    icon: path.join(__dirname, '..', 'build', IS_MAC ? 'financeflow-icon.icns' : 'financeflow-icon.png'),
    show: false,
  });

  // Load the built frontend directly from disk
  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // PRODUCTION HARDENING — DevTools blocked
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // BLOCK new windows / pop-ups
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // BLOCK navigation away from app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });

  // BLOCK drag & drop of external files
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => e.preventDefault());
    `);
  });

  // PRIVACY BLUR — richiede PIN dopo 30s di inattività
  let blurTimer = null;
  let blurTimestamp = 0;
  mainWindow.on('blur', () => {
    blurTimestamp = Date.now();
    // Mostra lo shield visivo
    mainWindow.webContents.send('app-blur', true);
    // Dopo 30s senza tornare, imposta flag per lock
    blurTimer = setTimeout(() => {
      mainWindow._shouldLockOnFocus = true;
    }, 30000);
  });
  mainWindow.on('focus', () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    // Se il blur è durato meno di 3s (es. dialog Touch ID), rimuovi lo shield
    if (Date.now() - blurTimestamp < 3000) {
      mainWindow.webContents.send('app-blur', false);
    }
    // Se la flag è attiva, mostra il lock e resetta la flag
    if (mainWindow._shouldLockOnFocus) {
      mainWindow._shouldLockOnFocus = false;
      mainWindow.webContents.send('app-lock');
    }
  });

  // CLIPBOARD CLEAR — pulisce la clipboard alla chiusura
  mainWindow.on('close', (e) => {
    clipboard.clear();
    if (IS_MAC && !isQuitting) {
      e.preventDefault();
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide(); }, 700);
      } else {
        mainWindow.hide();
      }
    }
  });

  // Block reload shortcuts in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      (input.key === 'r' && (input.meta || input.control)) ||
      (input.key === 'R' && (input.meta || input.control)) ||
      input.key === 'F5'
    ) {
      event.preventDefault();
    }
  });
}

// ===== Window Controls (frameless Win/Linux) =====
ipcMain.on('window-minimize', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });

// ===== Tray =====
function createTray() {
  const trayIconPath = path.join(__dirname, '..', 'build', 'financeflow-tray-16.png');
  const trayIcon2xPath = path.join(__dirname, '..', 'build', 'financeflow-tray-32.png');
  if (!fs.existsSync(trayIconPath)) return;

  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  // Add @2x for Retina
  if (fs.existsSync(trayIcon2xPath)) {
    icon.addRepresentation({ scaleFactor: 2.0, dataURL: nativeImage.createFromPath(trayIcon2xPath).toDataURL() });
  }
  // Color icon — NO template (shows app logo in both light/dark mode)
  tray = new Tray(icon);
  tray.setToolTip('FinanceFlow');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Apri FinanceFlow', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'Esci', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
}

// ===== macOS Menu =====
function buildMenu() {
  const t = getMenuT();
  const template = [
    ...(IS_MAC ? [{
      label: 'FinanceFlow',
      submenu: [
        { role: 'about', label: t.about },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.showAll },
        { type: 'separator' },
        { role: 'quit', label: t.quit },
      ],
    }] : []),
    {
      label: t.edit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: 'zoomIn', label: t.zoomIn },
        { role: 'zoomOut', label: t.zoomOut },
        { role: 'resetZoom', label: t.resetZoom },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.fullscreen },
      ],
    },
    ...(IS_MAC ? [{
      label: t.window,
      submenu: [
        { role: 'minimize', label: t.minimize },
        { role: 'close', label: t.close },
      ],
    }] : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ===== App lifecycle =====
app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(() => {
  // HANDLER PER LA CHIAVE SICURA (Keytar)
  ipcMain.handle('get-secure-key', async () => {
    return await keychainService.getEncryptionKey();
  });

  // PERMISSION LOCKDOWN — deny all hardware/sensor requests
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));

  buildMenu();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (!IS_MAC) app.quit();
});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  else createWindow();
});

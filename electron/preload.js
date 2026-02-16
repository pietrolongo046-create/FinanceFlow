const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Security (Keytar)
  getSecureKey: () => ipcRenderer.invoke('get-secure-key'),
  onBlur: (callback) => ipcRenderer.on('app-blur', (_, val) => callback(val)),
  onLock: (callback) => ipcRenderer.on('app-lock', () => callback()),

  // Biometrics
  checkBio: () => ipcRenderer.invoke('bio-check'),
  hasBioSaved: () => ipcRenderer.invoke('bio-has-saved'),
  saveBio: (pwd) => ipcRenderer.invoke('bio-save', pwd),
  loginBio: () => ipcRenderer.invoke('bio-login'),
  clearBio: () => ipcRenderer.invoke('bio-clear'),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  createAccount: (data) => ipcRenderer.invoke('create-account', data),
  updateAccount: (id, data) => ipcRenderer.invoke('update-account', id, data),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),

  // Transactions
  getTransactions: (filters) => ipcRenderer.invoke('get-transactions', filters),
  createTransaction: (data) => ipcRenderer.invoke('create-transaction', data),
  updateTransaction: (id, data) => ipcRenderer.invoke('update-transaction', id, data),
  deleteTransaction: (id) => ipcRenderer.invoke('delete-transaction', id),

  // Investments
  getInvestments: () => ipcRenderer.invoke('get-investments'),
  createInvestment: (data) => ipcRenderer.invoke('create-investment', data),
  updateInvestment: (id, data) => ipcRenderer.invoke('update-investment', id, data),
  deleteInvestment: (id) => ipcRenderer.invoke('delete-investment', id),

  // Budgets
  getBudgets: () => ipcRenderer.invoke('get-budgets'),
  createBudget: (data) => ipcRenderer.invoke('create-budget', data),
  updateBudget: (id, data) => ipcRenderer.invoke('update-budget', id, data),
  deleteBudget: (id) => ipcRenderer.invoke('delete-budget', id),

  // Stats / Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getNetWorthHistory: () => ipcRenderer.invoke('get-net-worth-history'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // Security (PIN)
  hasPin: () => ipcRenderer.invoke('has-pin'),
  setupPin: (pin) => ipcRenderer.invoke('setup-pin', pin),
  verifyPin: (pin) => ipcRenderer.invoke('verify-pin', pin),
  changePin: (oldPin, newPin) => ipcRenderer.invoke('change-pin', oldPin, newPin),
  removePin: (pin) => ipcRenderer.invoke('remove-pin', pin),
  recoveryReset: (code) => ipcRenderer.invoke('recovery-reset', code),

  // Export / Import
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  resetAllData: () => ipcRenderer.invoke('reset-all-data'),

  // Platform
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Bank Sync (GoCardless)
  bankHasCredentials: () => ipcRenderer.invoke('bank-has-credentials'),
  bankGetCredentials: () => ipcRenderer.invoke('bank-get-credentials'),
  bankSetCredentials: (id, key) => ipcRenderer.invoke('bank-set-credentials', id, key),
  bankRemoveCredentials: () => ipcRenderer.invoke('bank-remove-credentials'),
  bankGetList: (country) => ipcRenderer.invoke('bank-get-list', country),
  bankConnect: (bankId) => ipcRenderer.invoke('bank-connect', bankId),
  bankFinalize: (reqId, bankName, bankLogo) => ipcRenderer.invoke('bank-finalize', reqId, bankName, bankLogo),
  bankGetLinked: () => ipcRenderer.invoke('bank-get-linked'),
  bankUnlink: (goCardlessId) => ipcRenderer.invoke('bank-unlink', goCardlessId),
  bankSync: (opts) => ipcRenderer.invoke('bank-sync', opts),
  bankGetBalance: (goCardlessId) => ipcRenderer.invoke('bank-get-balance', goCardlessId),
  bankGetRequisitions: () => ipcRenderer.invoke('bank-get-requisitions'),

  // Window controls (frameless Win/Linux)
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  isMac: () => ipcRenderer.invoke('get-is-mac'),
});

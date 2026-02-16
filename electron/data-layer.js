/**
 * FinanceFlow Data Layer
 * Pure JSON-file persistence — no database, no server.
 * All data is stored in the user's app data directory.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let DATA_DIR = '';

// ===== Helpers =====
function filePath(name) { return path.join(DATA_DIR, `${name}.json`); }
function readJSON(name, fallback = []) {
  try {
    const p = filePath(name);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return fallback; }
}
function writeJSON(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}
function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

// ===== Init =====
function init(dir) {
  DATA_DIR = dir;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Seed default accounts if first run
  if (!fs.existsSync(filePath('accounts'))) {
    writeJSON('accounts', []);
  }

  // Seed transactions if first run
  if (!fs.existsSync(filePath('transactions'))) {
    writeJSON('transactions', []);
  }

  // Seed investments if first run
  if (!fs.existsSync(filePath('investments'))) {
    writeJSON('investments', []);
  }

  // Seed budgets if first run
  if (!fs.existsSync(filePath('budgets'))) {
    writeJSON('budgets', []);
  }

  // Settings
  if (!fs.existsSync(filePath('settings'))) {
    writeJSON('settings', { currency: 'EUR', pinEnabled: false, theme: 'dark' });
  }
}

// ===== Accounts CRUD =====
function getAccounts() { return readJSON('accounts'); }

function createAccount(d) {
  const accounts = readJSON('accounts');
  const account = { id: uuid(), ...d, createdAt: now() };
  accounts.push(account);
  writeJSON('accounts', accounts);
  return account;
}

function updateAccount(id, d) {
  const accounts = readJSON('accounts');
  const idx = accounts.findIndex(a => a.id === id);
  if (idx < 0) return null;
  accounts[idx] = { ...accounts[idx], ...d, updatedAt: now() };
  writeJSON('accounts', accounts);
  return accounts[idx];
}

function deleteAccount(id) {
  let accounts = readJSON('accounts');
  accounts = accounts.filter(a => a.id !== id);
  writeJSON('accounts', accounts);
  return true;
}

// ===== Transactions CRUD =====
function getTransactions(filters) {
  let txs = readJSON('transactions');
  // Sort by date descending
  txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filters) {
    if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.type === filters.type);
    if (filters.accountId) txs = txs.filter(t => t.accountId === filters.accountId);
    if (filters.category) txs = txs.filter(t => t.category === filters.category);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      txs = txs.filter(t => t.title.toLowerCase().includes(s) || (t.category || '').toLowerCase().includes(s));
    }
    if (filters.limit) txs = txs.slice(0, filters.limit);
  }
  return txs;
}

function createTransaction(d) {
  const txs = readJSON('transactions');
  const tx = { id: uuid(), ...d, date: d.date || now().slice(0, 10), createdAt: now() };
  txs.push(tx);
  writeJSON('transactions', txs);

  // Update account balance
  if (d.accountId && d.amount) {
    const accounts = readJSON('accounts');
    const acc = accounts.find(a => a.id === d.accountId);
    if (acc) {
      acc.balance = (acc.balance || 0) + d.amount;
      writeJSON('accounts', accounts);
    }
  }

  return tx;
}

function updateTransaction(id, d) {
  const txs = readJSON('transactions');
  const idx = txs.findIndex(t => t.id === id);
  if (idx < 0) return null;

  // Reverse old amount from account, apply new
  const old = txs[idx];
  if (old.accountId && old.amount) {
    const accounts = readJSON('accounts');
    const acc = accounts.find(a => a.id === old.accountId);
    if (acc) {
      acc.balance = (acc.balance || 0) - old.amount;
      if (d.amount !== undefined) acc.balance += (d.amount || 0);
      else acc.balance += old.amount;
      writeJSON('accounts', accounts);
    }
  }

  txs[idx] = { ...txs[idx], ...d, updatedAt: now() };
  writeJSON('transactions', txs);
  return txs[idx];
}

function deleteTransaction(id) {
  let txs = readJSON('transactions');
  const tx = txs.find(t => t.id === id);
  if (tx && tx.accountId && tx.amount) {
    const accounts = readJSON('accounts');
    const acc = accounts.find(a => a.id === tx.accountId);
    if (acc) {
      acc.balance = (acc.balance || 0) - tx.amount;
      writeJSON('accounts', accounts);
    }
  }
  txs = txs.filter(t => t.id !== id);
  writeJSON('transactions', txs);
  return true;
}

// ===== Investments CRUD =====
function getInvestments() { return readJSON('investments'); }

function createInvestment(d) {
  const items = readJSON('investments');
  const inv = { id: uuid(), ...d, createdAt: now() };
  items.push(inv);
  writeJSON('investments', items);
  return inv;
}

function updateInvestment(id, d) {
  const items = readJSON('investments');
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...d, updatedAt: now() };
  writeJSON('investments', items);
  return items[idx];
}

function deleteInvestment(id) {
  let items = readJSON('investments');
  items = items.filter(i => i.id !== id);
  writeJSON('investments', items);
  return true;
}

// ===== Budgets CRUD =====
function getBudgets() { return readJSON('budgets'); }

function createBudget(d) {
  const items = readJSON('budgets');
  const b = { id: uuid(), ...d, createdAt: now() };
  items.push(b);
  writeJSON('budgets', items);
  return b;
}

function updateBudget(id, d) {
  const items = readJSON('budgets');
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...d, updatedAt: now() };
  writeJSON('budgets', items);
  return items[idx];
}

function deleteBudget(id) {
  let items = readJSON('budgets');
  items = items.filter(i => i.id !== id);
  writeJSON('budgets', items);
  return true;
}

// ===== Dashboard Stats =====
function getDashboardStats() {
  const accounts = readJSON('accounts');
  const txs = readJSON('transactions');
  const investments = readJSON('investments');

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const investmentValue = investments.reduce((s, i) => s + (i.currentPrice || 0) * (i.qty || 0), 0);
  const netWorth = totalBalance + investmentValue;

  // Current month income/expense
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

  const thisMonthTxs = txs.filter(t => (t.date || '').startsWith(thisMonth));
  const lastMonthTxs = txs.filter(t => (t.date || '').startsWith(lastMonth));

  const income = thisMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const expense = thisMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const prevIncome = lastMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const prevExpense = lastMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome * 100).toFixed(1) : 0;
  const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense * 100).toFixed(1) : 0;

  // Allocation breakdown
  const liquid = accounts.filter(a => a.type === 'bank' || a.type === 'wallet').reduce((s, a) => s + (a.balance || 0), 0);
  const stocksEtf = investments.filter(i => i.type === 'Stock' || i.type === 'ETF').reduce((s, i) => s + (i.currentPrice || 0) * (i.qty || 0), 0);
  const cryptoValue = investments.filter(i => i.type === 'Crypto').reduce((s, i) => s + (i.currentPrice || 0) * (i.qty || 0), 0);

  return {
    netWorth, totalBalance, investmentValue,
    income, expense,
    incomeChange: Number(incomeChange),
    expenseChange: Number(expenseChange),
    allocation: [
      { name: 'Liquidità', value: liquid, color: '#34d399' },
      { name: 'Azioni/ETF', value: stocksEtf, color: '#f4f4f5' },
      { name: 'Crypto', value: cryptoValue, color: '#f97316' },
    ],
    accountCount: accounts.length,
  };
}

function getNetWorthHistory() {
  // Return empty history — real data accumulates as user adds transactions
  const txs = readJSON('transactions');
  if (!txs.length) return [];

  // Group transactions by month and build cumulative history
  const accounts = readJSON('accounts');
  const investments = readJSON('investments');

  const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const months = {};

  for (const tx of sorted) {
    const month = (tx.date || '').slice(0, 7); // YYYY-MM
    if (!month) continue;
    if (!months[month]) months[month] = { income: 0, expense: 0 };
    if (tx.type === 'income') months[month].income += Math.abs(tx.amount || 0);
    if (tx.type === 'expense') months[month].expense += Math.abs(tx.amount || 0);
  }

  const liquid = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const invest = investments.reduce((s, i) => s + (i.currentPrice || 0) * (i.qty || 0), 0);

  const monthNames = { '01': 'Gen', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mag', '06': 'Giu', '07': 'Lug', '08': 'Ago', '09': 'Set', '10': 'Ott', '11': 'Nov', '12': 'Dic' };

  return Object.keys(months).sort().slice(-6).map(m => ({
    name: monthNames[m.slice(5)] || m.slice(5),
    liquid: Math.max(0, liquid),
    invest: Math.max(0, invest),
  }));
}

// ===== Settings =====
function getSettings() { return readJSON('settings', { currency: 'EUR', pinEnabled: false, theme: 'dark' }); }
function saveSettings(d) {
  const settings = { ...getSettings(), ...d };
  writeJSON('settings', settings);
  return settings;
}

// ===== PIN Security =====
// UPGRADED: da PIN 4 cifre a Master Password sicura (PBKDF2 + salt)
function hashPassword(password) {
  // Se esiste già un salt, leggi e usa quello
  const settings = getSettings();
  let salt;
  if (settings.passwordSalt) {
    salt = Buffer.from(settings.passwordSalt, 'hex');
  } else {
    salt = require('crypto').randomBytes(32);
  }
  const hash = require('crypto').pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  return { hash: hash.toString('hex'), salt: salt.toString('hex') };
}

function hasPin() {
  const settings = getSettings();
  return !!(settings.pinEnabled && (settings.passwordHash || settings.pinHash));
}

function setupPin(password) {
  const settings = getSettings();
  const { hash, salt } = hashPassword(password);
  settings.pinEnabled = true;
  settings.passwordHash = hash;
  settings.passwordSalt = salt;
  // Rimuovi il vecchio pinHash se esiste
  delete settings.pinHash;

  // Genera codice di recupero 32 caratteri (one-time, mostrato una sola volta)
  const recoveryCode = require('crypto').randomBytes(16).toString('hex').toUpperCase(); // 32 chars
  const recoverySalt = require('crypto').randomBytes(32);
  const recoveryHash = require('crypto').pbkdf2Sync(recoveryCode, recoverySalt, 100000, 64, 'sha512');
  settings.recoveryHash = recoveryHash.toString('hex');
  settings.recoverySalt = recoverySalt.toString('hex');

  writeJSON('settings', settings);
  return { success: true, recoveryCode };
}

function verifyPin(password) {
  const settings = getSettings();
  
  // Nuovo formato: password con PBKDF2
  if (settings.passwordHash && settings.passwordSalt) {
    const salt = Buffer.from(settings.passwordSalt, 'hex');
    const hash = require('crypto').pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return hash.toString('hex') === settings.passwordHash;
  }
  
  // Legacy: vecchio PIN con SHA-256 (migrazione)
  if (settings.pinHash) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    if (legacyHash === settings.pinHash) {
      // Migra automaticamente al nuovo formato
      setupPin(password);
      return true;
    }
    return false;
  }
  
  return false;
}

function changePin(oldPassword, newPassword) {
  if (!verifyPin(oldPassword)) return false;
  const settings = getSettings();
  const newSalt = require('crypto').randomBytes(32);
  const hash = require('crypto').pbkdf2Sync(newPassword, newSalt, 100000, 64, 'sha512');
  settings.passwordHash = hash.toString('hex');
  settings.passwordSalt = newSalt.toString('hex');
  delete settings.pinHash;
  writeJSON('settings', settings);
  return true;
}

function removePin(password) {
  if (!verifyPin(password)) return false;
  const settings = getSettings();
  settings.pinEnabled = false;
  delete settings.passwordHash;
  delete settings.passwordSalt;
  delete settings.pinHash;
  delete settings.recoveryHash;
  delete settings.recoverySalt;
  writeJSON('settings', settings);
  return true;
}

// Recovery code verification — resets password if valid
function verifyRecoveryCode(code) {
  const settings = getSettings();
  if (!settings.recoveryHash || !settings.recoverySalt) return false;
  const salt = Buffer.from(settings.recoverySalt, 'hex');
  const hash = require('crypto').pbkdf2Sync(code.toUpperCase(), salt, 100000, 64, 'sha512');
  return hash.toString('hex') === settings.recoveryHash;
}

function resetWithRecovery(code) {
  if (!verifyRecoveryCode(code)) return { success: false, error: 'Codice non valido' };
  const settings = getSettings();
  settings.pinEnabled = false;
  delete settings.passwordHash;
  delete settings.passwordSalt;
  delete settings.pinHash;
  delete settings.recoveryHash;
  delete settings.recoverySalt;
  writeJSON('settings', settings);
  return { success: true };
}

// ===== Export / Import =====
function exportData(filepath) {
  const data = {
    accounts: readJSON('accounts'),
    transactions: readJSON('transactions'),
    investments: readJSON('investments'),
    budgets: readJSON('budgets'),
    settings: readJSON('settings', {}),
    exportDate: now(),
    version: '1.0.0',
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

function importData(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.accounts) writeJSON('accounts', data.accounts);
    if (data.transactions) writeJSON('transactions', data.transactions);
    if (data.investments) writeJSON('investments', data.investments);
    if (data.budgets) writeJSON('budgets', data.budgets);
    if (data.settings) writeJSON('settings', data.settings);
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

function resetAll() {
  ['accounts', 'transactions', 'investments', 'budgets'].forEach(name => {
    const p = filePath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  // Re-initialize with defaults
  init(DATA_DIR);
  return true;
}

module.exports = {
  init,
  getAccounts, createAccount, updateAccount, deleteAccount,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getInvestments, createInvestment, updateInvestment, deleteInvestment,
  getBudgets, createBudget, updateBudget, deleteBudget,
  getDashboardStats, getNetWorthHistory,
  getSettings, saveSettings,
  hasPin, setupPin, verifyPin, changePin, removePin,
  verifyRecoveryCode, resetWithRecovery,
  exportData, importData, resetAll,
};

/**
 * FinanceFlow — GoCardless (ex Nordigen) Banking Service
 * PSD2 Open Banking aggregator for automatic bank sync.
 *
 * How it works:
 * 1. User enters API keys in Settings → Bank Sync
 * 2. User picks a bank (Intesa, Revolut, N26…)
 * 3. GoCardless opens the bank's login page → user authorises
 * 4. We receive an account ID and can pull transactions/balances
 *
 * Docs: https://developer.gocardless.com/bank-account-data/overview
 */
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

class BankingService {
  constructor() {
    this.baseUrl = 'https://bankaccountdata.gocardless.com/api/v2';
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.dataDir = '';
  }

  /* ───── Init ───── */
  init(dataDir) {
    this.dataDir = dataDir;
    // Load stored credentials + linked accounts
    this._loadConfig();
  }

  /* ───── Config persistence ───── */
  _configPath() { return path.join(this.dataDir, 'banking-config.json'); }

  _loadConfig() {
    try {
      if (fs.existsSync(this._configPath())) {
        this._config = JSON.parse(fs.readFileSync(this._configPath(), 'utf-8'));
      } else {
        this._config = { secretId: '', secretKey: '', linkedAccounts: [], requisitions: [] };
      }
    } catch {
      this._config = { secretId: '', secretKey: '', linkedAccounts: [], requisitions: [] };
    }
  }

  _saveConfig() {
    fs.writeFileSync(this._configPath(), JSON.stringify(this._config, null, 2), 'utf-8');
  }

  /* ───── Credentials ───── */
  hasCredentials() {
    return !!(this._config.secretId && this._config.secretKey);
  }

  getCredentials() {
    return { secretId: this._config.secretId || '', secretKey: this._config.secretKey || '' };
  }

  setCredentials(secretId, secretKey) {
    this._config.secretId = secretId;
    this._config.secretKey = secretKey;
    this.accessToken = null; // force re-auth
    this._saveConfig();
    return true;
  }

  removeCredentials() {
    this._config.secretId = '';
    this._config.secretKey = '';
    this._config.linkedAccounts = [];
    this._config.requisitions = [];
    this.accessToken = null;
    this._saveConfig();
    return true;
  }

  /* ───── Auth Token ───── */
  async _getToken() {
    // Reuse if still valid (24h lifetime)
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.hasCredentials()) {
      throw new Error('GoCardless API keys non configurate.');
    }

    const resp = await fetch(`${this.baseUrl}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_id: this._config.secretId,
        secret_key: this._config.secretKey,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Auth fallita: ${resp.status} — ${err}`);
    }

    const data = await resp.json();
    this.accessToken = data.access;
    // Token lasts ~24h — refresh 1h early
    this.tokenExpiry = Date.now() + (data.access_expires - 3600) * 1000;
    return this.accessToken;
  }

  async _authHeaders() {
    const token = await this._getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /* ───── Banks List ───── */
  async getBanks(country = 'IT') {
    const headers = await this._authHeaders();
    const resp = await fetch(`${this.baseUrl}/institutions/?country=${country}`, { headers });
    if (!resp.ok) throw new Error(`Errore lista banche: ${resp.status}`);
    const banks = await resp.json();

    // Return clean list
    return banks.map(b => ({
      id: b.id,
      name: b.name,
      logo: b.logo,
      countries: b.countries,
      maxHistoryDays: b.transaction_total_days || 90,
    }));
  }

  /* ───── Requisition (Bank Connection Link) ───── */
  async createRequisition(bankId) {
    const headers = await this._authHeaders();

    // Redirect URL — GoCardless needs one, but in Electron we intercept it
    // We use a custom scheme that the app will catch
    const redirectUrl = 'https://financeflow.app/bank-callback';

    const resp = await fetch(`${this.baseUrl}/requisitions/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        redirect: redirectUrl,
        institution_id: bankId,
        user_language: 'IT',
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Errore creazione requisition: ${resp.status} — ${err}`);
    }

    const data = await resp.json();

    // Store requisition for later use
    this._config.requisitions.push({
      id: data.id,
      bankId,
      link: data.link,
      status: data.status,
      createdAt: new Date().toISOString(),
    });
    this._saveConfig();

    return {
      requisitionId: data.id,
      link: data.link,
      status: data.status,
    };
  }

  /* ───── Check Requisition Status & Get Accounts ───── */
  async getRequisitionStatus(requisitionId) {
    const headers = await this._authHeaders();
    const resp = await fetch(`${this.baseUrl}/requisitions/${requisitionId}/`, { headers });
    if (!resp.ok) throw new Error(`Errore check requisition: ${resp.status}`);
    return await resp.json();
  }

  async finalizeConnection(requisitionId, bankName, bankLogo) {
    const reqData = await this.getRequisitionStatus(requisitionId);

    if (reqData.status !== 'LN') {
      return { success: false, status: reqData.status, message: 'Autorizzazione non completata.' };
    }

    // GoCardless returns account IDs linked to this requisition
    const accountIds = reqData.accounts || [];
    if (!accountIds.length) {
      return { success: false, message: 'Nessun conto trovato.' };
    }

    // For each account, get details
    const linkedAccounts = [];
    for (const accId of accountIds) {
      try {
        const headers = await this._authHeaders();
        const detailResp = await fetch(`${this.baseUrl}/accounts/${accId}/details/`, { headers });
        const details = detailResp.ok ? await detailResp.json() : {};
        const accDetail = details.account || {};

        linkedAccounts.push({
          goCardlessId: accId,
          requisitionId,
          bankName,
          bankLogo,
          iban: accDetail.iban || '',
          ownerName: accDetail.ownerName || '',
          currency: accDetail.currency || 'EUR',
          product: accDetail.product || bankName,
          linkedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`Errore dettagli account ${accId}:`, e.message);
      }
    }

    // Merge with existing linked accounts (avoid duplicates)
    for (const acc of linkedAccounts) {
      const existing = this._config.linkedAccounts.findIndex(a => a.goCardlessId === acc.goCardlessId);
      if (existing >= 0) {
        this._config.linkedAccounts[existing] = acc;
      } else {
        this._config.linkedAccounts.push(acc);
      }
    }
    this._saveConfig();

    return { success: true, accounts: linkedAccounts };
  }

  /* ───── Linked Accounts ───── */
  getLinkedAccounts() {
    return this._config.linkedAccounts || [];
  }

  unlinkAccount(goCardlessId) {
    this._config.linkedAccounts = (this._config.linkedAccounts || []).filter(a => a.goCardlessId !== goCardlessId);
    this._saveConfig();
    return true;
  }

  /* ───── Transactions ───── */
  async getTransactions(goCardlessAccountId, dateFrom, dateTo) {
    const headers = await this._authHeaders();

    let url = `${this.baseUrl}/accounts/${goCardlessAccountId}/transactions/`;
    const params = [];
    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);
    if (params.length) url += `?${params.join('&')}`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Errore transazioni: ${resp.status}`);
    return await resp.json();
  }

  /* ───── Balance ───── */
  async getBalance(goCardlessAccountId) {
    const headers = await this._authHeaders();
    const resp = await fetch(`${this.baseUrl}/accounts/${goCardlessAccountId}/balances/`, { headers });
    if (!resp.ok) throw new Error(`Errore saldo: ${resp.status}`);
    const data = await resp.json();
    // Usually returns { balances: [{ balanceAmount: { amount, currency }, balanceType }] }
    const balances = data.balances || [];
    const main = balances.find(b => b.balanceType === 'interimAvailable' || b.balanceType === 'expected') || balances[0];
    return main ? parseFloat(main.balanceAmount.amount) : 0;
  }

  /* ───── Requisitions list ───── */
  getStoredRequisitions() {
    return this._config.requisitions || [];
  }
}

module.exports = new BankingService();

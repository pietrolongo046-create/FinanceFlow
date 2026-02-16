/**
 * FinanceFlow — Transaction Adapter
 * Converts raw GoCardless bank data into clean FinanceFlow transactions.
 *
 * Handles:
 * 1. Title cleanup (removes POS/SEPA/SDD prefixes, long IDs)
 * 2. Auto-categorization via keyword matching
 * 3. Standardization to FinanceFlow { id, title, amount, type, category, date } format
 */
const crypto = require('crypto');

// ───── Category Detection Rules ─────
const CATEGORY_RULES = {
  'Spesa': [
    'esselunga', 'carrefour', 'lidl', 'coop', 'conad', 'iper', 'supermercato',
    'market', 'pam', 'eurospin', 'penny', 'despar', 'md discount', 'aldi',
    'simply', 'bennet', 'todis', 'tigre', 'famila',
  ],
  'Ristorazione': [
    'mcdonald', 'burger king', 'starbucks', 'ristorante', 'pizzeria', 'bar ',
    'cafe', 'caffè', 'delivery', 'glovo', 'uber eats', 'just eat', 'deliveroo',
    'trattoria', 'osteria', 'sushi', 'kebab', 'panino',
  ],
  'Trasporti': [
    'uber', 'taxi', 'trenitalia', 'italo', 'atm', 'q8', 'eni', 'esso',
    'tamoil', 'autostrade', 'telepass', 'ip ', 'total', 'shell', 'flixbus',
    'ryanair', 'easyjet', 'alitalia', 'itaairways', 'benzina', 'carburante',
    'diesel', 'parcheggio', 'parking', 'car2go', 'enjoy', 'lime', 'bird',
  ],
  'Abbonamenti': [
    'netflix', 'spotify', 'apple.com', 'google ', 'amazon prime', 'disney',
    'adobe', 'chatgpt', 'openai', 'microsoft', 'dazn', 'tim', 'vodafone',
    'wind', 'fastweb', 'iliad', 'sky', 'now tv', 'crunchyroll', 'youtube',
    'twitch', 'icloud', 'dropbox', 'notion', 'figma',
  ],
  'Shopping': [
    'amazon', 'zalando', 'shein', 'nike', 'zara', 'h&m', 'ikea',
    'leroy merlin', 'mediaworld', 'unieuro', 'decathlon', 'primark',
    'ovs', 'uniqlo', 'asos', 'ebay', 'aliexpress', 'wish',
  ],
  'Lavoro': [
    'stipendio', 'emolumenti', 'bonifico a vostro favore', 'salary', 'payroll',
    'cedolino', 'compenso', 'accredito', 'retribuzione', 'freelance', 'fattura',
  ],
  'Casa': [
    'affitto', 'condominio', 'enel', 'a2a', 'iren', 'edison', 'bolletta',
    'luce', 'gas', 'acqua', 'hera', 'acea', 'sorgenia', 'eni gas', 'mutuo',
  ],
  'Salute': [
    'farmacia', 'dottore', 'medico', 'ospedale', 'dentista', 'parafarmacia',
    'clinic', 'sanitaria', 'visita', 'analisi', 'laboratorio', 'ottico',
  ],
  'Finanza': [
    'paypal', 'satispay', 'revolut', 'trade republic', 'coinbase', 'binance',
    'prelievo', 'atm', 'bancomat', 'commissione', 'interessi', 'bollo',
  ],
  'Istruzione': [
    'università', 'universita', 'scuola', 'corso', 'udemy', 'coursera',
    'masterclass', 'skillshare', 'libri', 'libreria', 'feltrinelli', 'mondadori',
  ],
};

/**
 * Clean a raw bank transaction title
 */
function cleanTitle(rawTitle) {
  if (!rawTitle) return 'Transazione Sconosciuta';

  let clean = rawTitle
    // Remove common banking prefixes
    .replace(/\bSDD\s*CORE\b/gi, '')
    .replace(/\bSEPA\b/gi, '')
    .replace(/\bPOS\b/gi, '')
    .replace(/\bPAGAMENTO\b/gi, '')
    .replace(/\bBONIFICO\b/gi, '')
    .replace(/\bADDEBITO\b/gi, '')
    .replace(/\bACCREDITO\b/gi, '')
    .replace(/\bGIROCONTO\b/gi, '')
    .replace(/\bDISP\.\s*N\.\s*/gi, '')
    .replace(/\bRIF\.\s*/gi, '')
    .replace(/\bCRO\s*/gi, '')
    .replace(/\bVS\.\s*/gi, '')
    // Remove long numbers (transaction IDs, card numbers)
    .replace(/[0-9]{8,}/g, '')
    // Remove date patterns like 01/02/2026
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
    .replace(/\d{2}\.\d{2}\.\d{4}/g, '')
    // Remove card trailing patterns
    .replace(/\*{4}\d{4}/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-\/]+/, '')
    .replace(/[\s\-\/]+$/, '')
    .trim();

  if (!clean) return 'Transazione Sconosciuta';

  // Capitalize first letter of each significant word
  return clean
    .split(' ')
    .map(word => {
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Auto-detect category from transaction text
 */
function detectCategory(text) {
  const lower = (text || '').toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'Altro';
}

/**
 * MAIN FUNCTION — Convert raw GoCardless response to FinanceFlow format
 *
 * @param {Object} apiResponse  — Raw GoCardless /transactions/ response
 * @param {String} accountName  — Name of the FinanceFlow account (e.g. "Intesa Sanpaolo")
 * @param {String} accountId    — FinanceFlow account ID to link transactions to
 * @returns {Array} Clean FinanceFlow transaction objects
 */
function normalizeGoCardlessTransactions(apiResponse, accountName, accountId) {
  // GoCardless returns { transactions: { booked: [...], pending: [...] } }
  const booked = apiResponse?.transactions?.booked || [];

  return booked.map(tx => {
    // 1. Extract raw data — GoCardless field names vary per bank
    const rawAmount = parseFloat(tx.transactionAmount?.amount || 0);
    const rawDescription =
      tx.remittanceInformationUnstructured ||
      tx.remittanceInformationUnstructuredArray?.join(' ') ||
      tx.creditorName ||
      tx.debtorName ||
      tx.additionalInformation ||
      'Movimento';

    // 2. Clean & categorize
    const title = cleanTitle(rawDescription);
    const category = detectCategory(rawDescription);
    const type = rawAmount >= 0 ? 'income' : 'expense';
    const date = tx.bookingDate || tx.valueDate || new Date().toISOString().slice(0, 10);

    // 3. Build FinanceFlow-standard object
    return {
      id: tx.transactionId || tx.internalTransactionId || `gc_${crypto.randomUUID().slice(0, 8)}`,
      title,
      date,
      amount: rawAmount, // negative for expenses
      type,
      category,
      accountId: accountId || null,
      account: accountName,
      source: 'bank-sync', // marks as auto-imported
      bankRef: tx.transactionId || null,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Deduplicate — avoid importing the same bank transaction twice.
 * Uses bankRef (GoCardless transactionId) as unique key.
 *
 * @param {Array} newTxs      — freshly normalized transactions from the bank
 * @param {Array} existingTxs — already stored FinanceFlow transactions
 * @returns {Array} only truly new transactions
 */
function deduplicateTransactions(newTxs, existingTxs) {
  const existingRefs = new Set(
    existingTxs
      .filter(t => t.bankRef)
      .map(t => t.bankRef)
  );

  // Also match by exact amount+date+title for manual-entry dedup
  const existingKeys = new Set(
    existingTxs.map(t => `${t.date}|${t.amount}|${(t.title || '').toLowerCase().slice(0, 20)}`)
  );

  return newTxs.filter(tx => {
    // Skip if we already have this bank reference
    if (tx.bankRef && existingRefs.has(tx.bankRef)) return false;

    // Skip if we have a suspiciously similar manual entry
    const key = `${tx.date}|${tx.amount}|${(tx.title || '').toLowerCase().slice(0, 20)}`;
    if (existingKeys.has(key)) return false;

    return true;
  });
}

module.exports = {
  normalizeGoCardlessTransactions,
  deduplicateTransactions,
  cleanTitle,
  detectCategory,
};

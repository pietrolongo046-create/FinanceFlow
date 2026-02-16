const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');

// Key stored locally — no more Keychain popup
const KEY_FILE = path.join(app.getPath('userData'), '.financeflow_key');
const APP_SALT = 'FinanceFlow_Vault_v1_2026';

function getHardwareId() {
  try {
    if (process.platform === 'darwin') {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    if (process.platform === 'win32') {
      const out = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
      const lines = out.trim().split('\n');
      if (lines[1]) return lines[1].trim();
    }
  } catch {}
  return os.hostname() + os.cpus()[0]?.model + os.totalmem();
}

let _machineKey = null;
function getMachineKey() {
  if (_machineKey) return _machineKey;
  const hwid = getHardwareId();
  const info = hwid + os.userInfo().username + os.homedir();
  _machineKey = crypto.pbkdf2Sync(info, APP_SALT, 100000, 32, 'sha512');
  return _machineKey;
}

function saveKeyToFile(key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getMachineKey(), iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  fs.writeFileSync(KEY_FILE, JSON.stringify({ iv: iv.toString('hex'), data: encrypted }), 'utf8');
}

module.exports = {
  async getEncryptionKey() {
    try {
      // 1) Try local file first
      if (fs.existsSync(KEY_FILE)) {
        const raw = fs.readFileSync(KEY_FILE, 'utf8');
        const { iv, data } = JSON.parse(raw);
        const decipher = crypto.createDecipheriv('aes-256-cbc', getMachineKey(), Buffer.from(iv, 'hex'));
        let key = decipher.update(data, 'hex', 'utf8');
        key += decipher.final('utf8');
        return key;
      }

      // 2) Migrate from old Keytar if data exists
      const dataDir = app.getPath('userData');
      const hasData = fs.readdirSync(dataDir).some(f => f.endsWith('.enc') || f.endsWith('.json'));
      if (hasData) {
        try {
          const keytar = require('keytar');
          const oldKey = await keytar.getPassword('FinanceFlow_Secure', os.userInfo().username);
          if (oldKey) {
            saveKeyToFile(oldKey);
            try { await keytar.deletePassword('FinanceFlow_Secure', os.userInfo().username); } catch {}
            console.log('Migrated encryption key from Keychain to local file');
            return oldKey;
          }
        } catch {}
      }

      // 3) First run — generate new key
      const key = crypto.randomBytes(32).toString('hex');
      saveKeyToFile(key);
      return key;
    } catch (error) {
      console.error('Errore chiave crittografia:', error);
      return 'FALLBACK_KEY_EMERGENCY_ONLY_CHANGE_ME';
    }
  }
};

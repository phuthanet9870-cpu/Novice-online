// Tiny JSON-file database with atomic saves. Swap for PostgreSQL later; API stays the same.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.NO_DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
const AUDIT = path.join(DIR, 'gm_audit.log');

const db = {
  data: { accounts: {}, chars: {}, guilds: {}, castles: {}, nextId: 1, ipBans: [], settings: { exp: 1, drop: 1, refine: 1 }, worldBossLog: [] },
  dirty: false,
  load() {
    fs.mkdirSync(DIR, { recursive: true });
    if (fs.existsSync(FILE)) {
      try { Object.assign(this.data, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) { console.error('DB load failed', e); }
    }
    return this;
  },
  save() {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, FILE);
    this.dirty = false;
  },
  nextId() { return this.data.nextId++; },
  hashPass(pass, salt) { return crypto.scryptSync(pass, salt, 32).toString('hex'); },
  createAccount(user, pass) {
    const key = user.toLowerCase();
    if (this.data.accounts[key]) return null;
    const salt = crypto.randomBytes(12).toString('hex');
    const first = Object.keys(this.data.accounts).length === 0;
    const gmEnv = (process.env.GM_USERS || '').toLowerCase().split(',').map((s) => s.trim());
    const acc = { user, salt, hash: this.hashPass(pass, salt), gm: first || gmEnv.includes(key) ? 5 : 0, chars: [], banned: 0, created: Date.now() };
    this.data.accounts[key] = acc; this.dirty = true;
    return acc;
  },
  checkLogin(user, pass) {
    const acc = this.data.accounts[user.toLowerCase()];
    if (!acc) return null;
    const h = this.hashPass(pass, acc.salt);
    if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(acc.hash, 'hex'))) return null;
    return acc;
  },
  account(user) { return this.data.accounts[String(user).toLowerCase()]; },
  charByName(name) {
    const n = String(name).toLowerCase();
    for (const id in this.data.chars) if (this.data.chars[id].name.toLowerCase() === n) return this.data.chars[id];
    return null;
  },
  audit(gmName, cmd, result) {
    const line = `${new Date().toISOString()}\t${gmName}\t${cmd}\t${String(result).replace(/\n/g, ' | ').slice(0, 300)}\n`;
    fs.appendFile(AUDIT, line, () => {});
  }
};
module.exports = db;

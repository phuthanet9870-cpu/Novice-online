// Builds a single self-contained HTML page (dist/novice-online.html) that runs the whole game in the browser:
// the authoritative server runs in-page (modules wrapped with small Node shims) and the client talks to it
// through an in-memory WebSocket. Saves go to localStorage.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const html = read('client/index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src='));
const css = read('client/style.css');
const shared = ['shared/rng.js', 'shared/data.js', 'shared/data2.js', 'shared/itemdb.js', 'shared/formulas.js', 'shared/mapgen.js', 'shared/skills.js', 'shared/passives.js'];
const client = ['client/js/vfx.js', 'client/js/sfx.js', 'client/js/bossart.js', 'client/js/art.js', 'client/js/pixicons.js', 'client/js/game.js', 'client/js/ui.js', 'client/js/ui2.js', 'client/js/ui3.js', 'client/js/ui4.js', 'client/js/ui5.js'];
const serverMods = ['world', 'combat', 'items', 'auto', 'social', 'progress', 'econ', 'gm', 'index'];

const browserDb = `
const KEY = 'novice_online_db_v1';
const db = {
  data: { accounts: {}, chars: {}, guilds: {}, castles: {}, nextId: 1, ipBans: [], settings: { exp: 1, drop: 1, refine: 1 }, worldBossLog: [] },
  dirty: false,
  load() { try { const s = localStorage.getItem(KEY); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) {} return this; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} this.dirty = false; },
  nextId() { return this.data.nextId++; },
  hashPass(pass, salt) { let h1 = 0x811c9dc5, h2 = 0x1234567; const s = salt + ':' + pass; for (let k = 0; k < 64; k++) for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + s.charCodeAt(i) + k, 2654435761) >>> 0; } return h1.toString(16) + h2.toString(16); },
  createAccount(user, pass) {
    const key = user.toLowerCase(); if (this.data.accounts[key]) return null;
    const salt = Math.random().toString(36).slice(2);
    const first = Object.keys(this.data.accounts).length === 0;
    const acc = { user, salt, hash: this.hashPass(pass, salt), gm: first ? 5 : 0, chars: [], banned: 0, created: Date.now() };
    this.data.accounts[key] = acc; this.dirty = true; return acc;
  },
  checkLogin(user, pass) { const acc = this.data.accounts[user.toLowerCase()]; if (!acc) return null; return this.hashPass(pass, acc.salt) === acc.hash ? acc : null; },
  account(user) { return this.data.accounts[String(user).toLowerCase()]; },
  charByName(name) { const n = String(name).toLowerCase(); for (const id in this.data.chars) if (this.data.chars[id].name.toLowerCase() === n) return this.data.chars[id]; return null; },
  audit() {}
};
module.exports = db;`;

const shim = `
(function () {
  const START = performance.now();
  window.process = { env: {}, execPath: '', on() {}, exit() { location.reload(); }, memoryUsage: () => ({ rss: 0 }), hrtime: { bigint: () => BigInt(Math.round((performance.now() - START) * 1e6)) } };
  let WSS = null;
  const builtins = {
    fs: { appendFile() {}, readFile(p, cb) { cb && cb(new Error('no fs')); }, readFileSync() { throw new Error('ไม่รองรับในโหมดเบราว์เซอร์'); }, writeFileSync() {}, renameSync() {}, existsSync: () => false, mkdirSync() {} },
    path: { join: (...a) => a.join('/'), normalize: (x) => x, extname: (x) => (String(x).match(/\\.[^.\\/]+$/) || [''])[0], resolve: (x) => x },
    child_process: { execFileSync() { throw new Error('@reload ใช้ได้เฉพาะเวอร์ชันเซิร์ฟเวอร์ Node.js'); } },
    crypto: {},
    http: { createServer: () => ({ listen(port, cb) { cb && setTimeout(cb, 0); }, on() {} }) },
    ws: { WebSocketServer: class { constructor() { this.h = {}; WSS = this; } on(ev, fn) { this.h[ev] = fn; } } }
  };
  const SHARED = { 'shared/data.js': () => NO_DATA, 'shared/data2.js': () => NO_DATA, 'shared/itemdb.js': () => NO_DATA, 'shared/formulas.js': () => NO_F, 'shared/mapgen.js': () => NO_MAP, 'shared/rng.js': () => NO_RNG, 'shared/skills.js': () => NO_SKILLS, 'shared/passives.js': () => NO_PASSIVE };
  const MODS = window.__NO_MODS = {};
  const cache = {};
  function resolve(from, name) {
    if (builtins[name]) return name;
    const parts = from.split('/'); parts.pop();
    for (const s of name.split('/')) { if (s === '..') parts.pop(); else if (s !== '.' && s) parts.push(s); }
    let p = parts.join('/'); if (!p.endsWith('.js')) p += '.js'; return p;
  }
  function req(from, name) {
    const id = resolve(from, name);
    if (builtins[id]) return builtins[id];
    if (SHARED[id]) return SHARED[id]();
    if (cache[id]) return cache[id].exports;
    if (!MODS[id]) throw new Error('module not bundled: ' + id);
    const m = { exports: {} }; cache[id] = m;
    const r = (n) => req(id, n); r.resolve = (n) => resolve(id, n); r.cache = {};
    MODS[id](m, m.exports, r, id.replace(/\\/[^/]+$/, ''));
    return m.exports;
  }
  window.__NO_START = () => req('server/boot.js', './index');
  window.__NO_REQ = (n) => req('server/boot.js', n);
  // In-page WebSocket: the client connects to the bundled server without any network.
  class LocalSocket {
    constructor() {
      this.readyState = 0;
      const self = this;
      const srv = this.srv = { readyState: 1, h: {}, on(ev, fn) { this.h[ev] = fn; }, send(data) { if (self.readyState === 1) setTimeout(() => self.onmessage && self.onmessage({ data }), 0); }, close() { self.readyState = 3; self.onclose && self.onclose({}); } };
      setTimeout(() => { WSS.h.connection(srv, { headers: {}, socket: { remoteAddress: 'local' } }); this.readyState = 1; this.onopen && this.onopen(); }, 0);
    }
    send(d) { const h = this.srv.h.message; if (h) setTimeout(() => h(d), 0); }
    close() { this.readyState = 3; const h = this.srv.h.close; if (h) h(); }
  }
  window.WebSocket = LocalSocket;
})();`;

let mods = `__NO_MODS['server/db.js'] = function (module, exports, require, __dirname) {${browserDb}\n};\n`;
for (const m of serverMods) mods += `__NO_MODS['server/${m}.js'] = function (module, exports, require, __dirname) {\n${read('server/' + m + '.js')}\n};\n`;

const out = `<title>Novice Online</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Kanit:wght@300;400;600;800&display=swap" rel="stylesheet">
<style>
${css}
:root { color-scheme: dark; }
html, body { height: 100%; background: #0b0d14; color: #e9e6dc; }
.offlineNote { margin-top: 4px; font-size: 11px; color: #9a98a4; text-align: center; }
</style>
${body.replace('<div class="features">', '<div class="offlineNote">เวอร์ชันเล่นในเบราว์เซอร์: เซิร์ฟเวอร์จำลองทำงานในหน้านี้ · เซฟอยู่ในเครื่องนี้ · บัญชีแรกที่สมัครได้สิทธิ์ GM</div>\n    <div class="features">')}
${shared.map((f) => `<script>\n${safe(read(f))}\n</script>`).join('\n')}
<script>\n${safe(shim)}\n${safe(mods)}\n__NO_START();\naddEventListener('pagehide', () => { try { __NO_REQ('./gm').saveAll(); } catch (e) {} });\ndocument.addEventListener('visibilitychange', () => { if (document.hidden) try { __NO_REQ('./gm').saveAll(); } catch (e) {} });\n</script>
${client.map((f) => `<script>\n${safe(read(f))}\n</script>`).join('\n')}
<script>ART.preloadBosses(); UI.boot();</script>
`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'novice-online.html'), out);
console.log('dist/novice-online.html', (out.length / 1024).toFixed(0) + ' KB');

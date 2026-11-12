// HTTP static server + WebSocket game protocol.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const D = require('../shared/data.js');
const { SKILLS } = require('../shared/skills.js');
const db = require('./db').load();
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const A = require('./auto');
const S = require('./social');
const GM = require('./gm');

const PORT = +process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/client/index.html';
  if (u === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: W.players.size, instances: W.instances.size })); }
  if (!/^\/(client|shared|docs)\//.test(u)) { res.writeHead(404); return res.end('not found'); }
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const NAME_RE = /^[\p{L}\p{N}_]{2,14}$/u;

function persist(p) {
  const c = p.char;
  c.hp = Math.round(p.hp); c.sp = Math.round(p.sp); c.ult = Math.floor(p.ult); c.lv = p.lv;
  if (p.inst && p.inst.def.kind !== 'dungeon' && p.inst.def.kind !== 'wb' && p.inst.def.kind !== 'castle') { c.map = p.inst.mapId; c.x = p.x; c.y = p.y; }
  const { on, target, moveTo, nextThink, state, back, ...cfg } = p.auto; c.auto = cfg;
  db.dirty = true;
}
function saveAll() { for (const p of W.players.values()) persist(p); db.save(); }
GM.persist = persist; GM.saveAll = saveAll;
GM.shutdown = () => { saveAll(); for (const p of W.players.values()) p.sess && p.sess.kick('เซิร์ฟเวอร์ปิด'); setTimeout(() => process.exit(0), 300); };

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const sess = { ws, ip, acc: null, p: null, msgs: 0, win: Date.now() };
  sess.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  sess.kick = (why) => { sess.send({ t: 'kicked', m: why }); setTimeout(() => ws.close(), 100); };
  if (db.data.ipBans.includes(ip)) { sess.kick('IP ถูกแบน'); return; }
  sess.send({ t: 'hello', classes: D.CLASS_IDS.length, online: W.players.size });

  ws.on('message', (raw) => {
    const t = Date.now();
    if (t - sess.win > 1000) { sess.win = t; sess.msgs = 0; }
    if (++sess.msgs > 80) return; // flood guard
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    try { handle(sess, m); } catch (e) { console.error('handler error', m.t, e); sess.send({ t: 'err', m: 'server error' }); }
  });
  ws.on('close', () => {
    const p = sess.p; if (!p) return;
    persist(p);
    if (p.auto.on && p.auto.offline && p.inst && p.inst.autoAllowed) { p.sess = null; p.offlineUntil = Date.now() + 12 * 3600e3; }
    else W.removePlayer(p);
  });
});

function charList(acc) {
  return acc.chars.map((id) => db.data.chars[id]).filter(Boolean).map((c) => ({ id: c.id, name: c.name, cls: c.cls, lv: c.lv, map: c.map, guild: c.guild && db.data.guilds[c.guild] ? db.data.guilds[c.guild].name : '', eq: c.equip && c.equip.weapon ? [c.equip.weapon.rarity, c.equip.weapon.refine || 0] : [0, 0] }));
}

function handle(sess, m) {
  // ---------------- auth
  if (!sess.acc) {
    if (m.t !== 'login' && m.t !== 'register') return;
    const user = String(m.user || '').trim(), pass = String(m.pass || '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(user) || pass.length < 4 || pass.length > 64) return sess.send({ t: 'auth', ok: false, m: 'ชื่อผู้ใช้ 3-20 ตัว (a-z 0-9 _) รหัสผ่าน 4 ตัวขึ้นไป' });
    let acc;
    if (m.t === 'register') { acc = db.createAccount(user, pass); if (!acc) return sess.send({ t: 'auth', ok: false, m: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' }); db.save(); }
    else { acc = db.checkLogin(user, pass); if (!acc) return sess.send({ t: 'auth', ok: false, m: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); }
    if (acc.banned && acc.banned > Date.now()) return sess.send({ t: 'auth', ok: false, m: `บัญชีถูกแบนถึง ${new Date(acc.banned).toLocaleString('th-TH')} ${acc.banReason || ''}` });
    sess.acc = acc;
    return sess.send({ t: 'auth', ok: true, user: acc.user, gm: acc.gm, chars: charList(acc) });
  }
  const acc = sess.acc;
  // ---------------- character select
  if (!sess.p) {
    if (m.t === 'createChar') {
      const name = String(m.name || '').trim();
      if (!NAME_RE.test(name)) return sess.send({ t: 'err', m: 'ชื่อตัวละคร 2-14 ตัวอักษร (ไทย/อังกฤษ/ตัวเลข)' });
      if (!D.CLASSES[m.cls]) return sess.send({ t: 'err', m: 'เลือกคลาส' });
      if (db.charByName(name)) return sess.send({ t: 'err', m: 'ชื่อนี้ถูกใช้แล้ว' });
      if (acc.chars.length >= 6) return sess.send({ t: 'err', m: 'สร้างได้สูงสุด 6 ตัวละคร' });
      const ch = I.newChar(acc, name, m.cls);
      db.data.chars[ch.id] = ch; acc.chars.push(ch.id); db.save();
      return sess.send({ t: 'chars', chars: charList(acc), created: ch.id });
    }
    if (m.t === 'deleteChar') {
      const ch = db.data.chars[m.id]; if (!ch || !acc.chars.includes(m.id)) return;
      if (String(m.confirm || '') !== ch.name) return sess.send({ t: 'err', m: 'พิมพ์ชื่อตัวละครเพื่อยืนยันการลบ' });
      if (ch.guild && db.data.guilds[ch.guild] && db.data.guilds[ch.guild].master === ch.id) return sess.send({ t: 'err', m: 'ยุบ/โอนกิลด์ก่อนลบตัวละคร' });
      if (ch.guild && db.data.guilds[ch.guild]) delete db.data.guilds[ch.guild].members[ch.id];
      acc.chars = acc.chars.filter((x) => x !== m.id); delete db.data.chars[m.id]; db.save();
      return sess.send({ t: 'chars', chars: charList(acc) });
    }
    if (m.t === 'play') {
      const ch = db.data.chars[m.id]; if (!ch || !acc.chars.includes(m.id)) return;
      for (const q of W.players.values()) if (q.char.acc === ch.acc && q.sess && q.char.id !== ch.id) q.sess.kick('ล็อกอินตัวละครอื่นจากบัญชีเดียวกัน');
      let p = W.players.get(ch.id);
      if (p) { if (p.sess && p.sess !== sess) p.sess.kick('ล็อกอินซ้อน'); p.sess = sess; p.offlineUntil = 0; p.gm = acc.gm; }
      else {
        p = C.makePlayer(ch, sess, acc);
        p.guildName = ch.guild && db.data.guilds[ch.guild] ? db.data.guilds[ch.guild].name : '';
        W.players.set(ch.id, p);
      }
      sess.p = p;
      let map = ch.map || 'aurelia';
      if (ch.jailUntil && ch.jailUntil > Date.now()) map = 'jail';
      if (p.inst) W.enterMap(p, p.inst.id, p.x, p.y);
      else W.enterMap(p, map, ch.x, ch.y);
      if (p.auto.on) sess.send({ t: 'notice', k: 'system', m: 'ออโต้ออฟไลน์ยังทำงานอยู่ — กลับมาแล้ว!' });
      sess.send({ t: 'notice', k: 'system', m: `ยินดีต้อนรับสู่ Novice Online, ${ch.name}! (ออนไลน์ ${W.players.size} คน)` });
      if (acc.gm) sess.send({ t: 'gmlist', list: GM.list(acc.gm) });
      return;
    }
    return;
  }
  // ---------------- in game
  const p = sess.p;
  switch (m.t) {
    case 'mv': if (typeof m.x === 'number' && typeof m.y === 'number') C.clientMove(p, m.x, m.y); break;
    case 'atk': { const e = p.inst.entities.get(m.id); p.atkTarget = e && C.isEnemy(p, e) ? e.id : null; break; }
    case 'stop': p.atkTarget = null; break;
    case 'sk': if (typeof m.id === 'string') { if (p.auto.on) return; C.useSkill(p, m.id, m.tid | 0, typeof m.x === 'number' ? m.x : undefined, typeof m.y === 'number' ? m.y : undefined); } break;
    case 'breakfree': if (!A.breakFree(p)) sess.send({ t: 'err', m: 'ใช้ไม่ได้ตอนนี้ (CD 25s / ต้องติดสถานะ / SP 15%)' }); break;
    case 'chat': {
      const msg = String(m.m || '');
      if (msg.startsWith('@')) GM.run(p, msg);
      else S.chat(p, m.ch || 'map', msg);
      break;
    }
    case 'stat': I.addStat(p, m.k, m.n || 1); break;
    case 'learn': I.learn(p, m.id); break;
    case 'resetSkills': I.resetSkills(p); break;
    case 'resetStats': I.resetStats(p); break;
    case 'hotbar': I.setHotbar(p, m.slots); break;
    case 'equip': I.equip(p, m.uid); break;
    case 'unequip': if (D.SLOTS.includes(m.slot)) I.unequip(p, m.slot); break;
    case 'use': I.use(p, m.uid, m.id); break;
    case 'sell': I.sell(p, m.uid, m.qty); break;
    case 'drop': I.drop(p, m.uid, m.qty); break;
    case 'buy': I.buy(p, m.id, m.qty); break;
    case 'refine': I.refine(p, m.uid, !!m.prot, !!m.bless); break;
    case 'socket': I.socket(p, m.uid, m.gem); break;
    case 'unsocket': I.unsocket(p, m.uid); break;
    case 'drill': I.drill(p, m.uid); break;
    case 'reroll': I.reroll(p, m.uid); break;
    case 'combine': I.combine(p, m.id); break;
    case 'warp': {
      const dest = String(m.map || '');
      const town = D.TOWNS.find((x) => x.id === dest), farm = D.FARM_MAPS.find((x) => x.id === dest);
      if (p.char.jailUntil > Date.now()) return sess.send({ t: 'err', m: 'คุณอยู่ในคุก' });
      if (p.inst.def.kind === 'castle' && S.gvgActive() && !p.dead) return sess.send({ t: 'err', m: 'ออกจากปราสาทระหว่างวอร์ไม่ได้ (ใช้ Return Scroll)' });
      if (dest === 'pvp_arena' || dest === 'wb_arena') { W.enterMap(p, dest); break; }
      if (D.CASTLES.find((c) => c.id === dest)) { S.enterCastle(p, dest); break; }
      if (!town && !farm) return;
      const cost = farm ? farm.min * 15 : 0;
      if (p.inst.def.kind !== 'town' && !p.gm && farm) return sess.send({ t: 'err', m: 'วาร์ปไปแผนที่ฟาร์มได้จากเมือง (Gatekeeper) เท่านั้น' });
      if (p.char.zeny < cost) return sess.send({ t: 'err', m: `ค่าวาร์ป ${cost} Zeny` });
      p.char.zeny -= cost; C.sendChar(p, ['zeny']);
      W.enterMap(p, dest); break;
    }
    case 'town': if (p.dead) C.respawn(p); else if (!I.use(p, null, 'tele_scroll')) {} break;
    case 'respawn': C.respawn(p); break;
    case 'dungeon': S.enterDungeon(p, m.type, m.floor); break;
    case 'stairs': S.useStairs(p); break;
    case 'portal': { const e = p.inst.entities.get(m.id); if (e && e.role === 'portal' && W.dist(e, p) < 4) W.enterMap(p, e.dest); break; }
    case 'healer': if (p.inst.def.kind === 'town') { p.hp = p.maxHp; p.sp = p.maxSp; C.addBuff(p, 'npc:bless', { str: 10, int: 10, dex: 10, agi: 10 }, 600, 'Blessing of Mira', '#fff'); sess.send({ t: 'notice', k: 'system', m: 'Sister Mira: ฮีลเต็ม + Blessing 10 นาที' }); } break;
    case 'auto': p.auto = Object.assign(A.sanitize(m.cfg), { on: p.auto.on, ax: p.auto.ax, ay: p.auto.ay, state: p.auto.state, startAt: p.auto.startAt, kills0: p.auto.kills0, startZeny: p.auto.startZeny, startLv: p.auto.startLv }); persist(p); C.sendChar(p, ['auto']); break;
    case 'autoOn': A.setOn(p, !!m.on); C.sendChar(p, ['auto']); break;
    case 'party': S.party(p, m); break;
    case 'guild': S.guild(p, m); break;
    case 'info': S.info(p, m.what); break;
    case 'gm': if (p.gm) GM.run(p, '@' + String(m.cmd || '')); break;
    case 'ping': sess.send({ t: 'pong', c: m.c }); break;
  }
}

// ---------------- loops
setInterval(() => { try { W.tick(); } catch (e) { console.error('tick error', e); } }, 50);
setInterval(() => {
  const now = Date.now();
  for (const p of [...W.players.values()]) {
    if (!p.sess && (!p.auto.on || (p.offlineUntil && p.offlineUntil < now))) { persist(p); W.removePlayer(p); }
    if (p.char.jailUntil && p.char.jailUntil < now && p.inst && p.inst.mapId === 'jail') { p.char.jailUntil = 0; p.char.lastTown = 'aurelia'; W.enterMap(p, 'aurelia'); }
  }
  saveAll();
}, 30000);
process.on('SIGINT', () => { GM.shutdown(); });
process.on('SIGTERM', () => { GM.shutdown(); });

server.listen(PORT, () => console.log(`Novice Online server: http://localhost:${PORT}  (skills: ${Object.keys(SKILLS).length}, maps: ${D.TOWNS.length} towns + ${D.FARM_MAPS.length} fields + ${D.DUNGEONS.length}×${D.DUNGEON_FLOORS} dungeon floors)`));

// HTTP static server + WebSocket game protocol.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const { SKILLS } = require('../shared/skills.js');
const db = require('./db').load();
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const CH = require('./chests'); CH.init(W, C, I);
const A = require('./auto');
const S = require('./social');
const GM = require('./gm');
const P = require('./progress');
const E = require('./econ');

const PORT = +process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/client/index.html';
  if (u === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: W.players.size, instances: W.instances.size, entities: [...W.instances.values()].reduce((a, i) => a + i.entities.size, 0), tickMs: +tickAvg.toFixed(2), tickMaxMs: +tickMax.toFixed(1), memMB: Math.round(process.memoryUsage().rss / 1e6) })); }
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

// class ids from the original roster → their current class id (applied when the character enters the game,
// and shown that way on the character list so old saves always display)
const OLD_CLASS = { blade_knight: 'blademaster', guardian: 'guardian', berserker: 'berserker', shadow_assassin: 'assassin', ranger: 'ranger', elementalist: 'pyromancer', cleric: 'cleric', monk: 'monk', warlock: 'warlock', gunslinger: 'marksman', chrono_stalker: 'chronomancer', divine_sovereign: 'deity', hellfiend: 'demon', void_walker: 'darkknight', lightbringer: 'lightbringer' };
const shownClass = (cls) => (D.CLASSES[cls] ? cls : OLD_CLASS[cls] || 'blademaster');
function charList(acc) {
  return acc.chars.map((id) => db.data.chars[id]).filter(Boolean).map((c) => ({ id: c.id, name: c.name, cls: shownClass(c.cls), lv: c.lv, map: c.map, guild: c.guild && db.data.guilds[c.guild] ? db.data.guilds[c.guild].name : '', eq: c.equip && c.equip.weapon ? [c.equip.weapon.rarity, c.equip.weapon.refine || 0] : [0, 0] }));
}

// ---------------- lobby: one character per class (each with its own level, bag and zeny), 3 starter classes,
// every other class comes from the class case (5M zeny per roll, paid by the class you are on, always a class you don't own yet)
function lobbyOf(acc) {
  const chars = acc.chars.map((id) => db.data.chars[id]).filter(Boolean);
  if (!acc.nick && chars.length) acc.nick = chars[0].name;
  if (!acc.sel || !chars.some((c) => c.id === acc.sel)) acc.sel = chars.length ? chars.slice().sort((a, b) => b.lv - a.lv)[0].id : null;
  return { t: 'lobby', nick: acc.nick || '', sel: acc.sel, gm: acc.gm || 0, cost: D.CLASS_ROLL_COST, starters: D.STARTER_CLASSES,
    chars: chars.map((c) => ({ id: c.id, cls: shownClass(c.cls), lv: c.lv, zeny: c.zeny || 0, map: c.map, name: c.name })) };
}
// the class case has 30 slots, one per class, all with the same chance (1/30). A class you already own is a
// "salt" slot: landing on it gives no class and refunds half the price. Every class won turns its slot to salt.
function rollClass(acc, rnd) {
  const owned = new Set(acc.chars.map((id) => db.data.chars[id]).filter(Boolean).map((c) => shownClass(c.cls)));
  if (D.CLASS_IDS.every((c) => owned.has(c))) return null;
  const cls = D.CLASS_IDS[Math.floor(rnd() * D.CLASS_IDS.length)];
  return { cls, salt: owned.has(cls) };
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
    sess.acc = acc; I.bindWallet(acc); // Zeny is shared by all characters of the account
    sess.send({ t: 'auth', ok: true, user: acc.user, gm: acc.gm, chars: charList(acc) });
    return sess.send(lobbyOf(acc));
  }
  const acc = sess.acc;
  // ---------------- character select
  if (!sess.p) {
    if (m.t === 'lobby') return sess.send(lobbyOf(acc));
    if (m.t === 'selClass') { if (acc.chars.includes(m.id)) { acc.sel = m.id; db.dirty = true; } return sess.send(lobbyOf(acc)); }
    if (m.t === 'starter') {
      // first visit: pick a nickname and one of the 3 starter classes
      if (acc.chars.length) return sess.send({ t: 'err', m: 'บัญชีนี้เลือกคลาสเริ่มต้นไปแล้ว' });
      const name = String(m.name || '').trim();
      if (!NAME_RE.test(name)) return sess.send({ t: 'err', m: 'ชื่อตัวละคร 2-14 ตัวอักษร (ไทย/อังกฤษ/ตัวเลข)' });
      if (db.charByName(name)) return sess.send({ t: 'err', m: 'ชื่อนี้ถูกใช้แล้ว' });
      if (!D.STARTER_CLASSES.includes(m.cls)) return sess.send({ t: 'err', m: 'เลือกได้เฉพาะ นักดาบ / นักธนู / นักเวท' });
      const ch = I.newChar(acc, name, m.cls);
      if (typeof acc.zeny !== 'number' || !acc.chars.length) acc.zeny = (acc.zeny || 0) + (ch.zeny || 0);
      db.data.chars[ch.id] = ch; acc.chars.push(ch.id); delete ch.zeny; I.bindWallet(acc); acc.nick = name; acc.sel = ch.id; db.save();
      return sess.send(lobbyOf(acc));
    }
    if (m.t === 'rollClass') {
      const cur = db.data.chars[acc.sel]; if (!cur || !acc.chars.includes(cur.id)) return sess.send({ t: 'err', m: 'เลือกตัวละครก่อน' });
      const free = acc.gm >= 2 && m.free;
      if (!free && (cur.zeny || 0) < D.CLASS_ROLL_COST) return sess.send({ t: 'err', m: `ต้องมี ${D.CLASS_ROLL_COST.toLocaleString()} Zeny ในบัญชี (มี ${(cur.zeny || 0).toLocaleString()})` });
      const got = rollClass(acc, Math.random);
      if (!got) return sess.send({ t: 'err', m: 'คุณมีครบทุกคลาสแล้ว — กล่องเป็นเกลือทั้ง 30 ช่อง' });
      if (!free) cur.zeny -= D.CLASS_ROLL_COST;
      if (got.salt) {
        // salt: no class, half the price back
        if (!free) cur.zeny += D.CLASS_SALT_REFUND; db.save();
        sess.send({ t: 'roll', cls: got.cls, salt: 1, refund: D.CLASS_SALT_REFUND });
        return sess.send(lobbyOf(acc));
      }
      // a new class starts fresh: its own character at level 1 (same nickname), farmed separately
      const ch = I.newChar(acc, acc.nick || cur.name, got.cls);
      delete ch.zeny; // shares the account wallet
      db.data.chars[ch.id] = ch; acc.chars.push(ch.id); I.bindWallet(acc); db.save();
      S.broadcast({ t: 'notice', k: 'loot', m: `🎰 ${acc.nick || cur.name} เปิดกล่องคลาสได้ ${D.CLASSES[got.cls].name}!` });
      sess.send({ t: 'roll', cls: got.cls, id: ch.id });
      return sess.send(lobbyOf(acc));
    }
    if (m.t === 'createChar') {
      if (!D.STARTER_CLASSES.includes(m.cls)) return sess.send({ t: 'err', m: 'คลาสอื่นได้จากกล่องสุ่มคลาสเท่านั้น' });
      const name = String(m.name || '').trim();
      if (!NAME_RE.test(name)) return sess.send({ t: 'err', m: 'ชื่อตัวละคร 2-14 ตัวอักษร (ไทย/อังกฤษ/ตัวเลข)' });
      if (!D.CLASSES[m.cls]) return sess.send({ t: 'err', m: 'เลือกคลาส' });
      if (db.charByName(name)) return sess.send({ t: 'err', m: 'ชื่อนี้ถูกใช้แล้ว' });
      if (acc.chars.length >= 6) return sess.send({ t: 'err', m: 'สร้างได้สูงสุด 6 ตัวละคร' });
      const ch = I.newChar(acc, name, m.cls);
      db.data.chars[ch.id] = ch; acc.chars.push(ch.id); I.bindWallet(acc); db.save();
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
      acc.sel = ch.id;
      for (const q of W.players.values()) if (q.char.acc === ch.acc && q.sess && q.char.id !== ch.id) q.sess.kick('ล็อกอินตัวละครอื่นจากบัญชีเดียวกัน');
      // kit 5: the original 50-skill system is back (and 15 newly designed classes) — every character gets all skill points back once
      if (!D.CLASSES[ch.cls] || ch.kitVer !== 5) {
        const old = ch.cls; if (!D.CLASSES[ch.cls]) ch.cls = OLD_CLASS[ch.cls] || 'blademaster';
        const first = require('../shared/skills.js').CLASS_SKILLS[ch.cls][0];
        ch.skills = { [first]: 1 }; ch.skillPts = F.skillPointsAt(ch.lv) - 1; const keepItems = (ch.hotbar || []).filter((h) => h && h.startsWith('item:')); ch.hotbar = new Array(50).fill(null); I.defaultHotbar(ch); keepItems.slice(0, 5).forEach((h, i) => { ch.hotbar[25 + i] = h; }); ch.kitVer = 5;
        if (ch.equip && ch.equip.weapon && ch.equip.weapon.wtype !== D.CLASSES[ch.cls].weapon) { ch.inv = ch.inv || []; ch.inv.push(ch.equip.weapon); ch.equip.weapon = null; }
        ch._kitMsg = old !== ch.cls ? `⚔ ระบบคลาสใหม่: ${old} → ${D.CLASSES[ch.cls].name} · คืนแต้มสกิลทั้งหมดแล้ว` : '⚔ กลับมาใช้ระบบสกิลเดิม (50 สกิลต่อคลาส) — คืนแต้มสกิลแล้ว เรียนสกิลใหม่ได้ที่หน้าต่างสกิล (K)';
      }
      let p = W.players.get(ch.id);
      if (p) { if (p.sess && p.sess !== sess) p.sess.kick('ล็อกอินซ้อน'); p.sess = sess; p.offlineUntil = 0; p.gm = acc.gm; }
      else {
        p = C.makePlayer(ch, sess, acc);
        p.guildName = ch.guild && db.data.guilds[ch.guild] ? db.data.guilds[ch.guild].name : '';
        W.players.set(ch.id, p);
      }
      sess.p = p;
      if (ch._kitMsg) { sess.send({ t: 'notice', k: 'system', m: ch._kitMsg }); delete ch._kitMsg; }
      // the passive tree was re-laid out for 15 classes: old allocations are refunded once
      { const T = require('../shared/passives.js'); if ((ch.passiveVer || 1) !== T.VERSION) { if ((ch.passives || []).length) sess.send({ t: 'notice', k: 'system', m: '🌌 Passive Tree ถูกปรับใหม่สำหรับ 30 คลาส — คืนแต้มทั้งหมดแล้ว กรุณาเลือกใหม่' }); ch.passives = []; ch.passiveVer = T.VERSION; } }
      // GM-only character modes (immortal / no cooldown / ...) never carry over to non-GM accounts
      if (p.gm > 0) { p.gmf = Object.assign({}, ch.gmf || {}); p.god = !!p.gmf.god; } else { p.gmf = {}; p.god = false; delete ch.gmf; }
      let map = ch.map || 'aurelia';
      if (ch.jailUntil && ch.jailUntil > Date.now()) map = 'jail';
      if (p.inst) W.enterMap(p, p.inst.id, p.x, p.y);
      else W.enterMap(p, map, ch.x, ch.y);
      P.onLogin(p); C.recalc(p); C.sendChar(p, Object.keys(C.charPayload(p)));
      if (p.auto.on) sess.send({ t: 'notice', k: 'system', m: 'ออโต้ออฟไลน์ยังทำงานอยู่ — กลับมาแล้ว!' });
      if (E.unread(ch)) sess.send({ t: 'notice', k: 'system', m: `✉ คุณมีจดหมายใหม่ ${E.unread(ch)} ฉบับ (ไปรษณีย์ในเมือง)` });
      if (ch.login.claimed !== new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate()) sess.send({ t: 'loginReward' });
      sess.send({ t: 'notice', k: 'system', m: `ยินดีต้อนรับสู่ Novice Online, ${ch.name}! (ออนไลน์ ${W.players.size} คน)` });
      if (acc.gm) sess.send({ t: 'gmlist', list: GM.list(acc.gm) });
      return;
    }
    return;
  }
  // ---------------- in game
  const p = sess.p;
  switch (m.t) {
    case 'mv': if (p.warping) break; if (typeof m.x === 'number' && typeof m.y === 'number') C.clientMove(p, m.x, m.y); break;
    // manual play: one click = one basic attack (queued until in range / off cooldown); AUTO keeps attacking on its own
    case 'atk': { P.dismount(p); const e = p.inst.entities.get(m.id); p.atkTarget = e && C.isEnemy(p, e) ? e.id : null; p.atkOnce = !!p.atkTarget; break; }
    case 'stop': p.atkTarget = null; p.atkOnce = false; break;
    case 'sk': if (typeof m.id === 'string') { if (p.auto.on) return; P.dismount(p); C.useSkill(p, m.id, m.tid | 0, typeof m.x === 'number' ? m.x : undefined, typeof m.y === 'number' ? m.y : undefined); } break;
    case 'breakfree': if (!A.breakFree(p)) sess.send({ t: 'err', m: 'ใช้ไม่ได้ตอนนี้ (CD 25s / ต้องติดสถานะ / SP 15%)' }); break;
    case 'chat': {
      const msg = String(m.m || '');
      // owner claim: the first account on this server to type /gmphuthanet becomes the GM owner (level 5);
      // after that it only works for that same account, so other players cannot use it even if they learn it
      if (msg.trim().toLowerCase() === '/gmphuthanet') {
        const own = db.data.ownerGm;
        if (own && own !== acc.user.toLowerCase()) { sess.send({ t: 'err', m: 'คำสั่งนี้ใช้ได้เฉพาะเจ้าของเซิร์ฟเวอร์' }); break; }
        db.data.ownerGm = acc.user.toLowerCase(); acc.gm = 5; p.gm = 5; db.dirty = true; db.save();
        C.recalc(p); sess.send({ t: 'char', ...C.charPayload(p) }); sess.send({ t: 'gmlist', list: GM.list(5) });
        sess.send({ t: 'notice', k: 'system', m: '👑 ได้รับสิทธิ์ GM ระดับสูงสุด (5) แล้ว — เปิดหน้าต่าง GM ด้วย F10 หรือพิมพ์ @help' });
        break;
      }
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
    case 'refine': I.refine(p, m.uid, !!m.prot, !!m.bless, !!m.anvil); break;
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
      if (dest === 'pvp_arena' || dest === 'wb_arena') { W.warp(p, dest); break; }
      if (D.CASTLES.find((c) => c.id === dest)) { S.enterCastle(p, dest); break; }
      if (!town && !farm) return;
      if (town && town.id !== p.inst.mapId && !p.gm) return sess.send({ t: 'err', m: 'วาร์ปข้ามเมืองไม่ได้ — เดินทางผ่านแมพฟาร์มตามประตูวาปจนถึงเมืองนั้น' });
      const cost = farm ? farm.min * 15 : 0;
      if (p.inst.def.kind !== 'town' && !p.gm && farm) return sess.send({ t: 'err', m: 'วาร์ปไปแผนที่ฟาร์มได้จากเมือง (Gatekeeper) เท่านั้น' });
      if (p.char.zeny < cost) return sess.send({ t: 'err', m: `ค่าวาร์ป ${cost} Zeny` });
      p.char.zeny -= cost; C.sendChar(p, ['zeny']);
      W.warp(p, dest); break;
    }
    case 'town': if (p.dead) C.respawn(p); else if (!I.use(p, null, 'tele_scroll')) {} break;
    case 'respawn': C.respawn(p); break;
    case 'dungeon': S.enterDungeon(p, m.type, m.floor); break;
    case 'chest': CH.handle(p, m); break;
    case 'stairs': S.useStairs(p); break;
    case 'portal': { const e = p.inst.entities.get(m.id); if (e && e.role === 'portal' && W.dist(e, p) < 4) { const dest = e.dest === 'town' ? (p.char.lastTown || 'aurelia') : e.dest, at = W.gateArrival(dest, p.inst.mapId); W.warp(p, dest, at && at.x, at && at.y); } break; }
    case 'stairsUp': S.stairsUp(p); break;
    case 'toLobby': { persist(p); W.removePlayer(p); sess.p = null; sess.send(lobbyOf(acc)); break; }
    case 'training': W.enterMap(p, 'training'); break;
    case 'pickup': I.pickup(p, m.id | 0); break;
    case 'passive': P.passive(p, m); break;
    case 'healer': if (p.inst.def.kind === 'town') { p.hp = p.maxHp; p.sp = p.maxSp; C.addBuff(p, 'npc:bless', { str: 10, int: 10, dex: 10, agi: 10 }, 600, 'Blessing of Mira', '#fff'); sess.send({ t: 'notice', k: 'system', m: 'Sister Mira: ฮีลเต็ม + Blessing 10 นาที' }); } break;
    case 'auto': p.auto = Object.assign(A.sanitize(m.cfg), { on: p.auto.on, ax: p.auto.ax, ay: p.auto.ay, state: p.auto.state, startAt: p.auto.startAt, kills0: p.auto.kills0, startZeny: p.auto.startZeny, startLv: p.auto.startLv }); persist(p); C.sendChar(p, ['auto']); break;
    case 'autoOn': if (m.on) P.dismount(p); A.setOn(p, !!m.on); C.sendChar(p, ['auto']); break;
    case 'party': S.party(p, m); break;
    case 'guild': S.guild(p, m); break;
    case 'info': S.info(p, m.what); break;
    case 'gm': if (p.gm) GM.run(p, '@' + String(m.cmd || '')); break;
    case 'ping': sess.send({ t: 'pong', c: m.c }); break;
    case 'quest': P.claimQuest(p, m.kind, m.id); break;
    case 'loginClaim': P.claimLogin(p); break;
    case 'title': P.setTitle(p, String(m.title || '')); break;
    case 'friend': P.friend(p, m.a, m.name); break;
    case 'emote': P.emote(p, m.i); break;
    case 'pet': P.setPet(p, m.id); break;
    case 'mount': P.toggleMount(p, m.id); break;
    case 'ranked': P.rankedJoin(p, !!m.on); break;
    case 'gskill': P.guildSkill(p, m.k); break;
    case 'gstore': P.guildStorage(p, m.a, m.uid, m.qty); break;
    case 'storage': if (m.a === 'open') E.storageSend(p); else E.storage(p, m); break;
    case 'mail': E.mail(p, m); break;
    case 'ah': E.ah(p, m); break;
    case 'trade': E.trade(p, m); break;
    case 'craft': E.craft(p, m.i, m.n); break;
    case 'book': C.sendChar(p, ['book']); break;
    case 'tokenBuy': E.tokenBuy(p, m.i); break;
    case 'stableBuy': E.stableBuy(p, m.id); break;
    case 'refreshChar': C.sendChar(p, Object.keys(C.charPayload(p))); break;
  }
}

// ---------------- loops
let tickAvg = 0, tickMax = 0;
setInterval(() => { const t0 = process.hrtime.bigint(); try { W.tick(); } catch (e) { console.error('tick error', e); } const ms = Number(process.hrtime.bigint() - t0) / 1e6; tickAvg = tickAvg * 0.95 + ms * 0.05; tickMax = Math.max(tickMax * 0.999, ms); }, 50);
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

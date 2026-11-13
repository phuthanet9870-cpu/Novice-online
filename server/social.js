// Party, guild, chat, Guild War (castles), field bosses, world boss, dungeon stairs, rankings.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const RNG = require('../shared/rng.js');
const db = require('./db');
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const P = require('./progress');
const E = require('./econ');

const S = module.exports;
const now = () => Date.now() / 1000;
const r = RNG.rng((Date.now() * 7) & 0xffffffff);
const send = (p, m) => p && p.sess && p.sess.send(m);
const err = (p, m) => send(p, { t: 'err', m });
const note = (p, m, k = 'system') => send(p, { t: 'notice', k, m });

S.broadcast = function (msg) { for (const p of W.players.values()) send(p, msg); };
S.announce = (m, k = 'world') => S.broadcast({ t: 'notice', k, m });

// ------------------------------------------------------------------ parties (not persisted)
const parties = new Map(); let partySeq = 1;
S.parties = parties;
S.partyInfo = function (p) {
  if (!p.party) return null;
  const pt = parties.get(p.party); if (!pt) return null;
  return { id: pt.id, leader: pt.leader, members: [...pt.members].map((cid) => { const q = W.players.get(cid); return q ? { id: q.id, cid, name: q.name, cls: q.cls, lv: q.lv, map: q.inst ? q.inst.mapId : '' } : null; }).filter(Boolean) };
};
function syncParty(pt) { for (const cid of pt.members) { const q = W.players.get(cid); if (q) C.sendChar(q, ['party']); } }
S.party = function (p, m) {
  const a = m.a;
  if (a === 'invite') {
    const q = W.findPlayerByName(m.name);
    if (!q || q === p) return err(p, 'ไม่พบผู้เล่นออนไลน์ชื่อนี้');
    if (q.party) return err(p, 'ผู้เล่นมีปาร์ตี้อยู่แล้ว');
    if (!p.party) { const pt = { id: partySeq++, leader: p.char.id, members: new Set([p.char.id]) }; parties.set(pt.id, pt); p.party = pt.id; syncParty(pt); }
    const pt = parties.get(p.party);
    if (pt.members.size >= 6) return err(p, 'ปาร์ตี้เต็ม (6 คน)');
    q.invites = q.invites || {}; q.invites['party' + pt.id] = now() + 60;
    send(q, { t: 'invite', kind: 'party', id: pt.id, from: p.name });
    note(p, `ส่งคำเชิญปาร์ตี้ถึง ${q.name}`);
  } else if (a === 'accept') {
    const pt = parties.get(m.id);
    if (!pt || !p.invites || !(p.invites['party' + m.id] > now())) return err(p, 'คำเชิญหมดอายุ');
    if (p.party) S.party(p, { a: 'leave' });
    pt.members.add(p.char.id); p.party = pt.id; syncParty(pt);
    for (const cid of pt.members) note(W.players.get(cid), `${p.name} เข้าร่วมปาร์ตี้`);
  } else if (a === 'leave') {
    const pt = parties.get(p.party); p.party = null; C.sendChar(p, ['party']);
    if (!pt) return;
    pt.members.delete(p.char.id);
    if (pt.members.size <= 1) { for (const cid of pt.members) { const q = W.players.get(cid); if (q) { q.party = null; C.sendChar(q, ['party']); } } parties.delete(pt.id); return; }
    if (pt.leader === p.char.id) pt.leader = [...pt.members][0];
    syncParty(pt);
  } else if (a === 'kick') {
    const pt = parties.get(p.party); if (!pt || pt.leader !== p.char.id) return err(p, 'เฉพาะหัวหน้าปาร์ตี้');
    const q = W.findPlayerByName(m.name); if (!q || q.party !== pt.id) return;
    S.party(q, { a: 'leave' }); note(q, 'คุณถูกเตะออกจากปาร์ตี้');
  }
};

// ------------------------------------------------------------------ guilds (persisted)
const G = () => db.data.guilds;
S.guildInfo = function (gid) {
  const g = G()[gid]; if (!g) return null;
  return { id: g.id, name: g.name, master: g.master, lv: g.lv, notice: g.notice, ally: g.ally || [],
    castles: D.CASTLES.filter((c) => S.castleOwner(c.id) === g.id).map((c) => c.name),
    members: Object.entries(g.members).map(([cid, mm]) => { const q = W.players.get(cid); return { cid, name: mm.name, rank: mm.rank, cls: mm.cls, lv: q ? q.lv : mm.lv, on: q ? 1 : 0 }; }) };
};
function syncGuild(gid) { for (const p of W.players.values()) if (p.char.guild === gid) { p.guildName = G()[gid] ? G()[gid].name : ''; C.sendChar(p, ['guild']); } }
S.guild = function (p, m) {
  const a = m.a, ch = p.char;
  const g = ch.guild && G()[ch.guild];
  if (a === 'create') {
    if (g) return err(p, 'คุณมีกิลด์อยู่แล้ว');
    const name = String(m.name || '').trim();
    if (!/^[\p{L}\p{N} _-]{3,16}$/u.test(name)) return err(p, 'ชื่อกิลด์ 3-16 ตัวอักษร');
    if (Object.values(G()).some((x) => x.name.toLowerCase() === name.toLowerCase())) return err(p, 'ชื่อกิลด์ซ้ำ');
    if (ch.lv < 20) return err(p, 'ต้องเลเวล 20 ขึ้นไป');
    if (!I.consume(ch, 'guild_emblem', 1) && !p.gm) return err(p, 'ต้องใช้ Guild Emblem (ซื้อได้ที่ร้านค้า Aurelia)');
    const id = 'g' + db.nextId();
    G()[id] = { id, name, master: ch.id, members: { [ch.id]: { name: ch.name, rank: 'master', cls: ch.cls, lv: ch.lv } }, lv: 1, notice: 'ยินดีต้อนรับสู่กิลด์!', ally: [], created: Date.now() };
    ch.guild = id; syncGuild(id); C.sendChar(p, ['inv']);
    S.announce(`🏰 กิลด์ใหม่ [${name}] ถูกก่อตั้งโดย ${ch.name}`);
  } else if (a === 'invite') {
    if (!g) return err(p, 'คุณยังไม่มีกิลด์');
    if (!['master', 'officer'].includes(g.members[ch.id].rank)) return err(p, 'เฉพาะ Master/Officer');
    const q = W.findPlayerByName(m.name);
    if (!q) return err(p, 'ไม่พบผู้เล่นออนไลน์'); if (q.char.guild) return err(p, 'ผู้เล่นมีกิลด์แล้ว');
    if (Object.keys(g.members).length >= 50 + g.lv * 5) return err(p, 'กิลด์เต็ม');
    q.invites = q.invites || {}; q.invites['guild' + g.id] = now() + 60;
    send(q, { t: 'invite', kind: 'guild', id: g.id, from: `${p.name} [${g.name}]` });
    note(p, `ส่งคำเชิญเข้ากิลด์ถึง ${q.name}`);
  } else if (a === 'accept') {
    const ng = G()[m.id];
    if (!ng || !p.invites || !(p.invites['guild' + m.id] > now())) return err(p, 'คำเชิญหมดอายุ');
    if (ch.guild) return err(p, 'คุณมีกิลด์อยู่แล้ว');
    ng.members[ch.id] = { name: ch.name, rank: 'member', cls: ch.cls, lv: ch.lv }; ch.guild = ng.id; syncGuild(ng.id);
    S.guildChat(ng.id, '', `${ch.name} เข้าร่วมกิลด์!`);
  } else if (a === 'leave') {
    if (!g) return;
    if (g.master === ch.id) {
      if (Object.keys(g.members).length > 1) return err(p, 'Master ต้องโอนตำแหน่งหรือยุบกิลด์ (/guild disband)');
      return S.guild(p, { a: 'disband' });
    }
    delete g.members[ch.id]; ch.guild = null; p.guildName = ''; C.sendChar(p, ['guild']); syncGuild(g.id);
  } else if (a === 'kick') {
    if (!g || !['master', 'officer'].includes(g.members[ch.id].rank)) return err(p, 'เฉพาะ Master/Officer');
    const tid = Object.keys(g.members).find((cid) => g.members[cid].name.toLowerCase() === String(m.name).toLowerCase());
    if (!tid || tid === g.master) return;
    delete g.members[tid]; if (db.data.chars[tid]) db.data.chars[tid].guild = null;
    const q = W.players.get(tid); if (q) { q.guildName = ''; C.sendChar(q, ['guild']); note(q, 'คุณถูกเตะออกจากกิลด์'); }
    syncGuild(g.id);
  } else if (a === 'rank') {
    if (!g || g.master !== ch.id) return err(p, 'เฉพาะ Master');
    const tid = Object.keys(g.members).find((cid) => g.members[cid].name.toLowerCase() === String(m.name).toLowerCase());
    if (!tid) return;
    if (m.rank === 'master') { g.members[g.master].rank = 'officer'; g.master = tid; g.members[tid].rank = 'master'; }
    else if (['officer', 'member'].includes(m.rank)) g.members[tid].rank = m.rank;
    syncGuild(g.id);
  } else if (a === 'notice') {
    if (!g || !['master', 'officer'].includes(g.members[ch.id].rank)) return;
    g.notice = String(m.text || '').slice(0, 200); syncGuild(g.id);
  } else if (a === 'ally') {
    if (!g || g.master !== ch.id) return err(p, 'เฉพาะ Master');
    const og = Object.values(G()).find((x) => x.name.toLowerCase() === String(m.name).toLowerCase());
    if (!og || og.id === g.id) return err(p, 'ไม่พบกิลด์');
    g.ally = g.ally || []; og.ally = og.ally || [];
    if (g.ally.length >= 2) return err(p, 'พันธมิตรได้สูงสุด 2 กิลด์');
    if (!g.ally.includes(og.id)) g.ally.push(og.id); if (!og.ally.includes(g.id)) og.ally.push(g.id);
    syncGuild(g.id); syncGuild(og.id);
  } else if (a === 'disband') {
    if (!g || g.master !== ch.id) return err(p, 'เฉพาะ Master');
    for (const cid in g.members) { if (db.data.chars[cid]) db.data.chars[cid].guild = null; const q = W.players.get(cid); if (q) { q.guildName = ''; C.sendChar(q, ['guild']); } }
    for (const c of D.CASTLES) if (S.castleOwner(c.id) === g.id) db.data.castles[c.id] = { owner: null };
    for (const og of Object.values(G())) if (og.ally) og.ally = og.ally.filter((x) => x !== g.id);
    delete G()[g.id];
  }
  db.dirty = true;
};
S.allied = (a, b) => !!(a && b && G()[a] && (G()[a].ally || []).includes(b));
S.guildChat = function (gid, from, m) { for (const p of W.players.values()) if (p.char.guild === gid) send(p, { t: 'chat', ch: 'guild', f: from, m }); };

// ------------------------------------------------------------------ chat
S.chat = function (p, ch, msg) {
  msg = String(msg || '').slice(0, 200).trim(); if (!msg) return;
  const t = now();
  if (p.char.mutedUntil && p.char.mutedUntil > Date.now()) return err(p, 'คุณถูกห้ามแชท');
  let m;
  if ((m = /^\/(?:w|whisper)\s+(\S+)\s+(.+)$/i.exec(msg))) {
    const q = W.findPlayerByName(m[1]); if (!q) return err(p, 'ผู้เล่นไม่ออนไลน์');
    send(q, { t: 'chat', ch: 'whisper', f: p.name, m: m[2] }); send(p, { t: 'chat', ch: 'whisper', f: '→ ' + q.name, m: m[2] }); return;
  }
  if ((m = /^\/p\s+(.+)$/i.exec(msg))) { ch = 'party'; msg = m[1]; }
  else if ((m = /^\/g\s+(.+)$/i.exec(msg))) { ch = 'guild'; msg = m[1]; }
  else if ((m = /^\/(?:world|y)\s+(.+)$/i.exec(msg))) { ch = 'world'; msg = m[1]; }
  else if ((m = /^\/invite\s+(\S+)$/i.exec(msg))) return S.party(p, { a: 'invite', name: m[1] });
  else if ((m = /^\/ginvite\s+(\S+)$/i.exec(msg))) return S.guild(p, { a: 'invite', name: m[1] });
  else if ((m = /^\/duel\s+(\S+)$/i.exec(msg))) return S.duel(p, m[1]);
  if (ch === 'party') {
    const pt = parties.get(p.party); if (!pt) return err(p, 'คุณไม่มีปาร์ตี้');
    for (const cid of pt.members) send(W.players.get(cid), { t: 'chat', ch: 'party', f: p.name, m: msg }); return;
  }
  if (ch === 'guild') { if (!p.char.guild) return err(p, 'คุณไม่มีกิลด์'); return S.guildChat(p.char.guild, p.name, msg); }
  if (ch === 'world') {
    if ((p.worldChatAt || 0) > t) return err(p, 'แชทโลกได้ทุก 5 วินาที');
    p.worldChatAt = t + 5; S.broadcast({ t: 'chat', ch: 'world', f: p.name, m: msg }); return;
  }
  for (const q of p.inst.players) send(q, { t: 'chat', ch: 'map', f: p.name, m: msg, id: p.id });
};
S.duel = function (p, name) {
  const q = W.findPlayerByName(name);
  if (!q || q.inst !== p.inst) return err(p, 'ผู้เล่นต้องอยู่แผนที่เดียวกัน');
  if (q.duelReq === p.id) { p.duel = q.id; q.duel = p.id; note(p, `ดวลกับ ${q.name} เริ่ม!`, 'pvp'); note(q, `ดวลกับ ${p.name} เริ่ม!`, 'pvp'); return; }
  p.duelReq = q.id; note(p, `ท้าดวล ${q.name} แล้ว`); note(q, `${p.name} ท้าดวล! พิมพ์ /duel ${p.name} เพื่อตอบรับ`, 'pvp');
};

S.pvpKill = function (k, v) {
  k.char.pvpKills = (k.char.pvpKills || 0) + 1;
  v.char.pvpDeaths = (v.char.pvpDeaths || 0) + 1;
  if (k.duel === v.id) { k.duel = v.duel = null; v.dead = false; v.hp = 1; }
  for (const q of k.inst.players) send(q, { t: 'killfeed', k: k.name, v: v.name, kc: k.cls, vc: v.cls });
  P.onPvpKill(k, v);
};

// ------------------------------------------------------------------ field bosses
const fieldBoss = {};
S.fieldBoss = fieldBoss;
S.initFieldBoss = function (inst) {
  const id = inst.mapId;
  if (!fieldBoss[id]) fieldBoss[id] = { nextAt: now() + 60 + r() * 240, alive: null };
};
function spawnFieldBoss(inst) {
  const def = inst.def, st = fieldBoss[inst.mapId];
  const fams = D.FAMILIES[def.biome];
  const fam = fams[def.idx % fams.length];
  const spr = D.BOSS_SPRITES.field[def.id];
  const name = spr ? D.BOSS_NAMES[spr] : `${fam[0]} ${D.BOSS_TITLES[def.idx % D.BOSS_TITLES.length]}`;
  const pos = W.dist(inst.map.spawn, { x: inst.map.w * 0.75, y: inst.map.h * 0.3 }) > 20 ? require('../shared/mapgen.js').randomWalkable(inst.map, r, { x: inst.map.w * 0.7, y: inst.map.h * 0.35 }, 30) : inst.map.spawn;
  const m = W.spawnMonster(inst, { fam, lv: def.max + 3, rank: 2, x: pos.x, y: pos.y, name, extra: { noRespawn: true, fieldBoss: true, spr } });
  st.alive = m;
  S.announce(`👹 Field Boss [${name}] ปรากฏตัวที่ ${def.name} (Lv ${m.lv})!`, 'boss');
}
S.bossAbilities = function (m, t) {
  const inst = m.inst;
  const pct = m.hp / m.maxHp;
  for (const th of [0.7, 0.4, 0.15]) if (pct < th && m.phase < [0.7, 0.4, 0.15].indexOf(th) + 1) {
    m.phase++;
    inst.emit({ k: 'txt', t: m.id, x: m.x, y: m.y, m: `PHASE ${m.phase + 1}!`, c: '#ff4040', big: 1 });
    const fams = D.FAMILIES[inst.def.biome] || D.FAMILIES.abyss;
    const n = m.rank === 4 ? 6 : 3;
    for (let i = 0; i < n; i++) W.spawnMonster(inst, { fam: r.pick(fams), lv: Math.max(1, m.lv - 5), rank: m.rank === 4 ? 1 : 0, x: m.x + (r() - 0.5) * 6, y: m.y + (r() - 0.5) * 6, extra: { noRespawn: true } });
    if (m.phase === 3) { m.atk = Math.round(m.atk * 1.3); inst.emit({ k: 'txt', t: m.id, x: m.x, y: m.y, m: 'ENRAGED!', c: '#f00', big: 1 }); }
  }
  if (t < m.skillAt || m.brokenUntil > t) return;
  m.skillAt = t + (m.rank === 4 ? 5 : 8) + r() * 3;
  const targets = [];
  inst.inRadius(m.x, m.y, 18, (o) => { if (o.kind === 'p' && !o.dead && !o.hidden) targets.push(o); });
  if (!targets.length) return;
  const picks = m.rank === 4 ? targets.sort(() => r() - 0.5).slice(0, 4) : [m.target && m.target.kind === 'p' ? m.target : targets[0]];
  for (const tg of picks) {
    const x = tg.x, y = tg.y, rad = m.rank === 4 ? 4.5 : 3.5, delay = 1.4;
    inst.emit({ k: 'tele', x, y, r: rad, d: delay, s: m.id });
    inst.after(delay, () => {
      if (m.dead) return;
      inst.emit({ k: 'boom', x, y, r: rad, el: m.element });
      inst.inRadius(x, y, rad, (o) => { if (o.kind === 'p' && !o.dead) { C.dealDamage(m, o, { mult: m.rank === 4 ? 2.2 : 2.6, el: m.element, kind: 'mob' }); C.applyTag(o, 'knockdown', 1, 1, m); } });
    });
  }
};
S.onBossDeath = function (m, killer) {
  const inst = m.inst;
  if (m.fieldBoss) {
    const st = fieldBoss[inst.mapId]; if (st) { st.alive = null; st.nextAt = now() + 3600 + r() * 1800; }
    S.announce(`⚔ ${killer ? killer.name : '?'} ได้ MVP จาก [${m.name}] ที่ ${inst.def.name}!`, 'boss');
    for (const [pid] of m.dmgBy) { const q = inst.entities.get(pid); if (q && q !== killer) P.event(q, 'kill', { rank: m.rank, exp: 0 }); }
    if (killer) { I.addItem(killer.char, 'crystal_pure', 2); I.addItem(killer.char, 'scroll_protect', 1); I.gainExp(killer, m.exp * 0.5); send(killer, { t: 'notice', k: 'boss', m: 'MVP Reward: Pure Crystal x2, Protection Scroll x1, EXP โบนัส' }); C.sendChar(killer, ['inv']); }
  }
};

// ------------------------------------------------------------------ dungeon stairs
S.checkStairs = function (inst, m) {
  if (inst.stairsOpen) return;
  const ok = inst.def.boss ? m.floorBoss : inst.kills >= Math.ceil(inst.mobTotal * 0.7);
  if (!ok) return;
  inst.stairsOpen = true;
  for (const e of inst.entities.values()) if (e.kind === 'n' && e.role === 'stairs') { e.name = inst.def.floor >= D.DUNGEON_FLOORS ? 'Exit (Cleared!)' : `Stairs → Floor ${inst.def.floor + 1}`; e.open = true; for (const p of inst.players) p.known.delete(e.id); }
  for (const p of inst.players) {
    note(p, inst.def.floor >= D.DUNGEON_FLOORS ? '🏆 พิชิตชั้น 1000 แล้ว!' : `บันไดเปิดแล้ว! ไปชั้น ${inst.def.floor + 1} ได้`, 'level');
    const best = p.char.dungeonBest || (p.char.dungeonBest = {});
    best[inst.def.dungeon] = Math.max(best[inst.def.dungeon] || 0, inst.def.floor);
    C.sendChar(p, ['dungeonBest']);
    P.event(p, 'floor', { n: 1 });
    if (inst.def.floor % 100 === 0) S.announce(`🗼 ${p.name} พิชิต ${inst.def.name}!`);
  }
};
S.enterDungeon = function (p, type, floor) {
  const dg = D.DUNGEONS.find((d) => d.id === type); if (!dg) return err(p, 'ไม่พบดันเจี้ยน');
  floor = Math.max(1, Math.min(D.DUNGEON_FLOORS, floor | 0));
  const best = (p.char.dungeonBest || {})[type] || 0;
  const allowed = floor === 1 || floor <= best + 1 && (floor % 10 === 1 || floor === best + 1);
  if (!allowed && !p.gm) return err(p, `เริ่มได้ที่ชั้น 1 หรือชั้น checkpoint (11, 21, ...) ที่ไม่เกินชั้นที่ผ่านแล้ว +1 (ผ่านสูงสุด ${best})`);
  if (p.party) { for (const q of C.partyNear(p, 12)) if (q !== p && q.inst === p.inst) W.enterMap(q, W.dungeonInstanceId(p, type, floor)); }
  W.enterMap(p, W.dungeonInstanceId(p, type, floor));
};
S.useStairs = function (p) {
  const inst = p.inst;
  if (inst.def.kind !== 'dungeon') return;
  const st = [...inst.entities.values()].find((e) => e.kind === 'n' && e.role === 'stairs');
  if (!st || W.dist(st, p) > 3) return err(p, 'เดินไปที่บันไดก่อน');
  if (!inst.stairsOpen) return err(p, inst.def.boss ? 'ต้องกำจัดบอสประจำชั้นก่อน' : `กำจัดมอนสเตอร์ให้ได้ 70% ก่อน (${inst.kills}/${Math.ceil(inst.mobTotal * 0.7)})`);
  if (inst.def.floor >= D.DUNGEON_FLOORS) return W.enterMap(p, p.char.lastTown || 'aurelia');
  S.enterDungeon(p, inst.def.dungeon, inst.def.floor + 1);
};

// ------------------------------------------------------------------ castles / guild war
const gvg = { active: false, endsAt: 0, lastKey: '' };
S.gvg = gvg;
S.gvgActive = () => gvg.active;
S.castleOwner = (id) => (db.data.castles[id] || {}).owner || null;
S.castleBonus = function (p) {
  const gid = p.char.guild; if (!gid) return 0;
  let b = 0;
  for (const c of D.CASTLES) if (S.castleOwner(c.id) === gid) b += 5;
  if (db.data.wbGuild && db.data.wbGuild.gid === gid && db.data.wbGuild.until > Date.now()) b += 5;
  return b;
};
S.initCastle = function (inst) {
  inst.alwaysOn = true;
  const owner = S.castleOwner(inst.mapId);
  const core = { id: W.nextEnt++, kind: 'c', name: 'Crystal Core', x: inst.map.core.x, y: inst.map.core.y, hp: 2000000, maxHp: 2000000, tags: new Map(), def: 400, mdef: 400, lv: 200, size: 2, guildName: owner && G()[owner] ? G()[owner].name : 'ไม่มีเจ้าของ', dmgBy: new Map() };
  inst.add(core); inst.core = core;
};
S.coreVulnerable = (core, p) => gvg.active && !!p.char.guild && p.char.guild !== S.castleOwner(core.inst.mapId) && !S.allied(p.char.guild, S.castleOwner(core.inst.mapId));
S.coreDamage = function (core, p, dmg) { core.dmgBy.set(p.char.guild, (core.dmgBy.get(p.char.guild) || 0) + dmg); };
S.onCoreDestroyed = function (core, killer) {
  const inst = core.inst;
  const kp = killer ? C.ownerP(killer) : null;
  const gid = kp && kp.char.guild;
  if (gid) db.data.castles[inst.mapId] = { owner: gid, since: Date.now() };
  db.dirty = true;
  const gname = gid && G()[gid] ? G()[gid].name : '?';
  S.announce(`🏰 กิลด์ [${gname}] ยึด ${inst.def.name} ได้แล้ว!`, 'gvg');
  inst.after(3, () => { inst.remove(core); S.initCastle(inst); for (const p of inst.players) { p.known.clear(); C.recalc(p); } });
  for (const p of W.players.values()) if (p.char.guild) C.recalc(p);
};
S.startGvg = function (minutes = D.GVG_SCHEDULE.durationMin) {
  gvg.active = true; gvg.endsAt = now() + minutes * 60;
  for (const c of D.CASTLES) { const inst = W.getInstance(c.id); if (!inst.spawned) W.populate(inst); inst.alwaysOn = true; }
  S.announce(`⚔️ GUILD WAR เริ่มแล้ว! (${minutes} นาที) ไปที่ Herald Brann เพื่อเข้าปราสาท`, 'gvg');
};
S.stopGvg = function () {
  if (!gvg.active) return;
  gvg.active = false;
  const lines = D.CASTLES.map((c) => { const o = S.castleOwner(c.id); return `${c.name}: ${o && G()[o] ? G()[o].name : '-'}`; });
  S.announce(`🏁 GUILD WAR จบแล้ว! ${lines.join(' | ')}`, 'gvg');
  for (const c of D.CASTLES) {
    const o = S.castleOwner(c.id); if (!o) continue;
    for (const p of W.players.values()) if (p.char.guild === o) { p.char.zeny += 200000; I.addItem(p.char, 'crystal_pure', 3); note(p, `รางวัลเจ้าของ ${c.name}: 200,000 Zeny + Pure Crystal x3`, 'gvg'); C.sendChar(p, ['inv', 'zeny']); }
  }
};
S.enterCastle = function (p, id) {
  if (!D.CASTLES.find((c) => c.id === id)) return;
  const own = S.castleOwner(id) === p.char.guild;
  const inst = W.getInstance(id); if (!inst.spawned) W.populate(inst);
  const sp = own && inst.map.defSpawn ? inst.map.defSpawn : inst.map.spawn;
  W.enterMap(p, id, sp.x, sp.y);
};

// ------------------------------------------------------------------ world boss
const wb = { alive: null, dmg: new Map(), lastKey: '', announced: '', idx: 0 };
S.wb = wb;
S.worldBossAlive = () => !!(wb.alive && !wb.alive.dead);
S.initWorldBossArena = function (inst) { inst.alwaysOn = false; };
S.spawnWorldBoss = function (which) {
  if (S.worldBossAlive()) return false;
  const inst = W.getInstance('wb_arena'); if (!inst.spawned) W.populate(inst);
  inst.alwaysOn = true;
  const def = which !== undefined ? D.WORLD_BOSSES[which % D.WORLD_BOSSES.length] : D.WORLD_BOSSES[wb.idx++ % D.WORLD_BOSSES.length];
  const online = W.players.size;
  const m = W.spawnMonster(inst, { fam: [def.name, def.shape, 'caster', 1, def.element], lv: 220, rank: 4, x: inst.map.spawn.x, y: inst.map.spawn.y - 12, name: def.name, color: def.color, extra: { noRespawn: true, range: 7, spr: D.BOSS_SPRITES.world[def.id] } });
  m.maxHp = m.hp = Math.round(m.maxHp * Math.max(0.05, Math.min(3, online / 10)));
  wb.alive = m; wb.dmg = new Map(); wb.startAt = now();
  S.announce(`🌋 WORLD BOSS [${def.name}] ปรากฏแล้วที่ ${inst.def.name}! (PvP เปิดในพื้นที่)`, 'boss');
  return true;
};
S.wbDamage = function (p, dmg) {
  const e = wb.dmg.get(p.char.id) || { name: p.name, dmg: 0, guild: p.char.guild, cls: p.cls };
  e.dmg += dmg; e.guild = p.char.guild; wb.dmg.set(p.char.id, e);
  if (!p.wbCounted) P.event(p, 'wb');
};
S.wbRanking = () => [...wb.dmg.entries()].sort((a, b) => b[1].dmg - a[1].dmg);
S.onWorldBossDeath = function (m) {
  const rank = S.wbRanking();
  wb.alive = null; m.inst.alwaysOn = false;
  const rr = RNG.rng(Date.now() & 0xffff);
  rank.forEach(([cid, e], i) => {
    const ch = db.data.chars[cid]; if (!ch) return;
    const p = W.players.get(cid);
    let rar, extra;
    if (i === 0) { rar = 5; extra = [['crystal_divine', 3], ['scroll_bless', 1]]; }
    else if (i < 10) { rar = 4; extra = [['crystal_divine', 2]]; }
    else if (i < 50) { rar = 3; extra = [['crystal_pure', 2]]; }
    else { rar = 2; extra = [['crystal_pure', 1]]; }
    const it = F.genEquip(rr, rr.pick(D.SLOTS.filter((s) => s !== 'ring2')), Math.max(ch.lv, 100), rar, D.CLASSES[ch.cls].weapon);
    I.addEquip(ch, it); for (const [id, q] of extra) I.addItem(ch, id, q);
    ch.zeny += 50000 * (i < 10 ? 4 : 1);
    if (p) { note(p, `World Boss รางวัลอันดับ ${i + 1}: [${D.RARITY[rar].n}] ${it.name}`, 'boss'); C.sendChar(p, ['inv', 'zeny']); P.event(p, 'kill', { rank: 4, exp: 0 }); p.wbCounted = false; }
  });
  const gsum = {};
  for (const [, e] of rank) if (e.guild) gsum[e.guild] = (gsum[e.guild] || 0) + e.dmg;
  const topG = Object.entries(gsum).sort((a, b) => b[1] - a[1])[0];
  if (topG) db.data.wbGuild = { gid: topG[0], until: Date.now() + 24 * 3600e3 };
  const top = rank.slice(0, 3).map(([, e], i) => `${i + 1}. ${e.name} (${e.dmg.toLocaleString()})`).join('  ');
  S.announce(`🏆 World Boss [${m.name}] ถูกโค่นแล้ว! ${top}${topG && G()[topG[0]] ? ` | กิลด์ดาเมจสูงสุด: ${G()[topG[0]].name} (+5% ATK/EXP 24 ชม.)` : ''}`, 'boss');
  db.data.worldBossLog.push({ at: Date.now(), name: m.name, top: rank.slice(0, 10).map(([, e]) => [e.name, e.dmg]) });
  if (db.data.worldBossLog.length > 50) db.data.worldBossLog.shift();
  db.dirty = true;
  for (const p of W.players.values()) if (p.char.guild) C.recalc(p);
};

// ------------------------------------------------------------------ scheduler & misc
S.secondTick = function (t) {
  P.secondTick(t);
  if (Math.floor(t) % 60 === 0) E.ahExpire();
  for (const id in fieldBoss) {
    const st = fieldBoss[id];
    if (!st.alive && t >= st.nextAt) { const inst = W.instances.get(id); if (inst && inst.spawned) spawnFieldBoss(inst); else st.nextAt = t + 120; }
    if (st.alive && st.alive.dead) st.alive = null;
  }
  const d = new Date();
  const key = d.toDateString() + d.getHours();
  // world boss schedule
  if (D.WORLD_BOSS_HOURS.includes(d.getHours() + 1) && d.getMinutes() === 50 && wb.announced !== key) { wb.announced = key; S.announce('⏰ World Boss จะปรากฏในอีก 10 นาที ที่ Ruined Sanctum!', 'boss'); }
  if (D.WORLD_BOSS_HOURS.includes(d.getHours()) && d.getMinutes() === 0 && wb.lastKey !== key) { wb.lastKey = key; S.spawnWorldBoss(); }
  if (wb.alive && t - wb.startAt > 1800 && !wb.alive.dead) { S.announce(`World Boss [${wb.alive.name}] หนีไปแล้ว...`, 'boss'); wb.alive.inst.remove(wb.alive); wb.alive = null; }
  // guild war schedule
  const gs = D.GVG_SCHEDULE;
  if (d.getDay() === gs.day && d.getHours() === gs.hour && d.getMinutes() === 0 && gvg.lastKey !== key && !gvg.active) { gvg.lastKey = key; S.startGvg(); }
  if (gvg.active && t >= gvg.endsAt) S.stopGvg();
};
S.onLogout = function (p) { if (p.party) S.party(p, { a: 'leave' }); E.onLogout(p); const i = P.queue.findIndex((q) => q.p === p); if (i >= 0) P.queue.splice(i, 1); };

S.info = function (p, what) {
  if (what === 'gvg') {
    send(p, { t: 'info', what, active: gvg.active, endsIn: gvg.active ? Math.round(gvg.endsAt - now()) : 0, schedule: D.GVG_SCHEDULE,
      castles: D.CASTLES.map((c) => { const o = S.castleOwner(c.id); const inst = W.instances.get(c.id); return { id: c.id, name: c.name, th: c.th, owner: o && G()[o] ? G()[o].name : null, core: inst && inst.core ? Math.round(inst.core.hp / inst.core.maxHp * 100) : 100 }; }) });
  } else if (what === 'wb') {
    send(p, { t: 'info', what, alive: S.worldBossAlive() ? { name: wb.alive.name, hp: Math.round(wb.alive.hp / wb.alive.maxHp * 1000) / 10 } : null, hours: D.WORLD_BOSS_HOURS,
      rank: S.wbRanking().slice(0, 20).map(([, e]) => [e.name, e.dmg, e.cls]), log: db.data.worldBossLog.slice(-5) });
  } else if (what === 'rank') {
    const chars = Object.values(db.data.chars);
    const top = (f) => chars.sort((a, b) => f(b) - f(a)).slice(0, 15).map((c) => ({ name: c.name, cls: c.cls, lv: c.lv, v: f(c) }));
    send(p, { t: 'info', what, level: top((c) => c.lv * 1e9 + c.exp), pvp: top((c) => c.pvpKills || 0), combo: top((c) => c.bestCombo || 0),
      tower: top((c) => Math.max(0, ...Object.values(c.dungeonBest || {}))) });
  } else if (what === 'boss') {
    send(p, { t: 'info', what, list: D.FARM_MAPS.map((f) => { const st = fieldBoss[f.id]; return { map: f.name, alive: !!(st && st.alive), next: st && !st.alive ? Math.max(0, Math.round(st.nextAt - now())) : null }; }) });
  }
};

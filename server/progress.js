// Quests, dailies, login rewards, achievements/titles, friends, pets, mounts, PK karma, ranked arena, guild progression, emotes.
const D = require('../shared/data2.js');
const db = require('./db');
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const S = require('./social');

const P = module.exports;
const send = (p, m) => p && p.sess && p.sess.send(m);
const err = (p, m) => { send(p, { t: 'err', m }); return false; };
const note = (p, m, k = 'system') => send(p, { t: 'notice', k, m });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const now = () => Date.now() / 1000;

// ------------------------------------------------------------------ char init
P.init = function (ch) {
  ch.cnt = ch.cnt || {};
  ch.quests = ch.quests || { main: 0, prog: 0, daily: null };
  ch.ach = ch.ach || [];
  ch.titles = ch.titles || [];
  ch.friends = ch.friends || [];
  ch.pets = ch.pets || [];
  ch.mounts = ch.mounts || [];
  ch.login = ch.login || { last: '', streak: 0, claimed: '' };
  if (ch.mmr === undefined) { ch.mmr = 1000; ch.rw = 0; ch.rl = 0; }
  ch.karma = ch.karma || 0;
  ensureDaily(ch);
};
function ensureDaily(ch) {
  const d = today();
  if (ch.quests.daily && ch.quests.daily.day === d) return false;
  const pool = [...D.DAILY_POOL].sort(() => Math.random() - 0.5).slice(0, D.DAILY_COUNT);
  ch.quests.daily = { day: d, list: pool.map((q) => ({ id: q.id, prog: 0, done: 0, claimed: 0 })) };
  return true;
}
P.payload = function (p) {
  const c = p.char;
  return { quests: c.quests, ach: c.ach, titles: c.titles, title: c.title || '', friends: P.friendList(c), pets: c.pets, pet: c.pet || null, mounts: c.mounts, mount: p.mounted || '',
    login: c.login, cnt: c.cnt, mmr: c.mmr, rw: c.rw, rl: c.rl, karma: c.karma, unread: P.unread ? P.unread(c) : 0, guildX: guildX(c.guild), queue: !!queue.find((q) => q.p === p) };
};
P.sync = (p, keys) => C.sendChar(p, keys);
P.onLogin = function (p) {
  const c = p.char;
  P.init(c);
  c.cnt.logins = (c.cnt.logins || 0) + 1;
  p.mounted = '';
  p.title = c.title || '';
  for (const q of W.players.values()) if (q !== p && (q.char.friends || []).includes(c.name)) note(q, `เพื่อน ${c.name} ออนไลน์แล้ว`);
  P.checkAch(p);
};

// ------------------------------------------------------------------ extra stat mods (pets, mounts, guild skills, achievements)
P.extraMods = function (p) {
  const c = p.char, m = {};
  const add = (k, v) => { m[k] = (m[k] || 0) + v; };
  if (c.pet) { const pd = D.PETS[c.pet.id]; if (pd) add(pd.stat, Math.round(pd.per * c.pet.lv * 10) / 10); }
  if (p.mounted && D.MOUNTS[p.mounted]) add('movePct', D.MOUNTS[p.mounted].speed);
  for (const id of c.ach || []) { const a = D.ACHIEVEMENTS.find((x) => x.id === id); if (a && a.bonus) for (const k in a.bonus) add(k, a.bonus[k]); }
  const g = c.guild && db.data.guilds[c.guild];
  if (g && g.skills) for (const k in g.skills) { const gs = D.GUILD_SKILLS[k]; if (gs) for (const s in gs.mods) add(s, gs.mods[s] * g.skills[k]); }
  return m;
};
P.expBonus = function (p) {
  let b = 0;
  for (const bf of p.buffs.values()) if (bf.mods.expPct) b += bf.mods.expPct;
  const g = p.char.guild && db.data.guilds[p.char.guild];
  if (g && g.skills && g.skills.fortune) b += D.GUILD_SKILLS.fortune.mods.expPct * g.skills.fortune;
  return b;
};

// ------------------------------------------------------------------ events → quests / dailies / achievements
P.event = function (p, type, data = {}) {
  if (!p || !p.char) return;
  const c = p.char; P.init(c);
  const cnt = c.cnt;
  let qChanged = false;
  switch (type) {
    case 'kill': cnt.kills = (cnt.kills || 0) + 1; if (data.rank === 1) cnt.elites = (cnt.elites || 0) + 1; if (data.rank >= 2) cnt.bosses = (cnt.bosses || 0) + 1; petExp(p, 1 + (data.rank || 0) * 3); guildExp(c, data.exp || 0); break;
    case 'refine': cnt.refine = Math.max(cnt.refine || 0, data.to || 0); break;
    case 'craft': cnt.crafts = (cnt.crafts || 0) + (data.n || 1); break;
    case 'sell': cnt.sold = (cnt.sold || 0) + 1; break;
    case 'wb': if (!p.wbCounted) { p.wbCounted = true; cnt.wb = (cnt.wb || 0) + 1; } break;
    case 'pvp': cnt.pvp = (cnt.pvp || 0) + 1; break;
  }
  // main quest
  const mq = D.MAIN_QUESTS[c.quests.main];
  if (mq && c.lv >= mq.lv) {
    let prog = c.quests.prog;
    if (mq.type === 'kill' && type === 'kill' && p.inst && p.inst.mapId === mq.map) prog++;
    if (mq.type === 'floor') prog = Math.max(prog, (c.dungeonBest || {})[mq.dg] || 0);
    if (mq.type === 'level') prog = c.lv;
    prog = Math.min(prog, mq.v);
    if (prog !== c.quests.prog) { c.quests.prog = prog; qChanged = true; if (prog >= mq.v) note(p, `📜 ภารกิจ "${mq.n}" สำเร็จ! ไปรับรางวัลที่ Quest Board / หน้าต่างภารกิจ (L)`, 'level'); }
  }
  // dailies
  if (ensureDaily(c)) qChanged = true;
  for (const dq of c.quests.daily.list) {
    if (dq.done) continue;
    const def = D.DAILY_POOL.find((x) => x.id === dq.id); if (!def) continue;
    let inc = 0;
    if (def.type === 'kill' && type === 'kill') inc = 1;
    if (def.type === 'elite' && type === 'kill' && data.rank === 1) inc = 1;
    if (def.type === 'boss' && type === 'kill' && data.rank >= 2) inc = 1;
    if (def.type === 'combo' && type === 'combo' && data.n >= def.v) inc = def.v;
    if (def.type === type && ['floor', 'refine', 'craft', 'pvp', 'sell', 'skill'].includes(type)) inc = data.n || 1;
    if (inc) { dq.prog = Math.min(def.v, dq.prog + inc); qChanged = true; if (dq.prog >= def.v) { dq.done = 1; note(p, `✅ ภารกิจรายวัน "${def.n}" สำเร็จ!`, 'level'); } }
  }
  if (qChanged && (!p.qSyncAt || now() - p.qSyncAt > 1 || type !== 'kill' && type !== 'skill')) { p.qSyncAt = now(); P.sync(p, ['quests']); }
  if (type !== 'skill' && type !== 'kill' || (cnt.kills || 0) % 25 === 0) P.checkAch(p);
};
P.checkAch = function (p) {
  const c = p.char; const cnt = c.cnt;
  const val = { kills: cnt.kills, elites: cnt.elites, bosses: cnt.bosses, lv: c.lv, combo: c.bestCombo, refine: cnt.refine, floor: Math.max(0, ...Object.values(c.dungeonBest || {})),
    pvp: c.pvpKills, wb: cnt.wb, crafts: cnt.crafts, sold: cnt.sold, quests: cnt.quests, dailies: cnt.dailies, petlv: Math.max(0, ...(c.pets || []).map((x) => x.lv)), mmr: c.mmr };
  let got = false;
  for (const a of D.ACHIEVEMENTS) {
    if (c.ach.includes(a.id)) continue;
    if ((val[a.stat] || 0) >= a.v) {
      c.ach.push(a.id); if (a.title && !c.titles.includes(a.title)) c.titles.push(a.title);
      got = true;
      note(p, `🏅 ความสำเร็จใหม่: ${a.n} — ได้ฉายา「${a.title}」${a.bonus ? ' + โบนัสถาวร' : ''}`, 'level');
      p.inst && p.inst.emit({ k: 'ach', t: p.id, x: p.x, y: p.y, m: a.n });
    }
  }
  if (got) { C.recalc(p); P.sync(p, ['ach', 'titles', 'st']); }
};
P.setTitle = function (p, t) {
  if (t && !p.char.titles.includes(t)) return;
  p.char.title = t || ''; p.title = p.char.title;
  for (const q of p.inst.players) q.known.delete(p.id);
  P.sync(p, ['title']);
};

P.claimQuest = function (p, kind, id) {
  const c = p.char; P.init(c);
  if (kind === 'main') {
    const mq = D.MAIN_QUESTS[c.quests.main];
    if (!mq) return err(p, 'ทำภารกิจหลักครบแล้ว!');
    if (mq.type === 'level') c.quests.prog = c.lv;
    if (mq.type === 'floor') c.quests.prog = Math.min(mq.v, (c.dungeonBest || {})[mq.dg] || 0);
    if (c.quests.prog < mq.v) return err(p, 'ภารกิจยังไม่สำเร็จ');
    giveReward(p, mq.reward);
    c.quests.main++; c.quests.prog = 0; c.cnt.quests = (c.cnt.quests || 0) + 1;
    note(p, `📜 รับรางวัล "${mq.n}" แล้ว!`, 'level');
    const nx = D.MAIN_QUESTS[c.quests.main];
    if (nx) P.event(p, 'check');
  } else {
    ensureDaily(c);
    const dq = c.quests.daily.list.find((x) => x.id === id);
    if (!dq || !dq.done || dq.claimed) return err(p, 'ยังรับรางวัลไม่ได้');
    dq.claimed = 1; c.cnt.dailies = (c.cnt.dailies || 0) + 1;
    giveReward(p, { expMul: 3, zeny: 3000 + c.lv * 400, items: [['daily_token', 3], [c.lv < 60 ? 'ore_refine' : 'crystal_pure', c.lv < 60 ? 3 : 1]] });
    if (c.quests.daily.list.every((x) => x.claimed)) { giveReward(p, { items: [['daily_token', 5], ['exp_scroll', 1]] }); note(p, '🎁 โบนัสทำภารกิจรายวันครบ: Valor Token ×5 + Scroll of Wisdom', 'level'); }
  }
  P.checkAch(p);
  P.sync(p, ['quests', 'inv', 'zeny', 'lv', 'statPts', 'skillPts']);
};
function giveReward(p, r) {
  const c = p.char;
  if (r.expMul) I.gainExp(p, require('../shared/formulas.js').expToNext(c.lv) * r.expMul / 100 * 10 / (db.data.settings.exp || 1));
  if (r.zeny) c.zeny += r.zeny;
  for (const [id, q] of r.items || []) if (!I.addItem(c, id, q)) P.mailSystem && P.mailSystem(c.id, 'รางวัล (กระเป๋าเต็ม)', '', [{ id, qty: q }], 0);
}
P.giveReward = giveReward;
P.claimLogin = function (p) {
  const c = p.char; P.init(c);
  const d = today();
  if (c.login.claimed === d) return err(p, 'รับรางวัลวันนี้แล้ว');
  const y = new Date(Date.now() - 86400e3); const yd = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  c.login.streak = c.login.claimed === yd ? c.login.streak + 1 : 1;
  c.login.claimed = d;
  const day = (c.login.streak - 1) % 7;
  giveReward(p, D.LOGIN_REWARDS[day]);
  note(p, `🎁 รางวัลล็อกอินวันที่ ${day + 1}/7 (ต่อเนื่อง ${c.login.streak} วัน)`, 'level');
  P.sync(p, ['login', 'inv', 'zeny']);
};

// ------------------------------------------------------------------ friends & emotes
P.friendList = (c) => (c.friends || []).map((n) => { const q = W.findPlayerByName(n); return { name: n, on: q ? 1 : 0, lv: q ? q.lv : (db.charByName(n) || {}).lv || 0, cls: q ? q.cls : (db.charByName(n) || {}).cls || '', map: q && q.inst ? q.inst.def.name : '' }; });
P.friend = function (p, a, name) {
  const c = p.char; P.init(c);
  if (a === 'add') {
    const t = db.charByName(name); if (!t) return err(p, 'ไม่พบตัวละครชื่อนี้');
    if (t.id === c.id) return; if (c.friends.length >= 100) return err(p, 'เพื่อนเต็ม 100 คน');
    if (!c.friends.includes(t.name)) c.friends.push(t.name);
    const q = W.players.get(t.id); if (q) note(q, `${c.name} เพิ่มคุณเป็นเพื่อน`);
  } else if (a === 'remove') c.friends = c.friends.filter((x) => x.toLowerCase() !== String(name).toLowerCase());
  P.sync(p, ['friends']);
};
P.emote = function (p, i) {
  const e = D.EMOTES[i | 0]; if (!e || !p.inst) return;
  if ((p.emoteAt || 0) > now()) return; p.emoteAt = now() + 1.5;
  p.inst.emit({ k: 'emote', t: p.id, x: p.x, y: p.y, e });
};

// ------------------------------------------------------------------ pets & mounts
P.useSpecial = function (p, it, def) {
  const c = p.char; P.init(c);
  if (def.type === 'pet') {
    if (c.lv < def.lv) return err(p, `ต้องเลเวล ${def.lv}`);
    if (c.pets.find((x) => x.id === def.pet)) return err(p, 'มีสัตว์เลี้ยงตัวนี้แล้ว');
    I.consume(c, it.id, 1); c.pets.push({ id: def.pet, lv: 1, exp: 0 }); if (!c.pet) c.pet = c.pets[c.pets.length - 1];
    note(p, `🐾 ได้สัตว์เลี้ยงใหม่: ${D.PETS[def.pet].n}!`, 'level'); C.recalc(p); refreshLook(p); P.sync(p, ['pets', 'pet', 'inv', 'st']); return true;
  }
  if (def.type === 'mount') {
    if (c.lv < def.lv) return err(p, `ต้องเลเวล ${def.lv}`);
    if (c.mounts.includes(def.mount)) return err(p, 'มีพาหนะนี้แล้ว');
    I.consume(c, it.id, 1); c.mounts.push(def.mount); c.mount = def.mount;
    note(p, `🐎 ได้พาหนะใหม่: ${D.MOUNTS[def.mount].n}! กด T เพื่อขี่`, 'level'); P.sync(p, ['mounts', 'inv']); return true;
  }
  if (def.type === 'petfood') {
    if (!c.pet) return err(p, 'ต้องเรียกสัตว์เลี้ยงก่อน');
    if (c.pet.lv >= D.PET_MAX) return err(p, 'สัตว์เลี้ยงเลเวลสูงสุดแล้ว');
    I.consume(c, it.id, 1); petExp(p, 40); P.sync(p, ['inv']); return true;
  }
  if (def.type === 'buffitem') {
    I.consume(c, it.id, 1); C.addBuff(p, 'item:' + it.id, def.buff, def.dur, def.n, def.icon);
    p.inst.emit({ k: 'buffed', t: p.id, x: p.x, y: p.y }); P.sync(p, ['inv']); return true;
  }
  return false;
};
function petExp(p, n) {
  const c = p.char; if (!c.pet) return;
  const pet = c.pets.find((x) => x.id === c.pet.id) || c.pet;
  if (pet.lv >= D.PET_MAX) return;
  pet.exp += n;
  let up = false;
  while (pet.lv < D.PET_MAX && pet.exp >= D.petExpNext(pet.lv)) { pet.exp -= D.petExpNext(pet.lv); pet.lv++; up = true; }
  c.pet = pet;
  if (up) { note(p, `🐾 ${D.PETS[pet.id].n} เลเวลอัปเป็น ${pet.lv}!`, 'level'); C.recalc(p); P.sync(p, ['pets', 'pet', 'st']); P.checkAch(p); }
}
P.setPet = function (p, id) {
  const c = p.char;
  if (!id) c.pet = null; else { const pet = c.pets.find((x) => x.id === id); if (!pet) return; c.pet = pet; }
  C.recalc(p); refreshLook(p); P.sync(p, ['pet', 'st']);
};
P.toggleMount = function (p, id) {
  const c = p.char;
  if (p.mounted && !id) { p.mounted = ''; }
  else {
    const m = id || c.mount || c.mounts[0];
    if (!m || !c.mounts.includes(m)) return err(p, 'ยังไม่มีพาหนะ (ซื้อที่ Tamer Rook ในเมือง)');
    if (p.inst.def.kind === 'castle' || p.inst.def.kind === 'dungeon' || p.inst.mapId === 'duel_arena') return err(p, 'ขี่พาหนะในพื้นที่นี้ไม่ได้');
    if (p.lastHit && now() - p.lastHit < 3) return err(p, 'อยู่ในการต่อสู้');
    p.mounted = m; c.mount = m;
  }
  C.recalc(p); refreshLook(p); P.sync(p, ['mount', 'st']);
  p.inst.emit({ k: 'poof', x: p.x, y: p.y });
};
P.dismount = function (p) { if (p.mounted) { p.mounted = ''; C.recalc(p); refreshLook(p); P.sync(p, ['mount', 'st']); } };
function refreshLook(p) { if (p.inst) for (const q of p.inst.players) q.known.delete(p.id); }
P.refreshLook = refreshLook;

// ------------------------------------------------------------------ PK karma
P.onPvpKill = function (k, v) {
  const inst = k.inst;
  P.event(k, 'pvp');
  if (inst.ranked) return finishRanked(inst.ranked, k, v);
  if (inst.def.pk && !(k.duel) && (v.char.karma || 0) === 0 && !(v.lastPvpHit && v.lastPvpHit.by === v)) {
    // attacker of an innocent becomes "red"
    k.char.karma = Math.min(10, (k.char.karma || 0) + 1); refreshLook(k);
    note(k, `☠ คุณฆ่าผู้บริสุทธิ์ — Karma ${k.char.karma} (ชื่อแดง, ตายจะดรอปของ)`, 'warn');
  }
  if ((v.char.karma || 0) > 0 && inst.def.pk) {
    const c = v.char;
    const loss = Math.floor(c.zeny * 0.05); c.zeny -= loss; k.char.zeny += loss;
    const pool = c.inv.filter((it) => it.type !== 'equip' && D.ITEMS[it.id] && D.ITEMS[it.id].type !== 'currency');
    if (pool.length) {
      const it = pool[Math.floor(Math.random() * pool.length)]; const q = Math.max(1, Math.floor(it.qty / 2));
      I.consume(c, it.id, q); I.addItem(k.char, it.id, q);
      note(v, `คุณชื่อแดง! ดรอป ${D.ITEMS[it.id].n} ×${q} และ ${loss.toLocaleString()} Zeny`, 'warn');
    }
    c.karma = Math.max(0, c.karma - 1); refreshLook(v);
    C.sendChar(v, ['inv', 'zeny']); C.sendChar(k, ['inv', 'zeny']);
  }
};

// ------------------------------------------------------------------ ranked arena (1v1 queue, Elo)
const queue = []; let matchSeq = 1;
P.queue = queue;
P.rankedJoin = function (p, on) {
  const i = queue.findIndex((q) => q.p === p);
  if (!on) { if (i >= 0) queue.splice(i, 1); P.sync(p, ['queue']); return; }
  if (i >= 0) return;
  if (p.inst.ranked) return err(p, 'อยู่ในแมตช์');
  if (p.char.lv < 30) return err(p, 'ต้องเลเวล 30 ขึ้นไป');
  queue.push({ p, at: now(), mmr: p.char.mmr });
  note(p, `⚔ เข้าคิวจัดอันดับแล้ว (MMR ${p.char.mmr}) — ผู้เล่นในคิว ${queue.length}`);
  P.sync(p, ['queue']);
};
function startMatch(a, b) {
  const id = matchSeq++;
  const inst = W.getInstance('duel_arena#R' + id);
  if (!inst.spawned) W.populate(inst);
  const m = inst.ranked = { id, a, b, start: now() + 4, end: now() + 184, done: false, inst, from: { [a.char.id]: a.char.lastTown || 'aurelia', [b.char.id]: b.char.lastTown || 'aurelia' } };
  const cx = inst.map.w / 2, cy = inst.map.h / 2;
  for (const [p, dx] of [[a, -6], [b, 6]]) {
    P.dismount(p);
    if (p.auto.on) require('./auto').setOn(p, false);
    W.enterMap(p, inst.id, cx + dx, cy);
    p.dead = false; p.hp = p.maxHp; p.sp = p.maxSp; p.cds = {}; p.ult = 0; p.tags.clear();
    p.invulnUntil = m.start; C.applyTag(p, 'root', 1, 4, null, { quiet: true });
    send(p, { t: 'ranked', state: 'start', vs: (p === a ? b : a).name, vsCls: (p === a ? b : a).cls, vsMmr: (p === a ? b : a).char.mmr, at: 4 });
    send(p, { t: 'cdreset' });
  }
}
function finishRanked(m, winner, loser) {
  if (m.done) return; m.done = true;
  const wa = winner.char, la = loser.char;
  const ea = 1 / (1 + Math.pow(10, (la.mmr - wa.mmr) / 400));
  const delta = Math.max(5, Math.round(32 * (1 - ea)));
  wa.mmr += delta; la.mmr = Math.max(0, la.mmr - delta); wa.rw = (wa.rw || 0) + 1; la.rl = (la.rl || 0) + 1;
  I.addItem(wa, 'arena_token', 3); I.addItem(la, 'arena_token', 1);
  for (const [p, won] of [[winner, true], [loser, false]]) {
    send(p, { t: 'ranked', state: 'end', won, delta: won ? delta : -delta, mmr: p.char.mmr, tier: D.rankTier(p.char.mmr)[1] });
    P.checkAch(p);
  }
  if (D.rankTier(wa.mmr)[0] >= 1700) S.announce(`🏆 ${wa.name} ชนะจัดอันดับ — MMR ${wa.mmr} (${D.rankTier(wa.mmr)[1]})`, 'pvp');
  m.inst.after(4, () => {
    for (const p of [winner, loser]) if (p.inst === m.inst && W.players.get(p.char.id)) { p.dead = false; p.hp = p.maxHp; W.enterMap(p, m.from[p.char.id]); P.sync(p, ['mmr', 'rw', 'rl', 'inv', 'queue']); }
  });
}
P.secondTick = function (t) {
  // matchmaking: widen MMR window over time
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    if (!W.players.get(q.p.char.id) || !q.p.sess) { queue.splice(i--, 1); continue; }
    const win = 150 + (t - q.at) * 10;
    const j = queue.findIndex((o, k) => k !== i && Math.abs(o.mmr - q.mmr) <= win);
    if (j >= 0) { const o = queue[j]; queue.splice(Math.max(i, j), 1); queue.splice(Math.min(i, j), 1); i = -1; startMatch(q.p, o.p); }
  }
  for (const inst of W.instances.values()) {
    const m = inst.ranked; if (!m || m.done) continue;
    if (t > m.end) { const a = m.a, b = m.b; const ap = a.hp / a.maxHp, bp = b.hp / b.maxHp; finishRanked(m, ap >= bp ? a : b, ap >= bp ? b : a); }
    else if (m.a.inst !== inst || !W.players.get(m.a.char.id)) finishRanked(m, m.b, m.a);
    else if (m.b.inst !== inst || !W.players.get(m.b.char.id)) finishRanked(m, m.a, m.b);
  }
  // karma decay every 10 min of online time
  if (Math.floor(t) % 600 === 0) for (const p of W.players.values()) if (p.char.karma > 0) { p.char.karma--; refreshLook(p); }
};

// ------------------------------------------------------------------ guild progression
function guildX(gid) {
  const g = gid && db.data.guilds[gid]; if (!g) return null;
  g.lv = g.lv || 1; g.exp = g.exp || 0; g.skills = g.skills || {}; g.storage = g.storage || [];
  const spent = Object.values(g.skills).reduce((a, b) => a + b, 0);
  return { lv: g.lv, exp: g.exp, next: D.guildExpNext(g.lv), skills: g.skills, points: g.lv - 1 - spent, storage: g.storage };
}
P.guildX = guildX;
function guildExp(c, exp) {
  const g = c.guild && db.data.guilds[c.guild]; if (!g || !exp) return;
  guildX(c.guild);
  if (g.lv >= D.GUILD_MAX_LV) return;
  g.exp += Math.max(1, Math.round(exp * 0.03));
  if (g.exp >= D.guildExpNext(g.lv)) {
    g.exp -= D.guildExpNext(g.lv); g.lv++;
    S.guildChat(g.id, '', `🎉 กิลด์เลเวลอัปเป็น Lv ${g.lv}! ได้แต้มสกิลกิลด์ +1 (สมาชิกสูงสุด ${50 + g.lv * 5})`);
    for (const p of W.players.values()) if (p.char.guild === g.id) P.sync(p, ['guildX']);
  }
}
P.guildSkill = function (p, k) {
  const g = p.char.guild && db.data.guilds[p.char.guild];
  if (!g || g.master !== p.char.id) return err(p, 'เฉพาะ Guild Master');
  const x = guildX(g.id); const def = D.GUILD_SKILLS[k];
  if (!def) return; if (x.points <= 0) return err(p, 'แต้มสกิลกิลด์ไม่พอ (ได้จากเลเวลกิลด์)');
  if ((g.skills[k] || 0) >= def.max) return err(p, 'สกิลเลเวลสูงสุดแล้ว');
  g.skills[k] = (g.skills[k] || 0) + 1; db.dirty = true;
  for (const q of W.players.values()) if (q.char.guild === g.id) { C.recalc(q); P.sync(q, ['guildX', 'st']); }
};
P.guildStorage = function (p, a, uid, qty) {
  const c = p.char; const g = c.guild && db.data.guilds[c.guild];
  if (!g) return err(p, 'ไม่มีกิลด์');
  if (p.inst.def.kind !== 'town') return err(p, 'ใช้คลังกิลด์ได้ในเมือง');
  guildX(g.id);
  if (a === 'put') {
    const it = I.find(c, uid); if (!it) return;
    if (g.storage.length >= 60 + g.lv * 5) return err(p, 'คลังกิลด์เต็ม');
    const taken = I.removeUid(c, uid, it.type === 'equip' ? undefined : (qty || it.qty));
    if (taken.type !== 'equip') { const ex = g.storage.find((x) => x.id === taken.id); if (ex) ex.qty += taken.qty; else g.storage.push(Object.assign({}, taken, { uid: 'u' + db.nextId() })); }
    else g.storage.push(taken);
    S.guildChat(g.id, '', `${c.name} ฝาก ${I.itemName(taken)} ×${taken.qty || 1} เข้าคลังกิลด์`);
  } else if (a === 'take') {
    const rank = g.members[c.id] && g.members[c.id].rank;
    if (rank !== 'master' && rank !== 'officer') return err(p, 'เฉพาะ Master/Officer เบิกของได้');
    const i = g.storage.findIndex((x) => x.uid === uid); if (i < 0) return;
    const it = g.storage[i];
    if (it.type === 'equip') { if (!I.addEquip(c, it)) return err(p, 'กระเป๋าเต็ม'); g.storage.splice(i, 1); }
    else { const q = Math.min(it.qty, qty || it.qty); if (!I.addItem(c, it.id, q)) return err(p, 'กระเป๋าเต็ม'); it.qty -= q; if (it.qty <= 0) g.storage.splice(i, 1); }
    S.guildChat(g.id, '', `${c.name} เบิก ${I.itemName(it)} จากคลังกิลด์`);
  }
  db.dirty = true;
  for (const q of W.players.values()) if (q.char.guild === g.id) P.sync(q, ['guildX']);
  P.sync(p, ['inv']);
};

// Inventory, character progression, drops, shop, refine +20, runes & jewels.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const RNG = require('../shared/rng.js');
const { SKILLS, CLASS_SKILLS } = require('../shared/skills.js');
const db = require('./db');
const W = require('./world');
const C = require('./combat');
const S = require('./social');
const P = require('./progress');

const I = module.exports;
const INV_MAX = 150;
const r = RNG.rng(Date.now() & 0xffffffff);
const uid = () => 'u' + db.nextId();
const send = (p, m) => p.sess && p.sess.send(m);
const err = (p, m) => { send(p, { t: 'err', m }); return false; };
const note = (p, m, k = 'system') => send(p, { t: 'notice', k, m });

// ------------------------------------------------------------------ character creation
I.newChar = function (acc, name, cls) {
  const c = D.CLASSES[cls];
  const id = 'c' + db.nextId();
  const ch = {
    id, acc: acc.user.toLowerCase(), name, cls, lv: 1, exp: 0, statPts: 5, stats: Object.assign({}, c.start), skillPts: 3, skills: {},
    hotbar: new Array(50).fill(null), inv: [], equip: {}, zeny: 2500, map: 'aurelia', lastTown: 'aurelia', x: undefined, y: undefined,
    dungeonBest: {}, created: Date.now(), ult: 0, pity: 0, kills: 0, pvpKills: 0, kitVer: 4
  };
  const first = CLASS_SKILLS[cls][0];
  ch.skills[first] = 1; ch.hotbar[0] = first;
  const w = F.genEquip(r, 'weapon', 1, 0, c.weapon); w.uid = uid(); ch.equip.weapon = w;
  const a = F.genEquip(r, 'armor', 1, 0); a.uid = uid(); ch.equip.armor = a;
  const b = F.genEquip(r, 'boots', 1, 0); b.uid = uid(); ch.equip.boots = b;
  I.addItem(ch, 'pot_hp_1', 30); I.addItem(ch, 'pot_sp_1', 10); I.addItem(ch, 'tele_scroll', 5); I.addItem(ch, 'ore_refine', 5);
  I.defaultHotbar(ch);
  P.init(ch);
  return ch;
};

// hotbar = 30 slots in 3 rows of 10: 0-24 hold all 25 class skills in order (attacks 1-15, buffs, ultimates, set ultimate),
// 25-29 (the end of row 3) are item slots for potions and other consumables
I.HB_SKILLS = 25; I.HB_TOTAL = 30;
I.defaultHotbar = function (ch) { const L = CLASS_SKILLS[ch.cls] || []; for (let i = 0; i < I.HB_SKILLS; i++) ch.hotbar[i] = L[i] || null; ch.hotbar[25] = 'item:pot_hp_1'; ch.hotbar[26] = 'item:pot_sp_1'; };
// older 50-slot bars: pull anything parked in slots 20+ into free slots of the two pages
I.compactHotbar = function (ch) { const h = ch.hotbar || []; for (let i = 20; i < h.length; i++) { if (!h[i]) continue; const j = h.findIndex((x, k) => k < 20 && !x); if (j >= 0 && !h.slice(0, 20).includes(h[i])) h[j] = h[i]; h[i] = null; } };
// ------------------------------------------------------------------ inventory primitives
I.count = (ch, id) => ch.inv.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0);
I.find = (ch, u) => ch.inv.find((it) => it.uid === u);
I.addItem = function (ch, id, qty = 1) {
  if (!D.ITEMS[id]) return false;
  const st = ch.inv.find((it) => it.id === id);
  if (st) { st.qty += qty; return true; }
  if (ch.inv.length >= INV_MAX) return false;
  ch.inv.push({ uid: uid(), id, qty });
  return true;
};
I.addEquip = function (ch, it) {
  if (ch.inv.length >= INV_MAX) return false;
  it.uid = it.uid || uid();
  ch.inv.push(it);
  return true;
};
I.consume = function (ch, id, qty) {
  if (I.count(ch, id) < qty) return false;
  for (const it of ch.inv) {
    if (it.id !== id || qty <= 0) continue;
    const take = Math.min(qty, it.qty); it.qty -= take; qty -= take;
  }
  ch.inv = ch.inv.filter((it) => it.type === 'equip' || it.qty > 0);
  return true;
};
I.removeUid = function (ch, u, qty) {
  const it = I.find(ch, u); if (!it) return null;
  if (it.type === 'equip' || qty === undefined || qty >= it.qty) { ch.inv = ch.inv.filter((x) => x !== it); return it; }
  it.qty -= qty; return Object.assign({}, it, { qty });
};
const invSync = (p) => C.sendChar(p, ['inv', 'zeny']);
const fullSync = (p) => C.sendChar(p, ['inv', 'equip', 'zeny', 'st', 'gear']);
I.itemName = (it) => it.type === 'equip' ? `${it.refine ? '+' + it.refine + ' ' : ''}${it.name}` : (D.ITEMS[it.id] || {}).n || it.id;

// ------------------------------------------------------------------ progression
I.gainExp = function (p, amt) {
  const ch = p.char;
  if (ch.lv >= D.MAX_LEVEL) return;
  amt = Math.round(amt * (db.data.settings.exp || 1) * (1 + (S.castleBonus(p) + P.expBonus(p)) / 100));
  ch.exp += amt;
  let up = 0;
  while (ch.lv < D.MAX_LEVEL && ch.exp >= F.expToNext(ch.lv)) {
    ch.exp -= F.expToNext(ch.lv); ch.lv++; up++;
    ch.statPts += 5 + (ch.lv % 10 === 0 ? 3 : 0);
    ch.skillPts += 1 + (ch.lv % 5 === 0 ? 1 : 0);
  }
  if (ch.lv >= D.MAX_LEVEL) ch.exp = 0;
  if (up) {
    p.lv = ch.lv; C.recalc(p); p.hp = p.maxHp; p.sp = p.maxSp;
    p.inst.emit({ k: 'lvup', t: p.id, x: p.x, y: p.y });
    note(p, `เลเวลอัป! Lv ${ch.lv}  (+แต้มสกิล · +แต้ม Passive · ค่าสเตตัสเพิ่มอัตโนมัติ)`, 'level');
    if (ch.lv % 50 === 0 || ch.lv === D.MAX_LEVEL) S.broadcast({ t: 'notice', k: 'world', m: `🎉 ${ch.name} ถึงเลเวล ${ch.lv} แล้ว!` });
    C.sendChar(p, ['lv', 'next', 'skillPts', 'passivePts', 'st']);
    P.event(p, 'level'); P.checkAch(p);
  }
};

I.addStat = function (p) { return err(p, 'ค่าสเตตัสเพิ่มขึ้นอัตโนมัติทุกเลเวล — ใช้ Passive Tree เพื่อปรับแต่งตัวละคร'); };
I._oldAddStat = function (p, k, n) {
  const ch = p.char;
  if (!D.STATS.includes(k)) return;
  n = Math.max(1, Math.min(100, n | 0));
  for (let i = 0; i < n; i++) {
    const cost = F.statCost(ch.stats[k]);
    if (ch.statPts < cost || ch.stats[k] >= F.STAT_MAX) break;
    ch.statPts -= cost; ch.stats[k]++;
  }
  C.recalc(p); C.sendChar(p, ['stats', 'statPts', 'st']);
};
I.learn = function (p, id) {
  const ch = p.char, sk = SKILLS[id];
  if (!sk || sk.cls !== ch.cls) return err(p, 'สกิลไม่ถูกต้อง');
  const cur = ch.skills[id] || 0;
  if (cur >= sk.maxLv) return err(p, 'สกิลเลเวลสูงสุดแล้ว');
  if (ch.lv < sk.reqLv) return err(p, `ต้องเลเวล ${sk.reqLv}`);
  const cost = sk.kind === 'ult' ? 2 : 1;
  if (ch.skillPts < cost) return err(p, 'แต้มสกิลไม่พอ');
  ch.skillPts -= cost; ch.skills[id] = cur + 1;
  if (!cur) { const i = ch.hotbar.indexOf(null); if (i >= 0 && i < 25) ch.hotbar[i] = id; }
  C.sendChar(p, ['skills', 'skillPts', 'hotbar']);
};
I.resetSkills = function (p) {
  const ch = p.char;
  if (ch.lv > 100 && !I.consume(ch, 'memory_crystal', 1)) return err(p, 'ต้องใช้ Memory Crystal (ฟรีถึงเลเวล 100)');
  ch.skills = {}; const first = CLASS_SKILLS[ch.cls][0]; ch.skills[first] = 1;
  ch.skillPts = F.skillPointsAt(ch.lv) - 1;
  ch.hotbar = ch.hotbar.map((h) => (h && h.startsWith('item:') ? h : null)); ch.hotbar[0] = first;
  C.sendChar(p, ['skills', 'skillPts', 'hotbar', 'inv']); note(p, 'รีเซ็ตสกิลเรียบร้อย');
};
I.resetStats = function (p) { return P.passive(p, { a: 'reset' }); };
I._oldResetStats = function (p) {
  const ch = p.char;
  if (ch.lv > 50 && !I.consume(ch, 'stat_reset', 1)) return err(p, 'ต้องใช้ Rebirth Elixir (ฟรีถึงเลเวล 50)');
  ch.stats = Object.assign({}, D.CLASSES[ch.cls].start); ch.statPts = 5 + F.statPointsAt(ch.lv);
  C.recalc(p); C.sendChar(p, ['stats', 'statPts', 'st', 'inv']); note(p, 'รีเซ็ตสเตตัสเรียบร้อย');
};
I.setHotbar = function (p, slots) {
  if (!Array.isArray(slots)) return;
  p.char.hotbar = new Array(50).fill(null).map((_, i) => {
    const v = slots[i];
    if (typeof v !== 'string') return null;
    if (v.startsWith('item:') && D.ITEMS[v.slice(5)]) return v;
    return SKILLS[v] && SKILLS[v].cls === p.cls ? v : null;
  });
};

// ------------------------------------------------------------------ equip / use / sell
I.equip = function (p, u) {
  const ch = p.char, it = I.find(ch, u);
  if (!it || it.type !== 'equip') return err(p, 'ไอเทมนี้สวมใส่ไม่ได้');
  if (ch.lv < it.reqLv) return err(p, `ต้องเลเวล ${it.reqLv}`);
  if (it.slot === 'weapon' && it.wtype !== D.CLASSES[ch.cls].weapon) return err(p, `${D.CLASSES[ch.cls].name} ใช้อาวุธประเภท ${D.CLASSES[ch.cls].weapon} เท่านั้น`);
  let slot = it.slot;
  if (slot === 'ring') slot = !ch.equip.ring1 ? 'ring1' : !ch.equip.ring2 ? 'ring2' : 'ring1';
  I.removeUid(ch, u);
  if (ch.equip[slot]) ch.inv.push(ch.equip[slot]);
  ch.equip[slot] = it;
  C.recalc(p); fullSync(p);
  return true;
};
I.unequip = function (p, slot) {
  const ch = p.char;
  if (!ch.equip[slot]) return;
  if (ch.inv.length >= INV_MAX) return err(p, 'กระเป๋าเต็ม');
  ch.inv.push(ch.equip[slot]); delete ch.equip[slot];
  C.recalc(p); fullSync(p);
};
I.use = function (p, u, byId) {
  const ch = p.char;
  const it = byId ? ch.inv.find((x) => x.id === byId) : I.find(ch, u);
  if (!it) return err(p, 'ไม่มีไอเทม');
  if (it.type === 'equip') return I.equip(p, it.uid);
  const def = D.ITEMS[it.id];
  if (p.dead) return false;
  const t = W.now();
  if (def.type === 'potion') {
    if ((p.potCd || 0) > t) return false;
    if (ch.lv < def.lv) return err(p, `ต้องเลเวล ${def.lv}`);
    p.potCd = t + 0.5;
    if (def.hp) C.heal(p, def.hp, p);
    if (def.sp) p.sp = Math.min(p.maxSp, p.sp + def.sp);
    I.consume(ch, it.id, 1); invSync(p);
    p.inst.emit({ k: 'pot', t: p.id, x: p.x, y: p.y, c: def.icon });
    return true;
  }
  if (it.id === 'tele_scroll') {
    if (p.inst.def.kind === 'castle' && S.gvgActive()) return err(p, 'ใช้ไม่ได้ระหว่างกิลด์วอร์');
    I.consume(ch, it.id, 1); W.enterMap(p, ch.lastTown || 'aurelia'); return true;
  }
  if (['pet', 'mount', 'petfood', 'buffitem'].includes(def.type)) return P.useSpecial(p, it, def);
  if (def.type === 'cure') {
    let n = 0;
    for (const k of [...p.tags.keys()]) if (def.tags.includes('*') ? !['mark'].includes(k) : def.tags.includes(k)) { p.tags.delete(k); n++; }
    if (def.heal) C.heal(p, p.maxHp * def.heal / 100, p);
    I.consume(ch, it.id, 1); invSync(p); p.inst.emit({ k: 'pot', t: p.id, x: p.x, y: p.y, c: def.icon });
    note(p, n ? `${def.n}: ล้างสถานะ ${n} อย่าง` : `${def.n}: ไม่มีสถานะที่ต้องล้าง`); return true;
  }
  if (def.type === 'wing') {
    if (p.inst.def.kind === 'town' || p.inst.def.kind === 'castle' || p.inst.def.pvp) return err(p, 'ใช้ Fly Wing ในแผนที่นี้ไม่ได้');
    const pos = require('../shared/mapgen.js').randomWalkable(p.inst.map, r);
    I.consume(ch, it.id, 1); invSync(p); W.enterMap(p, p.inst.id, pos.x, pos.y); return true;
  }
  if (def.type === 'box') return I.openBox(p, it, def);
  return err(p, 'ไอเทมนี้ใช้โดยตรงไม่ได้');
};
// random boxes: region crates, gear boxes, support boxes, card albums, relic chests
I.openBox = function (p, it, def) {
  const ch = p.char;
  if (ch.inv.length >= 150 - 1) return err(p, 'กระเป๋าเต็ม');
  I.consume(ch, it.id, 1);
  let got = '';
  if (def.box === 'region') {
    const sp = Object.values(D.SPECIES).filter((s) => s.region === def.region && s.kind === 'field');
    const roll = r();
    const id = roll < 0.45 ? r.pick(sp).mats[0] : roll < 0.7 ? r.pick(sp).mats[1] : roll < 0.85 ? r.pick(D.REGION_SUPPORT[def.region]) : roll < 0.97 ? r.pick(D.REGION_TREASURE[def.region]) : r.pick(sp).mats[2];
    const q = roll < 0.45 ? r.int(3, 8) : roll < 0.7 ? r.int(1, 3) : 1; I.addItem(ch, id, q); got = `${D.ITEMS[id].n} ×${q}`;
  } else if (def.box === 'gear' || def.box === 'legend') {
    const pool = def.box === 'gear' ? Object.values(D.MAP_GEAR).flat() : Object.values(D.DUNGEON_GEAR).flat();
    const b = D.GEAR[r.pick(pool)];
    const rar = def.box === 'gear' ? Math.min(3, F.rollRarity(r, 0.3)) : 4;
    const g = F.genFromBase(r, b.id, rar, def.box === 'gear' ? b.ilv : Math.max(60, ch.lv)); g.uid = uid(); g.src = def.n;
    I.addEquip(ch, g); got = `[${D.RARITY[g.rarity].n}] ${g.name}`;
  } else if (def.box === 'card') {
    const cards = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].type === 'card');
    const id = r.pick(cards); I.addItem(ch, id, 1); got = D.ITEMS[id].n;
  } else {
    const pool = Object.keys(D.ITEMS).filter((k) => ['buffitem', 'cure', 'anvil'].includes(D.ITEMS[k].type) && !/^anvil_[34]/.test(k)).concat(['ore_enriched', 'smith_charm', 'scroll_protect', 'crystal_pure', 'reroll_stone', 'rune_drill']);
    const id = r.pick(pool); I.addItem(ch, id, 1); got = D.ITEMS[id].n;
  }
  invSync(p); C.sendChar(p, ['inv']);
  note(p, `🎁 เปิด ${def.n} ได้ ${got}`);
  return true;
};
I.sellPrice = function (it) {
  if (it.type === 'equip') return Math.round((it.ilv * 25 + 40) * (1 + it.rarity * it.rarity * 0.8) * (1 + (it.refine || 0) * 0.15));
  const d = D.ITEMS[it.id]; return d.sell || Math.floor((d.price || 10) / 4);
};
I.sell = function (p, u, qty) {
  const ch = p.char, it = I.find(ch, u);
  if (!it) return;
  const q = it.type === 'equip' ? 1 : Math.max(1, Math.min(it.qty, qty | 0 || it.qty));
  const got = I.sellPrice(it) * q;
  I.removeUid(ch, u, q); ch.zeny += got;
  P.event(p, 'sell');
  invSync(p);
  note(p, `ขาย ${I.itemName(it)} x${q} ได้ ${got.toLocaleString()} Zeny`);
};
I.drop = function (p, u, qty) { const it = I.removeUid(p.char, u, qty); if (it) { if (it.type !== 'equip') it.uid = uid(); W.dropItem(p.inst, p.x, p.y, it, [p.char.id]); invSync(p); note(p, `วาง ${I.itemName(it)} ลงพื้น`); } };
I.buy = function (p, id, qty) {
  const inst = p.inst;
  if (inst.def.kind !== 'town' && !p.gm) return err(p, 'ซื้อได้เฉพาะในเมือง');
  const list = D.SHOP[inst.mapId] || D.SHOP.aurelia;
  if (!list.includes(id)) return err(p, 'ร้านนี้ไม่มีขาย');
  qty = Math.max(1, Math.min(999, qty | 0));
  const cost = D.ITEMS[id].price * qty;
  if (p.char.zeny < cost) return err(p, 'Zeny ไม่พอ');
  if (!I.addItem(p.char, id, qty)) return err(p, 'กระเป๋าเต็ม');
  p.char.zeny -= cost; invSync(p);
  note(p, `ซื้อ ${D.ITEMS[id].n} x${qty} (-${cost.toLocaleString()} Zeny)`);
  return true;
};

// ------------------------------------------------------------------ drops & exp on kill
function potTier(lv) { return lv < 30 ? 1 : lv < 80 ? 2 : lv < 140 ? 3 : lv < 200 ? 4 : 5; }
I.onMonsterKilled = function (m, killer) {
  const inst = m.inst;
  // exp split with party nearby
  const mates = killer.party ? C.partyNear(killer, 30) : [killer];
  const share = 1 + 0.12 * (mates.length - 1);
  for (const q of mates) {
    let e = m.exp * share / mates.length;
    const diff = q.lv - m.lv;
    if (diff > 30) e *= 0.1; else if (diff > 15) e *= 0.5;
    if (inst.def.kind === 'dungeon') e *= 1.3;
    I.gainExp(q, e);
    q.char.kills = (q.char.kills || 0) + 1;
    P.event(q, 'kill', { rank: m.rank, exp: e });
  }
  // loot
  const ch = killer.char;
  const dropMul = (db.data.settings.drop || 1) * (1 + killer.st.dropPct / 100) * (inst.def.kind === 'dungeon' ? 1 + inst.def.floor / 400 : 1);
  const lv = m.lv, rk = m.rank;
  const got = [];
  const owners = killer.party ? C.partyNear(killer, 30).map((q) => q.char.id) : [ch.id];
  const give = (id, q = 1) => { W.dropItem(inst, m.x, m.y, { uid: uid(), id, qty: q }, owners); got.push(id); };
  const zen = Math.round(m.zeny * (0.8 + r() * 0.4) * (db.data.settings.drop || 1));
  W.dropItem(inst, m.x, m.y, { uid: uid(), id: 'zeny', qty: zen }, owners);
  const roll = (p) => r() < p * dropMul;
  if (roll(0.07)) give('pot_hp_' + potTier(lv));
  if (roll(0.035)) give('pot_sp_' + Math.min(4, potTier(lv)));
  if (roll(0.25)) give('monster_core');
  if (roll(0.12)) give('herb', rk ? 3 : 1);
  if (lv >= 25 && roll(0.08)) give('mana_dust', rk ? 3 : 1);
  if (rk >= 2 && roll(0.25)) give(r() < 0.5 ? 'exp_scroll' : 'drop_scroll');
  if (rk >= 1 && roll(0.04)) give('pet_food', 2);
  if (roll(rk ? 0.25 : 0.04)) give('ore_refine', rk >= 2 ? 5 : 1);
  if (lv >= 50 && roll(rk ? 0.06 : 0.006)) give('crystal_pure', rk >= 2 ? 3 : 1);
  if (lv >= 120 && roll(rk ? 0.015 : 0.0015)) give('crystal_divine', rk >= 2 ? 2 : 1);
  const runeTier = Math.min(5, 1 + Math.floor(lv / 60) + (rk >= 2 && r() < 0.4 ? 1 : 0));
  if (roll(rk >= 2 ? 1 : rk ? 0.07 : 0.009)) give(`rune_${r.pick(Object.keys(D.RUNE_KINDS).filter((k) => k !== 'titan' || rk >= 2))}_${runeTier}`);
  if (roll(rk >= 2 ? 0.8 : rk ? 0.05 : 0.007)) give(`jewel_${r.pick(Object.keys(D.JEWELS))}_${Math.min(10, 1 + Math.floor(lv / 40) + (rk >= 2 ? 1 : 0))}`);
  if (rk >= 2 && roll(0.3)) give('scroll_protect');
  if (rk >= 2 && roll(0.15)) give('rune_drill');
  if (rk >= 2 && roll(0.12)) give('reroll_stone');
  require('./chests').keyDrop(m, give); // chest keys: dungeon monsters only
  // the species' own drop table (regional materials, junk, card, named gear...) — exactly what the Monster Book lists
  const table = m.sp ? D.dropTable(m.sp) : [];
  const eliteK = rk === 1 ? 3 : 1;
  for (const [id, pct, q] of table) {
    if (r() >= Math.min(1, pct / 100 * dropMul * eliteK)) continue;
    if (id.startsWith('gear:')) {
      const base = D.GEAR[id.slice(5)];
      let rar = Math.min(base.maxR, F.rollRarity(r, killer.st.dropPct / 100));
      if (rk === 1) rar = Math.max(rar, 1);
      if (rk >= 2 && base.src === 'field') rar = Math.max(rar, 2 + (r() < 0.35 ? 1 : 0));
      const ilv = base.src === 'field' ? Math.max(1, lv + r.int(-3, 2)) : base.src === 'mythic' ? 250 : lv;
      const it = F.genFromBase(r, base.id, rar, ilv);
      it.uid = uid(); it.src = m.name;
      W.dropItem(inst, m.x, m.y, it, owners); got.push(it.name);
    } else if (D.ITEMS[id]) give(id, q);
  }
  // Monster Book progress
  if (m.sp) for (const q of mates) { const b = q.char.book || (q.char.book = {}); b[m.sp] = (b[m.sp] || 0) + 1; }
  inst.emit({ k: 'loot', t: m.id, x: m.x, y: m.y, z: 0, n: got.length });
  if (killer.gmf && killer.gmf.autoloot) inst.after(0.05, () => { for (const e of [...inst.entities.values()]) if (e.kind === 'i' && !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 2.5) I.pickup(killer, e.id, 'force'); });
};
function autoSkip(p, id) {
  if (!p.auto.on) return false;
  const d = D.ITEMS[id];
  if (d.type === 'potion' && !p.auto.lootPotions) return true;
  if ((d.type === 'mat' || d.type === 'loot') && !p.auto.lootMats) return true;
  return false;
}

// ------------------------------------------------------------------ refine +20
I.refine = function (p, u, prot, bless, anvil) {
  const ch = p.char;
  if (p.inst.def.kind !== 'town' && !p.gm) return err(p, 'ตีบวกได้ที่ช่างตีเหล็กในเมือง');
  let it = I.find(ch, u), equipped = null;
  if (!it) for (const s of D.SLOTS) if (ch.equip[s] && ch.equip[s].uid === u) { it = ch.equip[s]; equipped = s; }
  if (!it || it.type !== 'equip') return err(p, 'เลือกอุปกรณ์ที่จะตีบวก');
  const isAcc = ['necklace', 'earring', 'ring'].includes(it.slot);
  const max = isAcc ? D.ACC_REFINE_MAX : 20;
  const from = it.refine || 0;
  if (from >= max) return err(p, `ตีบวกสูงสุด +${max} แล้ว`);
  const target = from + 1;
  const cost = D.refineCost(target);
  if (I.count(ch, cost.mat) < cost.qty) return err(p, `ต้องใช้ ${D.ITEMS[cost.mat].n} x${cost.qty}`);
  if (ch.zeny < cost.zeny) return err(p, `ต้องใช้ ${cost.zeny.toLocaleString()} Zeny`);
  if (prot && I.count(ch, 'scroll_protect') < 1) return err(p, 'ไม่มี Protection Scroll');
  if (bless && I.count(ch, 'scroll_bless') < 1) return err(p, 'ไม่มี Blessed Scroll');
  I.consume(ch, cost.mat, cost.qty); ch.zeny -= cost.zeny;
  if (prot) I.consume(ch, 'scroll_protect', 1);
  if (bless) I.consume(ch, 'scroll_bless', 1);
  // anvils and Enriched Ore add flat success; Smith's Charm stops +7~+10 from dropping
  let bonus = 0, charm = false;
  if (anvil) { const a = [...D.ANVILS].reverse().find((id) => I.count(ch, id) > 0); if (a) { I.consume(ch, a, 1); bonus += D.ITEMS[a].bonus; } }
  if (target <= 10 && I.count(ch, 'ore_enriched') > 0 && anvil) { I.consume(ch, 'ore_enriched', 1); bonus += 5; }
  if (!bless && target >= 7 && target <= 10 && anvil && I.count(ch, 'smith_charm') > 0) { I.consume(ch, 'smith_charm', 1); charm = true; }
  const rate = Math.min(100, D.REFINE_RATES[target - 1] * (db.data.settings.refine || 1) + (ch.pity || 0) * 0.5 + bonus);
  const ok = r() * 100 < rate;
  let broke = false, to = from;
  if (ok) { to = target; ch.pity = 0; P.event(p, 'refine', { to }); }
  else {
    ch.pity = (ch.pity || 0) + 1;
    const f = D.refineFail(target);
    if (f.breakChance && !prot && r() < f.breakChance) broke = true;
    else if (f.down && !bless && !charm) to = Math.max(0, from - (f.downMin ? r.int(f.downMin, f.down) : f.down));
  }
  if (broke) {
    if (equipped) delete ch.equip[equipped]; else I.removeUid(ch, u);
    I.addItem(ch, 'ore_refine', 3);
  } else it.refine = to;
  if (equipped) C.recalc(p);
  send(p, { t: 'refineRes', ok, broke, from, to, rate: Math.round(rate * 10) / 10, name: it.name, uid: u });
  if (ok && to >= 15) S.broadcast({ t: 'notice', k: 'refine', m: `🔥 ${ch.name} ตีบวก ${it.name} สำเร็จเป็น +${to}!` });
  fullSync(p); C.sendChar(p, ['pity']);
  return true;
};

// ------------------------------------------------------------------ runes / jewels / drill / reroll
function locate(ch, u) {
  const it = I.find(ch, u); if (it) return { it };
  for (const s of D.SLOTS) if (ch.equip[s] && ch.equip[s].uid === u) return { it: ch.equip[s], slot: s };
  return {};
}
I.socket = function (p, equ, itemUid) {
  const ch = p.char;
  const { it, slot } = locate(ch, equ);
  const gem = I.find(ch, itemUid);
  if (!it || it.type !== 'equip' || !gem) return err(p, 'เลือกอุปกรณ์และรูน/อัญมณี');
  const d = D.ITEMS[gem.id];
  if (d.type === 'rune' || d.type === 'card') {
    if ((it.runes || []).length >= (it.sockets || 0)) return err(p, 'ช่องรูน/การ์ดเต็ม (ใช้ Rune Drill เพื่อเจาะเพิ่ม)');
    it.runes = it.runes || []; it.runes.push(gem.id);
  } else if (d.type === 'jewel') {
    if (!it.jewelSlots) return err(p, 'อัญมณีฝังได้เฉพาะเครื่องประดับ');
    if ((it.jewels || []).length >= it.jewelSlots) return err(p, 'ช่องอัญมณีเต็ม');
    it.jewels = it.jewels || []; it.jewels.push(gem.id);
  } else return err(p, 'ไอเทมนี้ฝังไม่ได้');
  I.consume(ch, gem.id, 1);
  if (slot) C.recalc(p);
  fullSync(p); note(p, `ฝัง ${d.n} ลงใน ${it.name} สำเร็จ`);
};
I.unsocket = function (p, equ) {
  const ch = p.char; const { it, slot } = locate(ch, equ);
  if (!it || it.type !== 'equip') return;
  const cost = 5000 + it.ilv * 100;
  if (ch.zeny < cost) return err(p, `ถอดรูน/อัญมณีต้องใช้ ${cost} Zeny`);
  ch.zeny -= cost;
  for (const g of [...(it.runes || []), ...(it.jewels || [])]) I.addItem(ch, g, 1);
  it.runes = []; it.jewels = [];
  if (slot) C.recalc(p); fullSync(p);
};
I.drill = function (p, equ) {
  const ch = p.char; const { it, slot } = locate(ch, equ);
  if (!it || it.type !== 'equip' || it.jewelSlots) return err(p, 'เจาะได้เฉพาะอาวุธ/เกราะ');
  const max = it.slot === 'weapon' ? 3 : 2;
  if ((it.sockets || 0) >= max) return err(p, 'ช่องรูนสูงสุดแล้ว');
  if (!I.consume(ch, 'rune_drill', 1)) return err(p, 'ต้องใช้ Rune Drill');
  if (r() < 0.6) { it.sockets = (it.sockets || 0) + 1; note(p, `เจาะช่องรูนสำเร็จ! (${it.sockets}/${max})`); }
  else note(p, 'เจาะช่องล้มเหลว...', 'warn');
  if (slot) C.recalc(p); fullSync(p);
};
I.reroll = function (p, equ) {
  const ch = p.char; const { it, slot } = locate(ch, equ);
  if (!it || it.type !== 'equip' || it.rarity < 1) return err(p, 'ต้องเป็นอุปกรณ์ Uncommon ขึ้นไป');
  if (!I.consume(ch, 'reroll_stone', 1)) return err(p, 'ต้องใช้ Reroll Stone');
  F.rollOptions(r, it);
  if (slot) C.recalc(p); fullSync(p); note(p, `สุ่มออปชั่นใหม่ให้ ${it.name} แล้ว`);
};
// combine 3 runes of same tier → next tier; 5 jewels → next level
I.combine = function (p, id) {
  const ch = p.char, d = D.ITEMS[id];
  if (!d) return;
  if (d.type === 'rune') {
    if (d.tier >= 5) return err(p, 'รูนระดับสูงสุดแล้ว');
    if (!I.consume(ch, id, 3)) return err(p, 'ต้องมีรูนชนิดเดียวกัน 3 อัน');
    I.addItem(ch, `rune_${d.kind}_${d.tier + 1}`, 1); note(p, `รวมรูนสำเร็จ → ${D.ITEMS[`rune_${d.kind}_${d.tier + 1}`].n}`);
  } else if (d.type === 'jewel') {
    if (d.tier >= 10) return err(p, 'อัญมณีระดับสูงสุดแล้ว');
    if (!I.consume(ch, id, 5)) return err(p, 'ต้องมีอัญมณีชนิดเดียวกัน 5 อัน');
    I.addItem(ch, `jewel_${d.kind}_${d.tier + 1}`, 1); note(p, `รวมอัญมณีสำเร็จ → ${D.ITEMS[`jewel_${d.kind}_${d.tier + 1}`].n}`);
  }
  invSync(p);
};

// ------------------------------------------------------------------ ground loot pickup
I.canTake = function (p, e) {
  if (!e || e.kind !== 'i' || e.dead) return false;
  if (W.now() >= e.freeAt) return true;
  return (e.owners || []).includes(p.char.id);
};
I.pickup = function (p, id, quiet) {
  const e = p.inst.entities.get(id);
  if (!e || e.kind !== 'i') return false;
  if (W.dist(p, e) > 2.8 && quiet !== 'force') return quiet ? false : err(p, 'อยู่ไกลเกินไป');
  if (quiet !== 'force' && !I.canTake(p, e)) return quiet ? false : err(p, 'ของชิ้นนี้ยังเป็นของผู้อื่น (รอ 30 วินาที)');
  const it = e.item, ch = p.char;
  let ok;
  if (it.id === 'zeny') { ch.zeny += it.qty; ok = true; }
  else if (it.type === 'equip') ok = I.addEquip(ch, it);
  else ok = I.addItem(ch, it.id, it.qty);
  if (!ok) return quiet ? false : err(p, 'กระเป๋าเต็ม');
  e.dead = true; p.inst.remove(e);
  p.inst.emit({ k: 'pick', t: p.id, x: e.x, y: e.y });
  const name = it.id === 'zeny' ? `${it.qty.toLocaleString()} Zeny` : it.type === 'equip' ? `[${D.RARITY[it.rarity].n}] ${it.refine ? '+' + it.refine + ' ' : ''}${it.name}` : `${D.ITEMS[it.id].n}${it.qty > 1 ? ' x' + it.qty : ''}`;
  send(p, { t: 'loot', items: [name], z: it.id === 'zeny' ? it.qty : 0 });
  if (it.type === 'equip' && it.rarity >= 4) S.broadcast({ t: 'notice', k: 'loot', m: `✨ ${ch.name} ได้รับ [${D.RARITY[it.rarity].n}] ${it.name}${it.src ? ' จาก ' + it.src : ''}!` });
  invSync(p);
  return true;
};
// does the auto-loot filter want this ground item?
I.autoWants = function (p, e) {
  const a = p.auto, it = e.item;
  if (it.id === 'zeny') return true;
  if (it.type === 'equip') return it.rarity >= (a.lootMinRarity || 0);
  const d = D.ITEMS[it.id]; if (!d) return false;
  if (d.type === 'potion' && !a.lootPotions) return false;
  if ((d.type === 'mat' || d.type === 'loot' || d.type === 'card') && !a.lootMats) return false;
  if (d.type === 'junk' && a.lootJunk === false) return false;
  return true;
};

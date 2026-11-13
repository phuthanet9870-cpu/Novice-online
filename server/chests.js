'use strict';
// Dungeon treasure chests.
// - every dungeon floor instance gets exactly D.CHESTS_PER_FLOOR (6) chests, tier rolled by floor (D.chestTierAt)
// - contents (1–5 items; the crimson top tier holds 1–2 top-grade items) are rolled when the instance is created,
//   so every new entry into a dungeon re-rolls them
// - a chest lives in the instance, so every player in that (party-private) dungeon sees the same chest and the same items
// - the first player needs the matching key (consumed); once open, anyone in the instance can open it without a key
// - items are taken one by one (or all) into the taker's own bag; everyone with the chest window open sees it update
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const RNG = require('../shared/rng.js');
const db = require('./db');

const CH = module.exports;
let W, C, I;
CH.init = (w, c, i) => { W = w; C = c; I = i; };
const r = RNG.rng((Date.now() ^ 0x5eed) & 0xffffffff);
const uid = () => 'u' + db.nextId();
const send = (p, m) => p.sess && p.sess.send(m);
const err = (p, m) => { send(p, { t: 'err', m }); return false; };

// bases that can actually roll the wanted grade (each base has its own min/max rarity), preferring this dungeon's own set
const fits = (b, rarity) => (b.minR || 0) <= rarity && (b.maxR === undefined ? 5 : b.maxR) >= rarity;
function gear(def, rarity) {
  const own = ((D.DUNGEON_GEAR && D.DUNGEON_GEAR[def.dungeon]) || []).map((id) => D.GEAR[id]).filter((b) => b && fits(b, rarity));
  const all = Object.values(D.GEAR).filter((b) => fits(b, rarity));
  const base = own.length && r() < 0.45 ? r.pick(own) : r.pick(all);
  const it = F.genFromBase(r, base.id, rarity, Math.max(1, def.lv + r.int(0, 4)));
  it.uid = uid(); it.src = D.CHESTS[Math.min(5, rarity)].n;
  return it;
}
const runeTier = (floor) => Math.min(5, 1 + Math.floor(floor / 200));
const jewelTier = (floor) => Math.min(10, 1 + Math.floor(floor / 100));
function stack(id, qty) { return D.ITEMS[id] ? { uid: uid(), id, qty } : null; }

// roll the items inside a chest of tier t on dungeon floor def.floor
CH.roll = function (def, t) {
  const out = [];
  if (t === 5) {
    // crimson relic: 1–2 items, all of the highest grade
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) {
      const k = r();
      out.push(k < 0.7 ? gear(def, 5) : k < 0.85 ? stack(`rune_${r.pick(Object.keys(D.RUNE_KINDS))}_5`, 1) : stack(`jewel_${r.pick(Object.keys(D.JEWELS))}_10`, 1));
    }
    return out.filter(Boolean);
  }
  const n = r.int(1, 5);
  for (let i = 0; i < n; i++) {
    const k = r();
    if (k < 0.42) out.push(gear(def, Math.min(4, t + (r() < 0.12 ? 1 : 0)))); // gear of the chest's colour (sometimes one grade up)
    else if (k < 0.58) out.push(stack(`rune_${r.pick(Object.keys(D.RUNE_KINDS).filter((x) => x !== 'titan' || t >= 3))}_${Math.min(5, runeTier(def.floor) + (t >= 3 ? 1 : 0))}`, 1));
    else if (k < 0.7) out.push(stack(`jewel_${r.pick(Object.keys(D.JEWELS))}_${Math.min(10, jewelTier(def.floor) + t)}`, 1));
    else if (k < 0.82) out.push(stack(r.pick(t >= 3 ? ['crystal_divine', 'crystal_pure', 'scroll_bless'] : t >= 1 ? ['crystal_pure', 'ore_refine', 'scroll_protect'] : ['ore_refine', 'ore_refine', 'scroll_protect']), t >= 3 ? r.int(1, 3) : r.int(2, 6)));
    else if (k < 0.92) out.push(stack(r.pick(['rune_drill', 'reroll_stone', 'exp_scroll', 'drop_scroll']), 1));
    else out.push(stack('pot_hp_' + Math.min(5, 1 + Math.floor(def.lv / 60)), r.int(3, 10)));
  }
  return out.filter(Boolean);
};

// place the floor's chests: one per room (never the start room), spread out, on free floor tiles
CH.populate = function (inst, map) {
  const def = inst.def;
  const rooms = map.rooms.slice(1).sort(() => r() - 0.5);
  const want = D.CHESTS_PER_FLOOR;
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 400) {
    const rm = rooms[placed % rooms.length] || map.rooms[0];
    const x = r.int(rm.x + 1, rm.x + rm.w - 2) + 0.5, y = r.int(rm.y + 1, rm.y + rm.h - 2) + 0.5;
    if (!require('../shared/mapgen.js').walkable(map, x, y)) continue;
    if ([...inst.entities.values()].some((e) => e.role === 'chest' && Math.hypot(e.x - x, e.y - y) < 4)) continue;
    const t = D.chestTierAt(def.floor, r);
    inst.add({ id: W.nextEnt++, kind: 'n', role: 'chest', tier: t, name: D.CHESTS[t].n, th: D.CHESTS[t].th, color: D.CHESTS[t].color, x, y, tags: new Map(), hp: 1, maxHp: 1,
      items: CH.roll(def, t), opened: false, openedBy: '', viewers: new Set() });
    placed++;
  }
};

function view(e) { return { t: 'chest', id: e.id, tier: e.tier, name: e.name, opened: e.opened, by: e.openedBy, items: e.items }; }
function refresh(inst, e) {
  // everyone in the dungeon sees the chest's state change (name plate / opened look) …
  e.name = e.opened ? `${D.CHESTS[e.tier].n}${e.items.length ? '' : ' (ว่าง)'}` : D.CHESTS[e.tier].n;
  e.ver = (e.ver || 0) + 1;
  for (const q of inst.players) q.known && q.known.delete(e.id);
  // … and everyone looking inside gets the new item list
  for (const pid of e.viewers) { const q = W.players.get(pid); if (q && q.inst === inst) send(q, view(e)); else e.viewers.delete(pid); }
}

CH.handle = function (p, m) {
  const inst = p.inst; if (!inst) return;
  const e = inst.entities.get(m.id | 0);
  if (!e || e.role !== 'chest') return err(p, 'ไม่พบหีบสมบัติ');
  if (m.a === 'close') { e.viewers.delete(p.char.id); return; }
  if (W.dist(p, e) > 3.2) return err(p, 'เดินเข้าไปใกล้หีบก่อน');
  if (m.a === 'open') {
    if (!e.opened) {
      const key = 'key_' + e.tier;
      if (!I.count(p.char, key)) return err(p, `ต้องใช้ ${D.ITEMS[key].n} (${D.CHESTS[e.tier].kth}) เพื่อเปิด${D.CHESTS[e.tier].th} — กุญแจดรอปจากมอนสเตอร์ในดันเจี้ยน`);
      I.consume(p.char, key, 1); C.sendChar(p, ['inv']);
      e.opened = true; e.openedBy = p.name;
      inst.emit({ k: 'txt', t: e.id, x: e.x, y: e.y, m: `🔓 ${p.name} เปิด${D.CHESTS[e.tier].th}`, c: D.CHESTS[e.tier].color });
      for (const q of inst.players) send(q, { t: 'notice', k: 'system', m: `🔓 ${p.name} เปิด ${D.CHESTS[e.tier].n} แล้ว — ทุกคนในดันเจี้ยนเปิดดูได้โดยไม่ต้องใช้กุญแจ` });
    }
    e.viewers.add(p.char.id);
    send(p, view(e));
    refresh(inst, e);
    return;
  }
  if (!e.opened) return err(p, 'หีบยังล็อกอยู่');
  if (m.a === 'take' || m.a === 'all') {
    const list = m.a === 'all' ? e.items.slice() : e.items.filter((it) => it.uid === m.uid);
    if (!list.length) return send(p, view(e));
    const got = [];
    for (const it of list) {
      const ok = it.type === 'equip' ? I.addEquip(p.char, it) : I.addItem(p.char, it.id, it.qty);
      if (!ok) { err(p, 'กระเป๋าเต็ม'); break; }
      e.items = e.items.filter((x) => x !== it);
      got.push(it.type === 'equip' ? `[${D.RARITY[it.rarity].n}] ${it.name}` : `${D.ITEMS[it.id].n}${it.qty > 1 ? ' x' + it.qty : ''}`);
      if (it.type === 'equip' && it.rarity >= 4) require('./social').broadcast({ t: 'notice', k: 'loot', m: `✨ ${p.name} ได้รับ [${D.RARITY[it.rarity].n}] ${it.name} จาก ${D.CHESTS[e.tier].n}!` });
    }
    if (got.length) { send(p, { t: 'loot', items: got, z: 0 }); C.sendChar(p, ['inv']); }
    refresh(inst, e);
  }
};

// key drops: only monsters inside dungeons, tier follows the floor's chest table
CH.keyDrop = function (m, give) {
  const inst = m.inst; if (!inst || inst.def.kind !== 'dungeon') return;
  const chance = m.rank >= 2 ? 1 : m.rank === 1 ? 0.18 : 0.035;
  if (r() >= chance * (db.data.settings.drop || 1)) return;
  give('key_' + D.chestTierAt(inst.def.floor, r), 1);
};

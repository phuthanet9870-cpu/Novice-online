// Game math shared by server and client: stats, EXP, items, monsters.
(function (root, factory) {
  const D = typeof require === 'function' ? require('./data.js') : root.NO_DATA;
  const m = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.NO_F = m;
})(typeof self !== 'undefined' ? self : this, function (D) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r1 = (x) => Math.round(x * 10) / 10;

  const expToNext = (lv) => Math.floor(30 * Math.pow(lv, 2.15) + 50);
  const statPointsAt = (lv) => 5 * (lv - 1) + 3 * Math.floor(lv / 10);
  const skillPointsAt = (lv) => (lv - 1) + Math.floor(lv / 5) + 3;
  const statCost = (cur) => 1 + Math.floor(Math.max(0, cur - 1) / 25); // cost of raising a stat by 1
  const STAT_MAX = 300;

  // ------------------------------------------------------------------ Monsters
  const RANK = [
    { n: 'normal', hp: 1, atk: 1, def: 1, exp: 1, size: 1 },
    { n: 'elite', hp: 3.5, atk: 1.5, def: 1.3, exp: 4, size: 1.25 },
    { n: 'boss', hp: 45, atk: 2.2, def: 2, exp: 90, size: 2.2 },
    { n: 'dboss', hp: 22, atk: 2, def: 1.8, exp: 40, size: 1.8 },
    { n: 'world', hp: 900, atk: 3, def: 2.5, exp: 0, size: 3.2 },
    { n: 'summon', hp: 0.6, atk: 0.6, def: 0.6, exp: 0, size: 0.85 },
    { n: 'core', hp: 1, atk: 0, def: 3, exp: 0, size: 2 }
  ];
  function monsterStats(lv, rank) {
    const R = RANK[rank] || RANK[0];
    return {
      maxHp: Math.round((60 + lv * 28) * (1 + lv / 40) * R.hp),
      atk: Math.round((10 + lv * 6.5) * R.atk),
      def: Math.round(lv * 1.6 * R.def),
      mdef: Math.round(lv * 1.2 * R.def),
      exp: Math.round((Math.pow(lv, 1.45) * 4 + 10) * R.exp),
      zeny: Math.round((5 + lv * 3) * (rank ? R.exp / 2 : 1)),
      size: R.size
    };
  }

  // ------------------------------------------------------------------ Items
  function weaponTypeOf(cls) { return D.CLASSES[cls].weapon; }
  function classesForWeapon(w) { return D.CLASS_IDS.filter((c) => D.CLASSES[c].weapon === w); }
  const MAGIC_WEAPONS = { staff: 1, mace: 1, scythe: 1 };

  function rollRarity(r, luckBonus = 0) {
    const x = r() * 100 / (1 + luckBonus);
    if (x < 0.25) return 5; if (x < 1.4) return 4; if (x < 6) return 3; if (x < 20) return 2; if (x < 48) return 1; return 0;
  }
  function genEquip(r, slot, ilv, rarity, weaponType) {
    const R = D.RARITY[rarity];
    const tier = clamp(Math.floor(ilv / 25), 0, 9);
    const it = { type: 'equip', slot, ilv, rarity, refine: 0, runes: [], jewels: [], opts: [] };
    const k = (12 + ilv * 4.2) * R.mult;
    if (slot === 'weapon') {
      const wt = weaponType || r.pick(Object.keys(D.WEAPON_NAMES));
      it.wtype = wt; it.name = D.WEAPON_NAMES[wt][tier];
      if (MAGIC_WEAPONS[wt]) { it.matk = Math.round(k * 1.05); it.atk = Math.round(k * 0.35); } else it.atk = Math.round(k);
      it.sockets = [0, 1, 1, 2, 3, 3][rarity];
    } else if (D.ACCESSORY_SLOTS.includes(slot)) {
      const base = slot === 'necklace' ? 'necklace' : slot === 'earring' ? 'earring' : 'ring';
      it.name = D.ARMOR_NAMES[base][tier];
      it.slot = base === 'ring' ? 'ring' : slot;
      it.hp = Math.round((10 + ilv * 3) * R.mult);
      it.sockets = 0; it.jewelSlots = rarity >= 4 ? 2 : 1;
    } else {
      it.name = D.ARMOR_NAMES[slot][tier];
      const w = { offhand: [1.2, 0.5, 2], head: [0.7, 0.6, 3], armor: [1.3, 0.8, 6], cloak: [0.5, 1.0, 2], boots: [0.6, 0.4, 2] }[slot];
      it.def = Math.round((4 + ilv * 1.4) * R.mult * w[0]);
      it.mdef = Math.round((2 + ilv * 0.9) * R.mult * w[1]);
      it.hp = Math.round((15 + ilv * w[2] * 2.2) * R.mult);
      it.sockets = [0, 0, 1, 1, 2, 2][rarity];
    }
    rollOptions(r, it);
    it.reqLv = Math.max(1, ilv - 5);
    return it;
  }
  function rollOptions(r, it) {
    const R = D.RARITY[it.rarity];
    it.opts = [];
    const used = new Set();
    for (let i = 0; i < R.opts; i++) {
      let o; let guard = 0;
      do { o = r.pick(D.OPTIONS); } while (used.has(o[0]) && guard++ < 20);
      used.add(o[0]);
      const v = o[2] * (20 + it.ilv) * R.mult * (0.6 + r() * 0.6);
      it.opts.push([o[0], o[3] ? r1(v) : Math.max(1, Math.round(v))]);
    }
  }
  const refinePct = (r) => (r * 6 + Math.max(0, r - 10) * 6 + Math.max(0, r - 15) * 12) / 100;
  const runeValue = (kind, tier) => r1(D.RUNE_KINDS[kind].per * tier * 0.6);
  const jewelValue = (kind, lv) => r1(D.JEWELS[kind].per * lv);

  // Sum of everything an equipped item gives
  function itemStats(it, out) {
    out = out || {};
    const add = (k, v) => { if (v) out[k] = (out[k] || 0) + v; };
    const isAcc = it.slot === 'necklace' || it.slot === 'earring' || it.slot === 'ring';
    const rp = isAcc ? 0 : refinePct(it.refine || 0);
    add('atk', Math.round((it.atk || 0) * (1 + rp)));
    add('matk', Math.round((it.matk || 0) * (1 + rp)));
    add('def', Math.round((it.def || 0) * (1 + rp)));
    add('mdef', Math.round((it.mdef || 0) * (1 + rp)));
    add('hp', Math.round((it.hp || 0) * (1 + (isAcc ? (it.refine || 0) * 0.08 : rp * 0.5))));
    const r = it.refine || 0;
    if (!isAcc && r >= 10) add(it.slot === 'weapon' ? 'atkPct' : 'hpPct', r >= 20 ? 20 : r >= 15 ? 10 : 5);
    if (it.slot === 'weapon' && r >= 10 && it.matk) add('matkPct', r >= 20 ? 20 : r >= 15 ? 10 : 5);
    const om = isAcc ? 1 + r * 0.06 : 1;
    for (const [k, v] of it.opts || []) add(k, isAcc ? r1(v * om) : v);
    for (const rid of it.runes || []) { const ri = D.ITEMS[rid]; if (ri) add(D.RUNE_KINDS[ri.kind].stat, runeValue(ri.kind, ri.tier)); }
    for (const jid of it.jewels || []) { const ji = D.ITEMS[jid]; if (ji) add(D.JEWELS[ji.kind].stat, jewelValue(ji.kind, ji.tier)); }
    return out;
  }
  function gearStats(equip) {
    const out = {};
    const runeCount = {};
    for (const slot of D.SLOTS) {
      const it = equip && equip[slot];
      if (!it) continue;
      itemStats(it, out);
      for (const rid of it.runes || []) { const ri = D.ITEMS[rid]; if (ri) runeCount[ri.kind] = (runeCount[ri.kind] || 0) + 1; }
    }
    // Rune set: 3+ runes of the same kind → +25% of that rune stat
    out.runeSets = [];
    for (const k in runeCount) if (runeCount[k] >= 3) {
      const st = D.RUNE_KINDS[k].stat; out[st] = r1((out[st] || 0) * 1.25); out.runeSets.push(k);
    }
    return out;
  }

  // ------------------------------------------------------------------ Player stats (ARPG-style: grow automatically every level)
  const GROWTH_STEPS = [0.8, 0.55, 0.45, 0.25, 0.2, 0.15];
  function statGrowth(cls) {
    const st = D.CLASSES[cls].start;
    const order = [...D.STATS].sort((a, b) => st[b] - st[a] || D.STATS.indexOf(a) - D.STATS.indexOf(b));
    const g = {}; order.forEach((k, i) => (g[k] = GROWTH_STEPS[i])); return g;
  }
  function autoStats(cls, lv) {
    const st = D.CLASSES[cls].start, gr = statGrowth(cls), out = {};
    for (const k of D.STATS) out[k] = Math.floor(st[k] + gr[k] * (Math.max(1, lv) - 1));
    return out;
  }
  function calcStats(ch, gear, mods) {
    const c = D.CLASSES[ch.cls];
    gear = gear || {}; mods = mods || {};
    const g = (k) => (gear[k] || 0) + (mods[k] || 0);
    const s = {};
    const auto = autoStats(ch.cls, ch.lv);
    for (const k of D.STATS) s[k] = auto[k] + ((ch.statBonus && ch.statBonus[k]) || 0) + g(k);
    const L = ch.lv;
    const st = { base: s };
    st.maxHp = Math.round((c.hp0 + L * c.hpLv + s.vit * c.vitHp + g('hp')) * (1 + g('hpPct') / 100));
    st.maxSp = Math.round((c.sp0 + L * c.spLv + s.int * c.intSp + g('sp')) * (1 + g('spPct') / 100));
    const atkStat = c.scale === 'ranged' ? s.dex * 2 + s.str * 0.5 + s.luk * 0.3
      : c.scale === 'melee' ? s.str * 2 + s.dex * 0.5 + s.luk * 0.3 : s.str * 1 + s.dex * 0.4;
    st.atk = Math.round((atkStat + L * 1.5 + g('atk')) * (1 + g('atkPct') / 100));
    st.matk = Math.round((s.int * 2.2 + s.dex * 0.4 + L * 1.5 + g('matk')) * (1 + g('matkPct') / 100));
    st.def = Math.round((s.vit * 1.2 + L * 0.5 + g('def')) * (1 + g('defPct') / 100));
    st.mdef = Math.round((s.int * 0.6 + s.vit * 0.3 + g('mdef')) * (1 + g('mdefPct') / 100));
    st.aspd = r1(Math.min(4, c.aspd * (1 + s.agi * 0.004 + s.dex * 0.001 + g('aspdPct') / 100)) * 100) / 100;
    st.crit = r1(Math.min(100, 1 + s.luk * 0.3 + g('crit')));
    st.critDmg = Math.round(50 + g('critDmg'));
    st.hit = Math.round(s.dex + L + g('hit'));
    st.flee = Math.round(s.agi + L + g('flee'));
    st.castReduce = r1(Math.min(60, s.dex * 0.15 + g('castReduce')));
    st.cdr = r1(Math.min(50, g('cdr')));
    st.move = r1(Math.min(9, c.move * (1 + g('movePct') / 100)));
    st.lifesteal = r1(Math.min(40, g('lifesteal')));
    st.dmgPct = r1(g('dmgPct'));
    st.dmgReduce = r1(Math.min(75, g('dmgReduce')));
    st.comboDmg = r1(g('comboDmg'));
    st.bossDmg = r1(g('bossDmg'));
    st.pvpDmg = r1(g('pvpDmg'));
    st.pvpRes = r1(Math.min(60, g('pvpRes')));
    st.dropPct = r1(s.luk * 0.05 + g('dropPct'));
    st.ccRes = r1(Math.min(60, s.vit * 0.1 + g('ccRes')));
    st.range = c.range + (mods.range || 0);
    st.comboWin = 2.5 + g('comboWin');
    st.hpRegen = Math.max(0, (st.maxHp * 0.01 + s.vit * 0.2) * (1 + g('regenPct') / 100));
    st.spRegen = (st.maxSp * 0.012 + s.int * 0.1) * (1 + (mods.spRegen ? mods.spRegen - 1 : 0));
    return st;
  }

  // Skill scaling with level
  function skillMult(sk, lv) {
    lv = Math.max(1, lv || 1);
    if (sk.kind === 'ult') return 1 + 0.15 * (lv - 1);
    if (sk.kind === 'buff') return 0.55 + 0.045 * lv;
    return 1 + 0.1 * (lv - 1) + (lv >= 5 ? 0.05 : 0) + (lv >= 10 ? 0.1 : 0);
  }
  function skillSp(sk, lv) { return Math.round((sk.sp || 0) * (1 + 0.06 * (Math.max(1, lv) - 1))); }
  function skillCd(sk, lv) { return r1((sk.cd || 0) * (lv >= 10 ? 0.9 : 1)); }

  return { clamp, r1, expToNext, statPointsAt, skillPointsAt, statCost, STAT_MAX, RANK, monsterStats, weaponTypeOf, classesForWeapon,
    autoStats, statGrowth, rollRarity, genEquip, rollOptions, refinePct, runeValue, jewelValue, itemStats, gearStats, calcStats, skillMult, skillSp, skillCd };
});

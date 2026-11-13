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
  // balance v2: monsters get tougher and hit harder as levels climb, so a same-level normal takes ~2-3 skills or
  // ~8 basic attacks, hits for ~5-7% of a geared player's HP, and a field boss lasts 1-2 minutes solo
  const MON_HP = (lv) => 1.3 + Math.min(lv, 250) / 250 * 0.9 + Math.max(0, lv - 250) / 100;
  const MON_ATK = (lv) => 2 + lv * 0.06;
  const SKILL_DMG = 0.45; // every skill's listed % is scaled by this in combat (keeps skills ~4× a basic hit, not ~9×)
  function monsterStats(lv, rank) {
    const R = RANK[rank] || RANK[0];
    return {
      maxHp: Math.round((60 + lv * 28) * (1 + lv / 40) * MON_HP(lv) * R.hp),
      atk: Math.round((10 + lv * 6.5) * MON_ATK(lv) * R.atk),
      def: Math.round(lv * 1.6 * R.def),
      mdef: Math.round(lv * 1.2 * R.def),
      exp: Math.round((Math.pow(lv, 1.45) * 4 + 10) * R.exp * (0.6 + MON_HP(lv) * 0.55)),
      zeny: Math.round((5 + lv * 3) * (rank ? R.exp / 2 : 1)),
      size: R.size
    };
  }

  // ------------------------------------------------------------------ Items
  function weaponTypeOf(cls) { return D.CLASSES[cls].weapon; }
  function classesForWeapon(w) { return D.CLASS_IDS.filter((c) => D.CLASSES[c].weapon === w); }
  const MAGIC_WEAPONS = { staff: 1, mace: 1, scythe: 1, orb: 1, prism: 1 };

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
    // every drop is its own: base stats roll 85–118% quality, options roll their own stats, count and tiers
    it.quality = Math.round(85 + r() * 33);
    for (const k of ['atk', 'matk', 'def', 'mdef', 'hp']) if (it[k]) it[k] = Math.max(1, Math.round(it[k] * it.quality / 100));
    rollOptions(r, it);
    it.reqLv = Math.max(1, ilv - 5);
    return it;
  }
  // "<Prefix> <base name> <of Suffix>" from the two strongest options
  function affixName(it, base) {
    const A = D.AFFIX_NAME; if (!A || !it.opts || !it.opts.length || it.rarity < 1) return base;
    const sorted = it.opts.slice().sort((a, b) => (a[2] || 5) - (b[2] || 5));
    const pre = A[sorted[0][0]] ? A[sorted[0][0]][0] : '';
    const suf = it.rarity >= 2 && sorted[1] && A[sorted[1][0]] && sorted[1][0] !== sorted[0][0] ? ' ' + A[sorted[1][0]][1] : '';
    return (pre ? pre + ' ' : '') + base + suf;
  }
  // an equipment instance from a named base (shared/itemdb.js): its own name, implicit bonuses and rarity limits
  function genFromBase(r, baseId, rarity, ilv) {
    const b = D.GEAR && D.GEAR[baseId]; if (!b) return null;
    rarity = clamp(rarity, b.minR || 0, b.maxR === undefined ? 5 : b.maxR);
    ilv = Math.max(1, Math.round(ilv || b.ilv || 1));
    const it = genEquip(r, b.slot === 'ring' ? 'ring1' : b.slot, ilv, rarity, b.wtype);
    it.base = baseId; it.baseName = b.n; it.name = b.rarityLocked ? b.n : affixName(it, b.n);
    if (b.src === 'mythic' || b.src === 'dungeon' || b.src === 'craft') it.name = b.n + (it.opts.length ? ' ' + ((D.AFFIX_NAME[it.opts[0][0]] || [])[1] || '') : '');
    const k = (1 + ilv / 25) * (1 + rarity * 0.15);
    it.imp = b.imp.map(([s, per]) => { const v = per * 10 * k; return [s, v >= 3 ? Math.round(v) : r1(v)]; });
    if (b.src === 'mythic') it.reqLv = Math.min(it.reqLv, 220);
    return it;
  }
  function rollOptions(r, it) {
    const R = D.RARITY[it.rarity];
    it.opts = [];
    const used = new Set();
    // Common gets 1 option, every rarity above one more, plus a 35% chance of a bonus line
    const n = Math.min(7, 1 + it.rarity + (r() < 0.35 ? 1 : 0));
    for (let i = 0; i < n; i++) {
      let o; let guard = 0;
      do { o = r.pick(D.OPTIONS); } while (used.has(o[0]) && guard++ < 40);
      used.add(o[0]);
      // tier 1 (best) .. 5: higher tiers are rarer
      const roll = r(), tier = roll < 0.06 ? 1 : roll < 0.2 ? 2 : roll < 0.45 ? 3 : roll < 0.75 ? 4 : 5;
      const v = o[2] * (20 + it.ilv) * R.mult * (0.45 + (6 - tier) * 0.18 + r() * 0.12) * (it.rarity === 0 ? 0.6 : 1);
      it.opts.push([o[0], o[3] ? r1(Math.max(0.1, v)) : Math.max(1, Math.round(v)), tier]);
    }
    if (it.baseName === undefined) it.baseName = it.name;
    it.name = affixName(it, it.baseName);
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
    for (const [k, v] of it.imp || []) add(k, v);
    for (const rid of it.runes || []) { const ri = D.ITEMS[rid]; if (!ri) continue; if (ri.type === 'card') { for (const k in ri.mods) add(k, ri.mods[k]); } else add(D.RUNE_KINDS[ri.kind].stat, runeValue(ri.kind, ri.tier)); }
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
      for (const rid of it.runes || []) { const ri = D.ITEMS[rid]; if (ri && ri.type === 'rune') runeCount[ri.kind] = (runeCount[ri.kind] || 0) + 1; }
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

  // ------------------------------------------------------------------ Auto skill planner (PvE farming vs PvP fighting)
  // skills: learned skill objects. Returns an ordered rotation [{ id, cond, v, why }] — first ready entry whose condition holds is cast.
  const HARD_CC = ['stun', 'freeze', 'knockdown', 'airborne', 'root', 'fear', 'silence', 'sleep'];
  function autoPlan(skills, mode) {
    const pvp = mode === 'pvp';
    const atk = skills.filter((s) => s.kind === 'attack');
    const score = (s) => {
      const hits = s.hits || 1, aoe = s.shape === 'circle' ? 1 + (s.radius || 3) * (pvp ? 0.08 : 0.38) : s.shape === 'cone' ? 1 + (s.radius || 3) * (pvp ? 0.06 : 0.28) : s.shape === 'line' ? (pvp ? 1.05 : 1.6) : s.shape === 'chain' ? (pvp ? 1.1 : 1.5) : pvp ? 1.35 : 1;
      let v = ((s.dmg || 1) * hits + (s.perUnit || 0) * 2) * aoe / Math.max(1.2, s.cd || 1);
      const cc = (s.applies || []).filter((a) => HARD_CC.includes(a.tag)).length, soft = (s.applies || []).length - cc;
      v *= 1 + cc * (pvp ? 0.9 : 0.15) + soft * (pvp ? 0.25 : 0.1);
      if (s.move) v *= pvp ? 1.35 : 0.9;
      if (s.cast) v /= 1 + s.cast * (pvp ? 0.9 : 0.25);
      if (s.summon || s.trap || s.zone) v *= pvp ? 0.8 : 1.25;
      if (s.pierce) v *= 1 + s.pierce * (pvp ? 0.5 : 0.2);
      return v;
    };
    const used = new Set(), out = [];
    const push = (s, cond, v, why) => { if (!s || used.has(s.id)) return; used.add(s.id); out.push({ id: s.id, cond, v: v === undefined ? 0 : v, why }); };
    const ranked = atk.slice().sort((a, b) => score(b) - score(a));
    // 1. executes and self-HP skills only work in their window, so they go first with that condition
    for (const s of ranked) if (s.cond && s.cond.type === 'targetHp') push(s, 'targetHpBelow', s.cond.v, 'ปิดท้ายเป้า HP ต่ำ');
    for (const s of ranked) if (s.cond && s.cond.type === 'selfHp') push(s, 'selfHpBelow', s.cond.v, 'ใช้ตอน HP เราต่ำ');
    for (const s of ranked) if (s.heal && !s.heal.zone) push(s, 'selfHpBelow', 55, 'ฮีลตัวเอง');
    // 2. combo payoffs: a skill that consumes / gets a bonus from a tag fires when the tag is up...
    const payoff = [];
    for (const s of ranked) { const t = (s.consumes && s.consumes[0]) || (s.bonusIf && s.bonusIf[0] && s.bonusIf[0][0]); if (t) payoff.push([s, t]); }
    for (const [s, t] of payoff.slice(0, pvp ? 3 : 2)) push(s, 'tag', t, 'ต่อคอมโบเมื่อเป้ามี ' + t);
    // 3. PvP: open with crowd control the target does not already have; PvE: big AoE when a pack is around
    if (pvp) {
      for (const s of ranked) { const cc = (s.applies || []).find((a) => HARD_CC.includes(a.tag)); if (cc && out.length < 7) push(s, 'notag', cc.tag, 'CC เปิดเกม (' + cc.tag + ')'); }
      for (const s of ranked) if (s.move && out.length < 9) push(s, 'always', 0, 'ไล่ตาม/เข้าประชิด');
    } else {
      for (const s of ranked) if ((s.shape === 'circle' && (s.radius || 0) >= 3) || s.zone) { if (out.length < 8) push(s, 'mobsAround', s.radius >= 4 ? 3 : 2, 'AoE เมื่อมีมอนรวมกลุ่ม'); }
      for (const [s, t] of payoff) { const setup = ranked.find((x) => !used.has(x.id) && (x.applies || []).some((a) => a.tag === t)); if (setup) push(setup, 'notag', t, 'ตั้งคอมโบ (ใส่ ' + t + ')'); }
    }
    // 4. everything else by value
    for (const s of ranked) if (out.length < 14) push(s, 'always', 0, pvp ? 'ดาเมจเป้าเดียว' : 'ดาเมจหลัก');
    return out;
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

  return { SKILL_DMG, MON_HP, MON_ATK, clamp, r1, expToNext, statPointsAt, skillPointsAt, statCost, STAT_MAX, RANK, monsterStats, weaponTypeOf, classesForWeapon,
    autoStats, statGrowth, rollRarity, genEquip, genFromBase, affixName, autoPlan, rollOptions, refinePct, runeValue, jewelValue, itemStats, gearStats, calcStats, skillMult, skillSp, skillCd };
});

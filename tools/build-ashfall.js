#!/usr/bin/env node
// Builds the 30 Ashfall classes and their 25-slot skill kits (15 attack · 5 buff · 4 ultimate · 1 class ultimate)
// from tools/ashfall/ash_data.json into shared/classes.js and shared/skills.js.
'use strict';
const fs = require('fs');
const path = require('path');
const A = require('./ashfall/ash_data.json');
const RTH = require('./ashfall/rider_th.json');

const K = 0.5; // Ashfall "x% ATK" → our damage multiplier (balance)
const DS = 1.25; // Ashfall tile distances → our tiles
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

// Ashfall element → combat element (resists/reactions) ; the original stays as fxEl for visuals and text
const EL = { phys: 'neutral', blood: 'blood', holy: 'holy', fire: 'fire', ice: 'ice', lightning: 'lightning', shadow: 'dark', nature: 'earth', poison: 'poison', wind: 'wind', tech: 'lightning', chi: 'wind', arcane: 'water', time: 'ice', fel: 'poison', star: 'holy', dark: 'dark', light: 'holy', umbra: 'dark', celestial: 'holy', death: 'dark', infernal: 'fire', divine: 'holy', jester: 'wind', chaos: 'dark' };
// class → our equipment weapon type (item database), original weapon name kept for flavour
const WPN = { blademaster: 'katana', guardian: 'spear', berserker: 'axe', paladin: 'sword', pyromancer: 'staff', cryomancer: 'orb', stormcaller: 'staff', necromancer: 'scythe', cleric: 'mace', druid: 'staff', assassin: 'dagger', shadowdancer: 'claw', ranger: 'bow', marksman: 'gun', engineer: 'gun', monk: 'knuckle', spellblade: 'sword', beastmaster: 'spear', chronomancer: 'orb', warlock: 'prism', starhunter: 'bow', darkknight: 'sword', lightbringer: 'prism', shadowmancer: 'orb', seraph: 'spear', reaper: 'scythe', demon: 'claw', deity: 'prism', jester: 'chakram', loki: 'staff' };
const MAG = { caster: 1, healer: 1, summoner: 1 };
const MAG_EXTRA = { spellblade: 1, seraph: 1, beastmaster: 0 };
const ROLE = {
  melee: { hp0: 190, hpLv: 42, vitHp: 15, sp0: 38, spLv: 2.9, intSp: 4, aspd: 1.15, move: 5.2, start: { str: 10, agi: 6, vit: 8, int: 2, dex: 5, luk: 4 }, rating: { atk: 5, def: 3, spd: 3, mag: 1, sup: 1, diff: 2 } },
  tank: { hp0: 240, hpLv: 50, vitHp: 18, sp0: 42, spLv: 3.0, intSp: 4, aspd: 0.95, move: 4.8, start: { str: 7, agi: 3, vit: 12, int: 3, dex: 5, luk: 3 }, rating: { atk: 2, def: 5, spd: 1, mag: 1, sup: 3, diff: 2 } },
  caster: { hp0: 130, hpLv: 30, vitHp: 11, sp0: 65, spLv: 4.6, intSp: 6, aspd: 0.9, move: 4.9, start: { str: 1, agi: 4, vit: 5, int: 13, dex: 9, luk: 3 }, rating: { atk: 1, def: 1, spd: 2, mag: 5, sup: 1, diff: 3 } },
  healer: { hp0: 150, hpLv: 34, vitHp: 13, sp0: 70, spLv: 4.8, intSp: 6, aspd: 0.9, move: 5.0, start: { str: 1, agi: 3, vit: 7, int: 12, dex: 8, luk: 4 }, rating: { atk: 1, def: 2, spd: 2, mag: 4, sup: 5, diff: 2 } },
  ranged: { hp0: 140, hpLv: 32, vitHp: 12, sp0: 45, spLv: 3.3, intSp: 5, aspd: 1.2, move: 5.3, start: { str: 3, agi: 7, vit: 5, int: 2, dex: 13, luk: 5 }, rating: { atk: 4, def: 1, spd: 4, mag: 1, sup: 1, diff: 3 } },
  assassin: { hp0: 135, hpLv: 31, vitHp: 11, sp0: 45, spLv: 3.4, intSp: 5, aspd: 1.45, move: 5.8, start: { str: 6, agi: 12, vit: 4, int: 2, dex: 6, luk: 6 }, rating: { atk: 5, def: 1, spd: 5, mag: 1, sup: 0, diff: 4 } },
  hybrid: { hp0: 200, hpLv: 44, vitHp: 15, sp0: 50, spLv: 3.6, intSp: 5, aspd: 1.05, move: 5.0, start: { str: 8, agi: 4, vit: 9, int: 6, dex: 5, luk: 4 }, rating: { atk: 3, def: 4, spd: 2, mag: 3, sup: 3, diff: 3 } },
  summoner: { hp0: 145, hpLv: 33, vitHp: 12, sp0: 62, spLv: 4.4, intSp: 6, aspd: 0.95, move: 5.0, start: { str: 2, agi: 4, vit: 6, int: 12, dex: 8, luk: 4 }, rating: { atk: 3, def: 2, spd: 2, mag: 4, sup: 2, diff: 3 } }
};
const BUFF_MOD = { crit: 'crit', atk: 'atkPct', aspd: 'aspdPct', def: 'defPct', ls: 'lifesteal', cdr: 'cdr', spd: 'movePct' };
const CC = { st: 'stun', sl: 'slow', rt: 'root', sil: 'silence', fz: 'freeze' };
const SLOT = (i) => (i < 15 ? 'atk' : i < 20 ? 'buff' : i < 24 ? 'ult' : 'set');
const ROLE_TH = { b1: 'สะสม +1', b2: 'สะสม +2', s2: 'ใช้ 2 แต้ม', s3: 'ใช้ 3 แต้ม', emp: 'ถ้ามีแต้มครึ่งหนึ่งขึ้นไป ได้ผลกลไกฟรี 50% (ไม่ใช้แต้ม)', fin: 'ใช้แต้มทั้งหมด', fin2: 'ใช้แต้มทั้งหมด แรง ×2', over: 'เติมแต้มเต็มแล้วใช้ทันที แรง ×1.5', g3: 'สะสม +3', g2: 'สะสม +2 และ +1 ทุก 2 วิ 8 วิ', g4: 'สะสม +4', gfull: 'เติมแต้มเต็ม', shieldfill: 'สะสม +2 และได้โล่ 1% HP ต่อแต้มที่มี' };

// rewrite "N% ATK" amounts in a description to the damage the game really deals
const scaleDesc = (s) => s.replace(/(\d+(?:\.\d+)?)% ATK/g, (m, n) => `${Math.round(+n * K)}% ATK`).replace(/(\d+(?:\.\d+)?) ช่อง/g, (m, n) => `${r1(+n * DS)} ช่อง`).replace(/\(ระยะ (\d+(?:\.\d+)?)\)/g, (m, n) => `(ระยะ ${r1(+n * DS)})`).replace(/\(ระยะ (\d+(?:\.\d+)?) ช่อง\)/g, (m, n) => `(ระยะ ${r1(+n * DS)} ช่อง)`);

// ---------------------------------------------------------------- unique abilities (✦)
// Every skill gets one signature ability = an effect (rider) + the condition that fires it. The pair is unique across
// all 750 skills, and no class uses the same effect twice. Ashfall's own pick is kept when it still fits.
const OFF = ['stack', 'echo', 'knockup', 'swift', 'backstab', 'splash', 'pierceUp', 'critUp', 'critDmg', 'sunder', 'bleed', 'execute', 'purge', 'crush', 'refund', 'slowField', 'guard', 'shatter', 'mend', 'weaken', 'taunt', 'vortex', 'burn', 'fear', 'leech', 'trueDmg', 'steal', 'mark', 'amp', 'burnField', 'chill', 'toxin', 'blind', 'far', 'near', 'cdr', 'timeLock', 'starMark', 'detonate', 'reset', 'fury', 'trail', 'spirit'];
const SUP = ['rally', 'reflect', 'resetMove', 'thorns', 'regen', 'immune', 'cleanse', 'lastStand', 'overheal', 'haste', 'empower', 'invuln', 'decoy', 'explodeOnEnd', 'amp', 'swift', 'stack'];
const SUPPORT_ARCH = { buff: 1, shield: 1, heal: 1, stealth: 1, summon: 1, turret: 1, blink: 1 };
const THEME = {
  fire: ['burn', 'burnField', 'detonate', 'splash'], infernal: ['burn', 'fury', 'detonate', 'burnField'], ice: ['chill', 'shatter', 'slowField', 'timeLock'], lightning: ['echo', 'cdr', 'knockup', 'splash'], tech: ['splash', 'burnField', 'explodeOnEnd', 'mark'],
  poison: ['toxin', 'weaken', 'execute', 'blind'], fel: ['toxin', 'weaken', 'steal', 'fear'], blood: ['bleed', 'leech', 'fury', 'execute'], holy: ['mend', 'cleanse', 'blind', 'mark'], light: ['blind', 'mark', 'pierceUp', 'invuln'], divine: ['mark', 'shatter', 'regen', 'invuln'], celestial: ['mend', 'guard', 'knockup', 'regen'],
  dark: ['fear', 'leech', 'execute', 'vortex'], shadow: ['fear', 'backstab', 'blind', 'steal'], umbra: ['steal', 'fear', 'detonate', 'vortex'], death: ['execute', 'reset', 'leech', 'fear'], nature: ['toxin', 'regen', 'thorns', 'vortex'], wind: ['swift', 'knockup', 'vortex', 'far'],
  time: ['timeLock', 'cdr', 'echo', 'reset'], star: ['starMark', 'far', 'mark', 'pierceUp'], phys: ['sunder', 'crush', 'stack', 'critDmg'], chi: ['stack', 'echo', 'refund', 'knockup'], arcane: ['amp', 'empower', 'steal', 'mark'], jester: ['decoy', 'blind', 'fear', 'reset'], chaos: ['decoy', 'steal', 'fear', 'echo']
};
const T_OFF = ['always', 'crit', 'tgtLow', 'tgtHigh', 'selfLow', 'selfHigh', 'mechHalf', 'mechEmpty', 'cc', 'dot', 'boss', 'crowd', 'single', 'third', 'combo', 'close', 'far', 'moving', 'lowSp', 'shielded'];
const T_SUP = ['always', 'selfLow', 'selfHigh', 'mechHalf', 'mechEmpty', 'third', 'combo', 'party', 'crowdNear', 'moving', 'bossNear', 'afterUlt', 'lowSp', 'highSp', 'shielded'];
const T_MULT = { always: 1, crit: 1.25, tgtHigh: 1.25, selfHigh: 1.25, single: 1.2, close: 1.2, crowd: 1.3, party: 1.25, highSp: 1.25 };
const DEFV = {}; for (const c of A.classes) for (const s of [...c.skills, c.setUlt]) for (const r of [s.rider, s.rider2]) if (r && r.k && DEFV[r.k] === undefined) DEFV[r.k] = r.v;
Object.assign(DEFV, { explodeOnEnd: DEFV.explodeOnEnd || 120, spirit: 1, decoy: 1, trail: DEFV.trail || 60, reset: 1, resetMove: 1, cleanse: 1, purge: 1, overheal: 1 });
const hsh = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const usedPair = new Set();
function fits(k, s) {
  const sup = !!SUPPORT_ARCH[s.arch];
  if (k === 'rally') return s.arch === 'buff';
  if (k === 'explodeOnEnd') return s.arch === 'summon' || s.arch === 'turret';
  if (k === 'trail') return s.arch === 'dash' || s.arch === 'blink' || s.arch === 'leap';
  if (k === 'pierceUp') return !sup && (s.arch === 'thrust' || s.arch === 'beam' || s.arch === 'chain' || (s.arch === 'proj' && s.pi));
  if (k === 'spirit' || k === 'reset' || k === 'detonate') return !sup;
  if (sup) return SUP.includes(k);
  return OFF.includes(k) || ['reflect', 'thorns', 'regen', 'immune', 'cleanse', 'haste', 'empower', 'invuln', 'lastStand'].includes(k);
}
function pickAbility(c, s, usedK) {
  const el = s.elem || c.elem;
  const cand = [s.rider && s.rider.k, s.rider2 && s.rider2.k, ...(THEME[el] || []), ...(THEME[c.elem] || [])].filter(Boolean);
  const all = [...OFF, ...SUP]; const off = hsh(c.id + s.idx) % all.length;
  for (let i = 0; i < all.length; i++) cand.push(all[(off + i) % all.length]);
  for (const k of cand) {
    if (usedK.has(k) || !fits(k, s)) continue;
    const trig = SUPPORT_ARCH[s.arch] ? T_SUP : T_OFF;
    const start = k === (s.rider && s.rider.k) ? 0 : 1 + (hsh(s.cls + s.name) % (trig.length - 1));
    for (let j = 0; j < trig.length; j++) {
      const w = trig[(start + j) % trig.length];
      if (usedPair.has(k + '@' + w)) continue;
      usedPair.add(k + '@' + w); usedK.add(k);
      const base = s.rider && s.rider.k === k ? s.rider.v : s.rider2 && s.rider2.k === k ? s.rider2.v : DEFV[k] !== undefined ? DEFV[k] : 1;
      const m = T_MULT[w] || 1.5;
      const v = base <= 1.01 && ['resetMove', 'cleanse', 'purge', 'overheal', 'reset', 'spirit', 'decoy'].includes(k) ? base : base * m >= 5 ? Math.round(base * m) : Math.round(base * m * 10) / 10;
      return { k, v, w };
    }
  }
  return null;
}
const WHEN_TH = { always: '', crit: 'เมื่อคริติคอล', tgtLow: 'ถ้าเป้า HP < 50%', tgtHigh: 'ถ้าเป้า HP > 70%', selfLow: 'ขณะ HP ตัวเอง < 50%', selfHigh: 'ขณะ HP ตัวเอง > 80%', mechHalf: 'ถ้าแต้มกลไก ≥ ครึ่ง', mechEmpty: 'ถ้าแต้มกลไก = 0', cc: 'ถ้าเป้าติดสตัน/ตรึง/ชะลอ/แช่แข็ง', dot: 'ถ้าเป้าติดเผา/พิษ/เลือดไหล', boss: 'ใส่บอส/Elite', crowd: 'ถ้าโดน 3 เป้าขึ้นไป', single: 'ถ้าโดนเป้าเดียว', third: 'ทุกการใช้ครั้งที่ 3', combo: 'ขณะคอมโบ ≥ 10', close: 'ถ้าเป้าอยู่ใกล้ ≤ 3 ช่อง', far: 'ถ้าเป้าอยู่ไกล ≥ 5 ช่อง', moving: 'ขณะ/หลังเคลื่อนที่', lowSp: 'ขณะ SP < 30%', highSp: 'ขณะ SP > 80%', shielded: 'ขณะมีโล่', party: 'ถ้ามีพันธมิตรใกล้', crowdNear: 'ถ้าศัตรูรอบตัว ≥ 3', bossNear: 'ถ้ามีบอสในระยะ 8 ช่อง', afterUlt: 'ภายใน 10 วิหลังใช้อัลติเมต' };
const riderText = (r) => { let t = scaleDesc(String(RTH[r.k] || r.k).replace('{v}', r.v)); if (r.k === 'explodeOnEnd') t = 'เมื่อหมดเวลา ระเบิดรอบตัว 2 ช่อง ' + Math.round(r.v * K) + '% ATK'; if (r.k === 'spirit') t = 'ฆ่าเป้าได้ อัญเชิญวิญญาณช่วยสู้ 8 วิ'; if (r.k === 'decoy') t = 'ทิ้งร่างลวง ศัตรูรอบตัวเลิกเล็งผู้ใช้'; if (r.k === 'trail') t = 'ทิ้งรอยพลังตามทางที่เคลื่อนที่ ' + Math.round(r.v * K) + '% ATK'; return t; };
const abilityText = (r) => (WHEN_TH[r.w] ? WHEN_TH[r.w] + ' → ' : '') + riderText(r);
const CLASSES = {};
const SKILLS = {};
const CLASS_SKILLS = {};
for (const c of A.classes) {
  const R = ROLE[c.role], RM = A.ROLES[c.role], mech = A.CLASS_MECH[c.id];
  const mag = !!(MAG[c.role] || MAG_EXTRA[c.id]);
  const range = r1(Math.max(1.9, c.rng * DS * (c.rng > 3 ? 1 : 1.25)));
  const scale = mag ? 'magic' : c.rng > 3 ? 'ranged' : 'melee';
  const el = A.ELEM[c.elem] || {};
  CLASSES[c.id] = {
    name: c.name, th: c.th, weapon: WPN[c.id], wname: (A.WEAPON_TH || {})[c.weapon] || c.weapon, color: c.hair || el.pal[2], color2: c.col[0], col: c.col,
    role: RM.th, roleId: c.role, desc: `${c.th} · ${RM.th} · ธาตุ${el.th || ''} · ${(A.WEAPON_TH || {})[c.weapon] || ''} — ${mech ? mech.d : ''}`,
    hp0: Math.round(R.hp0 * RM.hp), hpLv: r1(R.hpLv * RM.hp), vitHp: R.vitHp, sp0: R.sp0, spLv: R.spLv, intSp: R.intSp, aspd: R.aspd, move: R.move, range,
    dmg: mag ? 'mag' : 'phys', scale, res: { name: mech.n, max: mech.max, gain: 1 }, element: EL[c.elem] || 'neutral', fxEl: c.elem, pal: el.pal, elTh: el.th,
    start: R.start, rating: R.rating,
    mech: { n: mech.n, max: mech.max, c: mech.c, g: mech.g, d: mech.d, over: !!mech.over, decay: mech.decay || 0, aspd: mech.aspd || 0, crit: mech.crit || 0, critDmg: mech.critDmg || 0, boostSpend: mech.boostSpend || 0 },
    passives: (c.passives || []).map((p) => ({ id: p.id, k: p.k, v: p.v, name: p.name, lv: p.lv, th: p.th })),
    summonShape: { necromancer: 'undead', beastmaster: 'beast', shadowmancer: 'shadow', engineer: 'drone', reaper: 'spirit', demon: 'imp', warlock: 'imp', druid: 'beast' }[c.id] || 'spirit',
    branches: { 'โจมตี': 'Attack', 'บัฟ': 'Buff', 'อัลติเมต': 'Ultimate' }
  };
  const list = [...c.skills, c.setUlt];
  CLASS_SKILLS[c.id] = [];
  const usedK = new Set();
  // the ultimates and class ultimate pick first so they keep their headline effects
  const ability = {};
  for (const s of [...list].sort((a2, b2) => (b2.idx >= 20) - (a2.idx >= 20) || a2.idx - b2.idx)) ability[s.idx] = pickAbility(c, Object.assign({ cls: c.id }, s), usedK);
  for (const s of list) {
    const slot = SLOT(s.idx);
    const id = `${c.id}_${String(s.idx).padStart(2, '0')}`;
    const kind = slot === 'ult' || slot === 'set' ? 'ult' : s.arch === 'buff' ? 'buff' : 'attack';
    const sk = {
      id, cls: c.id, kind, cat: slot, idx: s.idx, name: s.name, arch: s.arch, branch: { atk: 'Active', buff: 'Buff', ult: 'Ultimate', set: 'Class Ultimate' }[slot], role: '-',
      reqLv: slot === 'set' ? 200 : s.unlock, maxLv: kind === 'ult' ? 5 : 10,
      element: EL[s.elem] || 'neutral', fxEl: s.elem, dmgType: mag ? 'mag' : 'phys', melee: c.rng <= 3,
      cd: r2(Math.max(0.6, s.c)), sp: Math.max(2, Math.round(s.m * 1.4)), cast: 0, cmRole: s.cmRole
    };
    sk.pal = (A.ELEM[s.elem] || A.ELEM.phys).pal; sk.efx = (A.ELEM[s.elem] || A.ELEM.phys).fx;
    const R0 = s.R ? r1(s.R * DS) : range, rad = s.r ? r1(s.r * DS) : 0;
    const dmg = s.p ? r2(s.p * K) : 0;
    const applies = [];
    for (const k in s.cc) { const v = s.cc[k]; if (CC[k]) applies.push({ tag: CC[k], stacks: 1, dur: v }); }
    if (s.cc.kb) sk.push = r1(s.cc.kb * DS);
    if (s.cc.pl) sk.pull = r1(s.cc.pl * DS);
    switch (s.arch) {
      case 'slash': Object.assign(sk, { shape: 'cone', radius: r1((s.r || 1.6) * DS), range: Math.max(range, r1((s.r || 1.6) * DS)), dmg }); break;
      case 'spin': Object.assign(sk, { shape: 'circle', self: true, radius: r1((s.r || 2) * DS), range: 0, dmg, hits: s.n || 3 }); break;
      case 'thrust': Object.assign(sk, { shape: 'line', length: R0, width: 1.3, range: R0, dmg }); break;
      case 'beam': Object.assign(sk, { shape: 'line', length: R0, width: 1.1, range: R0, dmg, beam: 1 }); break;
      case 'proj':
        if (s.pi) Object.assign(sk, { shape: 'line', length: Math.max(R0, range), width: 1, range: Math.max(R0, range), dmg, pierce: s.pi });
        else if (s.r) Object.assign(sk, { shape: 'circle', self: false, radius: rad, range: Math.max(range, R0), dmg });
        else Object.assign(sk, { shape: 'single', range: Math.max(range, R0), dmg, hits: s.n > 1 ? Math.ceil(s.n * 0.6) : 1 });
        if (s.n > 1) sk.volley = s.n;
        break;
      case 'nova': Object.assign(sk, { shape: 'circle', self: true, radius: rad || 2.5, range: 0, dmg }); break;
      case 'ground': Object.assign(sk, { shape: 'circle', self: false, radius: rad || 1.9, range: R0, dmg, hits: s.n > 1 ? Math.max(1, Math.round(s.n * 0.4)) : 1, balls: s.n || 1, drop: 0.5 }); break;
      case 'zone': Object.assign(sk, { shape: 'circle', self: false, radius: rad || 2.7, range: R0, dmg: 0, zone: { mult: r2(s.p * K), tick: 0.5, dur: s.d || 4 } }); break;
      case 'chain': Object.assign(sk, { shape: 'chain', chain: s.n || 3, range: R0, dmg }); break;
      case 'dash': Object.assign(sk, { shape: 'line', length: R0, width: 1.4, range: R0, dmg, move: { type: 'dash', dist: R0 } }); break;
      case 'leap': Object.assign(sk, { shape: 'circle', self: true, radius: rad || 2.2, range: R0, dmg, move: { type: 'leap', dist: R0 } }); break;
      case 'barrage': Object.assign(sk, { shape: 'single', range: Math.max(R0, c.rng > 3 ? range : 0), dmg, hits: s.n || 3 }); break;
      case 'summon': Object.assign(sk, { shape: 'self', range: 0, summon: { count: s.n || 1, dur: s.d || 12, mult: r2(s.p || 0.6) } }); break;
      case 'turret': Object.assign(sk, { shape: 'self', range: 0, summon: { count: 1, dur: s.d || 10, mult: r2(s.p || 0.5), turret: 1 } }); break;
      case 'trap': Object.assign(sk, { shape: 'circle', self: false, radius: r1((s.r || 1.5) * DS), range: 2, dmg, trap: 1 }); break;
      case 'buff': Object.assign(sk, { shape: 'self', range: 0, mods: { [BUFF_MOD[s.buff] || 'atkPct']: s.v }, dur: s.d || 8, party: false }); break;
      case 'shield': Object.assign(sk, { shape: 'self', range: 0, shield: { pct: s.v, dur: s.d || 4 } }); break;
      case 'heal': Object.assign(sk, { shape: 'self', range: 0, heal: { pct: s.v, who: s.r ? 'party' : 'self' } }); break;
      case 'blink': Object.assign(sk, { shape: 'self', range: R0, move: { type: 'dash', dist: R0 }, unroot: 1 }); break;
      case 'stealth': Object.assign(sk, { shape: 'self', range: 0, stealth: s.d || 3 }); break;
      default: Object.assign(sk, { shape: 'single', range, dmg });
    }
    if (applies.length) sk.applies = applies;
    if (s.flags && s.flags.grav) sk.pull = sk.pull || 2;
    const ab = ability[s.idx];
    const riders = ab ? [ab] : [];
    if (riders.length) sk.riders = riders;
    const head = slot === 'set' ? String(s.suTh || '').replace(/(\d+)%/g, (m, n) => `${Math.round(+n * K)}% ATK`) : scaleDesc(String(s.desc || '').split(' · ✦')[0].split(' · ◆')[0]);
    if (slot === 'set') sk.setUlt = { dur: 5, tick: 0.45, mult: r2(dmg * 0.25), end: r2(dmg * 1.25), r: Math.max(sk.radius || 3, 3.5) };
    sk.ability = ab ? abilityText(ab) : '';
    sk.desc = head + (ab ? ' · ✦ ' + sk.ability : '') + ` · ◆ ${mech.n}: ${ROLE_TH[s.cmRole] || ROLE_TH.fin2}`;
    if (kind === 'buff') { sk.cd = r2(Math.max(4, s.c)); }
    SKILLS[id] = sk;
    CLASS_SKILLS[c.id].push(id);
  }
}

const header = '// AUTO-GENERATED by tools/build-ashfall.js from tools/ashfall/ash_data.json — do not edit by hand.\n';
fs.writeFileSync(path.join(__dirname, '../shared/skills.js'), header + `(function (root, data) { if (typeof module === 'object' && module.exports) module.exports = data; else root.NO_SKILLS = data; })(typeof self !== 'undefined' ? self : this, ${JSON.stringify({ SKILLS, CLASS_SKILLS })});\n`);
fs.writeFileSync(path.join(__dirname, '../shared/classes.js'), header + `(function (root, data) { if (typeof module === 'object' && module.exports) module.exports = data; else root.NO_CLASSES = data; })(typeof self !== 'undefined' ? self : this, ${JSON.stringify(CLASSES)});\n`);
const n = Object.keys(SKILLS).length;
const names = new Set(Object.values(SKILLS).map((s) => s.name));
const pairs = new Set(Object.values(SKILLS).map((x) => (x.riders || []).map((r) => r.k + '@' + r.w).join(',')));
console.log(`classes ${Object.keys(CLASSES).length} · skills ${n} · unique names ${names.size} · unique abilities ${pairs.size} · no-ability ${Object.values(SKILLS).filter((x) => !x.riders).length}`);

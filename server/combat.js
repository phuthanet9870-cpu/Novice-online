// Combat engine: damage, combo tags, reactions, skill execution, buffs, death.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const M = require('../shared/mapgen.js');
const { SKILLS } = require('../shared/skills.js');
const W = require('./world');
const I = require('./items');
const S = require('./social');
const P = require('./progress');

const C = module.exports;
const T = require('../shared/passives.js');
const AF = require('./ashfall');
const WMx = require('./wbmech');
AF.init(C, W, M);
WMx.init(C, W, S);
const now = () => Date.now() / 1000;
const HARD = new Set(D.TAG_IDS.filter((t) => D.TAGS[t].cc === 'hard'));
const DOT = { bleed: 1, poison: 1, burn: 1 };
const EL_STRONG = { fire: ['ice', 'poison', 'earth'], water: ['fire'], lightning: ['water', 'wind'], earth: ['lightning'], wind: ['earth'], ice: ['wind', 'water'], holy: ['dark'], dark: ['holy'], poison: ['water'], blood: [] };
C.SKILLS = SKILLS;

// ------------------------------------------------------------------ predicates
C.ownerP = (e) => (e.kind === 'p' ? e : e.owner && e.owner.kind === 'p' ? e.owner : null);
C.stealthed = (e) => e.stealthUntil > now();
C.isHardCC = (e) => { for (const [k, v] of e.tags) if (HARD.has(k) && !v.soft) return true; return false; };
C.isEnemy = function (a, b) {
  if (!a || !b || a === b) return false;
  if (b.kind === 'n' || b.kind === 'z' || a.kind === 'n') return false;
  const pa = C.ownerP(a), pb = C.ownerP(b);
  const am = !pa, bm = !pb; // monster side
  if (b.kind === 'c') return !!pa && S.coreVulnerable(b, pa);
  if (a.kind === 'c') return false;
  if (am && bm) return false;
  if (am !== bm) return true;
  if (pa === pb) return false;
  // player vs player
  const inst = a.inst;
  if (inst && inst.mapId === 'duel_arena') return true;
  if (!inst || !inst.pvp) return !!(pa.duel && pa.duel === pb.id);
  if (pa.party && pa.party === pb.party) return false;
  if ((inst.def.kind === 'castle' || inst.def.kind === 'wb') && pa.char.guild && pa.char.guild === pb.char.guild) return false;
  if (inst.def.kind === 'castle' && S.allied(pa.char.guild, pb.char.guild)) return false;
  return true;
};
C.isAlly = (a, b) => a === b || (!C.isEnemy(a, b) && C.ownerP(a) && C.ownerP(b));

// ------------------------------------------------------------------ stats
C.recalc = function (p) {
  const mods = {};
  let cdrBonus = 0;
  p.weaponEl = null; p.flags = {};
  for (const b of p.buffs.values()) {
    for (const k in b.mods) {
      const v = b.mods[k];
      if (k === 'element') { p.weaponEl = v === 'cycle' ? (p.cycleEl || 'fire') : v; continue; }
      if (typeof v !== 'number') continue;
      if (['ccImmune', 'stealth', 'invuln', 'giant', 'guardAlly', 'reflect', 'blocks', 'extraStack', 'resGainPct', 'heatSink', 'summonBuff', 'soulSiphon'].includes(k)) { p.flags[k] = Math.max(p.flags[k] || 0, v); continue; }
      if (k === 'cdr') { cdrBonus += v; continue; }
      mods[k] = (mods[k] || 0) + v;
    }
  }
  const amods = Object.assign({}, AF.passiveMods(p)); const mm = AF.mechMods(p); if (mm) for (const k in mm) amods[k] = (amods[k] || 0) + mm[k];
  for (const k in amods) { if (k === 'cdr') cdrBonus += amods[k]; else mods[k] = (mods[k] || 0) + amods[k]; }
  const ext = P.extraMods(p);
  for (const k in ext) { if (k === 'cdr') cdrBonus += ext[k]; else if (k !== 'expPct') mods[k] = (mods[k] || 0) + ext[k]; }
  const castle = S.castleBonus(p);
  if (castle) { mods.atkPct = (mods.atkPct || 0) + castle; mods.matkPct = (mods.matkPct || 0) + castle; }
  p.pfx = T.fxOf(p.char.passives);
  p.gear = F.gearStats(p.char.equip);
  p.st = F.calcStats(p.char, p.gear, mods);
  p.st.dmgType = D.CLASSES[p.cls].dmg;
  p.cdrBonus = cdrBonus;
  p.maxHp = p.st.maxHp; p.maxSp = p.st.maxSp;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.sp > p.maxSp) p.sp = p.maxSp;
  p.dirty = false;
  p.statsChanged = true;
};

C.makePlayer = function (char, sess, acc) {
  const p = {
    id: W.nextEnt++, kind: 'p', char, sess, name: char.name, cls: char.cls, lv: char.lv, x: char.x || 0, y: char.y || 0, dir: 0,
    hp: 1, sp: 0, res: 0, ult: char.ult || 0, combo: 0, comboT: 0, bestCombo: 0, lastSkill: null, cds: {}, buffs: new Map(), tags: new Map(),
    shield: 0, blocks: 0, atkTarget: null, atkReady: 0, casting: null, party: null, gm: acc ? acc.gm : 0, acc: acc ? acc.user : '',
    stealthUntil: 0, invulnUntil: 0, dead: false, god: false, gmf: {}, hidden: false, speedMul: 1, known: new Set(), lastMv: now(), movedAt: 0,
    nextBonus: 0, summons: [], traps: [], delayed: [], ccDR: {}, size: 0.6, guildName: '', title: '', buffsChanged: true
  };
  P.init(char);
  p.auto = Object.assign(defaultAuto(), char.auto || {}, { on: false });
  C.recalc(p);
  p.hp = Math.min(p.maxHp, char.hp || p.maxHp); if (p.hp <= 0) p.hp = p.maxHp;
  p.sp = Math.min(p.maxSp, char.sp === undefined ? p.maxSp : char.sp);
  return p;
};
function defaultAuto() {
  return { on: false, mode: 'nearest', radius: 14, anchor: true, whitelist: [], blacklist: [], avoidBoss: true, ksProtect: true,
    rotation: [], rotPve: [], rotPvp: [], fight: 'pve', pvpTarget: 'lowest', useUlt: 'elite', autoBuff: true, hpPot: 45, spPot: 25, returnTown: true, supply: true, potBuy: 50, offline: false,
    lootMinRarity: 0, lootPotions: true, lootMats: true, partyHeal: 60, breakFree: true, respawnReturn: true };
}
C.defaultAuto = defaultAuto;

C.charPayload = function (p) {
  const c = p.char;
  return {
    id: c.id, name: c.name, cls: c.cls, lv: c.lv, exp: c.exp, next: F.expToNext(c.lv), statPts: c.statPts, stats: c.stats, skillPts: c.skillPts,
    skills: c.skills, hotbar: c.hotbar, inv: c.inv, equip: c.equip, zeny: c.zeny, st: p.st, gear: p.gear, auto: p.auto, dungeonBest: c.dungeonBest || {},
    guild: S.guildInfo(c.guild), party: S.partyInfo(p), gm: p.gm, gmf: p.gm ? p.gmf : undefined, book: c.book || {}, lastTown: c.lastTown, bestCombo: c.bestCombo || 0, pity: c.pity || 0, ...P.payload(p)
  };
};
C.sendChar = function (p, fields) {
  if (!p.sess) return;
  const full = C.charPayload(p);
  const out = { t: 'char' };
  for (const f of fields) out[f] = full[f];
  p.sess.send(out);
};

C.selfState = function (p, t) {
  const cls = D.CLASSES[p.cls];
  const me = { hp: Math.round(p.hp), mhp: p.maxHp, sp: Math.round(p.sp), msp: p.maxSp, res: Math.round(p.res * 10) / 10, rmax: cls.res.max,
    ult: Math.floor(p.ult), cb: p.combo, cbt: Math.max(0, Math.round((p.comboT + p.st.comboWin - t) * 10) / 10), sh: Math.round(p.shield), bl: p.blocks,
    exp: p.char.exp, lv: p.lv, tg: p.atkTarget || 0, au: p.auto.on ? 1 : 0, dead: p.dead ? 1 : 0 };
  if (p.casting) me.cast = [p.casting.sk.id, Math.round((p.casting.until - t) * 100) / 100, Math.round((p.casting.until - p.casting.start) * 100) / 100];
  if (p.forcePos || (p.auto.on && !p.dead)) { me.x = Math.round(p.x * 100) / 100; me.y = Math.round(p.y * 100) / 100; if (p.forcePos) me.fp = 1; p.forcePos = false; }
  if (p.buffsChanged) {
    me.buffs = [...p.buffs.entries()].map(([k, b]) => [k, b.name, Math.round(b.until - t), b.icon || '', b.debuff ? 1 : 0]);
    p.buffsChanged = false;
  }
  if (p.statsChanged) { me.st = p.st; p.statsChanged = false; }
  return me;
};

// ------------------------------------------------------------------ buffs
C.addBuff = function (p, key, mods, dur, name, icon) {
  if (p.kind !== 'p') return;
  p.buffs.set(key, { mods: mods || {}, until: now() + dur, name, icon });
  if (mods && mods.blocks) p.blocks = Math.max(p.blocks, mods.blocks);
  if (mods && mods.stealth) p.stealthUntil = now() + Math.min(dur, 8);
  if (mods && mods.invuln) p.invulnUntil = now() + Math.min(dur, 6);
  if (mods && mods.giant) p.giantUntil = now() + dur;
  p.buffsChanged = true;
  C.recalc(p);
};
C.removeBuff = function (p, key) { if (p.buffs.delete(key)) { p.buffsChanged = true; C.recalc(p); } };

// ------------------------------------------------------------------ tags
C.applyTag = function (tgt, tag, stacks, dur, src, o = {}) {
  if (!tgt || tgt.dead || !tgt.tags || tgt.kind === 'c' || tgt.kind === 'n' || tgt.kind === 'z') return false;
  const t = now();
  const def = D.TAGS[tag]; if (!def) return false;
  const hard = def.cc === 'hard' || def.cc === 'root';
  if (tgt.kind === 'p') {
    if (tgt.god || tgt.invulnUntil > t) return false;
    if (hard && tgt.flags && tgt.flags.ccImmune) return false;
    if (hard) {
      dur *= 1 - (tgt.st.ccRes || 0) / 100;
      if (src && C.ownerP(src)) { // PvP diminishing returns
        const dr = tgt.ccDR[tag] || (tgt.ccDR[tag] = { n: 0, at: 0 });
        if (t - dr.at > 12) dr.n = 0;
        if (dr.n >= 3) { tgt.inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'IMMUNE', c: '#aaa' }); return false; }
        dur *= [1, 0.5, 0.25][dr.n]; dr.n++; dr.at = t;
      }
    }
  }
  let soft = false;
  if (tgt.kind === 'm' && tgt.rank >= 2 && hard) { soft = tgt.brokenUntil <= t; dur = Math.min(dur, 2); if (soft) C.stagger(tgt, 6); }
  if (tgt.kind === 'm' && tgt.rank === 1 && hard) dur *= 0.7;
  const srcP = src && C.ownerP(src);
  if (srcP && srcP.flags && srcP.flags.extraStack && DOT[tag]) stacks += srcP.flags.extraStack;
  const cur = tgt.tags.get(tag);
  if (cur) {
    cur.stacks = Math.min(def.maxStack || 1, cur.stacks + stacks);
    cur.until = Math.max(cur.until, t + dur);
    if (src) cur.src = src;
    cur.soft = cur.soft && soft;
  } else {
    tgt.tags.set(tag, { stacks: Math.min(def.maxStack || 1, stacks), until: t + dur, src, soft });
    if (!o.quiet) tgt.inst.emit({ k: 'tag', t: tgt.id, x: tgt.x, y: tgt.y, tag });
  }
  if (DOT[tag] && src) {
    const atk = src.kind === 'p' ? Math.max(src.st.atk, src.st.matk) : src.atkFlat || src.atk || 10;
    tgt.tags.get(tag).dps = Math.max(1, Math.round(atk * def.dot));
  }
  if (tag === 'chill' && tgt.tags.get('chill').stacks >= 3) { tgt.tags.delete('chill'); C.applyTag(tgt, 'freeze', 1, 3, src); }
  if ((tag === 'shock' || tag === 'stun' || tag === 'silence' || (hard && !soft)) && tgt.casting) { tgt.casting = null; tgt.inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'INTERRUPT', c: '#ff0' }); }
  if (tag === 'airborne' || tag === 'knockdown') tgt.path = null;
  return true;
};
C.hasTag = (e, tag) => e.tags.has(tag);
C.stagger = function (m, amt) {
  if (!m.staggerMax || m.brokenUntil > now()) return;
  m.stagger -= amt;
  if (m.stagger <= 0) {
    m.stagger = m.staggerMax; m.brokenUntil = now() + 5;
    m.tags.set('knockdown', { stacks: 1, until: now() + 5, soft: false });
    m.inst.emit({ k: 'txt', t: m.id, x: m.x, y: m.y, m: 'BREAK! ×2 DMG', c: '#ffcc00', big: 1 });
  }
};

// ------------------------------------------------------------------ damage
function elementMod(el, tel) {
  if (!el || !tel || el === 'neutral') return 1;
  if (el === tel) return 0.75;
  if ((EL_STRONG[el] || []).includes(tel)) return 1.4;
  if ((EL_STRONG[tel] || []).includes(el)) return 0.85;
  return 1;
}
C.dealDamage = function (src, tgt, o) {
  if (!tgt || tgt.dead || !tgt.inst || tgt.kind === 'n' || tgt.kind === 'z') return 0;
  const t = now();
  const inst = tgt.inst;
  if (tgt.kind === 'p' && (tgt.god || (tgt.gmf && tgt.gmf.god) || tgt.invulnUntil > t)) { inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'IMMUNE', c: '#ddd' }); return 0; }
  const srcP = C.ownerP(src);
  const pvp = srcP && tgt.kind === 'p';
  if (tgt.kind === 'p' && o.kind === 'mob' && W.rand() * 100 < Math.max(0, Math.min(30, (tgt.st.flee - (src.lv || 1) * 2) / 10))) {
    inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'DODGE', c: '#9cf' });
    if (tgt.pfx && tgt.pfx.dodgeHeal) C.heal(tgt, tgt.maxHp * tgt.pfx.dodgeHeal / 100, tgt, true);
    return 0;
  }
  if (tgt.kind === 'p' && o.kind !== 'dot' && o.kind !== 'true' && o.kind !== 'reflect' && AF.dodge(tgt)) { inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'DODGE', c: '#9cf' }); return 0; }
  if ((tgt.wbSealed || tgt.sealOf) && o.kind !== 'reflect') { const why = WMx.gate(tgt, o); if (why) { if ((tgt._gateMsgAt || 0) < t - 0.6) { tgt._gateMsgAt = t; inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: why, c: '#ffcc33' }); } return 0; } }
  const mag = o.mag !== undefined ? o.mag : (src.kind === 'p' ? src.st.dmgType === 'mag' : false);
  let dmg;
  if (o.flat !== undefined) dmg = o.flat;
  else {
    const atk = src.kind === 'p' ? (mag ? src.st.matk : src.st.atk) : src.kind === 's' ? src.atkFlat : src.atk;
    dmg = atk * (o.mult || 1) * (0.9 + W.rand() * 0.2);
    let def = tgt.kind === 'p' ? (mag ? tgt.st.mdef : tgt.st.def) : (mag ? tgt.mdef : tgt.def) || 0;
    if (tgt.tags.has('armorbreak')) def *= 0.7;
    def *= 1 - Math.min(1, o.pierce || 0);
    const K = 60 + (src.lv || 1) * 4;
    dmg *= K / (K + def);
  }
  let crit = false;
  if (o.kind !== 'dot' && o.kind !== 'true') {
    if (srcP && src.kind === 'p') { if (src.nextCrit || W.rand() * 100 < src.st.crit + (o.critBonus || 0)) { src.nextCrit = false; crit = true; dmg *= 1 + (src.st.critDmg + (o.critDmgBonus || 0)) / 100; } src._lastCrit = crit; }
    else if (src.kind === 'm' && W.rand() < 0.05) { crit = true; dmg *= 1.5; }
    dmg *= elementMod(o.el, tgt.element);
    const elk = o.el || 'neutral';
    if (src.kind === 'p' && src.gear && src.gear[elk + 'Dmg']) dmg *= 1 + src.gear[elk + 'Dmg'] / 100;
    if (tgt.kind === 'p' && tgt.gear && tgt.gear[elk + 'Res']) dmg *= 1 - Math.min(60, tgt.gear[elk + 'Res']) / 100;
    if (tgt.exposeUntil > t) dmg *= 1 + tgt.exposePct / 100;
    if (src.weakUntil > t) dmg *= 1 - src.weakPct / 100;
    if (tgt.tags.has('knockdown')) dmg *= 1.1;
    if (o.el === 'holy' && tgt.tags.has('holybrand')) dmg *= 1.25;
    if (o.el === 'lightning' && tgt.tags.has('wet')) dmg *= 1.5;
    if (tgt.brokenUntil > t) dmg *= 2;
    if (src.tags && src.tags.has('curse')) dmg *= 0.8;
    if (src.kind === 'p') {
      if (o.kind === 'skill' || o.kind === 'basic') dmg *= 1 + Math.min(20, src.combo) * 0.03 * (pvp ? 0.5 : 1) + (src.combo > 0 ? src.st.comboDmg / 100 : 0);
      dmg *= 1 + src.st.dmgPct / 100;
      if (!o.cm && o.kind !== 'reflect') dmg *= AF.dmgMod(src);
      if (tgt.kind === 'm' && tgt.rank >= 2) dmg *= 1 + src.st.bossDmg / 100;
      const pf = src.pfx;
      if (pf) {
        let k = 0;
        const hpPct = tgt.hp / tgt.maxHp, myPct = src.hp / src.maxHp;
        if (pf.execute && hpPct < 0.35) k += pf.execute;
        if (pf.opener && hpPct >= 0.9) k += pf.opener;
        if (pf.rage && myPct < 0.4) k += pf.rage;
        if (pf.calm && myPct > 0.9) k += pf.calm;
        if (pf.vsElite && tgt.kind === 'm' && tgt.rank >= 1) k += pf.vsElite;
        if (pf.comboStack) k += pf.comboStack * Math.floor((src.combo || 0) / 10);
        if (pf['elem:' + (o.el || 'neutral')]) k += pf['elem:' + (o.el || 'neutral')];
        for (const tg of tgt.tags.keys()) if (pf['vsTag:' + tg]) k += pf['vsTag:' + tg];
        if (pf.firstStrike && src._lastTgt !== tgt.id) { k += pf.firstStrike; src._lastTgt = tgt.id; }
        dmg *= 1 + k / 100;
      }
    }
    if (o.siege && tgt.kind === 'c') dmg *= o.siege;
  }
  if (src.kind === 'p' && src.gmf) {
    if (src.gmf.dmg) dmg *= src.gmf.dmg;
    if (src.gmf.onehit && o.kind !== 'reflect' && !(tgt.kind === 'p' && tgt.gm >= src.gm)) dmg = Math.max(dmg, tgt.hp + (tgt.shield || 0) + 1);
  }
  if (tgt.kind === 'p') dmg *= 1 - tgt.st.dmgReduce / 100;
  if (tgt.kind === 'p' && tgt.pfx && tgt.pfx.ward && tgt.hp < tgt.maxHp * 0.35) dmg *= 1 - Math.min(60, tgt.pfx.ward) / 100;
  if (pvp && src.kind === 'p') dmg *= 0.5 * (1 + src.st.pvpDmg / 100) * (1 - tgt.st.pvpRes / 100);
  else if (pvp) dmg *= 0.5;
  dmg = Math.max(1, Math.round(dmg));
  if (tgt.kind === 'p' && tgt.blocks > 0 && o.kind !== 'dot') {
    tgt.blocks--; inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'BLOCK', c: '#9cf' }); return 0;
  }
  // guardian link: an ally with guardAlly takes a share
  if (tgt.kind === 'p' && tgt.party && o.kind !== 'dot') {
    for (const q of inst.players) if (q !== tgt && q.party === tgt.party && q.flags && q.flags.guardAlly && !q.dead && W.dist(q, tgt) < 10) {
      const share = Math.round(dmg * q.flags.guardAlly / 100); dmg -= share; q.hp -= share; if (q.hp <= 0) C.onDeath(q, src); break;
    }
  }
  if (tgt.shield > 0) { const ab = Math.min(tgt.shield, dmg); tgt.shield -= ab; dmg -= ab; if (dmg <= 0) { inst.emit({ k: 'hit', t: tgt.id, x: tgt.x, y: tgt.y, d: ab, sh: 1 }); return 0; } }
  if (tgt.kind === 'p' && tgt.pfx && tgt.pfx.lastStand && dmg >= tgt.hp && (tgt.lastStandAt || 0) < t - 60) {
    tgt.lastStandAt = t; dmg = Math.max(0, tgt.hp - 1); tgt.invulnUntil = t + 2;
    inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'LAST STAND!', c: '#ffd34a', big: 1 });
  }
  if (tgt.kind === 'p') dmg = AF.lastStand(tgt, dmg);
  tgt.hp -= dmg;
  if (src.kind === 'p' && tgt !== src) AF.onDealt(src, tgt, dmg, crit, o);
  if (tgt.kind === 'p' && o.kind !== 'dot') { tgt.lastHurt = t; AF.onHurt(tgt, dmg, src); }
  if (src.kind === 'p' && src.pfx && o.kind !== 'dot' && o.kind !== 'reflect') {
    const pf = src.pfx;
    if (crit && pf.critHeal && (src._critHealAt || 0) < t - 1) { src._critHealAt = t; C.heal(src, src.maxHp * pf.critHeal / 100, src, true); }
    if (crit && pf.critSp) src.sp = Math.min(src.maxSp, src.sp + pf.critSp);
    if (o.kind === 'skill' || o.kind === 'basic') for (const k in pf) if (k.startsWith('onHitTag:') && W.rand() * 100 < pf[k] && tgt.hp > 0) C.applyTag(tgt, k.slice(9), 1, 3, src);
  }
  if (tgt.kind === 'p' && tgt.pfx && tgt.pfx.thorns && o.kind !== 'reflect' && o.kind !== 'dot' && !src.dead && src.inst === inst && src !== tgt) C.dealDamage(tgt, src, { flat: Math.round(dmg * Math.min(80, tgt.pfx.thorns) / 100), kind: 'reflect' });
  if (src.kind === 'p') { src._dealt = (src._dealt || 0) + dmg; if (crit) src._crits = (src._crits || 0) + 1; }
  inst.emit({ k: 'hit', t: tgt.id, x: tgt.x, y: tgt.y, d: dmg, c: crit ? 1 : 0, r: o.reaction || undefined, el: o.el, dot: o.kind === 'dot' ? 1 : undefined, s: srcP ? srcP.id : src.id || 0, sk: o.sk ? o.sk.id : undefined });
  // reflect
  if (tgt.kind === 'p' && tgt.flags.reflect && o.kind !== 'reflect' && o.kind !== 'dot' && !src.dead && src.inst === inst) {
    C.dealDamage(tgt, src, { flat: Math.round(dmg * tgt.flags.reflect / 100), kind: 'reflect' });
  }
  // lifesteal
  if (src.kind === 'p' && o.kind !== 'dot') {
    const ls = (src.st.lifesteal + (o.lifesteal || 0)) / 100;
    if (ls > 0) C.heal(src, dmg * ls * (pvp ? 0.5 : 1), src, true);
  }
  // bookkeeping
  if (tgt.kind === 'm') {
    if (srcP) { tgt.dmgBy.set(srcP.id, (tgt.dmgBy.get(srcP.id) || 0) + dmg); tgt.lastHitBy = srcP.id; tgt.lastHitAt = t; }
    if (!tgt.target && src.kind !== 'm' && !tgt.owner) tgt.target = src;
    if (tgt.state === 'idle') tgt.wx = undefined;
    if (tgt.rank === 4 && srcP) S.wbDamage(srcP, dmg);
    if (o.finisher) C.stagger(tgt, o.reaction ? 18 : 10);
    else if (o.reaction) C.stagger(tgt, 12);
  }
  if (tgt.kind === 'c' && srcP) S.coreDamage(tgt, srcP, dmg);
  if (tgt.kind === 'p') { tgt.ult = Math.min(100, tgt.ult + 0.4); if (tgt.casting && dmg > tgt.maxHp * 0.25) tgt.casting = null; }
  if (tgt.kind === 'p' && srcP) tgt.lastPvpHit = { by: srcP, at: t };
  if (tgt.hp <= 0) C.onDeath(tgt, src);
  return dmg;
};

C.heal = function (tgt, amount, src, quiet) {
  if (!tgt || tgt.dead || tgt.kind === 'z' || tgt.kind === 'n') return 0;
  if (tgt.tags.has('poison')) amount *= 0.7;
  if (tgt.healCut && tgt.healCut.until > now()) amount *= 1 - tgt.healCut.pct;
  const before = tgt.hp;
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
  const got = Math.round(tgt.hp - before);
  if (got > 0 && !quiet) tgt.inst.emit({ k: 'hit', t: tgt.id, x: tgt.x, y: tgt.y, d: got, h: 1 });
  return got;
};

// ------------------------------------------------------------------ death
C.onDeath = function (e, killer) {
  if (e.dummy) { e.hp = e.maxHp; e.inst.emit({ k: 'txt', t: e.id, x: e.x, y: e.y, m: 'RESET', c: '#ffd34a' }); return; }
  if (e.dead) return;
  e.dead = true; e.hp = 0; e.casting = null;
  const inst = e.inst, t = now();
  inst.emit({ k: 'die', t: e.id, x: e.x, y: e.y });
  if (e.kind === 'm') {
    const kp = killer ? C.ownerP(killer) : null;
    let best = kp;
    if (e.dmgBy.size) { let bd = 0; for (const [pid, d] of e.dmgBy) if (d > bd) { const q = inst.entities.get(pid); if (q) { bd = d; best = q; } } }
    if (best && !e.owner) I.onMonsterKilled(e, best);
    if (kp && kp.pfx) C.onKillFx(kp, e);
    if (kp) AF.onKill(kp, e);
    for (const p of inst.players) if (p.auto && p.auto.target === e) p.auto.target = null;
    if (e.rank >= 2 && e.rank !== 4) S.onBossDeath(e, best);
    if (e.rank === 4) S.onWorldBossDeath(e, best);
    if (inst.def.kind === 'dungeon') { inst.kills++; S.checkStairs(inst, e); }
    inst.after(1.2, () => inst.remove(e));
    if (e.spawnRef && !e.noRespawn) {
      inst.respawnQ = inst.respawnQ || [];
      inst.respawnQ.push({ at: t + (e.rank === 1 ? 45 : 7 + W.rand() * 9), spec: e.spawnRef });
    }
  } else if (e.kind === 'p') {
    e.tags.clear(); e.atkTarget = null; e.summons.forEach((s) => W.killQuiet(s)); e.summons = [];
    const kp = killer ? C.ownerP(killer) : null;
    let loss = 0;
    if (!kp && inst.def.kind !== 'arena' && e.lv < D.MAX_LEVEL) {
      loss = Math.floor(F.expToNext(e.lv) * 0.01);
      e.char.exp = Math.max(0, e.char.exp - loss);
    }
    if (kp && kp !== e) {
      S.pvpKill(kp, e);
    }
    e.sess && e.sess.send({ t: 'dead', by: killer ? killer.name : '?', loss });
    if (e.auto.on) inst.after(4, () => { if (e.dead && e.inst === inst) C.respawn(e, e.auto.respawnReturn); });
  } else if (e.kind === 's') {
    inst.after(0.6, () => inst.remove(e));
  } else if (e.kind === 'c') {
    S.onCoreDestroyed(e, killer);
  }
};

// passive-tree kill effects
C.onKillFx = function (p, e) {
  const pf = p.pfx, t = now();
  if (pf.killHeal) C.heal(p, p.maxHp * pf.killHeal / 100, p, true);
  if (pf.killSp) p.sp = Math.min(p.maxSp, p.sp + p.maxSp * pf.killSp / 100);
  if (pf.killCdr) { for (const k in p.cds) p.cds[k] -= pf.killCdr; p.sess && p.sess.send({ t: 'cdshift', d: pf.killCdr, except: '' }); }
  if (pf.killHaste) C.addBuff(p, 'pfx_haste', { movePct: pf.killHaste, aspdPct: pf.killHaste }, 4, 'Killing Spree', '💨');
  if (pf.killBlast && e.inst) {
    const dmg = Math.min(e.maxHp * pf.killBlast / 100, p.st.atk * 6 + p.st.matk * 6);
    e.inst.emit({ k: 'boom', x: e.x, y: e.y, r: 3, el: 'fire' });
    e.inst.inRadius(e.x, e.y, 3.5, (o) => { if (o !== e && !o.dead && (o.kind === 'm' || o.kind === 'p') && C.isEnemy(p, o)) C.dealDamage(p, o, { flat: Math.round(dmg), kind: 'true' }); });
  }
};
C.respawn = function (p, returnToFarm) {
  if (!p.dead) return;
  const back = returnToFarm && p.inst && p.inst.def.kind === 'farm' ? { map: p.inst.mapId, x: p.auto.ax || p.x, y: p.auto.ay || p.y } : null;
  p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, p.maxSp * 0.5); p.tags.clear(); p.combo = 0;
  const inst = p.inst;
  if (inst && inst.def.kind === 'castle') {
    const own = S.castleOwner(inst.mapId) === p.char.guild;
    const sp = own && inst.map.defSpawn ? inst.map.defSpawn : inst.map.spawn;
    W.enterMap(p, inst.id, sp.x, sp.y); return;
  }
  if (inst && (inst.def.kind === 'arena' || inst.def.kind === 'wb')) { W.enterMap(p, inst.id); return; }
  if (back) { W.enterMap(p, back.map, back.x, back.y); return; }
  W.enterMap(p, p.char.lastTown || 'aurelia');
};

C.clearOwned = function (p) {
  for (const s of p.summons || []) if (!s.dead) W.killQuiet(s);
  p.summons = [];
  if (p.inst) for (const e of [...p.inst.entities.values()]) if (e.kind === 'z' && e.owner === p) p.inst.remove(e);
  p.traps = [];
};

// ------------------------------------------------------------------ per-tick player update
C.updatePlayer = function (p, dt, t, sec) {
  if (p.dirty) C.recalc(p);
  if (p.dead) return;
  const inst = p.inst;
  // casting
  if (p.casting) {
    if (C.isHardCC(p) || p.tags.has('silence')) p.casting = null;
    else if (t >= p.casting.until) {
      const c = p.casting; p.casting = null;
      const tgt = c.tgtId ? inst.entities.get(c.tgtId) : null;
      if (c.sk.kind === 'attack' && c.needsTarget && (!tgt || tgt.dead)) p.sess && p.sess.send({ t: 'err', m: 'เป้าหมายหายไป' });
      else C.exec(p, c.sk, c.lv, tgt, c.ax, c.ay);
    }
  }
  // combo expiry
  if (p.combo && t - p.comboT > p.st.comboWin) p.combo = 0;
  // class resource behaviours
  const cls = D.CLASSES[p.cls];
  AF.tick(p, dt, t, sec);
  // basic attack
  if (p.atkTarget && !p.casting) {
    const tgt = inst.entities.get(p.atkTarget);
    if (!tgt || tgt.dead || !C.isEnemy(p, tgt)) p.atkTarget = null;
    else {
      const d = W.dist(p, tgt);
      if (d <= p.st.range + (tgt.size || 0.6) * 0.4 + 0.5 && t >= p.atkReady && !C.isHardCC(p)) {
        p.atkReady = t + 1 / p.st.aspd;
        p.dir = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        const ranged = cls.scale !== 'melee';
        inst.emit({ k: ranged ? 'proj' : 'swing', s: p.id, x: p.x, y: p.y, tx: tgt.x, ty: tgt.y, el: p.weaponEl || cls.element, b: 1 });
        const blind = p.tags.has('blind') && W.rand() < 0.5;
        if (!blind) {
          C.dealDamage(p, tgt, { mult: 1, kind: 'basic', el: p.weaponEl || 'neutral' });
          p.ult = Math.min(100, p.ult + 1 * (1 + ((p.pfx && p.pfx.ultCharge) || 0) / 100));
          p.lastHit = t;

        } else inst.emit({ k: 'txt', t: tgt.id, x: tgt.x, y: tgt.y, m: 'MISS', c: '#aaa' });
        if (p.stealthUntil > t) p.stealthUntil = 0;
      }
    }
  }
  if (sec) C.secondTick(p, t);
};
C.secondTick = function (e, t) {
  // tags & DoTs
  for (const [k, v] of e.tags) {
    if (v.until <= t) { e.tags.delete(k); continue; }
    if (DOT[k] && v.dps && v.src) {
      let d = v.dps * v.stacks;
      if (k === 'bleed' && e.tags.has('armorbreak')) d *= 2; // Hemorrhage
      C.dealDamage(v.src, e, { flat: Math.round(d), kind: 'dot', el: k === 'burn' ? 'fire' : k === 'poison' ? 'poison' : 'blood' });
      if (e.dead) return;
      const sp = C.ownerP(v.src);
      if (sp && sp.flags && sp.flags.soulSiphon) C.heal(sp, d * 0.02, sp, true);
    }
  }
  if (e.kind === 'p') {
    if (!e.dead) {
      const inCombat = t - (e.lastHit || 0) < 5;
      C.heal(e, e.st.hpRegen * (inCombat ? 0.3 : 1), e, true);
      e.sp = Math.min(e.maxSp, e.sp + e.st.spRegen * (inCombat ? 0.5 : 1));
    }
    let changed = false;
    for (const [k, b] of e.buffs) if (b.until <= t) { e.buffs.delete(k); changed = true; }
    if (changed) { e.buffsChanged = true; C.recalc(e); }
    if (e.giantUntil && e.giantUntil < t) e.giantUntil = 0;
  } else if (e.kind === 'm' && !e.target && e.hp < e.maxHp && !e.dead) {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03);
  }
};

// ------------------------------------------------------------------ skills
const err = (p, m) => { p.sess && p.sess.send({ t: 'err', m }); return { ok: false, m }; };
C.skillRange = (p, sk) => (sk.range || p.st.range) + (p.buffs && [...p.buffs.values()].reduce((a, b) => a + (b.mods.range || 0), 0));

C.useSkill = function (p, id, tid, ax, ay) {
  const sk = SKILLS[id];
  const t = now();
  if (!sk || sk.cls !== p.cls) return err(p, 'สกิลไม่ถูกต้อง');
  const lv = (p.char.skills || {})[id] || 0;
  if (!lv) return err(p, 'ยังไม่ได้เรียนสกิลนี้');
  if (p.dead) return { ok: false };
  if (C.isHardCC(p)) return err(p, 'ถูกควบคุมอยู่!');
  if (p.tags.has('silence') && sk.kind !== 'buff') return err(p, 'ถูกใบ้ ใช้สกิลไม่ได้');
  if (p.casting) return err(p, 'กำลังร่ายเวท');
  const gf = p.gmf || {};
  if ((p.cds[id] || 0) > t + 0.05 && !gf.nocd) return err(p, 'คูลดาวน์');
  // global cooldown between skills (buffs are off the GCD)
  if (sk.kind !== 'buff' && (p.gcdUntil || 0) > t + 0.05 && !gf.nocd) return { ok: false, m: 'gcd', gcd: 1 };
  if (sk.gauge && p.ult < 100 && !p.god && !gf.nosp) return err(p, 'เกจอัลติเมตยังไม่เต็ม');
  const cost = F.skillSp(sk, lv);
  if (p.sp < cost && !p.god && !gf.nosp) return err(p, 'SP ไม่พอ');
  if (sk.needRes && p.res < sk.needRes && !p.god && !gf.nosp) return err(p, `ต้องมี ${D.CLASSES[p.cls].res.name} ≥ ${sk.needRes}`);
  if (sk.cond && sk.cond.type === 'selfHp' && p.hp / p.maxHp * 100 >= sk.cond.v) return err(p, `ใช้ได้เมื่อ HP < ${sk.cond.v}%`);
  if (sk.hpCost && p.hp <= p.maxHp * sk.hpCost / 100 + 1) return err(p, 'HP ไม่พอ');
  const inst = p.inst;
  let tgt = tid ? inst.entities.get(tid) : null;
  if (tgt && (tgt.dead || !C.isEnemy(p, tgt))) tgt = null;
  const range = C.skillRange(p, sk);
  const needsTarget = sk.kind === 'attack' && (sk.shape === 'single' || sk.shape === 'chain' || (sk.move && sk.move.type === 'blink'));
  if (!tgt && sk.kind !== 'buff' && sk.shape !== 'self') {
    const near = W.nearestEnemy(p, needsTarget ? range + 2.5 : Math.max(range, sk.radius || 0, sk.length || 0) + 1);
    if (near) tgt = near;
  }
  if (needsTarget && !tgt) return err(p, 'ไม่มีเป้าหมายในระยะ');
  if (tgt && needsTarget) {
    const reach = range + (tgt.size || 0.6) * 0.4 + 0.8 + (sk.move && sk.move.type !== 'back' ? sk.move.dist : 0);
    if (W.dist(p, tgt) > reach) { p.sess && p.sess.send({ t: 'range', id, tgt: tgt.id, r: reach - 0.6 }); return { ok: false, m: 'range' }; }
  }
  if (ax === undefined || ax === null) { ax = tgt ? tgt.x : p.x + Math.cos(p.dir) * 3; ay = tgt ? tgt.y : p.y + Math.sin(p.dir) * 3; }
  // aim point clamp
  const ad = Math.hypot(ax - p.x, ay - p.y);
  if (ad > range + 1) { ax = p.x + (ax - p.x) / ad * range; ay = p.y + (ay - p.y) / ad * range; }
  let castT = (sk.cast || 0) * (1 - p.st.castReduce / 100);
  if (p.flags.stealth || gf.nocast) castT = 0;
  if (castT > 0.05) {
    p.casting = { sk, lv, tgtId: tgt ? tgt.id : 0, ax, ay, start: t, until: t + castT, needsTarget };
    p.atkTarget = tgt ? tgt.id : p.atkTarget;
    inst.emit({ k: 'castbar', s: p.id, x: p.x, y: p.y, sk: id, d: castT });
    return { ok: true, cast: castT };
  }
  C.exec(p, sk, lv, tgt, ax, ay);
  return { ok: true };
};

function behind(attacker, tgt) {
  // attacker is "behind" when target is not facing it (monsters face their target)
  if (tgt.target && tgt.target !== attacker) return true;
  const a = Math.atan2(attacker.y - tgt.y, attacker.x - tgt.x);
  let d = Math.abs(a - (tgt.dir || 0)); if (d > Math.PI) d = 2 * Math.PI - d;
  return d > Math.PI * 0.6;
}

function targetsFor(p, sk, tgt, ax, ay) {
  const inst = p.inst;
  const out = [];
  const enemy = (o) => !o.dead && (o.kind === 'm' || o.kind === 'p' || o.kind === 's' || o.kind === 'c') && C.isEnemy(p, o) && !(o.kind === 'p' && o.hidden);
  const cap = sk.kind === 'ult' ? 40 : 20;
  if (sk.shape === 'single') { if (tgt) out.push(tgt); return out; }
  if (sk.shape === 'chain') {
    if (!tgt) return out;
    out.push(tgt);
    let cur = tgt;
    while (out.length < (sk.chain || 3)) {
      let nx = null, nd = 25;
      inst.inRadius(cur.x, cur.y, 5, (o) => { if (enemy(o) && !out.includes(o)) { const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; nx = o; } } });
      if (!nx) break; out.push(nx); cur = nx;
    }
    return out;
  }
  if (sk.shape === 'circle') {
    const ox = sk.self ? p.x : (tgt ? tgt.x : ax), oy = sk.self ? p.y : (tgt ? tgt.y : ay);
    const r = (sk.radius || 3) * (p.giantUntil > now() ? 1.5 : 1);
    inst.inRadius(ox, oy, r + 0.4, (o) => { if (out.length < cap && enemy(o)) out.push(o); });
    return out;
  }
  const dir = Math.atan2(ay - p.y, ax - p.x);
  if (sk.shape === 'cone') {
    const r = sk.radius || 4;
    inst.inRadius(p.x, p.y, r + 0.5, (o) => {
      if (out.length >= cap || !enemy(o)) return;
      let a = Math.abs(Math.atan2(o.y - p.y, o.x - p.x) - dir); if (a > Math.PI) a = 2 * Math.PI - a;
      if (a < 0.95 || W.dist(p, o) < 1) out.push(o);
    });
    return out;
  }
  if (sk.shape === 'line') {
    const len = sk.length || 8, wid = (sk.width || 1.3) / 2;
    const cx = Math.cos(dir), cy = Math.sin(dir);
    inst.query(p.x + cx * len / 2, p.y + cy * len / 2, len / 2 + 2, len / 2 + 2, (o) => {
      if (out.length >= cap || !enemy(o)) return;
      const dx = o.x - p.x, dy = o.y - p.y;
      const along = dx * cx + dy * cy, perp = Math.abs(-dx * cy + dy * cx);
      if (along >= -0.5 && along <= len + 0.5 && perp <= wid + (o.size || 0.6) * 0.4) out.push(o);
    });
    return out;
  }
  return out;
}

function moveCaster(p, sk, tgt, ax, ay) {
  const mv = sk.move; if (!mv) return;
  const inst = p.inst;
  const fx0 = p.x, fy0 = p.y;
  p._dashFrom = { x: fx0, y: fy0 };
  let dir = Math.atan2((tgt ? tgt.y : ay) - p.y, (tgt ? tgt.x : ax) - p.x);
  if (mv.type === 'back') dir += Math.PI;
  if (mv.type === 'blink' && tgt) {
    const bx = tgt.x + Math.cos(Math.atan2(tgt.y - p.y, tgt.x - p.x)) * 1.1, by = tgt.y + Math.sin(Math.atan2(tgt.y - p.y, tgt.x - p.x)) * 1.1;
    if (M.walkable(inst.map, bx, by)) inst.moveTo(p, bx, by); else inst.moveTo(p, tgt.x - Math.cos(dir) * 0.9, tgt.y - Math.sin(dir) * 0.9);
  } else {
    let dist = mv.dist;
    if (tgt && mv.type !== 'back') dist = Math.min(dist, Math.max(0, W.dist(p, tgt) - 1.0));
    if (mv.type === 'leap' || mv.type === 'jump') { if (!tgt) dist = Math.min(mv.dist, Math.hypot(ax - p.x, ay - p.y)); }
    const steps = Math.ceil(dist * 4);
    for (let i = 0; i < steps; i++) {
      const nx = p.x + Math.cos(dir) * 0.25, ny = p.y + Math.sin(dir) * 0.25;
      if (!M.walkable(inst.map, nx, ny)) break;
      inst.moveTo(p, nx, ny);
    }
  }
  p.dir = dir; p.forcePos = true; p.path = null;
  inst.emit({ k: 'dash', s: p.id, x: fx0, y: fy0, tx: p.x, ty: p.y, mt: mv.type });
}

function computeMult(p, sk, lv, tgt, t) {
  let m = sk.dmg || 0;
  const cls = D.CLASSES[p.cls];
  if (sk.perUnit) {
    let units = 0;
    if (sk.unit === 'res') units = cls.res.max === 100 ? p.res / (sk.perUnit >= 0.2 ? 20 : 1) : p.res;
    else if (sk.unit === 'stack') { for (const tg of sk.consumes || ['bleed']) units += tgt.tags.has(tg) ? tgt.tags.get(tg).stacks : 0; }
    else if (sk.unit === 'summon') units = (p.summons || []).filter((s) => !s.dead).length;
    m += sk.perUnit * units;
    if (!m) m = 0.6;
  }
  if (sk.backstab) m = behind(p, tgt) ? sk.backstab.back : sk.backstab.front;
  if (sk.cond) {
    if (sk.cond.type === 'targetHp') m *= tgt.hp / tgt.maxHp * 100 < sk.cond.v ? 1 : 0.35;
    if (sk.cond.type === 'combo') m *= p.combo >= sk.cond.v ? 1 : 0.5;
  }
  if (sk.comboUp && p.combo >= sk.comboUp.n) m = sk.comboUp.mult;
  if (sk.chainAfter) m *= p.lastSkill === sk.chainAfter ? 1.5 : 0.7;
  if (sk.fromStealth && p.stealthUntil > t) m *= sk.fromStealth;
  if (sk.lowHpScale) m *= 1 + (1 - p.hp / p.maxHp) * 1.5;
  for (const [tg, pct] of sk.bonusIf || []) if (tgt.tags.has(tg)) m *= 1 + pct / 100;
  if (sk.dotBonus) { let n = 0; for (const k in DOT) if (tgt.tags.has(k)) n++; m *= 1 + n * sk.dotBonus / 100; }
  if (sk.consumes && !sk.perUnit) {
    let has = false;
    for (const tg of sk.consumes) { const v = tgt.tags.get(tg); if (v && (!sk.minStacks || v.stacks >= sk.minStacks || tg === 'chill')) has = true; }
    if (!has && sk.role === 'F') m *= 0.5; else if (has) m *= 1.15;
  }
  return m * F.skillMult(sk, lv);
}

// v4 signature mechanics: every skill can carry one of these on top of its delivery, status, hook and utility
function mechanics(p, sk, lv, tgt, ax, ay, targets, el, t) {
  const inst = p.inst, sc = F.skillMult(sk, lv), color = (D.ELEMENTS[el] || D.ELEMENTS.neutral).color;
  const base = (sk.dmg || 0.5) * sc;
  const ox = sk.self ? p.x : (tgt ? tgt.x : ax), oy = sk.self ? p.y : (tgt ? tgt.y : ay);
  if (sk.echo) {
    // the skill rings out again: same targets, weaker
    const list = targets.slice(), m = base * sk.echo.mult;
    inst.after(sk.echo.delay, () => { if (p.dead || p.inst !== inst) return; inst.emit({ k: 'echo', s: p.id, sk: sk.id, x: ox, y: oy, el }); for (const o of list) if (!o.dead && o.inst === inst) C.dealDamage(p, o, { mult: m, el, kind: 'skill', sk }); });
  }
  if (sk.orbit) W.spawnZone(inst, { zk: 'zone', owner: p, follow: p, x: p.x, y: p.y, r: sk.orbit.r, until: t + sk.orbit.dur, tick: 0.5, mult: base * sk.orbit.mult, el, color, orbit: sk.orbit.n, sk: null, lv });
  if (sk.wall) {
    const a = Math.atan2(oy - p.y, ox - p.x) + Math.PI / 2, n = 4;
    for (let i = 0; i < n; i++) { const k = (i - (n - 1) / 2) * 1.3; const x = ox + Math.cos(a) * k, y = oy + Math.sin(a) * k; if (M.walkable(inst.map, x, y)) W.spawnZone(inst, { zk: 'zone', owner: p, x, y, r: 0.9, until: t + sk.wall.dur, tick: 0.6, mult: base * sk.wall.mult, el, color, wall: 1, sk: null, lv }); }
  }
  if (sk.trail) {
    const fx = p._dashFrom || { x: p.x, y: p.y };
    for (let i = 0; i < 4; i++) { const k = (i + 0.5) / 4, x = fx.x + (p.x - fx.x) * k, y = fx.y + (p.y - fx.y) * k; if (M.walkable(inst.map, x, y)) W.spawnZone(inst, { zk: 'zone', owner: p, x, y, r: 1, until: t + sk.trail.dur, tick: 0.7, mult: base * sk.trail.mult, el, color, trail: 1, sk: null, lv }); }
  }
  if (sk.boomerang && targets.length) {
    // the shot comes back along the same path
    inst.after(0.45, () => { if (p.dead || p.inst !== inst) return; inst.emit({ k: 'echo', s: p.id, sk: sk.id, x: ox, y: oy, el, back: 1 }); for (const o of targetsFor(p, sk, tgt && !tgt.dead ? tgt : null, ax, ay)) C.dealDamage(p, o, { mult: base * sk.boomerang, el, kind: 'skill', sk }); });
  }
  if (sk.split && targets.length) {
    const from = targets[0], hit = new Set(targets);
    const near = [];
    inst.inRadius(from.x, from.y, 4.5, (o) => { if (!hit.has(o) && !o.dead && (o.kind === 'm' || o.kind === 'p') && C.isEnemy(p, o)) near.push(o); });
    near.sort((a, b) => W.dist(a, from) - W.dist(b, from));
    for (const o of near.slice(0, sk.split.n)) { inst.emit({ k: 'bolt', x: from.x, y: from.y, tx: o.x, ty: o.y, el }); C.dealDamage(p, o, { mult: base * sk.split.mult, el, kind: 'skill', sk }); }
  }
  if (sk.stackSelf && targets.length) {
    const b = p.buffs.get('stack:' + sk.id), n = Math.min(sk.stackSelf.max, (b ? b.n || 1 : 0) + 1);
    C.addBuff(p, 'stack:' + sk.id, { dmgPct: sk.stackSelf.pct * n }, 6, sk.name + ' ×' + n, '#ffb03a');
    const nb = p.buffs.get('stack:' + sk.id); if (nb) nb.n = n;
  }
  if (sk.resetOnKill && targets.some((o) => o.dead)) { p.cds[sk.id] = 0; p.sess && p.sess.send({ t: 'cd', id: sk.id, d: 0 }); inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m: 'RESET!', c: '#7df' }); }
}

function reactionFor(sk, el, tgt) {
  for (const k in D.REACTIONS) {
    const R = D.REACTIONS[k];
    const forced = sk && sk.reaction === k;
    if (!forced && (!R.el || !R.el.includes(el))) continue;
    if (R.heavy && !(sk && (sk.role === 'F' || sk.kind === 'ult' || sk.reaction === 'shatter'))) continue;
    const ok = R.all ? R.need.every((x) => tgt.tags.has(x)) : R.need.some((x) => tgt.tags.has(x));
    if (ok) return k;
  }
  return null;
}

const execCore = function (p, sk, lv, tgt, ax, ay) {
  const t = now();
  const inst = p.inst;
  const cls = D.CLASSES[p.cls];
  const gf = p.gmf || {};
  if (!p.god && !gf.nosp) {
    p.sp -= F.skillSp(sk, lv);
    if (sk.hpCost) p.hp -= p.maxHp * sk.hpCost / 100;
  }
  if (sk.kind !== 'buff') p.gcdUntil = t + 0.4;
  const cdr = Math.min(90, p.st.cdr + (p.cdrBonus || 0));
  const cd = gf.nocd ? 0 : sk.kind === 'buff' ? sk.cd : F.skillCd(sk, lv) * (1 - cdr / 100);
  p.cds[sk.id] = t + cd;
  p.sess && p.sess.send({ t: 'cd', id: sk.id, d: Math.round(cd * 100) / 100 });
  if (sk.gauge && !p.god && !gf.nosp) p.ult = 0;
  if (p.pfx) {
    if (p.pfx.spRefund && W.rand() * 100 < p.pfx.spRefund) { p.sp = Math.min(p.maxSp, p.sp + F.skillSp(sk, lv)); inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m: 'SP REFUND', c: '#6af' }); }
    if (sk.kind === 'ult' && p.pfx.shieldOnUlt) p.shield = Math.max(p.shield || 0, p.maxHp * p.pfx.shieldOnUlt / 100);
  }
  if (sk.kind !== 'buff' && sk.shape !== 'self' && !sk.stealth && p.stealthUntil > t && !p.flags.stealth) p.stealthUntil = Math.min(p.stealthUntil, t + 0.1);
  if (tgt) { p.dir = Math.atan2(tgt.y - p.y, tgt.x - p.x); if (sk.kind === 'attack') p.atkTarget = tgt.id; }
  else if (ax !== undefined) p.dir = Math.atan2(ay - p.y, ax - p.x);
  const el = (sk.element === 'neutral' && p.weaponEl) ? p.weaponEl : sk.element;

  const actx = AF.preCast(p, sk, lv, tgt, ax, ay);
  // ---- buffs (B)
  if (sk.kind === 'buff') {
    const sc = sk.cat ? 1 + 0.05 * (lv - 1) : F.skillMult(sk, lv);
    const mods = {};
    for (const k in sk.mods) mods[k] = typeof sk.mods[k] === 'number' && !['ccImmune', 'stealth', 'invuln', 'blocks', 'extraStack', 'resGainPct', 'spRegen'].includes(k) ? Math.round(sk.mods[k] * sc * 10) / 10 : sk.mods[k];
    if (sk.mods.element === 'cycle') { const els = ['fire', 'ice', 'lightning', 'wind', 'earth']; p.cycleEl = els[(els.indexOf(p.cycleEl) + 1) % els.length]; }
    if (sk.cls === 'warlock' && sk.idx === 4) mods.soulSiphon = 1;
    const tgts = sk.party ? partyNear(p, 14) : [p];
    for (const q of tgts) { C.addBuff(q, 'buff:' + sk.id, mods, sk.dur, sk.name, cls.color); if (q !== p) q.inst.emit({ k: 'buffed', t: q.id, x: q.x, y: q.y }); }
    if (mods.soulSiphon) p.flags.soulSiphon = 1;
    inst.emit({ k: 'cast', s: p.id, sk: sk.id, x: p.x, y: p.y, tx: p.x, ty: p.y, sh: 'buff', el: 'holy' });
    AF.postCast(p, sk, lv, tgt, p.x, p.y, [], el, actx);
    return;
  }

  moveCaster(p, sk, tgt, ax, ay);
  if (sk.pull && tgt && sk.shape === 'single') {
    const d = W.dist(p, tgt), dist = Math.min(sk.pull, Math.max(0, d - 1.2));
    pullTo(tgt, p.x, p.y, dist);
  }
  inst.emit({ k: 'cast', s: p.id, sk: sk.id, x: p.x, y: p.y, tx: tgt ? tgt.x : ax, ty: tgt ? tgt.y : ay, sh: sk.shape, r: sk.radius || 0, len: sk.length || 0, self: sk.self ? 1 : 0, el, u: sk.kind === 'ult' ? 1 : 0 });

  // ---- transform ultimates & self buffs
  if (sk.transform) {
    const sc = F.skillMult(sk, lv);
    const mods = Object.assign({}, sk.transform.mods); if (mods.dmgPct) mods.dmgPct = Math.round(mods.dmgPct * sc);
    const tgts = sk.transform.party ? partyNear(p, 10) : [p];
    for (const q of tgts) C.addBuff(q, 'ult:' + sk.id, mods, sk.transform.dur, sk.name, '#ffcc33');
    if (sk.invuln) for (const q of tgts) q.invulnUntil = t + Math.min(sk.transform.dur, sk.transform.party ? 3 : 10);
    if (sk.resGain >= 99) p.res = cls.res.max;
  }
  if (sk.selfBuff) C.addBuff(p, 'sb:' + sk.id, sk.selfBuff.mods, sk.selfBuff.dur, sk.name, cls.color);
  if (sk.stealth) { p.stealthUntil = t + sk.stealth; inst.inRadius(p.x, p.y, 25, (o) => { if (o.kind === 'm' && o.target === p) o.target = null; }); }
  if (sk.nextBonus) { p.nextBonus = sk.nextBonus; }
  if (sk.cdShift) { for (const k in p.cds) if (k !== sk.id) p.cds[k] -= sk.cdShift; p.sess && p.sess.send({ t: 'cdshift', d: sk.cdShift, except: sk.id }); }
  if (sk.haste) C.addBuff(p, 'skhaste', { aspdPct: sk.haste, movePct: sk.haste }, 4, 'Accelerate', '⏩');
  if (sk.reflect && !sk.dmg) C.addBuff(p, 'sb:' + sk.id, { reflect: sk.reflect }, 4, sk.name, cls.color);
  if (sk.shield) { p.shield = Math.max(p.shield, p.maxHp * sk.shield.pct / 100 * (sk.cat ? 1 + 0.04 * (lv - 1) : F.skillMult(sk, lv) * 0.8)); }
  if (sk.selfHeal && !sk.cond) C.heal(p, p.maxHp * sk.selfHeal / 100, p);
  if (sk.fullRestore) for (const q of partyNear(p, 14)) { q.hp = q.maxHp; q.sp = q.maxSp; if (sk.resetCd) { q.cds = {}; q.sess && q.sess.send({ t: 'cdreset' }); } }
  if (sk.revive) for (const q of partyNear(p, 12, true)) if (q.dead) { q.dead = false; q.hp = q.maxHp * 0.5; q.sp = q.maxSp * 0.3; inst.emit({ k: 'buffed', t: q.id, x: q.x, y: q.y }); q.sess && q.sess.send({ t: 'revived' }); }
  if (sk.cleanse) for (const q of partyNear(p, 8)) for (const k of [...q.tags.keys()]) q.tags.delete(k);
  if (sk.summon) {
    const n = Math.min(sk.summon.count, 12);
    const shape = p.cls === 'ranger' ? 'beast' : p.cls === 'shadow_assassin' || p.cls === 'void_walker' ? 'shadow' : p.cls === 'gunslinger' ? 'drone' : p.cls === 'divine_sovereign' || p.cls === 'lightbringer' ? 'spirit' : p.cls === 'hellfiend' ? 'imp' : 'undead';
    const color = p.cls === 'ranger' ? '#a08060' : p.cls === 'shadow_assassin' || p.cls === 'void_walker' ? '#4a2a6a' : p.cls === 'gunslinger' ? '#9ab' : p.cls === 'divine_sovereign' || p.cls === 'lightbringer' ? '#ffe9a0' : p.cls === 'hellfiend' ? '#c83a1a' : '#c8c0e0';
    const mag2 = cls.dmg === 'mag', sm = sk.summon.mult ? sk.summon.mult * (1 + 0.06 * (lv - 1)) : sk.kind === 'ult' ? 0.8 : 0.55;
    for (let i = 0; i < n; i++) W.spawnSummon(p, { name: sk.name.replace(/^(Raise|Summon|Army of the)\s*/i, '') || 'Minion', dur: sk.summon.dur, shape: sk.summon.turret ? 'drone' : cls.summonShape || (/Knight/.test(sk.name) ? 'knight' : /Wraith|Spirit/.test(sk.name) ? 'spirit' : shape), color: cls.color || color, mult: sm, mag: mag2, element: el, turret: sk.summon.turret, sk });
  }
  if (sk.detonate === 'trap') {
    for (const z of [...inst.entities.values()]) if (z.kind === 'z' && z.zk === 'trap' && z.owner === p) { z.boost = 1.5; C.triggerTrap(z); }
  }
  if (sk.detonate === 'delayed') for (const d of p.delayed) if (d.at > t) { d.at = t; d.mult *= 1.5; }

  // ---- traps / zones placed at aim point
  if (sk.multiTrap) {
    for (let i = 0; i < sk.multiTrap; i++) { const a = i / sk.multiTrap * 6.283, d = 2.5 + (i % 3); const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (M.walkable(inst.map, x, y)) W.spawnZone(inst, { zk: 'trap', owner: p, x, y, r: 1.5, until: t + 40, armedAt: t + 0.4, sk, lv, el, color: (D.ELEMENTS[el] || D.ELEMENTS.neutral).color }); }
    return afterCast(p, sk, false);
  }
  if (sk.trap) {
    const tx = tgt ? tgt.x : ax, ty = tgt ? tgt.y : ay;
    const mine = [...inst.entities.values()].filter((z) => z.kind === 'z' && z.zk === 'trap' && z.owner === p);
    if (mine.length >= 6) { inst.remove(mine[0]); }
    W.spawnZone(inst, { zk: 'trap', owner: p, x: tx, y: ty, r: 1.5, until: t + 40, armedAt: t + 0.4, sk, lv, el, color: (D.ELEMENTS[el] || D.ELEMENTS.neutral).color });
    if (!tgt || W.dist(tgt, { x: tx, y: ty }) > 1.5) { p.cdTouched = true; AF.postCast(p, sk, lv, tgt, ax, ay, [], el, actx); return afterCast(p, sk, false); }
  }
  if (sk.zone || (sk.heal && sk.heal.zone)) {
    const ox = sk.self ? p.x : (tgt ? tgt.x : ax), oy = sk.self ? p.y : (tgt ? tgt.y : ay);
    const z = sk.zone || { mult: 0, tick: 1, dur: 8 };
    W.spawnZone(inst, { zk: 'zone', owner: p, x: ox, y: oy, r: sk.radius || 3, until: t + z.dur, tick: z.tick, mult: z.mult * F.skillMult(sk, lv), sk, lv, el, heal: sk.heal && sk.heal.zone ? sk.heal.pct : 0, color: (D.ELEMENTS[el] || D.ELEMENTS.neutral).color, follow: sk.self && /หมุน|รอบตัว/.test(sk.desc) ? p : null });
    if (!sk.dmg) { AF.postCast(p, sk, lv, tgt, ax, ay, [], el, actx); return afterCast(p, sk, false); }
  }

  // ---- direct hits
  let anyHit = false;
  const targets = sk.dmg || sk.perUnit || sk.applies ? targetsFor(p, sk, tgt, ax, ay) : [];
  p._lastTargets = targets; actx.nT = targets.length;
  let nb = p.nextBonus && sk.dmg ? 1 + p.nextBonus / 100 : 1;
  if (sk.overcharge && !p.god && !gf.nosp) { const extra = p.maxSp * sk.overcharge.sp / 100; if (p.sp >= extra) { p.sp -= extra; nb *= sk.overcharge.mult; inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m: 'OVERCHARGE', c: '#6af' }); } }
  else if (sk.overcharge) nb *= sk.overcharge.mult;
  if (p.nextBonus && sk.dmg) p.nextBonus = 0;
  let totalDealt = 0;
  for (const o of targets) {
    if (o.dead) continue;
    let mult = computeMult(p, sk, lv, o, t) * nb * actx.nb * AF.tgtMult(p, sk, o, actx.n, actx);
    const aopt = AF.hitOpts(sk, actx, p, o); let dealtO = 0;
    const reaction = reactionFor(sk, el, o);
    let rmult = 1;
    if (reaction) {
      rmult = D.REACTIONS[reaction].mult;
      inst.emit({ k: 'react', t: o.id, x: o.x, y: o.y, r: reaction });
      doReaction(p, o, reaction, mult, el);
    }
    // consume tags
    if (sk.consumes) for (const tg of sk.consumes) o.tags.delete(tg);
    if (sk.consumeRes) {}
    if (sk.delay) {
      const d = { at: t + sk.delay, mult: mult * rmult, tgt: o };
      p.delayed.push(d);
      inst.emit({ k: 'mark', t: o.id, x: o.x, y: o.y, d: sk.delay });
      const tick = () => { if (d.at > now() + 0.05) return inst.after(d.at - now(), tick); if (!o.dead && o.inst === inst) { C.dealDamage(p, o, { mult: d.mult, el, kind: 'skill', finisher: true, sk }); inst.emit({ k: 'boom', x: o.x, y: o.y, el }); } p.delayed = p.delayed.filter((x) => x !== d); };
      inst.after(sk.delay, tick);
      anyHit = true; continue;
    }
    if (mult > 0) {
      const hits = Math.max(1, sk.hits || 1);
      const shown = Math.min(hits, 8);
      const per = mult * hits / shown;
      for (let h = 0; h < shown && !o.dead; h++) {
        const dd = C.dealDamage(p, o, { mult: per * (h === 0 ? rmult : 1), el, kind: 'skill', pierce: aopt.pierce || (sk.pierce > 1 ? 0 : sk.pierce), critDmgBonus: aopt.critDmgBonus, critBonus: (sk.critBonus || 0) + aopt.critBonus + (sk.fromStealth && p.stealthUntil > t ? 100 : 0), lifesteal: sk.lifesteal, finisher: sk.role === 'F' || sk.kind === 'ult', reaction: h === 0 ? reaction : null, siege: sk.siege, sk });
        totalDealt += dd; dealtO += dd;
      }
      anyHit = true;
    }
    AF.afterHit(p, sk, o, dealtO, actx, el);
    if (o.dead) continue;
    if (sk.execute && o.kind !== 'c' && o.hp / o.maxHp * 100 < sk.execute && !(o.kind === 'm' && o.rank >= 2)) C.dealDamage(p, o, { flat: o.hp + 1, kind: 'true', reaction: 'execute' });
    for (const ap of sk.applies || []) {
      if (ap.extend && o.tags.has(ap.tag)) { o.tags.get(ap.tag).until += ap.extend; continue; }
      C.applyTag(o, ap.tag, ap.stacks || 1, ap.dur || D.TAGS[ap.tag].dur, p);
    }
    if (sk.extendDots) for (const k in DOT) if (o.tags.has(k)) o.tags.get(k).until += sk.extendDots;
    if (sk.detonate === 'dots') for (const k in DOT) { const v = o.tags.get(k); if (v && v.dps) C.dealDamage(p, o, { flat: v.dps * v.stacks * 2, kind: 'dot', el: 'blood' }); }
    if (sk.push && o.kind !== 'c' && !(o.kind === 'm' && o.rank >= 2)) pushAway(o, p.x, p.y, sk.push);
    if (sk.pull && sk.shape !== 'single' && o.kind !== 'c' && !(o.kind === 'm' && o.rank >= 2)) pullTo(o, sk.self ? p.x : (tgt ? tgt.x : ax), sk.self ? p.y : (tgt ? tgt.y : ay), sk.pull);
    if (sk.taunt && o.kind === 'm') { o.target = p; o.tauntBy = p; o.tauntUntil = t + 4; }
    if (sk.manaBurn && o.kind === 'p') { const b = o.sp * sk.manaBurn / 100; o.sp -= b; C.dealDamage(p, o, { flat: Math.round(b * 2), kind: 'skill' }); }
    if (sk.dispel && o.kind === 'p') { let n = sk.dispel; for (const k of [...o.buffs.keys()]) { if (n-- <= 0) break; o.buffs.delete(k); } o.buffsChanged = true; C.recalc(o); }
    if (/ลดฮีล/.test(sk.desc)) o.healCut = { until: t + 8, pct: 0.4 };
  }
  mechanics(p, sk, lv, tgt, ax, ay, targets, el, t);
  AF.postCast(p, sk, lv, tgt, ax, ay, targets, el, actx);
  if (sk.taunt && !targets.length) inst.inRadius(p.x, p.y, sk.radius || 4, (o) => { if (o.kind === 'm') { o.target = p; o.tauntBy = p; o.tauntUntil = t + 4; } });
  if (sk.heal && !sk.heal.zone) {
    const sc = F.skillMult(sk, lv);
    const list = sk.heal.who === 'party' ? partyNear(p, 9) : [lowestAlly(p, 10)];
    for (const q of list) if (q) C.heal(q, q.maxHp * sk.heal.pct / 100 * sc, p);
  }
  if (sk.healFromDmg && totalDealt) { const q = lowestAlly(p, 10); if (q) C.heal(q, totalDealt * sk.healFromDmg, p); }
  if (sk.selfHealPerStack && targets.length) C.heal(p, p.maxHp * 0.04 * 3, p);
  if (sk.selfHeal && sk.cond) C.heal(p, p.maxHp * sk.selfHeal / 100, p);
  if (sk.summon && sk.perUnit) {}
  if (sk.unit === 'summon') { for (const s of p.summons) if (!s.dead) { inst.emit({ k: 'boom', x: s.x, y: s.y, el: 'dark' }); W.killQuiet(s); } p.summons = []; }
  afterCast(p, sk, anyHit);
};

function afterCast(p, sk, anyHit) {
  const t = now();
  if (sk.consumeRes && !p.god) { p.res = 0; if (p.orbEls) p.orbEls = []; }
  if (anyHit || sk.kind === 'attack') {
    if (anyHit) {
      if (t - p.comboT <= p.st.comboWin && p.lastSkill !== sk.id) p.combo++;
      else if (t - p.comboT > p.st.comboWin) p.combo = 1;
      p.comboT = t;
      if (p.combo > p.bestCombo) p.bestCombo = p.combo;
      if (p.combo > (p.char.bestCombo || 0)) p.char.bestCombo = p.combo;
      if (p.combo >= 10 && p.combo % 2 === 0) P.event(p, 'combo', { n: p.combo });
      const ms = { 5: 10, 10: 15, 15: 20, 20: 30 }[p.combo];
      if (ms) { p.ult = Math.min(100, p.ult + ms); p.inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m: `${p.combo} COMBO! +${ms}% ULT`, c: '#ffd34a', big: 1 }); }
      if (sk.kind !== 'ult') p.ult = Math.min(100, p.ult + 3 * (1 + ((p.pfx && p.pfx.ultCharge) || 0) / 100));
      p.lastHit = t;

    }
    p.lastSkill = sk.id;
    P.event(p, 'skill');
  }
}

function partyNear(p, r, includeDead) {
  const out = [p];
  if (!p.party) return out;
  for (const q of p.inst.players) if (q !== p && q.party === p.party && (includeDead || !q.dead) && W.dist(q, p) <= r) out.push(q);
  return out;
}
function lowestAlly(p, r) {
  let best = p, bv = p.hp / p.maxHp;
  for (const q of partyNear(p, r)) { const v = q.hp / q.maxHp; if (v < bv) { bv = v; best = q; } }
  return best;
}
C.partyNear = partyNear;
function pushAway(o, fx, fy, dist) {
  const a = Math.atan2(o.y - fy, o.x - fx);
  for (let i = 0; i < dist * 4; i++) { const nx = o.x + Math.cos(a) * 0.25, ny = o.y + Math.sin(a) * 0.25; if (!M.walkable(o.inst.map, nx, ny)) { if (i < dist * 4 - 1) C.applyTag(o, 'stun', 1, 0.8, null, { quiet: true }); break; } o.inst.moveTo(o, nx, ny); }
  if (o.kind === 'p') o.forcePos = true;
}
function pullTo(o, tx, ty, dist) {
  const a = Math.atan2(ty - o.y, tx - o.x);
  const maxD = Math.max(0, Math.hypot(tx - o.x, ty - o.y) - 1.1);
  for (let i = 0; i < Math.min(dist, maxD) * 4; i++) { const nx = o.x + Math.cos(a) * 0.25, ny = o.y + Math.sin(a) * 0.25; if (!M.walkable(o.inst.map, nx, ny)) break; o.inst.moveTo(o, nx, ny); }
  if (o.kind === 'p') o.forcePos = true;
}

function doReaction(p, o, r, mult, el) {
  const inst = p.inst;
  const R = D.REACTIONS[r];
  for (const tg of R.need) if (r !== 'hemorrhage') o.tags.delete(tg);
  if (r === 'electrocute') {
    C.applyTag(o, 'stun', 1, 1.5, p);
    let n = 0;
    inst.inRadius(o.x, o.y, 5, (q) => { if (n < 3 && q !== o && !q.dead && C.isEnemy(p, q)) { n++; inst.emit({ k: 'bolt', x: o.x, y: o.y, tx: q.x, ty: q.y }); C.dealDamage(p, q, { mult: mult * 0.5, el: 'lightning', kind: 'skill' }); } });
  } else if (r === 'firestorm' || r === 'steam' || r === 'toxic') {
    inst.emit({ k: 'boom', x: o.x, y: o.y, el: r === 'steam' ? 'water' : r === 'toxic' ? 'poison' : 'fire', r: 3 });
    inst.inRadius(o.x, o.y, 3, (q) => { if (q !== o && !q.dead && C.isEnemy(p, q)) { C.dealDamage(p, q, { mult: mult * 0.6, el: r === 'steam' ? 'water' : 'fire', kind: 'skill' }); if (r === 'toxic') C.applyTag(q, 'poison', 2, 6, p); if (r === 'firestorm') C.applyTag(q, 'burn', 1, 4, p); } });
  } else if (r === 'twilight') {
    const pct = o.kind === 'm' && o.rank >= 2 ? 0.03 : o.kind === 'p' ? 0.06 : 0.15;
    C.dealDamage(p, o, { flat: Math.round(o.maxHp * pct), kind: 'true', reaction: 'twilight' });
  } else if (r === 'hemorrhage') C.applyTag(o, 'bleed', 2, 6, p);
}

C.zoneTick = function (z) {
  const p = z.owner, inst = z.inst;
  if (z.follow && !z.follow.dead) { z.x = z.follow.x; z.y = z.follow.y; inst.moveTo(z, z.x, z.y); }
  if (z.heal) for (const q of C.partyNear(p, 50)) if (Math.hypot(q.x - z.x, q.y - z.y) <= z.r) C.heal(q, q.maxHp * z.heal / 100 * 0.6, p);
  inst.inRadius(z.x, z.y, z.r, (o) => {
    if (o.dead || !C.isEnemy(p, o)) return;
    if (z.slow) { C.applyTag(o, 'slow', 1, 1, p, { quiet: true }); return; }
    if (z.mult > 0) { const d = C.dealDamage(p, o, { mult: z.mult, el: z.el, kind: 'skill' }); if (z.sk && z.sk.riders && !z.trail && z.zf !== 'burn') AF.zoneRider(p, z.sk, o, d); if (z.zf === 'burn') return; }
    else if (z.sk && z.sk.dmg) C.dealDamage(p, o, { mult: 0.35 * F.skillMult(z.sk, z.lv), el: z.el, kind: 'skill' });
    if (z.heal && (o.element === 'dark' || o.shape === 'undead')) C.dealDamage(p, o, { mult: 0.8, el: 'holy', kind: 'skill' });
    for (const ap of (z.sk && z.sk.applies) || []) C.applyTag(o, ap.tag, 1, Math.min(ap.dur || 2, 2.5), p, { quiet: true });
  });
};
C.triggerTrap = function (z) {
  if (z.dead) return;
  const p = z.owner, inst = z.inst;
  inst.emit({ k: 'boom', x: z.x, y: z.y, el: z.el, r: 2.2 });
  inst.inRadius(z.x, z.y, 2.2, (o) => {
    if (o.dead || !C.isEnemy(p, o)) return;
    C.dealDamage(p, o, { mult: (z.sk.dmg || 1) * F.skillMult(z.sk, z.lv) * (z.boost || 1), el: z.el, kind: 'skill', finisher: !!z.boost });
    for (const ap of z.sk.applies || []) C.applyTag(o, ap.tag, ap.stacks || 1, ap.dur || 2, p);
  });
  z.dead = true; inst.remove(z);
};

// ------------------------------------------------------------------ movement from client
C.clientMove = function (p, x, y) {
  const t = now();
  if (p.dead || (p.auto && p.auto.on)) { p.forcePos = true; return; }
  if (!W.canMove(p)) { p.forcePos = true; p.lastMv = t; return; }
  const dt = Math.max(0.05, Math.min(0.5, t - p.lastMv));
  p.lastMv = t;
  const d = Math.hypot(x - p.x, y - p.y);
  if (d < 0.001) return;
  const maxD = W.speedOf(p) * dt * 1.6 + 0.4;
  if (d > maxD + 2.5 || !M.walkable(p.inst.map, x, y)) { p.forcePos = true; return; }
  if (d > maxD) { x = p.x + (x - p.x) / d * maxD; y = p.y + (y - p.y) / d * maxD; p.forcePos = true; }
  p.dir = Math.atan2(y - p.y, x - p.x);
  p.inst.moveTo(p, x, y);
  p.movedAt = t;
  if (p.cls === 'ranger' && p.res > 0 && !p.flags.resGainPct) p.res = Math.max(0, p.res - dt * 0.5);
};


// ------------------------------------------------------------------ signature traits (every skill has its own)
C.exec = function (p, sk, lv, tgt, ax, ay) {
  const t = now();
  const ctx = { t0: tgt, tags: tgt ? new Set(tgt.tags.keys()) : new Set(), hp: tgt ? tgt.hp / tgt.maxHp : 1, res: p.res, moved: t - (p.movedAt || 0), selfHp: p.hp / p.maxHp };
  p._dealt = 0; p._crits = 0; p._lastTargets = [];
  p.castN = p.castN || {}; p.castN[sk.id] = (p.castN[sk.id] || 0) + 1;
  execCore(p, sk, lv, tgt, ax, ay);
  try { C.trait(p, sk, lv, ctx); } catch (e) { console.error('trait error', sk.id, e); }
};
function traitTriggered(p, sk, ctx) {
  const tr = sk.trait, v = tr.tv, t0 = ctx.t0, list = p._lastTargets || [];
  switch (tr.tr) {
    case 'cast': return true;
    case 'crit': return p._crits > 0;
    case 'kill': return list.some((o) => o.dead) || !!(t0 && t0.dead);
    case 'tag': return ctx.tags.has(v);
    case 'clean': return !!t0 && ctx.tags.size === 0;
    case 'lowhp': return ctx.selfHp * 100 < v;
    case 'fullhp': return ctx.selfHp >= 0.99;
    case 'combo': return p.combo >= v;
    case 'nth': return p.castN[sk.id] % v === 0;
    case 'boss': return !!t0 && t0.kind === 'm' && t0.rank >= 1;
    case 'multi': return list.length >= v;
    case 'fullres': return ctx.res >= D.CLASSES[p.cls].res.max;
    case 'fresh': return !!t0 && ctx.hp >= 0.99;
    case 'finish': return !!t0 && ctx.hp * 100 < v;
    case 'moving': return ctx.moved < 1;
    case 'still': return ctx.moved > 2;
  }
  return false;
}
C.trait = function (p, sk, lv, ctx) {
  const tr = sk.trait; if (!tr || p.dead) return;
  if (!traitTriggered(p, sk, ctx)) return;
  const inst = p.inst, t = now(), n = tr.n;
  const list = (p._lastTargets || []).filter((o) => o.inst === inst);
  const tt = ctx.t0 && ctx.t0.inst === inst ? ctx.t0 : list[0] || null;
  const live = tt && !tt.dead ? tt : list.find((o) => !o.dead) || null;
  const pos = tt || p;
  const needs = ['tag', 'echo', 'nova', 'spread', 'pull', 'true', 'execute', 'vamp', 'chain', 'blink', 'expose', 'zeny', 'partyheal', 'weaken'];
  if (needs.includes(tr.ef) && !tt) return;
  const enemiesNear = (x, y, r) => { const o = []; inst.inRadius(x, y, r, (e) => { if (!e.dead && (e.kind === 'm' || e.kind === 'p' || e.kind === 's') && C.isEnemy(p, e)) o.push(e); }); return o; };
  const el = sk.element || 'neutral';
  const label = (sk.trait.th.split('→')[1] || '').trim();
  inst.emit({ k: 'trait', s: p.id, sk: sk.id, x: pos.x, y: pos.y, m: label });
  switch (tr.ef) {
    case 'tag': if (live) C.applyTag(live, tr.ev, 1, D.TAGS[tr.ev].dur, p); break;
    case 'heal': C.heal(p, p.maxHp * n / 100, p); break;
    case 'shield': p.shield = Math.max(p.shield, p.maxHp * n / 100); break;
    case 'cdr': for (const k in p.cds) if (k !== sk.id) p.cds[k] -= n; p.sess && p.sess.send({ t: 'cdshift', d: n, except: sk.id }); break;
    case 'sp': p.sp = Math.min(p.maxSp, p.sp + p.maxSp * n / 100); break;
    case 'res': p.res = Math.min(D.CLASSES[p.cls].res.max, p.res + n); break;
    case 'ult': p.ult = Math.min(100, p.ult + n); break;
    case 'echo': if (live) C.dealDamage(p, live, { mult: n / 100, el: tr.ev, kind: 'skill' }); break;
    case 'nova': inst.emit({ k: 'boom', x: pos.x, y: pos.y, r: 3, el }); for (const e of enemiesNear(pos.x, pos.y, 3)) C.dealDamage(p, e, { mult: n / 100, el, kind: 'skill' }); break;
    case 'spread': { const src = tt.tags; for (const e of enemiesNear(pos.x, pos.y, 4)) if (e !== tt) for (const [k, v] of src) if (!D.TAGS[k].cc) C.applyTag(e, k, v.stacks, Math.max(1, v.until - t), p, { quiet: true }); break; }
    case 'pull': for (const e of enemiesNear(pos.x, pos.y, 5)) if (e !== tt && !(e.kind === 'm' && e.rank >= 2)) pullTo(e, pos.x, pos.y, 4); break;
    case 'haste': C.addBuff(p, 'trait:' + sk.id, { movePct: n }, 4, sk.name, sk.fx.c[0]); break;
    case 'fury': C.addBuff(p, 'trait:' + sk.id, { dmgPct: n }, 5, sk.name, sk.fx.c[0]); break;
    case 'ward': C.addBuff(p, 'trait:' + sk.id, { dmgReduce: n }, 3, sk.name, sk.fx.c[0]); break;
    case 'cleanse': p.tags.clear(); break;
    case 'true': if (live) C.dealDamage(p, live, { flat: Math.round(live.maxHp * n / 100 * ((live.kind === 'm' && live.rank >= 2) || live.kind === 'p' ? 0.2 : 1)), kind: 'true', reaction: 'true' }); break;
    case 'execute': if (live && live.kind === 'm' && live.rank < 2 && live.hp / live.maxHp * 100 < n) C.dealDamage(p, live, { flat: live.hp + 1, kind: 'true', reaction: 'execute' }); break;
    case 'vamp': if (p._dealt) C.heal(p, p._dealt * n / 100, p); break;
    case 'zone': W.spawnZone(inst, { zk: 'zone', owner: p, x: pos.x, y: pos.y, r: 2.5, until: t + 3, tick: 1, mult: 0.45, sk: { applies: [], dmg: 0 }, lv, el: tr.ev, color: (D.ELEMENTS[tr.ev] || D.ELEMENTS.neutral).color }); break;
    case 'chain': { let cur = tt; const hit = new Set([tt]); for (let i = 0; i < tr.ev; i++) { const nx = enemiesNear(cur.x, cur.y, 5).filter((e) => !hit.has(e)).sort((a, b) => W.dist(a, cur) - W.dist(b, cur))[0]; if (!nx) break; inst.emit({ k: 'bolt', x: cur.x, y: cur.y, tx: nx.x, ty: nx.y }); C.dealDamage(p, nx, { mult: n / 100, el, kind: 'skill' }); hit.add(nx); cur = nx; } break; }
    case 'blink': { const a = Math.atan2(tt.y - p.y, tt.x - p.x); const bx = tt.x + Math.cos(a) * 1.2, by = tt.y + Math.sin(a) * 1.2; if (M.walkable(inst.map, bx, by)) { inst.emit({ k: 'dash', s: p.id, x: p.x, y: p.y, tx: bx, ty: by, mt: 'blink' }); inst.moveTo(p, bx, by); p.forcePos = true; } break; }
    case 'reset': p.cds[sk.id] = 0; p.sess && p.sess.send({ t: 'cd', id: sk.id, d: 0 }); break;
    case 'expose': if (live) { live.exposeUntil = t + 4; live.exposePct = n; } break;
    case 'summon': W.spawnSummon(p, { name: 'ภูต ' + sk.name, dur: 6, shape: 'spirit', color: sk.fx.c[0], mult: 0.5, element: el, mag: p.st.dmgType === 'mag' }); break;
    case 'knock': for (const e of enemiesNear(p.x, p.y, 3)) if (!(e.kind === 'm' && e.rank >= 2)) pushAway(e, p.x, p.y, 3); break;
    case 'nextcrit': p.nextCrit = true; break;
    case 'zeny': if (tt.kind === 'm') { p.char.zeny += n * tt.lv; C.sendChar(p, ['zeny']); } break;
    case 'partyheal': if (p._dealt) for (const q of C.partyNear(p, 8)) C.heal(q, p._dealt * n / 100, p); break;
    case 'stealth': p.stealthUntil = t + 2; inst.inRadius(p.x, p.y, 25, (o) => { if (o.kind === 'm' && o.target === p) o.target = null; }); break;
    case 'weaken': if (live) { live.weakUntil = t + 5; live.weakPct = n; } break;
  }
};

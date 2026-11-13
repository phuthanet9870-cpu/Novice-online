// Server-side auto-play (PvE only): targeting rules, skill rotation with conditions, potions, buffs, supply runs.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const { SKILLS } = require('../shared/skills.js');
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const M = require('../shared/mapgen.js');

const A = module.exports;
const COND = ['always', 'opener', 'tag', 'notag', 'targetHpBelow', 'selfHpBelow', 'selfSpAbove', 'mobsAround', 'comboAtLeast', 'isElite'];
A.COND = COND;

A.sanitize = function (cfg) {
  const a = C.defaultAuto();
  if (!cfg || typeof cfg !== 'object') return a;
  const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  a.mode = ['nearest', 'lowest', 'priority', 'defensive'].includes(cfg.mode) ? cfg.mode : 'nearest';
  a.radius = num(cfg.radius, 4, 40, 14);
  a.anchor = !!cfg.anchor;
  a.whitelist = Array.isArray(cfg.whitelist) ? cfg.whitelist.slice(0, 20).map((s) => String(s).slice(0, 40)) : [];
  a.blacklist = Array.isArray(cfg.blacklist) ? cfg.blacklist.slice(0, 20).map((s) => String(s).slice(0, 40)) : [];
  a.avoidBoss = cfg.avoidBoss !== false; a.ksProtect = cfg.ksProtect !== false;
  const rot = (list) => (Array.isArray(list) ? list.slice(0, 18).filter((x) => x && SKILLS[x.id]).map((x) => ({ id: x.id, cond: COND.includes(x.cond) ? x.cond : 'always', v: typeof x.v === 'number' || typeof x.v === 'string' ? x.v : 0, why: typeof x.why === 'string' ? x.why.slice(0, 40) : undefined })) : []);
  a.fight = cfg.fight === 'pvp' ? 'pvp' : 'pve';
  a.rotPve = rot(cfg.rotPve); a.rotPvp = rot(cfg.rotPvp); a.pvpTarget = ['lowest', 'nearest', 'healer'].includes(cfg.pvpTarget) ? cfg.pvpTarget : 'lowest';
  a.rotation = Array.isArray(cfg.rotation) ? cfg.rotation.slice(0, 18).filter((x) => x && SKILLS[x.id]).map((x) => ({ id: x.id, cond: COND.includes(x.cond) ? x.cond : 'always', v: typeof x.v === 'number' || typeof x.v === 'string' ? x.v : 0 })) : [];
  a.useUlt = ['never', 'elite', 'always'].includes(cfg.useUlt) ? cfg.useUlt : 'elite';
  a.autoBuff = cfg.autoBuff !== false;
  a.hpPot = num(cfg.hpPot, 0, 95, 45); a.spPot = num(cfg.spPot, 0, 95, 25);
  a.returnTown = cfg.returnTown !== false; a.supply = cfg.supply !== false; a.potBuy = num(cfg.potBuy, 0, 500, 50);
  a.offline = !!cfg.offline; a.lootMinRarity = num(cfg.lootMinRarity, 0, 5, 0);
  a.lootPotions = cfg.lootPotions !== false; a.lootMats = cfg.lootMats !== false;
  a.partyHeal = num(cfg.partyHeal, 0, 95, 60); a.breakFree = cfg.breakFree !== false; a.respawnReturn = cfg.respawnReturn !== false;
  return a;
};

A.setOn = function (p, on) {
  const a = p.auto;
  if (on && !p.inst.autoAllowed) { p.sess && p.sess.send({ t: 'err', m: 'แผนที่นี้ไม่อนุญาตให้ใช้ออโต้' }); on = false; }
  a.on = !!on;
  a.target = null; a.state = 'farm';
  if (on) { a.ax = p.x; a.ay = p.y; a.farmMap = p.inst.id; a.startAt = Date.now(); a.startExp = p.char.exp; a.startLv = p.lv; a.startZeny = p.char.zeny; a.kills0 = p.char.kills || 0; }
  p.atkTarget = null;
  p.forcePos = true;
  if (!on && a.startAt) {
    const mins = (Date.now() - a.startAt) / 60000;
    p.sess && p.sess.send({ t: 'autoReport', mins: Math.round(mins * 10) / 10, kills: (p.char.kills || 0) - (a.kills0 || 0), zeny: p.char.zeny - (a.startZeny || 0), lv: p.lv - (a.startLv || p.lv) });
    a.startAt = 0;
  }
};

A.breakFree = function (p) {
  const t = W.now();
  if ((p.breakFreeAt || 0) > t) return false;
  if (!C.isHardCC(p) && !p.tags.has('root') && !p.tags.has('slow')) return false;
  if (p.sp < p.maxSp * 0.15) return false;
  p.sp -= p.maxSp * 0.15; p.breakFreeAt = t + 25;
  for (const k of ['airborne', 'knockdown', 'stun', 'freeze', 'root', 'slow', 'fear']) p.tags.delete(k);
  p.inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m: 'BREAK FREE!', c: '#7df' });
  p.sess && p.sess.send({ t: 'cd', id: 'breakfree', d: 25 });
  return true;
};

function bestPot(ch, kind, lv) {
  let best = null;
  for (const it of ch.inv) { const d = D.ITEMS[it.id]; if (d && d.type === 'potion' && d[kind] && d.lv <= lv && (!best || d[kind] > D.ITEMS[best.id][kind])) best = it; }
  return best;
}
function skillReady(p, id, t) {
  const sk = SKILLS[id]; if (!sk) return false;
  const lv = p.char.skills[id] || 0; if (!lv) return false;
  if ((p.cds[id] || 0) > t) return false;
  if (p.sp < F.skillSp(sk, lv)) return false;
  if (sk.needRes && p.res < sk.needRes) return false;
  if (sk.gauge && p.ult < 100) return false;
  if (sk.kind !== 'buff' && (p.gcdUntil || 0) > t) return false;
  if (sk.cond && sk.cond.type === 'selfHp' && p.hp / p.maxHp * 100 >= sk.cond.v) return false;
  if (sk.hpCost && p.hp < p.maxHp * 0.4) return false;
  return true;
}
function condOk(p, e, tgt, a) {
  const v = e.v;
  switch (e.cond) {
    case 'opener': return tgt.hp >= tgt.maxHp * 0.98;
    case 'tag': return tgt.tags.has(v);
    case 'notag': return !tgt.tags.has(v);
    case 'targetHpBelow': return tgt.hp / tgt.maxHp * 100 < +v;
    case 'selfHpBelow': return p.hp / p.maxHp * 100 < +v;
    case 'selfSpAbove': return p.sp / p.maxSp * 100 > +v;
    case 'mobsAround': { let n = 0; p.inst.inRadius(p.x, p.y, 4, (o) => { if (o.kind === 'm' && !o.dead) n++; }); return n >= +v; }
    case 'comboAtLeast': return p.combo >= +v;
    case 'isElite': return tgt.kind === 'm' && tgt.rank >= 1;
    default: return true;
  }
}
const nameMatch = (list, n) => list.some((s) => s && n.toLowerCase().includes(s.toLowerCase()));

function pickTarget(p, a, t) {
  const cx = a.anchor ? a.ax : p.x, cy = a.anchor ? a.ay : p.y;
  let best = null, bv = Infinity;
  // PvP mode: hostile players first (lowest HP% / nearest / healers), monsters only when no player is around
  if (a.fight === 'pvp') {
    p.inst.inRadius(p.x, p.y, Math.max(a.radius, 16), (o) => {
      if (o.kind !== 'p' || o === p || o.dead || o.hidden || C.stealthed(o) || !C.isEnemy(p, o)) return;
      const v = a.pvpTarget === 'nearest' ? W.dist(p, o) : a.pvpTarget === 'healer' ? (o.cls === 'cleric' ? 0 : 100) + o.hp / o.maxHp * 100 : o.hp / o.maxHp * 100 + W.dist(p, o) * 0.5;
      if (v < bv) { bv = v; best = o; }
    });
    if (best) return best;
    bv = Infinity;
  }
  // defend: whoever is hitting me first
  p.inst.inRadius(p.x, p.y, 8, (o) => { if (!best && o.kind === 'm' && !o.dead && o.target === p) best = o; });
  if (best) return best;
  if (a.mode === 'defensive') return null;
  p.inst.inRadius(cx, cy, a.radius, (o) => {
    if (o.kind !== 'm' || o.dead || o.owner) return;
    if (a.ignore && a.ignore[o.id] > t) return;
    if (a.avoidBoss && o.rank >= 2) return;
    if (a.whitelist.length && !nameMatch(a.whitelist, o.name)) return;
    if (a.blacklist.length && nameMatch(a.blacklist, o.name)) return;
    if (a.ksProtect && o.lastHitBy && o.lastHitBy !== p.id && t - o.lastHitAt < 6) {
      const q = p.inst.entities.get(o.lastHitBy);
      if (q && (!p.party || q.party !== p.party)) return;
    }
    let v;
    if (a.mode === 'lowest') v = o.hp;
    else if (a.mode === 'priority') { const i = a.whitelist.findIndex((s) => o.name.toLowerCase().includes(s.toLowerCase())); v = (i < 0 ? 99 : i) * 1000 + W.dist(p, o); }
    else v = W.dist(p, o);
    if (v < bv) { bv = v; best = o; }
  });
  return best;
}

A.update = function (p, dt, t) {
  const a = p.auto;
  if (!p.inst.autoAllowed) { A.setOn(p, false); return; }
  if (t < (a.nextThink || 0)) { if (a.moveTo) W.stepToward(p, a.moveTo.x, a.moveTo.y, dt, a.moveTo.r || 0.3); return; }
  a.nextThink = t + 0.2;
  const ch = p.char;
  // break free
  if (a.breakFree && C.isHardCC(p)) { A.breakFree(p); return; }
  // potions
  if (p.hp / p.maxHp * 100 < a.hpPot) { const it = bestPot(ch, 'hp', ch.lv); if (it) I.use(p, it.uid); }
  if (p.sp / p.maxSp * 100 < a.spPot) { const it = bestPot(ch, 'sp', ch.lv); if (it) I.use(p, it.uid); }
  // supply run
  const noPots = !bestPot(ch, 'hp', ch.lv);
  if (a.state === 'farm' && a.fight !== 'pvp' && a.returnTown && p.inst.def.kind !== 'town' && ((noPots && p.hp < p.maxHp * 0.3) || ch.inv.length >= 148)) {
    a.state = 'supply'; a.back = { map: p.inst.id, x: a.ax, y: a.ay };
    p.sess && p.sess.send({ t: 'notice', k: 'system', m: 'ออโต้: กลับเมืองเพื่อเติมของ' });
    W.enterMap(p, ch.lastTown || 'aurelia'); return;
  }
  if (a.state === 'supply' && p.inst.def.kind === 'town') {
    // sell junk, buy potions, go back
    for (const it of [...ch.inv]) if (it.id === 'monster_core' || (it.type === 'equip' && it.rarity < Math.max(1, a.lootMinRarity))) I.sell(p, it.uid, it.qty || 1);
    if (a.supply && a.potBuy) {
      const list = D.SHOP[p.inst.mapId] || D.SHOP.aurelia;
      const pot = list.filter((id) => D.ITEMS[id].type === 'potion' && D.ITEMS[id].hp && D.ITEMS[id].lv <= ch.lv).pop();
      if (pot) { const can = Math.min(a.potBuy, Math.floor(ch.zeny / D.ITEMS[pot].price)); if (can > 0) I.buy(p, pot, can); }
      const spp = list.filter((id) => D.ITEMS[id].type === 'potion' && D.ITEMS[id].sp && D.ITEMS[id].lv <= ch.lv).pop();
      if (spp) { const can = Math.min(Math.ceil(a.potBuy / 3), Math.floor(ch.zeny / D.ITEMS[spp].price)); if (can > 0) I.buy(p, spp, can); }
    }
    p.hp = p.maxHp; p.sp = p.maxSp;
    a.state = 'farm';
    if (a.back) { const b = a.back; W.enterMap(p, b.map, b.x, b.y); a.ax = b.x; a.ay = b.y; }
    return;
  }
  // buffs
  if (a.autoBuff) {
    for (const id in ch.skills) {
      const sk = SKILLS[id];
      if (sk.kind !== 'buff') continue;
      const b = p.buffs.get('buff:' + id);
      if (b && b.until - t > 1) continue;
      if (skillReady(p, id, t)) { C.useSkill(p, id); return; }
    }
  }
  // party healing (any skill with heal)
  if (p.party && a.partyHeal) {
    const low = C.partyNear(p, 9).find((q) => q.hp / q.maxHp * 100 < a.partyHeal);
    if (low) for (const id in ch.skills) { const sk = SKILLS[id]; if (sk.heal && !sk.heal.zone && skillReady(p, id, t)) { C.useSkill(p, id); return; } }
  }
  // pick up wanted loot before looking for the next monster
  if (!a.target || a.target.dead) {
    let best = null, bd = a.radius * a.radius;
    p.inst.inRadius(p.x, p.y, a.radius, (e) => { if (e.kind === 'i' && e.skipBy !== p.char.id && I.canTake(p, e) && I.autoWants(p, e)) { const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } } });
    if (best) {
      if (W.dist(p, best) <= 2) { if (!I.pickup(p, best.id, true)) best.skipBy = p.char.id; }
      else { a.moveTo = { x: best.x, y: best.y, r: 1.2 }; W.stepToward(p, best.x, best.y, dt, 1.2); }
      return;
    }
  }
  // stuck detection: if we have not moved for 2.5s while chasing, skip that target for a while
  a.ignore = a.ignore || {};
  if (a.lastX === undefined || Math.hypot(p.x - a.lastX, p.y - a.lastY) > 0.3) { a.lastX = p.x; a.lastY = p.y; a.stillAt = t; }
  else if (a.target && t - a.stillAt > 2.5 && W.dist(p, a.target) > p.st.range + 1.5) { a.ignore[a.target.id] = t + 25; a.target = null; a.moveTo = null; a.stillAt = t; }
  // target
  let tgt = a.target;
  if (!tgt || tgt.dead || tgt.inst !== p.inst || W.dist(p, tgt) > a.radius + 12) { tgt = a.target = pickTarget(p, a, t); }
  if (!tgt) {
    p.atkTarget = null;
    const cx = a.anchor ? a.ax : p.x, cy = a.anchor ? a.ay : p.y;
    if (!a.moveTo || Math.hypot(a.moveTo.x - p.x, a.moveTo.y - p.y) < 0.6) {
      const ang = Math.random() * Math.PI * 2, d = Math.random() * a.radius * 0.8;
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d;
      a.moveTo = { x, y, r: 0.4 };
    }
    if (!M.walkable(p.inst.map, a.moveTo.x, a.moveTo.y) || t - a.stillAt > 2) a.moveTo = null;
    else W.stepToward(p, a.moveTo.x, a.moveTo.y, dt, 0.4);
    return;
  }
  // rotation
  const modeRot = a.fight === 'pvp' ? a.rotPvp : a.rotPve;
  let rot = modeRot && modeRot.length ? modeRot : a.rotation;
  if (!rot.length) {
    // nothing configured: plan one from the learned skills for this mode
    const key = a.fight + ':' + Object.keys(ch.skills).length;
    if (a._planKey !== key) { a._planKey = key; a._plan = F.autoPlan(Object.keys(ch.skills).map((id) => SKILLS[id]).filter(Boolean), a.fight); }
    rot = a._plan;
  }
  let choice = null;
  if (a.useUlt !== 'never' && (a.useUlt === 'always' || tgt.rank >= 1 || tgt.kind === 'p')) {
    for (const id in ch.skills) if (SKILLS[id].kind === 'ult' && !SKILLS[id].gauge && skillReady(p, id, t)) { choice = id; break; }
  }
  if (!choice) for (const e of rot) { if (skillReady(p, e.id, t) && condOk(p, e, tgt, a)) { choice = e.id; break; } }
  const d = W.dist(p, tgt);
  if (choice) {
    const sk = SKILLS[choice];
    const need = sk.shape === 'single' || sk.shape === 'chain' ? C.skillRange(p, sk) + (sk.move ? sk.move.dist : 0) : sk.self ? (sk.radius || 3) * 0.8 : C.skillRange(p, sk);
    if (d > need) { a.moveTo = { x: tgt.x, y: tgt.y, r: need * 0.85 }; W.stepToward(p, tgt.x, tgt.y, dt, need * 0.85); return; }
    a.moveTo = null;
    const res = C.useSkill(p, choice, tgt.id);
    if (res && res.ok) return;
  }
  p.atkTarget = tgt.id;
  const br = p.st.range + (tgt.size || 0.6) * 0.4;
  if (d > br) { a.moveTo = { x: tgt.x, y: tgt.y, r: br * 0.85 }; W.stepToward(p, tgt.x, tgt.y, dt, br * 0.85); } else a.moveTo = null;
};

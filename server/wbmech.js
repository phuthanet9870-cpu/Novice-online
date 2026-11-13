'use strict';
// World boss mechanics: every world boss is sealed by something that has to be broken first (pillars, pillars in a
// fixed order, pillars that rise again, pillars that heal it, pillars that only one element can crack, elite guards),
// then fights in HP phases (shield + adds, element swap, re-seal, enrage) with telegraphed attack patterns.
const D = require('../shared/data2.js');
const now = () => Date.now() / 1000;
let C, W, S;
const WM = module.exports = {};
WM.init = (c, w, s) => { C = c; W = w; S = s; };
const say = (inst, m, txt, c) => inst.emit({ k: 'txt', t: m.id, x: m.x, y: m.y, m: txt, c: c || '#ffcc33', big: 1 });
const EL_TH = { fire: 'ไฟ', ice: 'น้ำแข็ง', water: 'น้ำ', lightning: 'สายฟ้า', wind: 'ลม', earth: 'ดิน', holy: 'แสง', dark: 'มืด', poison: 'พิษ', blood: 'เลือด', neutral: 'กายภาพ' };
const SWAP = ['fire', 'ice', 'lightning', 'dark', 'holy', 'poison'];

function spawnSeal(m) {
  const w = m.wbm, sd = w.mech.seal, inst = m.inst;
  w.seal = []; w.sealType = sd.type; w.firstBreak = 0;
  for (let i = 0; i < sd.n; i++) {
    const a = (i / sd.n) * Math.PI * 2, R = 9;
    let x = m.sx + Math.cos(a) * R, y = m.sy + Math.sin(a) * R * 0.8;
    const isGuard = sd.type === 'guards';
    const e = W.spawnMonster(inst, {
      fam: [sd.name, isGuard ? 'knight' : 'pillar', isGuard ? 'melee' : 'caster', 1, m.element], lv: m.lv - 5, rank: 1, x, y,
      name: isGuard ? sd.name : `${sd.name} ${sd.type === 'order' ? '#' + (i + 1) : ''}`.trim(),
      color: m.color, extra: { noRespawn: true, sealOf: m.id, pillar: isGuard ? 0 : 1, order: sd.type === 'order' ? i + 1 : 0, sealEl: sd.el || '', aggro: isGuard }
    });
    e.maxHp = e.hp = Math.round(m.maxHp * (isGuard ? 0.03 : 0.022));
    if (!isGuard) { e.def = Math.round(e.def * 0.5); e.speed = 0; }
    w.seal.push(e);
  }
  m.wbSealed = 'seal';
  say(inst, m, `🔒 ผนึก: ทำลาย ${sd.name} ×${sd.n}`, '#ffcc33');
  S.announce(`🔒 [${m.name}] ถูกผนึกด้วย ${sd.name} ×${sd.n} — ${w.mech.th.split(' · ')[0]}`, 'boss');
}
WM.start = function (m, def) {
  const mech = D.WB_MECH[def.id]; if (!mech) return;
  m.wbm = { mech, phase: 0, atkI: 0, adds: [], startAt: now(), enraged: false };
  spawnSeal(m);
};
// what the client shows on the boss target frame
WM.status = function (m) {
  const w = m.wbm; if (!w) return '';
  if (m.wbSealed === 'seal') { const left = w.seal.filter((e) => !e.dead).length; const sd = w.mech.seal; return `🔒 ${sd.name} ${sd.n - left}/${sd.n}` + (sd.type === 'order' ? ' (ตามลำดับ)' : sd.type === 'elemental' ? ` (ธาตุ${EL_TH[sd.el]}เท่านั้น)` : sd.type === 'regen' ? ' (45 วิ)' : sd.type === 'heal' ? ' (ฮีลบอส)' : ''); }
  if (m.wbSealed === 'adds') { const left = w.adds.filter((e) => !e.dead).length; return `🛡 โล่: ฆ่าสมุนเหลือ ${left}`; }
  return w.enraged ? '🔥 คลั่ง' : '';
};
// damage gate (called from C.dealDamage): returns a message when the hit must be blocked
WM.gate = function (tgt, o) {
  if (tgt.wbSealed) return tgt.wbSealed === 'seal' ? 'SEALED' : 'SHIELD';
  if (tgt.sealOf) {
    if (tgt.sealEl && o.el !== tgt.sealEl && o.kind !== 'true') return `ธาตุ${EL_TH[tgt.sealEl]}เท่านั้น`;
    if (tgt.order) { const b = tgt.inst.entities.get(tgt.sealOf); const w = b && b.wbm; if (w) { const low = Math.min(...w.seal.filter((e) => !e.dead).map((e) => e.order)); if (tgt.order !== low) return `ลำดับที่ ${low} ก่อน`; } }
  }
  return null;
};
function phaseHit(m, kind, n) {
  const w = m.wbm, inst = m.inst;
  if (kind === 'shield') {
    const fams = D.FAMILIES[inst.def.biome] || D.FAMILIES.abyss;
    w.adds = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; w.adds.push(W.spawnMonster(inst, { fam: fams[i % fams.length], lv: m.lv - 8, rank: 1, x: m.x + Math.cos(a) * 5, y: m.y + Math.sin(a) * 4, extra: { noRespawn: true } })); }
    m.wbSealed = 'adds'; say(inst, m, `🛡 โล่อมตะ! ฆ่าสมุน ${n} ตัว`, '#7ad0ff');
  } else if (kind === 'swap') {
    const nx = SWAP[(SWAP.indexOf(m.element) + 1) % SWAP.length]; m.element = nx; say(inst, m, `⚡ เปลี่ยนเป็นธาตุ${EL_TH[nx]}`, '#c8a0ff');
  } else if (kind === 'reseal') spawnSeal(m);
  else if (kind === 'enrage') { if (!w.enraged) { w.enraged = true; m.atk = Math.round(m.atk * 1.5); say(inst, m, '🔥 ENRAGED! ดาเมจ +50%', '#ff4040'); } }
}
// one telegraphed attack
function attack(m, kind, t) {
  const inst = m.inst, players = []; inst.inRadius(m.x, m.y, 20, (o) => { if (o.kind === 'p' && !o.dead && !o.hidden) players.push(o); });
  if (!players.length) return;
  const hitIn = (fn, mult, tag) => inst.inRadius(m.x, m.y, 24, (o) => { if (o.kind === 'p' && !o.dead && fn(o)) { C.dealDamage(m, o, { mult, el: m.element, kind: 'mob' }); if (tag) C.applyTag(o, tag, 1, 1.2, m); } });
  const D2 = 1.6;
  inst.emit({ k: 'txt', t: m.id, x: m.x, y: m.y, m: '⚠ ' + D.WB_ATTACK_TH[kind], c: '#ff9a5a' });
  switch (kind) {
    case 'ring': inst.emit({ k: 'tele', x: m.x, y: m.y, r: 7, d: D2, s: m.id }); inst.after(D2, () => { if (m.dead) return; inst.emit({ k: 'boom', x: m.x, y: m.y, r: 7, el: m.element }); hitIn((o) => W.dist(o, m) <= 7, 2.4, 'knockdown'); }); break;
    case 'donut': inst.emit({ k: 'tele', x: m.x, y: m.y, r: 13, ri: 3.5, d: D2, s: m.id }); inst.after(D2, () => { if (m.dead) return; inst.emit({ k: 'boom', x: m.x, y: m.y, r: 13, el: m.element }); hitIn((o) => { const d = W.dist(o, m); return d > 3.5 && d <= 13; }, 2.2, 'slow'); }); break;
    case 'cross': { const a0 = (t * 0.7) % (Math.PI / 2); for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; inst.emit({ k: 'tele', x: m.x, y: m.y, tx: m.x + Math.cos(a) * 16, ty: m.y + Math.sin(a) * 16, w: 2.6, d: D2, s: m.id }); }
      inst.after(D2, () => { if (m.dead) return; inst.emit({ k: 'boom', x: m.x, y: m.y, r: 3, el: m.element }); hitIn((o) => { const dx = o.x - m.x, dy = o.y - m.y; for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2, al = dx * Math.cos(a) + dy * Math.sin(a), off = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)); if (al > 0 && al < 16 && off < 1.3) return true; } return false; }, 2.6); }); break; }
    case 'meteor': for (const o of players.slice(0, 6)) { const x = o.x, y = o.y; inst.emit({ k: 'tele', x, y, r: 3, d: D2, s: m.id }); inst.after(D2, () => { if (m.dead) return; inst.emit({ k: 'boom', x, y, r: 3, el: m.element }); inst.inRadius(x, y, 3, (q) => { if (q.kind === 'p' && !q.dead) C.dealDamage(m, q, { mult: 2, el: m.element, kind: 'mob' }); }); }); } break;
    case 'chase': { const o = players[(Math.random() * players.length) | 0]; inst.emit({ k: 'tele', x: o.x, y: o.y, r: 4, d: 3, f: o.id, s: m.id }); inst.emit({ k: 'txt', t: o.id, x: o.x, y: o.y, m: '🎯 ถูกตามล่า! วิ่งออกจากเพื่อน', c: '#ff5050', big: 1 }); inst.after(3, () => { if (m.dead || o.dead) return; inst.emit({ k: 'boom', x: o.x, y: o.y, r: 4, el: m.element }); inst.inRadius(o.x, o.y, 4, (q) => { if (q.kind === 'p' && !q.dead) C.dealDamage(m, q, { mult: q === o ? 1.6 : 2.6, el: m.element, kind: 'mob' }); }); }); break; }
    case 'pull': for (const o of players) { if (W.dist(o, m) > 3) { const a = Math.atan2(m.y - o.y, m.x - o.x), d = W.dist(o, m) - 2.5; inst.moveTo(o, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d); o.forcePos = true; } }
      inst.emit({ k: 'tele', x: m.x, y: m.y, r: 6, d: 2.2, s: m.id }); inst.after(2.2, () => { if (m.dead) return; inst.emit({ k: 'boom', x: m.x, y: m.y, r: 6, el: m.element }); hitIn((o) => W.dist(o, m) <= 6, 2.8, 'stun'); }); break;
  }
}
WM.tick = function (m, t) {
  const w = m.wbm; if (!w) return false;
  const inst = m.inst, sd = w.mech.seal;
  // seal upkeep
  if (m.wbSealed === 'seal') {
    const alive = w.seal.filter((e) => !e.dead);
    if (alive.length < w.seal.length && !w.firstBreak) w.firstBreak = t;
    if (sd.type === 'heal' && alive.length && Math.floor(t) !== w.healT) { w.healT = Math.floor(t); m.hp = Math.min(m.maxHp, m.hp + m.maxHp * sd.heal / 100 * alive.length / sd.n); }
    if (sd.type === 'regen' && w.firstBreak && alive.length && t - w.firstBreak > 45) { for (const e of w.seal) if (e.dead) { const nw = W.spawnMonster(inst, { fam: [sd.name, 'pillar', 'caster', 1, m.element], lv: m.lv - 5, rank: 1, x: e.x, y: e.y, name: e.name, color: m.color, extra: { noRespawn: true, sealOf: m.id, pillar: 1 } }); nw.maxHp = nw.hp = e.maxHp; nw.speed = 0; w.seal[w.seal.indexOf(e)] = nw; } w.firstBreak = 0; say(inst, m, `♻ ${sd.name} ฟื้นคืน! ต้องทำลายให้ครบใน 45 วิ`, '#ff9a5a'); }
    if (!alive.length) { m.wbSealed = null; say(inst, m, '💥 ผนึกแตก! โจมตีบอสได้แล้ว', '#6aff8a'); S.announce(`💥 ผนึกของ [${m.name}] แตกแล้ว!`, 'boss'); }
  } else if (m.wbSealed === 'adds') {
    if (!w.adds.some((e) => !e.dead)) { m.wbSealed = null; say(inst, m, '💥 โล่แตก!', '#6aff8a'); }
  }
  // phases by HP
  const pct = m.hp / m.maxHp;
  while (w.phase < w.mech.phases.length && pct <= w.mech.phases[w.phase][0]) { const [, kind, n] = w.mech.phases[w.phase]; w.phase++; phaseHit(m, kind, n); }
  if (!w.enraged && t - w.startAt > 600) phaseHit(m, 'enrage');
  // attacks
  if (t >= (m.skillAt || 0) && !(m.brokenUntil > t)) {
    m.skillAt = t + (w.enraged ? 4.5 : 6.5) + Math.random() * 2;
    attack(m, w.mech.attacks[w.atkI++ % w.mech.attacks.length], t);
  }
  return true;
};

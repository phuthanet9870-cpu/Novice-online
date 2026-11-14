'use strict';
// Skill engine v5. Every skill is a short program written by hand in tools/kits/<class>.js:
//   steps:  one or more shapes (form) run in order, each with its own numbers and hit effects (ops)
//   forms:  the geometry of the move — who is hit, when, and how the caster moves
//   ops:    what a hit does (statuses, displacement, conditions, consumption) or what the caster gains
//   passives: always-on stats or effects that fire on hit / crit / kill / being hurt / every few seconds
// The client draws each form with the class's own material (see client/js/vfx5.js), from the same 'sv' events.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const M = require('../shared/mapgen.js');
const { SKILLS } = require('../shared/skills.js');

const SV = module.exports;
let C, W;
SV.init = (c, w) => { C = c; W = w; };
const now = () => Date.now() / 1000;
const TAU = Math.PI * 2;
const DOT = { bleed: 1, poison: 1, burn: 1, chill: 1 };

// ------------------------------------------------------------------ geometry helpers
function foes(p, x, y, r) { const out = []; p.inst.inRadius(x, y, r + 0.6, (o) => { if (!o.dead && (o.kind === 'm' || o.kind === 'p' || o.kind === 's') && C.isEnemy(p, o) && Math.hypot(o.x - x, o.y - y) <= r + (o.size || 0.6) * 0.4) out.push(o); }); return out; }
function segDist(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1; const u = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)); return { d: Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u)), u }; }
function onLine(p, x0, y0, x1, y1, w) { const L = Math.hypot(x1 - x0, y1 - y0); const out = []; for (const o of foes(p, (x0 + x1) / 2, (y0 + y1) / 2, L / 2 + w + 1)) { const s = segDist(o.x, o.y, x0, y0, x1, y1); if (s.d <= w / 2 + (o.size || 0.6) * 0.4) out.push({ o, u: s.u }); } return out.sort((a, b) => a.u - b.u); }
function inCone(p, x, y, ang, r, deg) { const half = deg / 360 * Math.PI; return foes(p, x, y, r).filter((o) => { let d = Math.atan2(o.y - y, o.x - x) - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) <= half || Math.hypot(o.x - x, o.y - y) < 0.9; }); }
function walk(inst, x, y) { return M.walkable(inst.map, x, y); }
function moveAlong(p, ang, dist) { const inst = p.inst; let moved = 0; for (let i = 0; i < dist * 4; i++) { const nx = p.x + Math.cos(ang) * 0.25, ny = p.y + Math.sin(ang) * 0.25; if (!walk(inst, nx, ny)) break; inst.moveTo(p, nx, ny); moved += 0.25; } p.forcePos = true; return moved; }
function placeAt(p, x, y) { if (!walk(p.inst, x, y)) { const s = W.freeSpot(p.inst.map, x, y); x = s.x; y = s.y; } p.inst.moveTo(p, x, y); p.forcePos = true; }
const fx = (p, o) => p.inst.emit(Object.assign({ k: 'sv', s: p.id }, o));
const r2 = (v) => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ hit + ops
// ctx: { p, sk, lv, sc, el, step, hitN, tgt, ax, ay, t }
function preMult(ctx, o) {
  const p = ctx.p; let m = 1;
  for (const op of ctx.step.ops) {
    switch (op.o) {
      case 'vs': if (o.tags.has(op.t)) m *= 1 + op.v / 100; break;
      case 'behind': { const a = Math.atan2(p.y - o.y, p.x - o.x), f = o.dir !== undefined ? o.dir : a + Math.PI; let d = a - f; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 1.9) m *= 1 + op.v / 100; break; }
      case 'pop': { const tg = o.tags.get(op.t); if (tg) { m *= 1 + (op.v || 60) / 100 * Math.max(1, tg.stacks || 1); o.tags.delete(op.t); o.tagsChanged = true; } break; }
      case 'low': if (o.hp / o.maxHp * 100 < op.v) m *= 1.8; break;
      case 'full': if (o.hp >= o.maxHp * 0.98) m *= 1 + op.v / 100; break;
      case 'far': if (Math.hypot(o.x - p.x, o.y - p.y) > op.v) m *= 1.5; break;
      case 'near': if (Math.hypot(o.x - p.x, o.y - p.y) < op.v) m *= 1.5; break;
      case 'boss': if (o.kind === 'm' && o.rank >= 1) m *= 1 + op.v / 100; break;
      case 'myhp': m *= 1 + (1 - p.hp / p.maxHp) * op.v / 100; break;
      case 'perres': m *= 1 + (p.res || 0) * op.v / 100; break;
      case 'combo': m *= 1 + Math.min(30, p.combo || 0) * op.v / 100; break;
      case 'stacks': { let n = 0; for (const v of o.tags.values()) n += v.stacks || 1; m *= 1 + n * op.v / 100; break; }
      case 'alone': if (foes(p, o.x, o.y, 3).length <= 1) m *= 1 + op.v / 100; break;
      case 'gamble': m *= [0.5, 1, 1, 1.5, 2, 3][Math.floor(W.rand() * 6)]; break;
    }
  }
  return m;
}
function hit(ctx, o, mult) {
  if (!o || o.dead) return 0;
  const p = ctx.p, st = ctx.step;
  const crit = st.opm.crit || 0, pierce = (st.opm.pierce || 0) / 100;
  const dealt = C.dealDamage(p, o, { mult: st.d * ctx.sc * mult * preMult(ctx, o), el: ctx.el, kind: 'skill', pierce, critBonus: crit, lifesteal: st.opm.drain || 0, finisher: ctx.sk.kind === 'ult', sk: ctx.sk });
  ctx.hits++; ctx.dealt += dealt; ctx.hitSet.add(o); p._dealt = (p._dealt || 0) + dealt; (p._lastTargets = p._lastTargets || []).push(o);
  if (!o.dead) onHitOps(ctx, o);
  return dealt;
}
function onHitOps(ctx, o) {
  const p = ctx.p, t = now();
  for (const op of ctx.step.ops) {
    if (op.ch && W.rand() * 100 >= op.ch) continue;
    switch (op.o) {
      case 'tag': { const def = D.TAGS[op.t]; if (!def) break; if (DOT[op.t]) C.applyTag(o, op.t, op.v || 1, def.dur, p); else C.applyTag(o, op.t, 1, op.v || def.dur, p); break; }
      case 'pull': if (!(o.kind === 'm' && o.rank >= 2)) C.pullTo(o, ctx.ox !== undefined ? ctx.ox : p.x, ctx.oy !== undefined ? ctx.oy : p.y, op.v); break;
      case 'push': if (!(o.kind === 'm' && o.rank >= 2)) C.pushAway(o, ctx.ox !== undefined ? ctx.ox : p.x, ctx.oy !== undefined ? ctx.oy : p.y, op.v); break;
      case 'lift': C.applyTag(o, 'airborne', 1, op.v || 1.2, p); break;
      case 'exec': if (o.kind !== 'p' && !(o.kind === 'm' && o.rank >= 2) && o.hp / o.maxHp * 100 < op.v) C.dealDamage(p, o, { flat: o.hp + 1, kind: 'true', reaction: 'execute' }); break;
      case 'spread': { for (const e of foes(p, o.x, o.y, op.v || 3.5)) if (e !== o) for (const [k, v] of o.tags) if (!D.TAGS[k].cc) C.applyTag(e, k, v.stacks || 1, Math.max(1, v.until - t), p, { quiet: true }); break; }
      case 'expose': o.exposeUntil = t + 5; o.exposePct = op.v; break;
      case 'weaken': o.weakUntil = t + 5; o.weakPct = op.v; break;
      case 'sunder': C.applyTag(o, 'armorbreak', 1, op.v || 5, p); break;
      case 'burnsp': if (o.kind === 'p') o.sp = Math.max(0, o.sp - o.maxSp * op.v / 100); break;
      case 'steal': { if (o.buffs && o.buffs.size) { const k = [...o.buffs.keys()][0]; C.removeBuff(o, k); } p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.03); break; }
      case 'taunt': if (o.kind === 'm') { o.target = p; o.tauntBy = p; o.tauntUntil = t + (op.v || 4); } break;
      case 'corpsehit': break;
      case 'detonate': { const n = [...o.tags.entries()].filter(([k]) => DOT[k]); let sum = 0; for (const [k, v] of n) { sum += (v.stacks || 1); o.tags.delete(k); } if (sum) { o.tagsChanged = true; C.dealDamage(p, o, { mult: ctx.step.d * ctx.sc * 0.5 * sum, el: ctx.el, kind: 'skill', sk: ctx.sk }); fx(p, { f: 'pop', x: o.x, y: o.y, sk: ctx.sk.id }); } break; }
      case 'mark2': o.svMark = { by: p.id, until: t + (op.v || 6), sk: ctx.sk.id }; break;
      case 'chainmark': break;
    }
  }
}
// caster-side ops, run once per step after it lands
function selfOps(ctx) {
  const p = ctx.p, t = now(), st = ctx.step, any = ctx.hits > 0;
  for (const op of st.ops) {
    switch (op.o) {
      case 'heal': C.heal(p, p.maxHp * op.v / 100, p); break;
      case 'pheal': for (const q of C.partyNear(p, 9).concat([p])) C.heal(q, q.maxHp * op.v / 100, p); break;
      case 'shield': p.shield = Math.max(p.shield || 0, p.maxHp * op.v / 100); break;
      case 'pshield': for (const q of C.partyNear(p, 9).concat([p])) q.shield = Math.max(q.shield || 0, q.maxHp * op.v / 100); break;
      case 'res': p.res = Math.min(D.CLASSES[p.cls].res.max, (p.res || 0) + op.v * (any || st.f === 'self' ? 1 : 0)); break;
      case 'spend': p.res = 0; break;
      case 'cdr': if (any) { for (const k in p.cds) if (k !== ctx.sk.id) p.cds[k] -= op.v; p.sess && p.sess.send({ t: 'cdshift', d: op.v, except: ctx.sk.id }); } break;
      case 'refund': if (any && W.rand() < op.v / 100) { p.cds[ctx.sk.id] = 0; p.sess && p.sess.send({ t: 'cd', id: ctx.sk.id, d: 0 }); } break;
      case 'resetkill': if ([...ctx.hitSet].some((o) => o.dead)) { p.cds[ctx.sk.id] = 0; p.sess && p.sess.send({ t: 'cd', id: ctx.sk.id, d: 0 }); fx(p, { f: 'txt', x: p.x, y: p.y, m: 'RESET' }); } break;
      case 'haste': C.addBuff(p, 'sv:haste', { movePct: op.v, aspdPct: Math.round(op.v / 2) }, 4, ctx.sk.name, '#7df'); break;
      case 'stealth': p.stealthUntil = t + op.v; p.inst.inRadius(p.x, p.y, 25, (o) => { if (o.kind === 'm' && o.target === p) o.target = null; }); break;
      case 'cleanse': for (const k of [...p.tags.keys()]) p.tags.delete(k); break;
      case 'pcleanse': for (const q of C.partyNear(p, 9).concat([p])) for (const k of [...q.tags.keys()]) q.tags.delete(k); break;
      case 'next': p.nextBonus = Math.max(p.nextBonus || 0, op.v); break;
      case 'ult': if (any) p.ult = Math.min(100, (p.ult || 0) + op.v); break;
      case 'nextcrit': p.nextCrit = true; break;
      case 'back': moveAlong(p, Math.atan2(p.y - ctx.ay, p.x - ctx.ax), op.v); break;
      case 'buff': C.addBuff(p, 'sv:' + ctx.sk.id, op.mods, op.v, ctx.sk.name, D.CLASSES[p.cls].color); break;
      case 'pbuff': for (const q of C.partyNear(p, 9).concat([p])) C.addBuff(q, 'sv:' + ctx.sk.id, op.mods, op.v, ctx.sk.name, D.CLASSES[p.cls].color); break;
      case 'reflect': C.addBuff(p, 'sv:refl', { reflect: op.v }, 4, ctx.sk.name, '#9cf'); break;
      case 'gauge': p.ult = Math.min(100, (p.ult || 0) + op.v); break;
      case 'immune': p.invulnUntil = Math.max(p.invulnUntil || 0, t + op.v); break;
      case 'hpcost': p.hp = Math.max(1, p.hp - p.maxHp * op.v / 100); break;
      case 'rewind': { const h = p.svHist && p.svHist.find((q) => q.t <= t - (op.v || 3)); if (h) { placeAt(p, h.x, h.y); p.hp = Math.max(p.hp, h.hp); fx(p, { f: 'rewind', x: p.x, y: p.y, sk: ctx.sk.id }); } break; }
      case 'clone': for (let i = 0; i < (op.v || 1); i++) W.spawnSummon(p, { name: 'ร่างลวง', dur: 8, shape: 'shadow', color: D.CLASSES[p.cls].color, mult: 0.35, element: ctx.el, mag: p.st.dmgType === 'mag' }); break;
      case 'echo': if (!ctx.isEcho) { const st2 = Object.assign({}, st, { d: st.d * op.v / 100, ops: st.ops.filter((x) => x.o !== 'echo') }); st2.opm = st.opm; p.inst.after(0.7, () => { if (!p.dead && p.inst === ctx.inst) runStep(Object.assign({}, ctx, { step: st2, isEcho: 1, hits: 0, dealt: 0, hitSet: new Set() })); }); } break;
      case 'corpse': { // consume corpses (recent kills) near the target point: each one explodes
        const list = (p.inst.svCorpses || []).filter((c) => c.until > t && Math.hypot(c.x - ctx.ax, c.y - ctx.ay) < 6).slice(0, op.v || 3);
        p.inst.svCorpses = (p.inst.svCorpses || []).filter((c) => !list.includes(c));
        for (const c of list) { fx(p, { f: 'corpse', x: c.x, y: c.y, sk: ctx.sk.id }); for (const o of foes(p, c.x, c.y, 2.2)) hit(ctx, o, 0.7); }
        break;
      }
      case 'gold': if (any) for (const o of ctx.hitSet) if (o.dead && o.kind === 'm') { p.char.zeny += op.v * o.lv; C.sendChar(p, ['zeny']); } break;
    }
  }
}

// ------------------------------------------------------------------ forms
const SPD = 20; // projectile speed, tiles per second
function aim(ctx) { const p = ctx.p, tg = ctx.tgt && !ctx.tgt.dead && ctx.tgt.inst === p.inst ? ctx.tgt : null; return tg ? { x: tg.x, y: tg.y, tg } : { x: ctx.ax, y: ctx.ay, tg: null }; }
function later(ctx, sec, fn) { const inst = ctx.inst; if (sec <= 0.01) return fn(); inst.after(sec, () => { if (!ctx.p.dead && ctx.p.inst === inst) fn(); }); }
function ticks(ctx, n, every, fn) { for (let i = 0; i < n; i++) later(ctx, i * every, () => fn(i)); }
const FORMS = {
  self(ctx) { fx(ctx.p, { f: 'self', x: ctx.p.x, y: ctx.p.y }); },
  bolt(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 9; const hitL = onLine(p, p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, 0.9); const o = A.tg && Math.hypot(A.tg.x - p.x, A.tg.y - p.y) <= L + 1 ? A.tg : hitL[0] && hitL[0].o; const ex = o ? o.x : p.x + Math.cos(a) * L, ey = o ? o.y : p.y + Math.sin(a) * L; const T = Math.hypot(ex - p.x, ey - p.y) / (s.s || SPD); fx(p, { f: 'bolt', x: p.x, y: p.y, tx: ex, ty: ey, d: T }); if (o) later(ctx, T, () => hit(ctx, o, 1)); return T; },
  pierce(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 10, ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L, T = L / (s.s || SPD); fx(p, { f: 'pierce', x: p.x, y: p.y, tx: ex, ty: ey, w: s.w || 1.2, d: T }); for (const { o, u } of onLine(p, p.x, p.y, ex, ey, s.w || 1.2)) later(ctx, u * T, () => hit(ctx, o, 1)); return T; },
  fan(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a0 = Math.atan2(A.y - p.y, A.x - p.x), n = s.n || 5, spr = (s.a || 50) / 180 * Math.PI, L = s.l || 8; const got = new Set(); const rays = []; for (let i = 0; i < n; i++) { const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * spr : 0); const h = onLine(p, p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, 0.8).find((q) => !got.has(q.o) || s.stack); const ex = h ? h.o.x : p.x + Math.cos(a) * L, ey = h ? h.o.y : p.y + Math.sin(a) * L; rays.push([r2(ex), r2(ey)]); if (h) { got.add(h.o); later(ctx, Math.hypot(ex - p.x, ey - p.y) / SPD, () => hit(ctx, h.o, 1)); } } fx(p, { f: 'fan', x: p.x, y: p.y, rays, d: L / SPD }); return L / SPD; },
  arc(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), T = 0.25 + Math.hypot(A.x - p.x, A.y - p.y) / 16; fx(p, { f: 'arc', x: p.x, y: p.y, tx: A.x, ty: A.y, r: s.r || 2.2, d: T }); ctx.ox = A.x; ctx.oy = A.y; later(ctx, T, () => { for (const o of foes(p, A.x, A.y, s.r || 2.2)) hit(ctx, o, 1); }); return T; },
  boomer(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 8, ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L, T = L / 14; fx(p, { f: 'boomer', x: p.x, y: p.y, tx: ex, ty: ey, d: T * 2 }); for (const { o, u } of onLine(p, p.x, p.y, ex, ey, s.w || 1.3)) { later(ctx, u * T, () => hit(ctx, o, 1)); later(ctx, T + (1 - u) * T, () => hit(ctx, o, s.back || 0.8)); } return T * 2; },
  spiral(ctx) { const p = ctx.p, s = ctx.step, R = s.r || 5, n = s.h || 6, T = s.t || 1.2; fx(p, { f: 'spiral', x: p.x, y: p.y, r: R, n, d: T }); ticks(ctx, n, T / n, (i) => { const rr = R * (i + 1) / n; for (const o of foes(p, p.x, p.y, rr)) if (Math.hypot(o.x - p.x, o.y - p.y) > rr - R / n - 0.6) hit(ctx, o, 1); }); return T; },
  homing(ctx) { const p = ctx.p, s = ctx.step, n = s.n || 3, list = foes(p, p.x, p.y, s.l || 9).sort((a, b) => W.dist(a, p) - W.dist(b, p)); const A = aim(ctx); if (A.tg && !list.includes(A.tg)) list.unshift(A.tg); const tg = []; for (let i = 0; i < n; i++) { const o = list.length ? list[i % list.length] : null; if (!o) break; tg.push([r2(o.x), r2(o.y)]); later(ctx, 0.35 + i * 0.08, () => hit(ctx, o, 1)); } fx(p, { f: 'homing', x: p.x, y: p.y, tg, d: 0.45 }); return 0.45; },
  split(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), o = A.tg || foes(p, A.x, A.y, 2)[0]; const T = Math.hypot(A.x - p.x, A.y - p.y) / SPD; const near = o ? foes(p, o.x, o.y, 4.5).filter((e) => e !== o).slice(0, s.n || 3) : []; fx(p, { f: 'split', x: p.x, y: p.y, tx: A.x, ty: A.y, tg: near.map((e) => [r2(e.x), r2(e.y)]), d: T }); ctx.ox = A.x; ctx.oy = A.y; if (o) later(ctx, T, () => { hit(ctx, o, 1); for (const e of near) hit(ctx, e, s.sub || 0.5); }); return T + 0.2; },
  bounce(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx); let cur = A.tg || foes(p, A.x, A.y, 3)[0]; if (!cur) { fx(p, { f: 'bounce', x: p.x, y: p.y, tg: [[r2(A.x), r2(A.y)]] }); return 0.2; } const chain = [cur], seen = new Set([cur]); for (let i = 1; i < (s.n || 4); i++) { const nx = foes(p, cur.x, cur.y, s.l || 5).filter((e) => !seen.has(e)).sort((a, b) => W.dist(a, cur) - W.dist(b, cur))[0]; if (!nx) break; chain.push(nx); seen.add(nx); cur = nx; } fx(p, { f: 'bounce', x: p.x, y: p.y, tg: chain.map((e) => [r2(e.x), r2(e.y)]) }); chain.forEach((o, i) => later(ctx, 0.1 + i * 0.12, () => hit(ctx, o, Math.pow(s.fall || 0.9, i)))); return 0.1 + chain.length * 0.12; },
  chainline(ctx) { const p = ctx.p, s = ctx.step, list = foes(p, p.x, p.y, s.l || 7).sort((a, b) => W.dist(a, p) - W.dist(b, p)).slice(0, s.n || 4); fx(p, { f: 'chainline', x: p.x, y: p.y, tg: list.map((e) => [r2(e.x), r2(e.y)]) }); for (const o of list) hit(ctx, o, 1); return 0.2; },
  beam(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 10, n = s.h || 4, T = s.t || 1; const ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L; fx(p, { f: 'beam', x: p.x, y: p.y, tx: ex, ty: ey, w: s.w || 1, d: T }); ticks(ctx, n, T / n, () => { for (const { o } of onLine(p, p.x, p.y, ex, ey, s.w || 1)) hit(ctx, o, 1); }); return T; },
  sweep(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a0 = Math.atan2(A.y - p.y, A.x - p.x) - Math.PI / 2, L = s.l || 7, n = s.h || 6, T = s.t || 0.9, span = (s.a || 180) / 180 * Math.PI; fx(p, { f: 'sweep', x: p.x, y: p.y, a: r2(a0), span: r2(span), l: L, d: T }); const got = new Set(); ticks(ctx, n, T / n, (i) => { const a = a0 + span * (i + 0.5) / n; for (const o of inCone(p, p.x, p.y, a, L, span / n * 180 / Math.PI + 12)) if (!got.has(o)) { got.add(o); hit(ctx, o, 1); } }); return T; },
  cone(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x); fx(p, { f: 'cone', x: p.x, y: p.y, a: r2(a), r: s.r || 5, deg: s.a || 70 }); ctx.ox = p.x; ctx.oy = p.y; for (const o of inCone(p, p.x, p.y, a, s.r || 5, s.a || 70)) hit(ctx, o, 1); return 0.15; },
  slash(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), n = s.h || 1; fx(p, { f: 'slash', x: p.x, y: p.y, a: r2(a), r: s.r || 2.6, deg: s.a || 130, n }); ctx.ox = p.x; ctx.oy = p.y; ticks(ctx, n, 0.12, () => { for (const o of inCone(p, p.x, p.y, a, s.r || 2.6, s.a || 130)) hit(ctx, o, 1); }); return 0.12 * n; },
  thrust(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 4, n = s.h || 1; const ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L; fx(p, { f: 'thrust', x: p.x, y: p.y, tx: ex, ty: ey, n }); ticks(ctx, n, 0.1, () => { for (const { o } of onLine(p, p.x, p.y, ex, ey, s.w || 0.9)) hit(ctx, o, 1); }); return 0.1 * n; },
  spin(ctx) { const p = ctx.p, s = ctx.step, n = s.h || 3, T = s.t || 0.6; fx(p, { f: 'spin', x: p.x, y: p.y, r: s.r || 2.6, n, d: T }); ctx.ox = p.x; ctx.oy = p.y; ticks(ctx, n, T / n, () => { for (const o of foes(p, p.x, p.y, s.r || 2.6)) hit(ctx, o, 1); }); return T; },
  nova(ctx) { const p = ctx.p, s = ctx.step, R = s.r || 5; fx(p, { f: 'nova', x: p.x, y: p.y, r: R, d: R / 14 }); ctx.ox = p.x; ctx.oy = p.y; for (const o of foes(p, p.x, p.y, R)) later(ctx, Math.hypot(o.x - p.x, o.y - p.y) / 14, () => hit(ctx, o, 1)); return R / 14; },
  ring(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), R = s.r || 3.5, w = s.w || 1.4; fx(p, { f: 'ring', x: A.x, y: A.y, r: R, w }); ctx.ox = A.x; ctx.oy = A.y; for (const o of foes(p, A.x, A.y, R)) if (Math.hypot(o.x - A.x, o.y - A.y) >= R - w - 0.4) hit(ctx, o, 1); return 0.25; },
  cross(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), L = s.l || 4, rot = s.x ? Math.PI / 4 : 0; fx(p, { f: 'cross', x: A.x, y: A.y, l: L, rot }); const got = new Set(); for (let k = 0; k < 2; k++) { const a = rot + k * Math.PI / 2; for (const { o } of onLine(p, A.x - Math.cos(a) * L, A.y - Math.sin(a) * L, A.x + Math.cos(a) * L, A.y + Math.sin(a) * L, s.w || 1)) if (!got.has(o)) { got.add(o); hit(ctx, o, 1); } } return 0.2; },
  star(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.n || 5, L = s.l || 4, r0 = W.rand() * TAU; fx(p, { f: 'star', x: A.x, y: A.y, n, l: L, rot: r2(r0) }); const got = new Set(); for (let i = 0; i < n; i++) { const a = r0 + i / n * TAU; for (const { o } of onLine(p, A.x, A.y, A.x + Math.cos(a) * L, A.y + Math.sin(a) * L, 0.9)) if (!got.has(o)) { got.add(o); hit(ctx, o, 1); } } return 0.25; },
  burst(ctx) { const p = ctx.p, s = ctx.step, A = s.at === 'self' ? { x: p.x, y: p.y } : aim(ctx); fx(p, { f: 'burst', x: A.x, y: A.y, r: s.r || 2.5 }); ctx.ox = A.x; ctx.oy = A.y; for (const o of foes(p, A.x, A.y, s.r || 2.5)) hit(ctx, o, 1); return 0.15; },
  rain(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.n || 8, T = s.t || 1.4, R = s.r || 3.5; const pts = []; for (let i = 0; i < n; i++) { const a = W.rand() * TAU, d = Math.sqrt(W.rand()) * R; pts.push([r2(A.x + Math.cos(a) * d), r2(A.y + Math.sin(a) * d)]); } fx(p, { f: 'rain', x: A.x, y: A.y, r: R, pts, d: T }); pts.forEach(([x, y], i) => later(ctx, 0.2 + i * T / n, () => { for (const o of foes(p, x, y, s.w || 1.3)) hit(ctx, o, 1); })); return T; },
  meteor(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), dl = s.dl || 1.1; fx(p, { f: 'meteor', x: A.x, y: A.y, r: s.r || 3, d: dl }); ctx.ox = A.x; ctx.oy = A.y; later(ctx, dl, () => { for (const o of foes(p, A.x, A.y, s.r || 3)) hit(ctx, o, 1); }); return dl; },
  pillar(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.h || 4, T = s.t || 1.2; fx(p, { f: 'pillar', x: A.x, y: A.y, r: s.r || 1.6, d: T }); ticks(ctx, n, T / n, () => { for (const o of foes(p, A.x, A.y, s.r || 1.6)) hit(ctx, o, 1); }); return T; },
  field(ctx) { const p = ctx.p, s = ctx.step, A = s.at === 'self' ? { x: p.x, y: p.y } : aim(ctx), T = s.t || 5, k = s.k || 1; fx(p, { f: 'field', x: A.x, y: A.y, r: s.r || 3, d: T }); ctx.ox = A.x; ctx.oy = A.y; ticks(ctx, Math.round(T / k), k, () => { for (const o of foes(p, A.x, A.y, s.r || 3)) hit(ctx, o, 1); }); return 0.2; },
  wall(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x) + Math.PI / 2, L = s.l || 5, T = s.t || 4, k = s.k || 0.8; const x0 = A.x - Math.cos(a) * L / 2, y0 = A.y - Math.sin(a) * L / 2, x1 = A.x + Math.cos(a) * L / 2, y1 = A.y + Math.sin(a) * L / 2; fx(p, { f: 'wall', x: x0, y: y0, tx: x1, ty: y1, d: T }); ticks(ctx, Math.round(T / k), k, () => { for (const { o } of onLine(p, x0, y0, x1, y1, 1.2)) hit(ctx, o, 1); }); return 0.2; },
  dash(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), x0 = p.x, y0 = p.y; const L = Math.min(s.l || 6, Math.hypot(A.x - p.x, A.y - p.y) + 1.5); moveAlong(p, a, L); fx(p, { f: 'dash', x: x0, y: y0, tx: p.x, ty: p.y }); for (const { o } of onLine(p, x0, y0, p.x, p.y, s.w || 1.6)) hit(ctx, o, 1); if (s.trail) { const T = s.t || 3; fx(p, { f: 'trail', x: x0, y: y0, tx: p.x, ty: p.y, d: T }); const xs = [x0, y0, p.x, p.y]; ticks(ctx, Math.round(T), 1, () => { for (const { o } of onLine(p, xs[0], xs[1], xs[2], xs[3], 1.2)) hit(ctx, o, 0.35); }); } return 0.15; },
  leap(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), dist = Math.min(s.l || 6, Math.hypot(A.x - p.x, A.y - p.y)); const x0 = p.x, y0 = p.y, tx = p.x + Math.cos(a) * dist, ty = p.y + Math.sin(a) * dist; fx(p, { f: 'leap', x: x0, y: y0, tx, ty, r: s.r || 2.5, d: 0.35 }); later(ctx, 0.3, () => { placeAt(p, tx, ty); ctx.ox = p.x; ctx.oy = p.y; for (const o of foes(p, p.x, p.y, s.r || 2.5)) hit(ctx, o, 1); }); return 0.35; },
  blink(ctx) { const p = ctx.p, A = aim(ctx), o = A.tg; const x0 = p.x, y0 = p.y; if (o) { const a = Math.atan2(o.y - p.y, o.x - p.x); placeAt(p, o.x + Math.cos(a) * 1.1, o.y + Math.sin(a) * 1.1); p.dir = a + Math.PI; } else placeAt(p, A.x, A.y); fx(p, { f: 'blink', x: x0, y: y0, tx: p.x, ty: p.y }); if (o) hit(ctx, o, 1); return 0.1; },
  hook(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 8; const h = onLine(p, p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, 1)[0]; const ex = h ? h.o.x : p.x + Math.cos(a) * L, ey = h ? h.o.y : p.y + Math.sin(a) * L; fx(p, { f: 'hook', x: p.x, y: p.y, tx: ex, ty: ey, d: 0.35 }); if (h) later(ctx, 0.2, () => { if (!(h.o.kind === 'm' && h.o.rank >= 2)) C.pullTo(h.o, p.x, p.y, L); hit(ctx, h.o, 1); }); return 0.35; },
  tether(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), o = A.tg || foes(p, A.x, A.y, 3)[0], n = s.h || 5, T = s.t || 2.5; if (!o) return 0; fx(p, { f: 'tether', x: p.x, y: p.y, t2: o.id, d: T }); ticks(ctx, n, T / n, () => { if (!o.dead && W.dist(o, p) <= (s.l || 9)) hit(ctx, o, 1); }); return 0.2; },
  orbit(ctx) { const p = ctx.p, s = ctx.step, n = s.n || 3, T = s.t || 4, R = s.r || 1.8, k = 0.4; fx(p, { f: 'orbit', x: p.x, y: p.y, n, r: R, d: T }); ticks(ctx, Math.round(T / k), k, () => { for (const o of foes(p, p.x, p.y, R + 0.7)) if (Math.hypot(o.x - p.x, o.y - p.y) > R - 0.9) hit(ctx, o, 1); }); return 0.2; },
  mine(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.n || 1, T = s.t || 15; const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, d = n > 1 ? 1.4 : 0; pts.push({ x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d, live: 1 }); } fx(p, { f: 'mine', pts: pts.map((q) => [r2(q.x), r2(q.y)]), d: T }); ticks(ctx, Math.round(T / 0.25), 0.25, (i) => { for (const q of pts) { if (!q.live || i < 2) continue; if (foes(p, q.x, q.y, 1.1).length) { q.live = 0; fx(p, { f: 'burst', x: q.x, y: q.y, r: s.r || 2 }); for (const o of foes(p, q.x, q.y, s.r || 2)) hit(ctx, o, 1); } } }); return 0.2; },
  totem(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), T = s.t || 6, k = s.k || 1; fx(p, { f: 'totem', x: A.x, y: A.y, r: s.r || 3, d: T }); ctx.ox = A.x; ctx.oy = A.y; ticks(ctx, Math.round(T / k), k, () => { fx(p, { f: 'pulse', x: A.x, y: A.y, r: s.r || 3 }); for (const o of foes(p, A.x, A.y, s.r || 3)) hit(ctx, o, 1); }); return 0.2; },
  summon(ctx) { const p = ctx.p, s = ctx.step, cls = D.CLASSES[p.cls]; fx(p, { f: 'summon', x: p.x, y: p.y, n: s.n || 1 }); for (let i = 0; i < Math.min(8, s.n || 1); i++) W.spawnSummon(p, { name: s.nm || ctx.sk.name, dur: s.t || 15, shape: s.shape || cls.summonShape || 'spirit', color: cls.color, mult: s.d * ctx.sc * 0.4, element: ctx.el, mag: cls.dmg === 'mag', turret: s.turret ? 1 : 0, sk: null }); return 0.2; },
  mark(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), o = A.tg || foes(p, A.x, A.y, 3)[0], dl = s.dl || 2; if (!o) return 0; fx(p, { f: 'mark', t2: o.id, x: o.x, y: o.y, d: dl }); later(ctx, dl, () => { if (o.dead) return; fx(p, { f: 'burst', x: o.x, y: o.y, r: s.r || 2.2 }); ctx.ox = o.x; ctx.oy = o.y; for (const e of foes(p, o.x, o.y, s.r || 2.2)) hit(ctx, e, e === o ? 1.4 : 0.8); }); return dl; },
  vortex(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.h || 5, T = s.t || 2; fx(p, { f: 'vortex', x: A.x, y: A.y, r: s.r || 3.5, d: T }); ctx.ox = A.x; ctx.oy = A.y; ticks(ctx, n, T / n, () => { for (const o of foes(p, A.x, A.y, s.r || 3.5)) { if (!(o.kind === 'm' && o.rank >= 2)) C.pullTo(o, A.x, A.y, 0.8); hit(ctx, o, 1); } }); return T; },
  wave(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), L = s.l || 9, W2 = s.w || 4, T = L / 9; const ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L; fx(p, { f: 'wave', x: p.x, y: p.y, tx: ex, ty: ey, w: W2, d: T }); ctx.ox = p.x; ctx.oy = p.y; for (const { o, u } of onLine(p, p.x, p.y, ex, ey, W2)) later(ctx, u * T, () => hit(ctx, o, 1)); return T; },
  shards(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.n || 6, L = s.l || 4; fx(p, { f: 'shards', x: A.x, y: A.y, n, l: L }); const got = new Set(); for (const o of foes(p, A.x, A.y, 1.2)) { got.add(o); hit(ctx, o, 1); } for (let i = 0; i < n; i++) { const a = i / n * TAU; const h = onLine(p, A.x, A.y, A.x + Math.cos(a) * L, A.y + Math.sin(a) * L, 0.8).find((q) => !got.has(q.o)); if (h) { got.add(h.o); later(ctx, h.u * 0.3, () => hit(ctx, h.o, s.sub || 0.6)); } } return 0.3; },
  echo(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), n = s.h || 3, k = s.k || 0.45; fx(p, { f: 'echo', x: A.x, y: A.y, r: s.r || 2, n, k, d: n * k }); ticks(ctx, n, k, (i) => { for (const o of foes(p, A.x, A.y, s.r || 2)) hit(ctx, o, 1 + i * 0.15); }); return n * k; },
  swap(ctx) { const p = ctx.p, A = aim(ctx), o = A.tg; if (!o) return 0; const x0 = p.x, y0 = p.y; fx(p, { f: 'swap', x: x0, y: y0, tx: o.x, ty: o.y }); if (!(o.kind === 'm' && o.rank >= 2)) { const ox = o.x, oy = o.y; o.inst.moveTo(o, x0, y0); if (o.kind === 'p') o.forcePos = true; placeAt(p, ox, oy); } hit(ctx, o, 1); return 0.1; },
  aura(ctx) { const p = ctx.p, s = ctx.step, T = s.t || 5, k = s.k || 1; fx(p, { f: 'aura', x: p.x, y: p.y, r: s.r || 2.5, d: T }); ticks(ctx, Math.round(T / k), k, () => { ctx.ox = p.x; ctx.oy = p.y; for (const o of foes(p, p.x, p.y, s.r || 2.5)) hit(ctx, o, 1); }); return 0.2; },
  drop(ctx) { const p = ctx.p, s = ctx.step, A = aim(ctx), a = Math.atan2(A.y - p.y, A.x - p.x), n = s.n || 5, L = s.l || 8; const pts = []; for (let i = 0; i < n; i++) { const d = 1.5 + (L - 1.5) * i / Math.max(1, n - 1); pts.push([r2(p.x + Math.cos(a) * d), r2(p.y + Math.sin(a) * d)]); } fx(p, { f: 'drop', pts, d: 0.15 * n + 0.3 }); pts.forEach(([x, y], i) => later(ctx, 0.25 + i * 0.15, () => { for (const o of foes(p, x, y, s.w || 1.4)) hit(ctx, o, 1); })); return 0.25 + n * 0.15; }
};
SV.FORMS = Object.keys(FORMS);

function runStep(ctx) {
  const st = ctx.step;
  const f = FORMS[st.f] || FORMS.burst;
  fx(ctx.p, { f: 'cast', x: ctx.p.x, y: ctx.p.y, sk: ctx.sk.id, i: ctx.si });
  const T = f(ctx) || 0;
  later(ctx, T + 0.05, () => selfOps(ctx));
  return T;
}

// ------------------------------------------------------------------ entry
SV.run = function (p, sk, lv, tgt, ax, ay) {
  const inst = p.inst, t = now();
  const el = (sk.element === 'neutral' && p.weaponEl) ? p.weaponEl : sk.element;
  let nb = 1; if (p.nextBonus) { nb = 1 + p.nextBonus / 100; p.nextBonus = 0; }
  const sc = F.skillMult(sk, lv) * nb;
  const base = { p, sk, lv, sc, el, tgt, ax, ay, inst, t };
  let at = 0;
  sk.prog.forEach((st, i) => {
    const run = () => { if (p.dead || p.inst !== inst) return; const ctx = Object.assign({}, base, { step: st, si: i, hits: 0, dealt: 0, hitSet: new Set() }); if (tgt && !tgt.dead) { ctx.ax = tgt.x; ctx.ay = tgt.y; } runStep(ctx); };
    if (at <= 0.01) run(); else inst.after(at, run);
    at += st.gap !== undefined ? st.gap : 0.25;
  });
  return true;
};

// ------------------------------------------------------------------ passives (5 per class, unlocked by level)
const PASSIVES = require('../shared/skills.js').PASSIVES || {};
SV.passivesOf = (p) => (PASSIVES[p.cls] || []).filter((q) => p.char && p.char.lv >= q.lv);
SV.passiveMods = function (p) { const o = {}; for (const q of SV.passivesOf(p)) if (q.mods) for (const k in q.mods) o[k] = (o[k] || 0) + q.mods[k]; return o; };
function procOps(p, q, tgt) {
  const t = now(); p.svCd = p.svCd || {};
  if ((p.svCd[q.id] || 0) > t) return; p.svCd[q.id] = t + (q.icd || 1);
  if (q.ch && W.rand() * 100 >= q.ch) return;
  const ctx = { p, sk: { id: q.id, name: q.name, kind: 'passive' }, lv: 1, sc: F.skillMult({ maxLv: 10 }, 5) || 1, el: q.el || D.CLASSES[p.cls].element, step: { f: 'burst', d: q.d || 0, ops: q.ops, opm: {} }, hits: 0, dealt: 0, hitSet: new Set(), inst: p.inst, ax: tgt ? tgt.x : p.x, ay: tgt ? tgt.y : p.y, tgt };
  p.inst.emit({ k: 'sv', s: p.id, f: 'proc', x: p.x, y: p.y, sk: q.id, m: q.name });
  if (q.d && tgt && !tgt.dead) { if (q.r) for (const o of foes(p, tgt.x, tgt.y, q.r)) hit(ctx, o, 1); else hit(ctx, tgt, 1); }
  else if (tgt && !tgt.dead) onHitOps(ctx, tgt);
  ctx.hits = 1; selfOps(ctx);
}
SV.onDealt = function (p, tgt, dmg, crit, o) {
  if (!p.char || !o || o.kind === 'dot' || o.kind === 'true') return;
  for (const q of SV.passivesOf(p)) { if (q.on === 'hit' || (q.on === 'crit' && crit) || (q.on === 'skill' && o.kind === 'skill') || (q.on === 'basic' && o.kind === 'basic')) procOps(p, q, tgt); }
};
SV.onHurt = function (p, dmg, src) { if (!p.char) return; for (const q of SV.passivesOf(p)) if (q.on === 'hurt' || (q.on === 'lowhp' && p.hp < p.maxHp * 0.35)) procOps(p, q, src && src.kind ? src : null); };
SV.onKill = function (p, e) {
  if (!p.char) return;
  if (p.inst) { p.inst.svCorpses = (p.inst.svCorpses || []).filter((c) => c.until > now()).slice(-20); p.inst.svCorpses.push({ x: e.x, y: e.y, until: now() + 12 }); }
  for (const q of SV.passivesOf(p)) if (q.on === 'kill') procOps(p, q, null);
};
SV.tick = function (p, t, sec) {
  if (!p.char) return;
  // position history for rewinds
  if (sec) { p.svHist = (p.svHist || []).filter((h) => h.t > t - 8); p.svHist.push({ t, x: p.x, y: p.y, hp: p.hp }); }
  if (!sec) return;
  for (const q of SV.passivesOf(p)) if (q.on === 'tick' && Math.floor(t) % (q.every || 5) === 0) procOps(p, q, W.nearestEnemy ? W.nearestEnemy(p, 6) : null);
};
SV.isV5 = (sk) => !!(sk && sk.prog);

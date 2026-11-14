'use strict';
// Ashfall kit runtime: skill riders (✦), class mechanics (◆), class passives and class (set) ultimates.
// Wired into server/combat.js through a handful of hooks; everything here is server-authoritative.
const D = require('../shared/data2.js');
const now = () => Date.now() / 1000;
let C, W, M;
const AF = module.exports = {};
AF.init = (c, w, m) => { C = c; W = w; M = m; };

const foes = (p, x, y, r, cap = 30) => { const out = []; p.inst.inRadius(x, y, r, (o) => { if (out.length < cap && !o.dead && (o.kind === 'm' || o.kind === 'p' || o.kind === 's') && C.isEnemy(p, o) && !(o.kind === 'p' && o.hidden)) out.push(o); }); return out; };
const isBoss = (o) => o.kind === 'm' && o.rank >= 2;
const hit = (p, o, mult, el, extra) => C.dealDamage(p, o, Object.assign({ mult, el: el || D.CLASSES[p.cls].element, kind: 'skill', cm: 1 }, extra || {}));
const say = (p, m, c) => p.inst.emit({ k: 'txt', t: p.id, x: p.x, y: p.y, m, c: c || '#ffd34a' });
const fx = (p, x, y, kind, el, r) => p.inst.emit({ k: 'afx', s: p.id, x, y, fk: kind, el: el || D.CLASSES[p.cls].fxEl, r: r || 1.5 });
const shield = (q, f) => { q.shield = Math.max(q.shield || 0, q.maxHp * f); };
const healPct = (q, f, src) => C.heal(q, q.maxHp * f, src || q, true);
function cds(p, fn) { for (const k in p.cds) fn(k); p.sess && p.sess.send({ t: 'cdsync', cds: Object.fromEntries(Object.entries(p.cds).map(([k, v]) => [k, Math.max(0, Math.round((v - now()) * 100) / 100)])) }); }

// ================================================================== class ultimates (each class: its own idea)
// u = { p, inst, ox, oy (centre), R (radius), M (big hit), m (small hit), el, t, lv, tgt }
const later = (u, s, fn) => u.inst.after(s, () => { if (!u.p.dead && u.p.inst === u.inst) fn(); });
const ring = (u, r, fn) => { for (const e of foes(u.p, u.ox, u.oy, r)) fn(e); };
const zone = (u, o) => W.spawnZone(u.inst, Object.assign({ zk: 'zone', owner: u.p, x: u.ox, y: u.oy, r: u.R, until: now() + 4, tick: 0.5, mult: 0, sk: null, lv: u.lv, el: u.el, color: D.CLASSES[u.p.cls].color }, o));
const CLASS_ULT = {
  // Blademaster — Thousand Cuts: blinks between up to 8 enemies, one cut each, then sheathes for a delayed cross-slash on all of them
  blademaster: (u) => { const L = foes(u.p, u.ox, u.oy, u.R + 2, 8); L.forEach((e, i) => later(u, i * 0.12, () => { u.p.x = e.x - 0.8; u.p.y = e.y; hit(u.p, e, u.m * 3); })); later(u, L.length * 0.12 + 0.5, () => { for (const e of L) if (!e.dead) hit(u.p, e, u.M); say(u.p, '— 納刀 —', '#ffffff'); }); },
  // Guardian — Bastion: plants a fortress, allies inside get a 30% shield and enemies are taunted and pushed to its edge
  guardian: (u) => { for (const a of C.partyNear(u.p, u.R)) shield(a, 0.3); shield(u.p, 0.4); ring(u, u.R, (e) => { e.target = u.p; const an = Math.atan2(e.y - u.oy, e.x - u.ox); if (!isBoss(e)) { e.x = u.ox + Math.cos(an) * u.R * 0.95; e.y = u.oy + Math.sin(an) * u.R * 0.95; } hit(u.p, e, u.m * 2); }); },
  // Berserker — Blood Price: pays 30% HP, then every hit for 6s heals; ends with a cleave scaled by HP lost
  berserker: (u) => { const lost = u.p.hp * 0.3; u.p.hp -= lost; C.addBuff(u.p, 'ult:blood', { atkPct: 60, lifesteal: 25 }, 6, 'Blood Price', '#c81e32'); later(u, 6, () => ring(u, 3.5, (e) => hit(u.p, e, u.M * (1 + lost / u.p.maxHp * 3)))); },
  // Paladin — Judgement Hammer: a hammer falls on the strongest enemy, stunning it, and heals allies by the damage dealt
  paladin: (u) => { const L = foes(u.p, u.ox, u.oy, u.R + 3); const e = L.sort((a, b) => b.hp - a.hp)[0]; if (!e) return; later(u, 0.6, () => { const h0 = e.hp; hit(u.p, e, u.M * 2.2, 'holy'); C.applyTag(e, 'stun', 1, 2, u.p); const dealt = Math.max(0, h0 - e.hp); for (const a of C.partyNear(u.p, 9)) C.heal(a, dealt * 0.25, u.p, true); }); },
  // Pyromancer — Supernova: a sun grows for 2s (bigger the longer), then bursts; the ground keeps burning
  pyromancer: (u) => { later(u, 2, () => { ring(u, u.R * 1.3, (e) => { hit(u.p, e, u.M * 1.4, 'fire'); C.applyTag(e, 'burn', 3, 5, u.p); }); zone(u, { mult: u.m * 0.6, until: now() + 5, el: 'fire', color: '#ff6a2a', zf: 'burn' }); }); },
  // Cryomancer — Absolute Zero: freezes everything for 2.5s; frozen enemies shatter for bonus damage when it ends
  cryomancer: (u) => { const L = foes(u.p, u.ox, u.oy, u.R); for (const e of L) C.applyTag(e, 'freeze', 1, 2.5, u.p); later(u, 2.5, () => { for (const e of L) if (!e.dead) hit(u.p, e, u.M * (isBoss(e) ? 1 : 1.6), 'ice'); }); },
  // Stormcaller — Eye of the Storm: 12 lightning strikes that always hit the enemy with the most HP left
  stormcaller: (u) => { for (let i = 0; i < 12; i++) later(u, 0.2 + i * 0.22, () => { const e = foes(u.p, u.ox, u.oy, u.R + 3).sort((a, b) => b.hp - a.hp)[0]; if (e) { hit(u.p, e, u.m * 2.4, 'lightning'); u.inst.emit({ k: 'bolt', x: e.x, y: e.y - 8, tx: e.x, ty: e.y }); } }); },
  // Necromancer — Mass Grave: every enemy killed within 6s rises as your skeleton for 12s
  necromancer: (u) => { u.p.ultGrave = now() + 6; ring(u, u.R, (e) => hit(u.p, e, u.M * 0.7, 'dark')); },
  // Cleric — Sanctuary: allies inside can't drop below 1 HP for 5s and regain 6% HP every second
  cleric: (u) => { for (const a of C.partyNear(u.p, u.R)) { a.ultSanct = now() + 5; for (let i = 1; i <= 5; i++) later(u, i, () => healPct(a, 0.06, u.p)); } },
  // Druid — World Tree: a tree roots enemies around it and heals allies near it for 8s; it explodes into thorns at the end
  druid: (u) => { for (let i = 0; i < 8; i++) later(u, i, () => { ring(u, u.R, (e) => C.applyTag(e, 'root', 1, 1.1, u.p)); for (const a of C.partyNear(u.p, u.R)) healPct(a, 0.04, u.p); }); later(u, 8, () => ring(u, u.R, (e) => hit(u.p, e, u.M, 'earth'))); },
  // Assassin — Death Mark: marks one target; after 4s it takes damage equal to 35% of all damage dealt to it meanwhile
  assassin: (u) => { const e = u.tgt || foes(u.p, u.ox, u.oy, u.R + 3)[0]; if (!e) return; const h0 = e.hp; C.applyTag(e, 'mark', 1, 4, u.p); later(u, 4, () => { if (e.dead) return; const taken = Math.max(0, h0 - e.hp); hit(u.p, e, u.M, 'poison'); C.dealDamage(u.p, e, { flat: taken * 0.35, kind: 'true', el: 'poison' }); }); },
  // Shadowdancer — Eclipse Waltz: stealth + 5 shadow clones each dance-strike a random enemy
  shadowdancer: (u) => { u.p.stealthUntil = now() + 2; for (let i = 0; i < 5; i++) later(u, 0.25 * i, () => { const L = foes(u.p, u.ox, u.oy, u.R + 2); const e = L[(W.rand() * L.length) | 0]; if (e) { hit(u.p, e, u.m * 3, 'dark'); C.applyTag(e, 'blind', 1, 1.5, u.p); } }); },
  // Ranger — Rain of the Hunt: arrows fall in a growing spiral for 3s, the outer rings slow
  ranger: (u) => { for (let i = 0; i < 10; i++) later(u, i * 0.3, () => { const r = u.R * (i / 10 + 0.15); ring(u, r, (e) => { hit(u.p, e, u.m * 1.3); if (i > 5) C.applyTag(e, 'slow', 1, 2, u.p); }); }); },
  // Marksman — Deadeye: locks the farthest enemy for 1.5s, then one shot that crits for sure and pierces every enemy on the line
  marksman: (u) => { const L = foes(u.p, u.p.x, u.p.y, 16).sort((a, b) => W.dist(u.p, b) - W.dist(u.p, a)); const e = L[0]; if (!e) return; C.applyTag(e, 'mark', 1, 1.5, u.p); later(u, 1.5, () => { const an = Math.atan2(e.y - u.p.y, e.x - u.p.x); for (const o of foes(u.p, u.p.x, u.p.y, 18)) { const dx = o.x - u.p.x, dy = o.y - u.p.y, al = dx * Math.cos(an) + dy * Math.sin(an), pe = Math.abs(-dx * Math.sin(an) + dy * Math.cos(an)); if (al > 0 && pe < 1) hit(u.p, o, u.M * 1.8, null, { critBonus: 100 }); } }); },
  // Engineer — Orbital Strike: places a beacon; after 3s a laser sweeps from it in a full circle
  engineer: (u) => { later(u, 3, () => { for (let i = 0; i < 8; i++) later(u, i * 0.12, () => { const an = i / 8 * Math.PI * 2; for (const e of foes(u.p, u.ox, u.oy, u.R)) { const a2 = Math.atan2(e.y - u.oy, e.x - u.ox); if (Math.abs(((a2 - an + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.45) hit(u.p, e, u.m * 2.2); } }); }); },
  // Monk — Hundred Fists: 20 rapid palm strikes on the nearest enemy; the last one knocks everything around away
  monk: (u) => { const e = u.tgt || foes(u.p, u.p.x, u.p.y, 4)[0]; if (!e) return; for (let i = 0; i < 20; i++) later(u, i * 0.07, () => { if (!e.dead) hit(u.p, e, u.m * 0.6); }); later(u, 1.5, () => ring(u, 3, (o) => { hit(u.p, o, u.M * 0.6); C.applyTag(o, 'knockdown', 1, 1, u.p); })); },
  // Spellblade — Runic Arsenal: 6 rune swords orbit you for 6s, each fires at the nearest enemy once per second
  spellblade: (u) => { for (let s = 1; s <= 6; s++) later(u, s, () => { const L = foes(u.p, u.p.x, u.p.y, 7, 6); L.forEach((e) => hit(u.p, e, u.m * 1.2, 'water')); }); },
  // Beastmaster — Stampede: a herd charges in a line through the area 3 times, knocking down
  beastmaster: (u) => { for (let w = 0; w < 3; w++) later(u, 0.5 + w * 0.6, () => ring(u, u.R, (e) => { hit(u.p, e, u.m * 2, 'earth'); if (!isBoss(e)) C.applyTag(e, 'knockdown', 1, 0.6, u.p); })); },
  // Chronomancer — Time Collapse: saves everyone's position and HP; after 3s enemies snap back but keep the damage, you heal back to your saved HP
  chronomancer: (u) => { const saved = foes(u.p, u.ox, u.oy, u.R).map((e) => [e, e.x, e.y]); const hp0 = u.p.hp; later(u, 3, () => { for (const [e, x, y] of saved) if (!e.dead) { if (!isBoss(e)) { e.x = x; e.y = y; } hit(u.p, e, u.M, 'neutral'); } u.p.hp = Math.max(u.p.hp, hp0); }); },
  // Warlock — Pact of Ruin: curses all, then every curse detonates and spreads to the nearest uncursed enemy
  warlock: (u) => { const L = foes(u.p, u.ox, u.oy, u.R); for (const e of L) C.applyTag(e, 'curse', 2, 3, u.p); later(u, 3, () => { for (const e of L) { if (e.dead) continue; hit(u.p, e, u.M * 0.9, 'poison'); const n = foes(u.p, e.x, e.y, 4).find((o) => !L.includes(o)); if (n) hit(u.p, n, u.M * 0.6, 'poison'); } }); },
  // Star Hunter — Constellation: links the 5 closest enemies with star lines; damage hits every enemy touching any line
  starhunter: (u) => { const L = foes(u.p, u.ox, u.oy, u.R + 2, 5); later(u, 0.8, () => { for (const o of foes(u.p, u.ox, u.oy, u.R + 3)) { for (let i = 0; i + 1 < L.length; i++) { const A = L[i], B = L[i + 1], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1, q = Math.max(0, Math.min(1, ((o.x - A.x) * dx + (o.y - A.y) * dy) / l2)); if (Math.hypot(A.x + dx * q - o.x, A.y + dy * q - o.y) < 1) { hit(u.p, o, u.M * 1.1, 'holy'); break; } } } }); },
  // Abyss Reaver — Abyssal Chains: chains up to 6 enemies to you for 4s; each second drains them and heals you
  darkknight: (u) => { const L = foes(u.p, u.p.x, u.p.y, u.R, 6); for (let s = 1; s <= 4; s++) later(u, s, () => { for (const e of L) if (!e.dead) { if (!isBoss(e)) { e.x += (u.p.x - e.x) * 0.3; e.y += (u.p.y - e.y) * 0.3; } const h0 = e.hp; hit(u.p, e, u.m * 1.4, 'dark'); C.heal(u.p, Math.max(0, h0 - e.hp) * 0.3, u.p, true); } }); },
  // Solar Arbiter — Verdict of Noon: enemies above 50% HP are burned, enemies below are executed by a sun pillar
  lightbringer: (u) => { later(u, 0.7, () => ring(u, u.R, (e) => { if (!isBoss(e) && e.hp < e.maxHp * 0.5) hit(u.p, e, u.M * 3, 'holy'); else { hit(u.p, e, u.M * 0.8, 'holy'); C.applyTag(e, 'burn', 2, 4, u.p); } })); },
  // Umbral Devourer — Feast: the shadow eats every summon/zone of enemies and the weakest 3 enemies; you gain 10% max HP shield per eaten foe
  shadowmancer: (u) => { const L = foes(u.p, u.ox, u.oy, u.R).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 3); later(u, 0.9, () => { for (const e of L) { if (e.dead) continue; hit(u.p, e, u.M * 1.5, 'dark'); shield(u.p, 0.1 * L.length); } }); },
  // Seraph — Ascension: you fly (untargetable) for 3s and rain feathers on enemies, then land healing allies by 25%
  seraph: (u) => { u.p.invulnUntil = now() + 3; for (let i = 0; i < 6; i++) later(u, 0.4 + i * 0.4, () => ring(u, u.R, (e) => hit(u.p, e, u.m, 'holy'))); later(u, 3, () => { for (const a of C.partyNear(u.p, u.R)) healPct(a, 0.25, u.p); }); },
  // Grim Reaper — Harvest: one huge scythe swing; enemies killed by it return 15% max HP and reset your skill cooldowns
  reaper: (u) => { later(u, 0.4, () => { let kills = 0; ring(u, u.R, (e) => { hit(u.p, e, u.M * 1.3, 'dark'); if (e.dead || e.hp <= 0) kills++; }); if (kills) { healPct(u.p, 0.15 * kills, u.p); u.p.cds = {}; u.p.sess && u.p.sess.send({ t: 'cdreset' }); say(u.p, `HARVEST ×${kills}`, '#b0ffb0'); } }); },
  // Demon Lord — Hell Gate: opens a gate that spits 6 imps; imps explode on contact
  demon: (u) => { for (let i = 0; i < 6; i++) later(u, 0.5 + i * 0.35, () => { const L = foes(u.p, u.ox, u.oy, u.R + 2); const e = L[(W.rand() * L.length) | 0]; if (e) { hit(u.p, e, u.m * 2.4, 'fire'); for (const o of foes(u.p, e.x, e.y, 1.6)) if (o !== e) hit(u.p, o, u.m, 'fire'); } }); },
  // Deity — Divine Decree: enemies are judged by level — weaker than you take double, stronger are stunned
  deity: (u) => { later(u, 1, () => ring(u, u.R, (e) => { if ((e.lv || 1) < u.p.lv) hit(u.p, e, u.M * 2, 'holy'); else { hit(u.p, e, u.M * 0.8, 'holy'); C.applyTag(e, 'stun', 1, 2, u.p); } })); },
  // Jester — Grand Finale: spins a wheel — triple damage, mass confuse, heal the party or fireworks everywhere
  jester: (u) => { const r = (W.rand() * 4) | 0; later(u, 1, () => { if (r === 0) { ring(u, u.R, (e) => hit(u.p, e, u.M * 3)); say(u.p, 'JACKPOT ×3', '#ffd84a'); } else if (r === 1) { ring(u, u.R, (e) => C.applyTag(e, 'fear', 1, 3, u.p)); say(u.p, 'CONFUSION!', '#ff7ad8'); } else if (r === 2) { for (const a of C.partyNear(u.p, 9)) healPct(a, 0.4, u.p); say(u.p, 'ENCORE!', '#7dff8a'); } else { for (let i = 0; i < 8; i++) later(u, i * 0.15, () => ring(u, u.R, (e) => hit(u.p, e, u.m))); say(u.p, 'FIREWORKS!', '#7ad8ff'); } }); },
  // Loki — Grand Illusion: you vanish, a decoy taunts everyone for 3s, then the decoy explodes and you reappear behind the strongest enemy
  loki: (u) => { u.p.stealthUntil = now() + 3; ring(u, u.R, (e) => { e.target = null; C.applyTag(e, 'fear', 1, 3, u.p); }); later(u, 3, () => { ring(u, u.R, (e) => hit(u.p, e, u.M)); const e = foes(u.p, u.ox, u.oy, u.R + 3).sort((a, b) => b.hp - a.hp)[0]; if (e) { u.p.x = e.x - 0.8; u.p.y = e.y; hit(u.p, e, u.M); } }); }
};

// ================================================================== class mechanics (◆)
const PAY = {
  blademaster: (p, n, t, k) => { for (const e of foes(p, t.x, t.y, 2.8)) hit(p, e, 0.2 * n * k); fx(p, t.x, t.y, 'wave'); },
  guardian: (p, n, t, k) => { shield(p, 0.03 * n * k); for (const e of foes(p, p.x, p.y, 5)) if (e.kind === 'm') { e.target = p; e.tauntBy = p; e.tauntUntil = now() + 3; } fx(p, p.x, p.y, 'bulwark'); },
  berserker: (p, n, t, k) => { healPct(p, 0.02 * n * k); fx(p, p.x, p.y, 'bloodburst'); },
  paladin: (p, n, t, k) => { for (const a of C.partyNear(p, 6)) healPct(a, 0.04 * n * k, p); for (const e of foes(p, t.x, t.y, 2.5)) hit(p, e, 0.18 * n * k, 'holy'); fx(p, t.x, t.y, 'holyburst'); },
  pyromancer: (p, n, t, k) => { for (const e of foes(p, p.x, p.y, 3.8)) hit(p, e, 0.12 * n * k, 'fire'); fx(p, p.x, p.y, 'overheat', 'fire', 3.8); },
  cryomancer: (p, n, t, k) => { if (t.kind) { hit(p, t, 0.28 * n * k, 'ice'); C.applyTag(t, 'freeze', 1, Math.min(2, 0.25 * n), p); } fx(p, t.x, t.y, 'iceshatter', 'ice'); },
  stormcaller: (p, n, t, k) => { foes(p, t.x, t.y, 7.5).slice(0, n).forEach((e, i) => p.inst.after(i * 0.06, () => { if (!e.dead) { hit(p, e, 0.35 * k, 'lightning'); p.inst.emit({ k: 'bolt', x: t.x, y: t.y, tx: e.x, ty: e.y, el: 'lightning' }); } })); },
  necromancer: (p, n, t, k) => { for (let i = 0; i < n; i++) p.inst.after(i * 0.1, () => { const x = t.x + (W.rand() - 0.5) * 3, y = t.y + (W.rand() - 0.5) * 3; for (const e of foes(p, x, y, 2)) hit(p, e, 0.6 * k, 'dark'); fx(p, x, y, 'corpse', 'shadow'); }); },
  cleric: (p, n, t, k) => { for (const a of C.partyNear(p, 7.5)) { for (const g of [...a.tags.keys()]) a.tags.delete(g); shield(a, 0.04 * n * k); } fx(p, p.x, p.y, 'blessing', 'holy'); },
  druid: (p, n, t, k) => { for (const e of foes(p, t.x, t.y, 3.1)) C.applyTag(e, 'root', 1, 0.3 * n, p); healPct(p, 0.02 * n * k); fx(p, t.x, t.y, 'roots', 'nature'); },
  assassin: (p, n, t, k) => { if (t.kind) { hit(p, t, 0.22 * n * k, 'poison'); C.applyTag(t, 'slow', 1, 0.4 * n, p); } fx(p, t.x, t.y, 'venompop', 'poison'); },
  shadowdancer: (p, n, t, k) => { for (const e of foes(p, p.x, p.y, 3)) hit(p, e, 0.15 * n * k, 'dark'); fx(p, p.x, p.y, 'bladering', 'shadow', 3); },
  ranger: (p, n, t, k) => { const a = Math.atan2(t.y - p.y, t.x - p.x); for (const e of foes(p, p.x, p.y, 11)) { const dx = e.x - p.x, dy = e.y - p.y, al = dx * Math.cos(a) + dy * Math.sin(a), off = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)); if (al > 0 && al < 11 && off < 1) hit(p, e, 0.18 * n * k, 'wind'); } p.inst.emit({ k: 'afx', s: p.id, x: p.x, y: p.y, tx: p.x + Math.cos(a) * 11, ty: p.y + Math.sin(a) * 11, fk: 'spiritarrow', el: 'wind' }); },
  engineer: (p, n, t, k) => { for (let i = 0; i < n; i++) { const x = t.x + (W.rand() - 0.5) * 4.5, y = t.y + (W.rand() - 0.5) * 4.5; fx(p, x, y, 'minewarn', 'tech', 1.2); p.inst.after(0.5, () => { for (const e of foes(p, x, y, 1.6)) hit(p, e, 0.45 * k, 'lightning'); fx(p, x, y, 'mine', 'tech'); }); } },
  monk: (p, n, t, k) => { healPct(p, 0.03 * n * k); p.cmStun = 0.2 * n; fx(p, p.x, p.y, 'chiflare', 'chi'); },
  spellblade: (p, n, t, k) => { for (let i = 0; i < n; i++) p.inst.after(i * 0.15, () => { if (t.kind && !t.dead) { hit(p, t, 0.55 * k, 'water'); fx(p, t.x, t.y, 'rune', 'arcane'); } }); },
  beastmaster: (p, n, t, k) => { for (let i = 0; i < n; i++) p.inst.after(i * 0.12, () => { if (t.kind && !t.dead) { hit(p, t, 0.3 * k, 'earth'); fx(p, t.x, t.y, 'maul', 'nature'); } }); },
  chronomancer: (p, n, t, k, sk) => { cds(p, (id) => { if (!sk || id !== sk.id) p.cds[id] -= 0.5 * n * k; }); say(p, '⟲', '#5ff0c8'); },
  warlock: (p, n, t, k) => { for (const e of foes(p, p.x, p.y, 7.5)) { hit(p, e, 0.11 * n * k, 'poison'); fx(p, e.x, e.y, 'curse', 'fel', 1); } },
  starhunter: (p, n, t, k) => { fx(p, t.x, t.y, 'starfall', 'star', 2.3); p.inst.after(0.25, () => { for (const e of foes(p, t.x, t.y, 2.3)) hit(p, e, 0.25 * n * k, 'holy'); }); },
  darkknight: (p, n, t, k) => { if (!t.kind) return; const h0 = t.hp; hit(p, t, 0.2 * n * k, 'dark'); C.heal(p, Math.max(0, h0 - t.hp) * 0.2, p, true); fx(p, t.x, t.y, 'abyssslash', 'dark'); },
  lightbringer: (p, n, t, k) => { foes(p, p.x, p.y, 8.8).slice(0, 3).forEach((e) => { hit(p, e, 0.15 * n * k, 'holy'); p.inst.emit({ k: 'afx', s: p.id, x: p.x, y: p.y, tx: e.x, ty: e.y, fk: 'prism', el: 'light' }); }); },
  shadowmancer: (p, n, t, k) => { if (t.kind) { hit(p, t, 0.15 * n * k, 'dark'); C.applyTag(t, 'root', 1, 0.5, p); } fx(p, t.x, t.y, 'maw', 'umbra'); },
  seraph: (p, n, t, k) => { for (const a of C.partyNear(p, 7.5)) shield(a, 0.03 * n * k); for (const e of foes(p, t.x, t.y, 2.5)) hit(p, e, 0.13 * n * k, 'holy'); fx(p, t.x, t.y, 'feathers', 'celestial'); },
  reaper: (p, n, t, k) => { for (const e of foes(p, p.x, p.y, 3.8)) hit(p, e, 0.13 * n * k * (e.hp < e.maxHp * 0.3 ? 2 : 1), 'dark'); fx(p, p.x, p.y, 'harvest', 'death', 3.8); },
  demon: (p, n, t, k) => { C.addBuff(p, 'cm:demonform', { atkPct: 35, matkPct: 35, lifesteal: 10 }, 6, 'Demon Form', '#ff6a1a'); say(p, 'DEMON FORM', '#ff6a1a'); fx(p, p.x, p.y, 'demonform', 'infernal', 2.5); },
  deity: (p, n, t, k) => { for (const e of foes(p, p.x, p.y, 8.8)) { hit(p, e, 0.09 * n * k, 'holy'); fx(p, e.x, e.y, 'judgement', 'divine', 1); } },
  jester: (p, n, t, k) => { const r = (W.rand() * 3) | 0; if (r === 0 && t.kind) { hit(p, t, 0.4 * n * k, 'wind', { critBonus: 100 }); say(p, 'JACKPOT!', '#ffd84a'); } else if (r === 1) healPct(p, 0.04 * n * k); else for (const e of foes(p, p.x, p.y, 3.8)) C.applyTag(e, 'stun', 1, 0.2 * n, p); fx(p, t.x || p.x, t.y || p.y, 'confetti', 'jester'); },
  loki: (p, n, t, k) => { const x = p.x, y = p.y; for (const e of foes(p, x, y, 3.8)) { hit(p, e, 0.3 * n * k, 'dark'); if (e.kind === 'm' && !isBoss(e)) e.target = null; } const a = W.rand() * 6.28, nx = x + Math.cos(a) * 3, ny = y + Math.sin(a) * 3; if (M.walkable(p.inst.map, nx, ny)) { p.inst.moveTo(p, nx, ny); p.forcePos = true; } fx(p, x, y, 'decoyboom', 'chaos', 2); }
};
const st = (p) => p.cm || (p.cm = { n: 0, acc: 0, last: null, tgt: 0, px: p.x, py: p.y, mv: 0, sT: 0, calm: 0, tt: 0, t1: 0 });
const mech = (p) => (p.kind === 'p' && D.CLASSES[p.cls] ? D.CLASSES[p.cls].mech : null);
function sync(p) { const c = st(p); p.res = Math.floor(c.n); }
function add(p, v) {
  const m = mech(p); if (!m || !v) return; const c = st(p);
  const before = Math.floor(c.n);
  c.n = Math.min(m.max, c.n + v);
  if (m.over && c.n >= m.max) { const t = p.atkTarget ? p.inst.entities.get(p.atkTarget) : null; c.n = 0; try { PAY[p.cls](p, m.max, t && !t.dead ? t : p, 1); } catch (e) { console.error(e); } }
  sync(p); if (Math.floor(c.n) !== before && (m.aspd || m.crit || m.critDmg)) p.dirty = true;
}
function spend(p, cnt, t, k, sk) {
  const m = mech(p), c = st(p), n = Math.min(Math.floor(c.n), cnt);
  if (n <= 0 || !PAY[p.cls]) return 0;
  c.n -= n; sync(p);
  try { PAY[p.cls](p, n, t || p, k, sk); } catch (e) { console.error(e); }
  if (m.aspd || m.crit || m.critDmg) p.dirty = true;
  return n;
}
AF.mechMods = (p) => { const m = mech(p); if (!m || !p.cm) return null; const n = Math.floor(p.cm.n); const o = {}; if (m.aspd) o.aspdPct = m.aspd * n; if (m.crit) o.crit = m.crit * n; if (m.critDmg) o.critDmg = m.critDmg * n; return o; };
AF.dmgMod = (p) => { if (!p.cm) return 1; const n = Math.floor(p.cm.n); return p.cls === 'berserker' ? 1 + 0.04 * n : p.cls === 'pyromancer' ? 1 + 0.02 * n : p.cls === 'shadowmancer' ? 1 + 0.03 * n : 1; };

// ================================================================== class passives (unlocked by level)
const PSTAT = { atkP: ['atkPct', 'matkPct'], crit: ['crit'], critDmg: ['critDmg'], hpP: ['hpPct'], defP: ['defPct', 'mdefPct'], ls: ['lifesteal'], cdr: ['cdr'], aspd: ['aspdPct'] };
AF.passiveMods = (p) => {
  const cls = D.CLASSES[p.cls]; if (!cls || !cls.passives) return {};
  const o = {}; const px = { execute: 0, first: 0, killHeal: 0, sig: 0, lowShield: 0, thorns: 0, regen: 0, castCdr: 0, castHeal: 0, dodge: 0 };
  for (const q of cls.passives) {
    if (p.lv < q.lv) continue;
    if (q.k === 'stat') { for (const s in q.v) for (const key of PSTAT[s] || []) o[key] = (o[key] || 0) + q.v[s]; }
    else px[q.k] = (px[q.k] || 0) + q.v;
  }
  p.cpx = px;
  return o;
};

// ================================================================== hooks from combat.js
// called for every hit the player lands (not DoTs)
AF.onDealt = function (p, tgt, dmg, crit, o) {
  const m = mech(p); if (!m || o.cm || o.kind === 'reflect' || o.kind === 'dot' || dmg <= 0) return;
  const g = m.g, c = st(p);
  if (g.single) { if (c.tgt !== tgt.id) { c.tgt = tgt.id; c.n = 0; } }
  if (g.hit) { c.acc += g.hit; if (c.acc >= 1) { const v = Math.floor(c.acc); c.acc -= v; add(p, v); } }
  if (g.crit && crit) add(p, g.crit);
  if (g.luck) add(p, W.rand() < 0.33 ? 2 : W.rand() < 0.35 ? 1 : 0);
  if (p.cmStun && tgt.kind !== 'c') { C.applyTag(tgt, 'stun', 1, p.cmStun, p); p.cmStun = 0; }
  // class passive: every 6th attack releases a signature burst
  if (p.cpx && p.cpx.sig && (o.kind === 'skill' || o.kind === 'basic')) {
    p._sigN = (p._sigN || 0) + 1;
    if (p._sigN >= 6) { p._sigN = 0; const k = p.cpx.sig / 100 * 0.5; for (const e of foes(p, tgt.x, tgt.y, 2.2)) hit(p, e, k); fx(p, tgt.x, tgt.y, 'signature', null, 2.2); }
  }
};
AF.onHurt = function (p, dmg, src) {
  const m = mech(p); if (!m) return;
  if (m.g.hurt && dmg > 0) add(p, m.g.hurt);
  st(p).calm = 0;
  const px = p.cpx; const t = now();
  if (px && px.lowShield && p.hp < p.maxHp * 0.3 && (p._lowShAt || 0) < t - 30) { p._lowShAt = t; shield(p, px.lowShield / 100); say(p, 'GUARD!', '#9cf'); }
  if (p.afThorns > t && src && !src.dead && src !== p && src.inst === p.inst) C.dealDamage(p, src, { flat: Math.round(dmg * p.afThornsPct / 100), kind: 'reflect' });
  if (px && px.thorns && src && !src.dead && src !== p && src.inst === p.inst) C.dealDamage(p, src, { flat: Math.round(dmg * px.thorns / 100), kind: 'reflect' });
};
AF.dodge = (p) => !!(p.cpx && p.cpx.dodge && W.rand() * 100 < p.cpx.dodge);
AF.lastStand = (p, dmg) => { const t = now(); if (p.afLastStand > t && dmg >= p.hp) { p.afLastStand = 0; say(p, 'UNDYING!', '#ffd34a'); return Math.max(0, p.hp - 1); } return dmg; };
AF.onKill = function (p, e) {
  // Necromancer's Mass Grave: the fallen rise as your skeletons
  if (p.ultGrave > now() && e.kind === 'm') W.spawnSummon(p, { name: 'Risen ' + e.name, dur: 12, shape: 'undead', color: '#c8c0a0', mult: 0.6, element: 'dark', mag: true });
  const m = mech(p);
  if (m && m.g.kill) add(p, m.g.kill);
  if (p.cpx && p.cpx.killHeal) healPct(p, p.cpx.killHeal / 100);
  // nearby necromancers collect corpses
  if (e.inst) for (const q of e.inst.players) { const mq = mech(q); if (q !== p && mq && mq.g.nearDeath && !q.dead && W.dist(q, e) < 7 && C.isEnemy(q, e)) add(q, 1); }
  // riders on the last skill that hit this monster
  const r = e._afKill; if (r && r.p === p) {
    if (r.detonate) { for (const o of foes(p, e.x, e.y, 2.3)) if (o !== e) hit(p, o, r.detonate); fx(p, e.x, e.y, 'detonate', null, 2.3); }
    if (r.reset && r.sk) { p.cds[r.sk] = 0; p.sess && p.sess.send({ t: 'cd', id: r.sk, d: 0 }); say(p, 'RESET', '#6af'); }
    if (r.spirit) W.spawnSummon(p, { name: 'Spirit', dur: 8, shape: 'spirit', color: D.CLASSES[p.cls].color, mult: 0.4, mag: D.CLASSES[p.cls].dmg === 'mag', element: D.CLASSES[p.cls].element });
  }
};
// per-tick player logic (replaces the old per-class resource behaviours)
AF.tick = function (p, dt, t, sec) {
  const m = mech(p); if (!m) return; const g = m.g, c = st(p);
  const mv = Math.hypot(p.x - c.px, p.y - c.py);
  if (g.move) { c.mv += mv; if (c.mv >= 2.5) { c.mv = 0; add(p, 1); } }
  if (g.still) { if (mv < 0.01) { c.sT += dt; if (c.sT >= 0.6) { c.sT = 0; add(p, 1); } } else c.sT = 0; }
  c.px = p.x; c.py = p.y;
  if (!sec) return;
  if (g.lowhp) { c.n = Math.min(m.max, Math.floor((1 - p.hp / p.maxHp) * 10) + Math.min(c.n, 2)); sync(p); }
  if (g.time) { c.tt++; if (c.tt >= 2) { c.tt = 0; add(p, 1); } }
  const inCombat = t - (p.lastHit || 0) < 4 || t - (p.lastHurt || 0) < 4;
  if (g.combat && inCombat) add(p, 1);
  if (g.allies && C.partyNear(p, 6).length > 1) add(p, 1);
  if (g.calm) { if (t - (p.lastHurt || 0) > 2) { c.calm++; if (c.calm >= 2) { c.calm = 0; add(p, 1); } } }
  if (g.aim) { if (p.atkTarget && c.aimT === p.atkTarget) add(p, 1); c.aimT = p.atkTarget; }
  if (m.decay && c.n > 0) { c.n = Math.max(0, c.n - m.decay); sync(p); }
  if (p.cpx && p.cpx.regen && inCombat) healPct(p, p.cpx.regen / 100);
  if (p.afRegen && p.afRegen.until > t) healPct(p, p.afRegen.pct / 100);
};

// ================================================================== riders (✦)
const RK = (sk, k) => { for (const r of sk.riders || []) if (r.k === k) return r.v; return 0; };
// the condition half of a skill's signature ability (r.w); o = the target being hit (null at cast time)
const CCT = ['stun', 'root', 'slow', 'freeze', 'airborne', 'knockdown', 'fear', 'chill'], DOTT = ['burn', 'poison', 'bleed'];
AF.when = function (p, r, o, ctx) {
  const w = r.w; if (!w || w === 'always') return true;
  const tg = o && o.kind ? o : null, m = mech(p) || { max: 1 };
  switch (w) {
    case 'crit': return r.k === 'critUp' || r.k === 'critDmg' ? true : !!p._lastCrit;
    case 'tgtLow': return !tg || tg.hp / tg.maxHp < 0.5;
    case 'tgtHigh': return !tg || tg.hp / tg.maxHp > 0.7;
    case 'selfLow': return p.hp / p.maxHp < 0.5;
    case 'selfHigh': return p.hp / p.maxHp > 0.8;
    case 'mechHalf': return (ctx.mechN !== undefined ? ctx.mechN : (p.cm ? p.cm.n : 0)) >= m.max / 2;
    case 'mechEmpty': return (ctx.mechN !== undefined ? ctx.mechN : (p.cm ? p.cm.n : 0)) < 1;
    case 'cc': return !!tg && CCT.some((x) => tg.tags.has(x));
    case 'dot': return !!tg && DOTT.some((x) => tg.tags.has(x));
    case 'boss': return !!tg && ((tg.kind === 'm' && tg.rank >= 1) || tg.kind === 'p');
    case 'crowd': return (ctx.nT || 0) >= 3;
    case 'single': return (ctx.nT || 1) === 1;
    case 'third': return !!ctx.third;
    case 'combo': return (p.combo || 0) >= 10;
    case 'close': return !tg || W.dist(p, tg) <= 3.2;
    case 'far': return !!tg && W.dist(p, tg) >= 5;
    case 'moving': return !!ctx.moving;
    case 'lowSp': return p.sp < p.maxSp * 0.3;
    case 'highSp': return p.sp > p.maxSp * 0.8;
    case 'shielded': return (p.shield || 0) > 0;
    case 'party': return C.partyNear(p, 8).length > 1;
    case 'crowdNear': return foes(p, p.x, p.y, 4.5).length >= 3;
    case 'bossNear': return foes(p, p.x, p.y, 8).some((e) => e.kind === 'm' && e.rank >= 2);
    case 'afterUlt': return now() - (p._ultAt || 0) < 10;
  }
  return true;
};
// before the hits: once per cast
AF.preCast = function (p, sk, lv, tgt, ax, ay) {
  const m = mech(p), c = st(p), t = now();
  const ctx = { nb: 1, crit: 0, critDmg: 0, n: 0, mechN: p.cm ? Math.floor(p.cm.n) : 0, moving: !!sk.move || t - (p.movedAt || 0) < 1 };
  p._afUse = p._afUse || {}; p._afUse[sk.id] = (p._afUse[sk.id] || 0) + 1; ctx.third = p._afUse[sk.id] % 3 === 0;
  if (sk.kind === 'ult') p._ultAt = t;
  if (m) {
    if (m.g.alt) { if (c.last === sk.id) { c.n = 0; sync(p); } else add(p, 1); }
    c.last = sk.id;
    if (m.g.cast) add(p, m.g.cast);
    const role = sk.cmRole;
    if (m.boostSpend && (role === 's2' || role === 's3' || role === 'fin' || role === 'fin2')) {
      const n = Math.min(Math.floor(c.n), role === 's2' ? 2 : role === 's3' ? 3 : m.max);
      if (n > 0) { c.n -= n; sync(p); ctx.nb *= (1 + m.boostSpend * n) * (role === 'fin2' ? 1.5 : 1); say(p, 'AIMED ×' + ctx.nb.toFixed(2), '#ffe8a8'); }
    }
  }
  if (p.cpx && p.cpx.castHeal) healPct(p, p.cpx.castHeal / 100);
  if (p.cpx && p.cpx.castCdr && W.rand() * 100 < p.cpx.castCdr) cds(p, (id) => { if (id !== sk.id) p.cds[id] -= 1; });
  // empower / amp carried from earlier casts
  if (sk.dmg || sk.zone) {
    if (p.afAmp) { ctx.nb *= 1 + p.afAmp / 100; p.afAmp = 0; }
    if (p.afEmpower && p.afEmpower.n > 0) { ctx.nb *= 1 + p.afEmpower.pct / 100; p.afEmpower.n--; }
  }
  ctx.crit = RK(sk, 'critUp'); ctx.critDmg = RK(sk, 'critDmg');
  // support riders resolved at cast time
  for (const r of sk.riders || []) {
    if (!AF.when(p, r, null, ctx)) continue;
    const v = r.v;
    switch (r.k) {
      case 'rally': if (sk.mods) for (const q of C.partyNear(p, 6.3)) if (q !== p) C.addBuff(q, 'rally:' + sk.id, Object.fromEntries(Object.entries(sk.mods).map(([k2, x]) => [k2, Math.round(x * v / 100)])), sk.dur || 8, sk.name, D.CLASSES[p.cls].color); break;
      case 'reflect': C.addBuff(p, 'rf:' + sk.id, { reflect: v }, Math.max(3, (sk.shield && sk.shield.dur) || sk.dur || 4), sk.name, '#9cf'); break;
      case 'thorns': p.afThorns = t + Math.max(3, (sk.shield && sk.shield.dur) || sk.dur || 4); p.afThornsPct = v; break;
      case 'resetMove': { const ids = (require('../shared/skills.js').CLASS_SKILLS[p.cls] || []).slice(0, 2); for (const id of ids) { p.cds[id] = 0; p.sess && p.sess.send({ t: 'cd', id, d: 0 }); } break; }
      case 'regen': p.afRegen = { until: t + 5, pct: v }; break;
      case 'immune': C.addBuff(p, 'imm:' + sk.id, { ccImmune: 1 }, v, sk.name, '#fff'); break;
      case 'cleanse': for (const g of [...p.tags.keys()]) p.tags.delete(g); break;
      case 'lastStand': p.afLastStand = t + v; break;
      case 'haste': C.addBuff(p, 'hs:' + sk.id, { cdr: v }, 6, sk.name, '#6af'); break;
      case 'empower': p.afEmpower = { n: 3, pct: v }; break;
      case 'amp': if (!sk.dmg) p.afAmp = v; break;
      case 'invuln': p.invulnUntil = t + v; break;
      case 'swift': if (!sk.dmg) C.addBuff(p, 'sw:' + sk.id, { movePct: v }, 2.5, sk.name, '#9f9'); break;
      case 'stack': if (!sk.dmg) C.addBuff(p, 'stk:' + sk.id, { atkPct: v, matkPct: v }, 6, sk.name, '#fc6'); break;
      case 'overheal': p.afOverheal = t + 6; break;
      case 'decoy': { const a = Math.atan2((ay || p.y) - p.y, (ax || p.x) - p.x); for (const e of foes(p, p.x, p.y, 6)) if (e.kind === 'm' && !isBoss(e)) e.target = null; fx(p, p.x - Math.cos(a), p.y - Math.sin(a), 'decoy', null, 1); break; }
    }
  }
  // the Ashfall "buff" slot also carries the full skill mechanic on self-only skills
  if (sk.unroot) for (const g of ['root', 'slow', 'chill']) p.tags.delete(g);
  ctx.t = t;
  return ctx;
};
// damage multiplier for one target (index i in the hit list)
AF.tgtMult = function (p, sk, o, i, ctx) {
  let k = 1; const hp = o.hp / o.maxHp;
  for (const r of sk.riders || []) {
    if (!AF.when(p, r, o, ctx)) continue;
    const v = r.v;
    switch (r.k) {
      case 'backstab': { const a = Math.atan2(p.y - o.y, p.x - o.x); let d = Math.abs(a - (o.dir || 0)); if (d > Math.PI) d = 2 * Math.PI - d; if ((o.target && o.target !== p) || d > Math.PI * 0.6) k *= 1 + v / 100; break; }
      case 'execute': if (hp < 0.3) k *= 1 + v / 100; break;
      case 'shatter': if (o.tags.has('stun') || o.tags.has('freeze') || o.tags.has('root')) k *= 1 + v / 100; break;
      case 'pierceUp': k *= 1 + v / 100 * i; break;
      case 'far': k *= 1 + v / 100 * Math.min(1, W.dist(p, o) / 9); break;
      case 'near': if (W.dist(p, o) <= 2.5) k *= 1 + v / 100; break;
      case 'fury': k *= 1 + v / 100 * Math.floor((1 - p.hp / p.maxHp) * 10); break;
      case 'crush': k += (p.maxHp * v / 100) / Math.max(1, p.st.dmgType === 'mag' ? p.st.matk : p.st.atk) * 0.5; break;
    }
  }
  if (o.afMark && o.afMark.until > ctx.t) k *= 1 + o.afMark.pct / 100;
  if (p.cpx) { if (p.cpx.execute && hp < 0.3) k *= 1 + p.cpx.execute / 100; if (p.cpx.first && hp > 0.9) k *= 1 + p.cpx.first / 100; }
  return k;
};
AF.hitOpts = (sk, ctx, p, o) => { const ok = (k) => { const r = (sk.riders || []).find((x) => x.k === k); return r && (!p || AF.when(p, r, o, ctx)) ? r.v : 0; }; return { critBonus: ok('critUp'), critDmgBonus: ok('critDmg'), pierce: ok('trueDmg') / 100 || undefined }; };
// after one target was hit
AF.afterHit = function (p, sk, o, dealt, ctx, el) {
  const t = ctx.t;
  for (const r of sk.riders || []) {
    if (!AF.when(p, r, o, ctx)) continue;
    const v = r.v;
    switch (r.k) {
      case 'stack': { const b = p.buffs.get('stack:' + sk.id); const n = Math.min(5, ((b && b.n) || 0) + 1); C.addBuff(p, 'stack:' + sk.id, { atkPct: v * n, matkPct: v * n }, 6, sk.name + ' ×' + n, '#fc6'); p.buffs.get('stack:' + sk.id).n = n; break; }
      case 'knockup': if (!isBoss(o)) C.applyTag(o, 'airborne', 1, v, p); break;
      case 'swift': C.addBuff(p, 'sw:' + sk.id, { movePct: v }, 2.5, sk.name, '#9f9'); break;
      case 'splash': if (ctx.n < 1) for (const e of foes(p, o.x, o.y, 1.9)) if (e !== o) C.dealDamage(p, e, { flat: Math.round(dealt * v / 100), kind: 'skill', el }); break;
      case 'sunder': C.applyTag(o, 'armorbreak', 1, 5, p); break;
      case 'bleed': C.applyTag(o, 'bleed', 2, 4, p); break;
      case 'burn': C.applyTag(o, 'burn', 1, 3, p); break;
      case 'toxin': C.applyTag(o, 'poison', 1, 5, p); break;
      case 'chill': C.applyTag(o, 'chill', 1, 4, p); break;
      case 'fear': if (!isBoss(o)) C.applyTag(o, 'fear', 1, v, p); break;
      case 'blind': C.applyTag(o, 'blind', 1, 3, p); break;
      case 'weaken': o.weakUntil = t + 5; o.weakPct = v; break;
      case 'taunt': if (o.kind === 'm') { o.target = p; o.tauntBy = p; o.tauntUntil = t + v; } break;
      case 'mark': o.afMark = { until: t + 4, pct: v }; C.applyTag(o, 'mark', 1, 4, p); break;
      case 'leech': C.heal(p, dealt * v / 100, p, true); break;
      case 'mend': { let best = p, bv = 2; for (const q of C.partyNear(p, 7)) { const x = q.hp / q.maxHp; if (x < bv) { bv = x; best = q; } } C.heal(best, dealt * v / 100, p, true); break; }
      case 'guard': p.shield = Math.min(p.maxHp * 0.5, (p.shield || 0) + dealt * v / 100); break;
      case 'refund': add(p, v >= 5 ? 1 : 0); p.sp = Math.min(p.maxSp, p.sp + v * 0.5); break;
      case 'cdr': cds(p, (id) => { if (id !== sk.id) p.cds[id] -= v; }); break;
      case 'timeLock': if (o.kind === 'p') { for (const id in o.cds) o.cds[id] += v; } else C.applyTag(o, 'slow', 1, v + 1, p); break;
      case 'purge': o.shield = 0; if (o.kind === 'p') { for (const k of [...o.buffs.keys()]) o.buffs.delete(k); o.buffsChanged = true; C.recalc(o); } break;
      case 'steal': o.weakUntil = t + 5; o.weakPct = v; C.addBuff(p, 'steal:' + sk.id, { atkPct: v, matkPct: v }, 5, sk.name, '#fc6'); break;
      case 'starMark': { o.afStars = (o.afStars || 0) + 1; if (o.afStars >= v) { o.afStars = 0; hit(p, o, 1.25, el); fx(p, o.x, o.y, 'starburst', 'star', 2); } break; }
      case 'detonate': o._afKill = Object.assign(o._afKill || {}, { p, detonate: v / 100 * 0.5 }); break;
      case 'reset': o._afKill = Object.assign(o._afKill || {}, { p, reset: 1, sk: sk.id }); break;
      case 'spirit': o._afKill = Object.assign(o._afKill || {}, { p, spirit: 1 }); break;
      case 'echo': if (ctx.n < 4) p.inst.after(0.4, () => { if (!o.dead && o.inst === p.inst) { C.dealDamage(p, o, { flat: Math.round(dealt * v / 100), kind: 'skill', el }); p.inst.emit({ k: 'echo', s: p.id, sk: sk.id, x: o.x, y: o.y, el }); } }); break;
      case 'crush': break;
    }
  }
  if (p.afOverheal > t) {}
  ctx.n++;
};
// after all hits: area riders, mechanic spend/build
AF.postCast = function (p, sk, lv, tgt, ax, ay, targets, el, ctx) {
  const inst = p.inst, t = ctx.t;
  const cx = tgt ? tgt.x : ax, cy = tgt ? tgt.y : ay;
  const color = (D.ELEMENTS[el] || D.ELEMENTS.neutral).color;
  for (const r of sk.riders || []) {
    if (!AF.when(p, r, tgt && !tgt.dead ? tgt : null, ctx)) continue;
    const v = r.v;
    switch (r.k) {
      case 'vortex': { const ox = sk.self ? p.x : cx, oy = sk.self ? p.y : cy; for (const e of foes(p, ox, oy, v * 1.25 + 1)) if (!isBoss(e)) { const a = Math.atan2(oy - e.y, ox - e.x), d = Math.max(0, Math.hypot(ox - e.x, oy - e.y) - 0.6); for (let i = 0; i < d * 4; i++) { const nx = e.x + Math.cos(a) * 0.25, ny = e.y + Math.sin(a) * 0.25; if (!M.walkable(inst.map, nx, ny)) break; inst.moveTo(e, nx, ny); } if (e.kind === 'p') e.forcePos = true; } fx(p, ox, oy, 'vortex', null, v * 1.25 + 1); break; }
      case 'slowField': W.spawnZone(inst, { zk: 'zone', owner: p, x: cx, y: cy, r: 2.2, until: t + v, tick: 0.5, mult: 0, sk, lv, el, slow: 1, color, zf: 'field' }); break;
      case 'burnField': W.spawnZone(inst, { zk: 'zone', owner: p, x: cx, y: cy, r: 1.9, until: t + v, tick: 0.5, mult: 0.12, sk, lv, el: 'fire', color: '#ff6a2a', zf: 'burn' }); break;
      case 'trail': { const f = p._dashFrom || { x: p.x, y: p.y }; for (let i = 0; i < 4; i++) { const u = (i + 0.5) / 4; W.spawnZone(inst, { zk: 'zone', owner: p, x: f.x + (p.x - f.x) * u, y: f.y + (p.y - f.y) * u, r: 1.1, until: t + 3, tick: 0.5, mult: v / 100 * 0.5 / 6, sk, lv, el, color, trail: 1 }); } break; }
    }
  }
  // class ultimate: every class has its own mechanic (see CLASS_ULT below)
  if (sk.setUlt) {
    const su = sk.setUlt, ox = sk.self ? p.x : cx, oy = sk.self ? p.y : cy, k = ctx.nb;
    inst.emit({ k: 'afx', s: p.id, x: ox, y: oy, fk: 'setult', el: sk.fxEl, r: su.r, sk: sk.id, d: su.dur });
    const f = CLASS_ULT[p.cls];
    if (f) { try { f({ p, inst, ox, oy, R: su.r, M: su.end * k, m: su.mult * k, el, t, lv, tgt: tgt && !tgt.dead ? tgt : null }); } catch (e) { console.error('class ult', p.cls, e); } }
  }
  // class mechanic role of this skill
  const m = mech(p); if (!m) return;
  const c = st(p), role = sk.cmRole, target = tgt && !tgt.dead ? tgt : { x: cx, y: cy };
  if (!m.boostSpend) {
    if (role === 's2') spend(p, 2, target, 1, sk);
    else if (role === 's3') spend(p, 3, target, 1, sk);
    else if (role === 'fin') spend(p, m.max, target, 1.15, sk);
    else if (role === 'fin2') spend(p, m.max, target, 2, sk);
    else if (role === 'over') { c.n = m.max; spend(p, m.max, target, 1.5, sk); }
    else if (role === 'emp' && c.n >= m.max / 2 && PAY[p.cls]) { try { PAY[p.cls](p, Math.ceil(c.n / 2), target, 0.5, sk); } catch (e) { console.error(e); } }
  }
  if (role === 'b1') add(p, 1); else if (role === 'b2') add(p, 2); else if (role === 'g3') add(p, 3); else if (role === 'g4') add(p, 4); else if (role === 'gfull') add(p, m.max);
  else if (role === 'g2') { add(p, 2); for (let i = 1; i <= 4; i++) inst.after(i * 2, () => { if (!p.dead) add(p, 1); }); }
  else if (role === 'shieldfill') { add(p, 2); shield(p, 0.01 * c.n); }
};
// zone ticks carry the skill's debuff riders (not its one-shot effects)
const ZONE_OK = { burn: 1, bleed: 1, toxin: 1, chill: 1, weaken: 1, sunder: 1, blind: 1, mark: 1, leech: 1, mend: 1, guard: 1, timeLock: 1 };
AF.zoneRider = function (p, sk, o, dealt) { const ctx = { t: now(), n: 9 }; const s2 = { id: sk.id, name: sk.name, riders: (sk.riders || []).filter((r) => ZONE_OK[r.k]) }; if (s2.riders.length) AF.afterHit(p, s2, o, dealt, ctx, sk.element); };
// riders on summons / turrets ending
AF.summonEnd = function (p, s, sk) { const v = RK(sk, 'explodeOnEnd'); if (!v || !p.inst || s.inst !== p.inst) return; for (const e of foes(p, s.x, s.y, 2.5)) hit(p, e, v / 100 * 0.5); fx(p, s.x, s.y, 'detonate', null, 2.5); };
AF.reset = (p) => { p.cm = null; st(p); sync(p); };

// Novice Online — pixel-art skill VFX director, built on pixelfx (MIT, https://github.com/patch-gg/pixelfx).
// Every skill gets a "recipe": a chain of pixelfx effects (cast flourish → delivery → impact → aftermath),
// chosen from what the skill actually does (its design, element, shape, weapon, status tags) and recolored
// with a palette ramp unique to that skill. Effects render into small per-instance pixel frames at 30 fps
// and are blitted onto the world with nearest-neighbour scaling, so they stay crisp, chunky pixel art.
(function (root) {
  'use strict';
  const VFX = { ok: false, recipes: {}, live: [], PPT: 24 };
  root.VFX = VFX;
  const PFX = root.PFX;
  if (!PFX || !PFX.effects) return;
  const E = PFX.effects, PAL = PFX.PAL;
  VFX.ok = true;
  const PPT = VFX.PPT; // effect pixels per world tile

  // ------------------------------------------------------------------ colour
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  const hexToRgb = (h) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  function hueOf(c) {
    if (!c) return 0;
    const m = /hsl\(([-\d.]+)/.exec(c); if (m) return +m[1];
    if (c[0] === '#') { const [r, g, b] = hexToRgb(c).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; }
    return 0;
  }
  // pixelfx-style hue-shifted ramp, dark → bright: shadows lean cool, highlights warm toward white
  function hueRamp(h, sat = 0.85, n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const hh = h + (0.5 - u) * 36 + (u > 0.7 ? (u - 0.7) * 40 : 0);
      const s = sat * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      const l = 0.06 + 0.9 * Math.pow(u, 0.95);
      out.push(hslToHex(hh, u > 0.92 ? s * 0.3 : s, u === 1 ? 0.97 : l));
    }
    return out;
  }
  const fitRamp = (r, n) => Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / Math.max(1, n - 1))]);
  const mixRamp = (a, b, t) => { const n = Math.max(a.length, b.length), A = fitRamp(a, n), B = fitRamp(b, n); return A.map((c, i) => mixHex(c, B[i], t)); };
  const EL_PAL = {
    fire: PAL.fire, ice: PAL.ice, lightning: PAL.electric, water: PAL.water, earth: PAL.earth, holy: PAL.holy,
    dark: mixRamp(PAL.shadow, PAL.arcane, 0.55), poison: PAL.poison, blood: PAL.blood, wind: hueRamp(150, 0.45),
  };
  VFX.ramp = hueRamp;
  VFX.hue = hueOf;

  // ------------------------------------------------------------------ hashing
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ------------------------------------------------------------------ effect families by element
  // per element: projectile, impact (single hit), area (radius burst), line, cone, rain (falling), zone (lingering),
  // pull (draw in), bolt (from the sky / column)
  const EL = {
    fire: { proj: ['fire/fireball', 'projectiles/plasma-shot'], impact: ['explosions/small-explosion', 'explosions/plasma-explosion', 'fire/flame-pillar'], area: ['fire/fire-ring', 'explosions/barrel-explosion', 'explosions/plasma-explosion'], line: ['fire/flamethrower', 'fire/fire-breath'], cone: ['fire/fire-breath', 'fire/flamethrower'], rain: ['fire/meteor'], zone: ['fire/fire-ring', 'fire/fire-tornado', 'fire/spirit-flame'], pull: ['fire/fire-tornado'], bolt: ['fire/flame-pillar', 'fire/meteor'], big: ['explosions/big-explosion', 'explosions/nuke'] },
    ice: { proj: ['ice/ice-lance'], impact: ['ice/ice-shatter', 'ice/snowflake-burst', 'ice/freeze'], area: ['ice/frost-nova', 'ice/snowflake-burst'], line: ['ice/ice-spikes'], cone: ['ice/frost-breath', 'ice/ice-spikes'], rain: ['ice/icicle-fall'], zone: ['ice/blizzard-vortex', 'ice/ice-crystal'], pull: ['ice/blizzard-vortex'], bolt: ['ice/icicle-fall', 'ice/ice-crystal'], big: ['ice/frost-nova'] },
    lightning: { proj: ['lightning/ball-lightning', 'projectiles/laser-bolt', 'projectiles/plasma-shot'], impact: ['lightning/zap-hit', 'lightning/spark-arc'], area: ['lightning/thunderclap', 'scifi/emp-blast'], line: ['lightning/chain-lightning'], cone: ['lightning/thunderclap'], rain: ['lightning/lightning-strike'], zone: ['lightning/storm-cloud', 'lightning/tesla-coil', 'lightning/plasma-ball'], pull: ['lightning/plasma-ball'], bolt: ['lightning/lightning-strike'], big: ['lightning/thunderclap', 'scifi/emp-blast'] },
    water: { proj: ['water/water-orb'], impact: ['water/splash'], area: ['water/wave-crash', 'water/geyser'], line: ['water/water-jet'], cone: ['water/wave-crash'], rain: ['water/rain-splash'], zone: ['water/whirlpool', 'water/fountain'], pull: ['water/whirlpool'], bolt: ['water/geyser'], big: ['water/wave-crash'] },
    wind: { proj: ['projectiles/energy-disc'], impact: ['nature/leaf-storm', 'impacts/hit-spark'], area: ['nature/tornado', 'explosions/implosion'], line: ['nature/tornado'], cone: ['nature/leaf-storm', 'nature/tornado'], rain: ['nature/leaf-storm'], zone: ['nature/tornado'], pull: ['nature/tornado'], bolt: ['nature/tornado'], big: ['nature/tornado'] },
    earth: { proj: ['nature/boulder', 'projectiles/cannonball'], impact: ['explosions/dirt-explosion', 'impacts/blunt-hit'], area: ['nature/quake', 'impacts/ground-slam'], line: ['nature/earth-spike', 'nature/thorns'], cone: ['nature/quake'], rain: ['explosions/dirt-explosion'], zone: ['nature/root-snare'], pull: ['nature/root-snare'], bolt: ['nature/earth-spike'], big: ['impacts/ground-slam'] },
    holy: { proj: ['projectiles/magic-missile', 'arcane/arcane-orb'], impact: ['holy/smite', 'holy/feather-burst'], area: ['holy/heal-aoe', 'holy/sunburst', 'holy/feather-burst'], line: ['holy/holy-pillar'], cone: ['holy/sunburst'], rain: ['arcane/star-fall'], zone: ['arcane/rune-circle', 'holy/sunburst'], pull: ['arcane/rune-circle'], bolt: ['holy/holy-pillar', 'holy/smite'], big: ['holy/holy-pillar', 'holy/resurrection'] },
    dark: { proj: ['shadow/void-orb', 'arcane/arcane-orb'], impact: ['shadow/dark-explosion', 'shadow/curse'], area: ['shadow/dark-explosion', 'shadow/shadow-tendrils'], line: ['shadow/soul-drain'], cone: ['shadow/shadow-tendrils'], rain: ['shadow/necro-skulls'], zone: ['shadow/hex-sigil', 'shadow/shadow-flames'], pull: ['shadow/grasping-hands', 'shadow/black-hole'], bolt: ['shadow/grasping-hands'], big: ['shadow/black-hole', 'shadow/eclipse'] },
    poison: { proj: ['projectiles/plasma-shot'], impact: ['nature/acid-splash', 'nature/spore-burst'], area: ['nature/poison-cloud', 'nature/spore-burst'], line: ['nature/thorns', 'nature/vine-whip'], cone: ['nature/poison-cloud'], rain: ['nature/acid-splash'], zone: ['nature/toxic-puddle', 'nature/poison-cloud'], pull: ['nature/vine-whip'], bolt: ['nature/spore-burst'], big: ['nature/poison-cloud'] },
    blood: { proj: ['projectiles/energy-disc'], impact: ['impacts/crit-hit', 'explosions/implosion'], area: ['explosions/implosion', 'impacts/ground-slam'], line: ['melee/whip-crack'], cone: ['melee/heavy-cleave'], rain: ['impacts/crit-hit'], zone: ['shadow/shadow-flames'], pull: ['shadow/grasping-hands'], bolt: ['impacts/crit-hit'], big: ['explosions/implosion'] },
    neutral: { proj: ['projectiles/energy-disc', 'projectiles/magic-missile'], impact: ['impacts/hit-spark', 'impacts/blunt-hit', 'impacts/crit-hit'], area: ['impacts/ground-slam', 'explosions/implosion'], line: ['melee/thrust'], cone: ['melee/spear-sweep'], rain: ['impacts/hit-spark'], zone: ['arcane/rune-circle'], pull: ['scifi/tractor-beam'], bolt: ['impacts/crit-hit'], big: ['impacts/impact-frame'] },
  };
  // weapon swings and shots by class weapon
  const SWING = {
    sword: ['melee/sword-slash', 'melee/double-slash', 'melee/thrust', 'melee/heavy-cleave'],
    spear: ['melee/spear-sweep', 'melee/thrust', 'impacts/shield-block', 'melee/hammer-smash'],
    axe: ['melee/heavy-cleave', 'melee/hammer-smash', 'melee/uppercut'],
    dagger: ['melee/dagger-flurry', 'melee/claw-swipe', 'melee/double-slash', 'melee/thrust'],
    knuckle: ['melee/uppercut', 'impacts/blunt-hit', 'melee/claw-swipe', 'impacts/crit-hit'],
    scythe: ['melee/scythe-reap', 'melee/whip-crack'],
    mace: ['melee/hammer-smash', 'holy/smite'],
    bow: ['melee/whip-crack'], gun: ['melee/thrust'], staff: ['melee/spear-sweep'],
  };
  const SHOT = {
    bow: ['projectiles/arrow'], gun: ['projectiles/bullet-tracer', 'projectiles/plasma-shot', 'projectiles/laser-bolt', 'projectiles/rocket', 'projectiles/homing-missile'],
    staff: null, mace: ['projectiles/magic-missile'], scythe: ['shadow/void-orb', 'arcane/arcane-orb'],
  };
  const MUZZLE = { gun: ['projectiles/muzzle-pistol', 'projectiles/muzzle-shotgun', 'projectiles/muzzle-smg'], staff: ['arcane/spell-charge', 'arcane/magic-circle-cast', 'lightning/charge-up'], mace: ['arcane/spell-charge'], scythe: ['arcane/spell-charge'], bow: null };
  // status tags → looping overlays on the afflicted entity
  const TAG_FX = {
    burn: ['status/burning'], freeze: ['status/frozen'], chill: ['status/slowed', PAL.ice], poison: ['status/poisoned'], bleed: ['status/bleeding'],
    stun: ['status/stunned'], knockdown: ['status/stunned', PAL.dust], curse: ['status/cursed'], slow: ['status/slowed'], fear: ['status/confused', mixRamp(PAL.shadow, PAL.arcane, 0.6)],
    blind: ['status/confused'], silence: ['status/sleep'], shock: ['lightning/electrified'], holybrand: ['holy/halo'], mark: ['status/charmed', PAL.blood], wet: ['water/drip'],
    root: ['nature/root-snare'], armorbreak: ['status/petrified', PAL.metal],
  };
  // the option on each effect that sets its size, for fitting areas, lines and pillars to a skill's numbers
  const SIZE_OPT = {};
  for (const id in E) {
    const o = (E[id].meta && E[id].meta.options) || {};
    for (const k of ['reach', 'length', 'radius', 'height']) if (typeof o[k] === 'number') { SIZE_OPT[id] = k; break; }
  }

  // ------------------------------------------------------------------ recipes
  // a step: { id, at: 'caster'|'target'|'area'|'path'|'self', d (delay s), n (copies), spread (tiles), size (tiles),
  //           aim (rotate toward target), face (mirror toward target), sp (speed), life (cap s), loop (s), pal }
  function build(sk) {
    const cls = D_().CLASSES[sk.cls] || {}, wpn = cls.weapon || 'sword';
    const el = sk.element && EL[sk.element] ? sk.element : 'neutral';
    const F = EL[el], h = hash(sk.id);
    const pick = (list, k = 0) => (list && list.length ? list[(h + k * 7) % list.length] : null);
    const design = String(sk.design || ''), tok = design.split(':')[0] === 'ult' ? 'ult' : design.split('|')[0].split(':')[0];
    const flags = design.split('|');
    const r = sk.radius || 3, len = sk.length || sk.range || 6;
    const tags = (sk.applies || []).map((a) => a.tag);
    const steps = [];
    const ranged = !sk.melee && (sk.range || 0) > 3;
    const swing = (k = 0, extra) => Object.assign({ id: pick(SWING[wpn] || SWING.sword, k), at: 'target', face: 1 }, extra);
    const shot = (k = 0) => {
      const s = SHOT[wpn];
      const id = s ? pick(s, k) : pick(F.proj, k);
      return { id: el !== 'neutral' && wpn !== 'bow' && wpn !== 'gun' && k % 2 === 0 ? pick(F.proj, k) : id, at: 'path', aim: 1 };
    };
    const muzzle = (k = 0) => (MUZZLE[wpn] ? { id: pick(MUZZLE[wpn], k), at: 'caster', face: 1, life: 0.9 } : null);
    const impact = (k = 0, extra) => Object.assign({ id: pick(F.impact, k), at: 'target', life: 1.6, sp: 1.3 }, extra);
    const add = (...s) => s.forEach((x) => x && x.id && steps.push(x));
    if (sk.kind === 'buff') return buildBuff(sk, h);
    if (tok === 'ult') return buildUlt(sk, h, F, el, wpn, pick, swing, shot, impact);
    switch (tok) {
      case 'shot': case 'lance': case 'bolt': case 'pierce': case 'throw': case 'ricochet': case 'grenade': {
        if (tok === 'bolt' && !ranged) { add({ id: pick(F.bolt), at: 'target', size: 3 }, impact(1, { d: 0.25 })); break; }
        if (tok === 'bolt') { add(muzzle(0), { id: pick(F.bolt), at: 'target', d: 0.15, size: 4 }); if (el === 'lightning') add({ id: 'lightning/zap-hit', at: 'target', d: 0.3 }); break; }
        if (tok === 'throw') add({ id: el === 'earth' ? 'nature/boulder' : 'projectiles/cannonball', at: 'caster', face: 1, life: 1.4, sp: 1.6 }, impact(0, { d: 0.4 }));
        else if (tok === 'grenade') add({ id: 'projectiles/cannonball', at: 'caster', face: 1, life: 1.2, sp: 1.8 }, { id: 'explosions/grenade', at: 'target', d: 0.3, sp: 1.6, life: 2.4 });
        else {
          add(muzzle(h % 3), Object.assign(shot(tok === 'lance' ? 1 : 0), { pierce: tok === 'pierce' || flags.includes('pierce') ? 3 : 0 }));
          add(tok === 'ricochet' ? { id: 'impacts/ricochet', at: 'target', d: 0.2, face: 1 } : impact(tok === 'lance' ? 2 : 0, { d: 0.2 }));
          if (tok === 'ricochet') add(Object.assign(shot(1), { at: 'bounce', d: 0.3 }));
        }
        break;
      }
      case 'rain': add(muzzle(1), { id: pick(F.rain.concat(wpn === 'bow' ? ['projectiles/arrow'] : [])), at: 'area', n: Math.min(5, 2 + Math.round(r / 1.5)), spread: r, stagger: 0.12, size: 2, rainDown: 1 }); break;
      case 'quake': add({ id: 'impacts/heavy-landing', at: sk.self ? 'caster' : 'target' }, { id: pick(F.area.concat(['nature/quake', 'impacts/ground-slam'])), at: sk.self ? 'caster' : 'target', size: r, d: 0.08 }); break;
      case 'leap': add({ id: 'arcane/blink-out', at: 'caster', life: 0.7, sp: 1.5 }, { id: 'impacts/heavy-landing', at: 'target', d: 0.25 }, { id: pick(['impacts/ground-slam', 'nature/quake'].concat(F.area)), at: 'target', size: r, d: 0.3 }); break;
      case 'nova': add({ id: pick(MUZZLE.staff), at: 'caster', life: 0.8 }, { id: pick(F.area.concat(F.big)), at: sk.self ? 'caster' : 'target', size: r, d: 0.15 }); break;
      case 'spin': add({ id: 'melee/spin-slash', at: 'caster', size: r }, { id: pick(F.impact), at: 'caster', d: 0.15, life: 1, sp: 1.5 }); break;
      case 'combo': { const n = 2 + (h % 2); for (let i = 0; i < n; i++) add(swing(i, { d: i * 0.16, mirror: i % 2 })); add(impact(2, { d: n * 0.16 })); break; }
      case 'dash': add({ id: 'status/haste', at: 'caster', life: 0.5, follow: 1 }, swing(0, { d: 0.1 }), { id: el === 'neutral' ? 'impacts/hit-spark' : pick(F.impact), at: 'target', d: 0.2, life: 1, sp: 1.4 }); break;
      case 'blink': case 'blinkcast': case 'backstep': add({ id: 'arcane/blink-out', at: 'caster' }, { id: 'arcane/blink-in', at: 'target', d: 0.15 }, tok === 'blinkcast' ? impact(0, { d: 0.3 }) : swing(1, { d: 0.25 })); break;
      case 'wave': add({ id: pick(F.line.concat(F.cone)), at: 'caster', aim: 1, size: len, sp: 1.2 }); break;
      case 'arc': add(sk.melee ? swing(h % 3, { size: r }) : null, { id: pick(F.cone), at: 'caster', aim: 1, size: sk.radius || 4, d: sk.melee ? 0.1 : 0 }); break;
      case 'strike': case 'scythe': add(swing(tok === 'scythe' ? 0 : h % 4), { id: (h & 1) ? 'impacts/crit-hit' : 'impacts/impact-frame', at: 'target', d: 0.12, life: 0.5 }, impact(1, { d: 0.18 })); break;
      case 'zone': case 'trap': add(tok === 'trap' ? { id: pick(['scifi/laser-grid', 'arcane/rune-circle', 'scifi/teleporter-pad']), at: 'target', loop: 3 } : null, { id: pick(F.zone), at: 'target', size: r, loop: 3.2 }); break;
      case 'pull': add({ id: pick(F.pull.concat(['shadow/grasping-hands', 'water/whirlpool', 'scifi/tractor-beam'])), at: 'target', size: r, loop: 1.8 }, impact(0, { d: 0.6 })); break;
      case 'delayed': add({ id: 'arcane/magic-circle-cast', at: 'target', life: 1.2 }, { id: pick(F.bolt.concat(F.impact)), at: 'target', d: 0.9, size: r }); break;
      case 'summon': add({ id: pick(['spawn/summon-rise', 'spawn/spawn-portal', 'arcane/portal']), at: 'target', life: 2.6 }); break;
      default: {
        // fall back on the shape
        if (sk.shape === 'circle') add({ id: pick(F.area), at: sk.self ? 'caster' : 'target', size: r });
        else if (sk.shape === 'line') add({ id: pick(F.line), at: 'caster', aim: 1, size: len });
        else if (sk.shape === 'cone') add({ id: pick(F.cone), at: 'caster', aim: 1, size: r });
        else if (sk.shape === 'chain') add({ id: 'lightning/chain-lightning', at: 'caster', aim: 1, size: len });
        else if (ranged) add(shot(0), impact(0, { d: 0.2 }));
        else add(swing(0), impact(0, { d: 0.1 }));
      }
    }
    // the status a skill inflicts leaves its own mark at the impact
    if (tags.includes('airborne')) add({ id: 'melee/uppercut', at: 'target', d: 0.15, face: 1 });
    if (tags.includes('root') && el !== 'earth') add({ id: 'nature/root-snare', at: 'target', d: 0.2, life: 1.6 });
    if (tags.includes('freeze')) add({ id: 'ice/freeze', at: 'target', d: 0.2 });
    if (tags.includes('knockdown') && tok !== 'quake') add({ id: 'impacts/ground-slam', at: 'target', d: 0.2, size: 1.6, sp: 1.6, life: 1.4 });
    if (sk.shape === 'chain' && tok !== 'default' && tok !== 'ricochet' && (el === 'lightning' || el === 'neutral')) add({ id: 'lightning/chain-lightning', at: 'caster', aim: 1, size: len, d: 0.05 });
    return steps;
  }

  function buildBuff(sk, h) {
    let mods = {}; try { mods = JSON.parse(String(sk.design).slice(5)); } catch (e) {}
    const k = Object.keys(mods);
    const has = (...x) => x.some((q) => k.includes(q));
    const steps = [];
    const self = (id, extra) => steps.push(Object.assign({ id, at: 'caster', follow: 1, loop: 2.4 }, extra));
    if (has('element')) self(mods.element === 'holy' ? 'holy/blessing' : ['fire/spirit-flame', 'lightning/ball-lightning', 'arcane/arcane-orb', 'water/water-orb'][h % 4], { life: 2.4 });
    if (has('defPct', 'dmgReduce', 'blocks', 'spShield')) self(h & 1 ? 'scifi/force-field' : 'holy/divine-shield', { size: 1.4 });
    if (has('mdefPct', 'guardAlly')) self('scifi/force-field', { size: 1.6 });
    if (has('ccImmune', 'ccRes')) self('holy/halo');
    if (has('atkPct', 'dmgPct', 'critDmg', 'hpPct')) self('status/rage');
    if (has('aspdPct', 'movePct', 'flee', 'cdr')) self('status/haste', { loop: 1.6 });
    if (has('lifesteal', 'soulSiphon')) self('shadow/life-steal', { loop: 0, life: 2 });
    if (has('regenPct', 'spRegen', 'str', 'agi')) self('holy/blessing');
    if (has('matkPct', 'castReduce', 'spPct')) self('arcane/rune-circle', { loop: 2.4 });
    if (has('crit', 'hit', 'range')) self('arcane/spell-charge', { loop: 1.6 });
    if (has('summonBuff')) self('shadow/necro-skulls', { loop: 2 });
    if (has('heatSink')) self('lightning/electrified', { loop: 2 });
    if (has('comboWin', 'comboDmg', 'extraStack', 'resGainPct')) self('lightning/charge-up', { loop: 0, life: 2 });
    if (has('dropPct')) self('pickups/loot-beam', { loop: 2 });
    if (!steps.length) self('holy/blessing');
    steps.unshift({ id: (h % 3 === 0) ? 'arcane/mana-burst' : h % 3 === 1 ? 'holy/feather-burst' : 'spawn/respawn-beam', at: 'caster', life: 1.4, sp: 1.3 });
    return steps.slice(0, 4);
  }

  function buildUlt(sk, h, F, el, wpn, pick, swing, shot, impact) {
    const parts = String(sk.design).split(':'), kind = parts[1];
    let o = {}; try { o = JSON.parse(parts.slice(2).join(':')); } catch (e) {}
    const r = o.r || sk.radius || 6;
    const steps = [{ id: 'impacts/impact-frame', at: 'caster', life: 0.22, sp: 1.4 }, { id: pick(['arcane/magic-circle-cast', 'lightning/charge-up', 'arcane/spell-charge']), at: 'caster', life: 0.9, sp: 1.4 }];
    const add = (...s) => s.forEach((x) => x && x.id && steps.push(x));
    switch (kind) {
      case 'nuke': add({ id: pick(F.big.concat(['explosions/big-explosion'])), at: sk.self ? 'caster' : 'target', size: r, d: 0.25, life: 3.2, sp: 1.3 }, { id: pick(F.area), at: sk.self ? 'caster' : 'target', size: r, d: 0.45 }); if (o.leap) steps.splice(1, 0, { id: 'impacts/heavy-landing', at: 'target', d: 0.2 }); break;
      case 'barrage': add({ id: pick(F.rain.concat(F.bolt)), at: 'area', n: 9, spread: Math.min(r, 8), stagger: 0.14, size: 2 }); break;
      case 'blackhole': add({ id: 'shadow/black-hole', at: 'target', size: r, loop: 3 }, { id: 'explosions/implosion', at: 'target', d: 2.2 }); break;
      case 'stackburst': add({ id: 'explosions/implosion', at: 'caster', size: r }, { id: pick(F.area), at: 'caster', d: 0.4, size: r }, { id: 'status/bleeding', at: 'area', n: 4, spread: r * 0.6, d: 0.3 }); break;
      case 'megaline': add({ id: pick(['arcane/arcane-beam', 'water/water-jet', 'fire/flamethrower', 'lightning/chain-lightning']), at: 'caster', aim: 1, size: o.len || 15, life: 1.6 }, { id: 'impacts/hit-spark', at: 'target', d: 0.3 }); break;
      case 'transform': add({ id: 'scifi/warp-in', at: 'caster', d: 0.1 }, { id: 'status/rage', at: 'caster', follow: 1, loop: 3, d: 0.4 }, { id: ({ holy: 'holy/halo', lightning: 'lightning/electrified', dark: 'shadow/shadow-flames', fire: 'fire/spirit-flame', ice: 'ice/blizzard-vortex', water: 'water/water-orb', wind: 'nature/leaf-storm', earth: 'nature/root-snare', poison: 'status/poisoned', blood: 'status/bleeding' })[el] || pick(['holy/halo', 'arcane/arcane-orb', 'scifi/hologram']), at: 'caster', follow: 1, loop: 4, d: 0.5 }); break;
      case 'dome': add({ id: 'scifi/force-field', at: 'caster', size: r || 4, follow: 1, loop: 4 }, { id: 'holy/divine-shield', at: 'caster', follow: 1, loop: 4 }); break;
      case 'saint': case 'revive': add({ id: 'holy/resurrection', at: 'caster' }, { id: 'holy/heal-aoe', at: 'caster', size: 6, d: 0.6 }); break;
      case 'zoneheal': add({ id: 'holy/heal-aoe', at: 'caster', size: o.r || 6 }, { id: 'arcane/rune-circle', at: 'caster', loop: 5 }); break;
      case 'miracle': add({ id: 'holy/sunburst', at: 'caster', loop: 3 }, { id: 'holy/feather-burst', at: 'caster', d: 0.3 }, { id: 'weather/god-rays', at: 'caster', life: 3 }); break;
      case 'summonArmy': add({ id: 'spawn/spawn-portal', at: 'caster' }, { id: o.shape === 'drone' ? 'scifi/warp-in' : 'spawn/summon-rise', at: 'area', n: Math.min(5, o.n || 3), spread: 3, stagger: 0.2 }); break;
      case 'plague': add({ id: 'nature/poison-cloud', at: 'area', n: 5, spread: 6, stagger: 0.15, loop: 3 }, { id: o.tag && o.tag[0] === 'curse' ? 'shadow/hex-sigil' : 'nature/spore-burst', at: 'caster', d: 0.2 }); break;
      case 'execute': add(swing(0), { id: 'impacts/crit-hit', at: 'target', d: 0.15 }, { id: 'spawn/disintegrate', at: 'target', d: 0.35, life: 2 }); break;
      case 'executeSweep': add({ id: 'melee/scythe-reap', at: 'caster', size: r }, { id: 'shadow/soul-drain', at: 'caster', d: 0.4, loop: 1.6 }, { id: 'spawn/soul-rise', at: 'area', n: 4, spread: r * 0.6, d: 0.5 }); break;
      case 'zoneself': case 'zonetarget': add({ id: pick(F.zone), at: kind === 'zoneself' ? 'caster' : 'target', follow: kind === 'zoneself' ? 1 : 0, size: o.r || 4, loop: Math.min(5, o.dur || 5) }, { id: 'arcane/rune-circle', at: kind === 'zoneself' ? 'caster' : 'target', follow: kind === 'zoneself' ? 1 : 0, loop: Math.min(5, o.dur || 5) }); break;
      case 'traps': add({ id: 'scifi/laser-grid', at: 'area', n: 6, spread: 5, stagger: 0.1, loop: 3 }); break;
      case 'delayedAoe': add({ id: 'arcane/magic-circle-cast', at: 'target', life: 1.9 }, { id: 'explosions/big-explosion', at: 'target', d: o.delay || 2, size: o.r || 4, life: 3, sp: 1.3 }); break;
      case 'single': add({ id: 'scifi/scanner', at: 'target', life: o.cast || 1 }, Object.assign(shot(1), { d: (o.cast || 0.4) * 0.9 }), { id: 'impacts/crit-hit', at: 'target', d: (o.cast || 0.4) + 0.1 }, { id: pick(F.big), at: 'target', d: (o.cast || 0.4) + 0.15, life: 2 }); break;
      case 'ricochetUlt': add({ id: 'lightning/chain-lightning', at: 'caster', aim: 1, size: 10 }, { id: 'lightning/lightning-strike', at: 'area', n: 6, spread: 6, stagger: 0.12 }); break;
      default: add({ id: pick(F.big), at: 'caster', size: r });
    }
    return steps;
  }

  // the palette ramp of a skill: its element's material, tinted by the skill's own hue so no two match
  function paletteOf(sk) {
    const c = sk.fx && sk.fx.c, h = hueOf(c && c[0]), h2 = hueOf(c && c[1]);
    const base = EL_PAL[sk.element];
    const own = hueRamp(h, 0.9);
    if (sk.kind === 'buff') return mixRamp(hueRamp(h2, 0.75), own, 0.5);
    if (!base) { const cls = D_().CLASSES[sk.cls]; return mixRamp(hueRamp(hueOf(cls && cls.color), 0.8), own, 0.45); }
    return mixRamp(base, own, 0.22 + ((hash(sk.id) % 10) / 100));
  }

  const D_ = () => root.NO_DATA || {};
  const ACCENT = ['impacts/parry', 'explosions/implosion', 'arcane/mana-burst', 'impacts/hit-flash', 'spawn/poof', 'explosions/cartoon-pow', 'holy/feather-burst', 'arcane/star-fall', 'scifi/emp-blast', 'impacts/shield-block', 'lightning/spark-arc', 'shadow/curse', 'nature/spore-burst', 'water/splash', 'ice/snowflake-burst'];
  // build every recipe once, nudging repeats so no two skills share the same chain of effects
  function compile() {
    const SK = (root.NO_SKILLS && (root.NO_SKILLS.SKILLS || root.NO_SKILLS)) || {};
    const used = new Set();
    for (const id of Object.keys(SK).sort()) {
      const sk = SK[id];
      let steps = build(sk), sig = steps.map((s) => s.id).join('>');
      for (let k = 1; used.has(sig) && k < 6; k++) {
        const alt = build(Object.assign({}, sk, { id: sk.id + '#' + k }));
        const asig = alt.map((s) => s.id).join('>');
        if (!used.has(asig)) { steps = alt; sig = asig; }
      }
      if (used.has(sig)) {
        // still a twin: finish it with an accent of its own (an element burst, a flash, a sigil...) until it differs
        const F = EL[sk.element] || EL.neutral;
        const acc = [].concat(F.impact, F.bolt, F.area, ACCENT).filter((v, i, a) => a.indexOf(v) === i);
        for (let k = 0; k < acc.length; k++) {
          const a = acc[(hash(sk.id) + k) % acc.length], st = steps.concat([{ id: a, at: 'target', d: 0.25, life: 1.2, sp: 1.4, size: Math.min(3, sk.radius || 2) }]);
          const ss = st.map((x) => x.id).join('>');
          if (!used.has(ss)) { steps = st; sig = ss; break; }
        }
      }
      used.add(sig);
      const pal = paletteOf(sk), seed = (hash(sk.id) % 97) + 1;
      VFX.recipes[id] = { steps: steps.filter((s) => E[s.id]), pal, seed, sig };
    }
    VFX.unique = used.size;
  }
  VFX.compile = compile;
  VFX.elPal = (el) => EL_PAL[el];
  try { compile(); } catch (e) { console.warn('VFX compile failed', e); VFX.ok = false; }
  // a short human description of a recipe, for tooltips
  const NICE = (id) => id.split('/')[1].replace(/-/g, ' ');
  VFX.describe = (skId) => { const r = VFX.recipes[skId]; return r ? r.steps.map((s) => NICE(s.id)).filter((v, i, a) => a.indexOf(v) === i).join(' → ') : ''; };
  VFX.swatch = (skId) => (VFX.recipes[skId] ? VFX.recipes[skId].pal : []);

  // ------------------------------------------------------------------ live instances
  const pool = [];
  function canvasFor(w, h) {
    for (let i = 0; i < pool.length; i++) if (pool[i].width === w && pool[i].height === h) return pool.splice(i, 1)[0];
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function cap() { const lo = root.G && G.settings && G.settings.particles === 0, slow = root.G && G.fps && G.fps < 40; return lo ? 12 : slow ? 18 : 28; }

  /**
   * Start an effect at world (x, y) (feet / ground point). o: { pal, seed, flip, angle, size (tiles), d (delay),
   * sp (speed), life (cap s), loop (s for looping effects), follow (entity id), to: {x, y, d} (travel), prio }.
   */
  function spawn(id, x, y, o = {}) {
    const mod = E[id]; if (!mod) return null;
    if (VFX.live.length >= cap()) {
      if (!o.prio) return null;
      const i = VFX.live.findIndex((q) => !q.prio); if (i < 0) return null; release(VFX.live.splice(i, 1)[0]);
    }
    const meta = mod.meta || {};
    const opts = { seed: o.seed || 1 };
    if (o.pal) opts.palette = o.pal;
    if (meta.actor) opts.actor = PFX.stockActor(2);
    let k = 1;
    const sk = SIZE_OPT[id];
    if (o.size && sk) {
      const def = meta.options[sk];
      const want = sk === 'radius' ? o.size * PPT * 0.7 : sk === 'height' ? Math.min(def * 1.3, o.size * PPT * 1.2) : o.size * PPT;
      const v = clamp(want, def * 0.5, def * 2.6);
      opts[sk] = Math.round(v); k = Math.max(1, v / def);
    }
    let [w, h] = meta.size || [128, 128], [ox, oy] = meta.origin || [w / 2, h / 2];
    let angle = o.angle || 0;
    if (Math.abs(angle) > 0.02 || k > 1 || o.flip) {
      // room for growth, mirroring and rotation: the tight box around the effect's corners, scaled about its origin and turned
      const c = Math.cos(angle), sn = Math.sin(angle), fl = o.flip ? -1 : 1;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [cx, cy] of [[-ox, -oy], [w - ox, -oy], [-ox, h - oy], [w - ox, h - oy]]) {
        const lx = cx * k * fl, ly = cy * k, X = lx * c - ly * sn, Y = lx * sn + ly * c;
        x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
      }
      ox = Math.ceil(-x0) + 4; oy = Math.ceil(-y0) + 4; w = Math.ceil(x1 - x0) + 8; h = Math.ceil(y1 - y0) + 8;
    }
    w = Math.min(w, 720); h = Math.min(h, 560); ox = Math.min(ox, w); oy = Math.min(oy, h);
    opts.x = ox; opts.y = oy; opts.flip = !!o.flip; opts.angle = angle;
    const fx = PFX.createFx(mod, opts);
    const cv = canvasFor(w, h);
    const inst = {
      id, fx, frame: PFX.createFrame(w, h), cv, ctx: cv.getContext('2d'), img: null, w, h, ox, oy, x, y,
      delay: o.d || 0, sp: o.sp || 1, age: 0, life: Math.min(o.life || 99, meta.loop ? (o.loop || 1.5) : (meta.duration || 1) / (o.sp || 1)),
      follow: o.follow || 0, to: o.to || null, acc: 1, dirty: true, prio: o.prio || 0, fx0: o.fy || 0,
    };
    inst.img = inst.ctx.createImageData(w, h); inst.u32 = new Uint32Array(inst.img.data.buffer);
    VFX.live.push(inst);
    return inst;
  }
  VFX.spawn = spawn;
  function release(inst) { if (pool.length < 40) pool.push(inst.cv); }

  const dirOpts = (dx, dy, full) => {
    const th = Math.atan2(dy, dx);
    if (!full) return { flip: dx < 0, angle: 0 };
    return Math.cos(th) >= 0 ? { flip: false, angle: th } : { flip: true, angle: th - Math.PI };
  };

  /** Play a skill's recipe for a cast event f: { s, sk, x, y, tx, ty, sh, r, len, self, u }. */
  VFX.cast = function (f) {
    const R = VFX.recipes[f.sk]; if (!R || !R.steps.length) return false;
    const big = !!f.u, G = root.G;
    const dx = f.tx - f.x, dy = f.ty - f.y, dist = Math.hypot(dx, dy) || 0.001;
    const ux = dx / dist, uy = dy / dist;
    const tx = f.sh === 'circle' && f.self ? f.x : f.tx, ty = f.sh === 'circle' && f.self ? f.y : f.ty;
    let n = 0;
    for (const s of R.steps) {
      const base = { pal: s.pal || R.pal, seed: R.seed + n * 13, d: s.d || 0, sp: s.sp || 1, life: s.life, loop: s.loop, size: s.size, prio: big || f.s === (G && G.me) ? 1 : 0 };
      n++;
      const aimed = s.aim ? dirOpts(ux, uy, true) : dirOpts(s.mirror ? -ux : ux, uy, false);
      if (s.at === 'path' || s.at === 'bounce') {
        // a projectile flying from caster to target (and on through, for piercers), or bouncing on from the target
        const sx = s.at === 'bounce' ? f.tx : f.x, sy = (s.at === 'bounce' ? f.ty : f.y) - 0.7;
        const bx = s.at === 'bounce' ? f.tx + Math.cos(R.seed) * 4 : f.tx + ux * (s.pierce || 0), by = (s.at === 'bounce' ? f.ty + Math.sin(R.seed) * 3 : f.ty + uy * (s.pierce || 0)) - 0.7;
        const tdist = Math.hypot(bx - sx, by - sy), dur = clamp(tdist / 26, 0.12, 0.6);
        const ad = dirOpts(bx - sx, by - sy, true);
        if (!(E[s.id].meta || {}).loop) { spawn(s.id, sx, sy + 0.7, Object.assign(base, ad, { size: tdist })); continue; }
        spawn(s.id, sx, sy, Object.assign(base, ad, { to: { x: bx, y: by, d: dur }, life: dur + 0.05, loop: dur + 0.05 }));
        continue;
      }
      if (s.at === 'area') {
        const cnt = (s.n || 3) * (big ? 1 : 1), spr = s.spread || 3;
        for (let i = 0; i < cnt; i++) {
          const a = R.seed * 1.7 + i * 2.399, rr = spr * Math.sqrt((i + 0.5) / cnt);
          spawn(s.id, tx + Math.cos(a) * rr, ty + Math.sin(a) * rr * 0.6, Object.assign({}, base, { d: base.d + i * (s.stagger || 0.1), seed: base.seed + i, size: s.size }));
        }
        continue;
      }
      const atCaster = s.at === 'caster' || s.at === 'self';
      const px = atCaster ? f.x : tx, py = atCaster ? f.y : ty;
      spawn(s.id, px, py, Object.assign(base, s.aim || s.face ? aimed : {}, { follow: s.follow && atCaster ? f.s : 0 }));
    }
    return true;
  };

  // hit sparks, recolored by element; crits get the big crit burst
  const HIT_EL = { fire: 'explosions/plasma-explosion', lightning: 'lightning/zap-hit', ice: 'impacts/hit-spark', water: 'water/splash', earth: 'impacts/blunt-hit', holy: 'impacts/hit-spark', dark: 'impacts/hit-spark', poison: 'nature/acid-splash', blood: 'impacts/hit-spark', wind: 'impacts/hit-spark', neutral: 'impacts/hit-spark' };
  let hitBudget = 0;
  VFX.hit = function (f, src) {
    if (hitBudget > 8) return false;
    hitBudget++;
    const el = f.el || 'neutral', id = f.c ? 'impacts/crit-hit' : HIT_EL[el] || 'impacts/hit-spark';
    const pal = EL_PAL[el] || undefined;
    const dx = src ? f.x - src.x : 1;
    spawn(id, f.x, f.y - (id === 'impacts/hit-spark' || id === 'impacts/crit-hit' ? 0 : 0), { pal, seed: (f.t || 1) % 50 + 1, flip: dx < 0, sp: id.startsWith('explosions') || id.startsWith('water') || id.startsWith('nature') ? 2.2 : 1.2, life: 0.7, prio: f.c ? 1 : 0 });
    return true;
  };
  VFX.one = function (id, x, y, o) { return spawn(id, x, y, o || {}); };

  // status overlays: one looping effect per (entity, tag), kept alive while the tag is on
  const statusLive = new Map();
  VFX.syncStatus = function (ents, tagList, isNear) {
    const seen = new Set();
    if (root.G && G.settings && G.settings.particles === 0) return;
    let budget = 10;
    for (const e of ents) {
      if (!e.tags || (e.dieAt) || !isNear(e)) continue;
      for (const tg of tagList(e)) {
        const def = TAG_FX[tg]; if (!def) continue;
        const key = e.id + ':' + tg; seen.add(key);
        let inst = statusLive.get(key);
        if (inst && VFX.live.includes(inst)) { inst.age = Math.min(inst.age, 0.2); inst.life = 99; continue; }
        if (budget-- <= 0) continue;
        inst = spawn(def[0], e.x, e.y, { pal: def[1], seed: (e.id % 40) + 1, follow: e.id, loop: 99, life: 99 });
        if (inst) { inst.status = 1; statusLive.set(key, inst); }
      }
    }
    for (const [key, inst] of statusLive) if (!seen.has(key)) { inst.fx.stop(); inst.life = Math.min(inst.life, inst.age + 0.3); statusLive.delete(key); }
  };

  // composite(): colour pixels copy straight across (same byte layout as ImageData); only lit pixels need maths
  function fastComposite(f, o32, o8) {
    const C = f.color, L = f.light, n = f.w * f.h;
    for (let i = 0; i < n; i++) {
      const l = L[i] & 0xffffff;
      if (!l) { o32[i] = C[i]; continue; }
      const c = C[i], ca = c >>> 24;
      let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, a = ca;
      const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
      if (a < 255) {
        const pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255));
        if (na > 0) { r = Math.min(255, pr / na); g = Math.min(255, pg / na); b = Math.min(255, pb / na); a = na * 255; }
      } else { r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb); }
      const j = i * 4; o8[j] = r; o8[j + 1] = g; o8[j + 2] = b; o8[j + 3] = a;
    }
  }
  VFX.fastComposite = fastComposite;
  /** Advance and draw every live effect. g is in world-tile space (scaled by TS*zoom). */
  VFX.draw = function (g, dt) {
    hitBudget = Math.max(0, hitBudget - dt * 30);
    const G = root.G, list = VFX.live;
    const slow = !!(G && G.fps && G.fps < 40);
    let budget = slow ? 5 : 10; // re-renders per frame: spreads the pixel work so bursts don't hitch
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.age += dt;
      if (q.age >= q.life + 0.3 || (q.fx.done() && q.age > 0.05)) { list.splice(i, 1); release(q); continue; }
      if (q.age >= q.life && !q.stopped) { q.fx.stop(); q.stopped = 1; }
      q.fx.update(dt * q.sp);
      q.acc += dt;
      if (q.acc >= (q.prio && !slow ? 1 / 20 : 1 / 12)) { q.acc = 0; q.dirty = true; }
      if (G && Math.abs(q.x - G.cam.x) > 26 + q.w / PPT / 2 && Math.abs(q.y - G.cam.y) > 0) { if (!q.follow && !q.to) continue; }
      if (q.dirty && (budget-- > 0 || !q.drawn)) {
        q.drawn = 1;
        PFX.clearFrame(q.frame); q.fx.draw(q.frame);
        fastComposite(q.frame, q.u32, q.img.data);
        q.ctx.putImageData(q.img, 0, 0); q.dirty = false;
      }
      let x = q.x, y = q.y;
      if (q.follow && G) { const e = G.ents.get(q.follow); if (e) { x = q.x = e.x; y = q.y = e.y; } else if (q.status) { q.life = 0; } }
      if (q.to) { const k = clamp(q.age / q.to.d); x = q.x + (q.to.x - q.x) * k; y = q.y + (q.to.y - q.y) * k; }
      g.drawImage(q.cv, x - q.ox / PPT, y - q.oy / PPT, q.w / PPT, q.h / PPT);
    }
    g.imageSmoothingEnabled = sm;
  };
  VFX.clear = function () { for (const q of VFX.live) release(q); VFX.live.length = 0; statusLive.clear(); };
})(typeof window !== 'undefined' ? window : globalThis);

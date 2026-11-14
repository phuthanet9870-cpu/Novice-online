// Novice Online — in-house pixel VFX engine.
// Every skill's effect is designed here, from scratch: projectiles, slashes, rings, pillars, lightning, beams, rains,
// vortices, sigils, spikes, auras, clocks, wings, black holes... Each skill gets a recipe chosen from what it does
// (delivery, element, class, weapon, status) with its own palette and parameters, and no two recipes are the same.
// Effects are drawn into a low-resolution layer (16 px per tile), thresholded with an ordered dither so they read as
// crisp pixel art, then scaled up with nearest-neighbour. Soft light, ground decals, debris, shadows, hit-stop and
// screen shake sit on top for weight.
(function (root) {
  'use strict';
  const VFX = { ok: true, recipes: {}, live: [], PPT: 11 }; // 11 effect pixels per tile: chunky, hand-drawn-sprite sized pixels
  root.VFX = VFX;
  const PPT = VFX.PPT;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const rnd = Math.random;
  const ease = { out: (k) => 1 - (1 - k) * (1 - k), out3: (k) => 1 - Math.pow(1 - k, 3) };
  // abilities whose glyph shows over the caster (the rest show over the target)
  const SELF_RIDERS = new Set(['stack', 'swift', 'cdr', 'mend', 'refund', 'rally', 'immune', 'reflect', 'resetMove', 'amp', 'regen', 'haste', 'lastStand', 'guard', 'fury', 'leech', 'reset', 'overheal', 'invuln', 'empower', 'trail', 'spirit', 'decoy', 'thorns', 'cleanse', 'critUp']);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ------------------------------------------------------------------ colour
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
    if (c[0] === '#') { const [r, g, b] = hexToRgb(c).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; }
    return 0;
  }
  function hueRamp(h, sat = 0.85, n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), hh = h + (0.5 - u) * 34 + (u > 0.7 ? (u - 0.7) * 40 : 0);
      const s = sat * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      out.push(hslToHex(hh, u > 0.92 ? s * 0.3 : s, u === 1 ? 0.97 : 0.07 + 0.88 * u));
    }
    return out;
  }
  const fitRamp = (r, n) => Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / Math.max(1, n - 1))]);
  const mixRamp = (a, b, t) => { const n = Math.max(a.length, b.length), A = fitRamp(a, n), B = fitRamp(b, n); return A.map((c, i) => mixHex(c, B[i], t)); };
  const EL_HUE = { fire: [22, 0.95], ice: [198, 0.8], lightning: [212, 0.85], water: [208, 0.85], earth: [32, 0.55], holy: [46, 0.9], dark: [272, 0.7], poison: [100, 0.8], blood: [352, 0.85], wind: [150, 0.5], neutral: [220, 0.12] };
  const EL_PAL = {}; for (const k in EL_HUE) EL_PAL[k] = hueRamp(EL_HUE[k][0], EL_HUE[k][1]);
  EL_PAL.lightning = ['#0a0f2e', '#172a78', '#2550d0', '#3f8cff', '#7cc8ff', '#c8f0ff', '#eaffff', '#ffffff'];
  EL_PAL.dark = ['#050308', '#140a24', '#2a1248', '#46208a', '#6c3cc8', '#9a6cff', '#cbb0ff', '#f0e6ff'];
  EL_PAL.holy = ['#2a1c08', '#5a3e10', '#9a6c18', '#d8a428', '#ffd24a', '#ffe98a', '#fff6c8', '#ffffff'];
  VFX.ramp = hueRamp; VFX.hue = hueOf; VFX.elPal = (el) => EL_PAL[el];

  // ------------------------------------------------------------------ recipes
  const D_ = () => root.NO_DATA || {};
  // every class has its own projectile, swing and signature motif; every element its own particle shape
  const CLASS_STYLE = {
    blademaster: { proj: 'blade', slash: 'iai', motif: 'swords' }, guardian: { proj: 'spear', slash: 'hammer', motif: 'shield' },
    berserker: { proj: 'axe', slash: 'cleave', motif: 'rage' }, paladin: { proj: 'star', slash: 'hammer', motif: 'cross' },
    pyromancer: { proj: 'orb', slash: 'crescent', motif: 'hellfire' }, cryomancer: { proj: 'shard', slash: 'crescent', motif: 'snow' },
    stormcaller: { proj: 'orb', slash: 'crescent', motif: 'storm' }, necromancer: { proj: 'skull', slash: 'reap', motif: 'skulls' },
    cleric: { proj: 'orb', slash: 'hammer', motif: 'halo' }, druid: { proj: 'leafy', slash: 'claw', motif: 'leaf' },
    assassin: { proj: 'kunai', slash: 'twin', motif: 'smoke' }, shadowdancer: { proj: 'kunai', slash: 'twin', motif: 'void' },
    ranger: { proj: 'arrow', slash: 'thrust', motif: 'leaf' }, marksman: { proj: 'bullet', slash: 'thrust', motif: 'muzzle' },
    engineer: { proj: 'bomb', slash: 'hammer', motif: 'gear' }, monk: { proj: 'fist', slash: 'palm', motif: 'chi' },
    spellblade: { proj: 'blade', slash: 'iai', motif: 'runes' }, beastmaster: { proj: 'spear', slash: 'claw', motif: 'paw' },
    chronomancer: { proj: 'chakram', slash: 'twin', motif: 'clock' }, warlock: { proj: 'fireskull', slash: 'reap', motif: 'skulls' },
    starhunter: { proj: 'star', slash: 'thrust', motif: 'stars' }, darkknight: { proj: 'voidblade', slash: 'cleave', motif: 'void' },
    lightbringer: { proj: 'prism', slash: 'crescent', motif: 'prism' }, shadowmancer: { proj: 'voidblade', slash: 'claw', motif: 'maw' },
    seraph: { proj: 'spear', slash: 'thrust', motif: 'feathers' }, reaper: { proj: 'voidblade', slash: 'reap', motif: 'skulls' },
    demon: { proj: 'fireskull', slash: 'claw', motif: 'hellfire' }, deity: { proj: 'star', slash: 'hammer', motif: 'halo' },
    jester: { proj: 'card', slash: 'twin', motif: 'cards' }, loki: { proj: 'card', slash: 'crescent', motif: 'void' }
  };
  const MELEE_WEAPON = { sword: 1, spear: 1, axe: 1, dagger: 1, knuckle: 1, scythe: 1, mace: 1, claw: 1, katana: 1 };
  const IMPACT = { ember: 'blast', shard: 'shatter', spark: 'zap', smoke: 'implode', feather: 'burst', leaf: 'burst', dust: 'burst', glyph: 'burst', drop: 'splash', tick: 'burst', bubble: 'splash', swirl: 'gust', ringlet: 'burst', twinkle: 'burst' };
  // ---- Chronomancer: every skill is clockwork — dials, time rings, gears, hands, hourglasses, rewinds
  const C_ = (k, at, o) => Object.assign({ k: 'chrono', at, style: k }, o);
  const CHRONO = [
    /*00 Time Bolt      */ () => [C_('dial', 'caster', { dur: 0.35, r: 0.6, up: 1, spin: 6 }), { k: 'proj', at: 'path', style: 'clock', dur: 0.4 }, C_('dial', 'target', { d: 0.3, dur: 0.6, r: 0.8, up: 1, spin: -4, freeze: 1 })],
    /*01 Rewind Lance   */ () => [C_('rewind', 'caster', { dur: 0.45, r: 1 }), C_('hand', 'line', { d: 0.1, dur: 0.45, w: 0.3, back: 1 })],
    /*02 Clock Shards   */ () => [{ k: 'proj', at: 'fan', n: 3, style: 'gear', dur: 0.35 }, C_('gear', 'target', { d: 0.3, dur: 0.5, r: 0.7, teeth: 10 })],
    /*03 Temporal Rift  */ () => [C_('rings', 'target', { d: 0.05, dur: 2.4, r: 2.4, n: 3, flat: 1 }), C_('dial', 'target', { d: 0.05, dur: 2.4, r: 1.1, flat: 1, spin: -1.5 })],
    /*04 Age Strike     */ () => [C_('dial', 'target', { dur: 0.7, r: 1.4, up: 1, drop: 1, spin: 10 }), C_('crack', 'target', { d: 0.45, dur: 0.6, r: 1.4 })],
    /*05 Chrono Chain   */ () => [C_('chain', 'line', { dur: 0.6 }), C_('gear', 'target', { d: 0.25, dur: 0.5, r: 0.6, teeth: 8 })],
    /*06 Second Hand    */ () => [C_('sweep', 'caster', { dur: 0.5, r: 2.4, turns: 1 }), C_('dial', 'caster', { dur: 0.5, r: 2.4, flat: 1, faint: 1 })],
    /*07 Paradox Nova   */ () => [C_('dial', 'caster', { dur: 0.6, r: 2.6, flat: 1, grow: 1, spin: 3 }), C_('rings', 'caster', { d: 0.15, dur: 0.6, r: 2.8, n: 2, flat: 1, grow: 1 })],
    /*08 Time Stop      */ () => [C_('dial', 'target', { dur: 1.4, r: 1.8, up: 1, spin: 0.001, freeze: 1 }), C_('shatterdial', 'target', { d: 1.2, dur: 0.5, r: 1.8 })],
    /*09 Slow Field     */ () => [C_('hourglass', 'target', { dur: 2.6, r: 0.9 }), C_('rings', 'target', { dur: 2.6, r: 3.6, n: 4, flat: 1, slow: 1 })],
    /*10 Epoch Orb      */ () => [{ k: 'proj', at: 'path', style: 'clock', dur: 0.55, big: 1 }, C_('dial', 'target', { d: 0.4, dur: 0.6, r: 1, up: 1, spin: 8, burst: 1 })],
    /*11 Hour Crash     */ () => [C_('dial', 'target', { dur: 0.8, r: 1.9, flat: 1, drop: 1, spin: 2 }), C_('hand', 'target', { d: 0.4, dur: 0.4, r: 1.9, stab: 1 })],
    /*12 Paradox Laser  */ () => [C_('dial', 'caster', { dur: 0.6, r: 0.8, up: 1, spin: 12 }), C_('beam', 'line', { d: 0.15, dur: 0.45, w: 0.35 })],
    /*13 Tick Field     */ () => [C_('ticks', 'target', { dur: 2.4, r: 2.9 }), C_('dial', 'target', { dur: 2.4, r: 0.7, up: 1, spin: 2 })],
    /*14 Eternity Arc   */ () => [C_('chain', 'line', { dur: 0.7, gold: 1 }), C_('rings', 'target', { d: 0.3, dur: 0.5, r: 1, n: 2 })],
    /*15 Haste          */ () => [C_('dial', 'caster', { follow: 1, dur: 1.1, r: 1, up: 1, spin: 14 }), C_('speed', 'caster', { follow: 1, dur: 1.1, r: 1 })],
    /*16 Chrono Shield  */ () => [C_('rings', 'caster', { follow: 1, dur: 1.4, r: 1.3, n: 3, shield: 1 }), C_('dial', 'caster', { follow: 1, dur: 1.4, r: 1.3, flat: 1, faint: 1, spin: 1 })],
    /*17 Time Skip      */ () => [C_('rewind', 'caster', { dur: 0.4, r: 0.9, fwd: 1 }), C_('afterimage', 'line', { dur: 0.5 })],
    /*18 Accelerate     */ () => [C_('gear', 'caster', { follow: 1, dur: 1.1, r: 1.1, teeth: 14, up: 1, pair: 1 }), C_('speed', 'caster', { follow: 1, dur: 1.1, r: 0.9 })],
    /*19 Epoch Focus    */ () => [C_('hourglass', 'caster', { follow: 1, dur: 1.3, r: 0.8, up: 1 }), C_('rings', 'caster', { follow: 1, dur: 1.3, r: 1, n: 1 })],
    /*20 End of Time    */ () => [C_('dial', 'caster', { dur: 1.6, r: 6.5, flat: 1, grow: 1, spin: 6, roman: 1 }), C_('rings', 'caster', { d: 0.2, dur: 1.5, r: 7.2, n: 3, flat: 1, grow: 1 }), C_('dial', 'caster', { d: 0.2, dur: 1.4, r: 1.8, up: 1, spin: 20, roman: 1 })],
    /*21 Tick Requiem   */ () => [C_('dial', 'target', { dur: 1.6, r: 5.4, flat: 1, spin: -2, roman: 1 }), C_('ticks', 'target', { d: 0.1, dur: 1.5, r: 5.6, hammer: 1 })],
    /*22 Eternity Eclipse*/ () => [C_('dial', 'caster', { dur: 1, r: 1.6, up: 1, spin: 4, eclipse: 1, roman: 1 }), C_('beam', 'line', { d: 0.35, dur: 0.7, w: 0.6, eclipse: 1 })],
    /*23 Chrono Apocalypse*/ () => [C_('rain', 'target', { dur: 1.4, r: 2.4, n: 9 }), C_('dial', 'target', { dur: 1.4, r: 2.2, flat: 1, spin: 5, roman: 1 })],
    /*24 End of Time (set)*/ () => [C_('dial', 'target', { dur: 2.2, r: 5.4, flat: 1, spin: -1, roman: 1, grow: 1 }), C_('rings', 'target', { dur: 2.2, r: 6, n: 4, flat: 1 }), C_('hourglass', 'target', { d: 0.2, dur: 2, r: 1.4, up: 1, big: 1 }), C_('shatterdial', 'target', { d: 1.9, dur: 0.5, r: 5.4, flat: 1 })]
  ];
  function build(sk) {
    if (sk.cls === 'chronomancer' && CHRONO[sk.idx]) {
      const steps = CHRONO[sk.idx]().map((x) => Object.assign({}, x));
      for (const r0 of sk.riders || []) steps.push({ k: 'glyph', at: SELF_RIDERS.has(r0.k) ? 'caster' : 'target', d: 0.22, dur: 0.85, r: 1, style: r0.k });
      return steps;
    }
    const cs = CLASS_STYLE[sk.cls] || CLASS_STYLE.blademaster;
    const cls = D_().CLASSES[sk.cls] || {}, wpn = cls.weapon || 'sword';
    const el = sk.element || 'neutral', efx = sk.efx || 'dust', h = hash(sk.id);
    const v = (n, k = 0) => (h >>> (k * 3)) % n;
    const r = sk.radius || 3, len = sk.length || sk.range || 6, big = sk.kind === 'ult' ? 1 : 0;
    const tags = (sk.applies || []).map((a) => a.tag), rk = (sk.riders || []).map((x) => x.k);
    const steps = [];
    const add = (...s) => s.forEach((x) => x && steps.push(x));
    const slashStyle = MELEE_WEAPON[wpn] || sk.melee ? cs.slash : 'crescent';
    const projStyle = cs.proj;
    const impactK = IMPACT[efx] || 'burst';
    const at = sk.self ? 'caster' : 'target';
    const motes = (where, d, n, rr) => ({ k: 'motes', at: where, d: d || 0, dur: 0.7 + v(3) * 0.1, r: rr || 1.2, n: n || 8 + v(6), style: efx });
    const cast = (k = 0) => (sk.dmgType === 'mag' ? { k: 'sigil', at: 'caster', dur: 0.5, r: 1 + v(3, k) * 0.15, style: ['ring', 'hex', 'star', 'square'][v(4, k)] } : null);
    const swing = (extra) => Object.assign({ k: 'slash', at: 'caster', dur: 0.3, r: Math.max(1.5, Math.min(3.4, sk.radius || sk.range || 2)), n: 1, style: slashStyle, big }, extra);
    switch (sk.arch) {
      case 'slash': add(swing({ r: Math.max(1.6, Math.min(3.4, r)) }), { k: impactK, at: 'target', d: 0.1, r: 0.8 + v(3) * 0.15 }); break;
      case 'spin': add({ k: 'slash', at: 'caster', dur: 0.55, r, n: Math.min(5, sk.hits || 2), style: 'spin', big }, { k: 'nova', at: 'caster', d: 0.1, dur: 0.5, r, style: ['soft', 'dashed', 'double'][v(3)] }); break;
      case 'thrust': add(sk.melee ? swing({ style: 'thrust', r: Math.min(4, len * 0.6) }) : null, { k: 'wave', at: 'caster', d: sk.melee ? 0.08 : 0, dur: 0.5, len, w: 0.7 + v(3) * 0.2, style: el }); break;
      case 'beam': add(cast(1), { k: 'beam', at: 'caster', dur: big ? 1.1 : 0.55, len, w: (big ? 1 : 0.45) + v(3) * 0.12, style: cs.motif === 'prism' ? 'prism' : el }); break;
      case 'proj':
        add(cast(0));
        if (sk.volley) add({ k: 'proj', at: 'fan', n: Math.min(7, sk.volley), style: projStyle });
        else add({ k: 'proj', at: 'path', style: projStyle, pierce: sk.pierce ? 2.5 : 0, n: 1, trail: v(3), big });
        add(sk.shape === 'circle' ? { k: 'blast', at: 'target', d: 0.05, r: r } : { k: impactK, at: 'target', d: 0.05, r: 0.9 });
        break;
      case 'nova': add(cast(2), { k: 'nova', at: 'caster', d: 0.08, dur: big ? 0.9 : 0.65, r, style: ['double', 'runic', 'soft', 'dashed', 'crack'][v(5)] }, { k: impactK, at: 'caster', d: 0.1, r: r * 0.45, big }); break;
      case 'ground':
        add(cast(3), { k: 'mark', at: 'target', dur: sk.drop || 0.5, r: Math.min(r, 3) });
        if ((sk.balls || 1) > 1) add({ k: 'rain', at: 'target', d: 0.2, dur: big ? 1.8 : 1.1, r, n: Math.min(30, (sk.balls || 4) * 2 + 4), style: el === 'neutral' || el === 'blood' || el === 'wind' ? projStyle : el });
        else if (el === 'lightning') add({ k: 'bolt', at: 'target', d: sk.drop || 0.4, dur: 0.45, n: 1 + v(3) });
        else add({ k: 'meteor', at: 'target', d: 0.05, dur: (sk.drop || 0.5) + 0.1, r }, { k: el === 'earth' || el === 'neutral' ? 'crater' : impactK, at: 'target', d: (sk.drop || 0.5), r: r * 0.7, big });
        break;
      case 'zone': add(cast(4), { k: 'field', at: 'target', dur: Math.min(8, (sk.zone && sk.zone.dur) || 4), r, style: el, n: 3 + v(4) }); break;
      case 'chain': add(cast(5), { k: 'proj', at: 'path', style: projStyle, n: 1 }, { k: 'bolt', at: 'target', d: 0.15, dur: 0.45, n: Math.min(6, sk.chain || 3), style: el }); break;
      case 'dash': add({ k: 'dash', at: 'line', dur: 0.3 }, swing({ d: 0.16, at: 'target' }), { k: impactK, at: 'target', d: 0.24, r: 0.9 }); break;
      case 'leap': add({ k: 'blink', at: 'caster', dur: 0.35 }, { k: 'crater', at: 'caster', d: 0.3, r: r * 0.6 }, { k: 'nova', at: 'caster', d: 0.3, dur: 0.6, r, style: 'crack' }); break;
      case 'barrage': {
        if (sk.melee) { const n = Math.min(5, 2 + v(3)); for (let i = 0; i < n; i++) add(swing({ d: i * 0.1, flip: i % 2, dur: 0.22, r: 1.8 })); }
        else add({ k: 'proj', at: 'fan', n: Math.min(7, Math.max(3, Math.ceil((sk.hits || 3) / 2))), style: projStyle });
        add({ k: impactK, at: 'target', d: 0.3, r: 0.9 });
        break;
      }
      case 'summon': case 'turret': add({ k: 'portal', at: 'caster', dur: 1.2, r: 1.5, n: (sk.summon && sk.summon.count) || 1 }); break;
      case 'trap': add({ k: 'sigil', at: 'target', dur: 1.2, r: 0.9, style: ['hex', 'square', 'star'][v(3)] }); break;
      case 'buff': {
        const mk = Object.keys(sk.mods || {})[0] || 'atkPct';
        add({ k: 'aura', at: 'caster', follow: 1, dur: 1.4, style: { defPct: 'shell', aspdPct: 'wind', movePct: 'wind', cdr: 'runes', lifesteal: 'blood', crit: 'eye', atkPct: 'flame' }[mk] || 'flame', n: 6 + v(6) });
        add({ k: 'motif', at: 'caster', dur: 0.6, style: cs.motif });
        break;
      }
      case 'shield': add({ k: 'shield', at: 'caster', follow: 1, dur: Math.min(4, (sk.shield && sk.shield.dur) || 3), r: 1 + v(3) * 0.1 }); break;
      case 'heal': add({ k: 'heal', at: 'caster', dur: 1, r: sk.heal && sk.heal.who === 'party' ? 4 : 1.4 }); break;
      case 'blink': add({ k: 'blink', at: 'caster', dur: 0.4 }, { k: 'dash', at: 'line', dur: 0.25 }); break;
      case 'stealth': add({ k: 'poof', at: 'caster', dur: 0.6, r: 1.2 }, { k: 'aura', at: 'caster', follow: 1, dur: 1.2, style: 'void', n: 6 }); break;
      default: add(swing(), { k: impactK, at: 'target', d: 0.1, r: 0.8 });
    }
    // element particles at the point of impact
    if (sk.dmg || sk.zone) add(motes(sk.arch === 'nova' || sk.arch === 'spin' ? 'caster' : 'target', 0.12, null, Math.min(3, r * 0.5)));
    // ultimates: wings, a big seal and screen weight
    if (big) add({ k: 'wings', at: 'caster', dur: 0.9, style: cs.motif }, { k: 'sigil', at: 'caster', dur: 0.9, r: 2.2, style: 'star' });
    if (sk.setUlt) add({ k: 'motif', at: 'caster', dur: 1, style: cs.motif });
    // each skill ability (rider) gets its own accent
    for (const x of rk) switch (x) {
      case 'burn': case 'burnField': add({ k: 'field', at: 'target', d: 0.15, dur: x === 'burnField' ? 2 : 0.9, r: 0.9, style: 'fire', n: 3 }); break;
      case 'chill': add({ k: 'shatter', at: 'target', d: 0.2, r: 0.7, style: 'frost' }); break;
      case 'knockup': add({ k: 'gust', at: 'target', d: 0.15, r: 0.8, style: 'up' }); break;
      case 'vortex': add({ k: 'implode', at: at, d: 0.25, r: 2 }); break;
      case 'bleed': add(Object.assign(motes('target', 0.15, 6, 0.6), { style: 'drop' })); break;
      case 'toxin': add({ k: 'cloud', at: 'target', d: 0.2, dur: 1.2, r: 1.2, style: 'poison' }); break;
      case 'blind': add({ k: 'prismflash', at: 'target', d: 0.1, dur: 0.35, r: 1 }); break;
      case 'fear': add({ k: 'implode', at: 'target', d: 0.2, r: 0.8 }); break;
      case 'mark': case 'starMark': add({ k: 'mark', at: 'target', d: 0.15, dur: 0.9, r: 0.8 }); break;
      case 'execute': add({ k: 'slash', at: 'target', d: 0.25, dur: 0.25, r: 1.2, style: 'iai', n: 1 }); break;
      case 'echo': add({ k: 'nova', at: 'target', d: 0.4, dur: 0.5, r: 1.4, style: 'dashed' }); break;
      case 'splash': add({ k: 'nova', at: 'target', d: 0.1, dur: 0.4, r: 1.9, style: 'soft' }); break;
      case 'stack': case 'fury': add({ k: 'aura', at: 'caster', follow: 1, d: 0.1, dur: 0.7, style: 'rage', n: 5 }); break;
      case 'sunder': add({ k: 'shatter', at: 'target', d: 0.15, r: 0.6 }); break;
      case 'weaken': case 'steal': add({ k: 'implode', at: 'target', d: 0.2, r: 0.6 }); break;
      case 'leech': case 'mend': add({ k: 'heal', at: 'caster', d: 0.3, dur: 0.6, r: 0.8 }); break;
      case 'guard': case 'overheal': add({ k: 'shield', at: 'caster', follow: 1, d: 0.2, dur: 0.8, r: 0.9 }); break;
      case 'slowField': add({ k: 'field', at: 'target', d: 0.2, dur: 2, r: 2, style: 'ice', n: 2 }); break;
      case 'timeLock': add({ k: 'clock', at: 'target', d: 0.1, dur: 0.9, r: 1 }); break;
      case 'trail': add({ k: 'dash', at: 'line', d: 0.05, dur: 0.6 }); break;
      case 'detonate': add({ k: 'mark', at: 'target', d: 0.05, dur: 0.6, r: 0.6 }); break;
      case 'taunt': add({ k: 'nova', at: 'caster', d: 0.05, dur: 0.4, r: 3, style: 'runic' }); break;
      case 'rally': case 'haste': case 'empower': case 'amp': add({ k: 'nova', at: 'caster', d: 0.2, dur: 0.6, r: 4, style: 'soft' }); break;
      case 'invuln': case 'immune': case 'lastStand': add({ k: 'shield', at: 'caster', follow: 1, d: 0.1, dur: 1, r: 1.1 }); break;
      case 'cleanse': case 'purge': add({ k: 'prismflash', at: x === 'purge' ? 'target' : 'caster', d: 0.15, dur: 0.4, r: 1 }); break;
      case 'reflect': case 'thorns': add({ k: 'spikes', at: 'caster', d: 0.1, dur: 0.6, r: 1, n: 6, style: el }); break;
      case 'swift': add({ k: 'gust', at: 'caster', d: 0.05, r: 0.9, style: 'side' }); break;
      case 'backstab': add({ k: 'slash', at: 'target', d: 0.2, dur: 0.22, r: 1, style: 'x', n: 2 }); break;
      case 'pierceUp': add({ k: 'beam', at: 'line', d: 0.1, dur: 0.25, w: 0.12, style: 'needle' }); break;
      case 'critUp': case 'critDmg': add({ k: 'burst', at: 'target', d: 0.12, dur: 0.35, r: 1.1, style: 'star' }); break;
      case 'crush': add({ k: 'crater', at: 'target', d: 0.18, dur: 1, r: 1.2 }); break;
      case 'cdr': case 'reset': add({ k: 'clock', at: 'caster', d: 0.15, dur: 0.6, r: 0.7 }); break;
      case 'refund': add(Object.assign(motes('caster', 0.2, 7, 0.7), { style: 'coin' })); break;
      case 'resetMove': add({ k: 'blink', at: 'caster', d: 0.1, dur: 0.4, r: 0.9 }); break;
      case 'far': case 'near': add({ k: 'mark', at: 'target', d: 0.1, dur: 0.5, r: x === 'far' ? 1.3 : 0.7 }); break;
      case 'decoy': add({ k: 'poof', at: 'caster', d: 0.15, dur: 0.6, r: 1 }); break;
      case 'explodeOnEnd': add({ k: 'blast', at: 'target', d: 0.55, dur: 0.6, r: 1.6 }); break;
      case 'spirit': add(Object.assign(motes('caster', 0.2, 8, 1), { style: 'wisp' })); break;
      case 'shatter': add({ k: 'shatter', at: 'target', d: 0.2, r: 0.9 }); break;
      case 'knockup': break;
    }
    // the ability's own pixel glyph pops over whoever it affects
    for (const x of rk) add({ k: 'glyph', at: SELF_RIDERS.has(x) ? 'caster' : 'target', d: 0.22, dur: 0.85, r: 1, style: x });
    if (tags.includes('freeze')) add({ k: 'shatter', at: 'target', d: 0.2, r: 0.7, style: 'frost' });
    if (tags.includes('root')) add({ k: 'spikes', at: 'target', d: 0.2, dur: 0.8, r: 0.9, n: 5, style: 'vine' });
    if (tags.includes('stun')) add({ k: 'nova', at: 'target', d: 0.15, dur: 0.35, r: 1.1, style: 'soft' });
    return steps;
  }
  // Ashfall element palette (light → dark, 4 colours) stretched into an 8-step pixel ramp
  function paletteOf(sk) {
    const p4 = sk.pal || ['#ffffff', '#e8e8f0', '#a0a8c0', '#5a607a'];
    const d = p4[3], dd = mixHex(d, '#000000', 0.3), ddd = mixHex(d, '#000000', 0.5);
    let ramp = [ddd, dd, d, mixHex(d, p4[2], 0.5), p4[2], p4[1], mixHex(p4[1], p4[0], 0.5), p4[0]];
    const cls = D_().CLASSES[sk.cls];
    if (cls && cls.color) ramp = mixRamp(ramp, hueRamp(hueOf(cls.color), 0.8), sk.kind === 'buff' ? 0.35 : 0.12 + (hash(sk.id) % 9) / 100);
    return ramp;
  }
  const EFX = { fire: 'ember', ice: 'shard', lightning: 'spark', shadow: 'smoke', holy: 'feather', nature: 'leaf', phys: 'dust', arcane: 'glyph', blood: 'drop', time: 'tick', poison: 'bubble', tech: 'spark', wind: 'swirl', chi: 'ringlet', fel: 'ember', star: 'twinkle', dark: 'smoke', light: 'twinkle', umbra: 'smoke', celestial: 'feather', death: 'smoke', infernal: 'ember', divine: 'twinkle', jester: 'glyph', chaos: 'glyph' };
  VFX.efxOf = (el) => EFX[el] || 'dust';
  VFX.palOf = (p4) => paletteOf({ pal: p4, id: 'x' });
  function compile() {
    const SK = (root.NO_SKILLS && (root.NO_SKILLS.SKILLS || root.NO_SKILLS)) || {};
    const used = new Set();
    for (const id of Object.keys(SK).sort()) {
      const sk = SK[id];
      const steps = build(sk);
      // pixel-effect timing: a short charge at the caster first (everything else waits a beat), then the release;
      // area hits leave smoke and embers behind, self skills shed rising sparkles
      const sd = hash(id), ult = sk.kind === 'ult', area = ['ground', 'nova', 'leap', 'zone', 'trap'].includes(sk.arch) || (sk.arch === 'proj' && sk.radius);
      for (const st of steps) st.d = (st.d || 0) + (ult ? 0.16 : 0.08);
      steps.unshift({ k: 'charge', at: 'caster', d: 0, dur: ult ? 0.34 : 0.18, r: ult ? 1.6 : 0.9 + (sd % 4) * 0.1, n: 6 + (sd % 7), style: sd % 2 ? 'cw' : 'ccw' });
      if (area && sk.kind !== 'buff' && sk.cls === 'chronomancer') steps.push({ k: 'motes', at: 'target', d: 0.35, dur: 1.1, r: Math.max(0.7, (sk.radius || 2) * 0.5), n: 10, style: 'tick' });
      else if (area && sk.kind !== 'buff') steps.push({ k: 'smoke', at: 'target', d: (ult ? 0.6 : 0.4), dur: 1.3, r: Math.max(0.8, (sk.radius || 2) * 0.55), n: 4 + (sd % 4) }, { k: 'embers', at: 'target', d: 0.35, dur: 1.1, r: Math.max(0.7, (sk.radius || 2) * 0.6), n: 8 + (sd % 6) });
      else if (sk.kind === 'buff' || sk.arch === 'heal' || sk.arch === 'shield') steps.push({ k: 'embers', at: 'caster', follow: 1, d: 0.2, dur: 1.2, r: 0.7, n: 7 + (sd % 5), style: 'rise' });
      const sig = steps.map((s) => [s.k, s.style || '', s.n || 0, s.at].join(':')).join('>');
      let bump = 0;
      while (used.has(sig + '#' + bump)) bump++;
      used.add(sig + '#' + bump);
      if (bump) for (const s of steps) { s.n = (s.n || 1) + bump; s.var = bump; }
      VFX.recipes[id] = { steps, pal: paletteOf(sk), seed: (hash(id) % 97) + 1, el: sk.element || 'neutral', cls: sk.cls, ult: sk.kind === 'ult', sig: sig + '#' + bump };
    }
    VFX.unique = used.size;
  }
  VFX.compile = compile;
  const KIND_TH = { proj: 'กระสุน', slash: 'ฟัน', nova: 'คลื่นวงแหวน', pillar: 'เสาแสง', bolt: 'สายฟ้าฟาด', beam: 'ลำแสง', cone: 'คลื่นกรวย', rain: 'ฝนถล่ม', blackhole: 'หลุมดำ', sigil: 'วงเวท', field: 'อาณาเขต', spikes: 'หนามผุด', aura: 'ออร่า', shield: 'โล่', wings: 'ปีก', clock: 'นาฬิกาเวลา', meteor: 'อุกกาบาต', chain: 'โซ่', blink: 'วาร์ป', portal: 'ประตูมิติ', wave: 'คลื่น', burst: 'ระเบิดแสง', blast: 'ระเบิดเพลิง', shatter: 'น้ำแข็งแตก', zap: 'ไฟฟ้า', implode: 'ยุบตัว', splash: 'กระเซ็น', crater: 'หลุมยุบ', gust: 'ลมหมุน', mark: 'เป้าหมาย', heal: 'ฮีล', dash: 'พุ่ง', cloud: 'หมอก', motif: 'สัญลักษณ์', prismflash: 'แสงหักเห' };
  VFX.describe = (id) => { const r = VFX.recipes[id]; return r ? r.steps.map((s) => KIND_TH[s.k] || s.k).filter((v, i, a) => a.indexOf(v) === i).join(' → ') : ''; };
  VFX.swatch = (id) => (VFX.recipes[id] ? VFX.recipes[id].pal : []);
  try { compile(); } catch (e) { console.warn('VFX compile failed', e); VFX.ok = false; }

  // ------------------------------------------------------------------ live effects
  const live = VFX.live;
  const cap = () => { const G = root.G; return G && G.fx ? G.fx().cap : 90; };
  function add(e) { if (live.length >= cap()) { const i = live.findIndex((q) => !q.prio); if (i < 0) return null; live.splice(i, 1); } e.t = -(e.d || 0); e.dur = e.dur || 0.5; e.seed = e.seed || ((rnd() * 1e6) | 0) + 1; e.pal = e.pal || EL_PAL.neutral; e.n = e.n || 1; e.r = e.r || 1; e.var = e.var || 0; live.push(e); return e; }
  const dirOf = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

  VFX.cast = function (f) {
    const R = VFX.recipes[f.sk]; if (!R) return false;
    const G = root.G, big = !!f.u, prio = big || (G && f.s === G.me) ? 1 : 0;
    const tx = f.sh === 'circle' && f.self ? f.x : f.tx, ty = f.sh === 'circle' && f.self ? f.y : f.ty;
    const ang = dirOf(f.x, f.y, f.tx, f.ty), dist = Math.hypot(f.tx - f.x, f.ty - f.y);
    let travel = 0;
    if (big) { dim = Math.max(dim, 0.4); hitStop = Math.max(hitStop, 0.06); }
    for (const s of R.steps) {
      const base = { k: s.k, pal: R.pal, el: R.el, style: s.style, n: s.n || 1, r: s.r || 1, dur: s.dur, d: s.d || 0, big: s.big || big, prio, ang, flip: s.flip, len: s.len, w: s.w, cls: R.cls, var: s.var || 0 };
      if (s.k === 'chrono') for (const kk of ['up', 'spin', 'flat', 'freeze', 'drop', 'grow', 'faint', 'roman', 'eclipse', 'burst', 'teeth', 'pair', 'stab', 'back', 'fwd', 'turns', 'shield', 'slow', 'hammer', 'gold']) if (s[kk] !== undefined) base[kk] = s[kk];
      if (s.at === 'return') { const dur = clamp(dist / 22, 0.1, 0.5); add(Object.assign({}, base, { k: 'proj', x: f.tx, y: f.ty, tx: f.x, ty: f.y, dur, ang: ang + Math.PI })); continue; }
      if (s.at === 'path' || s.at === 'bounce' || s.at === 'fan') {
        const n = s.at === 'fan' ? s.n : 1;
        for (let i = 0; i < n; i++) {
          const spread = s.at === 'fan' ? (i - (n - 1) / 2) * 0.22 : 0;
          const sx = s.at === 'bounce' ? f.tx : f.x, sy = s.at === 'bounce' ? f.ty : f.y;
          const a2 = s.at === 'bounce' ? R.seed : ang + spread, dd = s.at === 'bounce' ? 3.5 : dist + (s.pierce || 0);
          const ex = sx + Math.cos(a2) * dd, ey = sy + Math.sin(a2) * dd;
          const dur = clamp(dd / 22, 0.1, 0.5);
          if (s.at === 'path') travel = Math.max(travel, base.d + dur * (dist / Math.max(0.1, dd)));
          const copies = s.at === 'path' ? Math.min(3, s.n || 1) : 1;
          for (let m = 0; m < copies; m++) add(Object.assign({}, base, { k: 'proj', x: sx, y: sy, tx: ex, ty: ey, dur, d: base.d + m * 0.07 + i * 0.03, arc: s.arc, trail: s.trail || 0, ang: a2 }));
        }
        continue;
      }
      if (s.at === 'area') {
        const cnt = s.n || 3;
        for (let i = 0; i < cnt; i++) { const a = R.seed + i * 2.399, rr = (s.r > 2 ? s.r : 4) * Math.sqrt((i + 0.5) / cnt); add(Object.assign({}, base, { x: tx + Math.cos(a) * rr, y: ty + Math.sin(a) * rr * 0.6, d: base.d + i * 0.12, n: 1 })); }
        continue;
      }
      if (s.at === 'line') { add(Object.assign({}, base, { x: f.x, y: f.y, tx: f.tx, ty: f.ty })); continue; }
      const atC = s.at === 'caster';
      add(Object.assign({}, base, { x: atC ? f.x : tx, y: atC ? f.y : ty, tx: f.tx, ty: f.ty, follow: s.follow && atC ? f.s : 0 }));
    }
    return travel;
  };
  const HIT_DEB = { fire: 'ember', lightning: 'spark', ice: 'ice', water: 'drop', earth: 'rock', holy: 'mote', dark: 'shade', poison: 'drop', blood: 'drop', wind: 'dust', neutral: 'spark' };
  let hitBudget = 0;
  VFX.hit = function (f, src) {
    const el = f.el || 'neutral';
    VFX.spray(HIT_DEB[el] || 'spark', f.x, f.y - 0.5, f.c ? 9 : 3, el === 'blood' ? '#c81e32' : null);
    if (hitBudget > 10) return true; hitBudget++;
    const R = f.sk && VFX.recipes[f.sk];
    add({ k: 'impact', x: f.x, y: f.y, pal: R ? R.pal : EL_PAL[el], el, dur: f.c ? 0.32 : 0.22, r: f.c ? 1.1 : 0.7, crit: !!f.c, ang: src ? dirOf(src.x, src.y, f.x, f.y) : 0, noLight: !f.c });
    if (f.c) hitStop = Math.max(hitStop, 0.045);
    return true;
  };
  let basicBudget = 0;
  VFX.basic = function (f, weapon, ranged, el) {
    if (basicBudget > 6) return false; basicBudget++;
    const pal = EL_PAL[el] || EL_PAL.neutral, ang = dirOf(f.x, f.y, f.tx, f.ty), d = Math.hypot(f.tx - f.x, f.ty - f.y);
    if (ranged) {
      const style = { bow: 'arrow', gun: 'bullet', staff: 'orb', mace: 'orb', scythe: 'skull', chakram: 'chakram', orb: 'star', prism: 'prism' }[weapon] || 'orb';
      const dur = clamp(d / 24, 0.08, 0.4);
      add({ k: 'proj', x: f.x, y: f.y, tx: f.tx, ty: f.ty, dur, pal, el, style, ang, small: 1 });
      return dur;
    }
    const style = { sword: 'crescent', spear: 'cleave', axe: 'cleave', dagger: 'twin', knuckle: 'twin', scythe: 'reap', mace: 'crescent', claw: 'claw', katana: 'crescent' }[weapon] || 'crescent'; // close range = a sword-like slash
    add({ k: 'slash', x: f.x, y: f.y, tx: f.tx, ty: f.ty, dur: 0.2, r: Math.max(1.2, Math.min(2, d)), style, pal: mixRamp(pal, EL_PAL.neutral, 0.4), ang, small: 1, noLight: 1 });
    return 0;
  };
  VFX.one = function (name, x, y, o = {}) {
    const pal = o.pal || EL_PAL[o.el || 'neutral'];
    switch (name) {
      case 'death': return add({ k: 'poof', x, y, dur: 0.6, r: o.r || 0.9, noLight: 1 });
      case 'levelup': add({ k: 'nova', x, y, dur: 0.9, r: 3, style: 'double', pal: EL_PAL.holy, prio: 1 }); return add({ k: 'aura', x, y, follow: o.follow, dur: 1.4, style: 'halo', n: 14, pal: EL_PAL.holy, prio: 1 });
      case 'boom': return add({ k: 'blast', x, y, r: o.r || 2, pal, el: o.el, big: 1 });
      case 'react': return add({ k: 'burst', x, y, r: 2, pal, big: 1, prio: 1 });
      case 'heal': return add({ k: 'heal', x, y, follow: o.follow, dur: 0.9, r: 1, pal: ['#08201a', '#0f3f2c', '#17663e', '#24924e', '#3ec46a', '#7ae89a', '#c4ffd0', '#ffffff'] });
      case 'trait': return add({ k: 'burst', x, y, r: 0.9, pal, dur: 0.4 });
      case 'zap': return add({ k: 'chainbolt', x, y, tx: o.tx, ty: o.ty, dur: 0.35, pal: EL_PAL.lightning });
      case 'dash': return add({ k: 'dash', x, y, tx: o.tx, ty: o.ty, dur: 0.3, noLight: 1 });
      case 'afx': {
        const R = o.sk && VFX.recipes[o.sk], P2 = R ? R.pal : o.pal || pal, r = o.r || 1.5, fk = o.fk, efx = o.efx || 'dust';
        switch (fk) {
          case 'setult': add({ k: 'sigil', x, y, dur: o.d || 5, r, style: 'star', pal: P2, prio: 1 }); return add({ k: 'field', x, y, dur: o.d || 5, r, style: o.el, pal: P2, n: 6, prio: 1 });
          case 'strike': add({ k: 'meteor', x, y, dur: 0.35, r: 1, pal: P2 }); return add({ k: 'motes', x, y, d: 0.3, dur: 0.6, r: 1, n: 8, style: efx, pal: P2 });
          case 'collapse': add({ k: 'implode', x, y, r, pal: P2, big: 1, prio: 1 }); add({ k: 'blast', x, y, d: 0.35, r, pal: P2, big: 1, prio: 1 }); return add({ k: 'nova', x, y, d: 0.35, dur: 0.8, r: r * 1.2, style: 'double', pal: P2, prio: 1 });
          case 'spiritarrow': case 'prism': return add({ k: 'beam', x, y, tx: o.tx, ty: o.ty, ang: Math.atan2(o.ty - y, o.tx - x), len: Math.hypot(o.tx - x, o.ty - y), dur: 0.35, w: 0.35, style: fk === 'prism' ? 'prism' : 'wind', pal: P2 });
          case 'minewarn': return add({ k: 'mark', x, y, dur: 0.5, r: 1, pal: P2 });
          case 'overheat': case 'harvest': case 'bladering': case 'demonform': add({ k: 'nova', x, y, dur: 0.6, r, style: 'double', pal: P2, big: 1 }); return add({ k: 'motes', x, y, dur: 0.8, r, n: 14, style: efx, pal: P2 });
          case 'starfall': return add({ k: 'meteor', x, y, dur: 0.3, r, pal: P2 });
          case 'vortex': return add({ k: 'implode', x, y, r, pal: P2 });
          case 'decoy': case 'decoyboom': return add({ k: 'poof', x, y, dur: 0.6, r: 1.2 });
          case 'bulwark': case 'blessing': return add({ k: 'shield', x, y, follow: o.s, dur: 0.9, r: 1.1, pal: P2 });
          case 'roots': return add({ k: 'spikes', x, y, dur: 0.8, r: 1.6, n: 7, style: 'vine', pal: P2 });
          case 'chiflare': return add({ k: 'aura', x, y, follow: o.s, dur: 0.8, style: 'halo', n: 8, pal: P2 });
          default: add({ k: 'burst', x, y, r: Math.min(2, r), pal: P2, dur: 0.4 }); return add({ k: 'motes', x, y, dur: 0.6, r: Math.min(2.5, r), n: 10, style: efx, pal: P2 });
        }
      }
      case 'echo': add({ k: 'nova', x, y, dur: 0.45, r: 1.8, style: 'dashed', pal }); return add({ k: 'burst', x, y, r: 1.1, pal, dur: 0.35 });
      case 'split': return add({ k: 'chainbolt', x, y, tx: o.tx, ty: o.ty, dur: 0.3, pal });
    }
    return null;
  };

  // persistent mechanic zones sent by the server (orbiting orbs, elemental walls, dash trails)
  const zoneLive = new Map();
  VFX.syncZones = function (ents) {
    const seen = new Set();
    for (const e of ents) {
      if (e.k !== 'z' || !e.zf) continue;
      seen.add(e.id);
      if (zoneLive.has(e.id) && live.includes(zoneLive.get(e.id))) continue;
      const pal = EL_PAL[e.el] || EL_PAL.neutral;
      const q = add({ k: e.zf + 'fx', x: e.x, y: e.y, follow: e.id, dur: Math.max(0.5, (e.until || 40) / 10), r: e.r || 1, n: e.n || 3, pal, el: e.el, noLight: 1 });
      if (q) zoneLive.set(e.id, q);
    }
    for (const [id, q] of zoneLive) if (!seen.has(id)) { q.dur = Math.min(q.dur, Math.max(0, q.t) + 0.2); zoneLive.delete(id); }
  };
  // ------------------------------------------------------------------ status overlays (one per entity+tag)
  const statusLive = new Map();
  const TAG_K = { burn: 'fire', freeze: 'ice', chill: 'ice', poison: 'poison', bleed: 'blood', stun: 'stars', knockdown: 'stars', curse: 'curse', slow: 'slow', fear: 'curse', blind: 'blind', silence: 'silence', shock: 'shock', holybrand: 'halo', mark: 'mark', wet: 'wet', root: 'root', armorbreak: 'crack' };
  VFX.syncStatus = function (ents, tagList, isNear) {
    const seen = new Set();
    if (root.G && G.settings && G.settings.particles === 0) return;
    for (const e of ents) {
      if (!e.tags || e.dieAt || !isNear(e)) continue;
      for (const tg of tagList(e)) {
        const st = TAG_K[tg]; if (!st) continue;
        const key = e.id + ':' + tg; seen.add(key);
        const q = statusLive.get(key);
        if (q && live.includes(q)) continue;
        const nq = add({ k: 'status', style: st, x: e.x, y: e.y, follow: e.id, dur: 9999, size: e.sz || 1, noLight: 1 });
        if (nq) statusLive.set(key, nq);
      }
    }
    for (const [key, q] of statusLive) if (!seen.has(key)) { q.dur = Math.min(q.dur, q.t + 0.25); statusLive.delete(key); }
  };

  // ------------------------------------------------------------------ light, decals, debris, impact feel
  let hitStop = 0, dim = 0;
  VFX.hitStop = (s) => { hitStop = Math.max(hitStop, s); };
  VFX.dim = (v) => { dim = Math.max(dim, v); };
  const LIGHT_K = { proj: 0.5, blast: 0.9, pillar: 0.9, bolt: 1, chainbolt: 0.8, zap: 0.6, burst: 0.6, nova: 0.35, beam: 0.8, cone: 0.5, rain: 0.4, field: 0.4, aura: 0.3, heal: 0.4, meteor: 0.9, prismflash: 0.6, wings: 0.5, sigil: 0.3, impact: 0.4, portal: 0.4, spikes: 0.25, shatter: 0.4 };
  const DECAL_OF = { fire: 'scorch', lightning: 'burn', earth: 'crack', ice: 'frost', holy: 'glyph', dark: 'void', poison: 'acid', water: 'wet', blood: 'crack', neutral: 'crack', wind: null };
  const decals = [], debris = [];
  VFX.decal = function (type, x, y, r) {
    if (!type || (root.G && G.settings && G.settings.particles === 0) || typeof document === 'undefined') return;
    r = Math.max(0.6, Math.min(7, r));
    const W = Math.ceil(r * 24), H = Math.ceil(r * 13), c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data, cx = W / 2, cy = H / 2;
    const C = { scorch: [24, 16, 14], burn: [20, 22, 40], crack: [30, 24, 18], frost: [190, 230, 255], glyph: [255, 225, 140], void: [40, 10, 60], acid: [90, 190, 40], wet: [20, 50, 90] }[type];
    const seed = rnd() * 100, noise = (a, b) => Math.abs((Math.sin(a * 12.9898 + b * 78.233 + seed) * 43758.5453) % 1);
    const rays = Array.from({ length: 7 }, () => rnd() * TAU);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const dx = (i - cx) / (W / 2), dy = (j - cy) / (H / 2), dd = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const edge = 0.78 + 0.22 * noise(Math.round(ang * 6), 1);
      let a = 0, col = C;
      if (type === 'crack' || type === 'burn') {
        for (const ra of rays) { const da = Math.abs(((ang - ra + 3 * Math.PI) % TAU) - Math.PI); if (da < 0.09 * (1 - dd) + 0.02 && dd < edge) a = Math.max(a, 0.75 * (1 - dd)); }
        if (dd < 0.32 * edge) a = Math.max(a, 0.45);
        if (type === 'burn' && a > 0 && noise(i, j) > 0.85) col = [140, 190, 255];
      } else if (type === 'glyph') {
        if (Math.abs(dd - 0.82) < 0.06 || Math.abs(dd - 0.62) < 0.035) a = 0.55;
      } else if (dd < edge) {
        a = (type === 'frost' ? 0.42 : type === 'acid' ? 0.5 : type === 'wet' ? 0.35 : 0.62) * Math.min(1, (edge - dd) * 4) * (0.75 + 0.25 * noise(i >> 1, j >> 1));
        if (type === 'scorch' && dd < edge * 0.9 && noise(i, j) > 0.93) { col = [255, 140, 40]; a = 0.9; }
        if (type === 'frost' && noise(i, j) > 0.9) { col = [255, 255, 255]; a = 0.8; }
      }
      if (a <= 0.02) continue;
      const k = (j * W + i) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = Math.round(a * 255);
    }
    g.putImageData(im, 0, 0);
    decals.push({ cv: c, x, y, w: W / 12, h: H / 12, t0: performance.now() / 1000, life: type === 'glyph' ? 3 : 7 });
    if (decals.length > 36) decals.shift();
  };
  const DEB = {
    rock: { c: ['#6e5a40', '#927a58', '#4f3f2c', '#b89f78'], g: 26, up: [5, 9], sp: [2, 6], life: [0.8, 1.4], bounce: 0.35, s: 2 },
    dust: { c: ['#b8a888', '#d8c8a8', '#988870'], g: -1.5, up: [0.5, 2], sp: [1, 3], life: [0.6, 1.1], s: 3, fade: 1 },
    ember: { c: ['#ffd25a', '#ff8c2a', '#ff5a1a'], g: -3, up: [2, 5], sp: [1, 4], life: [0.7, 1.5], s: 1, glow: 1 },
    spark: { c: ['#ffffff', '#fff3a0', '#ffd25a'], g: 18, up: [2, 6], sp: [5, 11], life: [0.15, 0.35], s: 1, glow: 1, streak: 1 },
    ice: { c: ['#dff6ff', '#9bdcff', '#58b4ec'], g: 24, up: [4, 8], sp: [2, 6], life: [0.6, 1.1], bounce: 0.3, s: 2 },
    mote: { c: ['#fff8d6', '#ffe27a', '#ffffff'], g: -2.5, up: [1, 3], sp: [0.5, 2], life: [0.8, 1.6], s: 1, glow: 1 },
    shade: { c: ['#8a5aff', '#4a2a8a', '#c8a0ff'], g: -1.5, up: [0.5, 2], sp: [1, 3], life: [0.7, 1.3], s: 2, fade: 1 },
    drop: { c: ['#78ccf4', '#36a2e0', '#c4ecff'], g: 24, up: [3, 7], sp: [1.5, 4], life: [0.5, 0.9], s: 1 }
  };
  VFX.spray = function (type, x, y, n, tint) {
    const t = DEB[type]; if (!t) return;
    if (root.G && G.fx) n = Math.max(1, Math.round(n * G.fx().part));
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, v = t.sp[0] + rnd() * (t.sp[1] - t.sp[0]);
      debris.push({ x, y, z: 0.25 + rnd() * 0.5, vx: Math.cos(a) * v * 0.25, vy: Math.sin(a) * v * 0.14, vz: t.up[0] + rnd() * (t.up[1] - t.up[0]), t, c: tint && rnd() < 0.4 ? tint : t.c[(rnd() * t.c.length) | 0], life: t.life[0] + rnd() * (t.life[1] - t.life[0]), age: 0 });
    }
    if (debris.length > 500) debris.splice(0, debris.length - 500);
  };
  const HEAVY = { blast: 1, crater: 1, pillar: 1, meteor: 1, shatter: 1, implode: 1, bolt: 1 };
  function landed(e) {
    const G = root.G;
    if (HEAVY[e.k] || (e.k === 'nova' && e.r >= 3)) {
      if (G && !(G.settings && G.settings.shake === false)) G.shake = Math.max(G.shake || 0, Math.min(14, 2 + e.r * (e.big ? 2 : 0.9)));
      if (e.big) hitStop = Math.max(hitStop, 0.07);
      VFX.decal(DECAL_OF[e.el || 'neutral'], e.x, e.y, Math.min(5, e.r * 0.8 + 0.5));
      VFX.spray(e.k === 'crater' ? 'rock' : HIT_DEB[e.el || 'neutral'], e.x, e.y - 0.2, Math.round(Math.min(36, 8 + e.r * 4) * (e.big ? 1.5 : 1)), e.el === 'blood' ? '#c81e32' : null);
      if (e.k === 'crater' || e.el === 'earth') VFX.spray('dust', e.x, e.y, 8);
    }
  }

  // ------------------------------------------------------------------ the pixel layer
  let layer = null, lg = null, LW = 0, LH = 0, view = null, bloom = null, bgc = null;
  VFX.setView = (v) => { view = v; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  function ensureLayer(w, h) {
    if (!layer) { layer = document.createElement('canvas'); lg = layer.getContext('2d', { willReadFrequently: true }); }
    if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; }
    LW = w; LH = h;
  }
  // threshold alpha with an ordered dither: crisp pixel edges, dithered translucency
  // pixel-sprite finish (pixelfx-style look, own implementation):
  //  1. alpha → on/off with an ordered dither (no soft edges)
  //  2. every pixel snapped to the nearest colour of the palettes on screen (no anti-aliasing blends, limited ramps)
  //  3. a 1-pixel dark outline around every shape, tinted from the colour it borders
  let snapCols = [], snapCache = new Map();
  function setPalettes(list) {
    const seen = new Set(), cols = [];
    for (const pal of list) for (const c of pal || []) if (c && c[0] === '#' && !seen.has(c)) { seen.add(c); cols.push(hexToRgb(c)); }
    const key = [...seen].join(''); if (key !== setPalettes.key) { setPalettes.key = key; snapCols = cols; snapCache = new Map(); }
  }
  function snap(r, g, b) {
    const k = (r << 16) | (g << 8) | b; let v = snapCache.get(k); if (v !== undefined) return v;
    let best = 0, bd = 1e9;
    for (let i = 0; i < snapCols.length; i++) { const c = snapCols[i], dr = c[0] - r, dg = c[1] - g, db = c[2] - b, d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; best = i; } }
    v = snapCols.length ? (snapCols[best][0] << 16) | (snapCols[best][1] << 8) | snapCols[best][2] : k;
    if (snapCache.size < 50000) snapCache.set(k, v); return v;
  }
  function crisp() {
    const im = lg.getImageData(0, 0, LW, LH), d = im.data;
    // solid sprite pixels: faint pixels drop out, the rest become opaque and fade by stepping down the colour ramp
    // (a dimmer pixel takes a darker colour) instead of turning see-through — only the very edge keeps a light dither
    for (let y = 0, i = 0; y < LH; y++) { const row = (y & 3) << 2; for (let x = 0; x < LW; x++, i += 4) {
      const a = d[i + 3]; if (!a) continue; const k = a / 255;
      if (k < 0.16 || (k < 0.3 && k / 0.3 < BAYER[row | (x & 3)])) { d[i + 3] = 0; continue; }
      if (k < 0.97) { const m = 0.42 + 0.58 * k; d[i] *= m; d[i + 1] *= m; d[i + 2] *= m; }
      d[i + 3] = 255;
    } }
    const quality = root.G && G.fx ? G.settings.fxq : 'high';
    if (snapCols.length && quality !== 'low') {
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const v = snap(d[i], d[i + 1], d[i + 2]); d[i] = v >> 16; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255; }
    }
    if (quality !== 'low') {
      // outline: transparent pixels touching a lit pixel become a dark rim of that colour
      const W4 = LW * 4, src = new Uint8ClampedArray(d);
      for (let y = 1; y < LH - 1; y++) for (let x = 1, i = (y * LW + 1) * 4; x < LW - 1; x++, i += 4) {
        if (src[i + 3]) continue;
        const n = src[i - 4 + 3] ? i - 4 : src[i + 4 + 3] ? i + 4 : src[i - W4 + 3] ? i - W4 : src[i + W4 + 3] ? i + W4 : -1;
        if (n < 0) continue;
        d[i] = src[n] * 0.28; d[i + 1] = src[n + 1] * 0.22; d[i + 2] = src[n + 2] * 0.3 + 12; d[i + 3] = 200;
      }
    }
    lg.putImageData(im, 0, 0);
    if (quality !== 'low') pixelLight(d);
  }
  // pixel light: every bright pixel throws a stepped halo (2 rings) onto the empty pixels around it — the glow stays
  // made of pixels instead of a soft blur
  let lightCv = null, lightCtx = null, lightOn = false;
  function pixelLight(d) {
    const n = LW * LH, R = new Float32Array(n), Gc = new Float32Array(n), B = new Float32Array(n);
    let any = false;
    for (let y = 2; y < LH - 2; y++) for (let x = 2; x < LW - 2; x++) {
      const i = y * LW + x, j = i * 4; if (!d[j + 3]) continue;
      const lum = d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11; if (lum < 175) continue;
      any = true;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const m = Math.abs(dx) + Math.abs(dy); if (!m || m > 2) continue; const w = m === 1 ? 0.5 : 0.22, q = i + dy * LW + dx; R[q] += d[j] * w; Gc[q] += d[j + 1] * w; B[q] += d[j + 2] * w; }
    }
    lightOn = any; if (!any) return;
    if (!lightCv) { lightCv = document.createElement('canvas'); lightCtx = lightCv.getContext('2d'); }
    if (lightCv.width !== LW || lightCv.height !== LH) { lightCv.width = LW; lightCv.height = LH; }
    const im = lightCtx.createImageData(LW, LH), o = im.data;
    for (let i = 0; i < n; i++) {
      const mx = Math.max(R[i], Gc[i], B[i]); if (mx < 14 || d[i * 4 + 3]) continue;
      const a = mx > 160 ? 0.55 : mx > 80 ? 0.32 : 0.16, k = 255 / mx; // three light steps
      o[i * 4] = Math.min(255, R[i] * k); o[i * 4 + 1] = Math.min(255, Gc[i] * k); o[i * 4 + 2] = Math.min(255, B[i] * k); o[i * 4 + 3] = a * 255;
    }
    lightCtx.putImageData(im, 0, 0);
  }
  const FLOOR = 0.55;
  const P = {};
  P.col = (pal, i) => pal[clamp(Math.round(i), 0, pal.length - 1)];
  P.ellipse = (g, x, y, rx, ry, c, a = 1) => { g.globalAlpha = clamp(a); g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); g.fill(); };
  P.ring = (g, x, y, rx, ry, w, c, a = 1, a0 = 0, a1 = TAU) => { g.globalAlpha = clamp(a); g.strokeStyle = c; g.lineWidth = Math.max(0.01, w); g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, a0, a1); g.stroke(); };
  P.line = (g, x0, y0, x1, y1, w, c, a = 1) => { g.globalAlpha = clamp(a); g.strokeStyle = c; g.lineWidth = Math.max(0.01, w); g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  P.star = (g, x, y, r, c, a = 1, rot = 0) => { if (r <= 0) return; g.globalAlpha = clamp(a); g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r, an = rot + (i / 8) * TAU; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.closePath(); g.fill(); };
  P.crescent = (g, x, y, r, a0, a1, w, c, a = 1) => {
    g.globalAlpha = clamp(a); g.fillStyle = c; g.beginPath();
    const n = 18; for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * (i / n); g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.75); }
    for (let i = n; i >= 0; i--) { const u = i / n, an = a0 + (a1 - a0) * u, rr = r - w * Math.sin(u * Math.PI); g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.75); }
    g.closePath(); g.fill();
  };
  P.jag = (g, x0, y0, x1, y1, seed, w, c, a = 1, amp = 0.35) => {
    let s = (seed % 2147483646) + 1; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
    g.globalAlpha = clamp(a); g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(x0, y0);
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) * 2.2)), nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) { const k = i / n, o = r() * amp * 2; g.lineTo(x0 + (x1 - x0) * k + nx / L * o, y0 + (y1 - y0) * k + ny / L * o); }
    g.lineTo(x1, y1); g.stroke();
  };
  P.flame = (g, x, y, h, w, pal, ph, a = 1) => {
    const sway = Math.sin(ph) * w * 0.4;
    for (let i = 0; i < 3; i++) {
      const hh = h * (1 - i * 0.28), ww = w * (1 - i * 0.3);
      g.globalAlpha = clamp(a); g.fillStyle = P.col(pal, 3 + i * 2); g.beginPath(); g.moveTo(x - ww, y); g.quadraticCurveTo(x - ww * 0.8, y - hh * 0.5, x + sway, y - hh); g.quadraticCurveTo(x + ww * 0.8, y - hh * 0.5, x + ww, y); g.closePath(); g.fill();
    }
  };
  const rngOf = (seed) => { let s = (seed % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  // ------------------------------------------------------------------ effect painters: draw(g, e, k) with k = 0..1
  const DRAW = {};
  // ---- the arrow: a fixed pixel sprite (white + red fletching, banded wooden shaft, steel head, speed lines),
  //      drawn after the effect layer so its colours are never re-mapped to a skill palette
  const ARROW = (() => {
    if (typeof document === 'undefined') return null;
    const W = 72, H = 13, c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d');
    const px = (x, y, col, w = 1, h = 1) => { q.fillStyle = col; q.fillRect(x, y, w, h); };
    // speed lines behind the arrow (detached dashes)
    px(0, 2, '#7f86a8', 3, 1); px(5, 2, '#7f86a8', 13, 1); px(20, 2, '#7f86a8', 7, 1); px(16, 10, '#b4bce0', 7, 1); px(25, 10, '#e4e8f8', 2, 1);
    // fletching: white upper feathers, red lower feathers
    px(31, 2, '#f4f0e6', 3, 1); px(32, 3, '#f4f0e6', 4, 1); px(33, 4, '#e8e0cc', 5, 1); px(34, 5, '#d8cfb8', 3, 1);
    px(34, 7, '#a83030', 3, 1); px(33, 8, '#b83a3a', 4, 1); px(32, 9, '#a03030', 3, 1); px(31, 10, '#8a2626', 3, 1);
    // shaft: wood with lighter bands and a dark underside
    px(31, 6, '#5a3818', 34, 1); px(32, 6, '#8a5a2a', 32, 1);
    for (const x of [44, 50, 56, 62]) px(x, 6, '#c8964a', 2, 1);
    // steel head
    px(64, 4, '#e8eef8', 2, 1); px(64, 5, '#c8d0e0', 4, 1); px(64, 6, '#f8fbff', 7, 1); px(71, 6, '#ffffff', 1, 1); px(64, 7, '#8a94aa', 4, 1); px(64, 8, '#5a6478', 2, 1);
    return c;
  })();
  const sprites = [];
  DRAW.proj = (g, e, k) => {
    const x = e.x + (e.tx - e.x) * k, y0 = e.y + (e.ty - e.y) * k, lift = e.arc ? Math.sin(k * Math.PI) * 2.2 + 0.4 : 0.75, y = y0 - lift;
    const c = e.pal, a = e.ang, cs = Math.cos(a), sn = Math.sin(a), sz = e.small ? 0.7 : e.big ? 1.6 : 1;
    if (e.style === 'arrow' && ARROW) { sprites.push({ img: ARROW, x, y, a: Math.atan2(sn * FLOOR + (e.arc ? -Math.cos(k * Math.PI) * 0.9 : 0), cs), len: 3.2 * sz }); return; }
    P.ellipse(g, x, y0, 0.22 * sz, 0.09 * sz, '#000', 0.35);
    const tl = (0.6 + (e.trail || 0) * 0.3) * sz;
    for (let i = 1; i <= 5; i++) { const q = i / 5; P.ellipse(g, x - cs * tl * q, y - sn * tl * q * FLOOR, 0.11 * sz * (1 - q * 0.7), 0.08 * sz * (1 - q * 0.7), P.col(c, 6 - i), 0.8 - q * 0.6); }
    switch (e.style) {
      case 'arrow': case 'spear': case 'kunai': P.line(g, x - cs * 0.55 * sz, y - sn * 0.55 * sz, x, y, 0.07, e.style === 'arrow' ? '#8a6a3a' : '#9aa0b0'); P.line(g, x - cs * 0.15, y - sn * 0.15, x + cs * 0.12, y + sn * 0.12, 0.12, '#e8eef8'); if (e.style === 'arrow') P.line(g, x - cs * 0.55 * sz, y - sn * 0.55 * sz, x - cs * 0.45 * sz - sn * 0.1, y - sn * 0.45 * sz + cs * 0.1, 0.06, c[6]); break;
      case 'bullet': P.line(g, x - cs * 0.5, y - sn * 0.5, x, y, 0.07, c[6], 0.7); P.ellipse(g, x, y, 0.09, 0.07, '#fff8d0'); break;
      case 'clock': dial(g, x, y, 0.32 * sz, 1, e.t * 9, 0, { proj: 1 }); break;
      case 'gear': gear(g, x, y, 0.22 * sz, 9, e.t * 14, 1); break;
      case 'chakram': P.ring(g, x, y, 0.26 * sz, 0.2 * sz, 0.07, c[6]); for (let i = 0; i < 3; i++) { const an = k * 30 + (i / 3) * TAU; P.line(g, x + Math.cos(an) * 0.1, y + Math.sin(an) * 0.08, x + Math.cos(an) * 0.3 * sz, y + Math.sin(an) * 0.24 * sz, 0.06, c[7]); } break;
      case 'blade': case 'voidblade': P.crescent(g, x, y, 0.42 * sz, a - 1.1, a + 1.1, 0.16 * sz, e.style === 'voidblade' ? c[2] : c[6]); P.crescent(g, x, y, 0.36 * sz, a - 0.9, a + 0.9, 0.07, c[7]); break;
      case 'axe': { const sp = k * 22; for (let i = 0; i < 2; i++) { const an = sp + i * Math.PI; P.ellipse(g, x + Math.cos(an) * 0.2, y + Math.sin(an) * 0.14, 0.14, 0.1, c[5]); } P.ellipse(g, x, y, 0.07, 0.07, '#5a3a1a'); break; }
      case 'skull': case 'fireskull': P.ellipse(g, x, y, 0.22 * sz, 0.2 * sz, e.style === 'fireskull' ? c[5] : '#e8e0d0'); P.ellipse(g, x - 0.08, y - 0.02, 0.05, 0.05, '#100'); P.ellipse(g, x + 0.08, y - 0.02, 0.05, 0.05, '#100'); if (e.style === 'fireskull') P.flame(g, x - cs * 0.15, y + 0.1, 0.5, 0.18, c, k * 40, 0.9); break;
      case 'fist': P.ellipse(g, x, y, 0.28 * sz, 0.22 * sz, c[5], 0.7); P.ellipse(g, x, y, 0.16 * sz, 0.13 * sz, c[7]); break;
      case 'star': P.star(g, x, y, 0.32 * sz, c[6], 1, k * 12); P.star(g, x, y, 0.18 * sz, '#fff', 1, -k * 12); break;
      case 'prism': for (let i = 0; i < 3; i++) P.line(g, x - cs * 0.6, y - sn * 0.6 + (i - 1) * 0.06, x, y + (i - 1) * 0.04, 0.05, ['#ff6a6a', '#6aff8a', '#6a9aff'][i], 0.8); P.star(g, x, y, 0.22 * sz, '#fff', 1, 0); break;
      case 'shard': g.globalAlpha = 1; g.fillStyle = c[6]; g.beginPath(); g.moveTo(x + cs * 0.4 * sz, y + sn * 0.3 * sz); g.lineTo(x - sn * 0.12, y + cs * 0.1); g.lineTo(x - cs * 0.3 * sz, y - sn * 0.22 * sz); g.lineTo(x + sn * 0.12, y - cs * 0.1); g.fill(); P.line(g, x - cs * 0.2, y - sn * 0.15, x + cs * 0.3, y + sn * 0.22, 0.03, '#fff'); break;
      case 'leafy': for (let i = 0; i < 3; i++) { const an = k * 16 + i * 2.1; P.ellipse(g, x + Math.cos(an) * 0.16, y + Math.sin(an) * 0.12, 0.13 * sz, 0.07 * sz, c[4 + i]); } break;
      case 'card': { g.save(); g.translate(x, y); g.rotate(k * 18); g.globalAlpha = 1; g.fillStyle = '#f4f0e6'; g.fillRect(-0.14 * sz, -0.2 * sz, 0.28 * sz, 0.4 * sz); g.fillStyle = c[5]; g.fillRect(-0.06, -0.06, 0.12, 0.12); g.restore(); break; }
      case 'bomb': P.ellipse(g, x, y, 0.18, 0.18, '#2a2a30'); P.ellipse(g, x - 0.05, y - 0.05, 0.05, 0.05, '#6a6a7a'); P.star(g, x + 0.12, y - 0.2, 0.1, '#ffd25a', 1, k * 20); break;
      default: {
        const pr = (0.2 + Math.sin(k * 30) * 0.03) * sz;
        P.ellipse(g, x, y, pr * 1.5, pr * 1.3, c[3], 0.6); P.ellipse(g, x, y, pr, pr * 0.9, c[5]); P.ellipse(g, x - pr * 0.25, y - pr * 0.25, pr * 0.45, pr * 0.4, c[7]);
        if (e.el === 'fire') P.flame(g, x - cs * 0.2, y + 0.12, 0.5 * sz, 0.16 * sz, c, k * 50, 0.8);
        if (e.el === 'lightning') P.jag(g, x - 0.25, y, x + 0.25, y, e.seed + ((k * 20) | 0), 0.04, c[7]);
        if (e.el === 'ice') for (let i = 0; i < 4; i++) { const an = i * 1.57 + k * 4; P.line(g, x, y, x + Math.cos(an) * pr * 1.6, y + Math.sin(an) * pr * 1.3, 0.04, c[7]); }
      }
    }
  };
  // ---- charge: motes spiral in to the caster's hands, then a cross flash
  DRAW.charge = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed), dir = e.style === 'ccw' ? -1 : 1, n = e.n || 8, y0 = e.y - 0.75;
    for (let i = 0; i < n; i++) { const a0 = rr() * TAU, sp = 0.6 + rr() * 0.6, q = clamp(k * (1 + rr() * 0.4)), a = a0 + dir * q * 2.4, R = e.r * (1 - ease.out(q)) + 0.06;
      const x = e.x + Math.cos(a) * R, y = y0 + Math.sin(a) * R * 0.7; P.ellipse(g, x, y, 0.07 * sp, 0.07 * sp, c[5 + (i % 3)], 0.9); P.line(g, x, y, x - Math.cos(a + dir * 0.9) * 0.18, y - Math.sin(a + dir * 0.9) * 0.12, 0.04, c[4], 0.6); }
    if (k > 0.72) { const f = (k - 0.72) / 0.28, s = 0.2 + f * 0.5; P.line(g, e.x - s, y0, e.x + s, y0, 0.07, c[7], 1 - f); P.line(g, e.x, y0 - s, e.x, y0 + s, 0.07, c[7], 1 - f); P.ellipse(g, e.x, y0, 0.12, 0.12, '#ffffff', 1 - f); }
  };
  // ---- smoke: dark puffs that swell, rise and thin out after an area hit
  DRAW.smoke = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed + 7), n = e.n || 5, fade = 1 - clamp((k - 0.45) / 0.55);
    for (let i = 0; i < n; i++) { const a = rr() * TAU, d = rr() * e.r, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * FLOOR - ease.out(k) * (0.6 + rr() * 0.9), s = (0.22 + rr() * 0.22) * (0.6 + ease.out(k) * 1.1);
      P.ellipse(g, x, y, s, s * 0.8, mixHex(c[1], '#3a3640', 0.6), 0.75 * fade); P.ellipse(g, x - s * 0.25, y - s * 0.25, s * 0.55, s * 0.45, mixHex(c[2], '#5a5660', 0.5), 0.7 * fade); }
  };
  // ---- embers: hot pixels flicking up and out (style 'rise' = gentle sparkles drifting up from a buff)
  DRAW.embers = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed + 11), n = e.n || 10;
    for (let i = 0; i < n; i++) { const st = rr() * 0.4, q = clamp((k - st) / (1 - st)); if (q <= 0 || q >= 1) continue;
      const a = rr() * TAU, d = rr() * e.r, up = e.style === 'rise' ? 0.6 + rr() * 1.2 : 0.3 + rr() * 0.9, sway = Math.sin((e.t + i) * 7) * 0.08;
      const x = e.x + Math.cos(a) * d + sway, y = e.y + Math.sin(a) * d * FLOOR - 0.3 - q * up; const blink = ((e.t * 14 + i) | 0) % 3 !== 0;
      if (blink) P.ellipse(g, x, y, 0.05, 0.05, c[q < 0.4 ? 7 : q < 0.75 ? 5 : 3], 1 - q * 0.6); }
  };
  // ---- ability glyph: a small pixel icon of the skill's ✦ ability pops up, bobs, then fades
  const GLYPHS = {
    stack: ['01110', '11111', '01110', '11111', '01110'], echo: ['10101', '01010', '10101', '01010', '10101'], knockup: ['00100', '01110', '10101', '00100', '00100'], swift: ['10010', '01001', '00100', '01001', '10010'],
    backstab: ['10001', '01010', '00100', '01010', '10001'], splash: ['00100', '10101', '01110', '10101', '00100'], pierceUp: ['00100', '00100', '11111', '00100', '00100'], critUp: ['00100', '01110', '11111', '01110', '00100'],
    crush: ['11111', '10001', '10101', '10001', '11111'], bleed: ['00100', '01110', '01110', '11111', '01110'], fear: ['01110', '10101', '11111', '01010', '10101'], cdr: ['01110', '10101', '10111', '10001', '01110'],
    mend: ['01010', '11111', '11111', '01110', '00100'], burn: ['00100', '01100', '01110', '11111', '01110'], refund: ['01110', '11011', '10001', '11011', '01110'], rally: ['10000', '11100', '11111', '10000', '10000'],
    immune: ['01110', '11111', '11111', '11111', '01110'], reflect: ['11000', '10100', '10010', '10100', '11000'], resetMove: ['01110', '10001', '10101', '00001', '01110'], amp: ['00100', '01110', '00100', '01110', '00100'],
    execute: ['10001', '11011', '01110', '11011', '10001'], detonate: ['10101', '01110', '11111', '01110', '10101'], purge: ['11111', '10001', '01110', '00100', '01110'], toxin: ['01110', '10101', '11111', '01110', '01010'],
    sunder: ['11011', '11011', '00000', '11011', '11011'], slowField: ['00100', '10101', '01110', '10101', '00100'], shatter: ['10010', '01100', '00110', '01100', '10010'], weaken: ['00100', '00100', '11111', '01110', '00100'],
    taunt: ['01110', '10001', '00010', '00100', '00100'], vortex: ['01110', '10000', '10110', '10010', '01100'], cleanse: ['00100', '01010', '10001', '01010', '00100'], blind: ['01110', '10001', '11111', '10001', '01110'],
    thorns: ['10101', '01110', '11111', '01110', '10101'], regen: ['00100', '00100', '11111', '00100', '00100'], haste: ['11000', '01100', '00110', '01100', '11000'], lastStand: ['00100', '00100', '00100', '00000', '00100'],
    far: ['00001', '00010', '10100', '11000', '11100'], critDmg: ['10101', '01110', '11011', '01110', '10101'], guard: ['11111', '11111', '11111', '01110', '00100'], fury: ['10001', '01010', '11111', '01110', '10001'],
    leech: ['01010', '11111', '01110', '00100', '01110'], trueDmg: ['11111', '00100', '00100', '00100', '00100'], steal: ['01110', '11011', '11111', '11011', '01110'], reset: ['01111', '10000', '10011', '10001', '01110'],
    overheal: ['01010', '11111', '11011', '01110', '00100'], invuln: ['11111', '10001', '10101', '10001', '11111'], starMark: ['00100', '11111', '01110', '01010', '10001'], mark: ['01110', '10001', '10101', '10001', '01110'],
    chill: ['10101', '01110', '11011', '01110', '10101'], burnField: ['01010', '11011', '11111', '11111', '01110'], near: ['11100', '11000', '10100', '00010', '00001'], empower: ['00100', '01110', '11111', '00100', '01110'],
    trail: ['10000', '01000', '00100', '00010', '00001'], timeLock: ['11111', '01010', '00100', '01010', '11111'], spirit: ['01110', '11111', '10101', '11111', '10101'], explodeOnEnd: ['00110', '00100', '01110', '11111', '01110'],
    decoy: ['01110', '01110', '00100', '01110', '01010']
  };
  DRAW.glyph = (g, e, k) => {
    const G2 = GLYPHS[e.style]; if (!G2) return;
    const c = e.pal, pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5), px = 0.075 * pop, y0 = e.y - 1.9 - ease.out(k) * 0.5, fade = 1 - clamp((k - 0.7) / 0.3);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (G2[y][x] === '1') { g.globalAlpha = fade; g.fillStyle = y < 2 ? c[7] : c[6]; g.fillRect(e.x + (x - 2.5) * px, y0 + (y - 2.5) * px, px, px); }
    g.globalAlpha = 1;
  };
  DRAW.slash = (g, e, k) => {
    const a = Math.atan2(e.ty - e.y, e.tx - e.x), c = e.pal, sz = e.r * (e.big ? 1.15 : 1);
    const x = e.x + Math.cos(a) * 0.35, y = e.y - 0.6 + Math.sin(a) * 0.2;
    const fl = e.flip ? -1 : 1, sweep = ease.out3(clamp(k * 1.8)), fade = 1 - clamp((k - 0.6) / 0.4);
    const span = e.style === 'cleave' || e.style === 'reap' ? 2.4 : 1.8;
    const a0 = a - span / 2 * fl, a1 = a0 + span * sweep * fl, lo = Math.min(a0, a1), hi = Math.max(a0, a1) + 0.001;
    switch (e.style) {
      case 'thrust': case 'iai': { const L = sz * (e.style === 'iai' ? 1.6 : 1.1) * sweep, ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L * FLOOR; P.line(g, x, y, ex, ey, e.style === 'iai' ? 0.14 : 0.18, c[5], fade); P.line(g, x, y, ex, ey, 0.05, '#fff', fade); if (e.style === 'iai') { P.star(g, ex, ey, 0.35 * fade, c[7], fade); for (let i = 0; i < 3; i++) P.line(g, x + Math.cos(a) * L * (0.2 + i * 0.3), y - 0.3 + i * 0.15, x + Math.cos(a) * L * (0.4 + i * 0.3), y - 0.35 + i * 0.15, 0.03, c[3], fade * 0.7); } break; }
      case 'claw': for (let i = -1; i <= 1; i++) { const off = i * 0.18; P.crescent(g, x + off * Math.sin(a), y - off * Math.cos(a), sz * 0.8, lo, hi, 0.09, i ? c[5] : c[6], fade); } break;
      case 'twin': P.crescent(g, x, y, sz * 0.85, lo, hi, 0.16, c[5], fade); P.crescent(g, x, y, sz * 0.65, lo + 0.3, hi + 0.3, 0.1, c[7], fade); break;
      case 'palm': case 'hammer': { const R = sz * 0.55 * ease.out(k), cx = x + Math.cos(a) * sz * 0.6, cy = y + Math.sin(a) * 0.3; P.ring(g, cx, cy, R, R * 0.8, 0.12, c[5], fade); P.star(g, cx, cy, 0.4 * fade, c[7], fade, k * 3); break; }
      case 'spin': for (let i = 0; i < e.n; i++) { const an = k * 14 + (i / e.n) * TAU; P.crescent(g, e.x, e.y - 0.4, sz, an, an + 1.4, 0.14, c[5 + (i % 2)], fade); P.crescent(g, e.x, e.y - 0.4, sz * 0.95, an + 0.2, an + 1.2, 0.04, '#fff', fade); } break;
      default: { const w = 0.34 * (e.style === 'cleave' ? 1.5 : 1); P.crescent(g, x, y, sz, lo, hi, w, c[4], fade); P.crescent(g, x, y, sz * 0.96, lo, hi, 0.1, c[6], fade); P.crescent(g, x, y, sz * 0.92, lo, hi, 0.035, '#ffffff', fade); }
    }
  };
  DRAW.nova = (g, e, k) => {
    const c = e.pal, R = e.r * ease.out3(k), fade = 1 - k, y = e.y;
    const n = e.style === 'double' ? 2 : 1;
    for (let i = 0; i < n; i++) { const rr = R * (1 - i * 0.22); P.ring(g, e.x, y, rr, rr * FLOOR, 0.26 * fade + 0.06, c[5 - i], Math.min(1, fade * 1.3)); }
    P.ring(g, e.x, y, R * 0.98, R * 0.98 * FLOOR, 0.05, c[7], fade);
    if (e.style === 'soft') P.ellipse(g, e.x, y, R, R * FLOOR, c[3], 0.25 * fade);
    if (e.style === 'dashed' || e.style === 'runic') { const m = 12 + e.var; for (let i = 0; i < m; i++) { const an = (i / m) * TAU + k; P.ellipse(g, e.x + Math.cos(an) * R * 0.85, y + Math.sin(an) * R * 0.85 * FLOOR, 0.08, 0.06, c[6], fade); } }
    if (e.style === 'crack') for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + e.seed; P.jag(g, e.x, y, e.x + Math.cos(an) * R, y + Math.sin(an) * R * FLOOR, e.seed + i, 0.06, '#2a1c14', fade, 0.15); }
  };
  DRAW.pillar = (g, e, k) => {
    const c = e.pal, w = e.r * 0.5 * (k < 0.2 ? k / 0.2 : 1 - clamp((k - 0.6) / 0.4) * 0.8), H = 7, fade = 1 - clamp((k - 0.7) / 0.3);
    const dark = e.style === 'dark';
    g.globalAlpha = fade; g.fillStyle = dark ? '#100820' : c[4]; g.fillRect(e.x - w, e.y - H, w * 2, H);
    g.fillStyle = dark ? c[4] : c[6]; g.fillRect(e.x - w * 0.55, e.y - H, w * 1.1, H);
    g.fillStyle = dark ? c[6] : '#ffffff'; g.fillRect(e.x - w * 0.18, e.y - H, w * 0.36, H);
    P.ellipse(g, e.x, e.y, w * 1.8, w * 0.8, c[5], fade);
    for (let i = 0; i < 6; i++) { const yy = e.y - ((k * 8 + i * 1.3) % H); P.ellipse(g, e.x + Math.sin(i * 2.1 + k * 9) * w * 1.3, yy, 0.06, 0.06, c[7], fade); }
    if (e.style === 'fire') for (let i = 0; i < 4; i++) P.flame(g, e.x + (i - 1.5) * w * 0.6, e.y, 1.2 + Math.sin(k * 20 + i) * 0.3, w * 0.4, c, k * 30 + i, fade);
  };
  DRAW.bolt = (g, e, k) => {
    const c = e.el === 'lightning' ? e.pal : EL_PAL.lightning, fade = 1 - k, flick = ((k * 30) | 0) % 2;
    for (let i = 0; i < Math.min(4, e.n); i++) {
      const ox = (i - (Math.min(4, e.n) - 1) / 2) * 0.6, top = e.y - 8;
      P.jag(g, e.x + ox + 0.5, top, e.x + ox, e.y - 0.1, e.seed + i * 13 + (flick ? 7 : 0), 0.16, c[5], fade, 0.5);
      P.jag(g, e.x + ox + 0.5, top, e.x + ox, e.y - 0.1, e.seed + i * 13 + (flick ? 7 : 0), 0.06, '#ffffff', fade, 0.5);
      if (i === 0) P.jag(g, e.x + ox, e.y - 4, e.x + ox + 1.4, e.y - 2.4, e.seed + 99, 0.05, c[6], fade * 0.8, 0.3);
    }
    P.ellipse(g, e.x, e.y, 0.9 * fade + 0.2, 0.4 * fade + 0.1, c[7], fade);
  };
  DRAW.chainbolt = (g, e, k) => { const c = e.pal, fade = 1 - k; P.jag(g, e.x, e.y - 0.6, e.tx, e.ty - 0.6, e.seed + ((k * 25) | 0), 0.1, c[5], fade); P.jag(g, e.x, e.y - 0.6, e.tx, e.ty - 0.6, e.seed + ((k * 25) | 0), 0.04, '#fff', fade); };
  DRAW.beam = (g, e, k) => {
    const c = e.pal, a = e.ang, L = (e.len || 8) * ease.out(clamp(k * 3)), w = (e.w || 0.6) * (k < 0.15 ? k / 0.15 : 1 - clamp((k - 0.55) / 0.45)), y = e.y - 0.6;
    if (w <= 0.01) return;
    const x1 = e.x + Math.cos(a) * L, y1 = y + Math.sin(a) * L * FLOOR;
    if (e.style === 'prism') ['#ff4a4a', '#ffaa3a', '#fff04a', '#5aff7a', '#4ac0ff', '#7a5aff'].forEach((cc, i) => P.line(g, e.x, y + (i - 2.5) * w * 0.12, x1, y1 + (i - 2.5) * w * 0.12, w * 0.18, cc));
    else { P.line(g, e.x, y, x1, y1, w, c[4]); P.line(g, e.x, y, x1, y1, w * 0.55, c[6]); }
    P.line(g, e.x, y, x1, y1, w * 0.2, '#fff');
    P.ellipse(g, e.x, y, w * 0.8, w * 0.8, c[7]); P.star(g, x1, y1, w * 1.2, c[7], 1, k * 10);
  };
  DRAW.wave = (g, e, k) => {
    const c = e.pal, a = e.ang, d = (e.len || 6) * ease.out(k), fade = 1 - clamp((k - 0.5) / 0.5), w = e.w || 1;
    const cx = e.x + Math.cos(a) * d, cy = e.y - 0.4 + Math.sin(a) * d * FLOOR;
    P.crescent(g, cx, cy, w * 1.2, a - 1, a + 1, 0.35 * w, c[4], fade); P.crescent(g, cx, cy, w * 1.1, a - 0.8, a + 0.8, 0.14, c[6], fade); P.crescent(g, cx, cy, w * 1.05, a - 0.6, a + 0.6, 0.05, '#fff', fade);
    for (let i = 1; i < 4; i++) P.crescent(g, cx - Math.cos(a) * i * 0.5, cy - Math.sin(a) * i * 0.3, w * (1.2 - i * 0.15), a - 0.8, a + 0.8, 0.08, c[5 - i], fade * (1 - i * 0.25));
  };
  DRAW.cone = (g, e, k) => {
    const c = e.pal, a = e.ang, R = e.r * ease.out(k), fade = 1 - clamp((k - 0.4) / 0.6), rr = rngOf(e.seed);
    for (let i = 0; i < 26; i++) { const an = a + (rr() - 0.5) * 1.4, d = R * (0.3 + rr() * 0.7); P.ellipse(g, e.x + Math.cos(an) * d, e.y - 0.4 + Math.sin(an) * d * FLOOR, 0.14 * (1 - k * 0.5), 0.1, P.col(c, 3 + rr() * 5), fade); }
    P.crescent(g, e.x, e.y - 0.4, Math.max(0.1, R), a - 0.7, a + 0.7, 0.2, c[6], fade * 0.8);
  };
  DRAW.rain = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed), n = e.n;
    for (let i = 0; i < n; i++) {
      const t0 = rr() * 0.6, a = rr() * TAU, d = Math.sqrt(rr()) * e.r, gx = e.x + Math.cos(a) * d, gy = e.y + Math.sin(a) * d * FLOOR;
      const q = (k - t0) / 0.3; if (q < 0) continue;
      if (q < 1) {
        const fy = gy - (1 - q) * 6, fx = gx + (1 - q) * 1.5;
        P.ellipse(g, gx, gy, 0.15 * q, 0.06 * q, '#000', 0.3);
        if (e.style === 'arrow' || e.style === 'bullet' || e.style === 'kunai' || e.style === 'blade') P.line(g, fx + 0.25, fy - 0.6, fx, fy, 0.07, e.style === 'arrow' ? '#8a6a3a' : c[6]);
        else if (e.style === 'ice') P.line(g, fx + 0.15, fy - 0.5, fx, fy, 0.14, c[6]);
        else if (e.style === 'lightning') P.jag(g, gx + 0.3, gy - 6, gx, gy, e.seed + i, 0.08, c[6], 1, 0.3);
        else { P.ellipse(g, fx, fy, 0.18, 0.18, c[5]); P.line(g, fx + 0.4, fy - 0.6, fx, fy, 0.1, c[4], 0.7); }
      } else if (q < 1.6) { const f = (q - 1) / 0.6; P.ring(g, gx, gy, 0.6 * f + 0.05, (0.6 * f + 0.05) * FLOOR, 0.08, c[6], 1 - f); if (q < 1.15) P.star(g, gx, gy - 0.2, 0.35, c[7], 1 - f, 0); }
    }
  };
  DRAW.blackhole = (g, e, k) => {
    const c = e.pal, R = Math.max(0.05, e.r * (k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1)), y = e.y - 0.3;
    for (let i = 0; i < 3; i++) P.ring(g, e.x, y, R * (1 - i * 0.2), R * (1 - i * 0.2) * FLOOR, 0.12, c[5 - i], 0.8, k * 8 + i, k * 8 + i + 4.5);
    P.ellipse(g, e.x, y, R * 0.35, R * 0.35 * FLOOR + 0.1, '#05000a');
    const rr = rngOf(e.seed);
    for (let i = 0; i < 20; i++) { const an = rr() * TAU + k * 6, d = R * (1 - ((k * 2 + rr()) % 1)); P.ellipse(g, e.x + Math.cos(an) * d, y + Math.sin(an) * d * FLOOR, 0.06, 0.05, c[7]); }
  };
  DRAW.sigil = (g, e, k) => {
    const c = e.pal, R = Math.max(0.05, e.r * ease.out(clamp(k * 3))), fade = 1 - clamp((k - 0.75) / 0.25), rot = k * 3 * (e.var % 2 ? -1 : 1);
    P.ring(g, e.x, e.y, R, R * FLOOR, 0.07, c[5], fade); P.ring(g, e.x, e.y, R * 0.75, R * 0.75 * FLOOR, 0.04, c[6], fade);
    const pts = e.style === 'hex' ? 6 : e.style === 'square' ? 4 : e.style === 'star' ? 5 : 3, step = e.style === 'star' ? 2 : 1;
    g.globalAlpha = fade; g.strokeStyle = c[6]; g.lineWidth = 0.05; g.beginPath();
    for (let i = 0; i <= pts; i++) { const an = rot + ((i * step) / pts) * TAU; g.lineTo(e.x + Math.cos(an) * R * 0.75, e.y + Math.sin(an) * R * 0.75 * FLOOR); } g.stroke();
    for (let i = 0; i < 8; i++) { const an = -rot * 1.5 + (i / 8) * TAU; P.ellipse(g, e.x + Math.cos(an) * R * 0.88, e.y + Math.sin(an) * R * 0.88 * FLOOR, 0.05, 0.04, c[7], fade); }
  };
  DRAW.mark = (g, e, k) => { const c = e.pal, R = e.r * (1.6 - k * 0.6); P.ring(g, e.x, e.y, R, R * FLOOR, 0.06, c[5], 0.9); for (let i = 0; i < 4; i++) { const an = (i / 4) * TAU + k * 4; P.line(g, e.x + Math.cos(an) * R * 0.7, e.y + Math.sin(an) * R * 0.7 * FLOOR, e.x + Math.cos(an) * R * 1.15, e.y + Math.sin(an) * R * 1.15 * FLOOR, 0.06, c[6]); } P.ellipse(g, e.x, e.y, 0.08, 0.06, c[7], ((k * 6) | 0) % 2 ? 1 : 0.3); };
  // ---- arcane clock circles (no physical clocks): rings of light with roman numerals written in light,
  //      rotating rune bands and hands made of beams — a magic circle that keeps time
  const BRASS = ['#3a6a8a', '#5ab0d0', '#8ae8ff', '#c8f8ff', '#ffffff'], FACE = '#bff4ff', INK = '#7ff0ff', STEEL = '#ffe9a8';
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  function glow(g, col, blur) { g.shadowColor = col; g.shadowBlur = blur; }
  function dial(g, x, y, R, sy, t, fade, o) {
    o = o || {}; const a = (fade === 0 ? 1 : 1 - fade) * (o.faint ? 0.55 : 1), gold = o.eclipse ? '#ffcf6a' : '#ffe9a8', cyan = o.eclipse ? '#c49aff' : '#7ff0ff';
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.lineCap = 'round';
    const el = (r, w, col, a0 = 0, a1 = Math.PI * 2, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.ellipse(x, y, r, r * sy, 0, a0, a1); g.stroke(); g.setLineDash([]); };
    glow(g, cyan, 8);
    // soft inner light
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, o.eclipse ? 'rgba(90,40,140,0.35)' : 'rgba(120,230,255,0.22)'); gr.addColorStop(0.7, 'rgba(80,180,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, R, R * sy, 0, 0, 7); g.fill();
    // outer double ring + rotating rune band between them
    el(R, R * 0.035, cyan); el(R * 0.9, R * 0.018, gold);
    g.save(); g.translate(x, y); g.scale(1, sy); g.rotate(t * 0.15);
    // text is laid out at 40× and scaled down: the circle lives in world units (1 = one tile)
    g.fillStyle = cyan; g.font = `${(R * 0.1 * 40).toFixed(1)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    if (!o.proj && R > 0.5) for (let i = 0; i < 24; i++) { const an = i / 24 * Math.PI * 2; g.save(); g.rotate(an); g.translate(0, -R * 0.95); g.scale(1 / 40, 1 / 40); g.fillText(runes[i], 0, 0); g.restore(); }
    g.restore();
    // numerals written in light
    if (!o.proj) { g.save(); g.translate(x, y); g.scale(1, sy); g.fillStyle = gold; g.font = `700 ${(R * 0.13 * 40).toFixed(1)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(Math.cos(an) * R * 0.75, Math.sin(an) * R * 0.75); if (sy < 1) g.rotate(an + Math.PI / 2); g.scale(1 / 40, 1 / 40); g.fillText(o.roman || R > 0.9 ? ROMAN[i] : '·', 0, 0); g.restore(); } g.restore(); }
    // tick ring (60) counter-rotating
    for (let i = 0; i < 60; i += o.proj ? 5 : 1) { const an = i / 60 * Math.PI * 2 - t * 0.08, big = i % 5 === 0, r0 = R * (big ? 0.58 : 0.62), r1 = R * 0.66; g.strokeStyle = big ? gold : cyan; g.lineWidth = R * (big ? 0.022 : 0.01); g.beginPath(); g.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * sy); g.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * sy); g.stroke(); }
    el(R * 0.5, R * 0.012, cyan, 0, Math.PI * 2, [R * 0.05, R * 0.04]);
    // inner geometry: two counter-rotating triangles (hexagram)
    if (!o.proj) for (let k2 = 0; k2 < 2; k2++) { g.strokeStyle = k2 ? gold : cyan; g.lineWidth = R * 0.01; g.beginPath(); for (let i = 0; i <= 3; i++) { const an = (k2 ? -t * 0.3 : t * 0.3) + i / 3 * Math.PI * 2 + k2 * Math.PI; g.lineTo(x + Math.cos(an) * R * 0.46, y + Math.sin(an) * R * 0.46 * sy); } g.stroke(); }
    // hands of light
    glow(g, gold, 6);
    const hand = (an, L, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L * sy); g.stroke(); };
    hand(-Math.PI / 2 + t / 12, R * 0.4, R * 0.05, gold); hand(-Math.PI / 2 + t, R * 0.62, R * 0.03, '#ffffff'); if (!o.proj) hand(-Math.PI / 2 + t * 6, R * 0.7, R * 0.012, cyan);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, R * 0.05, R * 0.05 * sy, 0, 0, 7); g.fill();
    g.restore(); g.shadowBlur = 0;
  }
  function gear(g, x, y, R, teeth, rot, a) {
    // a small spinning rune-ring (instead of a metal gear)
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; glow(g, '#7ff0ff', 6); g.strokeStyle = '#7ff0ff'; g.lineWidth = R * 0.12;
    g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke(); g.strokeStyle = '#ffe9a8'; g.lineWidth = R * 0.06;
    for (let i = 0; i < teeth; i++) { const an = rot + i / teeth * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(an) * R * 0.55, y + Math.sin(an) * R * 0.55); g.lineTo(x + Math.cos(an) * R * 0.85, y + Math.sin(an) * R * 0.85); g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, R * 0.18, 0, 7); g.fill(); g.restore(); g.shadowBlur = 0;
  }
  function timeRing(g, x, y, R, sy, rot, w, col, a, ticks) {
    P.ring(g, x, y, R, R * sy, w, col, a); P.ring(g, x, y, R - w * 1.6, (R - w * 1.6) * sy, w * 0.35, col, a * 0.6);
    for (let i = 0; i < ticks; i++) { const an = rot + i / ticks * TAU; P.line(g, x + Math.cos(an) * (R - w * 0.5), y + Math.sin(an) * (R - w * 0.5) * sy, x + Math.cos(an) * (R + w * 1.2), y + Math.sin(an) * (R + w * 1.2) * sy, w * 0.5, i % 3 ? col : '#ffffff', a); }
  }
  DRAW.chrono = (g, e, k) => {
    g.save(); g.shadowColor = '#7ff0ff'; g.shadowBlur = 4;
    try { chronoPiece(g, e, k); } finally { g.restore(); g.shadowBlur = 0; }
  };
  function chronoPiece(g, e, k) {
    const c = ['#0a2a3a', '#1a5a7a', '#2a8ab0', '#4ac8e8', '#7ff0ff', '#a8f6ff', '#d8fbff', '#ffffff'], T = e.t, fade = clamp((k - 0.78) / 0.22), a = 1 - fade, grow = e.grow ? ease.out3(clamp(k * 2.2)) : 1;
    const sy = e.flat ? FLOOR : 1, up = e.up ? 1.25 + e.r * 0.35 : 0, x = e.x, y = e.y - up;
    switch (e.style) {
      case 'dial': {
        let yy = y; if (e.drop) yy -= (1 - ease.out3(clamp(k * 2.5))) * 4;
        const spin = (e.spin || 3) * (e.freeze && k > 0.25 ? 0.02 : 1);
        if (!e.faint) P.ellipse(g, x, e.y, e.r * 1.4 * grow, e.r * 1.4 * grow * FLOOR, c[5], 0.18 * a);
        dial(g, x, yy, Math.max(0.05, e.r * grow), sy, T * spin + e.seed, fade, e);
        if (e.burst && k > 0.35) { const q = (k - 0.35) / 0.65; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; P.line(g, x + Math.cos(an) * e.r * (1 + q), yy + Math.sin(an) * e.r * (1 + q), x + Math.cos(an) * e.r * (1.2 + q * 1.4), yy + Math.sin(an) * e.r * (1.2 + q * 1.4), 0.06, BRASS[4], 1 - q); } }
        break;
      }
      case 'rings': for (let i = 0; i < (e.n || 2); i++) { const R = e.r * grow * (1 - i * 0.18), dir = i % 2 ? -1 : 1; timeRing(g, x, e.shield ? e.y - 0.8 : y, R, e.shield ? (0.35 + i * 0.3) : sy, T * dir * (e.slow ? 0.4 : 1.6) + i, 0.07, i === 0 ? c[6] : BRASS[3], a * (0.9 - i * 0.15), 12); } break;
      case 'gear': { const yy = e.up ? e.y - 1.4 : e.y - 0.6; gear(g, x, yy, e.r * 0.6, e.teeth || 10, T * 4, a); if (e.pair) gear(g, x + e.r * 0.7, yy + e.r * 0.45, e.r * 0.38, 8, -T * 6.6 + 0.2, a); break; }
      case 'hand': {
        if (e.stab) { const L = e.r * 1.2, yy = e.y - L * (1 - ease.out3(clamp(k * 3))); P.line(g, x, yy - L, x, yy, 0.16, STEEL, a); P.line(g, x, yy - L, x, yy - L * 0.25, 0.08, '#4a6aa8', a); P.ellipse(g, x, yy - L, 0.16, 0.16, BRASS[3], a); break; }
        const x2 = e.tx, y2 = e.ty - 0.6, ln = Math.hypot(x2 - e.x, y2 - (e.y - 0.6)), q = ease.out3(clamp(k * 2.2)), back = e.back ? -1 : 1;
        const hx = e.x + (x2 - e.x) * q, hy = e.y - 0.6 + (y2 - e.y + 0.6) * q;
        P.line(g, e.x, e.y - 0.6, hx, hy, e.w || 0.25, STEEL, a); P.line(g, e.x, e.y - 0.6, hx, hy, (e.w || 0.25) * 0.35, '#6a8ad8', a);
        const an = Math.atan2(hy - e.y + 0.6, hx - e.x); P.ellipse(g, hx + Math.cos(an) * 0.2, hy + Math.sin(an) * 0.2, 0.22, 0.12, STEEL, a);
        for (let i = 1; i < 4; i++) { const qq = q - i * 0.08 * back; if (qq <= 0) continue; P.line(g, e.x, e.y - 0.6, e.x + (x2 - e.x) * qq, e.y - 0.6 + (y2 - e.y + 0.6) * qq, 0.04, c[6], a * (0.5 - i * 0.12)); }
        if (ln) {} break;
      }
      case 'sweep': { const an = -Math.PI / 2 + ease.out(k) * TAU * (e.turns || 1); for (let i = 0; i < 10; i++) { const aa = an - i * 0.09; P.line(g, x, e.y, x + Math.cos(aa) * e.r, e.y + Math.sin(aa) * e.r * FLOOR, i ? 0.06 : 0.14, i ? c[6] : STEEL, a * (1 - i / 10)); } P.ellipse(g, x, e.y, 0.18, 0.1, BRASS[3], a); break; }
      case 'rewind': { for (let i = 0; i < 3; i++) { const R = e.r * (0.5 + i * 0.3), dir = e.fwd ? 1 : -1, a0 = T * 6 * dir + i * 2; P.ring(g, x, e.y - 0.8, R, R, 0.05, c[6 - i], a * 0.9, a0, a0 + 4.6); const tip = a0 + (dir > 0 ? 4.6 : 0); const tx = x + Math.cos(tip) * R, ty = e.y - 0.8 + Math.sin(tip) * R; P.star(g, tx, ty, 0.1, c[7], a, tip); } break; }
      case 'hourglass': {
        const H = e.r * 1.4 * (e.big ? 1.4 : 1), yy = (e.up ? e.y - 1.5 : e.y - 0.2) - H / 2, W2 = H * 0.45, sand = clamp(k * 1.15);
        P.line(g, x - W2, yy - H / 2, x + W2, yy - H / 2, 0.1, BRASS[2], a); P.line(g, x - W2, yy + H / 2, x + W2, yy + H / 2, 0.1, BRASS[2], a);
        P.line(g, x - W2 * 0.92, yy - H / 2, x - W2 * 0.92, yy + H / 2, 0.05, BRASS[1], a); P.line(g, x + W2 * 0.92, yy - H / 2, x + W2 * 0.92, yy + H / 2, 0.05, BRASS[1], a);
        g.globalAlpha = a * 0.25; g.fillStyle = '#7ff0ff'; g.beginPath(); g.moveTo(x - W2 * 0.8, yy - H * 0.47); g.lineTo(x + W2 * 0.8, yy - H * 0.47); g.lineTo(x + 0.04, yy); g.lineTo(x + W2 * 0.8, yy + H * 0.47); g.lineTo(x - W2 * 0.8, yy + H * 0.47); g.lineTo(x - 0.04, yy); g.closePath(); g.fill();
        g.globalAlpha = a; g.fillStyle = '#ffe9a8'; const top = (1 - sand) * H * 0.4; g.beginPath(); g.moveTo(x - W2 * 0.8 * (top / (H * 0.47)), yy - top); g.lineTo(x + W2 * 0.8 * (top / (H * 0.47)), yy - top); g.lineTo(x, yy); g.closePath(); g.fill();
        const bot = sand * H * 0.4; g.beginPath(); g.moveTo(x - W2 * 0.8, yy + H * 0.47); g.lineTo(x + W2 * 0.8, yy + H * 0.47); g.lineTo(x, yy + H * 0.47 - bot); g.closePath(); g.fill();
        if (sand < 1) P.line(g, x, yy, x, yy + H * 0.47 - bot, 0.03, '#ffe9a8', a);
        g.globalAlpha = 1; break;
      }
      case 'ticks': for (let i = 0; i < 12; i++) { const an = i / 12 * TAU, lit = ((T * 4) | 0) % 12 === i, R = e.r; P.line(g, x + Math.cos(an) * R * 0.82, e.y + Math.sin(an) * R * 0.82 * FLOOR, x + Math.cos(an) * R, e.y + Math.sin(an) * R * FLOOR, lit ? 0.16 : 0.08, lit ? '#ffffff' : BRASS[3], a); if (e.hammer && lit) P.ellipse(g, x + Math.cos(an) * R * 0.9, e.y + Math.sin(an) * R * 0.9 * FLOOR, 0.35, 0.16, c[6], a * 0.6); } P.ring(g, x, e.y, e.r, e.r * FLOOR, 0.05, BRASS[2], a); break;
      case 'chain': { const n = 9, dx = (e.tx - e.x) / n, dy = (e.ty - e.y) / n, q = clamp(k * 2.5); for (let i = 0; i < n * q; i++) gear(g, e.x + dx * (i + 0.5), e.y - 0.6 + dy * (i + 0.5), 0.16, 7, T * 8 * (i % 2 ? -1 : 1), a); break; }
      case 'beam': { const q = clamp(k * 3); const x2 = e.x + (e.tx - e.x) * q, y2 = e.ty - 0.6; P.line(g, e.x, e.y - 0.6, x2, e.y - 0.6 + (y2 - e.y + 0.6) * q, (e.w || 0.35) * 1.6, e.eclipse ? '#2a1640' : c[4], a * 0.7); P.line(g, e.x, e.y - 0.6, x2, e.y - 0.6 + (y2 - e.y + 0.6) * q, (e.w || 0.35) * 0.6, e.eclipse ? '#f0c860' : '#ffffff', a);
        for (let i = 0; i < 6; i++) { const qq = ((T * 2 + i / 6) % 1) * q; timeRing(g, e.x + (e.tx - e.x) * qq, e.y - 0.6 + (e.ty - e.y) * qq, (e.w || 0.35) * 1.4, 1, T * 5 + i, 0.03, BRASS[3], a * 0.8, 6); } break; }
      case 'crack': { const rr = rngOf(e.seed); for (let i = 0; i < 7; i++) { const an = rr() * TAU; P.jag(g, x, e.y, x + Math.cos(an) * e.r, e.y + Math.sin(an) * e.r * FLOOR, e.seed + i, 0.05, '#3a2a18', a, 0.12); } break; }
      case 'shatterdial': { const rr = rngOf(e.seed); for (let i = 0; i < 16; i++) { const an = rr() * TAU, d = ease.out(k) * e.r * (0.5 + rr()), px = x + Math.cos(an) * d, py = (e.flat ? e.y : e.y - 1.2) + Math.sin(an) * d * sy - (e.flat ? 0 : k * 0.5); P.ellipse(g, px, py, 0.12, 0.08, i % 3 ? FACE : BRASS[3], a); } break; }
      case 'speed': for (let i = 0; i < 7; i++) { const yy = e.y - 0.2 - i * 0.22, ph = (T * 3 + i * 0.37) % 1; P.line(g, x - 0.9 + ph * 0.3, yy, x - 0.4 + ph * 0.3, yy, 0.04, i % 2 ? BRASS[3] : c[6], a * (1 - ph)); } break;
      case 'afterimage': for (let i = 0; i < 5; i++) { const q = i / 4, px = e.x + (e.tx - e.x) * q, py = e.y + (e.ty - e.y) * q; dial(g, px, py - 1, 0.35, 1, T * 6 + i, Math.min(1, fade + (1 - q) * 0.5), { proj: 1 }); } break;
      case 'rain': { const rr = rngOf(e.seed); for (let i = 0; i < (e.n || 8); i++) { const st = rr() * 0.6, q = clamp((k - st) / 0.35); if (q <= 0) continue; const px = x + (rr() - 0.5) * e.r * 2, py = e.y + (rr() - 0.5) * e.r * FLOOR * 2; if (q < 1) dial(g, px, py - (1 - q) * 5 - 0.4, 0.38, 1, T * 10 + i, 0, { proj: 1 }); else P.ellipse(g, px, py, 0.5, 0.22, c[5], (1 - clamp((k - st - 0.35) / 0.3)) * 0.8); } break; }
    }
  }
  DRAW.clock = (g, e, k) => {
    const c = e.pal, R = e.r * 1.2, fade = 1 - clamp((k - 0.8) / 0.2), y = e.y - 1.2;
    P.ring(g, e.x, y, R, R, 0.08, c[6], fade); P.ring(g, e.x, y, R * 0.85, R * 0.85, 0.03, c[5], fade * 0.8);
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; P.ellipse(g, e.x + Math.cos(an) * R * 0.92, y + Math.sin(an) * R * 0.92, 0.04, 0.04, c[7], fade); }
    const hand = -Math.PI / 2 + k * TAU * 2 * (e.var % 2 ? -1 : 1);
    P.line(g, e.x, y, e.x + Math.cos(hand) * R * 0.8, y + Math.sin(hand) * R * 0.8, 0.06, '#fff', fade); P.line(g, e.x, y, e.x + Math.cos(hand / 12 - 1.2) * R * 0.5, y + Math.sin(hand / 12 - 1.2) * R * 0.5, 0.08, c[6], fade);
  };
  DRAW.field = (g, e, k) => {
    const c = e.pal, R = Math.max(0.05, e.r * ease.out(clamp(k * 6))), fade = 1 - clamp((k - 0.9) / 0.1), rr = rngOf(e.seed), T = e.t;
    P.ellipse(g, e.x, e.y, R, R * FLOOR, c[2], 0.3 * fade); P.ring(g, e.x, e.y, R, R * FLOOR, 0.06, c[5], fade);
    const n = 10 + Math.round(R * 4);
    for (let i = 0; i < n; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.9, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * FLOOR, ph = rr() * 10;
      if (e.style === 'fire') P.flame(g, x, y, 0.5 + Math.sin(T * 9 + ph) * 0.15, 0.13, c, T * 8 + ph, fade);
      else if (e.style === 'ice') P.line(g, x, y, x + 0.05, y - 0.35 - (ph % 1) * 0.3, 0.12, c[6], fade);
      else if (e.style === 'poison' || e.style === 'dark' || e.style === 'blood') { const up = (T * 0.6 + ph) % 1; P.ellipse(g, x, y - up * 0.8, 0.09 * (1 - up), 0.08 * (1 - up), c[5 + (i % 2)], fade); }
      else if (e.style === 'lightning') { if (((T * 12 + ph) | 0) % 5 === 0) P.jag(g, x, y - 0.5, x + 0.3, y, e.seed + i + ((T * 12) | 0), 0.04, c[7], fade, 0.2); }
      else { const up = (T * 0.5 + ph) % 1; P.ellipse(g, x, y - up * 1.2, 0.05, 0.05, c[6 + (i % 2)], fade * (1 - up)); }
    }
  };
  DRAW.spikes = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed), rise = ease.out3(clamp(k * 3)), fade = 1 - clamp((k - 0.7) / 0.3);
    for (let i = 0; i < Math.min(16, e.n); i++) {
      const a = (i / e.n) * TAU + rr(), d = e.r * (0.3 + rr() * 0.7), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * FLOOR, h = (0.5 + rr() * 0.7) * rise, w = 0.12 + rr() * 0.08;
      if (e.style === 'vine') { P.line(g, x, y, x + Math.sin(i + k * 6) * 0.15, y - h, 0.07, '#3a8a3a', fade); P.ellipse(g, x + 0.08, y - h * 0.6, 0.07, 0.04, '#6ad04a', fade); continue; }
      g.globalAlpha = fade; g.fillStyle = e.style === 'ice' ? c[6] : e.style === 'dark' ? c[3] : c[4]; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h); g.lineTo(x + w, y); g.closePath(); g.fill();
      g.fillStyle = c[7]; g.beginPath(); g.moveTo(x - w * 0.2, y); g.lineTo(x, y - h); g.lineTo(x + w * 0.25, y - h * 0.2); g.closePath(); g.fill();
    }
  };
  DRAW.aura = (g, e, k) => {
    const c = e.pal, T = e.t, fade = 1 - clamp((k - 0.8) / 0.2), rr = rngOf(e.seed);
    P.ring(g, e.x, e.y, 0.8 + Math.sin(T * 6) * 0.06, 0.4, 0.06, c[5], fade);
    for (let i = 0; i < Math.min(24, e.n); i++) {
      const ph = rr(), up = (T * (0.7 + rr() * 0.6) + ph) % 1, a = rr() * TAU, x = e.x + Math.cos(a) * 0.6, y = e.y + Math.sin(a) * 0.25 - up * 2;
      switch (e.style) {
        case 'hellfire': case 'flame': case 'rage': P.flame(g, x, e.y + Math.sin(a) * 0.2, 0.4 + (1 - up) * 0.5, 0.12, c, T * 10 + i, fade * (1 - up * 0.5)); break;
        case 'heal': P.line(g, x - 0.08, y, x + 0.08, y, 0.05, '#7ae89a', fade * (1 - up)); P.line(g, x, y - 0.08, x, y + 0.08, 0.05, '#7ae89a', fade * (1 - up)); break;
        case 'clock': P.ring(g, e.x, e.y - 1, 0.7 + i * 0.03, 0.7 + i * 0.03, 0.03, c[6], fade * 0.3, T * (i % 2 ? 2 : -2), T * (i % 2 ? 2 : -2) + 1); break;
        case 'void': case 'smoke': case 'skulls': P.ellipse(g, x, y, 0.12 * (1 - up), 0.1 * (1 - up), i % 2 ? '#1a0a2a' : c[4], fade); break;
        case 'prism': P.ellipse(g, x, y, 0.06, 0.06, `hsl(${(i * 50 + T * 200) % 360},90%,70%)`, fade * (1 - up)); break;
        default: P.ellipse(g, x, y, 0.06, 0.06, c[6 + (i % 2)], fade * (1 - up));
      }
    }
    if (e.style === 'halo') P.ring(g, e.x, e.y - 2.1, 0.45, 0.14, 0.07, c[6], fade);
    if (e.style === 'shell') P.ring(g, e.x, e.y - 0.8, 0.9, 1.0, 0.05, c[6], fade * 0.7);
  };
  DRAW.shield = (g, e, k) => { const c = e.pal, R = Math.max(0.05, e.r * (k < 0.15 ? k / 0.15 : 1)), fade = 1 - clamp((k - 0.85) / 0.15), sh = (e.t * 2) % 1; P.ring(g, e.x, e.y - R * 0.4, R, R * 0.9, 0.08, c[6], fade, Math.PI, TAU); P.ring(g, e.x, e.y, R, R * FLOOR, 0.06, c[5], fade); P.ring(g, e.x, e.y - R * 0.4, R * 0.98, R * 0.88, 0.04, '#fff', fade * 0.8, Math.PI + sh * Math.PI, Math.PI + sh * Math.PI + 0.5); };
  DRAW.wings = (g, e, k) => {
    const c = e.pal, sp = ease.out(clamp(k * 2.5)), fade = 1 - clamp((k - 0.6) / 0.4), y = e.y - 1.2;
    const dark = e.style === 'hellfire' || e.style === 'void' || e.style === 'skulls' || e.style === 'rage';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const L = (1.4 - i * 0.22) * sp * 1.6; g.globalAlpha = fade; g.fillStyle = dark ? (i % 2 ? '#2a0a14' : c[2]) : (i % 2 ? c[6] : '#fffbe8'); g.beginPath(); g.moveTo(e.x + s * 0.2, y + i * 0.15); g.quadraticCurveTo(e.x + s * L * 0.7, y - L * 0.7 + i * 0.2, e.x + s * L, y - 0.2 + i * 0.25); g.lineTo(e.x + s * 0.2, y + 0.3 + i * 0.15); g.fill(); }
    if (!dark) P.ring(g, e.x, y - 1.1, 0.45, 0.13, 0.07, c[7], fade);
  };
  DRAW.motif = (g, e, k) => {
    const c = e.pal, fade = 1 - k, y = e.y - 0.9;
    switch (e.style) {
      case 'clock': DRAW.clock(g, Object.assign({}, e, { r: 0.6 }), k); break;
      case 'halo': case 'cross': P.ring(g, e.x, e.y - 2, 0.5, 0.15, 0.07, c[7], fade); break;
      case 'hellfire': case 'rage': for (let i = 0; i < 3; i++) P.flame(g, e.x + (i - 1) * 0.4, e.y, 0.8 * fade + 0.2, 0.15, c, k * 30 + i, fade); break;
      case 'void': case 'smoke': P.ellipse(g, e.x, y, 0.7 * (1 - k) + 0.01, 0.5 * (1 - k) + 0.01, '#120828', fade); P.ring(g, e.x, y, 0.8 * k + 0.2, 0.6 * k + 0.15, 0.05, c[6], fade); break;
      case 'prism': for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + k * 3; P.line(g, e.x, y, e.x + Math.cos(an) * 1.2 * k, y + Math.sin(an) * 0.8 * k, 0.05, `hsl(${i * 60},90%,65%)`, fade); } break;
      case 'muzzle': P.star(g, e.x + Math.cos(e.ang) * 0.6, y + 0.3, 0.4 * fade, '#fff3a0', fade, 0.4); break;
      case 'snow': for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + k; P.line(g, e.x, y, e.x + Math.cos(an) * 0.6 * (0.4 + k), y + Math.sin(an) * 0.6 * (0.4 + k), 0.05, c[6], fade); } break;
      case 'gear': P.ring(g, e.x, y, 0.45, 0.45, 0.1, c[5], fade); for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + k * 3; g.globalAlpha = fade; g.fillStyle = c[5]; g.fillRect(e.x + Math.cos(an) * 0.52 - 0.06, y + Math.sin(an) * 0.52 - 0.06, 0.12, 0.12); } break;
      case 'paw': for (let i = 0; i < 4; i++) P.ellipse(g, e.x + (i - 1.5) * 0.22, y - 0.25 - (i % 3 ? 0.08 : 0), 0.09, 0.11, c[6], fade); P.ellipse(g, e.x, y + 0.05, 0.25, 0.2, c[6], fade); break;
      case 'cards': for (let i = 0; i < 3; i++) { g.save(); g.translate(e.x + (i - 1) * 0.35, y - k * 0.6); g.rotate((i - 1) * 0.4); g.globalAlpha = fade; g.fillStyle = '#f4f0e6'; g.fillRect(-0.14, -0.2, 0.28, 0.4); g.fillStyle = i === 1 ? '#d83a3a' : '#2a2a3a'; g.fillRect(-0.05, -0.05, 0.1, 0.1); g.restore(); } break;
      case 'feathers': case 'stars': for (let i = 0; i < 5; i++) { const an = (i / 5) * TAU + k * 2, x2 = e.x + Math.cos(an) * 0.8 * k, y2 = y + Math.sin(an) * 0.5 * k; if (e.style === 'stars') P.star(g, x2, y2, 0.18, c[7], fade, k * 5); else { g.globalAlpha = fade; g.fillStyle = c[7]; g.fillRect(x2 - 0.04, y2 - 0.16, 0.08, 0.32); } } break;
      case 'maw': P.crescent(g, e.x, y - 0.1, 0.5, 0.3, Math.PI - 0.3, 0.12, c[5], fade); P.crescent(g, e.x, y + 0.1, 0.5, Math.PI + 0.3, TAU - 0.3, 0.12, c[5], fade); break;
      case 'storm': P.jag(g, e.x - 0.3, y - 0.6, e.x + 0.2, y + 0.4, e.seed + ((k * 20) | 0), 0.06, c[7], fade); break;
      default: P.star(g, e.x, y, 0.4 * fade, c[6], fade, k * 4);
    }
  };
  DRAW.meteor = (g, e, k) => { const c = e.pal, q = clamp(k * 1.6), x = e.x + (1 - q) * 4, y = e.y - (1 - q) * 9; if (q < 1) { P.ellipse(g, e.x, e.y, 0.6 * q + 0.05, 0.25 * q + 0.02, '#000', 0.35); for (let i = 0; i < 6; i++) P.ellipse(g, x + i * 0.35, y - i * 0.8, 0.5 - i * 0.07, 0.5 - i * 0.07, P.col(c, 6 - i), 0.9 - i * 0.12); P.ellipse(g, x, y, 0.45, 0.45, c[7]); } };
  DRAW.chain = (g, e, k) => { const c = e.pal, q = k < 0.5 ? k * 2 : 2 - k * 2, x1 = e.x + (e.tx - e.x) * q, y1 = e.y + (e.ty - e.y) * q; const n = Math.max(3, Math.round(Math.hypot(x1 - e.x, y1 - e.y) * 3)); for (let i = 0; i < n; i++) { const u = i / n; P.ring(g, e.x + (x1 - e.x) * u, e.y - 0.6 + (y1 - e.y) * u, 0.1, 0.07, 0.04, i % 2 ? c[5] : c[6]); } P.star(g, x1, y1 - 0.6, 0.25, c[7], 1, k * 9); };
  DRAW.blink = (g, e, k) => { const c = e.pal, fade = 1 - k; for (let i = 0; i < 3; i++) P.ring(g, e.x, e.y - 0.7, (0.4 + i * 0.25) * (1 - k * 0.5), (0.8 + i * 0.3) * (1 - k * 0.5), 0.05, c[5 + (i % 3)], fade, k * 6 + i, k * 6 + i + 3); P.ellipse(g, e.x, e.y - 0.7, 0.25 * fade + 0.01, 0.6 * fade + 0.01, c[7], fade * 0.6); };
  DRAW.portal = (g, e, k) => { const c = e.pal, R = Math.max(0.05, e.r * (k < 0.2 ? k / 0.2 : k > 0.85 ? (1 - k) / 0.15 : 1)); P.ellipse(g, e.x, e.y, R, R * FLOOR, '#0a0614'); P.ring(g, e.x, e.y, R, R * FLOOR, 0.1, c[5]); P.ring(g, e.x, e.y, R * 0.8, R * 0.8 * FLOOR, 0.04, c[7], 1, k * 8, k * 8 + 4); for (let i = 0; i < Math.min(6, e.n); i++) { const up = clamp(k * 2 - i * 0.2); if (up <= 0) continue; const x = e.x + (i - (Math.min(6, e.n) - 1) / 2) * 0.5; P.ellipse(g, x, e.y - up * 1.1, 0.22, 0.5 * up, c[3], 0.9); P.ellipse(g, x, e.y - up * 1.1 - 0.5 * up, 0.16, 0.16, c[4]); } };
  DRAW.dash = (g, e, k) => { const c = e.pal, fade = 1 - k; for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5; P.ellipse(g, e.x + (e.tx - e.x) * u, e.y - 0.7 + (e.ty - e.y) * u, 0.2, 0.55, c[4 + (i % 3)], fade * u * 0.8); } P.line(g, e.x, e.y - 0.5, e.tx, e.ty - 0.5, 0.06, '#fff', fade * 0.7); };
  DRAW.heal = (g, e, k) => { const c = e.pal, rr = rngOf(e.seed), fade = 1 - clamp((k - 0.7) / 0.3); P.ring(g, e.x, e.y, e.r * ease.out(k) + 0.05, (e.r * ease.out(k) + 0.05) * FLOOR, 0.07, c[5], fade); for (let i = 0; i < 10; i++) { const a = rr() * TAU, d = rr() * e.r * 0.8, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * FLOOR - k * 1.6 - rr() * 0.4; P.line(g, x - 0.1, y, x + 0.1, y, 0.06, c[6], fade); P.line(g, x, y - 0.1, x, y + 0.1, 0.06, c[6], fade); } };
  DRAW.cloud = (g, e, k) => { const c = e.pal, rr = rngOf(e.seed), fade = 1 - clamp((k - 0.75) / 0.25), R = e.r * ease.out(clamp(k * 3)); for (let i = 0; i < 14; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * R, s = 0.4 + rr() * 0.5 + Math.sin(e.t * 2 + i) * 0.05; P.ellipse(g, e.x + Math.cos(a) * d + Math.sin(e.t + i) * 0.2, e.y + Math.sin(a) * d * FLOOR - 0.4, s, s * 0.6, P.col(c, 2 + (i % 4)), 0.45 * fade); } };
  DRAW.prismflash = (g, e, k) => { const fade = 1 - k; for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU + k * 2; P.line(g, e.x, e.y - 0.6, e.x + Math.cos(an) * 1.4 * ease.out(k), e.y - 0.6 + Math.sin(an) * 0.9 * ease.out(k), 0.07, `hsl(${i * 51},95%,65%)`, fade); } };
  // element particles: each element has its own pixel shape (ember, shard, spark, smoke, feather, leaf, dust, glyph, drop, tick, bubble, swirl, ringlet, twinkle)
  DRAW.motes = (g, e, k) => {
    const c = e.pal, rr = rngOf(e.seed), st = e.style, fade = 1 - clamp((k - 0.55) / 0.45);
    for (let i = 0; i < Math.min(18, e.n); i++) {
      const a = rr() * TAU, sp = 0.4 + rr() * 0.8, d = e.r * sp * ease.out(k), rise = st === 'ember' || st === 'bubble' || st === 'twinkle' || st === 'smoke' ? k * (0.8 + rr()) : st === 'drop' || st === 'shard' || st === 'dust' ? -k * k * 0.6 + k * 0.5 : st === 'feather' || st === 'leaf' ? k * 0.4 : 0;
      const x = e.x + Math.cos(a) * d, y = e.y - 0.6 + Math.sin(a) * d * 0.6 - rise, col = P.col(c, 4 + ((i + (k * 6) | 0) % 4)), s = 0.07 + rr() * 0.05;
      g.globalAlpha = fade; g.fillStyle = col;
      switch (st) {
        case 'ember': g.fillRect(x - s / 2, y - s, s, s * 2); break;
        case 'shard': g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.6, y); g.fill(); break;
        case 'spark': P.line(g, x - s, y, x + s, y, 0.04, col, fade); P.line(g, x, y - s, x, y + s, 0.04, '#fff', fade); break;
        case 'smoke': P.ellipse(g, x, y, s * 1.8 * (0.5 + k), s * 1.4 * (0.5 + k), col, fade * 0.7); break;
        case 'feather': g.save(); g.translate(x, y); g.rotate(Math.sin(k * 8 + i) * 0.8); g.fillRect(-s * 0.3, -s * 1.4, s * 0.6, s * 2.8); g.restore(); break;
        case 'leaf': P.ellipse(g, x, y, s * 1.2, s * 0.6, col, fade); break;
        case 'glyph': P.ring(g, x, y, s * 1.2, s * 1.2, 0.03, col, fade); g.fillRect(x - s * 0.2, y - s * 0.8, s * 0.4, s * 1.6); break;
        case 'drop': P.ellipse(g, x, y, s * 0.7, s, col, fade); break;
        case 'tick': P.ring(g, x, y, s * 1.3, s * 1.3, 0.03, col, fade); P.line(g, x, y, x + Math.cos(k * 9 + i) * s, y + Math.sin(k * 9 + i) * s, 0.03, '#fff', fade); break;
        case 'bubble': P.ring(g, x, y, s, s, 0.03, col, fade); break;
        case 'swirl': P.ring(g, x, y, s * 1.6, s, 0.03, col, fade, k * 9 + i, k * 9 + i + 3); break;
        case 'ringlet': P.ring(g, x, y, s * 1.4 * (1 + k), s * 0.7 * (1 + k), 0.03, col, fade); break;
        case 'twinkle': P.star(g, x, y, s * 1.6 * (0.6 + Math.abs(Math.sin(k * 12 + i)) * 0.6), col, fade, 0); break;
        default: g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  };
  // mechanic zones
  DRAW.orbitfx = (g, e) => { const c = e.pal, T = e.t, fade = e.dur - T < 0.25 ? (e.dur - T) / 0.25 : Math.min(1, T * 5), R = e.r; for (let i = 0; i < e.n; i++) { const an = T * 4 + (i / e.n) * TAU; for (let j = 0; j < 4; j++) { const a2 = an - j * 0.18; P.ellipse(g, e.x + Math.cos(a2) * R, e.y - 0.6 + Math.sin(a2) * R * FLOOR, 0.16 - j * 0.03, 0.16 - j * 0.03, c[7 - j], fade * (1 - j * 0.2)); } } P.ring(g, e.x, e.y, R, R * FLOOR, 0.03, c[4], fade * 0.5); };
  DRAW.wallfx = (g, e) => { const c = e.pal, T = e.t, fade = e.dur - T < 0.25 ? (e.dur - T) / 0.25 : Math.min(1, T * 5), rise = Math.min(1, T * 4); for (let i = 0; i < 3; i++) { const x = e.x + (i - 1) * 0.35; if (e.el === 'fire') P.flame(g, x, e.y, (1 + Math.sin(T * 9 + i) * 0.2) * rise, 0.18, c, T * 10 + i, fade); else if (e.el === 'ice' || e.el === 'water') { g.globalAlpha = fade; g.fillStyle = c[5 + (i % 2)]; g.beginPath(); g.moveTo(x - 0.18, e.y); g.lineTo(x, e.y - 1.2 * rise - i * 0.1); g.lineTo(x + 0.18, e.y); g.fill(); } else { const h = (0.55 + (i % 2) * 0.25) * rise; g.globalAlpha = fade; g.fillStyle = c[3]; g.fillRect(x - 0.16, e.y - h, 0.32, h); g.fillStyle = c[5]; g.fillRect(x - 0.16, e.y - h, 0.32, 0.08); g.fillStyle = c[6]; g.fillRect(x - 0.05, e.y - h * 0.65, 0.1, 0.1); } } };
  DRAW.trailfx = (g, e) => { const c = e.pal, T = e.t, fade = e.dur - T < 0.3 ? (e.dur - T) / 0.3 : 1, rr = rngOf(e.seed); P.ellipse(g, e.x, e.y, e.r * 0.8, e.r * 0.4, c[2], 0.35 * fade); for (let i = 0; i < 5; i++) { const x = e.x + (rr() - 0.5) * e.r, y = e.y + (rr() - 0.5) * e.r * 0.4, ph = rr() * 9; if (e.el === 'fire') P.flame(g, x, y, 0.35 + Math.sin(T * 9 + ph) * 0.1, 0.1, c, T * 9 + ph, fade); else { const up = (T * 0.8 + ph) % 1; P.ellipse(g, x, y - up * 0.6, 0.06, 0.06, c[6], fade * (1 - up)); } } };
  DRAW.impact = (g, e, k) => { const c = e.pal, fade = 1 - k, R = e.r * ease.out(k) + 0.05, y = e.y - 0.6; P.star(g, e.x, y, (e.crit ? 0.8 : 0.5) * (1 - k * 0.6), c[7], fade, e.ang); P.ring(g, e.x, y, R * 0.8, R * 0.6, 0.06, c[5], fade); if (e.crit) for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + e.ang; P.line(g, e.x + Math.cos(an) * R * 0.5, y + Math.sin(an) * R * 0.4, e.x + Math.cos(an) * R * 1.2, y + Math.sin(an) * R, 0.06, '#fff', fade); } };
  DRAW.burst = (g, e, k) => { const c = e.pal, fade = 1 - k, R = e.r * (0.5 + ease.out(k)), y = e.y - 0.5, rr = rngOf(e.seed); P.ellipse(g, e.x, y, R * 0.5 * fade + 0.01, R * 0.4 * fade + 0.01, c[7], fade); for (let i = 0; i < 10; i++) { const an = rr() * TAU, L = R * (0.6 + rr() * 0.6); P.line(g, e.x + Math.cos(an) * L * 0.3, y + Math.sin(an) * L * 0.25, e.x + Math.cos(an) * L, y + Math.sin(an) * L * 0.75, 0.07, c[5 + (i % 3)], fade); } };
  DRAW.blast = (g, e, k) => { const c = e.pal, fade = 1 - clamp((k - 0.3) / 0.7), R = e.r * ease.out3(k) + 0.05, rr = rngOf(e.seed); P.ellipse(g, e.x, e.y - 0.3, R * 0.55, R * 0.45, c[7], 1 - k); for (let i = 0; i < 12; i++) { const an = rr() * TAU, d = R * (0.3 + rr() * 0.6); P.ellipse(g, e.x + Math.cos(an) * d, e.y - 0.4 + Math.sin(an) * d * 0.6 - k * 0.6, R * 0.22 * (1 - k * 0.5), R * 0.2 * (1 - k * 0.5), k > 0.5 ? '#3a3036' : P.col(c, 3 + rr() * 4), fade); } P.ring(g, e.x, e.y, R * 1.1, R * 1.1 * FLOOR, 0.08, c[6], 1 - k); };
  DRAW.shatter = (g, e, k) => { const c = e.el === 'ice' || e.style === 'frost' ? EL_PAL.ice : e.pal, rr = rngOf(e.seed), fade = 1 - k; if (k < 0.3) { g.globalAlpha = 1; g.fillStyle = c[6]; g.beginPath(); g.moveTo(e.x, e.y - 1.2); g.lineTo(e.x + 0.4, e.y - 0.3); g.lineTo(e.x, e.y); g.lineTo(e.x - 0.4, e.y - 0.3); g.fill(); } for (let i = 0; i < 9; i++) { const an = rr() * TAU, d = e.r * ease.out(k) * (0.5 + rr()); const x = e.x + Math.cos(an) * d, y = e.y - 0.6 + Math.sin(an) * d * 0.6 + k * k * 0.8; g.globalAlpha = fade; g.fillStyle = c[5 + (i % 3)]; g.beginPath(); g.moveTo(x, y - 0.12); g.lineTo(x + 0.08, y); g.lineTo(x, y + 0.12); g.lineTo(x - 0.08, y); g.fill(); } };
  DRAW.zap = (g, e, k) => { const c = EL_PAL.lightning, fade = 1 - k; for (let i = 0; i < 4; i++) { const an = (i / 4) * TAU + e.seed; P.jag(g, e.x, e.y - 0.6, e.x + Math.cos(an) * e.r, e.y - 0.6 + Math.sin(an) * e.r * 0.7, e.seed + i + ((k * 20) | 0), 0.06, i % 2 ? c[6] : '#fff', fade, 0.2); } P.ellipse(g, e.x, e.y - 0.6, 0.3 * fade + 0.01, 0.3 * fade + 0.01, c[7], fade); };
  DRAW.implode = (g, e, k) => { const c = e.pal, R = e.r * (1 - ease.out(k)) + 0.1, fade = 1 - clamp((k - 0.7) / 0.3); P.ring(g, e.x, e.y - 0.5, R * 1.2, R, 0.1, c[5], fade); P.ellipse(g, e.x, e.y - 0.5, 0.3, 0.3, '#08020f', fade); for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + k * 4; P.line(g, e.x + Math.cos(an) * R * 1.4, e.y - 0.5 + Math.sin(an) * R * 1.1, e.x + Math.cos(an) * R * 0.6, e.y - 0.5 + Math.sin(an) * R * 0.5, 0.05, c[6], fade); } };
  DRAW.splash = (g, e, k) => { const c = e.pal, rr = rngOf(e.seed), fade = 1 - k; P.ring(g, e.x, e.y, e.r * ease.out(k) + 0.05, (e.r * ease.out(k) + 0.05) * FLOOR, 0.07, c[6], fade); for (let i = 0; i < 10; i++) { const an = Math.PI + rr() * Math.PI, v = 1 + rr(); P.ellipse(g, e.x + Math.cos(an) * v * k, e.y - 0.3 + Math.sin(an) * v * k * 1.4 + k * k * 2, 0.08, 0.08, c[5 + (i % 3)], fade); } };
  DRAW.crater = (g, e, k) => { const c = e.pal, fade = 1 - clamp((k - 0.5) / 0.5), rr = rngOf(e.seed); P.ellipse(g, e.x, e.y, e.r, e.r * FLOOR, '#2a1c14', 0.6 * fade); for (let i = 0; i < 8; i++) { const an = rr() * TAU, d = e.r * (0.7 + rr() * 0.4); g.globalAlpha = fade; g.fillStyle = i % 2 ? '#7a6248' : '#4f3f2c'; const x = e.x + Math.cos(an) * d, y = e.y + Math.sin(an) * d * FLOOR, h = 0.3 + rr() * 0.3; g.beginPath(); g.moveTo(x - 0.15, y); g.lineTo(x, y - h * ease.out(clamp(k * 4))); g.lineTo(x + 0.15, y); g.fill(); } P.ring(g, e.x, e.y, e.r * ease.out(k) * 1.3 + 0.05, (e.r * ease.out(k) * 1.3 + 0.05) * FLOOR, 0.06, c[5], 1 - k); };
  DRAW.gust = (g, e, k) => { const c = e.pal, fade = 1 - k; for (let i = 0; i < 3; i++) { const y = e.y - 0.2 - k * 1.8 - i * 0.35, R = 0.5 - i * 0.1; P.ring(g, e.x, y, R, R * 0.35, 0.05, c[6 - i], fade, k * 10 + i, k * 10 + i + 4); } };
  DRAW.poof = (g, e, k) => { const rr = rngOf(e.seed), fade = 1 - k; for (let i = 0; i < 9; i++) { const an = rr() * TAU, d = e.r * ease.out(k) * (0.4 + rr() * 0.6); P.ellipse(g, e.x + Math.cos(an) * d, e.y - 0.4 + Math.sin(an) * d * 0.6 - k * 0.6, 0.25 * (1 - k * 0.5), 0.22 * (1 - k * 0.5), ['#d8d4e0', '#a8a4b4', '#7a7688'][i % 3], fade); } };
  DRAW.status = (g, e) => {
    const T = e.t, x = e.x, y = e.y, s = e.size || 1, fade = e.dur - e.t < 0.25 ? (e.dur - e.t) / 0.25 : Math.min(1, T * 4);
    switch (e.style) {
      case 'fire': for (let i = 0; i < 3; i++) P.flame(g, x + (i - 1) * 0.25 * s, y - 0.1, (0.5 + Math.sin(T * 9 + i * 2) * 0.12) * s, 0.12 * s, EL_PAL.fire, T * 12 + i * 3, fade); break;
      case 'ice': for (let i = 0; i < 5; i++) { const an = (i / 5) * Math.PI + 0.3; g.globalAlpha = fade * 0.9; g.fillStyle = i % 2 ? '#9bdcff' : '#dff6ff'; g.beginPath(); g.moveTo(x + Math.cos(an) * 0.35 * s - 0.08, y); g.lineTo(x + Math.cos(an) * 0.45 * s, y - (0.5 + (i % 3) * 0.2) * s); g.lineTo(x + Math.cos(an) * 0.35 * s + 0.08, y); g.fill(); } break;
      case 'poison': for (let i = 0; i < 4; i++) { const up = (T * 0.8 + i * 0.25) % 1; P.ellipse(g, x + Math.sin(i * 2 + T) * 0.3 * s, y - 0.8 * s - up * 0.8, 0.07 * (1 - up) + 0.01, 0.07 * (1 - up) + 0.01, '#86e04a', fade); } break;
      case 'blood': for (let i = 0; i < 3; i++) { const dn = (T * 1.2 + i * 0.33) % 1; P.ellipse(g, x + (i - 1) * 0.2, y - 1 * s + dn * 1 * s, 0.05, 0.08, '#c81e32', fade * (1 - dn)); } break;
      case 'stars': for (let i = 0; i < 3; i++) { const an = T * 4 + (i / 3) * TAU; P.star(g, x + Math.cos(an) * 0.4, y - 2 * s + Math.sin(an) * 0.12, 0.12, '#ffe85a', fade, T * 5); } break;
      case 'curse': for (let i = 0; i < 3; i++) { const up = (T * 0.5 + i / 3) % 1; P.ellipse(g, x + Math.sin(T * 2 + i) * 0.25, y - 1.6 * s - up * 0.6, 0.14 * (1 - up) + 0.01, 0.12 * (1 - up) + 0.01, i % 2 ? '#6c3cc8' : '#2a1248', fade); } break;
      case 'slow': P.ring(g, x, y, 0.55 * s, 0.22 * s, 0.05, '#7cc8ff', fade, T * 2, T * 2 + 4); break;
      case 'blind': P.line(g, x - 0.35 * s, y - 1.65 * s, x + 0.35 * s, y - 1.65 * s, 0.14, '#1a1022', fade * 0.9); break;
      case 'silence': P.ellipse(g, x + 0.3, y - 1.9 * s, 0.16, 0.12, '#e8e8f0', fade); P.line(g, x + 0.2, y - 1.95 * s, x + 0.4, y - 1.85 * s, 0.04, '#c03030', fade); break;
      case 'shock': if (((T * 14) | 0) % 3 === 0) P.jag(g, x - 0.3 * s, y - 1.2 * s, x + 0.3 * s, y - 0.3 * s, e.seed + ((T * 14) | 0), 0.05, '#c8f0ff', fade, 0.25); break;
      case 'halo': P.ring(g, x, y - 2 * s, 0.35, 0.1, 0.06, '#ffe98a', fade); break;
      case 'mark': P.ring(g, x, y - 0.9 * s, 0.5, 0.5, 0.04, '#ff4060', fade * 0.8); P.line(g, x - 0.6, y - 0.9 * s, x - 0.35, y - 0.9 * s, 0.04, '#ff4060', fade); P.line(g, x + 0.35, y - 0.9 * s, x + 0.6, y - 0.9 * s, 0.04, '#ff4060', fade); break;
      case 'wet': { const dn = (T * 1.5) % 1; P.ellipse(g, x + 0.2, y - 1.5 * s + dn * 1.2 * s, 0.05, 0.07, '#78ccf4', fade * (1 - dn)); break; }
      case 'root': for (let i = 0; i < 4; i++) { const an = (i / 4) * TAU + 0.4; P.line(g, x + Math.cos(an) * 0.35, y + Math.sin(an) * 0.15, x + Math.cos(an) * 0.15, y - 0.5 * s, 0.06, '#3a8a3a', fade); } break;
      case 'crack': P.jag(g, x - 0.2, y - 1.3 * s, x + 0.2, y - 0.6 * s, e.seed, 0.04, '#c8c8d0', fade * 0.7, 0.15); break;
    }
  };
  const lightCol = (e) => { const c = (e.pal && e.pal[6]) || '#ffffff'; const v = parseInt(c.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

  // ------------------------------------------------------------------ frame
  VFX.drawGround = function (g) {
    const now = performance.now() / 1000;
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i], age = now - d.t0;
      if (age > d.life) { decals.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, age * 8) * Math.min(1, (d.life - age) / 2);
      g.drawImage(d.cv, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
    }
    g.globalAlpha = 1;
  };
  /** Advance and draw. g is in world-tile space; the pixel layer is composited in screen space using the view. */
  VFX.draw = function (g, dt) {
    hitBudget = Math.max(0, hitBudget - dt * 30); basicBudget = Math.max(0, basicBudget - dt * 12);
    if (hitStop > 0) { hitStop -= dt; dt = 0; }
    const G = root.G;
    if (dim > 0.01 && G) { g.fillStyle = `rgba(4,2,12,${dim})`; g.fillRect(G.cam.x - 60, G.cam.y - 40, 120, 80); dim *= Math.pow(0.18, dt || 0.016); }
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      if (e.follow && G && G.ents) { const en = G.ents.get(e.follow); if (en) { e.x = en.x; e.y = en.y; } else if (e.k === 'status') e.dur = 0; }
      if (e.t >= 0 && !e.started) { e.started = true; landed(e); }
      if (e.t > e.dur) live.splice(i, 1);
    }
    g.globalCompositeOperation = 'lighter';
    for (const e of live) {
      if (e.t < 0 || e.noLight) continue;
      const lk = (LIGHT_K[e.k] || 0) * (e.big ? 1.3 : 1) * 0.55; if (!lk || e.el === 'dark') continue;
      const k = e.t / e.dur, env = k < 0.1 ? k / 0.1 : 1 - k, a = Math.min(0.4, lk * env * 0.45); if (a < 0.02) continue;
      let x = e.x, y = e.y; if (e.k === 'proj') { x += (e.tx - e.x) * k; y += (e.ty - e.y) * k; }
      const R = Math.min(5, 1 + (e.r || 1) * 0.9) * (e.big ? 1.3 : 1), c = lightCol(e), gr = g.createRadialGradient(x, y - 0.4, 0, x, y - 0.4, R);
      gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - R, y - 0.4 - R, R * 2, R * 2);
    }
    g.globalCompositeOperation = 'source-over';
    if (view && (live.length || debris.length)) {
      const px = view.scale / PPT;
      const w = Math.ceil(view.W / px) + 2, h = Math.ceil(view.H / px) + 2;
      ensureLayer(w, h);
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, w, h); lg.globalAlpha = 1;
      lg.setTransform(PPT, 0, 0, PPT, view.ox / px, view.oy / px);
      // pixel-art timing: poses step at 14 fps (projectiles/zones at 30) like hand-drawn sprite effects
      for (const e of live) {
        if (e.t < 0 || e.k === 'chrono') continue; const f = DRAW[e.k]; if (!f) continue; // clockwork is drawn smooth, below
        const fps = e.k === 'proj' || e.k === 'status' || e.k.endsWith('fx') ? 24 : 12, tr = e.t, tq = Math.floor(tr * fps) / fps;
        e.t = tq; try { f(lg, e, clamp(tq / e.dur)); } catch (err) { e.dur = 0; } e.t = tr;
      }
      // pixel particles share the layer so they get the same crisp look
      const ps = 2 / 24;
      for (const p of debris) { const t = p.t, a = t.fade || t.glow ? Math.max(0, 1 - p.age / p.life) : p.age > p.life - 0.25 ? (p.life - p.age) / 0.25 : 1, sz = ps * t.s; if (p.z > 0.05 && !t.glow) { lg.globalAlpha = 0.25 * a; lg.fillStyle = '#000'; lg.fillRect(p.x - sz / 2, p.y - sz / 4, sz, sz / 2); } lg.globalAlpha = clamp(a); lg.fillStyle = p.c; if (t.streak) lg.fillRect(p.x - sz / 2, p.y - p.z - sz, sz, sz * 3); else lg.fillRect(p.x - sz / 2, p.y - p.z - sz / 2, sz, sz); }
      lg.globalAlpha = 1;
      setPalettes(live.filter((e) => e.t >= 0).map((e) => e.pal).concat(debris.length ? [debris.slice(0, 40).map((p) => p.c)] : []));
      crisp();
      // bloom: a soft quarter-size copy added on top makes the bright pixels glow
      if (!bloom) { bloom = document.createElement('canvas'); bgc = bloom.getContext('2d'); }
      const bw = Math.max(1, Math.ceil(w / 4)), bh = Math.max(1, Math.ceil(h / 4));
      if (bloom.width !== bw || bloom.height !== bh) { bloom.width = bw; bloom.height = bh; }
      // soft glow (medium + high): the effect layer shrunk to 1/4 and blurred, then added back on top — a haze of light
      const glowK = root.G && G.fx ? G.fx().glow || 0 : 0.5;
      if (glowK) { bgc.clearRect(0, 0, bw, bh); bgc.filter = 'blur(2px)'; bgc.imageSmoothingEnabled = true; bgc.drawImage(layer, 0, 0, bw, bh); bgc.filter = 'none'; }
      g.save(); g.setTransform(view.dpr, 0, 0, view.dpr, view.sx || 0, view.sy || 0);
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      g.drawImage(layer, 0, 0, w * px, h * px);
      if (lightOn && lightCv && (!root.G || !G.fx || G.fx().glow)) { g.imageSmoothingEnabled = false; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
      g.drawImage(lightCv, 0, 0, w * px, h * px); lightOn = false; }
      if (glowK) { g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'lighter'; g.globalAlpha = glowK; g.drawImage(bloom, 0, 0, bw * 4 * px, bh * 4 * px); g.globalAlpha = glowK * 0.55; g.drawImage(bloom, -bw * px, -bh * px, bw * 6 * px, bh * 6 * px); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // clockwork (Chronomancer): drawn at full resolution with smooth edges and its own brass / enamel colours
      g.imageSmoothingEnabled = true; g.save(); g.translate(view.ox, view.oy); g.scale(view.scale, view.scale);
      for (const e of live) { if (e.k !== 'chrono' || e.t < 0) continue; try { DRAW.chrono(g, e, clamp(e.t / e.dur)); } catch (err) { e.dur = 0; } }
      g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // crisp pixel sprites (arrows) on top, in world position, nearest-neighbour scaled
      g.imageSmoothingEnabled = false;
      for (const sp of sprites) {
        const w = sp.len * view.scale, s1 = w / sp.img.width;
        g.save(); g.translate(view.ox + sp.x * view.scale, view.oy + sp.y * view.scale); g.rotate(sp.a);
        g.drawImage(sp.img, -w * 0.72, -sp.img.height * s1 / 2, w, sp.img.height * s1); g.restore();
      }
      sprites.length = 0;
      g.imageSmoothingEnabled = sm; g.restore();
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i], t = p.t;
      p.age += dt;
      if (p.age >= p.life) { debris.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= t.g * dt;
      if (p.z < 0) { if (t.bounce && p.vz < -1.5) { p.z = 0; p.vz = -p.vz * t.bounce; p.vx *= 0.6; p.vy *= 0.6; } else { p.z = 0; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; } }
    }
    g.globalAlpha = 1;
  };
  VFX.clearOthers = function () { live.length = 0; };
  VFX.clear = function () { live.length = 0; statusLive.clear(); zoneLive.clear(); decals.length = 0; debris.length = 0; dim = 0; hitStop = 0; };
  VFX.debris = debris; VFX.decals = decals;
})(typeof window !== 'undefined' ? window : globalThis);

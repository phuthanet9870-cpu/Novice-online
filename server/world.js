// World simulation: instances (maps), entities, spatial grid, monster AI, snapshots, tick loop.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const M = require('../shared/mapgen.js');
const RNG = require('../shared/rng.js');
const db = require('./db');
const C = require('./combat');
const I = require('./items');
const A = require('./auto');
const S = require('./social');

const W = Object.assign(module.exports, {
  instances: new Map(), players: new Map(), // charId -> player entity
  nextEnt: 1, tickN: 0, flags: {}, // per-map GM flags {pvp, noAuto, weather}
  rand: RNG.rng(Date.now() & 0xffffffff)
});
const now = () => Date.now() / 1000;
W.now = now;
const CELL = 8;
const VIEW_X = 34, VIEW_Y = 24;
const TAG_BIT = {}; D.TAG_IDS.forEach((t, i) => (TAG_BIT[t] = 1 << i));

// ------------------------------------------------------------------ Instances
class Instance {
  constructor(id) {
    this.id = id;
    this.mapId = id.split('#')[0];
    this.def = M.getMapDef(this.mapId);
    this.map = M.getMap(this.mapId);
    this.entities = new Map();
    this.cells = new Map();
    this.players = new Set();
    this.timers = [];
    this.fx = [];
    this.lastActive = now();
    this.spawned = false;
    this.kills = 0; this.mobTotal = 0; this.stairsOpen = false;
    this.r = RNG.rng(RNG.hashStr(id) ^ (Date.now() & 0xffff));
  }
  get pvp() {
    const f = W.flags[this.mapId] || {};
    if (f.pvp !== undefined) return f.pvp;
    if (this.def.pvp || this.def.pk) return true;
    if (this.def.kind === 'castle' && S.gvgActive()) return true;
    if (this.def.kind === 'wb' && S.worldBossAlive()) return true;
    return false;
  }
  get autoAllowed() {
    const f = W.flags[this.mapId] || {};
    if (f.noAuto !== undefined) return !f.noAuto;
    return !this.def.noAuto && this.def.kind !== 'castle';
  }
  cellKey(x, y) { return ((x / CELL) | 0) + ((y / CELL) | 0) * 4096; }
  add(e) {
    e.inst = this; this.entities.set(e.id, e);
    e.cell = this.cellKey(e.x, e.y);
    let s = this.cells.get(e.cell); if (!s) this.cells.set(e.cell, (s = new Set())); s.add(e);
    if (e.kind === 'p') { this.players.add(e); this.lastActive = now(); }
  }
  remove(e) {
    this.entities.delete(e.id);
    const s = this.cells.get(e.cell); if (s) s.delete(e);
    if (e.kind === 'p') this.players.delete(e);
  }
  moveTo(e, x, y) {
    e.x = x; e.y = y;
    const k = this.cellKey(x, y);
    if (k !== e.cell) {
      const s = this.cells.get(e.cell); if (s) s.delete(e);
      let n = this.cells.get(k); if (!n) this.cells.set(k, (n = new Set())); n.add(e);
      e.cell = k;
    }
  }
  query(x, y, rx, ry, fn) {
    ry = ry === undefined ? rx : ry;
    const x0 = Math.max(0, ((x - rx) / CELL) | 0), x1 = ((x + rx) / CELL) | 0;
    const y0 = Math.max(0, ((y - ry) / CELL) | 0), y1 = ((y + ry) / CELL) | 0;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const s = this.cells.get(cx + cy * 4096); if (!s) continue;
      for (const e of s) if (Math.abs(e.x - x) <= rx && Math.abs(e.y - y) <= ry) fn(e);
    }
  }
  inRadius(x, y, r, fn) { this.query(x, y, r, r, (e) => { if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) fn(e); }); }
  after(sec, fn) { this.timers.push({ at: now() + sec, fn }); }
  emit(fx) { this.fx.push(fx); }
}
W.Instance = Instance;

W.getInstance = function (id, create = true) {
  let inst = W.instances.get(id);
  if (!inst && create) {
    if (!M.getMapDef(id.split('#')[0])) return null;
    inst = new Instance(id);
    W.instances.set(id, inst);
  }
  return inst;
};

// ------------------------------------------------------------------ Entity helpers
W.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
W.byId = function (inst, id) { return inst.entities.get(id); };
W.findPlayerByName = function (name) {
  const n = String(name || '').toLowerCase();
  for (const p of W.players.values()) if (p.name.toLowerCase() === n) return p;
  return null;
};

function familyColor(biome, name) {
  const h = RNG.hashStr(biome + name);
  const hue = h % 360, sat = 45 + (h >> 9) % 35, lit = 45 + (h >> 17) % 18;
  return `hsl(${hue},${sat}%,${lit}%)`;
}

W.spawnMonster = function (inst, spec) {
  const st = F.monsterStats(spec.lv, spec.rank);
  const fam = spec.fam;
  const m = {
    id: W.nextEnt++, kind: 'm', name: spec.name || fam[0], lv: spec.lv, rank: spec.rank, shape: fam[1], beh: fam[2],
    aggro: spec.rank >= 1 ? true : !!fam[3], element: fam[4] || 'neutral', color: spec.color || familyColor(inst.def.biome, fam[0]),
    x: spec.x, y: spec.y, sx: spec.x, sy: spec.y, hp: st.maxHp, maxHp: st.maxHp, atk: st.atk, def: st.def, mdef: st.mdef,
    exp: st.exp, zeny: st.zeny, size: st.size, tags: new Map(), target: null, atkReady: 0, state: 'idle', wanderAt: 0,
    speed: (fam[2] === 'melee' ? 2.6 : 2.2) * (spec.rank === 1 ? 1.15 : 1) * (spec.rank >= 2 ? 1.1 : 1),
    range: fam[2] === 'melee' ? 1.2 + Math.min(3, st.size) * 0.35 : 6, /* huge bosses keep a fair melee reach */ dmgBy: new Map(), spawnRef: spec.spawnRef || null,
    stagger: 100, staggerMax: spec.rank >= 2 ? 100 : 0, phase: 0, skillAt: now() + 6, owner: null, ccDR: {}
  };
  if (spec.rank === 4) m.speed = 2.0;
  if (spec.extra) Object.assign(m, spec.extra);
  if (!m.spr && D.MON_SPRITES && D.MON_SPRITES[fam[0]]) m.spr = D.MON_SPRITES[fam[0]];
  m.sp = spec.sp || W.speciesFor(inst, m, fam);
  inst.add(m);
  return m;
};

// which bestiary species a monster is (decides its drop table)
W.speciesFor = function (inst, m, fam) {
  const def = inst.def;
  if (m.rank === 4) { const wb = D.WORLD_BOSSES.find((b) => b.name === fam[0] || m.name.startsWith(b.name)); if (wb) return 'wb.' + wb.id; }
  if (def.kind === 'farm') {
    if (m.fieldBoss) return def.id + '.boss';
    const fi = D.FAMILIES[def.biome].indexOf(fam); if (fi >= 0) return def.id + '.' + fi;
  }
  if (def.kind === 'dungeon') {
    if (m.floorBoss) return def.dungeon + '.boss';
    const dg = D.DUNGEONS.find((d) => d.id === def.dungeon), fi = D.FAMILIES[dg.biome].indexOf(fam);
    if (fi >= 0) return def.dungeon + '.' + fi;
    const ai = D.FAMILIES.abyss.indexOf(fam); if (ai >= 0) return 'abyssal_throne.' + ai;
  }
  // anywhere else (GM spawns, castles, arenas): the first species of that family whose level fits best
  let best = null, bd = 1e9;
  for (const id in D.SPECIES) { const s = D.SPECIES[id]; if (s.fam[0] !== fam[0] || s.kind !== 'field') continue; const d = Math.abs(s.lv - m.lv); if (d < bd) { bd = d; best = id; } }
  return best;
};
// ------------------------------------------------------------------ Spawning per map
function famsFor(biome) { return D.FAMILIES[biome] || D.FAMILIES.meadow; }
W.populate = function (inst) {
  if (inst.spawned) return;
  inst.spawned = true;
  const def = inst.def, map = inst.map, r = inst.r;
  if (def.kind === 'town') {
    for (const n of map.npcs) inst.add({ id: W.nextEnt++, kind: 'n', name: n.name, th: n.th, role: n.role, color: n.color, x: n.x, y: n.y, tags: new Map(), hp: 1, maxHp: 1 });
    addGates(inst);
    return;
  }
  if (def.kind === 'farm') {
    const fams = famsFor(def.biome);
    let walkN = 0; for (let i = 0; i < map.walk.length; i++) walkN += map.walk[i];
    const count = Math.round(walkN / 230);
    inst.spawns = [];
    for (let i = 0; i < count; i++) {
      const p = M.randomWalkable(map, r);
      if (Math.hypot(p.x - map.spawn.x, p.y - map.spawn.y) < 10) continue;
      const fi = i % fams.length;
      const elite = r() < 0.035;
      const lv = r.int(def.min, def.max);
      const sp = { fam: fams[fi], lv, rank: elite ? 1 : 0, x: p.x, y: p.y };
      sp.name = (elite ? 'Elite ' : '') + D.MONSTER_PREFIX[Math.min(9, Math.floor(def.idx / 2.6))] + fams[fi][0];
      sp.spawnRef = sp;
      inst.spawns.push(sp);
      W.spawnMonster(inst, sp);
    }
    S.initFieldBoss(inst);
    // a return portal near spawn
    addGates(inst);
    return;
  }
  if (def.kind === 'dungeon') {
    // difficulty keeps climbing with the floor even after monster level caps (320): HP / ATK / DEF multipliers,
    // and a party-private instance is tuned to the party's size (+35% HP and +8% ATK per extra member)
    const ptKey = /#pt(\d+)$/.exec(inst.id || inst.mapId || '');
    const pt = ptKey && S.parties && S.parties.get(+ptKey[1]);
    const members = pt ? Math.max(1, pt.members.size) : 1;
    const fl = def.floor;
    inst.diff = { hp: (1 + fl / 160) * (1 + 0.35 * (members - 1)), atk: (1 + fl / 320) * (1 + 0.08 * (members - 1)), def: 1 + fl / 400, members };
    const spawnMonster = (i2, spec) => { const m = W.spawnMonster(i2, spec); const d = inst.diff; m.maxHp = m.hp = Math.round(m.maxHp * d.hp); m.atk = Math.round(m.atk * d.atk); m.def = Math.round(m.def * d.def); m.mdef = Math.round(m.mdef * d.def); return m; };
    const dg = D.DUNGEONS.find((d) => d.id === def.dungeon);
    const fams = famsFor(dg.biome);
    const extra = def.floor % 100 === 0 ? 'abyss' : null;
    const count = 14 + Math.floor(def.floor / 40) + map.rooms.length;
    let n = 0;
    for (let i = 1; i < map.rooms.length; i++) {
      const rm = map.rooms[i];
      const per = Math.max(2, Math.round(count / (map.rooms.length - 1) * Math.min(2.2, rm.w * rm.h / 150))); // bigger halls hold bigger packs
      for (let k = 0; k < per; k++) {
        const x = r.int(rm.x + 1, rm.x + rm.w - 1) + 0.5, y = r.int(rm.y + 1, rm.y + rm.h - 1) + 0.5;
        if (!M.walkable(map, x, y)) continue;
        const fam = r.pick(extra && r() < 0.3 ? famsFor(extra) : fams);
        const elite = r() < 0.04 + Math.min(0.2, def.floor / 4000);
        spawnMonster(inst, { fam, lv: def.lv, rank: elite ? 1 : 0, x, y, name: (elite ? 'Elite ' : '') + fam[0], extra: { noRespawn: true } });
        n++;
      }
    }
    if (def.boss) {
      const s = map.stairs;
      const fam = r.pick(fams);
      const title = D.BOSS_TITLES[(def.floor / 10) % D.BOSS_TITLES.length | 0];
      const big = def.floor % 100 === 0;
      const spr = D.BOSS_SPRITES.dungeon[def.dungeon];
      spawnMonster(inst, { fam, lv: def.lv + (big ? 5 : 2), rank: big ? 2 : 3, x: s.x + 2, y: s.y + 2, name: spr ? `${D.BOSS_NAMES[spr]}${big ? ' (Ascended)' : ''}` : `${fam[0]} ${title}`, extra: { noRespawn: true, floorBoss: true, spr } });
      n++;
    }
    inst.mobTotal = n;
    inst.add({ id: W.nextEnt++, kind: 'n', name: 'Stairs (sealed)', role: 'stairs', color: '#a080ff', x: map.stairs.x, y: map.stairs.y, tags: new Map(), hp: 1, maxHp: 1 });
    if (def.floor > 1) { const s = W.freeSpot(map, map.spawn.x, map.spawn.y - 2.5); inst.add({ id: W.nextEnt++, kind: 'n', name: `Stairs ↑ Floor ${def.floor - 1}`, role: 'stairsUp', color: '#7fd0ff', x: s.x, y: s.y, tags: new Map(), hp: 1, maxHp: 1 }); }
    require('./chests').populate(inst, map);
    return;
  }
  if (def.kind === 'castle') { S.initCastle(inst); return; }
  if (def.kind === 'wb') { S.initWorldBossArena(inst); return; }
  if (def.kind === 'training') {
    const cx = map.w / 2, cy = map.h / 2;
    const dummies = [[1, 0, 'neutral'], [50, 0, 'neutral'], [100, 0, 'neutral'], [150, 0, 'neutral'], [200, 0, 'neutral'], [250, 0, 'neutral'], [150, 2, 'neutral'],
      [120, 0, 'fire'], [120, 0, 'ice'], [120, 0, 'water'], [120, 0, 'lightning'], [120, 0, 'earth'], [120, 0, 'holy'], [120, 0, 'dark']];
    dummies.forEach(([lv, rank, el], i) => {
      const row = i < 7 ? -6 : 6, col = (i % 7) - 3;
      const name = rank >= 2 ? `Boss Dummy Lv${lv}` : el !== 'neutral' ? `${D.ELEMENTS[el].n} Dummy Lv${lv}` : `Training Dummy Lv${lv}`;
      const m = W.spawnMonster(inst, { fam: ['Training Dummy', 'dummy', 'none', 0, el], lv, rank, x: cx + col * 5, y: cy + row, name, color: el === 'neutral' ? '#c8a060' : D.ELEMENTS[el].color, extra: { noRespawn: true, dummy: true, aggro: false } });
      m.maxHp = m.hp = m.maxHp * 40;
    });
    inst.add({ id: W.nextEnt++, kind: 'n', name: 'Waygate → เมือง', role: 'portal', dest: 'town', color: '#7fd0ff', x: cx + 0.5, y: cy + 14, tags: new Map(), hp: 1, maxHp: 1 });
    map.spawn = { x: cx + 0.5, y: cy + 11 };
    return;
  }
};

// ------------------------------------------------------------------ Movement
function tryMove(inst, e, nx, ny) {
  const map = inst.map;
  if (M.walkable(map, nx, ny)) { inst.moveTo(e, nx, ny); return true; }
  if (M.walkable(map, nx, e.y)) { inst.moveTo(e, nx, e.y); return true; }
  if (M.walkable(map, e.x, ny)) { inst.moveTo(e, e.x, ny); return true; }
  return false;
}
W.tryMove = tryMove;
W.speedOf = function (e) {
  let s = e.kind === 'p' ? e.st.move * (e.speedMul || 1) : e.speed;
  if (e.tags.has('slow')) s *= 0.55;
  if (e.tags.has('chill')) s *= 1 - 0.15 * e.tags.get('chill').stacks;
  return s;
};
W.canMove = function (e) { return !e.dead && !C.isHardCC(e) && !e.tags.has('root') && !(e.casting); };
// Steer toward (tx,ty), using A* when line is blocked. Returns true if arrived.
W.stepToward = function (e, tx, ty, dt, stopDist = 0.2) {
  const inst = e.inst;
  const d = Math.hypot(tx - e.x, ty - e.y);
  if (d <= stopDist) return true;
  if (!W.canMove(e)) return false;
  let gx = tx, gy = ty;
  const t = now();
  if (!M.clearLine(inst.map, e.x, e.y, tx, ty)) {
    if (!e.path || e.pathGoal !== ((tx | 0) + ',' + (ty | 0)) || t > e.pathAt + 1.5) {
      e.path = M.findPath(inst.map, e.x, e.y, tx, ty, e.kind === 'p' ? (Math.hypot(tx - e.x, ty - e.y) > 40 ? 40000 : 8000) : 1600) || [];
      if (e.kind === 'p' && e.path.length) e.pathAt += Math.min(4, Math.hypot(tx - e.x, ty - e.y) / 20); // long routes are re-planned less often
      e.pathGoal = (tx | 0) + ',' + (ty | 0); e.pathAt = t;
    }
    while (e.path.length && Math.hypot(e.path[0][0] - e.x, e.path[0][1] - e.y) < 0.35) e.path.shift();
    if (e.path.length) { gx = e.path[0][0]; gy = e.path[0][1]; } else return false;
  } else e.path = null;
  const gd = Math.hypot(gx - e.x, gy - e.y) || 1;
  const step = Math.min(gd, W.speedOf(e) * dt);
  e.dir = Math.atan2(gy - e.y, gx - e.x);
  return tryMove(inst, e, e.x + (gx - e.x) / gd * step, e.y + (gy - e.y) / gd * step) && false;
};

// ------------------------------------------------------------------ Monster AI
function nearestEnemy(e, range, pred) {
  let best = null, bd = range * range;
  e.inst.inRadius(e.x, e.y, range, (o) => {
    if (o === e || o.dead || !C.isEnemy(e, o)) return;
    if (o.kind === 'p' && (o.hidden || o.god || (o.gmf && o.gmf.peace) || C.stealthed(o))) return;
    if (pred && !pred(o)) return;
    const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  });
  return best;
}
W.nearestEnemy = nearestEnemy;

function updateMonster(m, dt, t) {
  if (m.dummy) { m.target = null; if (t - (m.lastHitAt || 0) > 4 && m.hp < m.maxHp) { m.hp = m.maxHp; m.tags.clear(); } return; }
  if (m.dead || m.rank === 6 || m.pillar) return;
  if (C.isHardCC(m)) return;
  const inst = m.inst;
  if (m.target && (m.target.dead || m.target.inst !== inst || (m.target.kind === 'p' && (C.stealthed(m.target) || m.target.hidden)) || W.dist(m, m.target) > 22)) m.target = null;
  if (m.tauntBy && t < m.tauntUntil && !m.tauntBy.dead && m.tauntBy.inst === inst) m.target = m.tauntBy;
  if (!m.target && m.aggro && t >= (m.scanAt || 0) && m.state !== 'return') {
    m.scanAt = t + 0.6;
    m.target = nearestEnemy(m, m.rank >= 1 ? 9 : 6.5);
  }
  const leash = m.rank >= 2 ? 32 : 18;
  if (m.state !== 'return' && Math.hypot(m.x - m.sx, m.y - m.sy) > leash && !m.owner) { m.state = 'return'; m.target = null; }
  if (m.state === 'return') {
    if (W.stepToward(m, m.sx, m.sy, dt * 1.6, 0.5) || Math.hypot(m.x - m.sx, m.y - m.sy) < 0.6) { m.state = 'idle'; m.hp = m.maxHp; m.dmgBy.clear(); }
    return;
  }
  if (m.rank >= 2 && m.target) S.bossAbilities(m, t);
  if (m.target) {
    const d = W.dist(m, m.target);
    const range = m.range + (m.target.kind === 'm' ? m.target.size * 0.3 : 0);
    if (d > range) { W.stepToward(m, m.target.x, m.target.y, dt, range * 0.8); }
    else if (t >= m.atkReady && !m.tags.has('silence')) {
      m.dir = Math.atan2(m.target.y - m.y, m.target.x - m.x);
      const blind = m.tags.has('blind') && W.rand() < 0.5;
      m.atkReady = t + (m.rank === 1 ? 1.35 : m.rank >= 2 ? 1.2 : 1.7) * (m.tags.has('chill') ? 1.3 : 1);
      if (m.beh === 'melee') {
        inst.emit({ k: 'swing', s: m.id, x: m.x, y: m.y, tx: m.target.x, ty: m.target.y });
        if (!blind) C.dealDamage(m, m.target, { mult: 1, el: m.element, kind: 'mob' });
      } else {
        const tg = m.target;
        inst.emit({ k: 'proj', s: m.id, x: m.x, y: m.y, tx: tg.x, ty: tg.y, el: m.element });
        inst.after(0.25, () => {
          if (tg.dead || tg.inst !== inst || m.dead) return;
          C.dealDamage(m, tg, { mult: m.beh === 'caster' ? 1.15 : 0.95, el: m.element, kind: 'mob', mag: m.beh === 'caster' });
          if (m.beh === 'caster' && W.rand() < 0.25) {
            const tg2 = { fire: 'burn', ice: 'chill', water: 'wet', lightning: 'shock', poison: 'poison', dark: 'curse', holy: 'holybrand', blood: 'bleed' }[m.element];
            if (tg2) C.applyTag(tg, tg2, 1, D.TAGS[tg2].dur * 0.7, m);
          }
        });
      }
    }
  } else if (!m.owner) {
    if (t >= m.wanderAt) {
      m.wanderAt = t + 3 + W.rand() * 6;
      if (W.rand() < 0.6) { const p = M.randomWalkable(inst.map, W.rand, { x: m.sx, y: m.sy }, 5); m.wx = p.x; m.wy = p.y; }
    }
    if (m.wx !== undefined) { if (W.stepToward(m, m.wx, m.wy, dt * 0.5, 0.3)) m.wx = undefined; }
  }
}

function updateSummon(s, dt, t) {
  if (s.dead) return;
  if (t > s.until || !s.owner || s.owner.dead || s.owner.inst !== s.inst) { if (t > s.until && s.sk && s.owner && !s.owner.dead) require('./ashfall').summonEnd(s.owner, s, s.sk); W.killQuiet(s); return; }
  if (s.turret) { if (s.target && (s.target.dead || W.dist(s, s.target) > 9)) s.target = null; if (!s.target) s.target = nearestEnemy(s, 8.5); if (s.target && t >= s.atkReady) { s.atkReady = t + 0.8; s.inst.emit({ k: 'proj', s: s.id, x: s.x, y: s.y, tx: s.target.x, ty: s.target.y, el: s.element }); C.dealDamage(s, s.target, { mult: s.mult || 0.5, el: s.element, kind: 'summon', mag: s.mag }); } return; }
  if (C.isHardCC(s)) return;
  const o = s.owner;
  if (s.target && (s.target.dead || s.target.inst !== s.inst || W.dist(s, s.target) > 14)) s.target = null;
  if (!s.target) {
    const ot = o.atkTarget && s.inst.entities.get(o.atkTarget);
    s.target = (ot && !ot.dead && C.isEnemy(s, ot)) ? ot : nearestEnemy(s, 8);
  }
  if (s.target) {
    const d = W.dist(s, s.target);
    if (d > s.range) W.stepToward(s, s.target.x, s.target.y, dt, s.range * 0.8);
    else if (t >= s.atkReady) {
      s.atkReady = t + 1.1;
      s.inst.emit({ k: 'swing', s: s.id, x: s.x, y: s.y, tx: s.target.x, ty: s.target.y });
      C.dealDamage(s, s.target, { mult: s.mult || 0.6, el: s.element, kind: 'summon', mag: s.mag });
    }
  } else if (W.dist(s, o) > 3) W.stepToward(s, o.x + Math.cos(s.slot) * 1.6, o.y + Math.sin(s.slot) * 1.6, dt, 0.4);
}

W.spawnSummon = function (owner, opts) {
  const lv = owner.lv;
  const atk = owner.st ? (owner.st.dmgType === 'mag' ? owner.st.matk : Math.max(owner.st.atk, owner.st.matk)) : 50;
  const s = {
    id: W.nextEnt++, kind: 's', name: opts.name || 'Minion', lv, owner, shape: opts.shape || 'undead', color: opts.color || '#b0a0ff',
    x: owner.x + (W.rand() - 0.5) * 2, y: owner.y + (W.rand() - 0.5) * 2, hp: Math.round(owner.maxHp * 0.45), maxHp: Math.round(owner.maxHp * 0.45),
    atkFlat: atk, def: owner.st ? owner.st.def : 10, mdef: owner.st ? owner.st.mdef : 10, tags: new Map(), until: now() + (opts.dur || 20),
    range: 1.6, speed: opts.turret ? 0 : 4.6, turret: opts.turret ? 1 : 0, sk: opts.sk, atkReady: 0, mult: (opts.mult || 0.55) * (owner.flags && owner.flags.summonBuff ? 1.5 : 1), element: opts.element || 'neutral', mag: opts.mag, slot: W.rand() * 6.28, size: 0.9, ccDR: {}
  };
  if (!M.walkable(owner.inst.map, s.x, s.y)) { s.x = owner.x; s.y = owner.y; }
  owner.inst.add(s);
  owner.summons = (owner.summons || []).filter((x) => !x.dead); owner.summons.push(s);
  return s;
};

// ------------------------------------------------------------------ ground items
W.dropItem = function (inst, x, y, item, owners) {
  const t = now();
  let px = x, py = y;
  for (let k = 0; k < 8; k++) { const a = W.rand() * 6.283, d = 0.3 + W.rand() * 1.2; const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d; if (M.walkable(inst.map, nx, ny)) { px = nx; py = ny; break; } }
  const e = { id: W.nextEnt++, kind: 'i', item, owners: owners || [], x: px, y: py, hp: 1, maxHp: 1, tags: new Map(), until: t + (item.type === 'equip' && item.rarity >= 3 ? 300 : 120), freeAt: t + 30 };
  inst.add(e);
  return e;
};
W.killQuiet = function (e) {
  e.dead = true;
  if (e.inst) { e.inst.emit({ k: 'poof', x: e.x, y: e.y }); e.inst.remove(e); }
};

// ------------------------------------------------------------------ Zones & traps
W.spawnZone = function (inst, z) {
  const e = Object.assign({ id: W.nextEnt++, kind: 'z', tags: new Map(), hp: 1, maxHp: 1, nextTick: now() + (z.tick || 1) * 0.5 }, z);
  inst.add(e);
  return e;
};
function updateZone(z, t) {
  if (t > z.until || !z.owner || (z.owner.inst !== z.inst)) { z.inst.remove(z); z.dead = true; return; }
  if (z.zk === 'trap') {
    if (z.armedAt > t) return;
    let hit = null;
    z.inst.inRadius(z.x, z.y, 1.3, (o) => { if (!hit && !o.dead && (o.kind === 'm' || o.kind === 'p') && C.isEnemy(z.owner, o)) hit = o; });
    if (hit) C.triggerTrap(z);
    return;
  }
  if (t < z.nextTick) return;
  z.nextTick = t + z.tick;
  C.zoneTick(z);
}

// ------------------------------------------------------------------ Tick
let lastT = now();
let lastSec = 0;
W.tick = function () {
  const t = now();
  const dt = Math.min(0.1, t - lastT); lastT = t;
  W.tickN++;
  const secTick = t - lastSec >= 1; if (secTick) lastSec = t;
  for (const inst of W.instances.values()) {
    if (inst.players.size === 0) {
      if (inst.def.kind === 'dungeon' && t - inst.lastActive > 90) { W.instances.delete(inst.id); continue; }
      if (t - inst.lastActive > 30 && !inst.alwaysOn) continue; // sleep
    } else inst.lastActive = t;
    if (!inst.spawned) W.populate(inst);
    // timers
    if (inst.timers.length) {
      const due = inst.timers.filter((x) => x.at <= t);
      if (due.length) { inst.timers = inst.timers.filter((x) => x.at > t); for (const x of due) { try { x.fn(); } catch (e) { console.error(e); } } }
    }
    const players = [...inst.players];
    for (const e of [...inst.entities.values()]) {
      if (e.kind === 'p') { C.updatePlayer(e, dt, t, secTick); W.gateCheck(e); if (e.auto && e.auto.on && !e.dead) A.update(e, dt, t); }
      else if (e.kind === 'm') {
        if (secTick) C.secondTick(e, t);
        // only think when a player is reasonably near
        if (e.rank >= 2 || e.target || (W.tickN + e.id) % 4 === 0) {
          let near = e.rank >= 2;
          if (!near) for (const p of players) if (Math.abs(p.x - e.x) < 40 && Math.abs(p.y - e.y) < 30) { near = true; break; }
          if (near || e.target || e.state === 'return') updateMonster(e, e.target || e.rank >= 2 ? dt : dt * 4, t);
        }
      } else if (e.kind === 's') { if (secTick) C.secondTick(e, t); updateSummon(e, dt, t); }
      else if (e.kind === 'z') updateZone(e, t);
      else if (e.kind === 'c' && secTick) C.secondTick(e, t);
      else if (e.kind === 'i' && secTick && t > e.until) inst.remove(e);
    }
    // respawns
    if (secTick && inst.respawnQ && inst.respawnQ.length) {
      const due = inst.respawnQ.filter((x) => x.at <= t);
      if (due.length) {
        inst.respawnQ = inst.respawnQ.filter((x) => x.at > t);
        for (const x of due) { const p = M.randomWalkable(inst.map, inst.r, { x: x.spec.x, y: x.spec.y }, 6); W.spawnMonster(inst, Object.assign({}, x.spec, { x: p.x, y: p.y })); }
      }
    }
  }
  if (secTick) S.secondTick(t);
  if (W.tickN % 2 === 0) W.sendSnapshots(t);
};

// ------------------------------------------------------------------ Snapshots
function desc(e, viewer) {
  const base = { id: e.id, k: e.kind, n: e.name, x: Math.round(e.x * 10), y: Math.round(e.y * 10) };
  if (e.kind === 'p') {
    const eq = e.char.equip || {};
    const w = eq.weapon;
    Object.assign(base, { c: e.cls, lv: e.lv, g: e.guildName || '', gm: e.gm > 0 && !e.hidden ? 1 : 0,
      w: w ? [w.rarity, w.refine || 0] : [0, 0], ar: eq.armor ? eq.armor.rarity : 0, pt: e.party && viewer.party === e.party ? 1 : 0, title: e.title || '',
      pet: e.char.pet ? [e.char.pet.id, e.char.pet.lv] : 0, mt: e.mounted || '', ka: e.char.karma > 0 ? 1 : 0, rk: D.rankTier ? D.rankTier(e.char.mmr || 1000)[1] : '' });
  } else if (e.kind === 'm' || e.kind === 's') {
    Object.assign(base, { lv: e.lv, sh: e.shape, col: e.color, el: e.element, rk: e.kind === 's' ? 5 : e.rank, sz: e.size, mhp: e.maxHp, own: e.owner ? e.owner.id : 0, spr: e.spr || undefined, ws: e.wbm ? require('./wbmech').status(e) : e.sealOf ? (e.order ? 'ลำดับ #' + e.order : e.sealEl ? 'แตกด้วยธาตุเฉพาะ' : 'ผนึกบอส') : undefined });
  } else if (e.kind === 'n') Object.assign(base, { role: e.role, col: e.color, th: e.th || '', dest: e.dest || '', tr: e.role === 'chest' ? e.tier : undefined, op: e.role === 'chest' ? (e.opened ? 1 : 0) + (e.items && !e.items.length ? 2 : 0) : undefined });
  else if (e.kind === 'z') Object.assign(base, { r: e.r, col: e.color, zk: e.zk, el: e.el, until: Math.round((e.until - now()) * 10), zf: e.orbit ? 'orbit' : e.wall ? 'wall' : e.trail ? 'trail' : undefined, n: e.orbit || undefined, o: e.owner ? e.owner.id : 0 });
  else if (e.kind === 'c') Object.assign(base, { mhp: e.maxHp, g: e.guildName || '' });
  else if (e.kind === 'i') { const it = e.item; Object.assign(base, { it: it.type === 'equip' ? { type: 'equip', slot: it.slot, wtype: it.wtype, rarity: it.rarity, refine: it.refine || 0 } : { id: it.id, qty: it.qty }, n: it.id === 'zeny' ? `${it.qty.toLocaleString()} Zeny` : it.type === 'equip' ? `${it.refine ? '+' + it.refine + ' ' : ''}${it.name}` : `${(D.ITEMS[it.id] || {}).n || it.id}${it.qty > 1 ? ' ×' + it.qty : ''}`, rar: it.type === 'equip' ? it.rarity : -1, mine: e.owners.includes(viewer.char.id) || now() >= e.freeAt ? 1 : 0 }); }
  return base;
}
W.desc = desc;

function tagBits(e) {
  let b = 0;
  for (const k of e.tags.keys()) b |= TAG_BIT[k] || 0;
  return b;
}
W.sendSnapshots = function (t) {
  for (const p of W.players.values()) {
    if (!p.sess || !p.inst) continue;
    const inst = p.inst;
    const vis = new Set();
    const a = [], u = [];
    inst.query(p.x, p.y, VIEW_X, VIEW_Y, (e) => {
      if (e !== p) {
        if (e.hidden && !(p.gm > 0)) return;
        if (e.kind === 'p' && C.stealthed(e) && C.isEnemy(p, e)) return;
      }
      vis.add(e.id);
      if (!p.known.has(e.id)) { a.push(desc(e, p)); p.known.add(e.id); }
      if (e.kind === 'z' || e.kind === 'n' || e.kind === 'i') return;
      let fl = (e.dead ? 1 : 0) | (e.casting ? 2 : 0) | (C.stealthed(e) ? 4 : 0) | (e.brokenUntil > t ? 16 : 0) | (e.invulnUntil > t ? 32 : 0) | (e.giantUntil > t ? 64 : 0);
      const row = [e.id, Math.round(e.x * 10), Math.round(e.y * 10), Math.max(0, Math.ceil(e.hp / e.maxHp * 100)), tagBits(e), fl];
      if (e.wbm) row.push(require('./wbmech').status(e));
      u.push(row);
    });
    const r = [];
    for (const id of p.known) if (!vis.has(id)) { r.push(id); p.known.delete(id); }
    const fx = [];
    for (const f of inst.fx) if (Math.abs(f.x - p.x) < VIEW_X + 6 && Math.abs(f.y - p.y) < VIEW_Y + 6) fx.push(f);
    const me = C.selfState(p, t);
    const msg = { t: 'snap', u, me };
    if (a.length) msg.a = a; if (r.length) msg.r = r; if (fx.length) msg.fx = fx;
    p.sess.send(msg);
  }
  for (const inst of W.instances.values()) inst.fx.length = 0;
};

// ------------------------------------------------------------------ Players enter / leave
W.enterMap = function (p, instId, x, y) {
  let inst = W.getInstance(instId);
  if (!inst) { inst = W.getInstance('aurelia'); }
  if (p.inst) { p.inst.remove(p); C.clearOwned(p); }
  if (!inst.spawned) W.populate(inst);
  const map = inst.map;
  if (x === undefined || !M.walkable(map, x, y)) { x = map.spawn.x; y = map.spawn.y; }
  p.x = x; p.y = y; p.path = null; p.casting = null; p.atkTarget = null; p.known = new Set();
  inst.add(p);
  p.char.map = inst.mapId.startsWith('dg:') ? (p.char.lastTown || 'aurelia') : inst.mapId;
  if (inst.def.kind === 'town') p.char.lastTown = inst.mapId;
  p.char.x = x; p.char.y = y;
  if (p.auto && p.auto.on && !inst.autoAllowed) { p.auto.on = false; p.sess && p.sess.send({ t: 'notice', k: 'system', m: 'ออโต้ถูกปิด: แผนที่นี้ไม่อนุญาต' }); }
  const def = inst.def;
  p.sess && p.sess.send({ t: 'enter', map: inst.mapId, inst: inst.id, me: p.id, x, y,
    info: { name: def.name, th: def.th, kind: def.kind, pvp: inst.pvp, auto: inst.autoAllowed, lv: def.lv || def.min || 0, max: def.max || 0, floor: def.floor || 0, dungeon: def.dungeon || '', weather: (W.flags[inst.mapId] || {}).weather || '' },
    char: C.charPayload(p) });
  if (def.kind === 'dungeon' && p.char) {
    const best = p.char.dungeonBest || (p.char.dungeonBest = {});
    best[def.dungeon] = Math.max(best[def.dungeon] || 0, def.floor - 1);
  }
};

// ---- warping: the player dissolves in a light beam where they stand, then appears in a beam at the destination
W.warp = function (p, instId, x, y) {
  if (!p.inst || p.warping) return;
  p.warping = true; p.path = null; p.atkTarget = null;
  p.inst.emit({ k: 'warpout', t: p.id, x: p.x, y: p.y });
  p.inst.after(0.6, () => {
    p.warping = false;
    if (!W.players.get(p.char.id)) return;
    W.enterMap(p, instId, x, y);
    p.gateCd = now() + 1.5; p.gateLock = true; // must step off the arrival gate before it can fire again
    p.inst.emit({ k: 'warpin', t: p.id, x: p.x, y: p.y });
  });
};
// a walkable spot near (x, y), searched in growing rings
W.freeSpot = function (map, x, y, min = 0) {
  for (let r = min; r < 12; r += 0.5) for (let a = 0; a < 16; a++) { const tx = x + Math.cos(a / 16 * Math.PI * 2) * r, ty = y + Math.sin(a / 16 * Math.PI * 2) * r; if (M.walkable(map, tx, ty)) return { x: Math.floor(tx) + 0.5, y: Math.floor(ty) + 0.5 }; }
  return { x: map.spawn.x, y: map.spawn.y };
};
// every town and field is linked by warp gates: town ↔ each of its fields, field ↔ previous / next field, town ↔ next town
W.gateLinks = function (def) {
  const out = [];
  if (def.kind === 'town') {
    for (const f of D.FARM_MAPS.filter((x) => x.town === def.id)) out.push([f.id, f.name]);
    const ti = D.TOWNS.findIndex((t) => t.id === def.id);
    if (ti >= 0) { const nx = D.TOWNS[(ti + 1) % D.TOWNS.length], pv = D.TOWNS[(ti - 1 + D.TOWNS.length) % D.TOWNS.length]; out.push([nx.id, nx.name]); if (pv.id !== nx.id) out.push([pv.id, pv.name]); }
  } else if (def.kind === 'farm') {
    out.push([def.town, (D.TOWNS.find((t) => t.id === def.town) || {}).name || def.town]);
    const i = D.FARM_MAPS.findIndex((x) => x.id === def.id);
    if (i > 0) out.push([D.FARM_MAPS[i - 1].id, D.FARM_MAPS[i - 1].name]);
    if (i >= 0 && i < D.FARM_MAPS.length - 1) out.push([D.FARM_MAPS[i + 1].id, D.FARM_MAPS[i + 1].name]);
  }
  return out;
};
// gates stand on the roads: for each link a road tile far out in that link's direction (towns: where the roads
// leave town; fields: along the trails), spaced apart so every gate sits on its own stretch of road
function addGates(inst) {
  const map = inst.map, links = W.gateLinks(inst.def); if (!links.length) return;
  const roads = [];
  for (let y = 2; y < map.h - 2; y++) for (let x = 2; x < map.w - 2; x++) if (map.tiles[y * map.w + x] === M.T.PATH && M.walkable(map, x + 0.5, y + 0.5)) roads.push([x + 0.5, y + 0.5]);
  const sx = map.spawn.x, sy = map.spawn.y, n = links.length, maxR = Math.min(map.w, map.h) * (inst.def.kind === 'town' ? 0.42 : 0.3), placed = [];
  links.forEach(([dest, name], i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.3, dx = Math.cos(a), dy = Math.sin(a);
    let best = null, bv = -1e9;
    for (const [x, y] of roads) {
      const rx = x - sx, ry = y - sy, d = Math.hypot(rx, ry); if (d < 8 || d > maxR) continue;
      if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 10)) continue;
      const v = (rx * dx + ry * dy) / d * 3 + Math.min(d, maxR) / maxR; // in the right direction, as far out as allowed
      if (v > bv) { bv = v; best = { x, y }; }
    }
    const s = best || W.freeSpot(map, sx + dx * maxR * 0.6, sy + dy * maxR * 0.6);
    placed.push(s);
    inst.add({ id: W.nextEnt++, kind: 'n', name: 'Warp → ' + name, role: 'portal', dest, color: '#9a7aff', x: s.x, y: s.y, tags: new Map(), hp: 1, maxHp: 1, gate: 1 });
  });
}
// where to stand after arriving through a gate: next to the gate in the destination that leads back
W.gateArrival = function (instId, fromId) {
  const inst = W.getInstance(instId); if (!inst) return null;
  if (!inst.spawned) W.populate(inst);
  const g = [...inst.entities.values()].find((e) => e.role === 'portal' && e.dest === fromId);
  return g ? W.freeSpot(inst.map, g.x, g.y + 2, 1.5) : null;
};
// walking onto a gate / stairs uses it
W.gateCheck = function (p) {
  if (p.dead || p.warping || !p.inst) return;
  const t = now(); let near = null;
  p.inst.inRadius(p.x, p.y, 1.1, (e) => { if (!near && e.kind === 'n' && (e.role === 'portal' || e.role === 'stairs' || e.role === 'stairsUp')) near = e; });
  if (!near) { p.gateLock = false; return; }
  if (p.gateLock || t < (p.gateCd || 0)) return;
  p.gateCd = t + 2;
  if (near.role === 'portal') {
    const dest = near.dest === 'town' ? (p.char.lastTown || 'aurelia') : near.dest, at = W.gateArrival(dest, p.inst.mapId);
    W.warp(p, dest, at && at.x, at && at.y);
  } else if (near.role === 'stairs') { if (!p.inst.stairsOpen) { p.gateLock = true; } S.useStairs(p); }
  else S.stairsUp(p);
};

W.dungeonInstanceId = function (p, type, floor) {
  const key = p.party ? 'pt' + p.party : 'c' + p.char.id;
  return `dg:${type}:${floor}#${key}`;
};

W.removePlayer = function (p) {
  if (p.inst) { p.inst.remove(p); C.clearOwned(p); }
  W.players.delete(p.char.id);
  S.onLogout(p);
};

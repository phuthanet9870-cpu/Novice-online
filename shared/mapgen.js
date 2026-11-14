// Deterministic procedural map generation + A* pathfinding (shared).
(function (root, factory) {
  const isNode = typeof require === 'function';
  const m = factory(isNode ? require('./rng.js') : root.NO_RNG, isNode ? require('./data2.js') : root.NO_DATA);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.NO_MAP = m;
})(typeof self !== 'undefined' ? self : this, function (RNG, D) {
  // tile codes
  const T = { GROUND: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, WALL: 5, FLOOR: 6, DECO: 7, HOUSE: 8, LAVA: 9, BRIDGE: 10, STAIRS: 11, ROOF: 12 };
  const WALK = new Uint8Array(16); [T.GROUND, T.PATH, T.FLOOR, T.DECO, T.BRIDGE, T.STAIRS].forEach((t) => (WALK[t] = 1));

  function getMapDef(id) {
    const town = D.TOWNS.find((t) => t.id === id);
    if (town) return { id, kind: 'town', name: town.name, th: town.th, biome: town.biome, w: town.w, h: town.h, lv: town.lv, safe: true };
    const farm = D.FARM_MAPS.find((f) => f.id === id);
    if (farm) return { id, kind: 'farm', name: farm.name, th: farm.th, biome: farm.biome, w: farm.w, h: farm.h, min: farm.min, max: farm.max, pk: farm.pk, town: farm.town, idx: farm.idx };
    if (D.SPECIAL_MAPS[id]) { const s = D.SPECIAL_MAPS[id]; return Object.assign({ kind: id === 'wb_arena' ? 'wb' : id === 'jail' ? 'jail' : 'arena' }, s); }
    const castle = D.CASTLES.find((c) => c.id === id);
    if (castle) return { id, kind: 'castle', name: castle.name, th: castle.th, biome: castle.biome, w: 110, h: 110 };
    const dm = /^dg:([a-z_]+):(\d+)$/.exec(id);
    if (dm) {
      const dg = D.DUNGEONS.find((d) => d.id === dm[1]);
      const floor = +dm[2];
      const size = 120 + Math.floor(Math.min(floor, 1000) / 10); // wide floors: 120 tiles at F1 up to 220 at F1000
      return { id, kind: 'dungeon', dungeon: dg.id, floor, name: `${dg.name} F${floor}`, th: `${dg.th} ชั้น ${floor}`, biome: dg.biome,
        w: size, h: size, lv: D.dungeonLevel(dg, floor), boss: floor % 10 === 0, element: dg.element };
    }
    return null;
  }

  function gen(def) {
    const { w, h } = def;
    const seed = RNG.hashStr(def.id);
    const r = RNG.rng(seed);
    const tiles = new Uint8Array(w * h);
    const map = { def, w, h, tiles, seed, spawn: { x: w >> 1, y: h >> 1 }, npcs: [], stairs: null, core: null, rooms: [] };
    if (def.kind === 'town') genTown(map, r);
    else if (def.kind === 'dungeon') genDungeon(map, r);
    else if (def.kind === 'castle') genCastle(map, r);
    else if (def.kind === 'farm') genField(map, r, 1);
    else genArena(map, r);
    const walk = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) walk[i] = WALK[tiles[i]];
    map.walk = walk;
    if (def.kind === 'farm' || def.kind === 'town') ensureConnected(map);
    return map;
  }

  const idx = (m, x, y) => y * m.w + x;
  function fillRect(m, x0, y0, x1, y1, t) {
    for (let y = Math.max(0, y0); y <= Math.min(m.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.w - 1, x1); x++) m.tiles[y * m.w + x] = t;
  }
  function fillCircle(m, cx, cy, rad, t, onlyIf) {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) { const i = y * m.w + x; if (!onlyIf || onlyIf(m.tiles[i])) m.tiles[i] = t; }
    }
  }
  function carvePath(m, r, x0, y0, x1, y1, width, t) {
    let x = x0, y = y0, guard = 0;
    while ((Math.abs(x - x1) > 1 || Math.abs(y - y1) > 1) && guard++ < 5000) {
      const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
      if (r() < 0.6) { if (Math.abs(x1 - x) > Math.abs(y1 - y)) x += dx; else y += dy; }
      else if (r() < 0.5) x += dx || (r() < 0.5 ? 1 : -1); else y += dy || (r() < 0.5 ? 1 : -1);
      x = Math.max(2, Math.min(m.w - 3, x)); y = Math.max(2, Math.min(m.h - 3, y));
      fillCircle(m, x, y, width, t, (old) => old !== T.HOUSE && old !== T.WALL);
    }
    // bridges over water
    for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === 99) m.tiles[i] = T.BRIDGE;
  }

  function genField(m, r, density) {
    const { w, h } = m;
    const b = m.def.biome;
    const treeD = { meadow: 0.55, forest: 0.85, swamp: 0.6, beach: 0.3, ruins: 0.45, desert: 0.22, snow: 0.55, crystal: 0.5, volcano: 0.35, sky: 0.4, abyss: 0.45 }[b] || 0.5;
    const waterT = { desert: 0.27, volcano: 0.3, sky: 0.27, beach: 0.36, swamp: 0.38 }[b] || 0.31;
    const s = m.seed;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = RNG.fbm(x / 38, y / 38, s, 4);
      const mo = RNG.fbm(x / 22 + 300, y / 22 + 300, s + 7, 3);
      const hh = RNG.hash2(x, y, s + 3);
      let t = T.GROUND;
      if (e < waterT) t = (b === 'volcano' || b === 'abyss') ? T.LAVA : T.WATER;
      else if (mo > 0.62 && hh < treeD * density) t = T.TREE;
      else if (hh < 0.012) t = T.ROCK;
      else if (hh < 0.07) t = T.DECO;
      m.tiles[y * w + x] = t;
    }
    // borders
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) { m.tiles[k * w + x] = T.TREE; m.tiles[(h - 1 - k) * w + x] = T.TREE; }
    for (let y = 0; y < h; y++) for (let k = 0; k < 3; k++) { m.tiles[y * w + k] = T.TREE; m.tiles[y * w + w - 1 - k] = T.TREE; }
    const cx = w >> 1, cy = h >> 1;
    fillCircle(m, cx, cy, 7, T.GROUND);
    // roads from center to 6 points, water becomes bridge
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.5;
      pts.push([Math.round(cx + Math.cos(a) * (w * 0.42)), Math.round(cy + Math.sin(a) * (h * 0.42))]);
    }
    for (const [px, py] of pts) {
      carvePathRoad(m, r, cx, cy, px, py);
      fillCircle(m, px, py, 5, T.GROUND, (o) => o === T.TREE || o === T.ROCK);
    }
    // ruins pillars / decoration clusters
    for (let i = 0; i < (w * h) / 2500; i++) {
      const x = r.int(10, w - 10), y = r.int(10, h - 10);
      if (m.tiles[y * w + x] === T.GROUND) fillCircle(m, x, y, r.int(2, 4), T.DECO, (o) => o === T.GROUND);
    }
    m.spawn = { x: cx, y: cy };
  }
  function carvePathRoad(m, r, x0, y0, x1, y1) {
    let x = x0, y = y0, guard = 0;
    while ((Math.abs(x - x1) > 1 || Math.abs(y - y1) > 1) && guard++ < 4000) {
      const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
      const rr = r();
      if (rr < 0.7) { if (Math.abs(x1 - x) > Math.abs(y1 - y)) x += dx; else y += dy; }
      else if (rr < 0.85) y += (r() < 0.5 ? 1 : -1); else x += (r() < 0.5 ? 1 : -1);
      x = Math.max(4, Math.min(m.w - 5, x)); y = Math.max(4, Math.min(m.h - 5, y));
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const i = (y + oy) * m.w + (x + ox);
        const o = m.tiles[i];
        m.tiles[i] = (o === T.WATER || o === T.LAVA || o === T.BRIDGE) ? T.BRIDGE : T.PATH;
      }
    }
  }

  function genTown(m, r) {
    const { w, h } = m;
    genField(m, r, 0.5);
    const cx = w >> 1, cy = h >> 1;
    // city ground
    fillCircle(m, cx, cy, 44, T.GROUND);
    // city walls ring with 4 gates
    for (let a = 0; a < 720; a++) {
      const ang = (a / 720) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * 46), y = Math.round(cy + Math.sin(ang) * 46);
      const gate = [0, 0.5, 1, 1.5].some((g) => Math.abs(ang - g * Math.PI) < 0.07) || Math.abs(ang - 2 * Math.PI) < 0.07;
      if (!gate) fillRect(m, x - 1, y - 1, x + 1, y + 1, T.WALL);
    }
    // plaza
    fillCircle(m, cx, cy, 15, T.FLOOR);
    fillRect(m, cx - 1, cy - 1, cx + 1, cy + 1, T.WATER);
    // roads
    fillRect(m, cx - 2, 4, cx + 2, h - 5, T.PATH);
    fillRect(m, 4, cy - 2, w - 5, cy + 2, T.PATH);
    fillCircle(m, cx, cy, 15, T.FLOOR, (o) => o === T.PATH);
    fillRect(m, cx - 1, cy - 1, cx + 1, cy + 1, T.WATER);
    // houses
    let placed = 0, guard = 0;
    while (placed < 38 && guard++ < 900) {
      const hw = r.int(5, 9), hh = r.int(4, 7);
      const ang = r() * Math.PI * 2, dist = 19 + r() * 22;
      const x = Math.round(cx + Math.cos(ang) * dist - hw / 2), y = Math.round(cy + Math.sin(ang) * dist - hh / 2);
      let ok = true;
      for (let yy = y - 2; yy <= y + hh + 2 && ok; yy++) for (let xx = x - 2; xx <= x + hw + 2; xx++) {
        const t = m.tiles[yy * w + xx];
        if (t !== T.GROUND && t !== T.DECO && t !== T.TREE) { ok = false; break; }
        if ((xx - cx) ** 2 + (yy - cy) ** 2 > 43 * 43) { ok = false; break; }
      }
      if (!ok) continue;
      fillRect(m, x - 1, y - 1, x + hw + 1, y + hh + 1, T.GROUND);
      fillRect(m, x, y, x + hw, y + hh, T.HOUSE);
      m.rooms.push({ x, y, w: hw, h: hh });
      placed++;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x - cx) ** 2 + (y - cy) ** 2 < 43 * 43 && m.tiles[i] === T.TREE && RNG.hash2(x, y, 5) < 0.85) m.tiles[i] = T.DECO;
    }
    m.npcs = D.TOWN_NPCS.map((n, i) => ({ ...n, x: cx + n.dx + 0.5, y: cy + n.dy + 0.5, id: 'npc_' + m.def.id + '_' + i }));
    for (const n of m.npcs) fillCircle(m, n.x, n.y, 1.5, T.FLOOR, (o) => o !== T.WATER);
    m.spawn = { x: cx + 0.5, y: cy + 6.5 };
  }

  function genDungeon(m, r) {
    const { w, h } = m;
    m.tiles.fill(T.WALL);
    const maze = m.def.dungeon === 'shadow_labyrinth';
    // big halls (14–30 wide) joined by wide corridors; the labyrinth keeps more, smaller rooms
    const nRooms = Math.min(34, 8 + Math.floor(w / 10) + (maze ? 8 : 0));
    let guard = 0;
    while (m.rooms.length < nRooms && guard++ < 1500) {
      const rw = r.int(maze ? 9 : 14, maze ? 16 : 30), rh = r.int(maze ? 8 : 12, maze ? 14 : 24);
      const x = r.int(3, w - rw - 4), y = r.int(3, h - rh - 4);
      if (m.rooms.some((o) => x < o.x + o.w + 3 && x + rw + 3 > o.x && y < o.y + o.h + 3 && y + rh + 3 > o.y)) continue;
      m.rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
    }
    m.rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    for (const rm of m.rooms) fillRect(m, rm.x, rm.y, rm.x + rm.w, rm.y + rm.h, T.FLOOR);
    const cw = maze ? 2 : 3;
    for (let i = 1; i < m.rooms.length; i++) {
      const a = m.rooms[i - 1], b = m.rooms[i];
      if (r() < 0.5) { fillRect(m, Math.min(a.cx, b.cx), a.cy - cw + 1, Math.max(a.cx, b.cx), a.cy + cw - 1 + (cw > 1 ? 0 : 0), T.FLOOR); fillRect(m, b.cx - cw + 1, Math.min(a.cy, b.cy), b.cx + cw - 1, Math.max(a.cy, b.cy), T.FLOOR); }
      else { fillRect(m, a.cx - cw + 1, Math.min(a.cy, b.cy), a.cx + cw - 1, Math.max(a.cy, b.cy), T.FLOOR); fillRect(m, Math.min(a.cx, b.cx), b.cy - cw + 1, Math.max(a.cx, b.cx), b.cy + cw - 1, T.FLOOR); }
    }
    // extra loops
    for (let i = 0; i < m.rooms.length / 3; i++) {
      const a = r.pick(m.rooms), b = r.pick(m.rooms);
      fillRect(m, Math.min(a.cx, b.cx), a.cy, Math.max(a.cx, b.cx), a.cy + cw - 1, T.FLOOR);
      fillRect(m, b.cx, Math.min(a.cy, b.cy), b.cx + cw - 1, Math.max(a.cy, b.cy), T.FLOOR);
    }
    // pillars & hazards
    for (const rm of m.rooms) {
      if (rm.w > 12 && rm.h > 11 && r() < 0.7) { fillRect(m, rm.x + 3, rm.y + 3, rm.x + 3, rm.y + 3, T.ROCK); fillRect(m, rm.x + rm.w - 3, rm.y + rm.h - 3, rm.x + rm.w - 3, rm.y + rm.h - 3, T.ROCK); fillRect(m, rm.x + rm.w - 3, rm.y + 3, rm.x + rm.w - 3, rm.y + 3, T.ROCK); fillRect(m, rm.x + 3, rm.y + rm.h - 3, rm.x + 3, rm.y + rm.h - 3, T.ROCK); }
      for (let k = 0; k < 4 + Math.floor(rm.w * rm.h / 60); k++) { const x = r.int(rm.x + 1, rm.x + rm.w - 1), y = r.int(rm.y + 1, rm.y + rm.h - 1); if (m.tiles[y * w + x] === T.FLOOR) m.tiles[y * w + x] = T.DECO; }
    }
    const first = m.rooms[0], last = m.rooms[m.rooms.length - 1];
    m.spawn = { x: first.cx + 0.5, y: first.cy + 0.5 };
    m.stairs = { x: last.cx + 0.5, y: last.cy + 0.5 };
    fillRect(m, last.cx - 1, last.cy - 1, last.cx + 1, last.cy + 1, T.FLOOR);
    m.tiles[last.cy * w + last.cx] = T.STAIRS;
  }

  function genCastle(m, r) {
    const { w, h } = m;
    genField(m, r, 0.4);
    const cx = w >> 1, cy = h >> 1;
    fillCircle(m, cx, cy, 34, T.GROUND);
    // outer wall square with 4 gates, inner keep
    for (const [rad, gateW] of [[30, 3], [16, 2]]) {
      for (let k = -rad; k <= rad; k++) {
        for (const [x, y] of [[cx + k, cy - rad], [cx + k, cy + rad], [cx - rad, cy + k], [cx + rad, cy + k]]) {
          if (Math.abs(k) <= gateW) continue;
          fillRect(m, x - 1, y - 1, x + 1, y + 1, T.WALL);
        }
      }
    }
    fillCircle(m, cx, cy, 12, T.FLOOR);
    fillRect(m, cx - 2, 4, cx + 2, h - 5, T.PATH);
    fillCircle(m, cx, cy, 12, T.FLOOR, (o) => o === T.PATH);
    m.core = { x: cx + 0.5, y: cy + 0.5 };
    m.spawn = { x: cx + 0.5, y: h - 8 };
    m.defSpawn = { x: cx + 0.5, y: cy + 6 };
  }

  function genArena(m, r) {
    const { w, h } = m;
    m.tiles.fill(T.FLOOR);
    for (let x = 0; x < w; x++) for (let k = 0; k < 2; k++) { m.tiles[k * w + x] = T.WALL; m.tiles[(h - 1 - k) * w + x] = T.WALL; }
    for (let y = 0; y < h; y++) for (let k = 0; k < 2; k++) { m.tiles[y * w + k] = T.WALL; m.tiles[y * w + w - 1 - k] = T.WALL; }
    const cx = w >> 1, cy = h >> 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, d = Math.min(w, h) * 0.3;
      fillRect(m, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), Math.round(cx + Math.cos(a) * d) + 1, Math.round(cy + Math.sin(a) * d) + 1, T.ROCK);
    }
    for (let i = 0; i < w * h / 60; i++) { const x = r.int(3, w - 4), y = r.int(3, h - 4); if (m.tiles[y * w + x] === T.FLOOR) m.tiles[y * w + x] = T.DECO; }
    m.spawn = { x: cx + 0.5, y: cy + 0.5 };
  }

  function ensureConnected(m) {
    const { w, h, walk, tiles } = m;
    const seen = new Uint8Array(w * h);
    const sx = Math.floor(m.spawn.x), sy = Math.floor(m.spawn.y);
    const q = [sy * w + sx]; seen[q[0]] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx; if (!seen[ni] && walk[ni]) { seen[ni] = 1; q.push(ni); }
      }
    }
    for (let i = 0; i < w * h; i++) if (walk[i] && !seen[i]) { walk[i] = 0; tiles[i] = T.TREE; }
    m.reach = seen;
  }

  function walkable(m, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= m.w || yi >= m.h) return false;
    return m.walk[yi * m.w + xi] === 1;
  }
  function randomWalkable(m, r, near, radius) {
    for (let k = 0; k < 400; k++) {
      let x, y;
      if (near) { x = Math.floor(near.x + (r() * 2 - 1) * radius); y = Math.floor(near.y + (r() * 2 - 1) * radius); }
      else { x = r.int(4, m.w - 5); y = r.int(4, m.h - 5); }
      if (walkable(m, x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: m.spawn.x, y: m.spawn.y };
  }
  // Line of sight / straight walk check
  function clearLine(m, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 2);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  // A* with binary heap; returns array of [x,y] tile centers
  function findPath(m, sx, sy, tx, ty, maxNodes = 6000, raw = false) {
    const w = m.w;
    sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
    if (!walkable(m, tx, ty)) {
      let best = null, bd = 1e9;
      for (let r = 1; r < 6 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (walkable(m, tx + dx, ty + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
      }
      if (!best) return null; tx = best[0]; ty = best[1];
    }
    const start = sy * w + sx, goal = ty * w + tx;
    if (start === goal) return [[tx + 0.5, ty + 0.5]];
    const g = new Map(), came = new Map();
    const heap = []; const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top[1]; };
    const hfn = (i) => { const x = i % w, y = (i / w) | 0; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    g.set(start, 0); push(start, hfn(start));
    let n = 0;
    while (heap.length && n++ < maxNodes) {
      const cur = pop();
      if (cur === goal) break;
      const cx = cur % w, cy = (cur / w) | 0, cg = g.get(cur);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!walkable(m, nx, ny)) continue;
        if (dx && dy && (!walkable(m, cx + dx, cy) || !walkable(m, cx, cy + dy))) continue;
        const ni = ny * w + nx, ng = cg + (dx && dy ? 1.414 : 1);
        if (ng < (g.has(ni) ? g.get(ni) : 1e9)) { g.set(ni, ng); came.set(ni, cur); push(ni, ng + hfn(ni)); }
      }
    }
    if (!came.has(goal)) return null;
    const path = []; let c = goal;
    while (c !== start) { path.push([(c % w) + 0.5, ((c / w) | 0) + 0.5]); c = came.get(c); }
    path.reverse();
    if (raw) return path; // grid walking: tile-centre to tile-centre steps (8 directions)
    // string-pull smoothing
    const out = []; let ax = sx + 0.5, ay = sy + 0.5, i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !clearLine(m, ax, ay, path[j][0], path[j][1])) j--;
      out.push(path[j]); ax = path[j][0]; ay = path[j][1]; i = j + 1;
    }
    return out;
  }

  const cache = {};
  function getMap(id) {
    if (cache[id]) return cache[id];
    const def = getMapDef(id);
    if (!def) return null;
    const m = gen(def);
    if (!/^dg:/.test(id)) cache[id] = m;
    return m;
  }

  return { T, WALK, getMapDef, gen, getMap, walkable, randomWalkable, clearLine, findPath };
});

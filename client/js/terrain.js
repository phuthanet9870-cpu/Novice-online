// Map art, built only from the packs supplied for it:
//   Terrain Pack 4 (Laphkal): seamless ground textures + scatter props (12 biome sheets, 6×4 cells of 64 px: 1–8 ground, 17–24 props)
//   roboden tileset (CC0): trees, mountains, snow piles, crystals, cracks for the outdoor biomes
//   Dungeon tileset + Brimspire (PixLog): dungeons only — rooms of brick wall faces over darkness, stone floors, doors, props
// Hooks into ART.chunk: when the sheets are loaded every chunk is redrawn with them; until then the procedural look stays.
(function () {
  const ART = window.ART, T = NO_MAP.T, TS = ART.TS;
  const SHEETS = ['coral_reef', 'ember_wastes', 'glacier', 'mangrove', 'meadow', 'mesa_canyon', 'oasis', 'obsidian_depths', 'petrified_forest', 'salt_flats', 'storm_peaks', 'tundra'];
  const TER = window.TER = { ready: false, img: {} };
  const base = 'client/assets/';
  let pending = 0;
  const load = (key, src) => { pending++; const im = new Image(); im.onload = im.onerror = () => { if (--pending === 0) { TER.ready = true; ART.resetChunks(); } }; im.src = src; TER.img[key] = im; };
  TER.load = () => { if (pending || TER.ready) return; for (const s of SHEETS) load('t:' + s, base + 'terrain/' + s + '.png'); if (window.WORLD_ART) load('world', WORLD_ART.src); };
  const M = (b, p) => ({ b, p });
  // biome → Terrain Pack 4 ground materials (base / alt / path / water / lava)
  const TH = {
    meadow: { base: M('meadow', 0), alt: M('meadow', 2), path: M('oasis', 2), water: M('oasis', 3) },
    forest: { base: M('meadow', 1), alt: M('mangrove', 3), path: M('oasis', 2), water: M('mangrove', 0) },
    swamp: { base: M('mangrove', 3), alt: M('mangrove', 1), path: M('petrified_forest', 2), water: M('mangrove', 0) },
    beach: { base: M('oasis', 2), alt: M('coral_reef', 3), path: M('salt_flats', 2), water: M('coral_reef', 1) },
    ruins: { base: M('petrified_forest', 3), alt: M('storm_peaks', 0), path: M('petrified_forest', 1), water: M('coral_reef', 1) },
    desert: { base: M('oasis', 2), alt: M('mesa_canyon', 0), path: M('salt_flats', 2), water: M('oasis', 3) },
    snow: { base: M('tundra', 0), alt: M('tundra', 1), path: M('tundra', 2), water: M('glacier', 3) },
    crystal: { base: M('glacier', 1), alt: M('salt_flats', 1), path: M('salt_flats', 0), water: M('glacier', 3) },
    volcano: { base: M('ember_wastes', 0), alt: M('ember_wastes', 2), path: M('petrified_forest', 2), lava: M('ember_wastes', 3), water: M('ember_wastes', 3) },
    sky: { base: M('meadow', 0), alt: M('oasis', 1), path: M('salt_flats', 3), water: M('glacier', 3) },
    abyss: { base: M('obsidian_depths', 0), alt: M('obsidian_depths', 1), path: M('storm_peaks', 3), lava: M('ember_wastes', 3), water: M('obsidian_depths', 2) },
    town: { base: M('meadow', 0), alt: M('meadow', 2), path: M('oasis', 2), plaza: M('salt_flats', 2), water: M('oasis', 3), town: 1 }
  };
  TER.TH = TH;
  const themeOf = (map) => (map.def.kind === 'dungeon' || map.def.kind === 'jail' ? null : map.def.kind === 'town' || map.def.kind === 'castle' ? TH.town : TH[map.def.biome] || TH.meadow);
  const h2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // smooth value noise for organic material blobs
  const vn = (x, y, s, c) => { const fx = x / c, fy = y / c, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const a = h2(x0, y0, s), b = h2(x0 + 1, y0, s), c2 = h2(x0, y0 + 1, s), d = h2(x0 + 1, y0 + 1, s); return a + (b - a) * sx + (c2 - a + (a - b + d - c2) * sx) * sy; };
  const cell = (n) => [((n - 1) % 6) * 64, Math.floor((n - 1) / 6) * 64];
  function mat(g, m, tx, ty, px, py, a) {
    const im = TER.img['t:' + m.b]; if (!im || !im.naturalWidth) return;
    const v = m.p * 2 + 1 + (h2(Math.floor(tx / 2), Math.floor(ty / 2), 5) < 0.5 ? 0 : 1);
    const [sx, sy] = cell(v);
    // each 64 px seamless cell covers 2×2 tiles: pick the matching quarter so neighbours line up
    const qx = ((tx % 2) + 2) % 2, qy = ((ty % 2) + 2) % 2;
    if (a !== undefined) g.globalAlpha = a;
    g.drawImage(im, sx + qx * 32, sy + qy * 32, 32, 32, px, py, TS, TS);
    g.globalAlpha = 1;
  }
  const groundBase = function (g, map, t, tx, ty, px, py, tileAt) {
    const th = themeOf(map); if (!TER.ready || !th) return false;
    if (t === T.WATER || t === T.LAVA) {
      mat(g, t === T.LAVA ? th.lava || TH.volcano.lava : th.water || TH.meadow.water, tx, ty, px, py);
      // shoreline foam / lava glow where it meets land
      for (const [dx, dy, x, y, w, hh] of [[0, -1, 0, 0, TS, 3], [0, 1, 0, TS - 3, TS, 3], [-1, 0, 0, 0, 3, TS], [1, 0, TS - 3, 0, 3, TS]]) {
        const o = tileAt(map, tx + dx, ty + dy);
        if (o !== T.WATER && o !== T.LAVA && o !== T.BRIDGE) { g.fillStyle = t === T.LAVA ? 'rgba(255,220,120,0.55)' : 'rgba(255,255,255,0.4)'; g.fillRect(px + x, py + y, w, hh); }
      }
      return true;
    }
    if (t === T.BRIDGE || t === T.STAIRS || t === T.WALL) return false;
    const blob = vn(tx, ty, 3, 7);
    mat(g, th.base, tx, ty, px, py);
    if (blob > 0.6) mat(g, th.alt, tx, ty, px, py, Math.min(1, (blob - 0.6) * 4));
    if (t === T.PATH) mat(g, th.path, tx, ty, px, py, 0.92);
    if (t === T.FLOOR) mat(g, th.plaza || th.path, tx, ty, px, py);
    // organic borders: a path / plaza spills into the neighbouring grass with a wobbly, noise-shaped edge
    if (t !== T.PATH && t !== T.FLOOR) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const o = tileAt(map, tx + dx, ty + dy); if (o !== T.PATH && o !== T.FLOOR) continue;
        const m2 = o === T.FLOOR ? th.plaza || th.path : th.path;
        g.save(); g.beginPath();
        for (let i = 0; i <= 4; i++) {
          const u = i / 4, d = 3 + h2(tx * 7 + i, ty * 5 + dx * 3 + dy, 17) * 9;
          const ex = dx ? (dx > 0 ? TS - d : d) : u * TS, ey = dy ? (dy > 0 ? TS - d : d) : u * TS;
          g.moveTo(px + ex + 6, py + ey); g.arc(px + ex, py + ey, 6 + h2(tx + i, ty - i, 23) * 4, 0, 7);
        }
        g.rect(px + (dx > 0 ? TS - 3 : 0), py + (dy > 0 ? TS - 3 : 0), dx ? 3 : TS, dy ? 3 : TS);
        g.clip(); mat(g, m2, tx, ty, px, py); g.restore();
      }
    }
    // macro light & shade so big fields don't look flat
    const L = vn(tx, ty, 9, 11) - 0.5; g.fillStyle = L > 0 ? `rgba(255,250,220,${L * 0.12})` : `rgba(0,0,20,${-L * 0.16})`; g.fillRect(px, py, TS, TS);
    return true;
  };

  // ------------------------------------------------------------ atlas helpers
  const WA = (window.WORLD_ART || { r: {} }).r;
  const okW = () => TER.ready && TER.img.world && TER.img.world.naturalWidth;
  function wa(g, name, cx, by, scale, shadow) {
    const e = WA[name], im = TER.img.world; if (!e || !im || !im.naturalWidth) return false;
    const w = e[2] * scale, h = e[3] * scale;
    if (shadow) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, by - 2, w * 0.36, Math.max(3, Math.min(8, h * 0.08)), 0, 0, 7); g.fill(); }
    g.drawImage(im, e[0], e[1], e[2], e[3], Math.round(cx - w / 2), Math.round(by - h), Math.round(w), Math.round(h));
    return true;
  }
  function waTile(g, name, px, py, w, h) { const e = WA[name], im = TER.img.world; if (!e || !im || !im.naturalWidth) return false; g.drawImage(im, e[0], e[1], e[2], e[3], px, py, w || TS, h || TS); return true; }
  // a Terrain Pack scatter cell (17–24) of a biome sheet
  function tp(g, sheet, n, cx, by, size) {
    const im = TER.img['t:' + sheet]; if (!im || !im.naturalWidth) return false;
    const [sx, sy] = cell(n);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, by - 3, size * 0.3, size * 0.09, 0, 0, 7); g.fill();
    g.drawImage(im, sx, sy, 64, 64, Math.round(cx - size / 2), Math.round(by - size), size, size);
    return true;
  }
  const seq = (pre, a, b) => Array.from({ length: b - a + 1 }, (_, i) => pre + (a + i));
  const pk = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

  // ------------------------------------------------------------ outdoor dressing (Terrain Pack scatter + roboden)
  // entries: ['tp', sheet, cell, size] | ['r', atlasName, scale]
  const FT = seq('r:ftree', 0, 5).map((n) => ['r', n, 2.3]), TT = seq('r:ttree', 0, 11).map((n) => ['r', n, 2.3]);
  const P = (sheet, cells, size) => cells.map((c) => ['tp', sheet, c, size]);
  const OUT = {
    meadow: { tree: FT, rock: [['r', 'r:forestmt_small', 0.7], ...P('storm_peaks', [17, 19], 34)], deco: [...P('meadow', [17, 18, 19, 20, 21, 22, 23, 24], 30), ['r', 'r:organic_1', 1.6]] },
    forest: { tree: FT, rock: [['r', 'r:forestmt_small', 0.8], ['r', 'r:forestmt_wide', 0.8], ...P('petrified_forest', [17, 23], 36)], deco: [...P('meadow', [18, 20, 22, 23], 30), ...P('petrified_forest', [17, 19, 21], 32), ['r', 'r:organic_3', 1.6], ['r', 'r:organic_5', 1.8]] },
    swamp: { tree: [...FT, ...P('mangrove', [17, 24], 50)], rock: P('mangrove', [18, 22], 36), deco: [...P('mangrove', [17, 18, 19, 20, 21, 22, 23, 24], 30), ['r', 'r:organic_0', 1.8], ['r', 'r:organic_2', 1.8]] },
    beach: { tree: P('oasis', [17, 17, 18], 58), rock: P('coral_reef', [21, 24], 34), deco: [...P('coral_reef', [17, 18, 19, 20, 21, 22, 23, 24], 30), ...P('oasis', [22, 23], 28)] },
    ruins: { tree: [...FT.slice(0, 3), ...P('petrified_forest', [17], 46)], rock: [...P('petrified_forest', [18, 19, 21, 23], 36), ['r', 'r:moonmt_small', 0.7]], deco: [...P('petrified_forest', [17, 19, 20, 22, 23, 24], 30), ...P('storm_peaks', [17, 18, 19], 30), ['r', 'r:mooncrack5', 1], ['r', 'r:tundracrack0', 1]] },
    desert: { tree: [...P('oasis', [17], 58), ...P('mesa_canyon', [17, 18, 18], 52)], rock: [...P('mesa_canyon', [19, 20, 21], 38), ['r', 'r:infernomt_wide', 0.7]], deco: [...P('mesa_canyon', [18, 19, 20, 22, 23, 24], 30), ['r', 'r:sulfur_0', 1.4], ['r', 'r:gold_1', 1.4], ['r', 'r:gold_3', 1.4]] },
    snow: { tree: [...TT, ...P('tundra', [17], 54)], rock: [['r', 'r:tundramt_small', 0.75], ['r', 'r:tundramt_wide', 0.75], ...P('tundra', [18, 19], 36)], deco: [...P('tundra', [18, 19, 20, 21, 22, 23], 30), ['r', 'r:snow1_0', 0.55], ['r', 'r:snow2_1', 0.55], ['r', 'r:snow4_0', 0.55], ['r', 'r:snowy_1', 1.4], ['r', 'r:tundracrack5', 1]] },
    crystal: { tree: [...P('salt_flats', [17, 18], 54), ...P('glacier', [17, 23], 54)], rock: [...P('glacier', [18, 22], 38), ['r', 'r:moonmt_small', 0.75]], deco: [...P('glacier', [19, 20, 21, 24], 30), ...P('salt_flats', [19, 21, 23], 30), ['r', 'r:gcry0', 1.8], ['r', 'r:gcry1', 1.8], ['r', 'r:rcry0', 1.8]] },
    volcano: { tree: [...P('obsidian_depths', [17, 18, 20], 52), ...P('ember_wastes', [24], 46)], rock: [['r', 'r:infernomt_small', 0.6], ['r', 'r:infernomt_wide', 0.6], ...P('ember_wastes', [18, 20], 36)], deco: [...P('ember_wastes', [17, 18, 19, 20, 21, 22, 23], 30), ['r', 'r:geyser', 1.4], ['r', 'r:magma_0', 1.6], ['r', 'r:magma_1', 1.6]] },
    sky: { tree: FT, rock: P('salt_flats', [19, 22], 34), deco: [...P('meadow', [17, 19, 21, 23, 24], 30), ...P('salt_flats', [21], 30)] },
    abyss: { tree: P('obsidian_depths', [17, 18, 21, 20], 52), rock: [['r', 'r:moonmt_small', 0.7], ['r', 'r:moonmt_tall', 0.7], ...P('obsidian_depths', [22, 23], 36)], deco: [...P('obsidian_depths', [19, 22, 23, 24], 30), ['r', 'r:rcry0', 1.8], ['r', 'r:rcry1', 1.8], ['r', 'r:mooncrack9', 1]] },
    town: { tree: FT.slice(0, 4), rock: P('storm_peaks', [17], 32), deco: P('meadow', [17, 19, 21, 23], 28) }
  };
  function put(g, e, cx, by, k) { return e[0] === 'tp' ? tp(g, e[1], e[2], cx, by, Math.round(e[3] * k)) : wa(g, e[1], cx, by, e[2] * k, true); }

  // ------------------------------------------------------------ dungeons (Dungeon tileset + Brimspire), in the reference style:
  // rooms of stone floor, a 2-tile-high brick wall face (ledge + face with banners / grates / torches / doors) above each room,
  // pure darkness everywhere else, edged by a lavender stone rim
  const isDg = (map) => map.def.kind === 'dungeon' || map.def.kind === 'jail';
  const DGS = {
    shadow_labyrinth: { tint: 'rgba(150,110,185,0.30)', brim: 0 },
    frost_crypt: { tint: 'rgba(110,160,220,0.26)', brim: 0, extra: [['r:gcry0', 1.8], ['r:gcry1', 1.8], ['r:snowy_1', 1.3]] },
    sky_sanctum: { tint: 'rgba(235,215,170,0.24)', brim: 0, extra: [['r:gcry2', 1.8], ['b:obelisks-effigies-05', 1]] },
    inferno_depths: { brim: 'volcano' },
    abyss_tower: { brim: 'abyss', tint: 'rgba(90,40,140,0.30)' },
    jail: { tint: 'rgba(120,120,140,0.2)', brim: 0 }
  };
  const dgOf = (map) => DGS[map.def.dungeon] || (map.def.kind === 'jail' ? DGS.jail : DGS.shadow_labyrinth);
  const WANG = ['00_bbbb', '01_bbbc', '02_bbcb', '03_bbcc', '04_bcbb', '05_bcbc', '06_bccb', '07_bccc', '08_cbbb', '09_cbbc', '10_cbcb', '11_cbcc', '12_ccbb', '13_ccbc', '14_cccb', '15_cccc'];
  const FLAG = ['b:flagstone-01', 'b:flagstone-01', 'b:flagstone-02', 'b:flagstone-01', 'b:flagstone-03'], FLAG_RARE = ['b:flagstone-09', 'b:flagstone-10', 'b:flagstone-13'];
  const FACE_PLAIN = [2, 3, 7, 3, 7, 2], FACE_DECO = [0, 5, 6, 1, 4, 8, 9, 8, 9];
  const RIM = '#8d6a90', RIM_HI = '#b892b5', RIM_LO = '#4a3450';
  // which part of the wall a WALL tile is: 'lo' face (floor right below), 'hi' ledge (face below it), or 'void'
  function wallPart(map, tx, ty, tileAt) {
    const b1 = tileAt(map, tx, ty + 1); if (b1 !== T.WALL) return 'lo';
    const b2 = tileAt(map, tx, ty + 2); if (b2 !== T.WALL) return 'hi';
    return 'void';
  }
  const solidVoid = (map, x, y, tileAt) => tileAt(map, x, y) === T.WALL && wallPart(map, x, y, tileAt) === 'void';
  function dungeonGround(g, map, t, tx, ty, px, py, tileAt) {
    const D0 = dgOf(map);
    if (t === T.WALL) {
      const part = wallPart(map, tx, ty, tileAt);
      if (part === 'lo') {
        const q = h2(tx, ty, 5); const v = q < 0.78 ? pk(FACE_PLAIN, h2(tx, ty, 6)) : pk(FACE_DECO, h2(tx, ty, 7));
        waTile(g, 'd:wall' + v, px, py);
        if (v === 8 || v === 9) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(px + TS / 2, py + TS / 2, 2, px + TS / 2, py + TS / 2, TS * 1.6); gr.addColorStop(0, 'rgba(255,170,60,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - TS * 1.5, py - TS * 1.5, TS * 4, TS * 4); g.restore(); }
        return true;
      }
      if (part === 'hi') { waTile(g, 'd:walltop' + Math.floor(h2(tx, ty, 8) * 6), px, py); return true; }
      // darkness + a stone rim wherever it touches a room, a corridor or the wall faces
      g.fillStyle = '#07050b'; g.fillRect(px, py, TS, TS);
      const open = (dx, dy) => !solidVoid(map, tx + dx, ty + dy, tileAt);
      const R = 5;
      const edge = (x, y, w, h, hl) => { g.fillStyle = RIM_LO; g.fillRect(x, y, w, h); g.fillStyle = RIM; g.fillRect(x + (w > h ? 0 : 1), y + (w > h ? 1 : 0), w - (w > h ? 0 : 2), h - (w > h ? 2 : 0)); if (hl) { g.fillStyle = RIM_HI; if (w > h) for (let i = 2; i < w; i += 8) g.fillRect(x + i, y + 1, 3, 2); else for (let i = 2; i < h; i += 8) g.fillRect(x + 1, y + i, 2, 3); } };
      if (open(0, 1)) edge(px, py + TS - R, TS, R, 1);
      if (open(0, -1)) edge(px, py, TS, R, 0);
      if (open(-1, 0)) edge(px, py, R, TS, 1);
      if (open(1, 0)) edge(px + TS - R, py, R, TS, 1);
      for (const [dx, dy, x, y] of [[-1, -1, 0, 0], [1, -1, TS - R, 0], [-1, 1, 0, TS - R], [1, 1, TS - R, TS - R]]) if (open(dx, dy) && !open(dx, 0) && !open(0, dy)) { g.fillStyle = RIM; g.fillRect(px + x, py + y, R, R); }
      return true;
    }
    if (t === T.WATER || t === T.LAVA) return false;
    if (D0.brim === 'volcano') {
      const c = (x, y) => (vn(x, y, 41, 4) > 0.52 ? 1 : 0);
      waTile(g, 'b:' + WANG[c(tx, ty) * 8 + c(tx + 1, ty) * 4 + c(tx, ty + 1) * 2 + c(tx + 1, ty + 1)], px, py);
    } else if (D0.brim === 'abyss') {
      const q = h2(tx, ty, 12); waTile(g, q < 0.015 ? FLAG_RARE[Math.floor(h2(tx, ty, 13) * 3)] : FLAG[Math.floor(q * FLAG.length)], px, py);
    } else {
      const q = h2(tx, ty, 10); waTile(g, 'd:floor' + (q < 0.7 ? 10 + Math.floor(h2(tx, ty, 11) * 12) : Math.floor(h2(tx, ty, 14) * 10)), px, py);
    }
    if (D0.tint) { g.fillStyle = D0.tint; g.fillRect(px, py, TS, TS); }
    // soft shadow cast by the wall face onto the floor below it
    if (tileAt(map, tx, ty - 1) === T.WALL) { g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(px, py, TS, 7); }
    return t !== T.STAIRS;
  }
  const DG_PROPS = [['d:barrel0', 1.5], ['d:barrel1', 1.5], ['d:barrels', 1.3], ['d:pot', 1.6], ['d:jar', 1.6], ['d:bones', 1.6], ['d:rubble', 1.2], ['d:torch', 1.8], ['d:stones', 1.6], ['d:spike0', 1.6], ['d:spike1', 1.6], ['d:spike2', 1.6]];
  const BRIM_PROPS = [['b:braziers-fire-pits-09', 1.1], ['b:braziers-fire-pits-12', 1.2], ['b:chains-soul-cages-06', 1], ['b:chains-soul-cages-09', 1], ['b:coffers-urns-09', 1], ['b:coffers-urns-13', 1], ['b:bones-trophies-02', 1], ['b:bones-trophies-06', 1], ['b:weapon-racks-01', 1], ['b:war-banners-03', 1], ['b:gongs-horns-drums-09', 1], ['b:hellforge-11', 1], ['b:scatter-debris-01', 1.3], ['b:scatter-debris-02', 1.3]];
  const BRIM_THEME = { volcano: [['b:ground-hazards-03', 1.1], ['b:ground-hazards-07', 1.1], ['b:ground-hazards-12', 1.1], ['b:hellforge-09', 1], ['b:charred-trees-spires-13', 1], ['b:charred-trees-spires-21', 1]], abyss: [['b:ground-marks-01', 1], ['b:ground-marks-03', 1], ['b:ground-marks-09', 1], ['b:obelisks-effigies-05', 1], ['b:obelisks-effigies-20', 1], ['b:ground-hazards-15', 1]] };
  const LANDMARK = ['b:set-pieces-01', 'b:set-pieces-02', 'b:shrines-huts-08', 'b:war-machines-02', 'b:war-machines-05', 'b:weapon-racks-16', 'b:war-banners-15', 'b:gongs-horns-drums-20', 'b:spire-towers-09', 'b:gateway-skull-2x1'];
  function dungeonObject(g, map, t, tx, ty, px, py, tileAt) {
    const D0 = dgOf(map), r = h2(tx, ty, 77), r2 = h2(tx, ty, 91), cx = px + TS / 2, by = py + TS;
    if (t === T.WALL) {
      // a double door now and then over three wall-face columns (ledge + face)
      if (wallPart(map, tx, ty, tileAt) === 'lo' && tx % 3 === 0 && h2(tx, ty, 61) < 0.12 && wallPart(map, tx + 1, ty, tileAt) === 'lo' && wallPart(map, tx + 2, ty, tileAt) === 'lo' && tileAt(map, tx, ty - 1) === T.WALL && tileAt(map, tx + 2, ty - 1) === T.WALL) waTile(g, h2(tx, ty, 62) < 0.5 ? 'd:door0' : 'd:door1', px, py - TS, TS * 3, TS * 2);
      return true;
    }
    if (t === T.TREE) return wa(g, pk(['d:statue0', 'd:statue1', 'd:pillar0', 'd:pillar2'], r), cx, by - 2, 1.4, true);
    if (t === T.ROCK) return wa(g, pk(['d:pillar0', 'd:pillar1', 'd:pillar2', 'd:statue0', 'd:statue1'], r), cx, by - 2, 1.45, true);
    if (t === T.DECO) {
      if (h2(tx, ty, 133) < 0.06) return wa(g, pk(LANDMARK, r2), cx, by, 0.8, true);
      const pool = r2 < 0.55 ? DG_PROPS : r2 < 0.85 ? (D0.brim ? BRIM_THEME[D0.brim] : BRIM_PROPS) : (D0.extra || BRIM_PROPS);
      const [n, k] = pk(pool, r); return wa(g, n, cx, by - 2, k, true);
    }
    return false;
  }

  // ------------------------------------------------------------ hooks used by ART.chunk
  TER.ground = function (g, map, t, tx, ty, px, py, tileAt) {
    if (isDg(map)) return okW() ? dungeonGround(g, map, t, tx, ty, px, py, tileAt) : false;
    return groundBase(g, map, t, tx, ty, px, py, tileAt);
  };
  TER.object = function (g, map, t, tx, ty, px, py, tileAt) {
    if (!TER.ready) return false;
    if (isDg(map)) return okW() ? dungeonObject(g, map, t, tx, ty, px, py, tileAt) : false;
    if (t === T.WALL) return false;
    const th = themeOf(map); if (!th) return false;
    const O = th.town ? OUT.town : OUT[map.def.biome] || OUT.meadow;
    const r = h2(tx, ty, 77), r2 = h2(tx, ty, 91), cx = px + TS / 2 + (r2 - 0.5) * 8, by = py + TS;
    if (t === T.TREE) return put(g, pk(O.tree, r), cx, by + 2, 0.9 + r2 * 0.25);
    if (t === T.ROCK) return put(g, pk(O.rock, r), cx, by, 0.85 + r * 0.3);
    if (t === T.DECO) return put(g, pk(O.deco, r), cx, by - 1, 0.9 + r2 * 0.2);
    return false;
  };
  // towns keep the procedural houses (no building pack was supplied)
  TER.buildings = () => false;
  TER.load();
})();

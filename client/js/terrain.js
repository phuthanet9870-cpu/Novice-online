// Textured terrain: seamless ground textures (12 biome sheets, 6×4 cells of 64 px: cells 1–8 = 4 materials × 2 variants,
// 17–24 = small props), painted trees / bushes / rocks / logs / flowers, town buildings and street decoration.
// Hooks into ART.chunk: when the sheets are loaded every chunk is redrawn with them; until then the procedural look stays.
(function () {
  const ART = window.ART, T = NO_MAP.T, TS = ART.TS;
  const MAN = window.TER_MAN || { N: {}, D: {} };
  const SHEETS = ['coral_reef', 'ember_wastes', 'glacier', 'mangrove', 'meadow', 'mesa_canyon', 'oasis', 'obsidian_depths', 'petrified_forest', 'salt_flats', 'storm_peaks', 'tundra'];
  const ATLAS = ['trees', 'bushes', 'rocks', 'logs', 'flowers'];
  const BUILD = ['castle', 'cathedral', 'guild', 'house', 'inn', 'palace', 'shop', 'smithy', 'stall_blue', 'stall_gold', 'stall_red', 'statue'];
  const TER = window.TER = { ready: false, img: {} };
  const base = 'client/assets/';
  let pending = 0;
  const load = (key, src) => { pending++; const im = new Image(); im.onload = im.onerror = () => { if (--pending === 0) { TER.ready = true; ART.resetChunks(); } }; im.src = src; TER.img[key] = im; };
  TER.load = () => { if (pending || TER.ready) return; for (const s of SHEETS) load('t:' + s, base + 'terrain/' + s + '.png'); for (const a of ATLAS) load('n:' + a, base + 'nature/' + a + '.png'); for (const b of BUILD) load('b:' + b, base + 'buildings/' + b + '.png'); load('deco', base + 'deco/deco.png'); if (window.WORLD_ART) load('world', WORLD_ART.src); };
  const M = (b, p) => ({ b, p });
  // our biomes → ground materials, scatter props, tree kinds and season
  const TH = {
    meadow: { base: M('meadow', 0), alt: M('meadow', 2), path: M('oasis', 2), water: M('oasis', 3), props: [['meadow', [17, 18, 19, 20, 21, 22, 23, 24]]], trees: ['oak', 'apple', 'maple', 'birch'], bush: ['round_bush', 'flower_bush', 'fern'], rock: ['mossy_rock', 'stone'], flowers: 1, season: 'summer' },
    forest: { base: M('meadow', 1), alt: M('mangrove', 3), path: M('oasis', 2), water: M('mangrove', 0), props: [['meadow', [18, 20, 22]], ['petrified_forest', [17, 19, 21, 23]]], trees: ['pine', 'spruce', 'oak', 'birch'], bush: ['fern', 'shrub', 'berry_bush'], rock: ['mossy_rock', 'boulder'], logs: 1, season: 'summer' },
    swamp: { base: M('mangrove', 3), alt: M('mangrove', 1), path: M('petrified_forest', 2), water: M('mangrove', 0), props: [['mangrove', [17, 18, 19, 20, 21, 22, 23, 24]]], trees: ['willow', 'deadtree', 'oak'], bush: ['fern', 'shrub'], rock: ['mossy_rock'], logs: 1, season: 'autumn' },
    beach: { base: M('oasis', 2), alt: M('coral_reef', 3), path: M('salt_flats', 2), water: M('coral_reef', 1), props: [['coral_reef', [18, 19, 20, 22]], ['oasis', [19, 20]]], trees: ['palm', 'banana'], bush: ['dry_bush', 'shrub'], rock: ['flat_rock', 'pebbles'], season: 'summer' },
    ruins: { base: M('petrified_forest', 3), alt: M('storm_peaks', 0), path: M('petrified_forest', 1), water: M('coral_reef', 1), props: [['petrified_forest', [17, 19, 20, 22, 23]], ['storm_peaks', [17, 18, 19]]], trees: ['deadtree', 'oak', 'autumn'], bush: ['dry_bush', 'hedge'], rock: ['cracked_rock', 'rock_pile'], logs: 1, season: 'autumn' },
    desert: { base: M('oasis', 2), alt: M('mesa_canyon', 0), path: M('salt_flats', 2), water: M('oasis', 3), props: [['oasis', [18, 20, 21]], ['mesa_canyon', [17, 18, 19, 20, 22, 23, 24]]], trees: ['palm'], bush: ['dry_bush'], rock: ['boulder', 'flat_rock', 'rock_pile'], season: 'summer' },
    snow: { base: M('tundra', 0), alt: M('tundra', 1), path: M('tundra', 2), water: M('glacier', 3), props: [['tundra', [17, 18, 19, 20, 21, 22, 23, 24]]], trees: ['pine', 'spruce', 'birch'], bush: ['shrub', 'round_bush'], rock: ['boulder', 'stone'], season: 'winter' },
    crystal: { base: M('glacier', 1), alt: M('salt_flats', 1), path: M('salt_flats', 0), water: M('glacier', 3), props: [['glacier', [17, 18, 19, 20, 22]], ['salt_flats', [19, 21, 23]]], trees: ['birch', 'sakura'], bush: ['hedge'], rock: ['crystal_rock'], season: 'winter' },
    volcano: { base: M('ember_wastes', 0), alt: M('ember_wastes', 2), path: M('petrified_forest', 2), lava: M('ember_wastes', 3), water: M('ember_wastes', 3), props: [['ember_wastes', [17, 18, 19, 20, 21, 22, 23, 24]]], trees: ['deadtree'], bush: ['dry_bush'], rock: ['cracked_rock', 'rock_pile', 'boulder'], season: 'autumn' },
    sky: { base: M('meadow', 0), alt: M('oasis', 1), path: M('salt_flats', 3), water: M('glacier', 3), props: [['meadow', [17, 19, 21, 23, 24]]], trees: ['sakura', 'birch'], bush: ['flower_bush', 'round_bush'], rock: ['flat_rock'], flowers: 1, season: 'summer' },
    abyss: { base: M('obsidian_depths', 0), alt: M('obsidian_depths', 1), path: M('storm_peaks', 3), lava: M('ember_wastes', 3), water: M('obsidian_depths', 2), props: [['obsidian_depths', [17, 18, 19, 20, 21, 22, 23, 24]]], trees: ['deadtree'], bush: ['dry_bush'], rock: ['crystal_rock', 'cracked_rock'], season: 'winter' },
    town: { base: M('meadow', 0), alt: M('meadow', 2), path: M('oasis', 2), plaza: M('salt_flats', 2), water: M('oasis', 3), props: [['meadow', [17, 19, 21, 23]]], trees: ['oak', 'sakura', 'maple'], bush: ['hedge', 'flower_bush', 'round_bush'], rock: ['stone'], flowers: 1, season: 'summer', town: 1 }
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
  TER.ground = function (g, map, t, tx, ty, px, py, tileAt) {
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
  function sprite(g, name, cx, by, size) {
    const e = MAN.N[name]; if (!e) return false;
    const im = TER.img['n:' + e[0]]; if (!im || !im.naturalWidth) return false;
    const c = e[3];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, by - 2, size * 0.3, size * 0.09, 0, 0, 7); g.fill();
    g.drawImage(im, e[1], e[2], c, c, cx - size / 2, by - size, size, size);
    return true;
  }
  const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
  function named(kind, season, r) { let n = kind + '_' + season + '_' + (r < 0.5 ? 1 : 2); if (MAN.N[n]) return n; for (const s of [season, 'summer', 'autumn', 'winter']) for (const i of [1, 2]) { n = kind + '_' + s + '_' + i; if (MAN.N[n]) return n; } return null; }
  function deco(g, name, cx, by, scale) {
    const e = MAN.D[name], im = TER.img.deco; if (!e || !im || !im.naturalWidth) return false;
    const w = e[2] * scale, h = e[3] * scale;
    g.drawImage(im, e[0], e[1], e[2], e[3], cx - w / 2, by - h, w, h);
    return true;
  }
  const TOWN_DECO = ['lamp1', 'lamp3', 'barrels', 'crates', 'sacks', 'bench_wood', 'planter_pink', 'planter_white', 'pot_white', 'vase', 'banner1', 'banner2', 'noticeboard', 'cart', 'stall_fruit', 'stall_potion', 'weapon_rack', 'chest'];
  TER.object = function (g, map, t, tx, ty, px, py) {
    const th = themeOf(map); if (!TER.ready || !th) return false;
    const r = h2(tx, ty, 77), r2 = h2(tx, ty, 91), cx = px + TS / 2 + (r2 - 0.5) * 8, by = py + TS;
    if (t === T.TREE) { const kind = pick(th.trees, r); const n = named(kind, th.season, r2); return n ? sprite(g, n, cx, by + 2, 60 + r * 18) : false; }
    if (t === T.ROCK) { const n = named(pick(th.rock, r), th.season, r2); return n ? sprite(g, n, cx, by, 34 + r * 12) : false; }
    if (t === T.DECO) {
      if (th.town) return deco(g, TOWN_DECO[Math.floor(r * TOWN_DECO.length)], cx, by - 2, 0.5);
      if (r < 0.35) { const [b, list] = th.props[Math.floor(r2 * th.props.length)]; const im = TER.img['t:' + b]; if (!im || !im.naturalWidth) return false; const [sx, sy] = cell(list[Math.floor(r * 97) % list.length]); g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, by - 4, 9, 3, 0, 0, 7); g.fill(); g.drawImage(im, sx, sy, 64, 64, cx - 15, by - 30, 30, 30); return true; }
      if (r < 0.6 && th.flowers) { const n = named(pick(['blue_flowers', 'pink_flowers', 'red_flowers', 'tulips', 'white_daisies', 'yellow_flowers', 'sunflower'], r2), th.season, r); return n ? sprite(g, n, cx, by, 30) : false; }
      if (r < 0.75 && th.logs) { const n = named(pick(['fallen_log', 'mossy_log', 'tree_stump', 'hollow_log'], r2), th.season, r); return n ? sprite(g, n, cx, by, 36) : false; }
      const n = named(pick(th.bush, r2), th.season, r); return n ? sprite(g, n, cx, by, 34 + r * 8) : false;
    }
    return false;
  };
  // towns: every block of house tiles becomes one building sprite, drawn once per chunk (clipped by the chunk canvas)
  TER.buildings = function (g, map, x0, y0, w, h, tileAt) {
    const th = themeOf(map); if (!TER.ready || !th) return false;
    const done = new Set();
    for (let ty = y0; ty < y0 + h; ty++) for (let tx = x0; tx < x0 + w; tx++) {
      if (tileAt(map, tx, ty) !== T.HOUSE) continue;
      let ox = tx, oy = ty;
      while (tileAt(map, ox - 1, oy) === T.HOUSE) ox--;
      while (tileAt(map, ox, oy - 1) === T.HOUSE) oy--;
      while (tileAt(map, ox - 1, oy) === T.HOUSE) ox--;
      const key = ox + ',' + oy; if (done.has(key)) continue; done.add(key);
      let bw = 1, bh = 1; while (tileAt(map, ox + bw, oy) === T.HOUSE) bw++; while (tileAt(map, ox, oy + bh) === T.HOUSE) bh++;
      const r = h2(ox, oy, 31), area = bw * bh;
      const kind = area >= 40 ? pick(['castle', 'cathedral'], r) : area >= 20 ? pick(['guild', 'inn', 'cathedral'], r) : pick(['house', 'shop', 'smithy', 'inn', 'house'], r);
      const im = TER.img['b:' + kind]; if (!im || !im.naturalWidth) continue;
      const dw = (bw + 0.6) * TS, dh = dw * im.naturalHeight / im.naturalWidth;
      const px = (ox - x0) * TS - 0.3 * TS, py = (oy + bh - x0 * 0 - y0) * TS - dh + 4;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(px + dw / 2, (oy + bh - y0) * TS - 2, dw * 0.45, 7, 0, 0, 7); g.fill();
      g.drawImage(im, px, py, dw, dh);
    }
    return true;
  };

  // ------------------------------------------------------------ world atlas (Brimspire demo · roboden CC0 · Dungeon tileset)
  const WA = (window.WORLD_ART || { r: {} }).r;
  function wa(g, name, cx, by, scale, shadow) {
    const e = WA[name], im = TER.img.world; if (!e || !im || !im.naturalWidth) return false;
    const w = e[2] * scale, h = e[3] * scale;
    if (shadow) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, by - 2, w * 0.38, Math.max(3, h * 0.08), 0, 0, 7); g.fill(); }
    g.drawImage(im, e[0], e[1], e[2], e[3], Math.round(cx - w / 2), Math.round(by - h), Math.round(w), Math.round(h));
    return true;
  }
  function waTile(g, name, px, py) { const e = WA[name], im = TER.img.world; if (!e || !im || !im.naturalWidth) return false; g.drawImage(im, e[0], e[1], e[2], e[3], px, py, TS, TS); return true; }
  const seq = (pre, a, b) => Array.from({ length: b - a + 1 }, (_, i) => pre + (a + i));
  // per-biome scatter for outdoor maps: roboden (CC0) props only — Dungeon tileset ('d:') and Brimspire ('b:') are dungeon-only packs: [name, scale] lists for decoration tiles, plus optional tree / rock replacements
  const WTH = {
    forest: { deco: [['r:organic_1', 1.6], ['r:organic_3', 1.6], ['r:organic_5', 1.8], ], trees: seq('r:ftree', 0, 5), treeScale: 2.2, rock: ['r:forestmt_small', 'r:forestmt_wide'], rockScale: 0.8 },
    snow: { deco: [['r:snow1_0', 0.55], ['r:snow2_1', 0.55], ['r:snow3_2', 0.55], ['r:snow4_0', 0.55], ['r:snowy_1', 1.4], ['r:snowy_2', 1.4], ['r:tundracrack5', 1], ['r:tundracrack0', 1]], trees: seq('r:ttree', 0, 11), treeScale: 2.2, rock: ['r:tundramt_small', 'r:tundramt_wide', 'r:tundramt_tall'], rockScale: 0.75 },
    crystal: { deco: [['r:gcry0', 1.8], ['r:gcry1', 1.8], ['r:gcry2', 1.8], ['r:rcry0', 1.8], ['r:rcry1', 1.8], ['r:mooncrack5', 1]], rock: ['r:moonmt_small', 'r:moonmt_wide'], rockScale: 0.75 },
    desert: { deco: [['r:sulfur_0', 1.4], ['r:sulfur_1', 1.4], ['r:gold_1', 1.4], ['r:gold_3', 1.4], ], rock: ['r:infernomt_wide', 'r:forestmt_small'], rockScale: 0.7 },
    ruins: { deco: [['r:mooncrack5', 1], ['r:tundracrack0', 1], ] },
    swamp: { deco: [['r:organic_0', 1.8], ['r:organic_2', 1.8], ['r:organic_4', 1.8], ] },
    beach: { deco: [['r:organic_6', 1.6]] },
    volcano: { deco: [['r:infernomt_small', 0.5], ['r:geyser', 1.4], ['r:magma_0', 1.6], ['r:magma_1', 1.6], ], rock: ['r:infernomt_small', 'r:infernomt_wide'], rockScale: 0.6 },
    abyss: { deco: [['r:rcry0', 1.8], ['r:rcry1', 1.8], ['r:mooncrack9', 1], ], rock: ['r:moonmt_small', 'r:moonmt_wide', 'r:moonmt_tall'], rockScale: 0.7 }
  };
  // Brimspire (a dungeon pack) dresses the fire / abyss dungeons: big set pieces + small props
  const LANDMARK = { volcano: ['b:war-machines-02', 'b:war-machines-05', 'b:shrines-huts-04', 'b:spire-towers-03', 'b:set-pieces-01', 'b:gongs-horns-drums-20', 'b:war-banners-15', 'b:weapon-racks-16'], abyss: ['b:gateway-skull-2x1', 'b:set-pieces-02', 'b:spire-towers-03', 'b:shrines-huts-08', 'b:spire-towers-09', 'b:set-pieces-01'] };
  const WANG = ['00_bbbb', '01_bbbc', '02_bbcb', '03_bbcc', '04_bcbb', '05_bcbc', '06_bccb', '07_bccc', '08_cbbb', '09_cbbc', '10_cbcb', '11_cbcc', '12_ccbb', '13_ccbc', '14_cccb', '15_cccc'];
  const FLAG = ['b:flagstone-01', 'b:flagstone-01', 'b:flagstone-02', 'b:flagstone-01', 'b:flagstone-03'], FLAG_RARE = ['b:flagstone-09', 'b:flagstone-10', 'b:flagstone-13'];
  const isDg = (map) => map.def.kind === 'dungeon' || map.def.kind === 'jail';
  const BRIM_DG = { inferno_depths: 'volcano', abyss_tower: 'abyss' };
  const brimOf = (map) => map.def.kind === 'dungeon' && BRIM_DG[map.def.dungeon];
  const BRIM_PROPS = { volcano: [['b:braziers-fire-pits-09', 1.1], ['b:braziers-fire-pits-12', 1.2], ['b:ground-hazards-03', 1.1], ['b:ground-hazards-07', 1.1], ['b:ground-hazards-12', 1.1], ['b:charred-trees-spires-13', 1], ['b:bones-trophies-06', 1], ['b:hellforge-09', 1], ['b:hellforge-11', 1], ['b:war-banners-03', 1], ['b:weapon-racks-01', 1], ['b:coffers-urns-13', 1], ['b:scatter-debris-01', 1.3], ['b:scatter-debris-03', 1.3]],
    abyss: [['b:chains-soul-cages-06', 1], ['b:chains-soul-cages-09', 1], ['b:obelisks-effigies-05', 1], ['b:obelisks-effigies-20', 1], ['b:ground-marks-01', 1], ['b:ground-marks-03', 1], ['b:ground-marks-09', 1], ['b:coffers-urns-09', 1], ['b:gongs-horns-drums-09', 1], ['b:bones-trophies-02', 1], ['b:charred-trees-spires-21', 1], ['b:scatter-debris-02', 1.3], ['b:scatter-debris-04', 1.3]] };
  const groundBase = TER.ground, objectBase = TER.object;
  TER.ground = function (g, map, t, tx, ty, px, py, tileAt) {
    const im = TER.img.world, okW = TER.ready && im && im.naturalWidth;
    if (okW && isDg(map)) {
      // Dungeon tileset: stone floors (mostly plain, a few cracked / mossy), wall faces with banners / torches, wall tops
      if (t === T.WALL) {
        const below = tileAt(map, tx, ty + 1);
        // wall face toward the room: plain brick most of the time, sometimes a banner, grate or lit torch
        if (below !== T.WALL) { const q = h2(tx, ty, 5); return waTile(g, 'd:wall' + (q < 0.8 ? [2, 3, 7, 3, 7][Math.floor(h2(tx, ty, 6) * 5)] : [0, 5, 6, 1, 4, 8, 9][Math.floor(h2(tx, ty, 7) * 7)]), px, py); }
        waTile(g, 'd:wallin' + Math.floor(h2(tx, ty, 8) * 6), px, py); g.fillStyle = 'rgba(8,4,16,0.55)'; g.fillRect(px, py, TS, TS); return true;
      }
      if (t === T.WATER || t === T.LAVA) return false;
      const bk = brimOf(map);
      if (bk) {
        const c = (x, y) => (vn(x, y, 41, 4) > 0.52 ? 1 : 0);
        waTile(g, 'b:' + WANG[c(tx, ty) * 8 + c(tx + 1, ty) * 4 + c(tx, ty + 1) * 2 + c(tx + 1, ty + 1)], px, py);
        if (vn(tx, ty, 57, 6) > 0.62) { const q = h2(tx, ty, 12); waTile(g, q < 0.02 ? FLAG_RARE[Math.floor(h2(tx, ty, 13) * 3)] : FLAG[Math.floor(q * FLAG.length)], px, py); }
        if (bk === 'abyss') { g.fillStyle = 'rgba(60,20,110,0.3)'; g.fillRect(px, py, TS, TS); }
        if (tileAt(map, tx, ty - 1) === T.WALL) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, py, TS, 8); }
        return t !== T.STAIRS;
      }
      const r = h2(tx, ty, 9);
      waTile(g, 'd:floor' + Math.floor(h2(tx, ty, 10) * 10), px, py);
      if (tileAt(map, tx, ty - 1) === T.WALL) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, py, TS, 8); }
      if (t === T.STAIRS) return false;
      return true;
    }
    return groundBase(g, map, t, tx, ty, px, py, tileAt);
  };
  const DG_PROPS = [['d:barrel0', 1.5], ['d:barrel1', 1.5], ['d:barrels', 1.3], ['d:pot', 1.6], ['d:jar', 1.6], ['d:bones', 1.6], ['d:rubble', 1.2], ['d:torch', 1.8], ['d:pillar0', 1.3], ['d:pillar2', 1.3], ['d:spikes', 0.5]];
  TER.object = function (g, map, t, tx, ty, px, py) {
    const im = TER.img.world, okW = TER.ready && im && im.naturalWidth;
    const r = h2(tx, ty, 77), r2 = h2(tx, ty, 91), cx = px + TS / 2, by = py + TS;
    if (okW && isDg(map)) {
      if (t === T.WALL) return true; // already painted in the ground pass
      const bk = brimOf(map);
      if (bk && (t === T.DECO || t === T.ROCK)) { if (h2(tx, ty, 133) < 0.08) return wa(g, LANDMARK[bk][Math.floor(r * LANDMARK[bk].length)], cx, by, 0.75, true); const L = BRIM_PROPS[bk]; const [n, k] = L[Math.floor(r * L.length)]; return wa(g, n, cx, by - 2, k, true); }
      if (t === T.DECO || t === T.ROCK) { const [n, k] = DG_PROPS[Math.floor(r * DG_PROPS.length)]; return wa(g, n, cx, by - 2, k, true); }
      if (t === T.TREE) return brimOf(map) ? wa(g, r < 0.5 ? 'b:obelisks-effigies-20' : 'b:charred-trees-spires-13', cx, by - 2, 1.1, true) : wa(g, r < 0.5 ? 'd:pillar1' : 'd:pillar0', cx, by - 2, 1.4, true);
      return false;
    }
    if (t === T.WALL) return false;
    const th = themeOf(map), w = th && !th.town && WTH[map.def.biome];
    if (okW && w) {
      if (t === T.TREE && w.trees && r2 < 0.45) return wa(g, w.trees[Math.floor(r * w.trees.length)], cx, by + 2, (w.treeScale || 1) * (0.9 + r2 * 0.25), true);
      if (t === T.ROCK && w.rock && r2 < 0.5) return wa(g, w.rock[Math.floor(r * w.rock.length)], cx, by, (w.rockScale || 1) * (0.85 + r * 0.3), true);
      if (t === T.DECO) {
        if (r2 < 0.4) { const [n, k] = w.deco[Math.floor(r * w.deco.length)]; return wa(g, n, cx, by - 1, k, k > 1.2); }
      }
    }
    return objectBase(g, map, t, tx, ty, px, py);
  };
  TER.load();
})();

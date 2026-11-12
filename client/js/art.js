// Procedural art: tiles (chunk cache), characters, monsters, NPCs, icons. No external assets needed.
(function () {
  const D = NO_DATA, M = NO_MAP, RNG = NO_RNG;
  const T = M.T;
  const TS = 32; // tile size in px
  const ART = { TS };
  window.ART = ART;

  // ------------------------------------------------------------ helpers
  function shade(hex, amt) {
    if (hex.startsWith('hsl')) {
      const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(hex); if (!m) return hex;
      return `hsl(${m[1]},${m[2]}%,${Math.max(0, Math.min(100, +m[3] + amt * 50))}%)`;
    }
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  ART.shade = shade;
  const h2 = (x, y, s) => RNG.hash2(x, y, s);

  // ------------------------------------------------------------ tile chunks
  const CH = 16;
  ART.chunkCache = new Map();
  ART.resetChunks = () => ART.chunkCache.clear();
  ART.chunk = function (map, cx, cy) {
    const key = cx + ',' + cy;
    let c = ART.chunkCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const PAD = 2;
    c.width = (CH + PAD * 2) * TS; c.height = (CH + PAD * 2) * TS;
    const g = c.getContext('2d');
    const B = D.BIOMES[map.def.kind === 'town' ? map.def.biome : map.def.biome] || D.BIOMES.meadow;
    const x0 = cx * CH - PAD, y0 = cy * CH - PAD;
    // ground layer
    for (let ty = y0; ty < y0 + CH + PAD * 2; ty++) for (let tx = x0; tx < x0 + CH + PAD * 2; tx++) {
      const px = (tx - x0) * TS, py = (ty - y0) * TS;
      const t = tileAt(map, tx, ty);
      drawGround(g, map, B, t, tx, ty, px, py);
    }
    // objects layer (sorted by row so taller objects overlap correctly)
    for (let ty = y0; ty < y0 + CH + PAD * 2; ty++) for (let tx = x0; tx < x0 + CH + PAD * 2; tx++) {
      const t = tileAt(map, tx, ty);
      if (t === T.TREE || t === T.ROCK || t === T.DECO || t === T.WALL || t === T.HOUSE) drawObject(g, map, B, t, tx, ty, (tx - x0) * TS, (ty - y0) * TS);
    }
    c.pad = PAD;
    if (ART.chunkCache.size > 220) ART.chunkCache.delete(ART.chunkCache.keys().next().value);
    ART.chunkCache.set(key, c);
    return c;
  };
  function tileAt(map, x, y) { if (x < 0 || y < 0 || x >= map.w || y >= map.h) return map.def.kind === 'dungeon' || map.def.kind === 'arena' || map.def.kind === 'wb' || map.def.kind === 'jail' ? T.WALL : T.TREE; return map.tiles[y * map.w + x]; }

  function drawGround(g, map, B, t, tx, ty, px, py) {
    const n = h2(tx, ty, 11);
    const dungeon = map.def.kind === 'dungeon';
    let base = B.ground[(n * 3) | 0];
    if (t === T.WATER || t === T.LAVA) {
      const lava = t === T.LAVA;
      g.fillStyle = lava ? (map.def.biome === 'abyss' ? '#160a24' : '#c8401a') : B.water; g.fillRect(px, py, TS, TS);
      g.fillStyle = lava ? (map.def.biome === 'abyss' ? 'rgba(140,60,255,0.25)' : 'rgba(255,200,60,0.35)') : 'rgba(255,255,255,0.12)';
      if (n < 0.5) g.fillRect(px + (n * 20) | 0, py + 8 + ((n * 97) % 14 | 0), 10, 2);
      // shoreline
      for (const [dx, dy, x, y, w, hh] of [[0, -1, 0, 0, TS, 3], [0, 1, 0, TS - 3, TS, 3], [-1, 0, 0, 0, 3, TS], [1, 0, TS - 3, 0, 3, TS]]) {
        const o = tileAt(map, tx + dx, ty + dy);
        if (o !== T.WATER && o !== T.LAVA && o !== T.BRIDGE) { g.fillStyle = lava ? 'rgba(255,230,120,0.6)' : 'rgba(255,255,255,0.35)'; g.fillRect(px + x, py + y, w, hh); }
      }
      return;
    }
    if (t === T.PATH) base = B.path;
    if (t === T.FLOOR) base = dungeon ? shade(B.ground[(n * 3) | 0], map.def.biome === 'snow' || map.def.biome === 'sky' ? -0.25 : 0.12) : (map.def.kind === 'town' || map.def.kind === 'castle' ? '#b9b2a2' : shade(B.path, 0.05));
    if (t === T.BRIDGE) base = '#8a6a44';
    if (t === T.STAIRS) base = '#2a1a44';
    if (t === T.WALL && dungeon) base = shade(B.ground[0], -0.7);
    g.fillStyle = base; g.fillRect(px, py, TS, TS);
    if (t === T.FLOOR && !dungeon) {
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
      if (n > 0.85) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(px + 4, py + 4, 10, 8); }
      return;
    }
    if (t === T.FLOOR && dungeon) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1); if (n > 0.9) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px + 6, py + 6, 8, 6); } return; }
    if (t === T.BRIDGE) { g.fillStyle = '#6b4f30'; for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 8 + 6, TS, 2); return; }
    if (t === T.STAIRS) {
      const grd = g.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 16);
      grd.addColorStop(0, '#d0b0ff'); grd.addColorStop(1, '#2a1a44'); g.fillStyle = grd; g.fillRect(px, py, TS, TS); return;
    }
    // ground texture
    const n2 = h2(tx, ty, 23);
    g.fillStyle = 'rgba(0,0,0,0.06)'; if (n2 < 0.3) g.fillRect(px + (n2 * 60 | 0) % 24, py + (n2 * 130 | 0) % 24, 6, 4);
    g.fillStyle = 'rgba(255,255,255,0.07)'; if (n2 > 0.7) g.fillRect(px + (n2 * 77 | 0) % 26, py + (n2 * 41 | 0) % 26, 4, 3);
    if (t === T.PATH) { g.fillStyle = 'rgba(0,0,0,0.08)'; if (n > 0.6) g.fillRect(px + 10, py + 14, 5, 3); }
    if (t === T.GROUND && (map.def.biome === 'meadow' || map.def.biome === 'forest' || map.def.kind === 'town')) {
      g.strokeStyle = 'rgba(30,70,20,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const gx = px + ((h2(tx, ty, 50 + i) * 28) | 0) + 2, gy = py + ((h2(tx, ty, 60 + i) * 26) | 0) + 4; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - 1, gy - 4); g.moveTo(gx + 2, gy); g.lineTo(gx + 3, gy - 3); g.stroke(); }
    }
  }

  function drawObject(g, map, B, t, tx, ty, px, py) {
    const n = h2(tx, ty, 77);
    const cx = px + TS / 2, cy = py + TS / 2;
    if (t === T.WALL) {
      const dungeon = map.def.kind === 'dungeon';
      const below = tileAt(map, tx, ty + 1);
      const top = dungeon ? shade(B.ground[0], map.def.biome === 'snow' || map.def.biome === 'sky' ? -0.45 : -0.15) : '#9a9488';
      g.fillStyle = top; g.fillRect(px, py - 10, TS, TS);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(px + 0.5, py - 9.5, TS - 1, TS - 1);
      if (below !== T.WALL) { g.fillStyle = dungeon ? shade(B.ground[0], -0.6) : '#6d685e'; g.fillRect(px, py + TS - 10, TS, 10); if (dungeon) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px, py - 10, TS, 2); } g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(px + (n * 20 | 0), py + TS - 8, 8, 3); }
      return;
    }
    if (t === T.HOUSE) {
      const h = (h2(Math.floor(tx / 6), Math.floor(ty / 5), 9) * 5) | 0;
      const roofs = ['#b8483a', '#3a6ab8', '#5a8a3a', '#8a5aa8', '#b8863a'];
      const below = tileAt(map, tx, ty + 1), above = tileAt(map, tx, ty - 1);
      if (below !== T.HOUSE) {
        g.fillStyle = '#e6d6b8'; g.fillRect(px, py - 2, TS, TS + 2); g.fillStyle = '#c8b898'; g.fillRect(px, py + TS - 6, TS, 6);
        if (n < 0.3) { g.fillStyle = '#6a4a2a'; g.fillRect(px + 10, py + 8, 12, 18); } else if (n < 0.7) { g.fillStyle = '#7ab8e0'; g.fillRect(px + 8, py + 6, 14, 10); g.strokeStyle = '#6a4a2a'; g.strokeRect(px + 8.5, py + 6.5, 13, 9); }
      } else {
        g.fillStyle = roofs[h]; g.fillRect(px, py - 12, TS, TS + 12);
        g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 4; i++) g.fillRect(px, py - 12 + i * 10, TS, 2);
        if (above !== T.HOUSE) { g.fillStyle = shade(roofs[h], 0.25); g.fillRect(px, py - 14, TS, 5); }
      }
      return;
    }
    const kind = t === T.TREE ? B.obj : t === T.ROCK ? 'rock' : B.obj2;
    const s = 0.8 + n * 0.45;
    if (t !== T.DECO) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, py + TS - 4, 12 * s, 5 * s, 0, 0, 7); g.fill(); }
    switch (kind) {
      case 'tree': case 'cloudtree': {
        const leaf = kind === 'cloudtree' ? '#ffffff' : ['#2f7a2f', '#3a8a35', '#2a6a2a'][(n * 3) | 0];
        g.fillStyle = kind === 'cloudtree' ? '#c8b8e8' : '#6a4a2a'; g.fillRect(cx - 3, py + 8, 6, 20);
        for (const [ox, oy, r] of [[0, -6, 15], [-9, 2, 11], [9, 2, 11], [0, 4, 12]]) { g.fillStyle = shade(leaf, oy < 0 ? 0.1 : -0.1); g.beginPath(); g.arc(cx + ox * s, py + oy * s, r * s, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx - 5, py - 10 * s, 6 * s, 0, 7); g.fill();
        break;
      }
      case 'pine': case 'snowpine': {
        g.fillStyle = '#5a3a1a'; g.fillRect(cx - 3, py + 14, 6, 14);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = kind === 'snowpine' ? (i === 0 ? '#f4f8ff' : '#2f6a4a') : shade('#1f5a2f', i * 0.08);
          g.beginPath(); g.moveTo(cx, py - 22 * s + i * 10); g.lineTo(cx - (12 + i * 4) * s, py + 2 + i * 9); g.lineTo(cx + (12 + i * 4) * s, py + 2 + i * 9); g.fill();
          if (kind === 'snowpine') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, py - 22 * s + i * 10); g.lineTo(cx - 6, py - 12 + i * 10); g.lineTo(cx + 6, py - 12 + i * 10); g.fill(); }
        }
        break;
      }
      case 'deadtree': g.strokeStyle = '#3a2f22'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, py + 28); g.lineTo(cx, py - 6); g.lineTo(cx - 10, py - 16); g.moveTo(cx, py + 4); g.lineTo(cx + 12, py - 8); g.stroke(); break;
      case 'palm': g.strokeStyle = '#8a6a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, py + 28); g.quadraticCurveTo(cx + 6, py + 8, cx + 2, py - 10); g.stroke(); g.fillStyle = '#3a9a3a'; for (let a = 0; a < 6; a++) { g.save(); g.translate(cx + 2, py - 10); g.rotate(a * 1.05); g.beginPath(); g.ellipse(10, 0, 12, 4, 0, 0, 7); g.fill(); g.restore(); } break;
      case 'pillar': g.fillStyle = '#c8c4b4'; g.fillRect(cx - 7, py - 18, 14, 44); g.fillStyle = '#e0dccc'; g.fillRect(cx - 9, py - 22, 18, 6); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(cx + 2, py - 16, 4, 40); if (n < 0.4) { g.fillStyle = '#5a8a3a'; g.fillRect(cx - 7, py + 10, 6, 8); } break;
      case 'cactus': g.fillStyle = '#4a8a3a'; g.fillRect(cx - 4, py - 10, 9, 36); g.fillRect(cx - 12, py, 6, 4); g.fillRect(cx - 12, py - 8, 4, 10); g.fillRect(cx + 5, py + 4, 7, 4); g.fillRect(cx + 9, py - 4, 4, 10); break;
      case 'crystal': for (const [ox, hh, c] of [[-6, 26, '#8a7aff'], [4, 34, '#6ad0ff'], [10, 18, '#c08aff']]) { g.fillStyle = c; g.beginPath(); g.moveTo(cx + ox, py + 26 - hh); g.lineTo(cx + ox - 5, py + 26); g.lineTo(cx + ox + 5, py + 26); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx + ox - 1, py + 28 - hh, 2, hh * 0.6); } break;
      case 'lavarock': g.fillStyle = '#2a1f1c'; g.beginPath(); g.moveTo(cx - 14, py + 26); g.lineTo(cx - 8, py - 8); g.lineTo(cx + 6, py - 14); g.lineTo(cx + 14, py + 26); g.fill(); g.strokeStyle = '#ff6a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 4, py + 22); g.lineTo(cx, py); g.lineTo(cx + 4, py - 8); g.stroke(); break;
      case 'voidspire': g.fillStyle = '#1a1028'; g.beginPath(); g.moveTo(cx, py - 30); g.lineTo(cx - 9, py + 26); g.lineTo(cx + 9, py + 26); g.fill(); g.fillStyle = '#a050ff'; g.beginPath(); g.arc(cx, py - 4, 3, 0, 7); g.fill(); break;
      case 'rock': g.fillStyle = '#7a7a72'; g.beginPath(); g.ellipse(cx, py + 18, 13 * s, 10 * s, 0, 0, 7); g.fill(); g.fillStyle = '#9a9a92'; g.beginPath(); g.ellipse(cx - 3, py + 14, 8 * s, 6 * s, 0, 0, 7); g.fill(); break;
      case 'flower': for (let i = 0; i < 3; i++) { const fx = px + 6 + h2(tx, ty, i) * 20, fy = py + 8 + h2(tx, ty, i + 9) * 18; g.fillStyle = ['#ff7aa8', '#ffe05a', '#fff', '#a07aff'][(h2(tx, ty, i + 3) * 4) | 0]; g.beginPath(); g.arc(fx, fy, 2.5, 0, 7); g.fill(); } break;
      case 'bush': g.fillStyle = '#2f6a2a'; g.beginPath(); g.arc(cx - 5, cy + 6, 7, 0, 7); g.arc(cx + 5, cy + 6, 7, 0, 7); g.fill(); break;
      case 'reed': g.strokeStyle = '#7a8a3a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(px + 8 + i * 5, py + 28); g.lineTo(px + 6 + i * 6, py + 10); g.stroke(); } break;
      case 'shell': g.fillStyle = '#ffd8c8'; g.beginPath(); g.arc(cx, cy + 6, 4, Math.PI, 0); g.fill(); break;
      case 'rubble': g.fillStyle = '#8a8676'; g.fillRect(cx - 8, cy + 4, 7, 5); g.fillRect(cx + 2, cy + 8, 6, 4); break;
      case 'bones': g.strokeStyle = '#f0e8d8'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, cy + 8); g.lineTo(cx + 8, cy + 4); g.stroke(); break;
      case 'iceshard': g.fillStyle = 'rgba(160,220,255,0.8)'; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx - 4, cy + 8); g.lineTo(cx + 4, cy + 8); g.fill(); break;
      case 'gem': g.fillStyle = '#c08aff'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 4, cy + 6); g.lineTo(cx, cy + 10); g.lineTo(cx + 4, cy + 6); g.fill(); break;
      case 'ember': g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(cx + (n * 10 - 5), cy + 6, 2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,120,40,0.25)'; g.beginPath(); g.arc(cx, cy + 6, 6, 0, 7); g.fill(); break;
      case 'feather': g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy + 6, 2, 6, 0.6, 0, 7); g.fill(); break;
      case 'eye': g.fillStyle = '#ff3a6a'; g.beginPath(); g.arc(cx, cy + 6, 2, 0, 7); g.fill(); break;
    }
  }

  // ------------------------------------------------------------ minimap image
  ART.minimap = function (map) {
    const c = document.createElement('canvas'); c.width = map.w; c.height = map.h;
    const g = c.getContext('2d'); const img = g.createImageData(map.w, map.h);
    const B = D.BIOMES[map.def.biome] || D.BIOMES.meadow;
    const col = (hex) => { const d = document.createElement('canvas').getContext('2d'); d.fillStyle = hex; d.fillRect(0, 0, 1, 1); return d.getImageData(0, 0, 1, 1).data; };
    const pal = {}; const get = (k, hex) => pal[k] || (pal[k] = col(hex));
    for (let i = 0; i < map.w * map.h; i++) {
      const t = map.tiles[i]; let c;
      if (t === T.WATER) c = get('w', B.water); else if (t === T.LAVA) c = get('l', map.def.biome === 'abyss' ? '#160a24' : '#d04a1a');
      else if (t === T.TREE) c = get('t', shade(B.ground[0], -0.35)); else if (t === T.WALL) c = get('wa', '#333'); else if (t === T.HOUSE) c = get('h', '#b8483a');
      else if (t === T.PATH || t === T.BRIDGE) c = get('p', B.path); else if (t === T.FLOOR) c = get('f', map.def.kind === 'dungeon' ? '#776e8a' : '#c9c2b2'); else if (t === T.STAIRS) c = get('s', '#d0a0ff');
      else c = get('g', B.ground[0]);
      img.data.set(c, i * 4);
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  // ------------------------------------------------------------ characters
  const SKIN = ['#f3d2b5', '#e8be98', '#c99a72', '#f6dcc6'];
  const HAIR = ['#2a1f1a', '#6a3a1a', '#d8b060', '#c83a2a', '#3a3a6a', '#e0e0e8', '#6a2a8a', '#2a6a5a'];
  ART.drawPlayer = function (g, e, x, y, t, scale = 1) {
    const cls = D.CLASSES[e.c] || D.CLASSES.blade_knight;
    const hsh = RNG.hashStr(e.n || 'x');
    const skin = SKIN[hsh % 4], hair = HAIR[(hsh >> 3) % HAIR.length];
    const moving = e.moving;
    const bob = moving ? Math.sin(t * 14) * 1.5 : Math.sin(t * 3) * 0.6;
    const face = Math.cos(e.dir || 0) >= 0 ? 1 : -1;
    g.save(); g.translate(x, y); g.scale(scale * face, scale);
    // refine aura
    const ref = e.w ? e.w[1] : 0;
    if (ref >= 10) {
      const ac = ref >= 20 ? '255,200,60' : ref >= 15 ? '190,110,255' : '90,170,255';
      const gr = g.createRadialGradient(0, -14, 2, 0, -14, 26);
      gr.addColorStop(0, `rgba(${ac},${0.35 + Math.sin(t * 4) * 0.1})`); gr.addColorStop(1, `rgba(${ac},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, -14, 26, 0, 7); g.fill();
    }
    // legs
    const step = moving ? Math.sin(t * 14) * 4 : 0;
    g.fillStyle = shade(cls.color2, -0.3);
    g.fillRect(-5 + step * 0.3, -4, 4, 9); g.fillRect(1 - step * 0.3, -4, 4, 9);
    g.fillStyle = '#3a2a1a'; g.fillRect(-6 + step * 0.3, 4, 5, 3); g.fillRect(1 - step * 0.3, 4, 5, 3);
    // cloak (for some classes)
    if (['shadow_assassin', 'warlock', 'ranger', 'elementalist', 'cleric'].includes(e.c)) {
      g.fillStyle = shade(cls.color2, -0.1); g.beginPath(); g.moveTo(-7, -18 + bob); g.lineTo(-9 - (moving ? 3 : 0), 4); g.lineTo(5, 4); g.lineTo(6, -18 + bob); g.fill();
    }
    // torso
    const tg = g.createLinearGradient(0, -20, 0, -2);
    tg.addColorStop(0, cls.color); tg.addColorStop(1, cls.color2);
    g.fillStyle = tg; roundRect(g, -8, -20 + bob, 16, 18, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-6, -18 + bob, 3, 12);
    if (e.ar >= 3) { g.fillStyle = D.RARITY[e.ar].color; g.fillRect(-8, -6 + bob, 16, 2); }
    // head
    g.fillStyle = skin; g.beginPath(); g.arc(0, -27 + bob, 8.5, 0, 7); g.fill();
    g.fillStyle = '#222'; g.fillRect(3, -28 + bob, 2, 3);
    // hair / helmet by class
    g.fillStyle = hair;
    if (e.c === 'guardian' || e.c === 'blade_knight') { g.fillStyle = e.c === 'guardian' ? '#9ab0c8' : '#c8a060'; g.beginPath(); g.arc(0, -29 + bob, 9, Math.PI, 0); g.fill(); g.fillRect(-9, -30 + bob, 4, 7); if (e.c === 'blade_knight') { g.fillStyle = '#d83a3a'; g.fillRect(-2, -42 + bob, 4, 6); } }
    else if (e.c === 'shadow_assassin') { g.fillStyle = '#2a1a3a'; g.beginPath(); g.arc(0, -28 + bob, 9.5, Math.PI * 0.9, Math.PI * 2.1); g.fill(); g.fillRect(-2, -26 + bob, 11, 5); }
    else if (e.c === 'elementalist' || e.c === 'warlock') { g.fillStyle = e.c === 'warlock' ? '#3a1250' : '#1d5662'; g.beginPath(); g.moveTo(-11, -30 + bob); g.lineTo(11, -30 + bob); g.lineTo(e.c === 'warlock' ? -2 : 3, -50 + bob); g.fill(); g.fillStyle = cls.color; g.fillRect(-10, -32 + bob, 20, 3); }
    else if (e.c === 'cleric') { g.fillStyle = '#f8f0d0'; g.beginPath(); g.arc(0, -29 + bob, 9.5, Math.PI, 0); g.fill(); g.fillStyle = '#f2e27a'; g.fillRect(-1, -40 + bob, 2, 6); g.fillRect(-3, -38 + bob, 6, 2); }
    else if (e.c === 'monk') { g.fillStyle = '#7a3c10'; g.fillRect(-9, -30 + bob, 18, 3); g.fillStyle = hair; g.fillRect(-2, -38 + bob, 4, 4); }
    else if (e.c === 'ranger') { g.fillStyle = '#22572b'; g.beginPath(); g.arc(0, -29 + bob, 9.5, Math.PI, 0); g.fill(); g.fillStyle = '#e8d070'; g.beginPath(); g.moveTo(-6, -36 + bob); g.lineTo(-14, -44 + bob); g.lineTo(-4, -38 + bob); g.fill(); }
    else if (e.c === 'gunslinger') { g.fillStyle = '#4a3a2a'; g.fillRect(-12, -33 + bob, 24, 3); g.fillRect(-7, -41 + bob, 14, 9); }
    else { g.beginPath(); g.arc(0, -30 + bob, 9, Math.PI, 0); g.fill(); }
    // weapon
    drawWeapon(g, cls.weapon, 9, -12 + bob, e.attackAnim || 0, e.w ? e.w[0] : 0, t);
    g.restore();
  };
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  ART.roundRect = roundRect;
  function drawWeapon(g, w, x, y, anim, rarity, t) {
    g.save(); g.translate(x, y); g.rotate(-0.5 + anim * 2.2);
    const glow = rarity >= 3 ? D.RARITY[rarity].color : null;
    if (glow) { g.shadowColor = glow; g.shadowBlur = 8; }
    const metal = '#dde4ec';
    switch (w) {
      case 'sword': g.fillStyle = metal; g.fillRect(-1.5, -24, 4, 22); g.fillStyle = '#b08a3a'; g.fillRect(-4, -3, 10, 3); g.fillStyle = '#5a3a1a'; g.fillRect(-0.5, 0, 2.5, 6); break;
      case 'spear': g.fillStyle = '#7a5a3a'; g.fillRect(-1, -30, 2.5, 40); g.fillStyle = metal; g.beginPath(); g.moveTo(0, -38); g.lineTo(-3.5, -29); g.lineTo(4, -29); g.fill(); g.restore(); g.save(); g.translate(-14, -2); g.fillStyle = '#5a7aa8'; roundRect(g, -7, -9, 12, 16, 3); g.fill(); g.fillStyle = '#e0c060'; g.fillRect(-2, -5, 2, 8); break;
      case 'axe': g.fillStyle = '#6a4a2a'; g.fillRect(-1.5, -26, 3, 32); g.fillStyle = metal; g.beginPath(); g.moveTo(1, -26); g.quadraticCurveTo(14, -20, 1, -12); g.fill(); g.beginPath(); g.moveTo(-1, -26); g.quadraticCurveTo(-11, -20, -1, -14); g.fill(); break;
      case 'dagger': g.fillStyle = metal; g.beginPath(); g.moveTo(0, -16); g.lineTo(-2.5, -2); g.lineTo(2.5, -2); g.fill(); g.fillStyle = '#4a2a5a'; g.fillRect(-1, -2, 2.5, 5); break;
      case 'bow': g.strokeStyle = '#8a5a2a'; g.lineWidth = 2.5; g.beginPath(); g.arc(-6, -10, 15, -1.2, 1.2); g.stroke(); g.strokeStyle = '#eee'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6 + 15 * Math.cos(-1.2), -10 + 15 * Math.sin(-1.2)); g.lineTo(-6 + 15 * Math.cos(1.2), -10 + 15 * Math.sin(1.2)); g.stroke(); break;
      case 'staff': g.fillStyle = '#6a4a2a'; g.fillRect(-1.5, -32, 3, 40); g.fillStyle = glow || '#4ad0e0'; g.beginPath(); g.arc(0, -34, 4.5 + Math.sin(t * 5) * 0.8, 0, 7); g.fill(); break;
      case 'mace': g.fillStyle = '#8a7a5a'; g.fillRect(-1.5, -20, 3, 26); g.fillStyle = '#e8d070'; g.beginPath(); g.arc(0, -22, 5.5, 0, 7); g.fill(); break;
      case 'knuckle': g.fillStyle = '#c8a060'; g.beginPath(); g.arc(0, -2, 5, 0, 7); g.fill(); g.fillStyle = metal; g.fillRect(-4, -6, 8, 2.5); break;
      case 'scythe': g.fillStyle = '#3a2a3a'; g.fillRect(-1.5, -34, 3, 42); g.fillStyle = '#c8c0e0'; g.beginPath(); g.moveTo(0, -34); g.quadraticCurveTo(16, -36, 18, -24); g.quadraticCurveTo(10, -30, 0, -28); g.fill(); break;
      case 'gun': g.fillStyle = '#3a3a42'; g.fillRect(-2, -6, 14, 4.5); g.fillStyle = '#6a4a2a'; g.fillRect(-3, -3, 4, 7); g.fillStyle = '#aab'; g.fillRect(8, -7, 4, 2); break;
    }
    g.restore();
  }

  // ------------------------------------------------------------ monsters
  ART.drawMonster = function (g, e, x, y, t) {
    const s = (e.sz || 1) * (e.rk === 5 ? 0.85 : 1);
    const col = e.col || '#8a8';
    const bob = Math.sin(t * 4 + e.id) * 1.5;
    const face = Math.cos(e.dir || 0) >= 0 ? 1 : -1;
    g.save(); g.translate(x, y); g.scale(s * face, s);
    if (e.rk >= 2 && e.rk !== 5) {
      const gr = g.createRadialGradient(0, -10, 2, 0, -10, 30);
      gr.addColorStop(0, e.rk === 4 ? 'rgba(255,60,60,0.35)' : 'rgba(255,170,40,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, -10, 30, 0, 7); g.fill();
    }
    if (e.rk === 1) { g.shadowColor = '#ffd34a'; g.shadowBlur = 10; }
    const dark = shade(col, -0.35), light = shade(col, 0.3);
    const eye = (ex, ey, r = 2) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, r + 1, 0, 7); g.fill(); g.fillStyle = e.rk >= 2 ? '#f22' : '#111'; g.beginPath(); g.arc(ex + 0.6, ey, r * 0.6, 0, 7); g.fill(); };
    switch (e.sh) {
      case 'slime': {
        const sq = 1 + Math.sin(t * 5 + e.id) * 0.08;
        g.fillStyle = col; g.beginPath(); g.ellipse(0, -8, 12 / sq, 11 * sq, 0, Math.PI, 0); g.lineTo(12 / sq, -1); g.lineTo(-12 / sq, -1); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-4, -13, 3, 4, -0.4, 0, 7); g.fill(); eye(-3, -8); eye(4, -8); break;
      }
      case 'beast': case 'shadow': {
        g.fillStyle = e.sh === 'shadow' ? '#2a1a3a' : col;
        g.beginPath(); g.ellipse(0, -9 + bob * 0.4, 13, 7, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(11, -15 + bob * 0.4, 6.5, 5.5, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(9, -19); g.lineTo(11, -26); g.lineTo(14, -19); g.fill();
        g.fillStyle = dark; for (const lx of [-8, -3, 4, 9]) g.fillRect(lx, -4, 3, 6 + Math.sin(t * 10 + lx) * 1.5);
        g.beginPath(); g.moveTo(-12, -11); g.lineTo(-20, -16 + bob); g.lineTo(-12, -7); g.fill();
        eye(13, -16, 1.6); break;
      }
      case 'plant': case 'mushroom': {
        if (e.sh === 'mushroom') { g.fillStyle = '#efe6d0'; g.fillRect(-5, -14, 10, 14); g.fillStyle = col; g.beginPath(); g.ellipse(0, -15 + bob * 0.3, 13, 9, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, -19, 2, 0, 7); g.arc(4, -21, 2.5, 0, 7); g.fill(); eye(-2, -8, 1.5); eye(3, -8, 1.5); }
        else { g.fillStyle = '#4a7a2a'; g.fillRect(-2, -14, 4, 14); g.fillStyle = col; for (let a = 0; a < 5; a++) { g.save(); g.translate(0, -18 + bob * 0.3); g.rotate(a * 1.25 + t * 0.5); g.beginPath(); g.ellipse(7, 0, 7, 3.5, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#ffe05a'; g.beginPath(); g.arc(0, -18 + bob * 0.3, 4, 0, 7); g.fill(); eye(-1.5, -18, 1.2); eye(2, -18, 1.2); }
        break;
      }
      case 'insect': case 'scorpion': case 'crab': {
        g.fillStyle = col;
        g.beginPath(); g.ellipse(0, -8, 11, 7, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(10, -9, 5, 0, 7); g.fill();
        g.strokeStyle = dark; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const k = Math.sin(t * 12 + i) * 2; g.beginPath(); g.moveTo(-5 + i * 5, -4); g.lineTo(-8 + i * 5, 2 + k); g.stroke(); }
        if (e.sh === 'scorpion') { g.beginPath(); g.moveTo(-10, -8); g.quadraticCurveTo(-22, -20, -10, -26 + bob); g.stroke(); g.fillStyle = '#f33'; g.beginPath(); g.arc(-10, -26 + bob, 2.5, 0, 7); g.fill(); }
        if (e.sh === 'crab') { g.fillStyle = light; g.beginPath(); g.arc(-12, -14, 5, 0, 7); g.arc(14, -14, 5, 0, 7); g.fill(); }
        if (e.sh === 'insect') { g.fillStyle = 'rgba(220,240,255,0.55)'; g.beginPath(); g.ellipse(-2, -16, 7, 4, -0.5 + Math.sin(t * 30) * 0.3, 0, 7); g.fill(); }
        eye(11, -10, 1.5); break;
      }
      case 'bird': {
        const fl = Math.sin(t * 12 + e.id) * 0.6;
        g.fillStyle = col; g.beginPath(); g.ellipse(0, -16 + bob, 9, 7, 0, 0, 7); g.fill();
        g.fillStyle = dark; g.save(); g.translate(-2, -17 + bob); g.rotate(-0.4 - fl); g.beginPath(); g.ellipse(-8, 0, 11, 4, 0, 0, 7); g.fill(); g.restore();
        g.fillStyle = '#f0a020'; g.beginPath(); g.moveTo(8, -17 + bob); g.lineTo(14, -15 + bob); g.lineTo(8, -13 + bob); g.fill();
        eye(5, -18 + bob, 1.6); break;
      }
      case 'spirit': case 'imp': case 'eye': {
        const gl = g.createRadialGradient(0, -16, 2, 0, -16, 16);
        gl.addColorStop(0, light); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(0, -16 + bob, 16, 0, 7); g.fill();
        if (e.sh === 'eye') { g.fillStyle = col; g.beginPath(); g.arc(0, -16 + bob, 11, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(2, -16 + bob, 6, 0, 7); g.fill(); g.fillStyle = '#c00'; g.beginPath(); g.arc(3, -16 + bob, 3, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-6 + i * 3, -6 + bob); g.quadraticCurveTo(-8 + i * 3 + Math.sin(t * 4 + i) * 4, 2, -6 + i * 3, 6); g.stroke(); } }
        else if (e.sh === 'imp') { g.fillStyle = col; g.beginPath(); g.arc(0, -15 + bob, 8, 0, 7); g.fill(); g.beginPath(); g.moveTo(-6, -20 + bob); g.lineTo(-9, -29 + bob); g.lineTo(-2, -22 + bob); g.moveTo(6, -20 + bob); g.lineTo(9, -29 + bob); g.lineTo(2, -22 + bob); g.fill(); g.fillStyle = dark; g.beginPath(); g.ellipse(-10, -16 + bob, 6, 3, 0.5 + Math.sin(t * 20) * 0.3, 0, 7); g.fill(); eye(-2, -16 + bob, 1.5); eye(3, -16 + bob, 1.5); }
        else { g.fillStyle = col; g.beginPath(); g.arc(0, -18 + bob, 8, Math.PI, 0); g.lineTo(8, -6 + bob); for (let i = 0; i < 4; i++) g.lineTo(6 - i * 4, -8 + bob + (i % 2) * 4); g.lineTo(-8, -6 + bob); g.fill(); eye(-3, -18 + bob, 1.6); eye(3, -18 + bob, 1.6); }
        break;
      }
      case 'undead': {
        g.fillStyle = '#e8e2d0'; g.fillRect(-2, -20, 4, 14); g.fillRect(-7, -16, 14, 2.5); g.fillRect(-7, -12, 14, 2.5);
        g.fillRect(-4, -6, 3, 9); g.fillRect(1, -6, 3, 9);
        g.beginPath(); g.arc(0, -25 + bob * 0.3, 6.5, 0, 7); g.fill();
        g.fillStyle = '#222'; g.fillRect(-3.5, -27 + bob * 0.3, 2.5, 2.5); g.fillRect(1.5, -27 + bob * 0.3, 2.5, 2.5);
        g.fillStyle = col; g.fillRect(-8, -18, 16, 4);
        g.fillStyle = '#9aa'; g.fillRect(7, -24, 2.5, 18); break;
      }
      case 'golem': {
        g.fillStyle = col; roundRect(g, -12, -26 + bob * 0.3, 24, 22, 4); g.fill();
        g.fillStyle = dark; roundRect(g, -17, -22, 6, 16, 3); g.fill(); roundRect(g, 11, -22, 6, 16, 3); g.fill();
        g.fillRect(-9, -4, 7, 6); g.fillRect(2, -4, 7, 6);
        g.fillStyle = light; roundRect(g, -7, -34 + bob * 0.3, 14, 10, 3); g.fill();
        g.fillStyle = e.rk >= 2 ? '#f33' : '#7df'; g.fillRect(-4, -31 + bob * 0.3, 3, 2); g.fillRect(2, -31 + bob * 0.3, 3, 2); break;
      }
      case 'knight': {
        g.fillStyle = shade(col, -0.2); g.fillRect(-5, -6, 4, 9); g.fillRect(1, -6, 4, 9);
        g.fillStyle = col; roundRect(g, -8, -22, 16, 17, 3); g.fill();
        g.fillStyle = '#8a8a9a'; g.beginPath(); g.arc(0, -27, 7.5, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(-4, -28, 9, 2);
        g.fillStyle = '#c0c0d0'; g.save(); g.translate(9, -14); g.rotate(-0.6); g.fillRect(-1.5, -22, 3, 24); g.restore();
        g.fillStyle = dark; roundRect(g, -16, -20, 9, 14, 2); g.fill(); break;
      }
      case 'dragon': {
        g.fillStyle = col; g.beginPath(); g.ellipse(0, -12 + bob * 0.4, 15, 9, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(10, -16); g.quadraticCurveTo(20, -30, 26, -26 + bob); g.lineTo(20, -18); g.fill();
        g.beginPath(); g.ellipse(24, -26 + bob, 7, 5, 0.2, 0, 7); g.fill();
        g.fillStyle = dark; g.save(); g.translate(-2, -18); g.rotate(-0.6 + Math.sin(t * 6) * 0.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, -18); g.lineTo(-6, -2); g.lineTo(-22, -6); g.closePath(); g.fill(); g.restore();
        g.beginPath(); g.moveTo(-14, -10); g.quadraticCurveTo(-26, -6, -30, -14 + bob); g.lineTo(-14, -6); g.fill();
        g.fillRect(-8, -5, 4, 6); g.fillRect(5, -5, 4, 6); eye(26, -28 + bob, 1.6); break;
      }
      case 'drone': g.fillStyle = '#9ab'; roundRect(g, -7, -22 + bob, 14, 8, 3); g.fill(); g.fillStyle = '#7df'; g.fillRect(-2, -19 + bob, 4, 2); g.strokeStyle = '#ccd'; g.beginPath(); g.moveTo(-12, -24 + bob); g.lineTo(12, -24 + bob); g.stroke(); break;
      default: g.fillStyle = col; g.beginPath(); g.arc(0, -10, 10, 0, 7); g.fill(); eye(0, -10);
    }
    if (e.rk >= 2 && e.rk !== 5) { g.shadowBlur = 0; g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(-7, -40); g.lineTo(-5, -46); g.lineTo(-2, -42); g.lineTo(0, -48); g.lineTo(2, -42); g.lineTo(5, -46); g.lineTo(7, -40); g.fill(); }
    g.restore();
  };

  ART.drawNpc = function (g, e, x, y, t) {
    const bob = Math.sin(t * 2 + e.id) * 1;
    if (e.role === 'stairs' || e.role === 'portal') {
      const open = e.role === 'portal' || /→|Exit/.test(e.n);
      for (let i = 0; i < 3; i++) { g.strokeStyle = open ? `rgba(180,140,255,${0.8 - i * 0.2})` : 'rgba(120,120,140,0.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y - 4, 16 - i * 4 + Math.sin(t * 3 + i) * 2, 7 - i * 1.5, 0, t * (i + 1), t * (i + 1) + 5); g.stroke(); }
      if (open) { const gr = g.createRadialGradient(x, y - 18, 1, x, y - 18, 24); gr.addColorStop(0, 'rgba(200,170,255,0.6)'); gr.addColorStop(1, 'rgba(200,170,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y - 18, 24, 0, 7); g.fill(); }
      return;
    }
    g.save(); g.translate(x, y);
    g.fillStyle = shade(e.col, -0.2); g.beginPath(); g.moveTo(-10, 4); g.lineTo(-7, -20 + bob); g.lineTo(7, -20 + bob); g.lineTo(10, 4); g.fill();
    g.fillStyle = e.col; g.fillRect(-7, -20 + bob, 14, 8);
    g.fillStyle = '#f3d2b5'; g.beginPath(); g.arc(0, -26 + bob, 7, 0, 7); g.fill();
    g.fillStyle = shade(e.col, -0.4); g.beginPath(); g.arc(0, -28 + bob, 7.5, Math.PI, 0); g.fill();
    g.restore();
  };

  ART.drawCore = function (g, e, x, y, t) {
    const pulse = Math.sin(t * 3) * 3;
    const gr = g.createRadialGradient(x, y - 30, 4, x, y - 30, 50 + pulse);
    gr.addColorStop(0, 'rgba(120,220,255,0.6)'); gr.addColorStop(1, 'rgba(120,220,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 30, 50 + pulse, 0, 7); g.fill();
    g.fillStyle = '#5ad0ff'; g.beginPath(); g.moveTo(x, y - 70 - pulse); g.lineTo(x - 16, y - 30); g.lineTo(x, y + 4); g.lineTo(x + 16, y - 30); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(x, y - 66 - pulse); g.lineTo(x - 6, y - 30); g.lineTo(x, y - 6); g.fill();
  };

  // ------------------------------------------------------------ icons (cached data URLs)
  const iconCache = new Map();
  function makeIcon(key, size, fn) {
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = size;
    fn(c.getContext('2d'), size);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
  }
  ART.clearIcons = () => iconCache.clear();
  ART.classIcon = (cls, size = 64) => makeIcon('cls:' + cls + size, size, (g, s) => {
    const c = D.CLASSES[cls];
    const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    gr.addColorStop(0, shade(c.color, 0.2)); gr.addColorStop(1, c.color2);
    g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.stroke();
    g.save(); g.translate(s / 2 - 2, s / 2 + s * 0.28); g.scale(s / 46, s / 46);
    drawWeapon(g, c.weapon, 0, 0, 0.25, 0, 0); g.restore();
  });
  ART.portrait = (cls, name, size = 96) => makeIcon('por:' + cls + name + size, size, (g, s) => {
    const c = D.CLASSES[cls];
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, shade(c.color, -0.2)); gr.addColorStop(1, shade(c.color2, -0.5));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    ART.drawPlayer(g, { c: cls, n: name, dir: 0, w: [0, 0] }, s / 2, s * 0.9, 0, s / 58);
  });
  const ELC = (el) => (D.ELEMENTS[el] || D.ELEMENTS.neutral).color;
  ART.skillIcon = (sk) => makeIcon('sk:' + sk.id, 48, (g, s) => {
    const col = ELC(sk.element || 'holy');
    const cls = D.CLASSES[sk.cls];
    const bg = g.createRadialGradient(s * 0.35, s * 0.3, 2, s / 2, s / 2, s * 0.75);
    bg.addColorStop(0, shade(col, 0.15)); bg.addColorStop(0.6, shade(cls.color2, -0.1)); bg.addColorStop(1, '#0c0c14');
    g.fillStyle = bg; roundRect(g, 1, 1, s - 2, s - 2, 8); g.fill();
    g.strokeStyle = sk.kind === 'ult' ? '#ffcc33' : sk.kind === 'buff' ? '#6af08a' : 'rgba(255,255,255,0.35)'; g.lineWidth = sk.kind === 'ult' ? 3 : 1.5; roundRect(g, 1.5, 1.5, s - 3, s - 3, 8); g.stroke();
    g.save(); g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.shadowColor = col; g.shadowBlur = 6;
    const h = RNG.hashStr(sk.id);
    const rot = ((h % 8) - 4) * 0.08;
    g.rotate(rot);
    if (sk.kind === 'buff') { g.beginPath(); g.moveTo(0, -14); g.lineTo(10, -2); g.lineTo(4, -2); g.lineTo(4, 12); g.lineTo(-4, 12); g.lineTo(-4, -2); g.lineTo(-10, -2); g.closePath(); g.fill(); }
    else if (sk.kind === 'ult') { for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, 4); g.lineTo(0, 15); g.stroke(); } g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); }
    else if (sk.summon) { g.beginPath(); g.arc(0, -3, 9, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(-5, -5, 3.5, 4); g.fillRect(2, -5, 3.5, 4); g.fillStyle = '#fff'; g.fillRect(-5, 6, 10, 6); }
    else if (sk.trap) { g.beginPath(); g.arc(0, 0, 11, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-11, 0); g.lineTo(11, 0); g.moveTo(0, -11); g.lineTo(0, 11); g.stroke(); }
    else if (sk.move) { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-14 + i * 3, -8 + i * 8); g.lineTo(6 + i * 3, -8 + i * 8); g.stroke(); } g.beginPath(); g.moveTo(8, -12); g.lineTo(15, 0); g.lineTo(8, 12); g.stroke(); }
    else if (sk.shape === 'circle') { g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(9, 0); g.lineTo(15, 0); g.stroke(); } }
    else if (sk.shape === 'line') { g.beginPath(); g.moveTo(-14, 10); g.lineTo(12, -12); g.stroke(); g.beginPath(); g.moveTo(12, -12); g.lineTo(4, -11); g.moveTo(12, -12); g.lineTo(11, -4); g.stroke(); }
    else if (sk.shape === 'cone') { g.beginPath(); g.moveTo(-12, 0); g.arc(-12, 0, 26, -0.55, 0.55); g.closePath(); g.stroke(); }
    else if (sk.shape === 'chain') { g.beginPath(); g.moveTo(-14, -10); g.lineTo(-4, 0); g.lineTo(-8, 2); g.lineTo(6, 12); g.lineTo(2, 2); g.lineTo(6, 0); g.lineTo(14, -10); g.stroke(); }
    else if ((sk.hits || 1) > 2) { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-12, -10 + i * 9); g.lineTo(12, -14 + i * 9); g.stroke(); } }
    else if (sk.role === 'F') { g.beginPath(); g.moveTo(0, -15); g.lineTo(5, -3); g.lineTo(15, 0); g.lineTo(5, 3); g.lineTo(0, 15); g.lineTo(-5, 3); g.lineTo(-15, 0); g.lineTo(-5, -3); g.closePath(); g.fill(); }
    else { g.beginPath(); g.arc(-4, 4, 14, -1.2, 0.3); g.stroke(); g.beginPath(); g.moveTo(-10, 12); g.lineTo(12, -10); g.stroke(); }
    g.restore();
    if (sk.role && 'SLF'.includes(sk.role)) { g.fillStyle = { S: '#3ab0ff', L: '#ffb030', F: '#ff3a5a' }[sk.role]; g.beginPath(); g.arc(s - 9, 9, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sk.role, s - 9, 9.5); }
  });
  const SLOT_ICON = { offhand: 'shield', head: 'helm', armor: 'armor', cloak: 'cloak', boots: 'boots', necklace: 'neck', earring: 'ear', ring: 'ring', ring1: 'ring', ring2: 'ring' };
  ART.itemIcon = (it) => {
    const def = it.id ? D.ITEMS[it.id] : null;
    const key = 'it:' + (it.type === 'equip' ? `${it.slot}:${it.wtype || ''}:${it.rarity}` : it.id);
    return makeIcon(key, 44, (g, s) => {
      const rar = it.type === 'equip' ? D.RARITY[it.rarity] : null;
      const bg = g.createLinearGradient(0, 0, 0, s);
      bg.addColorStop(0, rar ? shade(rar.color, -0.55) : '#2a2a3a'); bg.addColorStop(1, '#101018');
      g.fillStyle = bg; roundRect(g, 1, 1, s - 2, s - 2, 6); g.fill();
      g.strokeStyle = rar ? rar.color : 'rgba(255,255,255,0.2)'; g.lineWidth = rar && it.rarity >= 3 ? 2 : 1; roundRect(g, 1.5, 1.5, s - 3, s - 3, 6); g.stroke();
      g.save(); g.translate(s / 2, s / 2);
      if (it.type === 'equip') {
        if (it.slot === 'weapon') { g.translate(-2, 12); g.scale(1.05, 1.05); drawWeapon(g, it.wtype, 0, 0, 0.25, it.rarity, 0); }
        else drawGear(g, SLOT_ICON[it.slot] || 'armor', rar.color);
      } else if (def) {
        const c = def.icon;
        if (def.type === 'potion') { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-3, -15, 6, 5); g.fillStyle = c; g.beginPath(); g.arc(0, 3, 10, 0, 7); g.fill(); g.fillRect(-4, -11, 8, 6); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-4, 0, 3, 0, 7); g.fill(); }
        else if (def.type === 'rune') { g.fillStyle = '#3a3a48'; g.beginPath(); g.moveTo(0, -15); g.lineTo(13, -4); g.lineTo(8, 14); g.lineTo(-8, 14); g.lineTo(-13, -4); g.closePath(); g.fill(); g.strokeStyle = c; g.lineWidth = 2.5; g.shadowColor = c; g.shadowBlur = 8; g.beginPath(); g.moveTo(-5, -6); g.lineTo(0, 6); g.lineTo(5, -6); g.moveTo(0, -9); g.lineTo(0, 9); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(D.RUNE_TIERS[def.tier - 1], 0, 22 - 8); }
        else if (def.type === 'jewel') { g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8; g.beginPath(); g.moveTo(0, -13); g.lineTo(12, -3); g.lineTo(0, 14); g.lineTo(-12, -3); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(0, -13); g.lineTo(-6, -3); g.lineTo(0, 2); g.fill(); }
        else if (/crystal/.test(it.id)) { g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10; g.beginPath(); g.moveTo(0, -16); g.lineTo(8, 0); g.lineTo(0, 15); g.lineTo(-8, 0); g.closePath(); g.fill(); }
        else if (/scroll/.test(it.id)) { g.fillStyle = '#f0e2b8'; g.fillRect(-11, -9, 22, 18); g.fillStyle = c; g.fillRect(-13, -11, 4, 22); g.fillRect(9, -11, 4, 22); g.fillStyle = '#8a6a3a'; g.fillRect(-6, -4, 12, 2); g.fillRect(-6, 1, 9, 2); }
        else { g.fillStyle = c; g.beginPath(); g.moveTo(-12, 8); g.lineTo(-6, -10); g.lineTo(6, -12); g.lineTo(13, 4); g.lineTo(4, 12); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(-6, -10); g.lineTo(0, -4); g.lineTo(6, -12); g.fill(); }
      }
      g.restore();
    });
  };
  function drawGear(g, k, c) {
    g.fillStyle = c; g.strokeStyle = '#111'; g.lineWidth = 1;
    switch (k) {
      case 'shield': g.beginPath(); g.moveTo(0, -15); g.lineTo(12, -9); g.lineTo(9, 7); g.lineTo(0, 15); g.lineTo(-9, 7); g.lineTo(-12, -9); g.closePath(); g.fill(); g.stroke(); break;
      case 'helm': g.beginPath(); g.arc(0, 2, 12, Math.PI, 0); g.lineTo(12, 8); g.lineTo(-12, 8); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#111'; g.fillRect(-7, 0, 14, 3); break;
      case 'armor': g.beginPath(); g.moveTo(-13, -10); g.lineTo(-6, -14); g.lineTo(0, -10); g.lineTo(6, -14); g.lineTo(13, -10); g.lineTo(10, 14); g.lineTo(-10, 14); g.closePath(); g.fill(); g.stroke(); break;
      case 'cloak': g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(14, 14); g.lineTo(-14, 14); g.closePath(); g.fill(); g.stroke(); break;
      case 'boots': g.fillRect(-10, -12, 8, 20); g.fillRect(-10, 4, 14, 8); g.strokeRect(-10, -12, 8, 20); break;
      case 'neck': g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, -4, 11, 0.3, Math.PI - 0.3); g.stroke(); g.beginPath(); g.moveTo(0, 6); g.lineTo(5, 12); g.lineTo(0, 17); g.lineTo(-5, 12); g.closePath(); g.fill(); break;
      case 'ear': g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.arc(0, -6, 6, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 8, 5, 0, 7); g.fill(); break;
      case 'ring': g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.arc(0, 3, 10, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -8, 4, 0, 7); g.fill(); break;
    }
  }
  ART.tagChip = (tag) => { const d = D.TAGS[tag]; return `<span class="tag" style="--c:${d.color}">${d.icon} ${d.n}</span>`; };
})();

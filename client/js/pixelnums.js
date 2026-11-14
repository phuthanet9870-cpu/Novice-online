// Pixel damage numbers, crit slams and loot beams — own implementation in the style of pixel-effects libraries:
//  • damage: a red pixel-font number bursts out of a hit star, flashes white for a frame, arcs up, lands with a squash
//    and one small hop, then lifts and fades (≈1.05 s)
//  • crit: a big "CRIT" + number slams in over a boiling jagged starburst with speed lines and a hard shake, white-hot
//    cooling to fire tones, a shine sweeps across, then it pops into sparks (≈1.5 s)
//  • loot beam: a pixel light pillar rising from a dropped item, coloured by its grade, with a base ring, rising motes
//    and broken streaks at the top
(function () {
  const PIX = window.PIX = { list: [] };
  // ---- 5×7 pixel font
  const F = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'], ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    ' ': ['000', '000', '000', '000', '000', '000', '000']
  };
  // palettes (dark → light): outline, deep, under, fill, mid, light, edge, white
  const PAL = {
    dmg: ['#1a0508', '#4a0a10', '#8c1420', '#d42a2e', '#ff5a4a', '#ff9a86', '#ffd8cc', '#ffffff'],
    taken: ['#14051a', '#3a0a3a', '#7a1a6a', '#c03aa0', '#e86ad0', '#f8a8e8', '#ffe0f8', '#ffffff'],
    heal: ['#04140a', '#0a3a1a', '#147a34', '#2ec45a', '#5ef08a', '#a8ffc0', '#e0ffe8', '#ffffff'],
    dot: ['#120a1a', '#2a1440', '#4a2a7a', '#7a4ac4', '#a47aee', '#c8a8ff', '#ece0ff', '#ffffff'],
    crit: ['#2a0710', '#5e0f16', '#a3191c', '#e0401c', '#ff7b22', '#ffb93b', '#ffe68a', '#ffffff']
  };
  const glyphCache = new Map();
  // one string → a small canvas: 1-px dark outline, drop under-shade, banded fill (light top, mid body, dark base)
  function word(str, pal, white) {
    const key = str + '|' + pal.join('') + (white ? 'w' : ''); let c = glyphCache.get(key); if (c) return c;
    const chars = [...str].map((ch) => F[ch] || F[' ']);
    const W = chars.reduce((a, g) => a + g[0].length + 1, 0) + 3, H = 7 + 4;
    c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d');
    const on = []; let x0 = 1;
    for (const g of chars) { for (let y = 0; y < 7; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] === '1') on.push([x0 + x, 1 + y, y]); x0 += g[0].length + 1; }
    const set = new Set(on.map(([x, y]) => x + ',' + y));
    // outline (8-neighbour) + under-shade one pixel down
    q.fillStyle = pal[0];
    for (const [x, y] of on) for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (!set.has((x + dx) + ',' + (y + dy))) q.fillRect(x + dx, y + dy, 1, 1);
    for (const [x, y] of on) if (!set.has(x + ',' + (y + 1))) { q.fillStyle = pal[2]; q.fillRect(x, y + 1, 1, 1); }
    for (const [x, y, row] of on) { q.fillStyle = white ? pal[7] : row <= 1 ? pal[5] : row <= 4 ? pal[3] : pal[2]; if (!white && row === 0) q.fillStyle = pal[6]; q.fillRect(x, y, 1, 1); }
    glyphCache.set(key, c); return c;
  }
  const fmt = (n) => { n = Math.round(n); return n >= 1e7 ? Math.round(n / 1e6) + 'M' : n >= 1e5 ? Math.round(n / 1e3) + 'K' : String(n); };

  // ---- API: kind = 'dmg' | 'taken' | 'heal' | 'dot'
  PIX.dmg = function (wx, wy, n, o) {
    o = o || {};
    if (PIX.list.length > 70) PIX.list.splice(0, PIX.list.length - 70);
    const crit = !!o.crit && o.kind !== 'heal';
    PIX.list.push({ wx, wy, t0: (window.G && G.t) || 0, crit, kind: o.kind || 'dmg', txt: (o.kind === 'heal' ? '+' : '') + fmt(n), vx: (Math.random() - 0.5) * 68, seed: Math.random() * 1000 });
  };

  function star(g, x, y, r, spikes, rot, col, inner) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < spikes * 2; i++) { const a = rot + i / (spikes * 2) * Math.PI * 2, rr = i % 2 ? r * (inner || 0.42) : r; g.lineTo(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr)); }
    g.closePath(); g.fill();
  }
  // jagged boiling starburst: 13 random tips, re-rolled every few frames
  function burst(g, x, y, r, t, seed, heat) {
    const P = PAL.crit, roll = Math.floor(t * 12), rnd = (i) => { const s = Math.sin((seed + roll * 7.1 + i * 13.37)) * 43758.5453; return s - Math.floor(s); };
    const pts = []; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rnd(99) * 0.3, rr = i % 2 ? r * (0.45 + rnd(i) * 0.1) : r * (0.8 + rnd(i) * 0.35); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86]); }
    const band = (k, col) => { g.fillStyle = col; g.beginPath(); for (const [px, py] of pts) g.lineTo(Math.round(x + (px - x) * k), Math.round(y + (py - y) * k)); g.closePath(); g.fill(); };
    const h = Math.max(0, Math.min(1, heat));
    band(1.06, P[0]); band(1, P[Math.round(3 + h * 2)]); band(0.78, P[Math.round(4 + h * 2)]); band(0.52, P[Math.round(5 + h * 2)]); band(0.28, P[7]);
  }

  PIX.draw = function (g, ox, oy, scale, zoom) {
    const T = (window.G && G.t) || 0, z = Math.max(0.7, zoom || 1) * 0.5; // numbers about as tall as a name plate
    g.save(); g.imageSmoothingEnabled = false;
    for (let i = PIX.list.length - 1; i >= 0; i--) {
      const d = PIX.list[i], t = T - d.t0, dur = d.crit ? 1.5 : 1.05;
      if (t > dur) { PIX.list.splice(i, 1); continue; }
      if (t < 0) continue;
      const bx = ox + d.wx * scale, by = oy + d.wy * scale - 30 * z;
      if (!d.crit) {
        // ballistic hop: vy -175, gravity 900, one bounce at 36 %
        let x = d.vx * Math.min(t, 0.62) * z, y;
        const t1 = 2 * 175 / 900;
        if (t < t1) y = (-175 * t + 450 * t * t) * z; else { const tt = t - t1, v = 175 * 0.36; y = Math.min(0, (-v * tt + 450 * tt * tt)) * z; }
        let alpha = 1; if (t > 0.84) { const k = (t - 0.84) / 0.17; alpha = Math.max(0, 1 - k); y -= 6 * k * k * z; }
        const landK = t >= t1 && t < t1 + 0.09 ? 1 - (t - t1) / 0.09 : 0;
        const sc = (2 + 1.4 * Math.exp(-22 * t) * Math.cos(30 * t)) * z * 1.1;
        const pal = PAL[d.kind] || PAL.dmg, img = word(d.txt, pal, t < 0.035);
        // hit star + ring at the impact
        if (t < 0.035) { star(g, bx, by + 10 * z, 16 * z, 9, d.seed, pal[6]); star(g, bx, by + 10 * z, 8 * z, 9, d.seed, '#ffffff'); }
        else if (t < 0.07) star(g, bx, by + 10 * z, 9 * z, 9, d.seed + 1, pal[5]);
        if (t < 0.22) { g.globalAlpha = 1 - t / 0.22; g.strokeStyle = t < 0.08 ? '#ffffff' : pal[5]; g.lineWidth = Math.max(1, 2 * z); g.beginPath(); g.ellipse(Math.round(bx), Math.round(by + 10 * z), 4 * z + t * 120 * z, (4 * z + t * 120 * z) * 0.6, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
        g.globalAlpha = alpha;
        const w = img.width * sc * (1 + landK * 0.3), h = img.height * sc * (1 - landK * 0.25);
        g.drawImage(img, Math.round(bx + x - w / 2), Math.round(by + y - h), Math.round(w), Math.round(h));
        g.globalAlpha = 1;
      } else {
        // crit slam
        const P = PAL.crit, heat = 1 - Math.min(1, Math.max(0, (t - 0.04) / 0.12));
        const shake = t < 0.32 ? (1 - t / 0.32) * 6 * z : 0;
        const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
        const cx = bx + sx, cy = by - 14 * z + sy;
        const fold = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.12) : 1;
        if (fold > 0) burst(g, cx, cy, 38 * z * fold * (t < 0.06 ? 1.25 : 1), t, d.seed, heat);
        if (t < 0.24) { // speed lines
          const k = 1 - Math.pow(1 - t / 0.24, 3); g.strokeStyle = t < 0.1 ? '#ffb93b' : '#ffffff'; g.lineWidth = Math.max(1, 1.5 * z);
          for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + d.seed, r0 = (31 + k * 30) * z, r1 = r0 + (8 + k * 14) * z; g.beginPath(); g.moveTo(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0 * 0.86)); g.lineTo(Math.round(cx + Math.cos(a) * r1), Math.round(cy + Math.sin(a) * r1 * 0.86)); g.stroke(); }
        }
        if (t < 0.26) { g.globalAlpha = 1 - t / 0.26; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, 3 * z * (1 - t / 0.26)); g.beginPath(); g.ellipse(Math.round(cx), Math.round(cy), (10 + t * 260) * z, (10 + t * 260) * 0.7 * z, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
        if (t < 1.06) {
          const slam = t < 0.08 ? 1 + (0.08 - t) / 0.08 * 1.6 : 1 + 0.08 * Math.exp(-12 * (t - 0.08)) * Math.cos(28 * (t - 0.08));
          const sc = 2.4 * z * slam, img = word(d.txt, P, t < 0.05);
          const w = img.width * sc, h = img.height * sc;
          g.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
          if (t > 0.36 && t < 0.6) { // shine sweep
            const k = (t - 0.36) / 0.24, x0 = cx - w / 2 + k * w; g.globalAlpha = 0.7; g.fillStyle = '#ffffff'; g.fillRect(Math.round(x0), Math.round(cy - h / 2 + 2), Math.max(2, Math.round(3 * z)), Math.round(h - 4)); g.globalAlpha = 1;
          }
          if (t > 0.09) { // CRIT label stamps in
            const lk = t < 0.14 ? 1 + (0.14 - t) * 10 : 1, lab = word('CRIT', P, t < 0.12), ls = 1.5 * z * lk;
            const lsx = (Math.random() - 0.5) * shake * 0.5;
            if (t < 0.98) g.drawImage(lab, Math.round(cx - lab.width * ls / 2 + lsx), Math.round(cy - h / 2 - lab.height * ls - 2 * z), Math.round(lab.width * ls), Math.round(lab.height * ls));
          }
        } else { // pop into sparks
          const k = (t - 1.06) / 0.44;
          for (let s = 0; s < 14; s++) { const a = s / 14 * Math.PI * 2 + d.seed, r = (6 + k * 44) * z; g.globalAlpha = 1 - k; g.fillStyle = P[4 + (s % 4)]; const px = Math.max(2, Math.round(3 * z * (1 - k))); g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8 - k * 10 * z), px, px); }
          g.globalAlpha = 1 - k; g.strokeStyle = P[5]; g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(cx), Math.round(cy), (12 + k * 30) * z, (12 + k * 30) * 0.7 * z, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
        }
      }
    }
    g.restore();
  };

  // ---- warp beam (own design): 'out' = a column of light rains down onto the player, they dissolve into it and it
  //      lifts away in sparkles; 'in' = the column drops in, a figure-shaped flash, rings and sparks, then it thins out
  PIX.warps = [];
  PIX.warp = function (wx, wy, kind, col, id) { PIX.warps.push({ wx, wy, kind, id, col: col || '#5fd8ff', t0: (window.G && G.t) || 0 }); if (PIX.warps.length > 20) PIX.warps.shift(); };
  const WARP_D = 1.1;
  PIX.drawWarps = function (g, ox, oy, scale, zoom) {
    const T = (window.G && G.t) || 0, z = zoom || 1;
    g.save(); g.imageSmoothingEnabled = false;
    for (let i = PIX.warps.length - 1; i >= 0; i--) {
      const w = PIX.warps[i], t = T - w.t0; if (t > WARP_D) { PIX.warps.splice(i, 1); continue; }
      const x = ox + w.wx * scale, y = oy + w.wy * scale, k = t / WARP_D, P = Math.max(2, Math.round(2 * z));
      const px = (a, b, ww, hh, c, al) => { g.globalAlpha = al; g.fillStyle = c; g.fillRect(Math.round(a / P) * P, Math.round(b / P) * P, ww, hh); };
      const H = 150 * z, W2 = 9 * z;
      // column grows down from above (0–0.18), holds (–0.6), then breaks up from the bottom (–1)
      const top = y - H, grow = Math.min(1, k / 0.18), bot = top + (H + 4 * z) * grow, lift = k > 0.6 ? (k - 0.6) / 0.4 : 0;
      const y0 = top + (bot - top) * lift * 1.05;
      if (bot > y0) {
        const gr = g.createLinearGradient(0, y0, 0, bot); gr.addColorStop(0, hexA(w.col, 0)); gr.addColorStop(0.2, hexA(w.col, 0.35)); gr.addColorStop(1, hexA(w.col, 0.55));
        g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - W2 * 2.2, y0, W2 * 4.4, bot - y0);
        for (let yy = y0; yy < bot; yy += P) { // streaky pixel body: edge lines, falling dashes, white core
          px(x - W2, yy, P, P, w.col, 0.9); px(x + W2 - P, yy, P, P, w.col, 0.9);
          const s = Math.sin(yy * 0.37 + t * 40) + Math.sin(yy * 0.11 - t * 23);
          if (s > 0.6) px(x - W2 * 0.6 + ((yy * 7) % (W2 * 1.2)), yy, P, P * 3, '#ffffff', 0.85);
          else if (s > -0.2) px(x - W2 * 0.5 + ((yy * 13) % (W2 * 1.0)), yy, P, P * 2, '#bff4ff', 0.6);
        }
      }
      // ground ring + splash where the column lands
      if (k > 0.14 && k < 0.75) { const q = (k - 0.14) / 0.61; g.globalAlpha = 1 - q; g.strokeStyle = '#ffffff'; g.lineWidth = P; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), (12 + q * 26) * z, (4 + q * 8) * z, 0, 0, 7); g.stroke(); g.strokeStyle = w.col; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), (6 + q * 14) * z, (2 + q * 5) * z, 0, 0, 7); g.stroke(); }
      // the figure flash: a white body silhouette inside the beam (dissolving out / forming in)
      const fq = w.kind === 'out' ? (k < 0.5 ? Math.min(1, (k - 0.12) / 0.2) : 1 - (k - 0.5) / 0.15) : (k > 0.35 && k < 0.7 ? Math.sin((k - 0.35) / 0.35 * Math.PI) : 0);
      if (fq > 0) { for (let yy = -30 * z; yy < 0; yy += P) { const hw = (yy > -22 * z ? 6 : 4.5) * z; for (let xx = -hw; xx < hw; xx += P) if (((xx + yy) / P + Math.floor(t * 30)) % 3) px(x + xx, y + yy, P, P, '#ffffff', fq * 0.9); } }
      // sparkles rising after the beam lifts
      if (k > 0.45) for (let s = 0; s < 10; s++) { const q = Math.min(1, (k - 0.45 - s * 0.012) / 0.5); if (q <= 0) continue; const sx = x + Math.sin(s * 2.7) * 12 * z, sy = y - 6 * z - q * (40 + s * 9) * z; const tw = ((t * 12 + s) | 0) % 3;
        if (tw) { px(sx, sy, P, P, s % 3 ? '#ffffff' : w.col, 1 - q); if (s % 4 === 0) { px(sx - P, sy, P, P, w.col, (1 - q) * 0.7); px(sx + P, sy, P, P, w.col, (1 - q) * 0.7); px(sx, sy - P, P, P, w.col, (1 - q) * 0.7); px(sx, sy + P, P, P, w.col, (1 - q) * 0.7); } } }
    }
    g.restore(); g.globalAlpha = 1;
  };
  // is this entity mid-warp-out (hidden after it dissolves into the beam)?
  PIX.warpHidden = function (e) { const T = (window.G && G.t) || 0; for (const w of PIX.warps) if (w.kind === 'out' && w.id === e.id && T - w.t0 > 0.32) return true; return false; };

  // ---- warp gate (own design): a glowing pad with three stacked rings drifting up a translucent cylinder,
  //      sparkles rising inside; colour per gate kind
  PIX.gate = function (g, col, t, id, active) {
    const P = 2, R = 18, H = 54;
    const px = (a, b, w, h, c, al) => { g.globalAlpha = al; g.fillStyle = c; g.fillRect(Math.round(a / P) * P, Math.round(b / P) * P, w, h); };
    const ring = (yy, rx, ry, c, al, dashed) => { for (let i = 0; i < 44; i++) { if (dashed && i % 3 === 2) continue; const a = i / 44 * Math.PI * 2; px(Math.cos(a) * rx, yy + Math.sin(a) * ry, P, P, Math.sin(a) > 0.2 ? c : mixW(c), al); } };
    g.save(); g.imageSmoothingEnabled = false;
    const k = active ? 1 : 0.35;
    // cylinder haze
    const gr = g.createLinearGradient(0, 0, 0, -H); gr.addColorStop(0, hexA(col, 0.38 * k)); gr.addColorStop(1, hexA(col, 0)); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(-R, -H, R * 2, H);
    px(-R, -H, 1, H, '#ffffff', 0.12 * k); px(R - 1, -H, 1, H, '#ffffff', 0.12 * k);
    // base pad: bright ellipse with a white core
    for (let i = 0; i < 3; i++) { g.globalAlpha = (0.5 - i * 0.12) * k; g.fillStyle = i ? col : '#ffffff'; g.beginPath(); g.ellipse(0, 0, R * (1 - i * 0.25), 6 * (1 - i * 0.25), 0, 0, 7); g.fill(); }
    ring(0, R, 6, col, 0.95 * k);
    // three rings rising and fading, looping
    for (let r = 0; r < 3; r++) { const q = ((t * 0.45 + r / 3 + id * 0.17) % 1), yy = -4 - q * (H - 6); ring(yy, R * (1 - q * 0.08), 6, col, (q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85) * k, r === 2); }
    // sparkles drifting up inside
    for (let s = 0; s < 8; s++) { const q = ((t * 0.6 + s / 8 + id * 0.11) % 1), xx = Math.sin(s * 2.1 + id) * R * 0.7, yy = -2 - q * H * 0.85; const al = (1 - q) * k;
      if (s % 3 === 0) { px(xx, yy, P, P, '#ffffff', al); px(xx - P, yy, P, P, col, al * 0.8); px(xx + P, yy, P, P, col, al * 0.8); px(xx, yy - P, P, P, col, al * 0.8); px(xx, yy + P, P, P, col, al * 0.8); }
      else px(xx, yy, P, P * 2, s % 2 ? '#ffffff' : col, al); }
    g.restore(); g.globalAlpha = 1;
  };
  const mixW = (h) => { const v = parseInt(h.slice(1, 7), 16), r = (v >> 16) & 255, gg = (v >> 8) & 255, b = v & 255; return `rgb(${(r + 255 * 1.4) / 2.4 | 0},${(gg + 255 * 1.4) / 2.4 | 0},${(b + 255 * 1.4) / 2.4 | 0})`; };

  // ---- loot beam (called inside the item's local transform, 1 unit = 1 css px at zoom 1)
  const hexA = (h, a) => { const v = parseInt(h.slice(1, 7), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; };
  PIX.beam = function (g, col, t, id, power) {
    const H = 120 + power * 26, P = 2; // pixel size
    const flick = 0.85 + Math.sin(t * 9 + id) * 0.08 + Math.sin(t * 23 + id * 2) * 0.05;
    const px = (x, y, w, h, c, a) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, w, h); };
    g.save(); g.imageSmoothingEnabled = false;
    // soft glow column behind
    const gr = g.createLinearGradient(0, 0, 0, -H); gr.addColorStop(0, hexA(col, 0.32 * flick)); gr.addColorStop(1, hexA(col, 0)); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(-14, -H, 28, H);
    // dithered outer column, solid inner column, white core — pixel stepped
    for (let y = 0; y < H; y += P) {
      const k = y / H, wOut = Math.round((7 - k * 3) / 1) * 1, wIn = Math.max(2, Math.round(4 - k * 2));
      if (((y / P) + Math.floor(t * 20)) % 2 === 0 || k < 0.6) { px(-wOut - 1, -y, P, P, col, 0.7 * (1 - k)); px(wOut - 1, -y, P, P, col, 0.7 * (1 - k)); }
      px(-wIn, -y, wIn * 2, P, col, 0.85 * (1 - k * 0.8) * flick);
      px(-1, -y, 2, P, '#ffffff', (k < 0.85 ? 0.95 : 0.95 * (1 - (k - 0.85) / 0.15)) * flick);
    }
    // broken streak segments flying up past the top
    for (let s = 0; s < 4; s++) { const ph = ((t * 0.9 + s * 0.27 + id * 0.13) % 1), yy = -H - 8 - ph * 60; px(-1, yy, 2, s === 1 ? 10 : 4, s === 1 ? '#ffffff' : col, 1 - ph); }
    // rising motes + a twinkle
    for (let s = 0; s < 6; s++) { const ph = ((t * 0.5 + s / 6 + id * 0.07) % 1), xx = Math.sin(s * 2.3 + id) * 18, yy = -8 - ph * (H * 0.7); px(xx, yy, P, s % 3 ? P * 2 : P, s % 2 ? '#ffffff' : col, 1 - ph); }
    const tw = (t * 1.3 + id * 0.31) % 1; if (tw < 0.25) { const a = 1 - tw / 0.25; px(-22, -46, 6, 2, '#ffffff', a); px(-20, -48, 2, 6, '#ffffff', a); }
    // base ring (pixel ellipse) with a bright rim
    g.globalAlpha = 1;
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rx = 22 + Math.sin(t * 4) * 1, ry = 7; px(Math.cos(a) * rx, 2 + Math.sin(a) * ry, P, P, i % 3 ? col : '#ffffff', 0.9); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; px(Math.cos(a) * 13, 2 + Math.sin(a) * 4, P, P, '#ffffff', 0.55); }
    g.restore(); g.globalAlpha = 1;
  };
})();

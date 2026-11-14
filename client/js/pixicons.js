// Pixel-art icons (32×32 drawn on a pixel grid, shaded + outlined like pixelfx, shown at 2×).
// Skill icons show WHAT the skill does: a class-themed backdrop, a glyph of its mechanic (shot, rain, quake, nova,
// slash combo, blink, pull, summon, nuke...), its element emblem and the status it inflicts, framed by its kind.
(function () {
  const D = NO_DATA;
  const N = 32;
  // ---------------------------------------------------------------- colour helpers
  const hex2 = (h) => { if (h.startsWith('hsl')) { const m = /hsl\(([-\d.]+),\s*([\d.]+)%,\s*([\d.]+)%/.exec(h); return hsl(+m[1], +m[2] / 100, +m[3] / 100); } let s = h.replace('#', ''); if (s.length === 3) s = s.split('').map((c) => c + c).join(''); const v = parseInt(s, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return [f(0), f(8), f(4)]; }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);
  const lum = (c) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
  const sc = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  const ramp3 = (c) => [sc(c, 0.55), c, mix(c, [255, 255, 255], 0.55)];

  // ---------------------------------------------------------------- pixel painter
  function Px() { this.b = new Array(N * N).fill(null); }
  const P = Px.prototype;
  P.set = function (x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < N && y < N && c) this.b[y * N + x] = c; };
  P.get = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N ? this.b[y * N + x] : null; };
  P.rect = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); };
  P.line = function (x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (let k = 0; k < 200; k++) { if (w > 1) this.disc(x0, y0, (w - 1) / 2, c); else this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  };
  P.disc = function (cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) this.set(x, y, c); };
  P.ring = function (cx, cy, r, c, w = 1, a0 = 0, a1 = 7) { for (let y = Math.floor(cy - r - w); y <= cy + r + w; y++) for (let x = Math.floor(cx - r - w); x <= cx + r + w; x++) { const d = Math.hypot(x - cx, y - cy); let a = Math.atan2(y - cy, x - cx); if (a < a0) a += Math.PI * 2; if (Math.abs(d - r) <= w / 2 + 0.2 && a >= a0 && a <= a1) this.set(x, y, c); } };
  P.ell = function (cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) this.set(x, y, c); };
  P.poly = function (pts, c) {
    let y0 = 99, y1 = -1; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= y1; y++) { const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y + 0.5) !== (b[1] <= y + 0.5)) xs.push(a[0] + (y + 0.5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c); }
  };
  // dark outline around everything drawn on this layer
  P.outline = function (c) { const add = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!this.b[y * N + x] && (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1))) add.push([x, y]); for (const [x, y] of add) this.set(x, y, c); return this; };
  // light from the top-left: pixels with an empty neighbour up-left brighten, down-right darken
  P.shade = function () { const nb = this.b.slice(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = this.b[y * N + x]; if (!c) continue; if (!this.get(x - 1, y - 1)) nb[y * N + x] = mix(c, [255, 255, 255], 0.28); else if (!this.get(x + 1, y + 1)) nb[y * N + x] = sc(c, 0.72); } this.b = nb; return this; };
  P.over = function (o) { for (let i = 0; i < N * N; i++) if (o.b[i]) this.b[i] = o.b[i]; return this; };
  P.toURL = function (scale = 2) {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const im = g.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const v = this.b[i]; if (!v) continue; im.data[i * 4] = v[0]; im.data[i * 4 + 1] = v[1]; im.data[i * 4 + 2] = v[2]; im.data[i * 4 + 3] = v[3] === undefined ? 255 : v[3]; }
    g.putImageData(im, 0, 0);
    const o = document.createElement('canvas'); o.width = o.height = N * scale; const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, N * scale, N * scale);
    return o.toDataURL();
  };
  const OUT = [14, 10, 20];
  const layer = () => new Px();
  const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------------------------------------------------------------- class backdrops
  const MOTIF = {
    blade_knight: (p, c) => { p.line(8, 27, 25, 5, c, 2); p.line(10, 19, 16, 25, c, 2); },
    guardian: (p, c) => p.poly([[8, 6], [24, 6], [24, 16], [16, 27], [8, 16]], c),
    berserker: (p, c) => { p.line(10, 27, 22, 6, c, 2); p.poly([[17, 5], [27, 8], [25, 15], [19, 12]], c); },
    shadow_assassin: (p, c) => { p.disc(16, 16, 10, c); p.disc(20, 13, 9, null); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - 20) ** 2 + (y - 13) ** 2 <= 81) p.b[y * N + x] = null; },
    ranger: (p, c) => { p.ell(16, 16, 6, 11, c); p.line(16, 5, 16, 28, null); },
    elementalist: (p, c) => { p.ring(16, 16, 10, c, 2); p.disc(16, 16, 4, c); },
    cleric: (p, c) => { p.rect(14, 5, 4, 22, c); p.rect(8, 11, 16, 4, c); },
    monk: (p, c) => { p.poly([[8, 22], [12, 12], [16, 18], [20, 12], [24, 22]], c); p.ell(16, 24, 9, 3, c); },
    warlock: (p, c) => { p.disc(16, 14, 8, c); p.rect(12, 20, 8, 6, c); p.disc(13, 14, 2, null); p.disc(19, 14, 2, null); },
    gunslinger: (p, c) => { p.ring(16, 16, 9, c, 2); p.rect(15, 4, 2, 24, c); p.rect(4, 15, 24, 2, c); },
    chrono_stalker: (p, c) => { p.ring(16, 16, 11, c, 2); p.line(16, 16, 16, 7, c, 2); p.line(16, 16, 23, 19, c, 2); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; p.set(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, c); } },
    divine_sovereign: (p, c) => { p.ell(16, 7, 10, 3, c); p.ell(16, 7, 7, 1.5, null); for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (((x - 16) / 7) ** 2 + ((y - 7) / 1.5) ** 2 <= 1) p.b[y * 32 + x] = null; p.disc(16, 19, 7, c); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; p.line(16 + Math.cos(a) * 9, 19 + Math.sin(a) * 9, 16 + Math.cos(a) * 13, 19 + Math.sin(a) * 13, c); } },
    hellfiend: (p, c) => { p.poly([[6, 4], [12, 14], [10, 18]], c); p.poly([[26, 4], [20, 14], [22, 18]], c); p.disc(16, 20, 8, c); p.disc(13, 19, 1.5, null); p.disc(19, 19, 1.5, null); },
    void_walker: (p, c) => { p.ring(16, 16, 11, c, 3); p.disc(16, 16, 6, c); p.disc(16, 16, 3, null); },
    lightbringer: (p, c) => { p.poly([[16, 4], [26, 24], [6, 24]], c); for (let i = 0; i < 5; i++) p.line(26, 18 + i, 31, 12 + i * 3, c); }
  };

  // ---------------------------------------------------------------- element emblems (7×7, bottom-left)
  const EMB = {
    fire: (p, x, y, c) => { p.poly([[x + 3, y], [x + 6, y + 4], [x + 5, y + 6], [x + 1, y + 6], [x, y + 4]], c[1]); p.rect(x + 2, y + 4, 3, 2, c[2]); },
    ice: (p, x, y, c) => { p.line(x + 3, y, x + 3, y + 6, c[2]); p.line(x, y + 3, x + 6, y + 3, c[2]); p.line(x + 1, y + 1, x + 5, y + 5, c[1]); p.line(x + 5, y + 1, x + 1, y + 5, c[1]); },
    lightning: (p, x, y, c) => { p.poly([[x + 4, y], [x + 1, y + 4], [x + 3, y + 4], [x + 2, y + 7], [x + 6, y + 2], [x + 4, y + 2]], c[2]); },
    water: (p, x, y, c) => { p.poly([[x + 3, y], [x + 6, y + 4], [x + 3, y + 7], [x, y + 4]], c[1]); p.set(x + 2, y + 3, c[2]); },
    wind: (p, x, y, c) => { p.ring(x + 3, y + 3, 3, c[2], 1, 0, 4.5); p.line(x, y + 6, x + 6, y + 6, c[1]); },
    earth: (p, x, y, c) => { p.poly([[x, y + 6], [x + 2, y + 1], [x + 5, y], [x + 6, y + 6]], c[1]); p.set(x + 3, y + 2, c[2]); },
    holy: (p, x, y, c) => { p.rect(x + 2, y, 3, 7, c[2]); p.rect(x, y + 2, 7, 3, c[2]); },
    dark: (p, x, y, c) => { p.disc(x + 3, y + 3, 3, c[1]); p.disc(x + 5, y + 2, 2.2, null); for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if ((i - 5) ** 2 + (j - 2) ** 2 <= 5) p.b[(y + j) * N + x + i] = null; },
    poison: (p, x, y, c) => { p.disc(x + 3, y + 4, 3, c[1]); p.rect(x + 2, y, 3, 2, c[1]); p.set(x + 2, y + 4, OUT); p.set(x + 4, y + 4, OUT); },
    blood: (p, x, y, c) => { p.poly([[x + 3, y], [x + 6, y + 5], [x + 3, y + 7], [x, y + 5]], [200, 20, 40]); p.set(x + 2, y + 4, [255, 120, 130]); }
  };
  const EL_COL = { fire: [255, 110, 40], ice: [120, 210, 255], lightning: [255, 235, 80], water: [60, 140, 255], wind: [140, 240, 170], earth: [200, 150, 80], holy: [255, 240, 170], dark: [160, 90, 255], poison: [130, 220, 70], blood: [255, 60, 80], neutral: [230, 230, 240] };

  // ---------------------------------------------------------------- mechanic glyphs (draw with ramp c = [dark, mid, light], h = variation hash)
  const W = (p, w, x, y, c, ang) => { // small class weapon silhouette
    const L = 9, ex = x + Math.cos(ang) * L, ey = y + Math.sin(ang) * L;
    if (w === 'bow') { p.ring(x, y, 6, c[1], 1, ang - 1.4, ang + 1.4); p.line(x + Math.cos(ang - 1.4) * 6, y + Math.sin(ang - 1.4) * 6, x + Math.cos(ang + 1.4) * 6, y + Math.sin(ang + 1.4) * 6, c[2]); return; }
    if (w === 'gun') { p.line(x, y, ex, ey, c[1], 2); p.rect(Math.round(x) - 1, Math.round(y), 3, 4, c[0]); return; }
    if (w === 'staff' || w === 'mace' || w === 'scythe') { p.line(x, y, ex, ey, c[0], 1); p.disc(ex, ey, w === 'mace' ? 2.5 : 2, c[2]); if (w === 'scythe') p.ring(ex - 3, ey + 1, 4, c[2], 1, 3.6, 5.6); return; }
    if (w === 'axe') { p.line(x, y, ex, ey, c[0], 1); p.poly([[ex - 1, ey - 1], [ex + 4, ey + 1], [ex + 2, ey + 5], [ex - 2, ey + 3]], c[2]); return; }
    if (w === 'knuckle') { p.rect(Math.round(x) - 3, Math.round(y) - 3, 6, 6, c[1]); p.rect(Math.round(x) - 3, Math.round(y) - 3, 6, 2, c[2]); return; }
    if (w === 'chakram') { p.ring(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, 4, c[2], 1); return; }
    if (w === 'orb' || w === 'prism') { p.disc(x + Math.cos(ang) * 5, y + Math.sin(ang) * 5, 3, c[2]); return; }
    if (w === 'claw') { for (let i = -1; i <= 1; i++) p.line(x + i * 2, y, ex + i * 2, ey, c[2]); return; }
    p.line(x, y, ex, ey, c[2], w === 'spear' ? 1 : 2); p.line(x - Math.sin(ang) * 2, y + Math.cos(ang) * 2, x + Math.sin(ang) * 2, y - Math.cos(ang) * 2, c[0]);
  };
  const star = (p, x, y, r, c) => { p.line(x - r, y, x + r, y, c); p.line(x, y - r, x, y + r, c); p.line(x - r * 0.6, y - r * 0.6, x + r * 0.6, y + r * 0.6, c); p.line(x - r * 0.6, y + r * 0.6, x + r * 0.6, y - r * 0.6, c); };
  const slash = (p, x0, y0, x1, y1, c, bend = 3) => { const mx = (x0 + x1) / 2 - (y1 - y0) / 10 * bend, my = (y0 + y1) / 2 + (x1 - x0) / 10 * bend; for (let t = 0; t <= 1; t += 0.04) { const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1, y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1, w = Math.sin(t * Math.PI) * 1.6; p.disc(x, y, w, c[1]); p.set(x, y, c[2]); } };
  const G = {
    shot: (p, c, h, w) => { const n = 1 + (h % 3); for (let i = 0; i < n; i++) { const y = 10 + i * 6 - (n - 1) * 3 + 6; if (w === 'bow') { p.line(6, y + 6, 24, y - 6, c[1]); p.poly([[24, y - 6], [20, y - 6], [24, y - 2]], c[2]); p.line(6, y + 6, 8, y + 9, c[0]); } else if (w === 'gun') { p.ell(22, y - 4, 3, 2, c[2]); p.line(6, y + 4, 19, y - 3, c[0]); star(p, 6, y + 4, 2, c[1]); } else { p.disc(21, y - 4, 3, c[2]); p.line(6, y + 5, 18, y - 2, c[1], 2); p.line(4, y + 7, 9, y + 3, c[0]); } } },
    lance: (p, c, h) => { p.line(5, 27, 25, 7, c[1], 2); p.poly([[27, 5], [21, 7], [25, 11]], c[2]); star(p, 25, 7, 2 + (h % 2), c[2]); },
    bolt: (p, c, h) => { p.ell(16, 6, 9, 3, c[0]); p.poly([[17, 7], [11, 17], [16, 17], [12, 27], [22, 13], [17, 13], [20, 7]], c[2]); if (h & 1) star(p, 12, 27, 2, c[1]); },
    pierce: (p, c, h) => { const n = 2 + (h % 2); for (let i = 0; i < n; i++) p.ring(9 + i * 7, 18 - i * 3, 3, c[0], 1); p.line(3, 24, 28, 9, c[2], 2); p.poly([[29, 8], [24, 9], [27, 12]], c[2]); },
    throw: (p, c, h) => { p.ring(16, 16, 9, c[0], 1, 3.6, 5.8); p.ring(16, 16, 6, c[0], 1, 0.4, 2.6); p.poly([[14, 10], [22, 13], [19, 21], [12, 17]], c[1]); p.line(10, 22, 15, 14, c[2]); },
    ricochet: (p, c, h) => { p.line(4, 8, 12, 24, c[1]); p.line(12, 24, 20, 8, c[1]); p.line(20, 8, 28, 22, c[1]); for (const [x, y] of [[12, 24], [20, 8]]) star(p, x, y, 2, c[2]); p.disc(28, 22, 2.5, c[2]); },
    grenade: (p, c, h) => { p.disc(15, 19, 7, c[0]); p.disc(13, 17, 2, c[1]); p.rect(14, 10, 3, 3, c[1]); p.line(16, 10, 21, 5, c[1]); star(p, 22, 5, 2, c[2]); },
    rain: (p, c, h) => { const n = 4 + (h % 3); for (let i = 0; i < n; i++) { const x = 5 + i * (22 / n) + (i % 2) * 2, y = 6 + ((i * 7 + h) % 9); p.line(x + 4, y - 5, x, y + 4, c[1]); p.disc(x, y + 5, 1.5, c[2]); } p.line(3, 28, 29, 28, c[0]); },
    quake: (p, c, h) => { p.rect(3, 22, 26, 3, c[0]); p.line(16, 22, 12, 28, c[2]); p.line(16, 22, 21, 28, c[2]); for (let i = 0; i < 3; i++) p.poly([[8 + i * 8, 22], [10 + i * 8, 12 - (i % 2) * 4], [13 + i * 8, 22]], c[1]); },
    leap: (p, c, h) => { p.ring(16, 22, 11, c[0], 1, 3.4, 5.9); p.poly([[24, 12], [28, 12], [26, 17]], c[1]); star(p, 16, 25, 4, c[2]); p.rect(6, 27, 20, 1, c[1]); },
    nova: (p, c, h) => { p.ring(16, 16, 10, c[1], 2); p.disc(16, 16, 3, c[2]); const n = 6 + (h % 3) * 2; for (let i = 0; i < n; i++) { const a = i / n * 6.283; p.line(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5, 16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, c[2]); } },
    spin: (p, c, h, w) => { p.ring(16, 16, 10, c[1], 2, 0.3, 5.9); p.poly([[26, 14], [29, 18], [24, 18]], c[2]); W(p, w, 16, 16, c, -0.7); },
    combo: (p, c, h, w) => { const n = 2 + (h % 2); for (let i = 0; i < n; i++) slash(p, 5 + i * 5, 26 - i * 2, 25 + i * 2, 6 + i * 4, c, (i % 2 ? -3 : 3)); },
    dash: (p, c, h, w) => { for (let i = 0; i < 4; i++) p.line(3, 9 + i * 5, 12 + (i % 2) * 4, 9 + i * 5, c[0]); p.poly([[14, 8], [22, 16], [14, 24], [17, 16]], c[1]); p.poly([[20, 8], [28, 16], [20, 24], [23, 16]], c[2]); },
    blink: (p, c, h) => { p.ring(10, 18, 6, c[0], 1); p.ring(10, 18, 3, c[1], 1); p.ring(23, 12, 6, c[1], 1); p.disc(23, 12, 3, c[2]); for (let i = 0; i < 3; i++) p.set(15 + i * 2, 16 - i * 2, c[2]); },
    wave: (p, c, h) => { for (let r = 0; r < 3; r++) for (let x = 3; x < 29; x++) p.set(x, 12 + r * 6 + Math.round(Math.sin(x / 3 + r + h) * 2.5), c[r === 1 ? 2 : 1]); },
    arc: (p, c, h, w) => { p.ring(10, 20, 14, c[1], 3, 4.4, 6.1); p.ring(10, 20, 14, c[2], 1, 4.5, 6.0); W(p, w, 8, 22, c, -0.9); },
    strike: (p, c, h, w) => { slash(p, 6, 27, 26, 5, c, 1); star(p, 18, 13, 5, c[2]); W(p, w, 6, 27, c, -0.8); },
    scythe: (p, c, h) => { p.line(8, 28, 20, 6, c[0], 1); p.ring(14, 14, 10, c[2], 2, 4.0, 5.9); },
    zone: (p, c, h) => { p.ell(16, 21, 13, 6, c[0]); p.ell(16, 21, 10, 4, null); for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (((x - 16) / 10) ** 2 + ((y - 21) / 4) ** 2 <= 1) p.b[y * N + x] = null; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + h; p.set(16 + Math.cos(a) * 11.5, 21 + Math.sin(a) * 5, c[2]); } for (let i = 0; i < 4; i++) p.line(9 + i * 5, 18, 9 + i * 5, 8 + (i % 2) * 3, c[1]); },
    trap: (p, c, h) => { p.rect(6, 14, 20, 10, c[0]); for (let i = 0; i < 5; i++) { p.poly([[7 + i * 4, 14], [9 + i * 4, 8], [11 + i * 4, 14]], c[2]); } p.rect(6, 22, 20, 2, c[1]); },
    pull: (p, c, h) => { for (let a = 0; a < 12; a += 0.15) { const r = 13 - a; p.set(16 + Math.cos(a + h) * r, 16 + Math.sin(a + h) * r, a > 8 ? c[2] : c[1]); } p.disc(16, 16, 2, c[2]); },
    delayed: (p, c, h) => { p.ring(16, 16, 10, c[1], 1); p.ring(16, 16, 5, c[0], 1); p.line(16, 3, 16, 9, c[2]); p.line(16, 23, 16, 29, c[2]); p.line(3, 16, 9, 16, c[2]); p.line(23, 16, 29, 16, c[2]); p.disc(16, 16, 1.5, c[2]); },
    summon: (p, c, h) => { p.ell(16, 25, 11, 3, c[0]); p.disc(16, 11, 4, c[1]); p.poly([[10, 24], [12, 15], [20, 15], [22, 24]], c[1]); p.set(14, 11, c[2]); p.set(18, 11, c[2]); },
    // ultimates
    nuke: (p, c) => { p.disc(16, 10, 8, c[1]); p.disc(13, 8, 3, c[2]); p.rect(13, 16, 6, 9, c[1]); p.ell(16, 26, 13, 3, c[0]); },
    barrage: (p, c, h) => { for (let i = 0; i < 7; i++) { const x = 4 + (i * 9 + h) % 24, y = 4 + (i * 5) % 18; p.line(x + 5, y - 5, x, y, c[1]); p.disc(x, y, 1.6, c[2]); } p.rect(2, 27, 28, 2, c[0]); },
    blackhole: (p, c) => { p.ring(16, 16, 12, c[1], 2); p.ring(16, 16, 8, c[2], 1, 0, 4); p.disc(16, 16, 6, [8, 4, 16]); },
    stackburst: (p, c, h) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; p.poly([[16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11 - 3], [16 + Math.cos(a) * 11 + 3, 16 + Math.sin(a) * 11 + 2], [16 + Math.cos(a) * 11 - 3, 16 + Math.sin(a) * 11 + 2]], c[1]); } star(p, 16, 16, 6, c[2]); },
    megaline: (p, c) => { p.rect(2, 12, 28, 8, c[1]); p.rect(2, 14, 28, 4, c[2]); p.disc(4, 16, 5, c[2]); },
    transform: (p, c) => { for (let i = 0; i < 5; i++) p.poly([[6 + i * 5, 26], [8 + i * 5, 6 + (i % 2) * 5], [11 + i * 5, 26]], c[i % 2 ? 1 : 0]); p.disc(16, 11, 3.5, c[2]); p.poly([[12, 26], [13, 15], [19, 15], [20, 26]], c[2]); },
    dome: (p, c) => { p.ring(16, 24, 13, c[1], 2, 3.14, 6.29); p.ring(16, 24, 9, c[2], 1, 3.14, 6.29); p.rect(2, 24, 28, 2, c[0]); },
    saint: (p, c) => { p.ring(16, 7, 4, c[2], 1); for (const s of [-1, 1]) p.poly([[16, 14], [16 + s * 14, 8], [16 + s * 12, 18], [16 + s * 5, 20]], c[1]); p.poly([[13, 27], [14, 13], [18, 13], [19, 27]], c[2]); },
    zoneheal: (p, c) => { p.ell(16, 22, 13, 5, c[0]); p.rect(14, 4, 4, 14, c[2]); p.rect(9, 9, 14, 4, c[2]); },
    miracle: (p, c) => { p.disc(16, 16, 6, c[2]); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; p.line(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 16 + Math.cos(a) * (i % 2 ? 11 : 14), 16 + Math.sin(a) * (i % 2 ? 11 : 14), c[1]); } },
    summonArmy: (p, c) => { for (let i = 0; i < 3; i++) { const x = 7 + i * 9, y = 14 + (i % 2) * 4; p.disc(x, y, 3, c[1]); p.rect(x - 3, y + 3, 6, 7, c[i === 1 ? 2 : 1]); } p.rect(2, 27, 28, 2, c[0]); },
    plague: (p, c) => { p.ell(16, 12, 13, 7, c[0]); p.disc(16, 15, 6, c[1]); p.rect(13, 19, 6, 4, c[1]); p.disc(13, 15, 1.5, OUT); p.disc(19, 15, 1.5, OUT); },
    execute: (p, c) => { p.rect(6, 4, 3, 24, c[0]); p.rect(23, 4, 3, 24, c[0]); p.poly([[9, 6], [23, 6], [23, 12], [9, 16]], c[2]); p.disc(16, 24, 4, c[1]); },
    single: (p, c) => { p.ring(16, 16, 11, c[1], 1); p.ring(16, 16, 3, c[2], 1); p.line(16, 2, 16, 11, c[2]); p.line(16, 21, 16, 30, c[2]); p.line(2, 16, 11, 16, c[2]); p.line(21, 16, 30, 16, c[2]); },
    // buffs
    up: (p, c) => { p.line(8, 26, 22, 8, c[1], 2); p.poly([[24, 5], [18, 7], [23, 12]], c[2]); p.poly([[24, 20], [28, 26], [20, 26]], c[2]); },
    shield: (p, c) => { p.poly([[7, 6], [25, 6], [25, 16], [16, 28], [7, 16]], c[1]); p.poly([[10, 9], [16, 9], [16, 24], [10, 16]], c[2]); },
    speed: (p, c) => { p.poly([[8, 10], [16, 16], [8, 22]], c[1]); p.poly([[16, 10], [24, 16], [16, 22]], c[2]); p.line(3, 16, 7, 16, c[0]); },
    drop: (p, c) => { p.poly([[16, 4], [25, 18], [16, 28], [7, 18]], [210, 30, 50]); p.disc(13, 17, 2, [255, 140, 150]); p.ring(23, 9, 3, c[2], 1); },
    heart: (p, c) => { p.disc(11, 12, 5, c[1]); p.disc(21, 12, 5, c[1]); p.poly([[6, 14], [26, 14], [16, 27]], c[1]); p.rect(15, 9, 2, 8, c[2]); p.rect(12, 12, 8, 2, c[2]); },
    wand: (p, c) => { p.line(7, 27, 20, 12, c[0], 2); star(p, 22, 9, 5, c[2]); p.disc(22, 9, 2, c[2]); },
    eye: (p, c) => { p.ell(16, 16, 12, 6, c[2]); p.disc(16, 16, 4, c[1]); p.disc(16, 16, 2, OUT); p.ring(16, 16, 13, c[0], 1, 3.4, 6.0); },
    orb: (p, c) => { p.disc(16, 16, 9, c[1]); p.disc(13, 13, 3, c[2]); p.ring(16, 16, 12, c[0], 1); },
    halo: (p, c) => { p.ell(16, 8, 9, 3, c[2]); p.ell(16, 8, 6, 1.5, null); for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (((x - 16) / 6) ** 2 + ((y - 8) / 1.5) ** 2 <= 1) p.b[y * N + x] = null; p.disc(16, 18, 5, c[1]); p.poly([[9, 30], [11, 22], [21, 22], [23, 30]], c[1]); },
    skull: (p, c) => { p.disc(16, 14, 8, c[2]); p.rect(12, 20, 8, 5, c[2]); p.disc(13, 14, 2, OUT); p.disc(19, 14, 2, OUT); p.rect(26, 4, 2, 6, c[1]); p.rect(24, 6, 6, 2, c[1]); },
    chain: (p, c) => { for (let i = 0; i < 4; i++) p.ring(7 + i * 6, 16 + (i % 2 ? 2 : -2), 3.5, c[i % 2 ? 1 : 2], 1); },
    coin: (p, c) => { p.disc(16, 16, 9, [255, 210, 60]); p.ring(16, 16, 6, [200, 140, 30], 1); p.rect(15, 11, 2, 10, [255, 245, 180]); },
    flake: (p, c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; p.line(16, 16, 16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12, c[2]); } p.ring(16, 16, 5, c[1], 1); },
    feather: (p, c) => { p.ell(16, 15, 5, 12, c[1]); p.line(10, 29, 20, 4, c[2]); },
    mask: (p, c) => { p.ell(16, 15, 12, 7, c[0]); p.ell(11, 14, 3, 2, null); p.ell(21, 14, 3, 2, null); for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (((x - 11) / 3) ** 2 + ((y - 14) / 2) ** 2 <= 1 || ((x - 21) / 3) ** 2 + ((y - 14) / 2) ** 2 <= 1) p.b[y * N + x] = null; }
  };
  G.backstep = G.blink; G.blinkcast = G.blink; G.revive = G.saint; G.executeSweep = (p, c, h) => { G.scythe(p, c, h); p.ring(16, 16, 13, c[1], 1, 0, 6.3); };
  G.zoneself = G.zone; G.zonetarget = (p, c, h) => { G.zone(p, c, h); G.delayed.call(null, p, [c[0], c[0], c[1]], h); }; G.traps = (p, c, h) => { G.trap(p, c, h); star(p, 27, 5, 3, c[2]); };
  G.delayedAoe = (p, c, h) => { G.delayed(p, c, h); p.ring(16, 16, 14, c[2], 1, 0, 3.2); }; G.ricochetUlt = (p, c, h) => { G.ricochet(p, c, h); G.bolt(p, [c[0], c[0], c[1]], h); };
  const BUFF_GLYPH = [['element', 'orb'], ['defPct', 'shield'], ['dmgReduce', 'shield'], ['blocks', 'shield'], ['spShield', 'shield'], ['mdefPct', 'shield'], ['guardAlly', 'shield'], ['ccImmune', 'halo'], ['ccRes', 'halo'],
    ['lifesteal', 'drop'], ['soulSiphon', 'drop'], ['regenPct', 'heart'], ['hpPct', 'heart'], ['spRegen', 'heart'], ['matkPct', 'wand'], ['castReduce', 'wand'], ['crit', 'eye'], ['range', 'eye'], ['hit', 'eye'],
    ['summonBuff', 'skull'], ['comboWin', 'chain'], ['comboDmg', 'chain'], ['extraStack', 'chain'], ['dropPct', 'coin'], ['heatSink', 'flake'], ['flee', 'feather'], ['movePct', 'speed'], ['aspdPct', 'speed'], ['atkPct', 'up'], ['dmgPct', 'up'], ['resGainPct', 'up'], ['str', 'up'], ['agi', 'speed']];

  const CLASS_MOTIF = { blademaster: 'blade_knight', guardian: 'guardian', berserker: 'berserker', paladin: 'divine_sovereign', pyromancer: 'elementalist', cryomancer: 'flake', stormcaller: 'elementalist', necromancer: 'warlock', cleric: 'cleric', druid: 'ranger', assassin: 'shadow_assassin', shadowdancer: 'mask', ranger: 'ranger', marksman: 'gunslinger', engineer: 'gunslinger', monk: 'monk', spellblade: 'elementalist', beastmaster: 'ranger', chronomancer: 'chrono_stalker', warlock: 'warlock', starhunter: 'lightbringer', darkknight: 'void_walker', lightbringer: 'lightbringer', shadowmancer: 'void_walker', seraph: 'feather', reaper: 'warlock', demon: 'hellfiend', deity: 'divine_sovereign', jester: 'mask', loki: 'mask' };
  const BUFF_G2 = { crit: 'eye', atkPct: 'up', aspdPct: 'speed', defPct: 'shield', lifesteal: 'drop', cdr: 'wand', movePct: 'speed' };
  function glyphFor(sk) {
    if (sk.arch) {
      const u = sk.kind === 'ult';
      switch (sk.arch) {
        case 'slash': return 'strike'; case 'spin': return 'spin'; case 'thrust': return 'lance'; case 'beam': return u ? 'megaline' : 'wave';
        case 'proj': return sk.volley ? 'shot' : sk.pierce ? 'pierce' : sk.shape === 'circle' ? 'grenade' : sk.element === 'lightning' ? 'bolt' : 'throw';
        case 'nova': return u ? 'stackburst' : 'nova'; case 'ground': return u ? ((sk.balls || 1) > 1 ? 'barrage' : 'nuke') : (sk.balls || 1) > 1 ? 'rain' : 'quake';
        case 'zone': return u ? 'plague' : 'zone'; case 'chain': return 'ricochet'; case 'dash': return 'dash'; case 'leap': return 'leap';
        case 'barrage': return u ? 'execute' : 'combo'; case 'summon': return u ? 'summonArmy' : 'summon'; case 'turret': return 'summon'; case 'trap': return 'trap';
        case 'buff': return BUFF_G2[Object.keys(sk.mods || {})[0]] || 'up'; case 'shield': return 'shield'; case 'heal': return 'heart'; case 'blink': return 'blink'; case 'stealth': return 'mask';
      }
    }
    const ds = String(sk.design || '');
    if (sk.kind === 'buff') { let mods = {}; try { mods = JSON.parse(ds.slice(5)); } catch (e) {} for (const [k, g] of BUFF_GLYPH) if (k in mods) return g; return 'up'; }
    if (ds.startsWith('ult:')) return ds.split(':')[1];
    return ds.split('|')[0].split(':')[0];
  }

  // ---------------------------------------------------------------- skill icon
  ART.pixSkillIcon = function (sk) {
    const cls = D.CLASSES[sk.cls] || { color: '#888', color2: '#333', weapon: 'sword' };
    const h = hashS(sk.id);
    const swatch = window.VFX && VFX.ok ? VFX.swatch(sk.id) : [];
    const base = swatch.length ? hex2(swatch[5] || swatch[4]) : EL_COL[sk.element] || EL_COL.neutral;
    const elc = EL_COL[sk.element] || EL_COL.neutral;
    let main = mix(base, elc, 0.35); if (lum(main) < 0.35) main = mix(main, [255, 255, 255], 0.3);
    const c = ramp3(main);
    const bg = layer(), cc = hex2(cls.color), c2 = hex2(cls.color2);
    // backdrop: class-colour gradient, a faint class motif, the skill's own hue in the corner glow
    const glow = swatch.length ? hex2(swatch[3]) : sc(main, 0.6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = y / N, d = Math.hypot(x - 22, y - 9) / 30; bg.set(x, y, mix(mix(sc(c2, 1.05), sc(c2, 0.5), t), sc(glow, 0.85), Math.max(0, 0.55 - d))); }
    const mot = layer(); (MOTIF[sk.cls] || MOTIF[CLASS_MOTIF[sk.cls]] || MOTIF.blade_knight)(mot, mix(sc(c2, 1.05), cc, 0.35));
    bg.over(mot);
    // glyph
    const gl = layer(); const fn = G[glyphFor(sk)] || G.strike;
    fn(gl, c, h, cls.weapon);
    if ((h >> 5) & 1) { const f = layer(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f.b[y * N + (N - 1 - x)] = gl.b[y * N + x]; gl.b = f.b; }
    gl.shade().outline(OUT);
    bg.over(gl);
    // element emblem + status pip
    if (EMB[sk.element]) { const e = layer(); EMB[sk.element](e, 2, 23, ramp3(elc)); e.outline(OUT); bg.over(e); }
    const tag = sk.applies && sk.applies[0] && D.TAGS[sk.applies[0].tag];
    if (tag) { const t = layer(), tc = hex2(tag.color); t.poly([[27, 23], [30, 26], [27, 29], [24, 26]], tc); t.set(27, 25, mix(tc, [255, 255, 255], 0.6)); t.outline(OUT); bg.over(t); }
    // frame by kind
    const fr = sk.kind === 'ult' ? [255, 204, 60] : sk.kind === 'buff' ? [90, 220, 120] : cc;
    for (let i = 0; i < N; i++) { bg.set(i, 0, fr); bg.set(i, N - 1, sc(fr, 0.6)); bg.set(0, i, fr); bg.set(N - 1, i, sc(fr, 0.6)); }
    if (sk.kind === 'ult') { for (let i = 1; i < N - 1; i++) { bg.set(i, 1, sc(fr, 0.5)); bg.set(1, i, sc(fr, 0.5)); } for (const [x, y] of [[1, 1], [30, 1], [1, 30], [30, 30]]) { bg.set(x, y, [255, 250, 210]); } star(bg, 27, 4, 2, [255, 236, 150]); }
    if (sk.kind === 'buff') { bg.rect(25, 2, 5, 1, [200, 255, 210]); bg.rect(27, 0 + 0, 1, 5, [200, 255, 210]); }
    if (sk.riders && sk.riders[0]) { const rh = hashS(sk.riders[0].k), rc = hsl(rh % 360, 0.75, 0.62); const rp = layer(); rp.disc(5, 5, 3, rc); rp.set(4, 4, [255, 255, 255]); if (rh & 1) rp.rect(3, 5, 5, 1, sc(rc, 0.5)); else rp.rect(5, 3, 1, 5, sc(rc, 0.5)); rp.outline(OUT); bg.over(rp); }
    if (sk.cat === 'set') { for (let i = 0; i < 5; i++) bg.set(12 + i * 2, 2, [255, 236, 150]); bg.rect(12, 3, 9, 1, [220, 170, 60]); }
    if (sk.role && 'SLF'.includes(sk.role)) { const rc = { S: [58, 176, 255], L: [255, 176, 48], F: [255, 58, 90] }[sk.role]; bg.rect(2, 2, 4, 4, rc); bg.set(3, 3, [255, 255, 255]); }
    return bg.toURL(2);
  };

  // ---------------------------------------------------------------- item icons for typed materials, cards, foods...
  const IC = {
    gel: (p, c) => { p.ell(16, 19, 10, 7, c[1]); p.disc(12, 16, 2, c[2]); },
    orb: (p, c) => { p.disc(16, 16, 9, c[1]); p.disc(13, 13, 3, c[2]); },
    fur: (p, c) => { for (let i = 0; i < 6; i++) p.poly([[6 + i * 4, 26], [8 + i * 4, 8 + (i % 3) * 3], [11 + i * 4, 26]], c[i % 2 ? 1 : 2]); },
    fang: (p, c) => { p.poly([[10, 5], [22, 5], [17, 28]], c[2]); p.line(13, 6, 16, 22, c[1]); },
    heart: (p, c) => { p.disc(11, 13, 6, c[1]); p.disc(21, 13, 6, c[1]); p.poly([[5, 15], [27, 15], [16, 28]], c[1]); p.disc(10, 11, 2, c[2]); },
    leaf: (p, c) => { p.ell(16, 14, 7, 11, c[1]); p.line(16, 4, 16, 29, c[0]); },
    root: (p, c) => { p.line(16, 4, 16, 20, c[1], 2); p.line(16, 18, 8, 28, c[1]); p.line(16, 18, 24, 28, c[1]); p.line(16, 20, 16, 29, c[0]); },
    seed: (p, c) => { p.ell(16, 18, 7, 9, c[1]); p.line(16, 9, 20, 4, c[2]); p.ell(21, 5, 3, 2, [100, 200, 90]); },
    chitin: (p, c) => { p.poly([[6, 10], [16, 5], [26, 10], [24, 24], [8, 24]], c[1]); p.line(16, 6, 16, 24, c[0]); },
    stinger: (p, c) => { p.poly([[8, 28], [24, 4], [20, 18]], c[1]); p.disc(23, 6, 1.5, c[2]); },
    feather: (p, c) => { p.ell(16, 15, 5, 12, c[1]); p.line(10, 29, 20, 4, c[2]); },
    talon: (p, c) => { for (let i = 0; i < 3; i++) p.ring(10 + i * 6, 12, 7, c[2], 2, 0, 1.9); },
    spore: (p, c) => { for (let i = 0; i < 7; i++) p.disc(8 + (i * 7) % 16, 8 + (i * 11) % 16, 2 + (i % 2), c[i % 2 ? 1 : 2]); },
    cap: (p, c) => { p.ell(16, 13, 12, 7, c[1]); p.rect(13, 16, 6, 11, [230, 220, 200]); p.disc(11, 11, 2, c[2]); p.disc(20, 9, 1.5, c[2]); },
    ecto: (p, c) => { p.poly([[8, 28], [6, 12], [16, 4], [26, 12], [24, 28], [20, 24], [16, 28], [12, 24]], c[1]); p.disc(12, 13, 1.5, OUT); p.disc(20, 13, 1.5, OUT); },
    shard: (p, c) => { p.poly([[16, 3], [23, 16], [16, 29], [10, 16]], c[1]); p.poly([[16, 3], [13, 16], [16, 22]], c[2]); },
    bone: (p, c) => { p.line(9, 23, 23, 9, [235, 230, 215], 3); p.disc(8, 22, 3, [235, 230, 215]); p.disc(10, 25, 3, [235, 230, 215]); p.disc(22, 7, 3, [235, 230, 215]); p.disc(25, 10, 3, [235, 230, 215]); },
    dust: (p, c) => { p.ell(16, 22, 11, 5, c[1]); p.ell(16, 19, 7, 4, c[2]); },
    cloth: (p, c) => { p.poly([[6, 8], [24, 6], [27, 24], [9, 27]], c[1]); p.line(9, 12, 23, 10, c[0]); p.line(10, 19, 25, 17, c[0]); },
    stone: (p, c) => { p.poly([[6, 22], [10, 9], [21, 6], [27, 18], [20, 27]], c[1]); p.poly([[10, 9], [21, 6], [17, 14]], c[2]); },
    core: (p, c) => { p.poly([[16, 4], [27, 16], [16, 28], [5, 16]], c[0]); p.disc(16, 16, 5, c[2]); },
    plate: (p, c) => { p.poly([[6, 8], [26, 8], [24, 26], [8, 26]], c[1]); p.rect(9, 11, 3, 3, c[2]); p.rect(20, 11, 3, 3, c[2]); },
    seal: (p, c) => { p.disc(16, 16, 10, c[1]); p.ring(16, 16, 7, c[2], 1); p.rect(15, 11, 2, 10, c[2]); p.rect(11, 15, 10, 2, c[2]); },
    shell: (p, c) => { p.ring(16, 26, 13, c[1], 4, 3.3, 6.1); for (let i = 0; i < 5; i++) p.line(16, 26, 16 + Math.cos(3.4 + i * 0.6) * 13, 26 + Math.sin(3.4 + i * 0.6) * 13, c[2]); },
    pincer: (p, c) => { p.ring(16, 16, 10, c[1], 3, 2.2, 6.6); p.line(16, 16, 27, 27, c[0], 3); },
    pearl: (p, c) => { p.disc(16, 17, 8, [240, 236, 250]); p.disc(13, 14, 2.5, [255, 255, 255]); p.ring(16, 17, 11, c[1], 1, 3.2, 6.2); },
    gland: (p, c) => { p.ell(16, 18, 8, 9, c[1]); p.line(16, 9, 16, 4, c[0], 2); p.disc(13, 16, 2, c[2]); },
    horn: (p, c) => { p.poly([[8, 28], [14, 26], [26, 4], [18, 14]], c[2]); p.line(10, 26, 22, 10, c[1]); },
    ember: (p, c) => { p.poly([[16, 3], [25, 18], [16, 29], [7, 18]], [255, 120, 30]); p.disc(16, 19, 4, [255, 230, 120]); },
    scale: (p, c) => { for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) p.ring(9 + i * 7 + (r % 2) * 3, 10 + r * 6, 4, c[r === 1 ? 2 : 1], 2, 0, 3.2); },
    lens: (p, c) => { p.disc(16, 16, 10, c[0]); p.disc(16, 16, 6, c[1]); p.disc(16, 16, 3, OUT); p.disc(13, 12, 1.5, [255, 255, 255]); },
    card: (p, c) => { p.rect(7, 4, 18, 24, [236, 226, 196]); p.rect(9, 6, 14, 13, c[1]); p.disc(16, 13, 4, c[2]); p.rect(9, 21, 14, 2, [150, 120, 70]); p.rect(9, 24, 10, 1, [150, 120, 70]); },
    food: (p, c) => { p.ell(16, 24, 12, 4, [230, 230, 235]); p.ell(16, 19, 9, 6, c[1]); p.disc(12, 16, 2, c[2]); p.line(20, 10, 22, 6, [255, 255, 255]); },
    oil: (p, c) => { p.rect(12, 4, 8, 4, [200, 170, 120]); p.poly([[10, 10], [22, 10], [26, 26], [6, 26]], c[1]); p.rect(9, 18, 14, 2, c[2]); },
    flask: (p, c) => { p.rect(14, 4, 4, 7, [220, 230, 240]); p.disc(16, 19, 9, c[1]); p.disc(13, 16, 2.5, c[2]); },
    scroll: (p, c) => { p.rect(7, 8, 18, 16, [240, 226, 184]); p.rect(5, 6, 4, 20, c[1]); p.rect(23, 6, 4, 20, c[1]); p.rect(11, 12, 10, 1, [140, 100, 60]); p.rect(11, 16, 8, 1, [140, 100, 60]); },
    anvil: (p, c) => { p.poly([[4, 10], [26, 10], [22, 16], [18, 16], [20, 24], [24, 26], [8, 26], [12, 24], [14, 16], [8, 16]], c[1]); p.rect(6, 10, 20, 2, c[2]); },
    coin: (p, c) => { p.disc(16, 16, 10, c[1]); p.ring(16, 16, 7, c[0], 1); p.rect(15, 11, 2, 10, c[2]); },
    gem: (p, c) => { p.poly([[8, 12], [12, 6], [20, 6], [24, 12], [16, 27]], c[1]); p.poly([[12, 6], [16, 12], [20, 6]], c[2]); },
    relic: (p, c) => { p.poly([[10, 27], [12, 14], [16, 6], [20, 14], [22, 27]], c[1]); p.disc(16, 15, 3, c[2]); p.rect(8, 26, 16, 2, c[0]); },
    box: (p, c) => { p.rect(6, 12, 20, 14, c[1]); p.rect(5, 9, 22, 5, c[2]); p.rect(15, 9, 3, 17, [255, 220, 90]); }
  };
  const itemCache = new Map();
  ART.pixItemIcon = function (def, id) {
    if (itemCache.has(id)) return itemCache.get(id);
    const fn = IC[def.ic]; if (!fn) return null;
    let col = hex2(def.icon || '#aaa');
    const hh = hashS(id);
    if (def.sp && NO_DATA.SPECIES[def.sp]) col = mix(col, hex2(NO_DATA.SPECIES[def.sp].color), def.type === 'junk' ? 0.35 : 0.25);
    col = mix(col, hsl(hh % 360, 0.7, 0.55), 0.12);
    if (lum(col) < 0.25) col = mix(col, [255, 255, 255], 0.35);
    const p = layer(), c = ramp3(col);
    // tier-coloured backing plate
    const plate = layer(); const pc = def.type === 'card' ? [60, 48, 30] : def.mat === 3 || def.glow ? [72, 56, 20] : def.type === 'junk' ? [40, 38, 36] : [32, 34, 48];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) plate.set(x, y, mix(pc, sc(pc, 0.5), y / N));
    fn(p, c); p.shade().outline(OUT);
    plate.over(p);
    const fr = def.mat === 3 || def.mat >= 4 ? [255, 210, 80] : def.type === 'card' ? [220, 190, 120] : def.type === 'junk' ? [90, 86, 80] : [80, 84, 110];
    for (let i = 0; i < N; i++) { plate.set(i, 0, fr); plate.set(i, N - 1, sc(fr, 0.6)); plate.set(0, i, fr); plate.set(N - 1, i, sc(fr, 0.6)); }
    if (def.glow) for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28]]) plate.set(x, y, [255, 250, 200]);
    if (def.tier !== undefined) for (let i = 0; i <= Math.min(5, def.tier >> 1); i++) plate.set(3 + i * 2, 28, [255, 230, 140]);
    plate.set(28 - (hh % 4), 3 + ((hh >> 3) % 3), mix(col, [255, 255, 255], 0.5));
    const u = plate.toURL(2); itemCache.set(id, u); return u;
  };
})();
// hook the pixel icons in: every skill icon, and items that declare an icon shape (ic)
(function () {
  const skCache = new Map();
  ART.skillIconOld = ART.skillIcon;
  ART.skillIcon = (sk) => { if (!sk) return ''; let u = skCache.get(sk.id); if (!u) { u = ART.pixSkillIcon(sk); skCache.set(sk.id, u); } return u; };
  const baseItem = ART.itemIcon;
  ART.itemIcon = (it) => { const d = it && it.id && NO_DATA.ITEMS[it.id]; if (d && d.ic) { const u = ART.pixItemIcon(d, it.id); if (u) return u; } return baseItem(it); };
})();

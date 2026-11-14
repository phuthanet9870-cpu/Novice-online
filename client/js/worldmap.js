// World map, drawn like a real land: every town and field is painted from its actual terrain and laid side by side
// as one continent (regions grouped around their town), soft coastlines over the sea, dirt roads running between
// neighbouring maps where the warp gates connect them, castle marks for towns, region and map names in serif
// lettering, and a marker at your exact position. Drag to pan, wheel to zoom.
(function () {
  const UI = window.UI, D = NO_DATA, M = NO_MAP;
  const CELL = 120; // px per map on the world sheet
  // region blocks (in cells): town in the middle of the top row, its five fields around it
  const place = {};
  for (const id in D.WORLD_PLACE) place[id] = Object.assign({ def: D.TOWNS.find((t) => t.id === id) || D.FARM_MAPS.find((f) => f.id === id) }, D.WORLD_PLACE[id]);
  let maxX = 0, maxY = 0; for (const id in place) { maxX = Math.max(maxX, place[id].cx + 1); maxY = Math.max(maxY, place[id].cy + 1); }
  const PAD = 70, SW = maxX * CELL + PAD * 2, SH = maxY * CELL + PAD * 2;
  const centre = (id) => { const p = place[id]; return [PAD + (p.cx + 0.5) * CELL, PAD + (p.cy + 0.5) * CELL]; };
  const h2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---- the world sheet (built once, then refreshed as map pictures arrive)
  const sheet = document.createElement('canvas'); sheet.width = SW; sheet.height = SH;
  const pics = {}; const queue = Object.keys(place); let dirty = true, started = false;
  function pump() {
    const id = queue.shift(); if (!id) return;
    setTimeout(() => { try { pics[id] = ART.minimap(M.getMap(id)); } catch (e) { pics[id] = null; } dirty = true; pump(); }, 20);
  }
  function links(id) {
    const out = [], town = D.TOWNS.find((t) => t.id === id), farm = D.FARM_MAPS.find((f) => f.id === id);
    if (town) { for (const f of D.FARM_MAPS.filter((x) => x.town === id)) out.push(f.id); }
    else if (farm) { out.push(farm.town); const i = D.FARM_MAPS.indexOf(farm); if (i < D.FARM_MAPS.length - 1) out.push(D.FARM_MAPS[i + 1].id); }
    return out;
  }
  function build() {
    const g = sheet.getContext('2d'); dirty = false;
    // sea with wave glints
    const sea = g.createLinearGradient(0, 0, 0, SH); sea.addColorStop(0, '#163a52'); sea.addColorStop(1, '#0f2a3e'); g.fillStyle = sea; g.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,180,210,${0.04 + h2(i, 3) * 0.06})`; g.fillRect(h2(i, 1) * SW, h2(i, 2) * SH, 6 + h2(i, 4) * 14, 1); }
    // land: irregular shallows, sand rim and biome ground under every map so neighbours melt into one coast
    for (const [rk, col] of [[0.98, 'rgba(70,150,170,0.55)'], [0.85, '#d8c48a'], [0.78, null]]) for (const id in place) {
      const [x, y] = centre(id), B = D.BIOMES[place[id].def.biome] || D.BIOMES.meadow, r = CELL * rk;
      g.fillStyle = col || B.ground[0]; g.beginPath();
      for (let a = 0; a <= 40; a++) { const an = a / 40 * Math.PI * 2, rr = r * (0.88 + h2(a + id.length * 7, id.charCodeAt(0) + id.charCodeAt(1)) * 0.2); g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.94); }
      g.fill();
    }
    // map pictures, feathered at the edges
    for (const id in place) {
      const im = pics[id]; if (!im) continue;
      const [x, y] = centre(id), s = CELL * 0.98, k = Math.min(s / im.width, s / im.height), w = im.width * k, h = im.height * k;
      const tmp = document.createElement('canvas'); tmp.width = Math.ceil(w); tmp.height = Math.ceil(h); const tg = tmp.getContext('2d');
      tg.imageSmoothingEnabled = true; tg.drawImage(im, 0, 0, w, h);
      tg.globalCompositeOperation = 'destination-in'; const fm = tg.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.min(w, h) * 0.52); fm.addColorStop(0, '#000'); fm.addColorStop(1, 'rgba(0,0,0,0)'); tg.fillStyle = fm; tg.fillRect(0, 0, w, h);
      g.drawImage(tmp, x - w / 2, y - h / 2);
    }
    // paper grain
    for (let i = 0; i < 2500; i++) { g.fillStyle = h2(i, 7) > 0.5 ? 'rgba(255,240,200,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(h2(i, 9) * SW, h2(i, 8) * SH, 2, 2); }
    // roads between linked maps, with the warp gate where the road crosses over
    const roads = new Set();
    for (const id in place) for (const o of links(id)) {
      if (!place[o]) continue; const key = [id, o].sort().join('|'); if (roads.has(key)) continue; roads.add(key);
      const [ax, ay] = centre(id), [bx, by] = centre(o), mx = (ax + bx) / 2 + (h2(ax | 0, by | 0) - 0.5) * 30, my = (ay + by) / 2 + (h2(bx | 0, ay | 0) - 0.5) * 30;
      const main = !!(place[id].town || place[o].town);
      for (const [w, c] of [[main ? 6 : 4, 'rgba(60,40,20,0.75)'], [main ? 3 : 2, main ? '#e8c890' : '#c8a870']]) { g.strokeStyle = c; g.lineWidth = w; g.setLineDash(main ? [] : [7, 4]); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke(); }
      g.setLineDash([]);
      const gx = (ax + 2 * mx + bx) / 4, gy = (ay + 2 * my + by) / 4; g.fillStyle = '#2a1a50'; g.beginPath(); g.ellipse(gx, gy, 6, 3.5, 0, 0, 7); g.fill(); g.fillStyle = '#b49aff'; g.beginPath(); g.ellipse(gx, gy, 4, 2.2, 0, 0, 7); g.fill();
    }
    // towns: little castles
    for (const id in place) {
      if (!place[id].town) continue; const [x, y] = centre(id);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, y + 12, 18, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#e9dcc0'; g.fillRect(x - 13, y - 8, 26, 20); g.fillRect(x - 17, y - 14, 8, 26); g.fillRect(x + 9, y - 14, 8, 26); g.fillRect(x - 5, y - 20, 10, 32);
      g.fillStyle = '#b84a3a'; for (const [tx, ty] of [[-13, -14], [13, -14], [0, -20]]) { g.beginPath(); g.moveTo(x + tx - 5, y + ty); g.lineTo(x + tx, y + ty - 9); g.lineTo(x + tx + 5, y + ty); g.fill(); }
      g.fillStyle = '#3a2a1a'; g.fillRect(x - 3, y + 4, 6, 8);
    }
    // names
    for (const id in place) {
      const p = place[id], [x, y] = centre(id), name = p.def.name; g.textAlign = 'center';
      if (p.town) { g.font = '700 17px Cinzel, Kanit, serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(20,12,4,0.9)'; g.strokeText(name.toUpperCase(), x, y + 34); g.fillStyle = '#ffe2a0'; g.fillText(name.toUpperCase(), x, y + 34); }
      else {
        const ty = y + CELL * 0.34; g.font = 'italic 600 11px Cinzel, Kanit, serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(20,12,4,0.85)'; g.strokeText(name, x, ty); g.fillStyle = '#f2e8d0'; g.fillText(name, x, ty);
        g.font = '9px Kanit, sans-serif'; g.strokeText(`Lv ${p.def.min}-${p.def.max}`, x, ty + 11); g.fillStyle = '#d8c8a0'; g.fillText(`Lv ${p.def.min}-${p.def.max}`, x, ty + 11);
      }
    }
    // compass rose
    const cx = SW - 50, cy = 50; g.strokeStyle = '#e8d8b0'; g.fillStyle = '#e8d8b0'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28); g.lineTo(cx + Math.cos(a + 0.35) * 8, cy + Math.sin(a + 0.35) * 8); g.lineTo(cx + Math.cos(a - 0.35) * 8, cy + Math.sin(a - 0.35) * 8); g.fill(); }
    g.textAlign = 'center'; g.font = '700 11px Cinzel, serif'; g.fillText('N', cx, cy - 31);
    const vg = g.createRadialGradient(SW / 2, SH / 2, SH * 0.3, SW / 2, SH / 2, SW * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, SW, SH);
  }

  // ---- viewer
  const VW = 860, VH = 440; let zoom = 0, panX = 0, panY = 0, hover = null, drag = null;
  function fit() { zoom = Math.min(VW / SW, VH / SH); panX = (VW - SW * zoom) / 2; panY = (VH - SH * zoom) / 2; }
  function draw() {
    const cv = document.getElementById('worldMap'); if (!cv) return;
    if (!started) { started = true; pump(); }
    if (dirty) build();
    if (!zoom) fit();
    const g = cv.getContext('2d'); g.fillStyle = '#0f2a3e'; g.fillRect(0, 0, VW, VH);
    g.imageSmoothingEnabled = true; g.drawImage(sheet, panX, panY, SW * zoom, SH * zoom);
    if (hover && place[hover]) { const [x, y] = centre(hover), r = CELL * 0.5 * zoom; g.strokeStyle = 'rgba(255,240,190,0.85)'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(panX + x * zoom - r, panY + y * zoom - r, r * 2, r * 2); g.setLineDash([]); }
    // you are here: exact position inside the current map
    const hid = G.map && G.map.def && G.map.def.id;
    if (hid && place[hid]) {
      const [x, y] = centre(hid), s = CELL * 0.98, k = Math.min(s / G.map.w, s / G.map.h);
      const px = panX + (x - G.map.w * k / 2 + G.self.x * k) * zoom, py = panY + (y - G.map.h * k / 2 + G.self.y * k) * zoom, p = 0.5 + Math.sin(performance.now() / 250) * 0.5;
      g.strokeStyle = `rgba(255,255,255,${0.4 + p * 0.5})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 7 + p * 5, 0, 7); g.stroke();
      g.fillStyle = '#ff5a3c'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 6, py - 13); g.arc(px, py - 15, 6, Math.PI * 0.85, Math.PI * 2.15); g.closePath(); g.fill(); g.stroke();
    }
    if (hover && place[hover]) {
      const d = place[hover].def, lines = [d.name, d.th || '', place[hover].town ? `เมือง · แนะนำ Lv${d.lv}+` : `แมพฟาร์ม · Lv ${d.min}-${d.max}${d.pk ? ' · PK' : ''}`];
      const [x, y] = centre(hover), bx = Math.min(VW - 200, panX + x * zoom + CELL * 0.5 * zoom + 6), by = Math.max(6, Math.min(VH - 64, panY + y * zoom - 30));
      g.fillStyle = 'rgba(20,14,8,0.92)'; g.fillRect(bx, by, 190, 58); g.strokeStyle = '#c8a870'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, 189, 57);
      g.textAlign = 'left'; lines.forEach((s, i) => { g.font = `${i ? 400 : 700} ${i ? 11 : 13}px Kanit, sans-serif`; g.fillStyle = i ? '#e0d4b8' : '#ffe2a0'; g.fillText(s, bx + 8, by + 17 + i * 16); });
    }
  }
  UI.drawWorldMap = draw;
  UI.worldMapHtml = () => `<div class="worldMapBox"><canvas id="worldMap" width="${VW}" height="${VH}"></canvas><div class="wmLegend"><span>ลากเพื่อเลื่อน · ล้อเมาส์เพื่อซูม · ดับเบิลคลิก = ดูทั้งโลก</span><span><i class="road"></i>ถนน</span><span><i class="gate"></i>ประตูวาป</span><span><i class="here"></i>คุณอยู่ที่นี่</span><span class="sep">ดันเจี้ยน · Ruined Sanctum · Blood Colosseum เข้าทาง NPC</span></div></div>`;
  const toCv = (cv, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * VW / r.width, (e.clientY - r.top) * VH / r.height]; };
  document.addEventListener('mousedown', (e) => { if (e.target.id !== 'worldMap') return; const [x, y] = toCv(e.target, e); drag = { x, y, px: panX, py: panY }; });
  document.addEventListener('mouseup', () => { drag = null; });
  document.addEventListener('dblclick', (e) => { if (e.target.id === 'worldMap') { fit(); draw(); } });
  document.addEventListener('mousemove', (e) => {
    const cvEl = document.getElementById('worldMap');
    if (drag && cvEl) { const [x, y] = toCv(cvEl, e); panX = drag.px + x - drag.x; panY = drag.py + y - drag.y; draw(); return; }
    if (e.target !== cvEl || !cvEl) return;
    const [x, y] = toCv(cvEl, e), wx = (x - panX) / zoom, wy = (y - panY) / zoom;
    let h = null; for (const id in place) { const [cx, cy] = centre(id); if (Math.abs(cx - wx) < CELL * 0.5 && Math.abs(cy - wy) < CELL * 0.5) h = id; }
    if (h !== hover) { hover = h; draw(); }
  });
  document.addEventListener('wheel', (e) => {
    if (e.target.id !== 'worldMap') return; e.preventDefault();
    const [x, y] = toCv(e.target, e), nz = Math.max(Math.min(VW / SW, VH / SH) * 0.9, Math.min(3, zoom * (e.deltaY > 0 ? 0.88 : 1.14)));
    panX = x - (x - panX) * nz / zoom; panY = y - (y - panY) * nz / zoom; zoom = nz; draw();
  }, { passive: false });
  setInterval(() => { if (UI.wins.map && !UI.wins.map.hidden) draw(); }, 150);
})();

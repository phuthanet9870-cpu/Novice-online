// World map: every town and field of the game as a picture of the real map, joined by the warp-gate roads
// (town ↔ its fields, field ↔ previous / next field, town ↔ neighbouring towns — the same links the server builds).
// You-are-here pulse, hover for name / level / boss, the dungeons and world-boss arena listed apart.
(function () {
  const UI = window.UI, D = NO_DATA, M = NO_MAP;
  const thumbs = {}; let queue = [], busy = false;
  // map pictures are generated one at a time in idle moments (maps are big)
  function thumb(id) {
    if (thumbs[id]) return thumbs[id];
    if (!queue.includes(id)) queue.push(id);
    if (!busy) pump();
    return null;
  }
  function pump() {
    const id = queue.shift(); if (!id) { busy = false; return; }
    busy = true;
    setTimeout(() => {
      try { const m = M.getMap(id); if (m) thumbs[id] = ART.minimap(m); } catch (e) { thumbs[id] = false; }
      if (UI.wins.map && !UI.wins.map.hidden) draw();
      pump();
    }, 16);
  }
  function links(id) {
    const out = [], town = D.TOWNS.find((t) => t.id === id), farm = D.FARM_MAPS.find((f) => f.id === id);
    if (town) {
      for (const f of D.FARM_MAPS.filter((x) => x.town === id)) out.push(f.id);
      const ti = D.TOWNS.indexOf(town); out.push(D.TOWNS[(ti + 1) % D.TOWNS.length].id, D.TOWNS[(ti - 1 + D.TOWNS.length) % D.TOWNS.length].id);
    } else if (farm) {
      out.push(farm.town); const i = D.FARM_MAPS.indexOf(farm);
      if (i > 0) out.push(D.FARM_MAPS[i - 1].id); if (i < D.FARM_MAPS.length - 1) out.push(D.FARM_MAPS[i + 1].id);
    }
    return out;
  }
  // layout: towns along the middle, each town's fields on an arc above or below it (alternating per region)
  const W = 860, H = 420, nodes = {};
  D.TOWNS.forEach((t, i) => {
    const tx = 130 + i * ((W - 260) / (D.TOWNS.length - 1)), ty = H / 2, up = i % 2 === 0 ? -1 : 1;
    nodes[t.id] = { x: tx, y: ty, r: 30, def: t, town: 1 };
    D.FARM_MAPS.filter((f) => f.town === t.id).forEach((f, k, arr) => {
      const a = Math.PI * (0.18 + 0.64 * (k / Math.max(1, arr.length - 1)));
      nodes[f.id] = { x: tx - Math.cos(a) * 104, y: ty + up * (60 + Math.sin(a) * 105 - (k % 2) * 34), r: 20, def: f };
    });
  });
  let hover = null, cv = null;
  function draw() {
    cv = document.getElementById('worldMap'); if (!cv) return;
    const g = cv.getContext('2d'), t = performance.now() / 1000, here = G.map && G.map.def ? G.map.def.id : '';
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#1d2a2a'); bg.addColorStop(1, '#0b0f12'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // roads (each link once)
    const seen = new Set();
    for (const id in nodes) for (const o of links(id)) {
      const k = [id, o].sort().join('|'); if (seen.has(k) || !nodes[o]) continue; seen.add(k);
      const a = nodes[id], b = nodes[o], town2 = a.town && b.town;
      g.strokeStyle = town2 ? 'rgba(255,214,120,0.55)' : 'rgba(160,140,255,0.55)'; g.lineWidth = town2 ? 3 : 2; g.setLineDash(town2 ? [] : [5, 4]);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
      // a gate glyph halfway
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; g.fillStyle = '#9a7aff'; g.beginPath(); g.ellipse(mx, my, 4, 2, 0, 0, 7); g.fill();
    }
    // map pictures
    for (const id in nodes) {
      const n = nodes[id], im = thumb(id), lv = n.def.min || n.def.lv || 1, low = G.char && G.char.lv + 5 < lv;
      g.save(); g.beginPath(); g.arc(n.x, n.y, n.r, 0, 7); g.clip();
      if (im) { g.imageSmoothingEnabled = false; g.drawImage(im, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); } else { g.fillStyle = (D.BIOMES[n.def.biome] || D.BIOMES.meadow).ground[0]; g.fill(); }
      if (low) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); }
      g.restore();
      g.lineWidth = n.town ? 3 : 2; g.strokeStyle = id === hover ? '#ffffff' : n.town ? '#e8c068' : '#7a6aa8'; g.beginPath(); g.arc(n.x, n.y, n.r, 0, 7); g.stroke();
      g.font = `${n.town ? 700 : 500} ${n.town ? 12 : 9}px Kanit, sans-serif`; g.textAlign = 'center';
      const label = n.town ? n.def.name : `${n.def.name} · ${n.def.min}-${n.def.max}`;
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(label, n.x, n.y + n.r + 13); g.fillStyle = n.town ? '#ffe08a' : low ? '#a09a8a' : '#e8e2d0'; g.fillText(label, n.x, n.y + n.r + 13);
      if (id === here) { // you are here
        const p = 0.5 + Math.sin(t * 4) * 0.5; g.strokeStyle = `rgba(90,220,255,${0.5 + p * 0.5})`; g.lineWidth = 3; g.beginPath(); g.arc(n.x, n.y, n.r + 5 + p * 4, 0, 7); g.stroke();
        g.fillStyle = '#5ad0ff'; g.beginPath(); g.moveTo(n.x, n.y - n.r - 6); g.lineTo(n.x - 6, n.y - n.r - 16); g.lineTo(n.x + 6, n.y - n.r - 16); g.fill();
      }
    }
    // hover card
    if (hover && nodes[hover]) {
      const n = nodes[hover], d = n.def, bi = (UI.lastInfo && UI.lastInfo.boss) ? (UI.lastInfo.boss.list || []).find((b) => b.map === d.name) : null;
      const lines = [d.name, d.th || '', n.town ? `เมือง · แนะนำ Lv${d.lv}+` : `ฟาร์ม Lv${d.min}-${d.max}${d.pk ? ' · PK' : ''}`, `เชื่อม ${links(hover).length} ประตูวาป`].concat(bi ? [`บอส: ${bi.name || ''} ${bi.alive ? '● มีอยู่' : ''}`] : []);
      const bw = 190, bh = 18 + lines.length * 15, bx = Math.min(W - bw - 6, n.x + n.r + 8), by = Math.max(6, Math.min(H - bh - 6, n.y - bh / 2));
      g.fillStyle = 'rgba(10,8,14,0.92)'; g.fillRect(bx, by, bw, bh); g.strokeStyle = '#e8c068'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      g.textAlign = 'left'; lines.forEach((s, i) => { g.font = `${i ? 400 : 700} ${i ? 11 : 13}px Kanit, sans-serif`; g.fillStyle = i ? '#d8cfb8' : '#ffe08a'; g.fillText(s, bx + 9, by + 16 + i * 15); });
    }
  }
  UI.drawWorldMap = draw;
  UI.worldMapHtml = () => `<div class="worldMapBox"><canvas id="worldMap" width="${W}" height="${H}"></canvas><div class="wmLegend"><span><i class="town"></i>เมือง</span><span><i class="farm"></i>แมพฟาร์ม</span><span><i class="road"></i>ถนนระหว่างเมือง</span><span><i class="gate"></i>ประตูวาป</span><span><i class="here"></i>คุณอยู่ที่นี่</span><span class="sep">ดันเจี้ยน 5 แห่ง · Ruined Sanctum (เวิลด์บอส) · Blood Colosseum — เข้าทาง NPC</span></div></div>`;
  document.addEventListener('mousemove', (e) => {
    if (!cv || e.target !== cv) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    let h = null; for (const id in nodes) { const n = nodes[id]; if (Math.hypot(n.x - x, n.y - y) < n.r + 3) h = id; }
    if (h !== hover) { hover = h; draw(); }
  });
  setInterval(() => { if (UI.wins.map && !UI.wins.map.hidden) draw(); }, 120);
})();

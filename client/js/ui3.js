// Passive tree (1000 nodes), GM tools (icon pages), collapsible chat/menu, training DPS meter.
(function () {
  const D = NO_DATA, T = NO_PASSIVE;
  const WIN = UI.WIN, esc = UI.esc, fmt = UI.fmt;
  const $ = (s) => document.querySelector(s);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------------------------------------------------------------- collapsible chat & menu
  function setupCollapse() {
    const tabs = $('#chatTabs'), menu = $('#menu');
    if (!tabs || !menu || $('#chatFold')) return setTimeout(setupCollapse, 300);
    const cb = document.createElement('button'); cb.id = 'chatFold'; cb.title = 'ย่อ/ขยายแชท'; tabs.appendChild(cb);
    const applyChat = (c) => { $('#chat').classList.toggle('collapsed', c); cb.textContent = c ? '▲' : '▼'; store.set('no_chat_c', c); };
    cb.onclick = (e) => { e.stopPropagation(); applyChat(!$('#chat').classList.contains('collapsed')); };
    applyChat(store.get('no_chat_c', false));
    const mb = document.createElement('button'); mb.id = 'menuFold'; mb.className = 'mbtn'; mb.title = 'ย่อ/ขยายเมนู';
    menu.parentNode.insertBefore(mb, menu);
    const applyMenu = (c) => { menu.classList.toggle('collapsed', c); mb.innerHTML = c ? '<span>☰</span>' : '<span>✕</span>'; mb.classList.toggle('on', c); store.set('no_menu_c', c); };
    mb.onclick = () => applyMenu(!menu.classList.contains('collapsed'));
    applyMenu(store.get('no_menu_c', false));
  }
  setupCollapse();

  // ---------------------------------------------------------------- passive tree
  const view = { x: 0, y: 0, z: 0.42, q: '', hover: -1, dirty: true };
  let cvBound = null;
  const SECTOR_COL = D.CLASS_IDS.map((c) => D.CLASSES[c].color);
  const sectorOf = (nd) => { let x = nd.a / (Math.PI * 2); x -= Math.floor(x); return Math.round(x * 10) % 10; };
  function allocSet() { const s = new Set(G.char.passives || []); s.add(T.starts[G.char.cls]); return s; }
  function pathTo(id) {
    const have = allocSet(); if (have.has(id)) return [];
    const prev = new Map(); const q = [...have]; for (const h of have) prev.set(h, -1);
    while (q.length) { const c = q.shift(); if (c === id) break; for (const a of T.nodes[c].adj) if (!prev.has(a)) { prev.set(a, c); q.push(a); } }
    if (!prev.has(id)) return null;
    const out = []; let c = id; while (!have.has(c)) { out.push(c); c = prev.get(c); }
    return out.reverse();
  }
  WIN.passive = {
    title: '🌌 Passive Skill Tree — 1000 โหนด', w: 1060,
    onOpen() { const st = T.nodes[T.starts[G.char.cls]]; if (!view.centered) { view.x = -st.x; view.y = -st.y; view.centered = true; } view.dirty = true; },
    render() {
      const c = G.char; const mods = T.modsOf(c.passives);
      const sum = T.describe(mods);
      return `<div class="ptTop"><span>แต้มคงเหลือ <b class="big">${c.passivePts || 0}</b></span><span>เลือกแล้ว ${(c.passives || []).length} / 1000 โหนด</span>
        <input id="ptQ" placeholder="ค้นหาโหนด เช่น Crit, Lifesteal, Glass" value="${esc(view.q)}"><button class="btn tiny" data-act="home">⌂ จุดเริ่ม</button><button class="btn tiny" data-act="zin">＋</button><button class="btn tiny" data-act="zout">−</button><button class="btn tiny danger" data-act="reset">รีเซ็ตทั้งต้น</button></div>
        <div class="ptWrap"><canvas id="ptCv" width="780" height="560"></canvas><div class="ptSide scrollKeep">${(c.passives || []).some((id) => T.nodes[id] && T.nodes[id].fx) ? `<h4>เอฟเฟกต์พิเศษ</h4>${(c.passives || []).map((id) => T.nodes[id]).filter((n) => n && n.fx).map((n) => `<div class="pfx"><b>${esc(n.name)}</b> ${esc(T.fxText(n.fx))}</div>`).join('')}` : ''}<h4>โบนัสรวมจากต้นไม้</h4>${sum.length ? sum.map((s) => `<div>${esc(s)}</div>`).join('') : '<small class="hint">ยังไม่ได้เลือกโหนด</small>'}
        <h4>วิธีใช้</h4><small class="hint">คลิกโหนด = เลือก (ถ้าอยู่ไกลจะเลือกทั้งเส้นทางให้อัตโนมัติ) · คลิกขวา = คืนแต้ม (${fmt(c.lv * 50)}z) · ลาก = เลื่อน · ล้อเมาส์ = ซูม<br>● เล็ก = โหนดย่อย · ◆ = Notable · ⬢ ใหญ่ = Keystone (ข้อแลกเปลี่ยนใหญ่) · ได้ 1 แต้มต่อเลเวล + โบนัสทุก 10 เลเวล</small></div></div>`;
    },
    act(a) {
      if (a === 'home') { const st = T.nodes[T.starts[G.char.cls]]; view.x = -st.x; view.y = -st.y; view.dirty = true; }
      if (a === 'zin') { view.z = Math.min(2.2, view.z * 1.25); view.dirty = true; }
      if (a === 'zout') { view.z = Math.max(0.18, view.z / 1.25); view.dirty = true; }
      if (a === 'reset') UI.ask('รีเซ็ต Passive Tree ทั้งหมด? (ฟรีถึง Lv50 หลังจากนั้นใช้ Rebirth Elixir)', { danger: true }).then((y) => y && G.send({ t: 'passive', a: 'reset' }));
    },
    input(t) { if (t.id === 'ptQ') { view.q = t.value.trim().toLowerCase(); view.dirty = true; } }
  };
  function bindTree() {
    const cv = document.getElementById('ptCv'); if (!cv || cv === cvBound) return;
    cvBound = cv; view.dirty = true;
    let drag = null, moved = false;
    const toWorld = (ev) => { const r = cv.getBoundingClientRect(); const sx = (ev.clientX - r.left) * cv.width / r.width, sy = (ev.clientY - r.top) * cv.height / r.height; return [(sx - cv.width / 2) / view.z - view.x, (sy - cv.height / 2) / view.z - view.y]; };
    const nodeAt = (ev) => { const [wx, wy] = toWorld(ev); let best = -1, bd = (14 / view.z + 6) ** 2; for (const nd of T.nodes) { const d = (nd.x - wx) ** 2 + (nd.y - wy) ** 2; if (d < bd) { bd = d; best = nd.id; } } return best; };
    cv.addEventListener('mousedown', (ev) => { drag = [ev.clientX, ev.clientY, view.x, view.y]; moved = false; });
    window.addEventListener('mouseup', () => { drag = null; });
    cv.addEventListener('mousemove', (ev) => {
      if (drag) { const r = cv.getBoundingClientRect(); const k = cv.width / r.width; const dx = (ev.clientX - drag[0]) * k / view.z, dy = (ev.clientY - drag[1]) * k / view.z; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view.x = drag[2] + dx; view.y = drag[3] + dy; view.dirty = true; }
      const h = nodeAt(ev); if (h !== view.hover) { view.hover = h; view.dirty = true; }
      const tip = $('#tip');
      if (h >= 0) {
        const nd = T.nodes[h]; const path = pathTo(h); const have = allocSet().has(h);
        tip.innerHTML = `<div class="tt"><b style="color:${nd.type === 'keystone' ? '#ff9a3a' : nd.type === 'notable' ? '#ffd34a' : '#fff'}">${esc(nd.name || (nd.type === 'minor' ? 'โหนดย่อย' : ''))}</b> <small>${{ minor: 'Minor', notable: 'Notable', keystone: 'KEYSTONE', start: 'จุดเริ่มคลาส' }[nd.type]} · วง ${nd.k}</small>${T.describe(nd.mods || {}).map((s) => `<div class="opt">${esc(s)}</div>`).join('')}${nd.fx ? `<div class="opt imp">✦ ${esc(T.fxText(nd.fx))}</div>` : ''}<small>${have ? '✔ เลือกแล้ว (คลิกขวาเพื่อคืน)' : path ? `ต้องใช้ ${path.length} แต้ม` : 'ยังไปไม่ถึง'}</small></div>`;
        tip.hidden = false; tip.style.left = Math.min(innerWidth - 300, ev.clientX + 16) + 'px'; tip.style.top = (ev.clientY + 16) + 'px';
      } else tip.hidden = true;
    });
    cv.addEventListener('mouseleave', () => { $('#tip').hidden = true; view.hover = -1; view.dirty = true; });
    cv.addEventListener('wheel', (ev) => { ev.preventDefault(); view.z = Math.max(0.18, Math.min(2.2, view.z * (ev.deltaY > 0 ? 0.88 : 1.14))); view.dirty = true; }, { passive: false });
    cv.addEventListener('click', (ev) => { if (moved) return; const h = nodeAt(ev); if (h < 0) return; const path = pathTo(h); if (!path || !path.length) return; if (path.length > (G.char.passivePts || 0)) return UI.toast(`ต้องใช้ ${path.length} แต้ม แต่มี ${G.char.passivePts || 0}`, 'err'); G.send({ t: 'passive', a: 'alloc', ids: path }); });
    cv.addEventListener('contextmenu', (ev) => { ev.preventDefault(); const h = nodeAt(ev); if (h >= 0 && (G.char.passives || []).includes(h)) G.send({ t: 'passive', a: 'refund', id: h }); });
  }
  let lastAlloc = '';
  function drawTree() {
    if (!UI.open.includes('passive')) { cvBound = null; return; }
    bindTree();
    const cv = document.getElementById('ptCv'); if (!cv) return;
    const key = (G.char.passives || []).join(',');
    if (key !== lastAlloc) { lastAlloc = key; view.dirty = true; }
    if (!view.dirty) return; view.dirty = false;
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const bg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#1b1830'); bg.addColorStop(1, '#07060d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.scale(view.z, view.z); g.translate(view.x, view.y);
    const have = allocSet();
    const hp = view.hover >= 0 ? new Set(pathTo(view.hover) || []) : new Set();
    for (const [a, b] of T.edges) {
      const A = T.nodes[a], B = T.nodes[b]; const ha = have.has(a), hb = have.has(b);
      g.strokeStyle = ha && hb ? '#ffcf5a' : (hp.has(a) || hp.has(b)) && (ha || hb || (hp.has(a) && hp.has(b))) ? '#7dffb0' : ha || hb ? 'rgba(160,220,170,0.55)' : 'rgba(120,120,150,0.28)';
      g.lineWidth = ha && hb ? 5 : 2.5; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    }
    const q = view.q;
    for (const nd of T.nodes) {
      const r = nd.type === 'keystone' ? 22 : nd.type === 'notable' ? 13 : nd.type === 'start' ? 18 : 7;
      const on = have.has(nd.id); const avail = !on && nd.adj.some((x) => have.has(x));
      const sc = SECTOR_COL[sectorOf(nd)];
      g.beginPath();
      if (nd.type === 'keystone') { for (let i = 0; i <= 6; i++) { const an = i / 6 * 6.283; i ? g.lineTo(nd.x + Math.cos(an) * r, nd.y + Math.sin(an) * r) : g.moveTo(nd.x + r, nd.y); } }
      else if (nd.type === 'notable') { g.moveTo(nd.x, nd.y - r); g.lineTo(nd.x + r, nd.y); g.lineTo(nd.x, nd.y + r); g.lineTo(nd.x - r, nd.y); g.closePath(); }
      else g.arc(nd.x, nd.y, r, 0, 7);
      g.fillStyle = on ? sc : nd.type === 'start' ? (nd.cls === G.char.cls ? sc : '#3a3550') : avail ? '#2c3a34' : '#1e1c2a';
      g.fill();
      g.lineWidth = nd.id === view.hover ? 4 : 2;
      g.strokeStyle = nd.id === view.hover ? '#fff' : hp.has(nd.id) ? '#7dffb0' : on ? '#fff3c8' : avail ? '#7dffb0' : nd.type === 'keystone' ? '#a0703a' : nd.type === 'notable' ? '#8a7a4a' : '#4a4660';
      g.stroke();
      if (q && ((nd.name || '').toLowerCase().includes(q) || T.describe(nd.mods || {}).join(' ').toLowerCase().includes(q) || (nd.fx && T.fxText(nd.fx).toLowerCase().includes(q)))) { g.strokeStyle = '#ff5ad0'; g.lineWidth = 3; g.beginPath(); g.arc(nd.x, nd.y, r + 7, 0, 7); g.stroke(); }
      if ((nd.type === 'keystone' && view.z > 0.3) || (nd.type === 'notable' && view.z > 0.85) || nd.type === 'start') {
        g.font = `${nd.type === 'start' ? 700 : 600} ${nd.type === 'keystone' ? 15 : 12}px Kanit, sans-serif`; g.textAlign = 'center';
        g.fillStyle = nd.type === 'start' ? D.CLASSES[nd.cls].color : nd.type === 'keystone' ? '#ffb46a' : '#e8d8a0';
        g.fillText(nd.type === 'start' ? D.CLASSES[nd.cls].name : nd.name, nd.x, nd.y - r - 6);
      }
    }
    g.restore();
  }
  setInterval(drawTree, 33);
  const baseRender = WIN.passive.render;
  WIN.passive.render = function (o) { setTimeout(() => { cvBound = null; view.dirty = true; }, 0); return baseRender(o); };

  // ---------------------------------------------------------------- GM tools
  const gm = (cmd) => G.send({ t: 'gm', cmd });
  let gmData = { players: [], rates: {}, flags: {}, castles: [], bosses: [], ents: [] };
  UI.onGmData = (m) => { gmData = m; if (UI.open.includes('gm')) UI.renderWin('gm'); };
  const refresh = () => setTimeout(() => gm('gmdata'), 350);
  const RARITY_N = D.RARITY.length;
  function itemCatalog() {
    if (itemCatalog.cache) return itemCatalog.cache;
    const out = [];
    for (const id in D.ITEMS) {
      if (id === 'zeny') continue;
      const d = D.ITEMS[id];
      const cat = { potion: 'use', scroll: 'use', buffitem: 'use', petfood: 'use', mat: 'mat', loot: 'mat', rune: 'rune', jewel: 'jewel', pet: 'pet', mount: 'pet', currency: 'misc' }[d.type] || 'misc';
      out.push({ key: id, cat, name: d.n, sub: d.th || '', lv: d.lv || 1, it: { id } });
    }
    for (const wt in D.WEAPON_NAMES) D.WEAPON_NAMES[wt].forEach((n, t) => out.push({ key: `w:${wt}:${t}`, cat: 'weapon', name: n, sub: `${wt} · Tier ${t + 1}`, lv: t * 25 + 1, gear: { slot: 'weapon', wtype: wt, tier: t }, it: { type: 'equip', slot: 'weapon', wtype: wt } }));
    for (const sl of ['offhand', 'head', 'armor', 'cloak', 'gloves', 'belt', 'boots']) D.ARMOR_NAMES[sl].forEach((n, t) => out.push({ key: `a:${sl}:${t}`, cat: 'armor', name: n, sub: `${D.SLOT_TH[sl]} · Tier ${t + 1}`, lv: t * 25 + 1, gear: { slot: sl, tier: t }, it: { type: 'equip', slot: sl } }));
    for (const sl of ['necklace', 'earring', 'ring']) D.ARMOR_NAMES[sl].forEach((n, t) => out.push({ key: `c:${sl}:${t}`, cat: 'acc', name: n, sub: `${sl} · Tier ${t + 1}`, lv: t * 25 + 1, gear: { slot: sl, tier: t }, it: { type: 'equip', slot: sl } }));
    return (itemCatalog.cache = out);
  }
  const CATS = [['all', '🎒', 'ทั้งหมด'], ['weapon', '⚔', 'อาวุธ'], ['armor', '🛡', 'เกราะ'], ['acc', '💍', 'ประดับ'], ['use', '🧪', 'ใช้งาน'], ['mat', '⛏', 'วัสดุ'], ['rune', '🔷', 'รูน'], ['jewel', '💎', 'อัญมณี'], ['pet', '🐾', 'สัตว์/พาหนะ'], ['misc', '📦', 'อื่นๆ']];
  const monPortrait = new Map();
  function monIcon(f, biome) {
    const k = f[0] + biome; if (monPortrait.has(k)) return monPortrait.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 56; const g = c.getContext('2d');
    g.fillStyle = '#1a1d2a'; g.fillRect(0, 0, 56, 56);
    const h = NO_RNG.hashStr(biome + f[0]);
    ART.drawMonster(g, { sh: f[1], col: `hsl(${h % 360},${45 + (h >> 9) % 35}%,${45 + (h >> 17) % 18}%)`, sz: 1.1, rk: 0, id: 1 }, 28, 50, 0);
    const u = c.toDataURL(); monPortrait.set(k, u); return u;
  }
  function targetSel(o) { return `<select id="gmTgt">${['', ...gmData.players.map((p) => p.name)].map((n) => `<option value="${esc(n)}" ${o.tgt === n ? 'selected' : ''}>${n ? esc(n) : '— ตัวเอง —'}</option>`).join('')}</select>`; }
  const tgtArg = () => { const v = ($('#gmTgt') || {}).value; return v ? ' ' + v : ''; };
  WIN.gm = {
    title: '🛡 เครื่องมือ GM / แอดมิน', w: 900,
    onOpen() { gm('gmdata'); },
    render(o) {
      const tab = o.tab || 'items';
      const tabs = [['items', '🎒 ไอเทม'], ['monsters', '👾 มอนสเตอร์'], ['char', '🧙 ตัวละคร'], ['charplus', '⭐ ค่าพลัง+'], ['world', '🌍 โลก & เรท'], ['console', '⌨ Console']];
      let body = '';
      if (tab === 'items') {
        const all = itemCatalog(); const cat = o.cat || 'all'; const q = (o.q || '').toLowerCase(); const rar = o.rar === undefined ? 3 : o.rar;
        const list = all.filter((x) => (cat === 'all' || x.cat === cat) && (!q || x.name.toLowerCase().includes(q) || x.key.includes(q) || x.sub.toLowerCase().includes(q)));
        const sel = all.find((x) => x.key === o.sel) || list[0];
        const icon = (x) => ART.itemIcon(x.gear ? Object.assign({}, x.it, { rarity: rar }) : x.it);
        body = `<div class="gmCats">${CATS.map(([k, ic, n]) => `<button class="${cat === k ? 'on' : ''}" data-act="cat" data-k="${k}"><span>${ic}</span>${n}<small>${k === 'all' ? all.length : all.filter((x) => x.cat === k).length}</small></button>`).join('')}</div>
          <div class="gmBar"><input id="gmQ" placeholder="ค้นหาไอเทม (ชื่อ / id)" value="${esc(o.q || '')}"><span class="hint">ระดับอุปกรณ์:</span>${D.RARITY.map((r, i) => `<button class="rdot ${rar === i ? 'on' : ''}" style="--c:${r.color}" data-act="rar" data-i="${i}" title="${r.n}"></button>`).join('')}</div>
          <div class="gmSplit"><div class="gmGrid scrollKeep">${list.slice(0, 600).map((x) => `<div class="gcell ${sel && sel.key === x.key ? 'on' : ''}" data-act="sel" data-k="${esc(x.key)}" title="${esc(x.name)}"><img src="${icon(x)}"></div>`).join('')}</div>
          <div class="gmDetail">${sel ? `<div class="gdHead"><img src="${icon(sel)}"><div><b>${esc(sel.name)}</b><small>${esc(sel.sub)} · Lv ${sel.lv}</small><small><code>${esc(sel.key)}</code></small></div></div>
            <label>ให้กับ ${targetSel(o)}</label>
            ${sel.gear ? `<label>ความหายาก <select id="gmRar">${D.RARITY.map((r, i) => `<option value="${i}" ${rar === i ? 'selected' : ''}>${r.n}</option>`).join('')}</select></label><label>ตีบวก + <input id="gmRef" type="number" min="0" max="20" value="${o.ref || 0}"></label><label>จำนวน <input id="gmQty" type="number" min="1" max="20" value="1"></label><button class="btn gold" data-act="givegear">🎁 เสกอุปกรณ์</button>`
              : `<label>จำนวน <input id="gmQty" type="number" min="1" max="99999" value="${D.ITEMS[sel.key].type === 'potion' ? 100 : 1}"></label><div class="acts"><button class="btn gold" data-act="give">🎁 เสกเข้ากระเป๋า</button><button class="btn" data-act="drop">⬇ วางบนพื้น</button></div><div class="acts">${[1, 10, 100, 999].map((n) => `<button class="btn tiny" data-act="giveN" data-n="${n}">×${n}</button>`).join('')}</div>`}` : ''}
            <hr><label>Zeny <input id="gmZ" type="number" value="1000000"></label><button class="btn tiny" data-act="zeny">💰 ให้ Zeny</button></div></div>`;
      } else if (tab === 'monsters') {
        const biomes = Object.keys(D.FAMILIES); const bi = o.biome || biomes[0];
        const fams = D.FAMILIES[bi]; const sel = fams.find((f) => f[0] === o.mon) || fams[0];
        body = `<div class="gmCats">${biomes.map((b) => `<button class="${bi === b ? 'on' : ''}" data-act="biome" data-k="${b}"><span>🗺</span>${b}<small>${D.FAMILIES[b].length}</small></button>`).join('')}</div>
          <div class="gmSplit"><div><div class="gmGrid mon">${fams.map((f) => `<div class="gcell ${sel[0] === f[0] ? 'on' : ''}" data-act="mon" data-k="${esc(f[0])}" title="${esc(f[0])}"><img src="${monIcon(f, bi)}"><small>${esc(f[0])}</small></div>`).join('')}</div>
            <h4>World Boss</h4><div class="acts">${D.WORLD_BOSSES.map((w, i) => `<button class="btn tiny" data-act="wb" data-i="${i}">🌋 ${esc(w.name)}</button>`).join('')}<button class="btn tiny danger" data-act="wbstop">หยุด World Boss</button></div>
            <h4>สิ่งมีชีวิตใกล้ตัว (${gmData.ents.length})</h4><div class="entList scrollKeep">${gmData.ents.map((e) => `<div><b>${esc(e[2])}</b><small>${e[1] === 'p' ? 'ผู้เล่น' : 'Lv' + e[3]} · HP ${e[4]}% · ${e[5]} ช่อง</small><button class="btn tiny" data-act="ent" data-a="heal" data-id="${e[0]}">ฮีล</button><button class="btn tiny" data-act="ent" data-a="freeze" data-id="${e[0]}">แช่แข็ง</button><button class="btn tiny danger" data-act="ent" data-a="kill" data-id="${e[0]}">ฆ่า</button><button class="btn tiny" data-act="ent" data-a="remove" data-id="${e[0]}">ลบ</button></div>`).join('') || '<small class="hint">ไม่มี</small>'}</div></div>
          <div class="gmDetail"><div class="gdHead"><img src="${monIcon(sel, bi)}"><div><b>${esc(sel[0])}</b><small>รูปร่าง ${sel[1]} · ${sel[2]} · ธาตุ ${sel[4]}</small><small>${sel[3] ? 'ก้าวร้าว' : 'ไม่โจมตีก่อน'}</small></div></div>
            <label>เลเวล <input id="gmMLv" type="number" min="1" max="320" value="${o.mlv || G.char.lv}"></label><label>จำนวน <input id="gmMN" type="number" min="1" max="50" value="${o.mn || 5}"></label>
            <label>ระดับ <select id="gmMR">${['ปกติ', 'Elite', 'บอสสนาม', 'บอสดันเจี้ยน', 'World Boss'].map((n, i) => `<option value="${i}" ${(o.mr | 0) === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <button class="btn gold" data-act="spawn">👾 เสกมอน</button><div class="acts"><button class="btn tiny danger" data-act="cmd" data-c="killall">☠ ฆ่าทั้งแผนที่</button><button class="btn tiny" data-act="cmd" data-c="spawnboss">👹 บอสสุ่ม</button></div></div></div>`;
      } else if (tab === 'char') {
        const sel = gmData.players.find((p) => p.name === o.pl) || gmData.players.find((p) => p.name === G.char.name) || gmData.players[0];
        const a = (c, n, cls = '') => `<button class="btn tiny ${cls}" data-act="pcmd" data-c="${c}">${n}</button>`;
        body = `<div class="gmSplit"><div class="plList scrollKeep">${gmData.players.map((p) => `<div class="${sel && sel.name === p.name ? 'on' : ''}" data-act="pl" data-k="${esc(p.name)}"><img src="${ART.classIcon(p.cls, 26)}"><b>${esc(p.name)}</b><small>Lv${p.lv} · ${esc(p.map)}${p.off ? ' · ออฟไลน์ออโต้' : ''}${p.gm ? ' · GM' + p.gm : ''}</small><span>${p.hp}%</span></div>`).join('')}</div>
          <div class="gmDetail">${sel ? `<div class="gdHead"><img src="${ART.portrait(sel.cls, sel.name, 64)}"><div><b>${esc(sel.name)}</b><small>${D.CLASSES[sel.cls].name} · Lv ${sel.lv} · 💰${fmt(sel.zeny)}</small><small>แผนที่ ${esc(sel.map)} · Karma ${sel.karma}</small></div></div>
            <div class="acts">${a('heal', '❤ ฮีล')}${a('revive', '✚ ชุบ')}${a('goto', '➜ ไปหา')}${a('recall', '⤓ ดึงมา')}${a('kill', '☠ ฆ่า', 'danger')}${a('allskills', '📖 สกิลเต็ม')}${a('passive all', '🌌 Passive เต็ม')}${a('passive reset', '🌌 รีเซ็ต Tree')}${a('resetskill', '📖 รีเซ็ตสกิล')}</div>
            <label>เปลี่ยนคลาส <select id="gmCls">${D.CLASS_IDS.map((c) => `<option value="${c}" ${c === sel.cls ? 'selected' : ''}>${D.CLASSES[c].name} · ${D.CLASSES[c].th}</option>`).join('')}</select><button class="btn tiny" data-act="setcls">เปลี่ยน</button><button class="btn tiny" data-act="setcls2">เปลี่ยน + สกิลเต็ม</button></label>
            <label>ตั้งเลเวล <input id="gmLv" type="number" min="1" max="250" value="${sel.lv}"><button class="btn tiny" data-act="setlv">ตั้ง</button><button class="btn tiny" data-act="lvup">+10</button></label>
            <label>Zeny <input id="gmZ2" type="number" value="1000000"><button class="btn tiny" data-act="pz">ให้</button></label>
            <label>แต้มสกิล <input id="gmSP" type="number" value="10"><button class="btn tiny" data-act="psp">ให้</button> แต้ม Passive <input id="gmPP" type="number" value="10"><button class="btn tiny" data-act="ppp">ให้</button></label>
            <h4>การลงโทษ</h4><div class="acts">${a('mute', '🔇 ห้ามแชท 10น.')}${a('unmute', '🔊 ยกเลิก')}${a('jail', '🔒 คุก 30น.')}${a('unjail', '🔓 ปล่อย')}${a('kick', '⏏ เตะ', 'danger')}${a('ban', '⛔ แบน 1 วัน', 'danger')}</div>` : '<p class="hint">ไม่มีผู้เล่นออนไลน์</p>'}</div></div>`;
      } else if (tab === 'charplus') {
        const sel = gmData.players.find((p) => p.name === o.pl) || gmData.players.find((p) => p.name === G.char.name);
        body = `<p class="hint">เป้าหมาย: <b>${esc(sel ? sel.name : G.char.name)}</b> (เลือกในแท็บตัวละคร)</p>
          <h4>โบนัสสเตตัส (บวกเพิ่มจากค่าที่โตอัตโนมัติ)</h4><div class="statEdit">${D.STATS.map((s) => `<label>${s.toUpperCase()} <input type="number" data-stat="${s}" value="${(G.char.name === (sel || {}).name && G.char.statBonus && G.char.statBonus[s]) || 0}"></label>`).join('')}<button class="btn gold tiny" data-act="stats">บันทึกสเตตัส</button></div>
          <h4>ตัวเอง</h4><div class="acts"><button class="btn tiny" data-act="cmd" data-c="god">🛡 อมตะ</button><button class="btn tiny" data-act="cmd" data-c="hide">👻 ล่องหน</button>${[1, 2, 3, 5].map((n) => `<button class="btn tiny" data-act="cmd" data-c="speed ${n}">⚡ ×${n}</button>`).join('')}</div>
          <h4>อื่นๆ</h4><label>ฉายา <input id="gmTitle" placeholder="ข้อความเหนือหัว"><button class="btn tiny" data-act="title">ตั้ง</button></label>
          <label>Karma <input id="gmKarma" type="number" value="0"><button class="btn tiny" data-act="karma">ตั้ง</button> MMR <input id="gmMmr" type="number" value="1500"><button class="btn tiny" data-act="mmr">ตั้ง</button></label>
          <label>GM Level (บัญชี) <input id="gmLevel" type="number" min="0" max="5" value="0"><button class="btn tiny" data-act="gmset">ตั้ง</button></label>
          <h4>สัตว์เลี้ยง / พาหนะ</h4><div class="acts">${Object.keys(D.PETS).map((k) => `<button class="btn tiny" data-act="cmd" data-c="pet ${k} 30">🐾 ${D.PETS[k].n}</button>`).join('')}</div><div class="acts">${Object.keys(D.MOUNTS).map((k) => `<button class="btn tiny" data-act="cmd" data-c="mount ${k}">🐎 ${D.MOUNTS[k].n}</button>`).join('')}</div>`;
      } else if (tab === 'world') {
        const R = gmData.rates || {}, fl = gmData.flags || {};
        body = `<h4>เรทเซิร์ฟเวอร์</h4><div class="rates2">${['exp', 'drop', 'refine'].map((k) => `<label>${k.toUpperCase()} ×<input type="number" step="0.5" min="0.1" max="100" data-rate="${k}" value="${R[k] || 1}"></label>`).join('')}<button class="btn gold tiny" data-act="rates">บันทึกเรท</button></div>
          <div class="acts">${['doubleexp', 'doubledrop', 'refine'].map((e) => `<button class="btn tiny" data-act="cmd" data-c="event start ${e}">🎉 ${e}</button><button class="btn tiny" data-act="cmd" data-c="event stop ${e}">หยุด</button>`).join('')}</div>
          <h4>แผนที่ปัจจุบัน: ${esc(gmData.map || '')}</h4><div class="acts"><button class="btn tiny" data-act="cmd" data-c="pvp ${fl.pvp ? 'off' : 'on'}">PvP: ${fl.pvp === undefined ? 'ค่าเริ่มต้น' : fl.pvp ? 'เปิด' : 'ปิด'}</button><button class="btn tiny" data-act="cmd" data-c="auto ${fl.noAuto ? 'on' : 'off'}">ออโต้: ${fl.noAuto ? 'ห้าม' : 'อนุญาต'}</button>${['none', 'rain', 'snow', 'ash', 'petals'].map((w) => `<button class="btn tiny" data-act="cmd" data-c="weather ${w}">${{ none: '☀', rain: '🌧', snow: '❄', ash: '🌋', petals: '🌸' }[w]} ${w}</button>`).join('')}</div>
          <h4>กิจกรรมใหญ่</h4><div class="acts"><button class="btn tiny" data-act="cmd" data-c="worldboss start">🌋 World Boss (${gmData.wb ? 'อยู่' : 'ไม่มี'})</button><button class="btn tiny" data-act="cmd" data-c="gvg start 30">⚔ เริ่มกิลด์วอร์ 30 นาที (${gmData.gvg ? 'LIVE' : 'ปิด'})</button><button class="btn tiny" data-act="cmd" data-c="gvg stop">หยุดวอร์</button></div>
          <div class="castleList">${gmData.castles.map((c) => `<span class="chip">${esc(c[0])}: ${esc(c[1])}</span>`).join('')}</div>
          <h4>Field Boss</h4><div class="bossList scrollKeep">${gmData.bosses.map((b) => `<div><span>${esc(b[0])}</span><em>${b[1] < 0 ? 'อยู่' : Math.ceil(b[1] / 60) + ' นาที'}</em><button class="btn tiny" data-act="cmd" data-c="bosstimer ${b[0]} 0">เกิดเลย</button></div>`).join('') || '<small class="hint">ยังไม่มีแผนที่ฟาร์มที่ถูกโหลด</small>'}</div>
          <h4>ประกาศ & เซิร์ฟเวอร์</h4><div class="gmLine"><input id="gmAnn" placeholder="ข้อความประกาศทั้งเซิร์ฟ"><button class="btn gold tiny" data-act="ann">📢 ประกาศ</button></div>
          <div class="acts"><button class="btn tiny" data-act="cmd" data-c="save">💾 บันทึก</button><button class="btn tiny" data-act="cmd" data-c="recallall">⤓ ดึงทุกคน</button><button class="btn tiny danger" data-act="cmd" data-c="maintenance 5">🛠 ปิดปรับปรุง 5 นาที</button></div>
          <small class="hint">บัญชี ${gmData.accounts || 0} · ตัวละคร ${gmData.chars || 0} · ออนไลน์ ${gmData.players.length}</small>`;
      } else {
        body = `<div class="gmLine"><input id="gmIn" placeholder="พิมพ์คำสั่ง เช่น warp golden_dunes / spawnx wolf 5 80 1 / gearx weapon - 9 5 20"><button class="btn gold" data-act="run">Run</button></div>
          <pre id="gmOut" class="gmOut">GM Lv ${G.char.gm} — ทุกคำสั่งถูกบันทึกใน audit log</pre>
          <div class="gmList scrollKeep">${(G.gmList || []).map((c) => `<div data-act="fill" data-c="${esc(c.usage.replace(/^@/, '').split(' ')[0])}"><code>${esc(c.usage)}</code><span>${esc(c.desc)}</span><em>Lv${c.lv}</em></div>`).join('')}</div>`;
      }
      return `<div class="tabs gmTabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}<button class="btn tiny" data-act="refresh">⟳</button></div>${body}`;
    },
    act(a, d) {
      const w = UI.wins.gm, o = w.opts;
      const v = (id) => ($('#' + id) || {}).value;
      const re = () => UI.renderWin('gm');
      const pl = () => (gmData.players.find((p) => p.name === o.pl) || {}).name || G.char.name;
      switch (a) {
        case 'tab': o.tab = d.k; re(); break;
        case 'setcls': case 'setcls2': { const n = pl(); gm(`setclass ${v('gmCls')} ${n}`); if (a === 'setcls2') setTimeout(() => gm(`allskills ${n}`), 300); refresh(); break; }
        case 'refresh': gm('gmdata'); break;
        case 'cat': o.cat = d.k; o.sel = null; re(); break;
        case 'rar': o.rar = +d.i; re(); break;
        case 'sel': o.sel = d.k; o.tgt = v('gmTgt') || o.tgt; re(); break;
        case 'give': case 'giveN': { const x = itemCatalog().find((i) => i.key === o.sel) || itemCatalog().filter((i) => (o.cat || 'all') === 'all' || i.cat === o.cat)[0]; gm(`item ${x.key} ${a === 'giveN' ? d.n : v('gmQty') || 1}${tgtArg()}`); break; }
        case 'drop': { const x = itemCatalog().find((i) => i.key === o.sel); if (x) gm(`drop ${x.key} ${v('gmQty') || 1}`); break; }
        case 'givegear': { const x = itemCatalog().find((i) => i.key === o.sel); if (!x || !x.gear) break; o.ref = +v('gmRef') || 0; const n = Math.max(1, Math.min(20, +v('gmQty') || 1)); for (let i = 0; i < n; i++) gm(`gearx ${x.gear.slot} ${x.gear.wtype || '-'} ${x.gear.tier} ${v('gmRar')} ${o.ref}${tgtArg()}`); break; }
        case 'zeny': gm(`zeny ${v('gmZ')}${tgtArg()}`); break;
        case 'biome': o.biome = d.k; o.mon = null; re(); break;
        case 'mon': o.mon = d.k; re(); break;
        case 'spawn': { const bi = o.biome || Object.keys(D.FAMILIES)[0]; const f = D.FAMILIES[bi].find((x) => x[0] === o.mon) || D.FAMILIES[bi][0]; o.mlv = v('gmMLv'); o.mn = v('gmMN'); o.mr = +v('gmMR'); gm(`spawnx ${f[0].replace(/ /g, '')} ${o.mn} ${o.mlv} ${o.mr}`); refresh(); break; }
        case 'wb': gm(`worldboss start ${d.i}`); break;
        case 'wbstop': gm('worldboss stop'); break;
        case 'ent': gm(`ent ${d.a} ${d.id}`); refresh(); break;
        case 'cmd': gm(d.c); refresh(); break;
        case 'pl': o.pl = d.k; re(); break;
        case 'pcmd': { const c = d.c, n = pl(); const map = { mute: `mute ${n} 10`, unmute: `unmute ${n}`, jail: `jail ${n} 30`, unjail: `unjail ${n}`, kick: `kick ${n}`, ban: `ban ${n} 1 GM panel`, goto: `goto ${n}`, recall: `recall ${n}`, kill: `kill ${n}` }; gm(map[c] || `${c} ${n}`); refresh(); break; }
        case 'setlv': gm(`setlv ${v('gmLv')} ${pl()}`); refresh(); break;
        case 'lvup': gm(`lvup 10 ${pl()}`); refresh(); break;
        case 'pz': gm(`zeny ${v('gmZ2')} ${pl()}`); refresh(); break;
        case 'psp': gm(`skillpoint ${v('gmSP')} ${pl()}`); break;
        case 'ppp': gm(`passive points ${v('gmPP')} ${pl()}`); break;
        case 'stats': for (const el of document.querySelectorAll('[data-stat]')) gm(`stat ${el.dataset.stat} ${el.value || 0} ${pl()}`); break;
        case 'title': gm(`title ${pl()} ${v('gmTitle')}`); break;
        case 'karma': gm(`karma ${v('gmKarma')} ${pl()}`); break;
        case 'mmr': gm(`mmr ${v('gmMmr')} ${pl()}`); break;
        case 'gmset': gm(`gmset ${pl()} ${v('gmLevel')}`); break;
        case 'rates': for (const el of document.querySelectorAll('[data-rate]')) gm(`rate ${el.dataset.rate} ${el.value}`); refresh(); break;
        case 'ann': gm(`announce ${v('gmAnn')}`); break;
        case 'run': { const c = v('gmIn'); if (c) gm(c.replace(/^@/, '')); break; }
        case 'fill': { const i = $('#gmIn'); i.value = d.c + ' '; i.focus(); break; }
      }
    },
    input(t) { if (t.id === 'gmQ') { const w = UI.wins.gm; w.opts.q = t.value; const pos = t.selectionStart; UI.renderWin('gm'); const n = $('#gmQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } },
    change(t) { if (t.id === 'gmTgt') UI.wins.gm.opts.tgt = t.value; }
  };
  setInterval(() => { if (UI.open.includes('gm') && ['monsters', 'char', 'world'].includes((UI.wins.gm.opts || {}).tab)) gm('gmdata'); }, 4000);

  // ---------------------------------------------------------------- training ground DPS meter
  const hits = [];
  UI.onHit = function (f) { if (f.s === G.me && !f.h && G.info && G.info.kind === 'training') hits.push([performance.now(), f.d]); };
  setInterval(() => {
    let el = $('#dps');
    const on = G.info && G.info.kind === 'training' && !$('#hud').hidden;
    if (!on) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'dps'; el.className = 'glass'; $('#hud').appendChild(el); el.addEventListener('click', (e) => { if (e.target.dataset.r) hits.length = 0; }); }
    el.hidden = false;
    const now = performance.now();
    while (hits.length && now - hits[0][0] > 60000) hits.shift();
    const sum = (ms) => hits.filter((h) => now - h[0] <= ms).reduce((a, h) => a + h[1], 0);
    const total = hits.reduce((a, h) => a + h[1], 0), span = hits.length ? Math.max(1, (now - hits[0][0]) / 1000) : 1;
    el.innerHTML = `<b>🎯 มิเตอร์ดาเมจ</b><div><span>DPS (5 วิ)</span><em>${fmt(sum(5000) / 5)}</em></div><div><span>DPS เฉลี่ย</span><em>${fmt(total / span)}</em></div><div><span>ดาเมจรวม (60 วิ)</span><em>${fmt(total)}</em></div><div><span>จำนวนฮิต</span><em>${hits.length}</em></div><button class="btn tiny" data-r="1">รีเซ็ต</button><small class="hint">หุ่นฟื้น HP เมื่อหยุดตี 4 วินาที · มีหุ่นบอสและหุ่นธาตุสำหรับทดสอบ</small>`;
  }, 500);
})();

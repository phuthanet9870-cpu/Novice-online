// Monster Book (bestiary + drop tables), gear crafting (Legendary / Mythic), gear previews, extra GM pages.
(function () {
  const D = NO_DATA, F = NO_F;
  const WIN = UI.WIN, esc = UI.esc, fmt = UI.fmt;
  const $ = (s) => document.querySelector(s);
  const cnt = (id) => (G.char ? G.char.inv.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0) : 0);
  const prevRng = () => { let s = 7; return Object.assign(() => ((s = (s * 16807) % 2147483647) / 2147483647), { int: (a, b) => a + Math.floor(((s = (s * 16807) % 2147483647) / 2147483647) * (b - a + 1)), pick: (l) => l[(s = (s * 16807) % 2147483647) % l.length] }); };

  // "baseId:rarity:ilv" → a sample instance for tooltips (options are an example roll)
  const prevCache = new Map();
  UI.gearPreview = function (key) {
    if (prevCache.has(key)) return prevCache.get(key);
    const [id, rar, ilv] = key.split(':');
    const b = D.GEAR[id]; if (!b) return null;
    const it = F.genFromBase(prevRng(), id, +rar, +ilv || b.ilv || G.char.lv);
    it.uid = 'preview:' + key; it.preview = 1;
    prevCache.set(key, it); return it;
  };
  const gearIcon = (id, rar) => { const b = D.GEAR[id]; return ART.itemIcon({ type: 'equip', slot: b.slot === 'ring' ? 'ring' : b.slot, wtype: b.wtype, rarity: rar, base: id }); };
  const dropIcon = (id) => (id.startsWith('gear:') ? gearIcon(id.slice(5), D.GEAR[id.slice(5)].maxR) : ART.itemIcon({ id }));
  const dropName = (id) => (id.startsWith('gear:') ? D.GEAR[id.slice(5)].n : D.ITEMS[id].n);
  const dropAttr = (id, sp) => (id.startsWith('gear:') ? `data-gear="${id.slice(5)}:${D.GEAR[id.slice(5)].maxR}:${(sp && sp.lv) || D.GEAR[id.slice(5)].ilv || 1}"` : `data-itemid="${id}"`);
  const pct = (c) => (c >= 10 ? c.toFixed(0) : c >= 1 ? c.toFixed(1) : c >= 0.1 ? c.toFixed(2) : c.toFixed(3)) + '%';

  // monster portraits
  const monCache = new Map();
  ART.speciesIcon = function (sp, size = 56) {
    const k = sp.id + size; if (monCache.has(k)) return monCache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const bg = g.createRadialGradient(size / 2, size * 0.6, 2, size / 2, size / 2, size * 0.7);
    bg.addColorStop(0, '#2c3044'); bg.addColorStop(1, '#141622'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const s = size / 56;
    const bossIm = sp.spr && ART.bossImage(sp.spr);
    if (bossIm) { const A = BOSS_ART[sp.spr], fh = A.ch, sc = size / fh * 1.15; g.imageSmoothingEnabled = false; g.drawImage(bossIm, 0, A.a.idle[0] * A.ch, A.cw, A.ch, size / 2 - A.cw * sc / 2, size - A.ch * sc * 0.95, A.cw * sc, A.ch * sc); }
    else { g.save(); g.scale(s, s); ART.drawMonster(g, { sh: sp.shape, col: sp.color, sz: sp.rank >= 2 ? 0.9 : 1.1, rk: sp.rank || 0, id: 1, el: sp.element }, 28, 50, 0); g.restore(); }
    const u = c.toDataURL(); if (!sp.spr || bossIm) monCache.set(k, u); return u;
  };

  // ---------------------------------------------------------------- Monster Book
  const BOOK_TABS = [...D.REGIONS.map((r) => [r.id, r.n]), ['dungeon', 'ดันเจี้ยน'], ['world', 'World Boss']];
  const KIND_TH = { field: 'มอนสนาม', fieldboss: 'Field Boss', dungeon: 'มอนดันเจี้ยน', dboss: 'บอสดันเจี้ยน', world: 'World Boss' };
  WIN.book = {
    title: '📕 สมุดมอนสเตอร์ (Monster Book)', w: 940,
    onOpen() { G.send({ t: 'book' }); },
    render(o) {
      const tab = o.tab || 'aurelia', q = (o.q || '').toLowerCase().trim();
      const book = (G.char && G.char.book) || {};
      let list = Object.values(D.SPECIES).filter((s) => (q ? true : s.region === tab));
      if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.where.toLowerCase().includes(q) || D.dropTable(s.id).some(([id]) => dropName(id).toLowerCase().includes(q)));
      const sel = D.SPECIES[o.sel] && list.includes(D.SPECIES[o.sel]) ? D.SPECIES[o.sel] : list[0];
      const total = Object.keys(D.SPECIES).length, seen = Object.keys(book).filter((k) => D.SPECIES[k]).length;
      let detail = '<p class="hint">ไม่พบมอนสเตอร์</p>';
      if (sel) {
        const drops = D.dropTable(sel.id);
        const el = D.ELEMENTS[sel.element] || D.ELEMENTS.neutral;
        const groups = [['วัตถุดิบ / ขยะ / การ์ด', drops.filter(([id]) => !id.startsWith('gear:') && ['loot', 'junk', 'card'].includes(D.ITEMS[id].type))],
          ['อุปกรณ์', drops.filter(([id]) => id.startsWith('gear:'))],
          ['ซัพพอร์ต / ของขาย / กล่อง / ตีบวก', drops.filter(([id]) => !id.startsWith('gear:') && !['loot', 'junk', 'card'].includes(D.ITEMS[id].type))]];
        const maxR = drops.filter(([id]) => id.startsWith('gear:')).reduce((a, [id]) => Math.max(a, D.GEAR[id.slice(5)].maxR), 0);
        detail = `<div class="bkHead"><img src="${ART.speciesIcon(sel, 96)}"><div><b>${esc(sel.name)}</b>
            <small>${KIND_TH[sel.kind]} · Lv ${sel.lv}${sel.lvMax !== sel.lv ? '–' + sel.lvMax : ''} · <span style="color:${el.color}">ธาตุ ${esc(el.n || sel.element)}</span> · ${esc(sel.shape)}</small>
            <small>📍 ${esc(sel.where)}</small>
            <small>กำจัดแล้ว <b>${fmt(book[sel.id] || 0)}</b> ตัว · ดรอปอุปกรณ์สูงสุด <b style="color:${D.RARITY[maxR].color}">${D.RARITY[maxR].n}</b></small>
            ${G.char.gm ? `<div class="acts"><button class="btn tiny" data-act="gmspawn" data-k="${sel.id}">👾 GM: เสก 5 ตัว</button><button class="btn tiny" data-act="gmspawn1" data-k="${sel.id}">เสก 1 ตัว</button></div>` : ''}</div></div>
          ${groups.map(([n, g]) => g.length ? `<h4>${n}</h4><div class="bkDrops">${g.map(([id, c, qn]) => `<div class="bkDrop" ${dropAttr(id, sel)}><img src="${dropIcon(id)}"><span style="${id.startsWith('gear:') ? 'color:' + D.RARITY[D.GEAR[id.slice(5)].maxR].color : ''}">${esc(dropName(id))}${qn > 1 ? ' ×' + qn : ''}</span><em>${pct(c)}</em></div>`).join('')}</div>` : '').join('')}
          <small class="hint">อัตราดรอปพื้นฐาน · Elite ×3 · เพิ่มตาม LUK / อัตราดรอป / เรทเซิร์ฟ · มอนธรรมดาดรอปได้สูงสุด Epic — Legendary มาจากดันเจี้ยน/บอส/คราฟต์ และ Mythic จาก World Boss/คราฟต์</small>`;
      }
      return `<div class="tabs">${BOOK_TABS.map(([k, n]) => `<button class="${!q && tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${esc(n)}</button>`).join('')}</div>
        <div class="gmBar"><input id="bookQ" placeholder="ค้นหามอนสเตอร์ / แผนที่ / ไอเทมที่ต้องการ (เช่น Card, Fang, Sword)" value="${esc(o.q || '')}"><span class="hint">ค้นพบ ${seen}/${total}</span></div>
        <div class="bkSplit"><div class="bkList scrollKeep">${list.map((s) => `<div class="bkMon ${sel && sel.id === s.id ? 'on' : ''} ${book[s.id] ? '' : 'unseen'}" data-act="sel" data-k="${s.id}"><img src="${ART.speciesIcon(s)}"><div><b>${esc(s.name)}</b><small>Lv${s.lv} · ${esc(KIND_TH[s.kind])}</small><small>${esc(s.where)}</small></div>${book[s.id] ? `<em>${fmt(book[s.id])}</em>` : ''}</div>`).join('')}</div>
        <div class="bkDetail scrollKeep">${detail}</div></div>`;
    },
    act(a, d) {
      const o = UI.wins.book.opts;
      if (a === 'tab') { o.tab = d.k; o.q = ''; o.sel = null; UI.renderWin('book'); }
      if (a === 'sel') { o.sel = d.k; UI.renderWin('book'); }
      if (a === 'gmspawn') G.send({ t: 'gm', cmd: `spawnsp ${d.k} 5` });
      if (a === 'gmspawn1') G.send({ t: 'gm', cmd: `spawnsp ${d.k} 1` });
    },
    input(t) { if (t.id === 'bookQ') { const o = UI.wins.book.opts; o.q = t.value; const pos = t.selectionStart; UI.renderWin('book'); const n = $('#bookQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } }
  };

  // ---------------------------------------------------------------- crafting: items, regional Legendary, Mythic, tokens
  const baseCraft = WIN.craft;
  const icon = (id) => `<img src="${ART.itemIcon({ id })}" data-itemid="${id}">`;
  WIN.craft = {
    title: '⚗ คราฟต์ & แลกโทเคน', w: 820,
    render(o) {
      const tab = o.tab || 'craft';
      if (tab === 'token') return baseCraft.render(o).replace(/<div class="tabs">[\s\S]*?<\/div>/, tabs(tab));
      const rows = D.RECIPES.map((r, i) => [r, i]).filter(([r]) => (tab === 'craft' ? !r.out.startsWith('gear:') : tab === 'legendary' ? r.cat === 'legendary' && (!o.reg || r.region === o.reg) : r.cat === 'mythic'));
      const reqHtml = (r) => r.req.map(([id, q]) => `<span class="${cnt(id) >= q ? 'ok' : 'bad'}" data-itemid="${id}">${esc(D.ITEMS[id].n)} ${cnt(id)}/${q}</span>`).join(' · ');
      const body = rows.map(([r, i]) => {
        const ok = r.req.every(([id, q]) => cnt(id) >= q) && G.char.zeny >= r.zeny && G.char.lv >= r.lv;
        const gear = r.out.startsWith('gear:') ? r.out.slice(5) : null;
        const ic = gear ? `<img src="${gearIcon(gear, r.rar)}" data-gear="${gear}:${r.rar}:${r.ilv}">` : icon(r.out);
        const nm = gear ? `<b style="color:${D.RARITY[r.rar].color}">${esc(D.GEAR[gear].n)}</b> <small>[${D.RARITY[r.rar].n}] ${D.SLOT_TH[D.GEAR[gear].slot] || D.GEAR[gear].slot}${D.GEAR[gear].wtype ? ' · ' + D.GEAR[gear].wtype : ''} · iLv ${r.ilv}</small>` : `<b>${esc(D.ITEMS[r.out].n)} ×${r.q}</b>`;
        return `<div class="recipe ${ok ? '' : 'dim'}">${ic}<div>${nm}<small>${reqHtml(r)} · 💰${fmt(r.zeny)}${r.lv > 1 ? ' · Lv' + r.lv : ''}</small></div><button class="btn gold tiny" data-act="craft" data-i="${i}" data-n="1" ${ok ? '' : 'disabled'}>คราฟต์</button>${gear ? '' : `<button class="btn tiny" data-act="craft" data-i="${i}" data-n="10" ${ok ? '' : 'disabled'}>×10</button>`}</div>`;
      }).join('');
      const regBar = tab === 'legendary' ? `<div class="gmBar">${[['', 'ทุกภูมิภาค'], ...D.REGIONS.map((r) => [r.id, r.n])].map(([k, n]) => `<button class="btn tiny ${(o.reg || '') === k ? 'gold' : ''}" data-act="reg" data-k="${k}">${esc(n)}</button>`).join('')}</div>` : '';
      const hint = tab === 'craft' ? 'วัตถุดิบทั่วไปดรอปจากมอนทุกตัว · Rough Ore / Crystal Shard / Divine Shard ใช้หลอมของตีบวก' : tab === 'legendary' ? 'Legendary ประจำภูมิภาค: ใช้ "ถ้วยรางวัล Pristine" ของมอนในภูมิภาคนั้น + Sovereign Crest จาก Field Boss (ดูว่าใครดรอปได้ใน 📕 สมุดมอนสเตอร์)' : 'Mythic: ต้องใช้ถ้วยรางวัลจากทุกภูมิภาค + Guardian Sigil จากบอสดันเจี้ยน + วัตถุดิบ World Boss';
      return `${tabs(tab)}${regBar}<div class="shopList scrollKeep">${body}</div><p class="hint">${hint}</p>`;
    },
    act(a, d) {
      const w = UI.wins.craft;
      if (a === 'tab') { w.opts.tab = d.k; UI.renderWin('craft'); return; }
      if (a === 'reg') { w.opts.reg = d.k; UI.renderWin('craft'); return; }
      if (a === 'craft') { G.send({ t: 'craft', i: +d.i, n: +d.n }); return; }
      baseCraft.act(a, d);
    }
  };
  function tabs(tab) { return `<div class="tabs">${[['craft', '⚗ ไอเทม'], ['legendary', '🟧 Legendary'], ['mythic', '🟥 Mythic'], ['token', '★ แลกโทเคน']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>`; }

  // ---------------------------------------------------------------- GM: modes, named gear catalog, species spawner
  const gmWin = WIN.gm, gmRender = gmWin.render, gmAct = gmWin.act;
  const EXTRA = [['mode', '👑 โหมด GM'], ['gear', '🗡 อุปกรณ์ชื่อ'], ['species', '📕 มอนตามสมุด']];
  const gm = (c) => G.send({ t: 'gm', cmd: c });
  const MODES = [['god', '🛡 อมตะ', 'ไม่ตาย ไม่รับดาเมจ'], ['nocd', '⏱ ไม่มีคูลดาวน์', 'ใช้สกิลซ้ำได้ทันที'], ['nosp', '💧 ไม่ใช้ SP/เกจ', 'ไม่ใช้ SP, อัลติใช้ได้ตลอด'], ['nocast', '⚡ ร่ายทันที', 'ไม่มีเวลาร่าย'],
    ['onehit', '☠ ตีทีเดียวตาย', 'ทุกการโจมตีฆ่าเป้าหมาย (ยกเว้น GM ระดับเท่า/สูงกว่า)'], ['peace', '🕊 มอนไม่โจมตี', 'มอนสเตอร์ไม่สนใจตัวละครนี้'], ['autoloot', '🧲 เก็บของอัตโนมัติ', 'ของที่ดรอปเข้ากระเป๋าทันที']];
  gmWin.render = function (o) {
    const tab = o.tab || 'items';
    const head = (html) => html.replace('<button class="btn tiny" data-act="refresh">', EXTRA.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('') + '<button class="btn tiny" data-act="refresh">');
    if (!EXTRA.some(([k]) => k === tab)) return head(gmRender(o));
    const shell = head(gmRender(Object.assign({}, o, { tab: 'console' })));
    const hdr = shell.slice(0, shell.indexOf('</div>') + 6).replace(/class="on"/g, '');
    let body = '';
    if (tab === 'mode') {
      const f = G.char.gmf || {};
      body = `<p class="hint">โหมดเหล่านี้มีผลกับตัวละคร GM ของคุณเท่านั้น (บันทึกกับตัวละคร, ผู้เล่นทั่วไปใช้ไม่ได้)</p>
        <div class="gmModes">${MODES.map(([k, n, dsc]) => `<button class="gmMode ${f[k] ? 'on' : ''}" data-act="mode" data-k="${k}"><b>${n}</b><small>${dsc}</small><em>${f[k] ? 'เปิด' : 'ปิด'}</em></button>`).join('')}</div>
        <div class="acts"><button class="btn gold" data-act="mode" data-k="all">เปิดทั้งหมด</button><button class="btn" data-act="mode" data-k="off">ปิดทั้งหมด</button></div>
        <label>ตัวคูณดาเมจ × <input id="gmDmg" type="number" min="0.1" max="10000" step="0.5" value="${f.dmg || 1}"><button class="btn tiny" data-act="dmg">ตั้ง</button></label>
        <h4>ด่วน</h4><div class="acts">${[['cdreset', '⏱ รีเซ็ตคูลดาวน์'], ['heal', '❤ ฮีลเต็ม'], ['hide', '👻 ล่องหน'], ['pickupall', '🧲 เก็บของทั้งแผนที่'], ['clearground', '🧹 ล้างของบนพื้น'], ['respawnmap', '♻ เกิดมอนใหม่ทันที'], ['killall', '☠ ฆ่ามอนทั้งแผนที่'], ['buffall', '✨ บัฟทุกคน']].map(([c, n]) => `<button class="btn tiny" data-act="cmd" data-c="${c}">${n}</button>`).join('')}${[1, 2, 3, 5, 8].map((n) => `<button class="btn tiny" data-act="cmd" data-c="speed ${n}">🏃 ×${n}</button>`).join('')}</div>`;
    } else if (tab === 'gear') {
      const src = o.gsrc || 'field', q = (o.gq || '').toLowerCase();
      const all = Object.values(D.GEAR).filter((g) => g.src === src && (!q || g.n.toLowerCase().includes(q) || g.id.includes(q) || (g.wtype || g.slot).includes(q)));
      const rar = o.grar === undefined ? (src === 'field' ? 3 : src === 'mythic' ? 5 : 4) : o.grar;
      const sel = D.GEAR[o.gsel] || all[0];
      body = `<div class="gmBar">${[['field', 'สนาม (C–Epic)'], ['dungeon', 'ดันเจี้ยน (Legendary)'], ['craft', 'คราฟต์ (Legendary)'], ['mythic', 'Mythic']].map(([k, n]) => `<button class="btn tiny ${src === k ? 'gold' : ''}" data-act="gsrc" data-k="${k}">${n} (${Object.values(D.GEAR).filter((g) => g.src === k).length})</button>`).join('')}<input id="gmGQ" placeholder="ค้นหา" value="${esc(o.gq || '')}"></div>
        <div class="gmSplit"><div class="gmGrid scrollKeep">${all.slice(0, 500).map((g) => `<div class="gcell ${sel && sel.id === g.id ? 'on' : ''}" data-act="gsel" data-k="${g.id}" data-gear="${g.id}:${Math.max(g.minR || 0, Math.min(g.maxR, rar))}:${g.ilv || G.char.lv}"><img src="${gearIcon(g.id, Math.max(g.minR || 0, Math.min(g.maxR, rar)))}"></div>`).join('')}</div>
        <div class="gmDetail">${sel ? `<div class="gdHead"><img src="${gearIcon(sel.id, rar)}"><div><b>${esc(sel.n)}</b><small>${esc(sel.wtype || sel.slot)} · ${esc(sel.src)} · <code>${sel.id}</code></small></div></div>
          <label>ความหายาก <select id="gmGR">${D.RARITY.map((r, i) => `<option value="${i}" ${rar === i ? 'selected' : ''}>${r.n}</option>`).join('')}</select></label>
          <label>iLv <input id="gmGI" type="number" min="1" max="300" value="${sel.ilv || G.char.lv}"></label><label>ตีบวก + <input id="gmGRef" type="number" min="0" max="20" value="0"></label>
          <button class="btn gold" data-act="gmake">🎁 เสกเข้ากระเป๋า</button>` : ''}</div></div>`;
    } else {
      const reg = o.sreg || 'aurelia';
      const list = Object.values(D.SPECIES).filter((s) => s.region === reg);
      body = `<div class="gmBar">${[...D.REGIONS.map((r) => [r.id, r.n]), ['dungeon', 'ดันเจี้ยน'], ['world', 'World Boss']].map(([k, n]) => `<button class="btn tiny ${reg === k ? 'gold' : ''}" data-act="sreg" data-k="${k}">${esc(n)}</button>`).join('')}</div>
        <label>จำนวน <input id="gmSN" type="number" min="1" max="50" value="${o.sn || 5}"></label>
        <div class="gmGrid mon scrollKeep">${list.map((s) => `<div class="gcell" data-act="sspawn" data-k="${s.id}" title="${esc(s.name)} · ${esc(s.where)}"><img src="${ART.speciesIcon(s)}"><small>${esc(s.name)}</small></div>`).join('')}</div>
        <p class="hint">คลิกเพื่อเสกที่ตำแหน่งตัวเอง — มอนที่เสกจะดรอปตามตารางในสมุดมอนสเตอร์</p>`;
    }
    return hdr + body;
  };
  gmWin.act = function (a, d) {
    const o = UI.wins.gm.opts, re = () => UI.renderWin('gm'), v = (id) => ($('#' + id) || {}).value;
    switch (a) {
      case 'mode': gm('gmmode ' + d.k); setTimeout(re, 300); return;
      case 'dmg': gm('gmmode dmg ' + (v('gmDmg') || 1)); setTimeout(re, 300); return;
      case 'gsrc': o.gsrc = d.k; o.gsel = null; o.grar = undefined; re(); return;
      case 'gsel': o.gsel = d.k; re(); return;
      case 'gmake': gm(`gearb ${o.gsel || Object.values(D.GEAR).find((g) => g.src === (o.gsrc || 'field')).id} ${v('gmGR')} ${v('gmGI')} +${v('gmGRef') || 0}`); return;
      case 'sreg': o.sreg = d.k; re(); return;
      case 'sspawn': o.sn = +v('gmSN') || 5; gm(`spawnsp ${d.k} ${o.sn}`); return;
    }
    gmAct(a, d);
  };
  const gmInput = gmWin.input;
  gmWin.input = function (t) {
    if (t.id === 'gmGQ') { const o = UI.wins.gm.opts; o.gq = t.value; const pos = t.selectionStart; UI.renderWin('gm'); const n = $('#gmGQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
    if (gmInput) gmInput(t);
  };
})();

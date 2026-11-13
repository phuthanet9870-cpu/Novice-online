// HUD v2: grouped & labelled menu dock, annotated HUD guide, signature-mechanic chips on skill tooltips.
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------------------------------------------------------------- signature mechanic chips
  const MECH = {
    echo: (v) => ['🔁', 'สะท้อนซ้ำ', `ตีซ้ำอีกครั้งหลัง ${v.delay}s แรง ${Math.round(v.mult * 100)}%`],
    orbit: (v) => ['🌀', 'ลูกโคจร', `${v.n} ลูกหมุนรอบตัว ${v.dur}s ตีศัตรูที่แตะ ${Math.round(v.mult * 100)}%`],
    wall: (v) => ['🧱', 'กำแพงธาตุ', `สร้างกำแพงขวางทาง ${v.dur}s ทำดาเมจ ${Math.round(v.mult * 100)}%/ครั้ง`],
    trail: (v) => ['👣', 'รอยทาง', `ทิ้งรอยธาตุตามทางพุ่ง ${v.dur}s ทำดาเมจ ${Math.round(v.mult * 100)}%/ครั้ง`],
    boomerang: (v) => ['↩', 'บูมเมอแรง', `ย้อนกลับมาตีซ้ำ ${Math.round(v * 100)}%`],
    split: (v) => ['✳', 'แตกกระจาย', `แตกไปโดนศัตรูใกล้เคียง ${v.n} ตัว ${Math.round(v.mult * 100)}%`],
    stackSelf: (v) => ['📈', 'สะสมพลัง', `ใช้แต่ละครั้ง +${v.pct}% ดาเมจ (สูงสุด ${v.max} ชั้น)`],
    resetOnKill: () => ['♻', 'รีเซ็ตเมื่อฆ่า', 'ฆ่าเป้าหมายได้ = คูลดาวน์รีเซ็ตทันที'],
    overcharge: (v) => ['⚡', 'โอเวอร์ชาร์จ', `ถ้า SP เหลือพอ ใช้ SP เพิ่ม ${v.sp}% → แรง ×${v.mult}`],
  };
  UI.mechInfo = (sk) => (sk && sk.mech && MECH[sk.mech] && sk[sk.mech] !== undefined ? MECH[sk.mech](sk[sk.mech]) : null);
  const baseTip = UI.skillTip;
  UI.skillTip = function (id) {
    let h = baseTip(id); const sk = NO_SKILLS.SKILLS[id], m = UI.mechInfo(sk);
    if (m) h = h.replace('<p>', `<div class="mechChip"><b>${m[0]} ${m[1]}</b><span>${UI.esc(m[2])}</span></div><p>`);
    return h;
  };

  // ---------------------------------------------------------------- grouped menu dock
  const GROUPS = [
    ['ตัวละคร', [['char', '👤', 'ตัวละคร', 'U'], ['inv', '🎒', 'กระเป๋า', 'I'], ['skills', '📖', 'สกิล', 'K'], ['passive', '🌌', 'Passive', '['], ['auto', '🤖', 'ออโต้', 'O'], ['pets', '🐾', 'สัตว์/พาหนะ', ',']]],
    ['ผจญภัย', [['quests', '📜', 'ภารกิจ', 'L'], ['map', '🗺', 'แผนที่', 'M'], ['dungeon', '🗼', 'ดันเจี้ยน', 'J'], ['book', '📕', 'สมุดมอน', ']'], ['achieve', '🏅', 'ฉายา', 'Y'], ['rank', '🏆', 'อันดับ', 'R']]],
    ['สังคม & ค้าขาย', [['party', '👥', 'ปาร์ตี้', 'P'], ['friends', '💬', 'เพื่อน', 'F'], ['guild', '🏰', 'กิลด์', 'G'], ['mail', '✉', 'จดหมาย', ''], ['market', '🏛', 'ตลาด', ''], ['craft', '⚗', 'คราฟต์', '']]],
    ['ระบบ', [['settings', '⚙', 'ตั้งค่า', '.'], ['help', '❔', 'คู่มือ', 'H'], ['guide', '🧭', 'แนะนำจอ', ''], ['gm', '🛡', 'GM', 'F10']]],
  ];
  function buildMenu() {
    const m = $('#menu'); if (!m) return setTimeout(buildMenu, 200);
    const gmHidden = $('#gmBtn') ? $('#gmBtn').hidden : true;
    m.classList.add('v2');
    m.innerHTML = GROUPS.map(([g, items]) => `<div class="mgrp"><div class="mgl">${g}</div><div class="mgi">${items.map(([w, ic, n, k]) => `<button class="mbtn" data-win="${w}" data-tip="${n}${k ? ' (' + k + ')' : ''}" ${w === 'gm' ? `id="gmBtn" ${gmHidden ? 'hidden' : ''}` : ''}><span>${ic}</span><em>${n}</em>${k ? `<kbd>${k}</kbd>` : ''}</button>`).join('')}</div></div>`).join('');
    m.onclick = (e) => { const b = e.target.closest('[data-win]'); if (!b) return; if (b.dataset.win === 'guide') UI.hudGuide(); else UI.toggle(b.dataset.win); };
  }

  // ---------------------------------------------------------------- annotated HUD guide
  const SPOTS = [
    ['#pframe', 'ตัวละครของคุณ', 'แถบแดง = HP · แถบฟ้า = SP (ใช้ร่ายสกิล) · แถบล่าง = พลังพิเศษของคลาส'],
    ['#tframe', 'เป้าหมาย', 'คลิกมอนสเตอร์เพื่อเลือก ดู HP ธาตุ และสถานะที่ติดอยู่ (เผา, แช่แข็ง...)'],
    ['#miniWrap', 'แผนที่ย่อ', 'จุดแดง = มอน · ส้ม = บอส · SAFE/AUTO บอกว่าแผนที่นี้ PvP / ออโต้ได้ไหม'],
    ['#tracker', 'ภารกิจที่ติดตาม', 'ความคืบหน้าภารกิจ ฆ่าครบแล้วกดรับรางวัลในหน้าต่างภารกิจ (L)'],
    ['#cmgauge', 'กลไกประจำคลาส', 'แต้มพิเศษของคลาส สะสมตามเงื่อนไขของคลาส แล้วสกิลแต่ละช่องจะใช้แต้มต่างกัน (◆ ในคำอธิบายสกิล)'],
    ['#hotbar1', 'Hotbar สกิล', '1–0 = สกิลโจมตี 1–10 · Shift+1–5 = โจมตี 11–15 · Shift+6–0 = บัฟ (กรอบฟ้า) · Alt+1–5 = อัลติเมต (กรอบทอง)'],
    ['#autoToggle', 'ออโต้', 'เปิดให้ตัวละครล่ามอนเอง · ตั้งค่าโหมด PvE/PvP ที่หน้าต่างออโต้ (O)'],
    ['#menu', 'เมนูหลัก', 'ปุ่มที่ใช้บ่อย · กด ☰ เมนู เพื่อเปิดทุกระบบแบบจัดหมวด · ตัวอักษรมุมปุ่ม = คีย์ลัด'],
    ['#chat', 'แชท', 'Enter เพื่อพิมพ์ · เลือกช่องแชทด้านซ้ายของช่องพิมพ์ · /w ชื่อ = กระซิบ'],
  ];
  UI.hudGuide = function () {
    let ov = $('#hudGuide'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'hudGuide';
    const W = innerWidth, H = innerHeight, NW = 252, NH = 64, placed = [{ x: W / 2 - 230, y: H * 0.46 - 6, w: 460, h: 48 }];
    const hits = (q) => placed.some((o) => q.x < o.x + o.w && q.x + q.w > o.x && q.y < o.y + o.h && q.y + q.h > o.y);
    let html = '<div class="hgDim"></div>';
    for (const [sel, t, d] of SPOTS) {
      const el = $(sel); if (!el || el.hidden || !el.offsetParent) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4) continue;
      placed.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    }
    let boxes = '', notes = '', num = 0;
    for (const [sel, t, d] of SPOTS) {
      const el = $(sel); if (!el || el.hidden || !el.offsetParent) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4) continue;
      const onRight = r.left + r.width / 2 > W / 2, top = r.top < H / 2;
      const xs = [onRight ? r.left - NW - 12 : r.right + 12, Math.min(W - NW - 8, Math.max(8, r.left)), Math.min(W - NW - 8, Math.max(8, r.right - NW)), Math.min(W - NW - 8, Math.max(8, r.left + r.width / 2 - NW / 2))];
      const ys = [r.top, top ? r.bottom + 8 : r.top - NH - 8]; for (let k = 1; k <= 12; k++) ys.push(r.top - k * 34, r.top + k * 34);
      let pos = null;
      outer: for (const y0 of ys) for (const x of xs) { const q = { x, y: y0, w: NW, h: NH }; if (q.x >= 4 && q.x + NW <= W - 4 && q.y >= 4 && q.y + NH <= H - 4 && !hits(q)) { pos = q; break outer; } }
      if (!pos) pos = { x: Math.max(8, Math.min(W - NW - 8, xs[0])), y: Math.max(8, Math.min(H - NH - 8, r.top)), w: NW, h: NH };
      placed.push(pos); num++;
      boxes += `<div class="hgBox" style="left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px"><i class="hgN">${num}</i></div>`;
      notes += `<div class="hgNote" style="left:${pos.x}px;top:${pos.y}px"><b><i class="hgN">${num}</i> ${t}</b><span>${d}</span></div>`;
    }
    html += boxes + notes;
    html += '<div class="hgFoot"><b>คู่มือหน้าจอ</b> · คลิกที่ใดก็ได้เพื่อปิด · เปิดใหม่ได้ที่ปุ่ม 🧭 ในเมนู “ระบบ”</div>';
    ov.innerHTML = html; ov.onclick = () => ov.remove(); document.body.appendChild(ov);
    store.set('no_guide_seen', 1);
  };
  function firstRun() {
    if (!window.G || !G.char || $('#hud').hidden) return setTimeout(firstRun, 600);
    if (!store.get('no_guide_seen', 0)) setTimeout(() => UI.hudGuide(), 1500);
  }
  // ---------------------------------------------------------------- Ashfall-style HUD layout
  const PRIMARY = [['inv', '🎒', 'กระเป๋า', 'I'], ['char', '👤', 'ตัวละคร', 'U'], ['skills', '📖', 'สกิล', 'K'], ['passive', '🌌', 'Passive', '['], ['map', '🗺', 'แผนที่', 'M'], ['dungeon', '🗼', 'ดันเจี้ยน', 'J'], ['more', '☰', 'เมนู', ''], ['settings', '⚙', 'ตั้งค่า', '.']];
  function buildMenu2() {
    const m = $('#menu'); if (!m) return setTimeout(buildMenu2, 200);
    const gmHidden = $('#gmBtn') ? $('#gmBtn').hidden : true;
    m.className = 'v3';
    m.innerHTML = `<div class="mgi3">${PRIMARY.map(([w, ic, n, k]) => `<button class="mbtn" data-win="${w}" data-tip="${n}${k ? ' (' + k + ')' : ''}"><span>${ic}</span><em>${n}</em>${k ? `<kbd>${k}</kbd>` : ''}</button>`).join('')}</div>
      <div class="moreMenu" hidden>${GROUPS.map(([g, items]) => `<div class="mgrp"><div class="mgl">${g}</div><div class="mgi">${items.map(([w, ic, n, k]) => `<button class="mbtn" data-win="${w}" data-tip="${n}${k ? ' (' + k + ')' : ''}" ${w === 'gm' ? `id="gmBtn" ${gmHidden ? 'hidden' : ''}` : ''}><span>${ic}</span><em>${n}</em>${k ? `<kbd>${k}</kbd>` : ''}</button>`).join('')}</div></div>`).join('')}</div>`;
    m.onclick = (e) => {
      const b = e.target.closest('[data-win]'); if (!b) return;
      const w = b.dataset.win, more = m.querySelector('.moreMenu');
      if (w === 'more') { more.hidden = !more.hidden; return; }
      more.hidden = true;
      if (w === 'guide') UI.hudGuide(); else UI.toggle(w);
    };
  }
  function layoutHud() {
    const hud = $('#hud'); if (!hud || !$('#bottom') || !$('#autoToggle')) return setTimeout(layoutHud, 200);
    hud.classList.add('ash');
    // class gauge above the skill bar, EXP strip on top of the bar
    if (!$('#cmgauge')) { const g = document.createElement('div'); g.id = 'cmgauge'; $('#bottom').insertBefore(g, $('#bottom').querySelector('.hotbars')); }
    const hb = $('#bottom .hotbars'), ex = $('#exp'); if (ex && hb && ex.parentNode !== hb) { hb.insertBefore(ex, hb.firstChild); ex.insertAdjacentHTML('afterbegin', '<b class="expGem">◆</b>'); }
    // big round AUTO button bottom-right
    const at = $('#autoToggle'); if (at.parentNode !== hud) { hud.appendChild(at); at.classList.add('autoRound'); at.querySelector('span').textContent = 'AUTO'; }
  }
  // online status: login screen line + a pill at the top of the HUD (single-page build only)
  function netPill() {
    const N = window.NO_NET; if (!N) return;
    const draw = () => {
      const s = $('#netStatus'); if (s) { s.textContent = N.status; s.className = N.mode === 'solo' ? '' : 'on'; }
      const hud = $('#hud'); if (!hud) return;
      let p = $('#netPill'); if (!p) { p = document.createElement('div'); p.id = 'netPill'; ($('#miniWrap') || hud).appendChild(p); }
      p.className = N.mode; p.innerHTML = `<i></i>${N.mode === 'solo' ? 'ออฟไลน์ · เล่นคนเดียว' : `${N.mode === 'host' ? 'โฮสต์' : 'ออนไลน์'} · ${N.online} คนในโลกนี้`}`;
    };
    N.listeners.push(draw); draw();
  }
  const lg = $('#login'); if (lg) lg.style.background = "radial-gradient(ellipse at center, rgba(10,8,16,.35), rgba(10,8,16,.88)), url('client/assets/ui/login.webp') center / cover no-repeat";
  UI.buildMenu = buildMenu2; buildMenu2(); layoutHud(); netPill(); firstRun();
  // the AUTO button keeps its round label
  const _hud = UI.hud; UI.hud = function () { _hud.apply(this, arguments); const at = $('#autoToggle.autoRound'); if (at && G.sme) at.querySelector('b').textContent = G.sme.au ? 'ทำงาน' : 'ออโต้ [`]'; };
})();

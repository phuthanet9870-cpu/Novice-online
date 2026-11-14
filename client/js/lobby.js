// Game lobby (after login): the selected class stands on a lit pedestal, owned classes on the side pedestals and in the
// roster strip, a big PLAY button, and the class case — a horizontal reel that spins and stops on a class you don't own yet.
// First visit: pick a nickname + one of the 3 starter classes (Swordsman / Archer / Mage). Each class is its own character
// with its own level, bag and zeny, so a new class from the case starts from level 1.
(function () {
  const UI = window.UI, D = NO_DATA;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString();
  const art = (c) => 'client/assets/classes/char/' + c + '.webp'; // the character itself (card frame, emblem and name plate cut away)
  const STARTER_TH = { blademaster: ['นักดาบ', 'สายประชิด · ฟันแรง ถึกปานกลาง เล่นง่าย'], ranger: ['นักธนู', 'สายระยะไกล · ยิงเร็ว คล่องตัว คุมระยะ'], pyromancer: ['นักเวท', 'สายเวท · ระเบิดวงกว้าง ดาเมจสูง ตัวบาง'] };
  let L = null, view = 'play', starterPick = 'blademaster', spinning = false;

  const root = document.createElement('div'); root.id = 'lobby'; root.hidden = true; document.body.appendChild(root);
  const tierOf = (c) => D.CASE_TIERS[D.classTier(c)] || D.CASE_TIERS[0];
  const sel = () => (L && L.chars.find((c) => c.id === L.sel)) || (L && L.chars[0]);

  UI.onLobby = function (m) {
    L = m;
    for (const id of ['#login', '#select']) { const el = $(id); if (el) el.hidden = true; }
    if ($('#hud')) $('#hud').hidden = true;
    root.hidden = false;
    if (!spinning) render();
  };
  const baseEnter = UI.onEnter;
  UI.onEnter = function (m) { root.hidden = true; return baseEnter.apply(this, arguments); };

  // ---- lobby shell (tactical-shooter style): profile top-left, vertical menu left, character centre,
  //      event cards right, currency top-right, bottom tab bar + chat line, big ENTER bottom-right
  const MENU = [['play', '◆', 'ตัวละคร'], ['roster', '⚔', 'คลาสของฉัน'], ['case', '🎰', 'กล่องสุ่มคลาส'], ['news', '📰', 'ข่าวสาร']];
  const TABS = [['news', 'ซีซัน 1'], ['play', 'ล็อบบี้'], ['roster', 'คลาส'], ['case', 'กล่องสุ่ม'], ['map', 'แผนที่']];
  const mapName = (id) => { try { return NO_MAP.getMapDef(id).name; } catch (e) { return 'Aurelia'; } };
  function shell(content) {
    const s = sel(), C = s ? D.CLASSES[s.cls] : null, T = s ? tierOf(s.cls) : D.CASE_TIERS[0];
    const online = (window.NO_NET && NO_NET.online) || 1;
    return `<div class="lbBg"></div><div class="lbFog"></div>
      <div class="lb2Me" style="--t:${T.color}">${s ? `<img src="${art(s.cls)}">` : ''}<div><b>${esc(L.nick)}</b><small>${C ? esc(C.name) + ' · Lv ' + s.lv : ''}</small><i class="bar"><em style="width:${s ? Math.min(100, s.lv / 3) : 0}%"></em></i></div></div>
      <div class="lb2Top"><span class="cur"><i>Z</i>${s ? fmt(s.zeny) : 0}</span><span class="cur on"><i>●</i>ออนไลน์ ${online}</span><button data-act="logout" title="ออกจากระบบ">⏻</button></div>
      <nav class="lb2Menu">${MENU.map(([k, ic, n]) => `<button class="${view === k ? 'on' : ''}" data-v="${k}"><i>${ic}</i>${n}${k === 'case' ? '<b class="dot"></b>' : ''}</button>`).join('')}</nav>
      <div class="lb2Main">${content}</div>
      <div class="lb2Chat"><b>[ทั่วไป]</b> ยินดีต้อนรับสู่ Novice Online · ดันเจี้ยน 1,000 ชั้น · เวิลด์บอสทุกวัน</div>
      <div class="lb2Tabs">${TABS.map(([k, n]) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>
      ${s ? `<button class="lb2Enter" data-play="${s.id}">ENTER<small>เข้าเกม · ${esc(mapName(s.map))}</small></button>` : ''}`;
  }
  function stage() {
    const s = sel(); if (!s) return '';
    const C = D.CLASSES[s.cls], T = tierOf(s.cls), own = L.chars.length;
    return `<div class="lb2Hero"><img src="${art(s.cls)}"><div class="nm" style="--t:${T.color}"><small>${T.n} · ${esc(C.role || '')}</small><b>${esc(C.name)}</b><span>${esc(C.th)}</span></div></div>
      <div class="lb2Cards">
        <div class="card hot" data-v="case" style="--t:#ffb03a"><small>กล่องสุ่มคลาส</small><b>ปลดล็อกคลาสใหม่</b><span>${fmt(L.cost)} Zeny · มีแล้ว ${own}/${D.CLASS_IDS.length}</span></div>
        <div class="card" data-v="roster"><small>คลาสของฉัน</small><b>${own} คลาส</b><div class="mini">${L.chars.slice(0, 5).map((c) => `<img src="${art(c.cls)}" data-pick="${c.id}" class="${c.id === s.id ? 'on' : ''}" title="${esc(D.CLASSES[c.cls].name)} Lv${c.lv}">`).join('')}</div></div>
        <div class="card" data-v="news"><small>ซีซัน 1</small><b>Ashfall Rising</b><span>หีบสมบัติดันเจี้ยน · คลาสใหม่ 30 คลาส</span></div>
      </div>`;
  }
  function news() {
    return `<div class="lbPage news"><h2>ซีซัน 1 · Ashfall Rising</h2>
      <div class="nw"><b>🎰 กล่องสุ่มคลาส</b><p>เริ่มด้วย นักดาบ / นักธนู / นักเวท แล้วสุ่มปลดล็อกคลาสอื่นอีก ${D.CLASS_IDS.length - 3} คลาส ครั้งละ ${fmt(L.cost)} Zeny · แต่ละคลาสเลเวลแยกกัน</p></div>
      <div class="nw"><b>🗝 หีบสมบัติดันเจี้ยน</b><p>ทุกชั้นมีหีบ 6 ใบ 6 ระดับสี กุญแจดรอปจากมอนสเตอร์ในดันเจี้ยน · ยิ่งลึกยิ่งได้ของหายาก</p></div>
      <div class="nw"><b>🐉 เวิลด์บอส</b><p>ทำลายเสาผนึก ผ่านเฟสบอส แล้วชิงอันดับดาเมจทั้งเซิร์ฟเวอร์</p></div></div>`;
  }
  function mapPage() {
    const s = sel();
    return `<div class="lbPage news"><h2>แผนที่</h2><p class="hint">ตัวละครจะเข้าเกมที่ <b>${esc(mapName(s && s.map))}</b> — เดินทางต่อได้จาก Waygate และ NPC ในเมือง</p>
      <div class="nw"><b>เมือง</b><p>Aurelia · Frostheim · Sandhaven · Emberforge · Skyreach</p></div><div class="nw"><b>ดันเจี้ยน</b><p>Abyss Tower · Inferno Depths · Frost Crypt · Shadow Labyrinth · Sky Sanctum — 1,000 ชั้น</p></div></div>`;
  }

  function roster() {
    const own = new Map(L.chars.map((c) => [c.cls, c]));
    return `<div class="lbPage"><h2>คลาสของฉัน <small>${own.size} / ${D.CLASS_IDS.length}</small></h2><p class="hint">แต่ละคลาสเป็นตัวละครแยก เลเวลและกระเป๋าแยกกัน · เงิน Zeny ใช้ร่วมกันทุกคลาส — คลาสที่ได้ใหม่ต้องฟาร์มตั้งแต่เลเวล 1</p>
      ${D.CASE_TIERS.map((t) => `<h4 style="color:${t.color}">${t.n} · ${t.th}</h4><div class="lbGrid">${t.cls.map((c) => { const o = own.get(c); return `<div class="cc ${o ? 'own' : 'lock'}" ${o ? `data-pick="${o.id}"` : ''} style="--t:${t.color}"><img src="${art(c)}"><b>${esc(D.CLASSES[c].name)}</b><small>${o ? 'Lv ' + o.lv : '🔒 ยังไม่มี'}</small></div>`; }).join('')}</div>`).join('')}</div>`;
  }

  function casePage() {
    const s = sel(), own = new Set(L.chars.map((c) => c.cls)), total = D.CLASS_IDS.length;
    const odds = D.CASE_TIERS.map((t) => { const left = t.cls.filter((c) => !own.has(c)); return { t, left }; });
    const W = odds.reduce((a, o) => a + (o.left.length ? o.t.w * o.left.length / o.t.cls.length : 0), 0) || 1;
    return `<div class="lbPage case"><h2>Unlock Class Case</h2><p class="caseSub">ปลดล็อกคลาสใหม่ · <b>${fmt(L.cost)} Zeny</b> ต่อครั้ง (จ่ายจากเงินของบัญชี ใช้ร่วมกันทุกคลาส) · ได้คลาสที่ยังไม่มีเสมอ</p>
      <div class="reelWrap"><div class="reel" id="reel">${reelCards(null)}</div><i class="mark"></i></div>
      <div class="caseBar"><div class="odds">${odds.map((o) => `<span style="--t:${o.t.color}"><i></i>${o.t.n} <b>${o.left.length ? (o.t.w * o.left.length / o.t.cls.length / W * 100).toFixed(1) + '%' : '—'}</b><small>${o.left.length}/${o.t.cls.length}</small></span>`).join('')}</div>
        <div class="pay">${s ? `เงินในบัญชี (ใช้ร่วมทุกคลาส) · มี <b class="${s.zeny >= L.cost ? 'ok' : 'bad'}">${fmt(s.zeny)}</b> Zeny` : ''}</div>
        <button class="lbPlay open" data-act="roll" ${own.size >= total ? 'disabled' : ''}>${own.size >= total ? 'มีครบทุกคลาสแล้ว' : 'เปิดกล่อง · ' + fmt(L.cost)}</button>${L.gm >= 2 ? '<button class="btn tiny" data-act="rollFree">GM: เปิดฟรี</button>' : ''}</div></div>`;
  }
  // reel of class cards; for the spin the winning class sits at index 52
  function reelCards(win) {
    const own = new Set(L.chars.map((c) => c.cls));
    const pool = D.CASE_TIERS.flatMap((t) => t.cls.filter((c) => !own.has(c) || !win).map((c) => [c, t.w / t.cls.length]));
    const pick = () => { let r = Math.random() * pool.reduce((a, x) => a + x[1], 0); for (const [c, w] of pool) if ((r -= w) < 0) return c; return pool[0][0]; };
    const list = Array.from({ length: win ? 60 : 9 }, (_, i) => (win && i === 52 ? win : pool.length ? pick() : 'blademaster'));
    return list.map((c) => `<div class="card" style="--t:${tierOf(c).color}"><img src="${art(c)}"><span>${esc(D.CLASSES[c].name)}</span></div>`).join('');
  }

  function starter() {
    return `<div class="lbStarter"><h2>เลือกคลาสเริ่มต้น</h2><p class="hint">เริ่มได้ 3 คลาส — คลาสอื่นทั้งหมด (${D.CLASS_IDS.length - 3} คลาส) ได้จากกล่องสุ่มคลาสในล็อบบี้</p>
      <div class="stCards">${D.STARTER_CLASSES.map((c) => `<div class="st ${starterPick === c ? 'on' : ''}" data-st="${c}"><img src="${art(c)}"><b>${STARTER_TH[c][0]}</b><small>${esc(D.CLASSES[c].name)}</small><p>${STARTER_TH[c][1]}</p></div>`).join('')}</div>
      <div class="stName"><input id="stName" maxlength="14" placeholder="ตั้งชื่อตัวละคร (2-14 ตัว)"><button class="lbPlay" data-act="start">เริ่มผจญภัย</button></div></div>`;
  }

  function render() {
    if (!L) return;
    if (!L.chars.length) { root.innerHTML = `<div class="lbBg"></div>${starter()}`; return; }
    root.innerHTML = shell(view === 'play' ? stage() : view === 'roster' ? roster() : view === 'case' ? casePage() : view === 'map' ? mapPage() : news()) + '<div id="lbReveal" hidden></div>';
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pick]') || e.target.closest('[data-v],[data-play],[data-act],[data-st]'); if (!t || spinning) return;
    if (t.dataset.st) { starterPick = t.dataset.st; render(); return; }
    if (t.dataset.v) { view = t.dataset.v; render(); return; }
    if (t.dataset.pick) { G.send({ t: 'selClass', id: t.dataset.pick }); view = 'play'; return; }
    if (t.dataset.play) { try { const s = JSON.parse(sessionStorage.getItem('no_sess') || '{}'); s.char = t.dataset.play; sessionStorage.setItem('no_sess', JSON.stringify(s)); } catch (er) {} G.send({ t: 'play', id: t.dataset.play }); return; }
    const a = t.dataset.act;
    if (a === 'logout') { try { sessionStorage.removeItem('no_sess'); } catch (er) {} location.reload(); return; }
    if (a === 'start') { const n = ($('#stName') || {}).value || ''; G.send({ t: 'starter', cls: starterPick, name: n.trim() }); }
    if (a === 'roll' || a === 'rollFree') G.send({ t: 'rollClass', free: a === 'rollFree' });
    if (a === 'closeReveal') { $('#lbReveal').hidden = true; spinning = false; render(); }
    if (a === 'playNew') { G.send({ t: 'selClass', id: t.dataset.id }); view = 'play'; spinning = false; }
  });

  // the case result arrives before the lobby update: spin the reel, then reveal
  UI.onRoll = function (m) {
    spinning = true; view = 'case';
    root.innerHTML = shell(casePage()) + '<div id="lbReveal" hidden></div>';
    const reel = $('#reel'); reel.innerHTML = reelCards(m.cls);
    const card = reel.children[52], wrap = reel.parentElement;
    const jitter = (Math.random() - 0.5) * card.offsetWidth * 0.7;
    const x = card.offsetLeft + card.offsetWidth / 2 - wrap.clientWidth / 2 + jitter;
    reel.style.transition = 'none'; reel.style.transform = 'translateX(0)';
    let tick = 0; const ticker = setInterval(() => { if (window.SFX && SFX.tick) SFX.tick(); else if (window.SFX && SFX.coin && (tick++ % 2 === 0)) SFX.coin(); }, 120);
    requestAnimationFrame(() => requestAnimationFrame(() => { reel.style.transition = 'transform 6.2s cubic-bezier(.12,.7,.08,1)'; reel.style.transform = `translateX(${-x}px)`; }));
    setTimeout(() => {
      clearInterval(ticker); card.classList.add('win'); spinning = false; // reveal buttons are clickable
      const T = tierOf(m.cls), C = D.CLASSES[m.cls];
      const r = $('#lbReveal'); r.hidden = false;
      r.innerHTML = `<div class="rv" style="--t:${T.color}"><small>ได้รับคลาสใหม่!</small><img src="${art(m.cls)}"><b>${esc(C.name)}</b><span>${esc(C.th)} · ${esc(C.role || '')}</span><em>${T.n} · ${T.th}</em>
        <p>เริ่มต้นที่เลเวล 1 — เลเวลและกระเป๋าแยกจากคลาสอื่น · ใช้เงิน Zeny ร่วมกับทุกคลาส</p><div><button class="lbPlay" data-act="playNew" data-id="${m.id}">ใช้คลาสนี้</button><button class="btn" data-act="closeReveal">เปิดอีกครั้ง</button></div></div>`;
      if (window.SFX && SFX.level) SFX.level();
    }, 6500);
  };
})();

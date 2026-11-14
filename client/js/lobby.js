// Game lobby (after login): the selected class stands on a lit pedestal, owned classes on the side pedestals and in the
// roster strip, a big PLAY button, and the class case — a horizontal reel that spins and stops on a class you don't own yet.
// First visit: pick a nickname + one of the 3 starter classes (Swordsman / Archer / Mage). Each class is its own character
// with its own level, bag and zeny, so a new class from the case starts from level 1.
(function () {
  const UI = window.UI, D = NO_DATA;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString();
  const art = (c) => 'client/assets/classes/' + c + '.webp';
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

  function nav() {
    const s = sel();
    const tabs = [['play', 'เล่น'], ['roster', 'คลาสของฉัน'], ['case', 'กล่องสุ่มคลาส']];
    return `<div class="lbNav"><div class="lbLogo">NOVICE<b>ONLINE</b></div>${tabs.map(([k, n]) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${n}${k === 'case' ? '<i class="dot"></i>' : ''}</button>`).join('')}
      <div class="lbMe">${s ? `<span class="zeny">${fmt(s.zeny)} <small>Zeny</small></span>` : ''}<span class="nick">${esc(L.nick || '')}</span>${s ? `<img src="${art(s.cls)}">` : ''}</div></div>`;
  }

  function stage() {
    const s = sel(); if (!s) return '';
    const C = D.CLASSES[s.cls], T = tierOf(s.cls);
    const others = L.chars.filter((c) => c.id !== s.id).slice(0, 3);
    const side = [0, 1, 2].map((i) => { const o = others[i]; return `<div class="ped side p${i}" ${o ? `data-pick="${o.id}"` : 'data-v="case"'}>${o ? `<img src="${art(o.cls)}"><span>${esc(D.CLASSES[o.cls].name)} · Lv${o.lv}</span>` : '<b class="plus">＋</b><span>สุ่มคลาสใหม่</span>'}<i class="disc"></i></div>`; }).join('');
    return `<div class="lbStage">
      <div class="tag"><i style="background:${T.color}"></i><div><b>${esc(L.nick)}</b><small style="color:${T.color}">${esc(C.name)} · ${esc(C.th)}</small></div></div>
      <div class="ped main"><img src="${art(s.cls)}"><i class="disc"></i></div>${side}
      <div class="lbMode"><h3>ผจญภัย</h3><div class="sub"><b>${esc(C.name)}</b> · Lv ${s.lv}<small>${esc((() => { try { return NO_MAP.getMapDef(s.map).name; } catch (e) { return 'Aurelia'; } })())}</small></div>
        <button class="lbPlay" data-play="${s.id}">PLAY</button></div>
      <div class="lbLv"><small>LVL</small><b>${s.lv}</b></div>
      <div class="lbRoster">${L.chars.map((c) => `<div class="rc ${c.id === s.id ? 'on' : ''}" data-pick="${c.id}" style="--t:${tierOf(c.cls).color}"><img src="${art(c.cls)}"><span>${esc(D.CLASSES[c.cls].name)}</span><small>Lv ${c.lv}</small></div>`).join('')}
        <div class="rc add" data-v="case"><b>🎰</b><span>สุ่มคลาส</span><small>${fmt(L.cost)} Z</small></div></div>
    </div>`;
  }

  function roster() {
    const own = new Map(L.chars.map((c) => [c.cls, c]));
    return `<div class="lbPage"><h2>คลาสของฉัน <small>${own.size} / ${D.CLASS_IDS.length}</small></h2><p class="hint">แต่ละคลาสเป็นตัวละครแยก เลเวล กระเป๋า และเงินแยกกัน — คลาสที่ได้ใหม่ต้องฟาร์มตั้งแต่เลเวล 1</p>
      ${D.CASE_TIERS.map((t) => `<h4 style="color:${t.color}">${t.n} · ${t.th}</h4><div class="lbGrid">${t.cls.map((c) => { const o = own.get(c); return `<div class="cc ${o ? 'own' : 'lock'}" ${o ? `data-pick="${o.id}"` : ''} style="--t:${t.color}"><img src="${art(c)}"><b>${esc(D.CLASSES[c].name)}</b><small>${o ? 'Lv ' + o.lv : '🔒 ยังไม่มี'}</small></div>`; }).join('')}</div>`).join('')}</div>`;
  }

  function casePage() {
    const s = sel(), own = new Set(L.chars.map((c) => c.cls)), total = D.CLASS_IDS.length;
    const odds = D.CASE_TIERS.map((t) => { const left = t.cls.filter((c) => !own.has(c)); return { t, left }; });
    const W = odds.reduce((a, o) => a + (o.left.length ? o.t.w * o.left.length / o.t.cls.length : 0), 0) || 1;
    return `<div class="lbPage case"><h2>Unlock Class Case</h2><p class="caseSub">ปลดล็อกคลาสใหม่ · <b>${fmt(L.cost)} Zeny</b> ต่อครั้ง (จ่ายจากคลาสที่เลือกอยู่) · ได้คลาสที่ยังไม่มีเสมอ</p>
      <div class="reelWrap"><div class="reel" id="reel">${reelCards(null)}</div><i class="mark"></i></div>
      <div class="caseBar"><div class="odds">${odds.map((o) => `<span style="--t:${o.t.color}"><i></i>${o.t.n} <b>${o.left.length ? (o.t.w * o.left.length / o.t.cls.length / W * 100).toFixed(1) + '%' : '—'}</b><small>${o.left.length}/${o.t.cls.length}</small></span>`).join('')}</div>
        <div class="pay">${s ? `จ่ายจาก <b>${esc(D.CLASSES[s.cls].name)}</b> · มี <b class="${s.zeny >= L.cost ? 'ok' : 'bad'}">${fmt(s.zeny)}</b> Zeny` : ''}</div>
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
    root.innerHTML = `<div class="lbBg"></div>${nav()}${view === 'play' ? stage() : view === 'roster' ? roster() : casePage()}<div id="lbReveal" hidden></div>`;
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-v],[data-pick],[data-play],[data-act],[data-st]'); if (!t || spinning) return;
    if (t.dataset.st) { starterPick = t.dataset.st; render(); return; }
    if (t.dataset.v) { view = t.dataset.v; render(); return; }
    if (t.dataset.pick) { G.send({ t: 'selClass', id: t.dataset.pick }); view = 'play'; return; }
    if (t.dataset.play) { try { const s = JSON.parse(sessionStorage.getItem('no_sess') || '{}'); s.char = t.dataset.play; sessionStorage.setItem('no_sess', JSON.stringify(s)); } catch (er) {} G.send({ t: 'play', id: t.dataset.play }); return; }
    const a = t.dataset.act;
    if (a === 'start') { const n = ($('#stName') || {}).value || ''; G.send({ t: 'starter', cls: starterPick, name: n.trim() }); }
    if (a === 'roll' || a === 'rollFree') G.send({ t: 'rollClass', free: a === 'rollFree' });
    if (a === 'closeReveal') { $('#lbReveal').hidden = true; spinning = false; render(); }
    if (a === 'playNew') { G.send({ t: 'selClass', id: t.dataset.id }); view = 'play'; spinning = false; }
  });

  // the case result arrives before the lobby update: spin the reel, then reveal
  UI.onRoll = function (m) {
    spinning = true; view = 'case';
    root.innerHTML = `<div class="lbBg"></div>${nav()}${casePage()}<div id="lbReveal" hidden></div>`;
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
        <p>เริ่มต้นที่เลเวล 1 — เลเวล กระเป๋า และเงินของคลาสนี้แยกจากคลาสอื่น</p><div><button class="lbPlay" data-act="playNew" data-id="${m.id}">ใช้คลาสนี้</button><button class="btn" data-act="closeReveal">เปิดอีกครั้ง</button></div></div>`;
      if (window.SFX && SFX.level) SFX.level();
    }, 6500);
  };
})();

// HUD + windows + screens (DOM).
(function () {
  const D = NO_DATA, F = NO_F;
  const SKS = () => NO_SKILLS.SKILLS, CSK = () => NO_SKILLS.CLASS_SKILLS;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString();
  const UI = window.UI = { wins: {}, open: [], chatTab: 'all', chatCh: 'map', selItem: null, skillTab: null, invTab: 'all', log: [] };
  // one bar of 10 slots with 2 pages (20 slots): 1..0 fire the page on screen, Shift+1..0 fire the other page, the ⇄ button swaps pages
  const HB_N = 20, HB_ROW = 10;
  const DIG = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const HOTKEYS = Array.from({ length: HB_N }, (_, i) => DIG[i % HB_ROW]);
  UI.hbPage = (() => { try { return +localStorage.getItem('no_hb_page') === 1 ? 1 : 0; } catch (e) { return 0; } })();
  UI.swapHotbar = (pg) => { UI.hbPage = pg === undefined ? 1 - UI.hbPage : pg; try { localStorage.setItem('no_hb_page', UI.hbPage); } catch (e) {} buildHotbar(); renderHotbar(); const b = $('#hbToggle'); if (b) b.innerHTML = hbBtn(); };
  const hbBtn = () => `<b>⇄</b><span>${UI.hbPage + 1}/2</span>`;
  const WINKEYS = { i: 'inv', k: 'skills', u: 'char', o: 'auto', m: 'map', j: 'dungeon', g: 'guild', p: 'party', r: 'rank', h: 'help', f10: 'gm', l: 'quests', y: 'achieve', f: 'friends', ',': 'pets', '.': 'settings', '[': 'passive', ']': 'book' };

  // ================================================================ screens
  UI.boot = function () {
    $('#loginBtn').onclick = () => auth('login');
    $('#regBtn').onclick = () => auth('register');
    $('#pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') auth('login'); });
    try { const u = localStorage.getItem('no_user'); if (u) $('#user').value = u; } catch (e) {}
    buildClassPicker();
    G.connect(() => {
      $('#loginStatus').textContent = 'เชื่อมต่อเซิร์ฟเวอร์แล้ว ✓';
      // after an online host hand-over the page reloads: log back in and re-enter with the same character automatically
      let mig = null; try { if (sessionStorage.getItem('no_migrate')) mig = JSON.parse(sessionStorage.getItem('no_sess') || 'null'); sessionStorage.removeItem('no_migrate'); } catch (e) {}
      if (mig && mig.user && mig.pass) { UI.autoPlay = mig.char || null; $('#loginStatus').textContent = 'ย้ายเซิร์ฟเวอร์ — กำลังเข้าเกมอีกครั้ง…'; setTimeout(() => G.send({ t: 'login', user: mig.user, pass: mig.pass }), 900); }
    });
    G.start();
    setupTooltip();
    setupHud();
  };
  function auth(kind) {
    const user = $('#user').value.trim(), pass = $('#pass').value;
    try { localStorage.setItem('no_user', user); sessionStorage.setItem('no_sess', JSON.stringify({ user, pass })); } catch (e) {}
    G.send({ t: kind, user, pass });
  }
  UI.onAuth = function (m) {
    if (!m.ok) { $('#loginStatus').textContent = m.m; $('#loginStatus').className = 'status bad'; return; }
    UI.gm = m.gm; UI.user = m.user;
    show('select'); UI.onChars(m);
    if (UI.autoPlay) { const id = UI.autoPlay; UI.autoPlay = null; setTimeout(() => G.send({ t: 'play', id }), 300); }
  };
  function show(id) { for (const s of ['login', 'select']) $('#' + s).hidden = s !== id; $('#hud').hidden = id !== 'hud'; }
  function rememberChar(id) { try { const s = JSON.parse(sessionStorage.getItem('no_sess') || '{}'); s.char = id; sessionStorage.setItem('no_sess', JSON.stringify(s)); } catch (e) {} }
  UI.onChars = function (m) {
    UI.chars = m.chars;
    const list = $('#charList');
    // a card that fails to draw (unknown class from an old save…) must never blank the whole list
    const card = (c) => { try { return cardHtml(c); } catch (e) { return `<div class="charCard" data-id="${c.id}"><div><b>${esc(c.name || '?')}</b><span>Lv ${c.lv || 1}</span></div><button class="btn gold tiny" data-play="${c.id}">เข้าเกม ▶</button></div>`; } };
    list.innerHTML = m.chars.map(card).join('')
      + (m.chars.length < 6 ? `<div class="charCard new" id="newCharBtn"><div class="plus">＋</div><div><b>สร้างตัวละครใหม่</b><span>เลือกได้ 30 อาชีพ</span></div></div>` : '');
    function cardHtml(c) { return `<div class="charCard" data-id="${c.id}"><img src="${ART.portrait(c.cls, c.name, 96)}"><div><b>${esc(c.name)}</b><span>Lv ${c.lv} ${D.CLASSES[c.cls].name}</span><small>${esc(c.guild ? '<' + c.guild + '> ' : '')}${esc(mapName(c.map))}</small></div><button class="btn gold" data-play="${c.id}">เข้าเกม ▶</button><button class="btn tiny danger" data-del="${c.id}" data-name="${esc(c.name)}">ลบ</button></div>`; }
    list.onclick = (e) => {
      const pl = e.target.closest('[data-play]'); if (pl) { rememberChar(pl.dataset.play); return G.send({ t: 'play', id: pl.dataset.play }); }
      const dl = e.target.closest('[data-del]'); if (dl) { UI.ask(`พิมพ์ชื่อ "${dl.dataset.name}" เพื่อยืนยันการลบตัวละคร`, { input: true, danger: true, ok: 'ลบตัวละคร' }).then((n) => { if (n) G.send({ t: 'deleteChar', id: dl.dataset.del, confirm: n }); }); return; }
      if (e.target.closest('#newCharBtn')) { $('#createPanel').hidden = false; }
      const card = e.target.closest('.charCard[data-id]'); if (card && e.detail === 2) { rememberChar(card.dataset.id); G.send({ t: 'play', id: card.dataset.id }); }
    };
    $('#createPanel').hidden = m.chars.length > 0 && !m.created ? true : m.chars.length > 0;
    if (!m.chars.length) $('#createPanel').hidden = false;
    if (m.created) { rememberChar(m.created); G.send({ t: 'play', id: m.created }); }
  };
  let pickCls = 'blademaster', clsPage = 0;
  const CLS_PER = 5;
  UI.classArt = (c) => 'client/assets/classes/' + c + '.webp';
  function buildClassPicker() {
    const grid = $('#classGrid');
    const pages = Math.ceil(D.CLASS_IDS.length / CLS_PER);
    const draw = () => {
      const ids = D.CLASS_IDS.slice(clsPage * CLS_PER, clsPage * CLS_PER + CLS_PER);
      grid.innerHTML = `<button class="cArrow" data-nav="-1" title="ก่อนหน้า">◀</button><div class="cCards">${ids.map((c) => `<div class="clsBtn cCard" data-cls="${c}" style="--c:${D.CLASSES[c].color}"><div class="cArt"><img src="${UI.classArt(c)}" alt="" loading="lazy" onerror="this.style.display='none'"></div><div class="cName"><b>${esc(D.CLASSES[c].name)}</b><small>${esc(D.CLASSES[c].th)}</small></div><button class="btn ${c === pickCls ? 'green' : 'gold'} tiny cPick">${c === pickCls ? '✓ เลือกแล้ว' : 'เลือก'}</button></div>`).join('')}</div><button class="cArrow" data-nav="1" title="ถัดไป">▶</button>
        <div class="cDots">${Array.from({ length: pages }, (_, i) => `<i class="${i === clsPage ? 'on' : ''}" data-page="${i}"></i>`).join('')}<span>${clsPage + 1}/${pages} · ${D.CLASS_IDS.length} อาชีพ</span></div>`;
      for (const b of grid.querySelectorAll('.clsBtn')) b.classList.toggle('on', b.dataset.cls === pickCls);
    };
    grid.onclick = (e) => {
      const nav = e.target.closest('[data-nav]'); if (nav) { clsPage = (clsPage + +nav.dataset.nav + pages) % pages; draw(); return; }
      const dot = e.target.closest('[data-page]'); if (dot) { clsPage = +dot.dataset.page; draw(); return; }
      const b = e.target.closest('[data-cls]'); if (b) { pickCls = b.dataset.cls; draw(); renderClassInfo(); }
    };
    UI.redrawClassPicker = draw;
    $('#createBtn').onclick = () => G.send({ t: 'createChar', name: $('#newName').value.trim(), cls: pickCls });
    $('#cancelCreate').onclick = () => { $('#createPanel').hidden = true; };
    draw(); renderClassInfo();
  }
  function renderClassInfo() {
    const c = D.CLASSES[pickCls];
    const sk = CSK()[pickCls].map((id) => SKS()[id]);
    const show = [sk[0], sk[1], sk[3], sk[15], sk[20], sk[24]].filter(Boolean);
    const m = c.mech || {};
    $('#classInfo').innerHTML = `<div class="ciBox ciWho"><h4>ตัวละคร</h4><div class="ciRow"><img class="ciThumb" src="${UI.classArt(pickCls)}" alt=""><div><b style="color:${c.color}">${esc(c.name)}</b><small>${esc(c.th)}</small><div class="chips"><span class="chip">ธาตุ${esc(c.elTh || '')}</span><span class="chip">${esc(c.role)}</span><span class="chip">${c.scale === 'melee' ? 'ประชิด' : 'ระยะ ' + c.range}</span><span class="chip">${esc(c.wname || c.weapon)}</span></div></div></div></div>
      <div class="ciBox ciDesc"><h4>ความสามารถ</h4><p>${esc(c.name)} (${esc(c.th)}) ${esc(c.role)} · สกิลโจมตี 15 · บัฟ 5 · อัลติเมต 4 · อัลติเมตประจำคลาส 1</p><p class="mech" style="--c:${m.c || c.color}"><b>กลไกประจำคลาส · ${esc(m.n || '')}</b> (สูงสุด ${m.max || 0}) — ${esc(m.d || '')}</p></div>
      <div class="ciBox ciSkills"><h4>สกิล</h4><div class="skillPreview">${show.map((s, i) => `<img src="${ART.skillIcon(s)}" data-skill="${s.id}" class="${i ? '' : 'on'}" data-prev="${s.id}">`).join('')}</div><div id="ciSkillTxt" class="ciSkillTxt"></div></div>`;
    const txt = (id) => { const s = SKS()[id]; $('#ciSkillTxt').innerHTML = `<b>${esc(s.name)}</b> <small>[${{ atk: 'โจมตี', buff: 'บัฟ', ult: 'อัลติเมต', set: 'อัลติเมตคลาส' }[s.cat] || ''}] Lv${s.reqLv}</small><p>${esc(s.desc)}</p>`; };
    txt(show[0].id);
    $('#classInfo').onclick = (e) => { const im = e.target.closest('[data-prev]'); if (!im) return; for (const x of $('#classInfo').querySelectorAll('[data-prev]')) x.classList.toggle('on', x === im); txt(im.dataset.prev); };
  }
  function mapName(id) { const d = NO_MAP.getMapDef(id || 'aurelia'); return d ? d.name : id; }
  UI.kicked = (m) => { UI.ask(m || 'ถูกตัดการเชื่อมต่อ', { ok: 'เริ่มใหม่', noCancel: true }).then(() => location.reload()); };
  // in-page confirm/prompt dialog (native dialogs are blocked inside embedded viewers)
  UI.ask = function (msg, o = {}) {
    return new Promise((res) => {
      const el = document.createElement('div'); el.className = 'askBack';
      el.innerHTML = `<div class="askBox"><p></p>${o.input ? '<input class="askIn" maxlength="200">' : ''}<div class="acts"><button class="btn ${o.danger ? 'danger' : 'gold'}" data-r="ok">${esc(o.ok || 'ตกลง')}</button>${o.noCancel ? '' : '<button class="btn" data-r="no">ยกเลิก</button>'}</div></div>`;
      el.querySelector('p').textContent = msg;
      const inp = el.querySelector('.askIn'); if (inp) inp.value = o.def || '';
      const done = (v) => { el.remove(); res(v); };
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === 'ok' ? (inp ? inp.value : true) : (inp ? null : false)); });
      el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(inp ? inp.value : true); if (e.key === 'Escape') done(inp ? null : false); });
      document.body.appendChild(el); (inp || el.querySelector('[data-r=ok]')).focus();
    });
  };
  UI.disconnected = () => { const d = $('#disc'); d.hidden = false; };

  // ================================================================ HUD
  function setupHud() {
    buildHotbar();
    $('#hotbar2').innerHTML = `<button class="hbToggle" id="hbToggle" data-tip="สลับชุด Hotbar (ชุด 1 ↔ ชุด 2) · Shift+1..0 ใช้ช่องของอีกชุดได้เลย">${hbBtn()}</button>` + `<div class="slot bf" id="bfBtn" data-tip="Break Free (Q): หลุดสถานะควบคุม · CD 25s · ใช้ SP 15%"><span class="glyph">⛓</span><kbd>Q</kbd><div class="cd"></div></div>`;
    $('#bfBtn').onclick = () => G.send({ t: 'breakfree' });
    $('#hbToggle').onclick = () => UI.swapHotbar();
    if (UI.buildMenu) UI.buildMenu();
    $('#autoToggle').onclick = () => G.send({ t: 'autoOn', on: !G.autoOn() });
    $('#chatTabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; UI.chatTab = b.dataset.tab; for (const x of document.querySelectorAll('#chatTabs [data-tab]')) x.classList.toggle('on', x === b); if (['map', 'world', 'party', 'guild'].includes(b.dataset.tab)) { UI.chatCh = b.dataset.tab; $('#chatCh').value = UI.chatCh; } renderChat(); };
    $('#chatCh').onchange = (e) => { UI.chatCh = e.target.value; };
    $('#chatIn').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) G.send({ t: 'chat', ch: UI.chatCh, m: v }); e.target.value = ''; e.target.blur(); e.stopPropagation(); }
      if (e.key === 'Escape') e.target.blur();
      e.stopPropagation();
    });
    $('#respawnBtn').onclick = () => { G.send({ t: 'respawn' }); UI.hideDead(); };
    $('#minicv').onclick = () => UI.toggle('map');
    $('#zoomIn').onclick = () => { G.zoom = Math.min(1.8, G.zoom * 1.15); };
    $('#zoomOut').onclick = () => { G.zoom = Math.max(0.55, G.zoom / 1.15); };
  }
  function buildHotbar() {
    const b = UI.hbPage * HB_ROW;
    $('#hotbar1').innerHTML = `<div class="hotbar hbrow pg${UI.hbPage}">${Array.from({ length: HB_ROW }, (_, c) => slotHtml(b + c, HOTKEYS[b + c])).join('')}</div>`;
    for (const el of document.querySelectorAll('#hotbar1 .slot[data-i]')) {
      el.onclick = () => G.useHotbar(+el.dataset.i);
      el.oncontextmenu = (e) => { e.preventDefault(); G.char.hotbar[+el.dataset.i] = null; saveHotbar(); };
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => { e.preventDefault(); const v = e.dataTransfer.getData('text/plain'); if (!v) return; const from = e.dataTransfer.getData('from'); if (from !== '') { const fi = +from; const tmp = G.char.hotbar[+el.dataset.i]; G.char.hotbar[+el.dataset.i] = G.char.hotbar[fi]; G.char.hotbar[fi] = tmp; } else G.char.hotbar[+el.dataset.i] = v; saveHotbar(); };
      el.draggable = true;
      el.ondragstart = (e) => { const v = G.char.hotbar[+el.dataset.i]; if (!v) return e.preventDefault(); e.dataTransfer.setData('text/plain', v); e.dataTransfer.setData('from', el.dataset.i); };
    }
  }
  function slotHtml(i, k) { return `<div class="slot" data-i="${i}"><img><span class="qty"></span><kbd>${k}</kbd><div class="cd"></div><span class="cdt"></span></div>`; }
  function saveHotbar() { G.send({ t: 'hotbar', slots: G.char.hotbar }); renderHotbar(); }
  UI.hotkeyIndex = function (ev) {
    if (ev.ctrlKey || ev.metaKey) return -1;
    const m = /^Digit(\d)$/.exec(ev.code || '');
    if (m && !ev.altKey) { const d = (+m[1] + 9) % 10; return (ev.shiftKey ? 1 - UI.hbPage : UI.hbPage) * HB_ROW + d; }
    return -1;
  };
  UI.hotkeyLabel = (i) => i < HB_N ? `ชุด${(i / HB_ROW | 0) + 1}·${HOTKEYS[i]}` : `#${i + 1}`;
  UI.typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); };
  UI.focusChat = () => $('#chatIn').focus();
  UI.blurChat = () => { if (UI.typing()) document.activeElement.blur(); };
  UI.windowKey = function (k, ev) { if (k === '`') { G.send({ t: 'autoOn', on: !G.autoOn() }); return; } const w = WINKEYS[k]; if (w) { if (w === 'gm' && !G.char.gm) return; UI.toggle(w); ev.preventDefault(); } };

  UI.onEnter = function (m) {
    show('hud');
    $('#disc').hidden = true;
    $('#gmBtn').hidden = !G.char.gm;
    const info = m.info;
    $('#mapName').textContent = info.name;
    $('#mapSub').textContent = info.th + (info.lv ? ` · Lv ${info.lv}${info.max ? '–' + info.max : ''}` : '');
    $('#mapBadges').innerHTML = (info.pvp ? '<span class="badge red">PvP</span>' : '<span class="badge green">SAFE</span>') + (info.kind === 'town' ? '<span class="badge gold">TOWN</span>' : '') + (info.auto ? '<span class="badge blue">AUTO OK</span>' : '<span class="badge grey">NO AUTO</span>') + (info.kind === 'dungeon' ? `<span class="badge purple">F${info.floor}/1000</span>` : '');
    UI.banner(`${info.name}`, info.th, 'map');
    UI.hideDead();
    renderPortrait(); renderHotbar(); UI.buffs(); renderParty();
    for (const w of UI.open) renderWin(w);
  };
  function renderPortrait() {
    if (!G.char) return;
    $('#pPortrait').src = ART.portrait(G.char.cls, G.char.name, 96);
    $('#pName').textContent = G.char.name;
    $('#pClass').textContent = `${D.CLASSES[G.char.cls].name}`;
    $('#resName').textContent = D.CLASSES[G.char.cls].res.name;
  }
  UI.refresh = function (keys) {
    if (keys.includes('hotbar') || keys.includes('skills') || keys.includes('inv')) renderHotbar();
    if (keys.includes('party')) renderParty();
    if (keys.includes('lv')) { renderPortrait(); }
    for (const w of UI.open) renderWin(w);
  };
  UI.renderHotbar = () => renderHotbar();
  function renderHotbar() {
    if (!G.char) return;
    for (const el of document.querySelectorAll('.hotbar .slot[data-i]')) {
      const v = G.char.hotbar[+el.dataset.i];
      const img = el.querySelector('img'), q = el.querySelector('.qty');
      el.dataset.skill = ''; el.dataset.itemid = '';
      if (!v) { img.removeAttribute('src'); img.style.visibility = 'hidden'; q.textContent = ''; el.classList.remove('locked', 'kbuff', 'kult'); continue; }
      img.style.visibility = 'visible';
      if (v.startsWith('item:')) { const id = v.slice(5); img.src = ART.itemIcon({ id }); const n = G.char.inv.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0); q.textContent = n; el.classList.toggle('locked', !n); el.dataset.itemid = id; }
      else { const sk = SKS()[v]; if (!sk) continue; img.src = ART.skillIcon(sk); const lk = !G.skillLv(v); q.textContent = lk ? 'Lv' + sk.reqLv : ''; el.dataset.skill = v; el.classList.toggle('locked', lk); el.classList.toggle('kbuff', sk.cat === 'buff'); el.classList.toggle('kult', sk.cat === 'ult' || sk.cat === 'set'); }
    }
  }
  function renderParty() {
    const pt = G.char && G.char.party;
    $('#partyFrames').innerHTML = pt ? pt.members.filter((m) => m.cid !== G.char.id).map((m) => `<div class="pmem" data-pid="${m.id}"><img src="${ART.classIcon(m.cls, 28)}"><div><b>${esc(m.name)}${pt.leader === m.cid ? ' ♛' : ''}</b><small>Lv${m.lv} · ${esc(mapName(m.map))}</small><div class="bar hp"><i></i></div></div></div>`).join('') : '';
  }
  UI.buffs = function () {
    const el = $('#buffs'); if (!el) return;
    el.innerHTML = (G.buffs || []).map((b) => `<div class="buff ${b.debuff ? 'de' : ''}" style="--c:${b.icon || '#8f8'}" data-tip="${esc(b.n)}" data-until="${b.until}"><span>${esc((b.n || '?').slice(0, 2))}</span><i></i></div>`).join('');
  };

  let hudTick = 0;
  UI.hud = function () {
    const me = G.sme; if (!me || !G.char) return;
    setBar('#hpBar', me.hp, me.mhp, `${fmt(me.hp)} / ${fmt(me.mhp)}`);
    setBar('#spBar', me.sp, me.msp, `${fmt(me.sp)} / ${fmt(me.msp)}`);
    $('#shieldBar').style.width = Math.min(100, (me.sh || 0) / me.mhp * 100) + '%';
    $('#pLv').textContent = me.lv;
    // resource
    const rmax = me.rmax;
    const mc = (D.CLASSES[G.char.cls].mech || {}).c || '#ffd34a', rk = G.char.cls + ':' + Math.floor(me.res) + '/' + rmax;
    if ($('#resBar').dataset.k !== rk) {
      $('#resBar').dataset.k = rk;
      const pips = Array.from({ length: rmax }, (_, i) => `<b class="${i < Math.floor(me.res) ? 'on' : ''}" style="--c:${mc}"></b>`).join('');
      $('#resBar').innerHTML = pips;
      const g = $('#cmgauge'); if (g) g.innerHTML = `<em style="color:${mc}">${esc(D.CLASSES[G.char.cls].res.name)}</em><span class="pips">${pips}</span>`;
    }
    // ult
    const ult = $('#ult'); ult.style.setProperty('--p', me.ult + '%'); ult.classList.toggle('ready', me.ult >= 100); $('#ultTxt').textContent = me.ult >= 100 ? 'ULTIMATE READY' : `ULT ${me.ult}%`;
    // exp
    const next = F.expToNext(me.lv);
    $('#expFill').style.width = (G.char.lv >= 250 ? 100 : Math.min(100, me.exp / next * 100)) + '%';
    $('#expTxt').textContent = G.char.lv >= 250 ? 'MAX LEVEL' : `EXP ${(me.exp / next * 100).toFixed(2)}%  (${fmt(me.exp)} / ${fmt(next)})`;
    // combo
    const cb = $('#combo');
    if (me.cb >= 2) {
      cb.hidden = false; $('#comboN').textContent = me.cb; $('#comboBonus').textContent = `+${Math.min(20, me.cb) * 3}% DMG`;
      $('#comboTimer').style.width = Math.max(0, me.cbt / (G.st.comboWin || 2.5) * 100) + '%';
      if (cb.dataset.n != me.cb) { cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); cb.dataset.n = me.cb; }
    } else cb.hidden = true;
    // cast bar
    const cbar = $('#castBar');
    if (me.cast) { cbar.hidden = false; const sk = SKS()[me.cast[0]]; $('#castName').textContent = sk ? sk.name : ''; $('#castFill').style.width = (1 - me.cast[1] / me.cast[2]) * 100 + '%'; } else cbar.hidden = true;
    // auto
    $('#autoToggle').classList.toggle('on', !!me.au); $('#autoToggle').querySelector('b').textContent = me.au ? 'AUTO ON' : 'AUTO OFF';
    $('#autoBadge').hidden = !me.au;
    if (me.dead && $('#death').hidden) UI.dead({ by: '', loss: 0 });
    if (!me.dead && !$('#death').hidden) UI.hideDead();
    // target frame
    renderTarget();
    // party hp
    for (const el of document.querySelectorAll('.pmem')) { const e = G.ents.get(+el.dataset.pid); el.querySelector('.bar i').style.width = (e ? e.hp : 0) + '%'; el.classList.toggle('far', !e); }
    const mb = document.querySelector('[data-win="mail"]'); if (mb) mb.classList.toggle('badge-dot', !!G.char.unread);
    if (me.cb >= 3 && me.cb !== UI._lastCb && window.SFX) SFX.combo(me.cb);
    UI._lastCb = me.cb;
    if (++hudTick % 5 === 0) { $('#coords').textContent = `${G.self.x.toFixed(0)}, ${G.self.y.toFixed(0)}`; $('#net').textContent = `${G.ping}ms · ${G.fps}fps`; }
  };
  function setBar(sel, v, max, txt) { const el = $(sel); el.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; el.querySelector('span').textContent = txt; }
  function renderTarget() {
    const e = G.ents.get(G.target);
    const tf = $('#tframe');
    if (!e || e.id === G.me || e.k === 'z') { tf.hidden = true; return; }
    tf.hidden = false;
    let badge = '', sub = '';
    if (e.k === 'm') { badge = e.rk === 4 ? '<span class="badge red">WORLD BOSS</span>' : e.rk >= 2 ? '<span class="badge orange">BOSS</span>' : e.rk === 1 ? '<span class="badge gold">ELITE</span>' : ''; sub = `Lv ${e.lv} · ${(D.ELEMENTS[e.el] || {}).n || ''}${e.ws ? ' · ' + e.ws : ''}`; }
    else if (e.k === 'p') { badge = `<span class="badge blue">${D.CLASSES[e.c].name}</span>`; sub = `Lv ${e.lv}${e.g ? ' · <' + esc(e.g) + '>' : ''}`; }
    else if (e.k === 'n') { sub = e.th || ''; }
    else if (e.k === 'c') { badge = '<span class="badge purple">CRYSTAL CORE</span>'; sub = e.g || ''; }
    else if (e.k === 's') { badge = '<span class="badge purple">SUMMON</span>'; }
    const key = e.id + '|' + e.hp + '|' + e.tags + '|' + e.fl + '|' + (e.ws || '');
    if (tf.dataset.key === key) return; tf.dataset.key = key;
    $('#tName').innerHTML = `${esc(e.n)} ${badge}`;
    $('#tSub').textContent = sub;
    $('#tHp').querySelector('i').style.width = e.hp + '%'; $('#tHp').querySelector('span').textContent = e.k === 'n' ? '' : e.hp + '%';
    $('#tHp').hidden = e.k === 'n';
    $('#tTags').innerHTML = G.tagList(e).map((t) => ART.tagChip(t)).join('');
  }

  // per animation frame: cooldowns, minimap, buffs timers
  let miniT = 0;
  UI.frame = function (dt) {
    if (!G.char) return;
    const nowS = performance.now() / 1000;
    for (const el of document.querySelectorAll('.hotbar .slot[data-i]')) {
      const id = el.dataset.skill; const cdEl = el.querySelector('.cd'), cdt = el.querySelector('.cdt');
      if (!id) { cdEl.style.background = 'none'; cdt.textContent = ''; continue; }
      const left = Math.max(0, (G.cds[id] || 0) - nowS), dur = G.cdDur[id] || 1;
      if (left > 0.05) { cdEl.style.background = `conic-gradient(rgba(0,0,0,0.72) ${left / dur * 360}deg, transparent 0)`; cdt.textContent = left >= 1 ? Math.ceil(left) : left.toFixed(1); }
      else { cdEl.style.background = 'none'; cdt.textContent = ''; }
      const sk = SKS()[id];
      if (sk && G.sme) {
        const lv = G.skillLv(id);
        const nosp = lv && G.sme.sp < F.skillSp(sk, lv);
        const noult = sk.kind === 'ult' && G.sme.ult < 100;
        el.classList.toggle('nosp', !!(nosp || noult));
        el.classList.toggle('ultready', sk.kind === 'ult' && G.sme.ult >= 100 && lv > 0);
      }
    }
    const bf = $('#bfBtn .cd'); const bl = Math.max(0, (G.cds.breakfree || 0) - nowS); bf.style.background = bl > 0 ? `conic-gradient(rgba(0,0,0,0.72) ${bl / 25 * 360}deg, transparent 0)` : 'none';
    miniT += dt;
    if (miniT > 0.2) { miniT = 0; drawMini(); for (const b of document.querySelectorAll('.buff')) { const l = +b.dataset.until - G.t; b.querySelector('i').textContent = l > 3600 ? Math.round(l / 3600) + 'h' : l > 60 ? Math.round(l / 60) + 'm' : Math.max(0, Math.round(l)); } }
  };
  function drawMini() {
    const cv = $('#minicv'), g = cv.getContext('2d');
    // backing store follows the on-screen size × device pixel ratio so the minimap stays sharp on phones / hi-dpi screens
    const want = Math.round((cv.clientWidth || 190) * Math.min(3, window.devicePixelRatio || 1));
    if (want > 0 && cv.width !== want) { cv.width = cv.height = want; }
    const S = cv.width, R = 70, k = S / 190; // tiles radius, dot scale
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    if (!G.mini) return;
    const sc = S / (R * 2);
    g.imageSmoothingEnabled = false;
    g.drawImage(G.mini, G.self.x - R, G.self.y - R, R * 2, R * 2, 0, 0, S, S);
    for (const e of G.ents.values()) {
      if (e.fl & 1 && e.k !== 'n') continue;
      const x = (e.x - G.self.x + R) * sc, y = (e.y - G.self.y + R) * sc;
      if (x < 0 || y < 0 || x > S || y > S) continue;
      let c = null, r = 2;
      if (e.k === 'm') { c = e.rk >= 2 ? '#ff8a00' : e.rk === 1 ? '#ffd34a' : '#ff4a4a'; r = e.rk >= 2 ? 5 : 2; }
      else if (e.k === 'p' && e.id !== G.me) { c = e.pt ? '#4aff7a' : G.isEnemy(e) ? '#ff40ff' : '#ffffff'; r = 2.5; }
      else if (e.k === 'n') { c = e.role === 'chest' ? (e.op & 2 ? '#555' : (D.CHESTS[e.tr] || {}).color || '#fff') : e.role === 'stairs' || e.role === 'portal' ? '#c08aff' : '#ffe14a'; r = e.role === 'chest' ? 3.5 : 3; }
      else if (e.k === 'c') { c = '#5ad0ff'; r = 5; }
      if (!c) continue;
      g.fillStyle = c; g.beginPath(); g.arc(x, y, r * k, 0, 7); g.fill();
    }
    g.save(); g.translate(S / 2, S / 2); g.scale(k, k); const se = G.selfEnt(); g.rotate((se ? se.dir : 0) + Math.PI / 2);
    g.fillStyle = '#5ad0ff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  // ================================================================ notices & chat
  UI.toast = function (m, kind) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = m;
    if (window.SFX && kind === 'err') SFX.err();
    $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 2200); setTimeout(() => el.remove(), 2700);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  };
  const bannerQ = []; let bannerBusy = false;
  UI.banner = function (title, sub, kind) {
    if (kind === 'map') { for (let i = bannerQ.length - 1; i >= 0; i--) if (bannerQ[i].kind === 'map') bannerQ.splice(i, 1); bannerQ.unshift({ title, sub, kind }); }
    else { bannerQ.push({ title, sub, kind }); if (bannerQ.length > 4) bannerQ.splice(0, bannerQ.length - 4); }
    if (!bannerBusy) nextBanner();
  };
  function nextBanner() {
    const b = bannerQ.shift(); if (!b) { bannerBusy = false; return; }
    bannerBusy = true;
    const el = $('#banner'); el.className = 'banner show ' + (b.kind || ''); el.innerHTML = `<b>${esc(b.title)}</b>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}`;
    setTimeout(() => { el.className = 'banner'; setTimeout(nextBanner, 300); }, b.kind === 'map' ? 2000 : bannerQ.length > 1 ? 2600 : 4000);
  }
  UI.notice = function (m, k) {
    UI.chat('system', '', m, k);
    if (['world', 'boss', 'gvg', 'refine', 'loot', 'event', 'gm', 'pvp'].includes(k)) { UI.banner(m, '', k); if (window.SFX) { if (k === 'boss') SFX.boss(); else if (k === 'loot') SFX.rare(); else SFX.notice(); } }
    else UI.toast(m, k === 'warn' ? 'err' : k === 'level' ? 'gold' : '');
  };
  UI.chat = function (ch, f, m, k) {
    UI.log.push({ ch, f, m, k, t: new Date() });
    if (UI.log.length > 250) UI.log.shift();
    renderChat();
  };
  const CH_COL = { map: '#fff', world: '#ffb347', party: '#7dff9a', guild: '#8ad0ff', whisper: '#ff8ad8', system: '#ffe680' };
  const CH_NAME = { map: 'แผนที่', world: 'โลก', party: 'ปาร์ตี้', guild: 'กิลด์', whisper: 'กระซิบ', system: 'ระบบ' };
  function renderChat() {
    const el = $('#chatLog');
    const list = UI.log.filter((x) => UI.chatTab === 'all' || x.ch === UI.chatTab || (UI.chatTab === 'system' && x.ch === 'system'));
    el.innerHTML = list.slice(-80).map((x) => `<div style="color:${CH_COL[x.ch] || '#fff'}"><i>[${CH_NAME[x.ch] || x.ch}]</i> ${x.f ? `<b>${esc(x.f)}:</b> ` : ''}${esc(x.m)}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }
  UI.gmOut = function (m) { UI.chat('system', 'GM', m); const o = $('#gmOut'); if (o) { o.textContent += '\n> ' + m; o.scrollTop = o.scrollHeight; } };
  UI.loot = function (m) {
    if (window.SFX) { if (m.items.some((x) => /Legendary|Mythic|Epic/.test(x))) SFX.rare(); else SFX.loot(); }
    for (const it of m.items) { const el = document.createElement('div'); el.className = 'lootItem'; el.textContent = '+ ' + it; $('#lootFeed').appendChild(el); setTimeout(() => el.classList.add('out'), 3000); setTimeout(() => el.remove(), 3600); }
    while ($('#lootFeed').children.length > 7) $('#lootFeed').firstChild.remove();
  };
  UI.killfeed = function (m) {
    const el = document.createElement('div'); el.className = 'kf'; el.innerHTML = `<img src="${ART.classIcon(m.kc, 20)}"><b>${esc(m.k)}</b> ⚔ <img src="${ART.classIcon(m.vc, 20)}">${esc(m.v)}`;
    $('#killFeed').appendChild(el); setTimeout(() => el.remove(), 6000);
  };
  UI.ultBanner = function (name, by, col) {
    const el = $('#ultBanner'); el.innerHTML = `<small>${esc(by)}</small><b style="--c:${col}">${esc(name)}</b>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  };
  UI.dead = function (m) { if ($('#death').hidden && window.SFX) SFX.death(); $('#death').hidden = false; $('#deathBy').textContent = m.by ? `ถูกสังหารโดย ${m.by}` : 'คุณล้มลงแล้ว'; $('#deathLoss').textContent = m.loss ? `เสีย EXP ${fmt(m.loss)}` : ''; };
  UI.hideDead = () => { $('#death').hidden = true; };
  UI.autoReport = function (m) { UI.notice(`รายงานออโต้: ${m.mins} นาที · ฆ่า ${m.kills} ตัว · Zeny ${m.zeny >= 0 ? '+' : ''}${fmt(m.zeny)} · เลเวล +${m.lv}`, 'level'); };
  UI.invite = function (m) {
    const el = document.createElement('div'); el.className = 'invite';
    el.innerHTML = `<b>${m.kind === 'party' ? '👥 คำเชิญปาร์ตี้' : m.kind === 'trade' ? '🤝 คำขอเทรด' : '🏰 คำเชิญกิลด์'}</b><p>${esc(m.from)} ${m.kind === 'trade' ? 'ขอเทรดกับคุณ' : 'เชิญคุณ'}</p><button class="btn gold">ตอบรับ</button><button class="btn">ปฏิเสธ</button>`;
    if (window.SFX) SFX.notice();
    const [ok, no] = el.querySelectorAll('button');
    ok.onclick = () => { G.send({ t: m.kind, a: 'accept', id: m.id }); el.remove(); };
    no.onclick = () => el.remove();
    $('#popups').appendChild(el); setTimeout(() => el.remove(), 60000);
  };
  UI.playerMenu = function (e, x, y) {
    closeCtx();
    const el = document.createElement('div'); el.className = 'ctx'; el.style.left = x + 'px'; el.style.top = y + 'px';
    el.innerHTML = `<b>${esc(e.n)}</b><button data-a="party">เชิญปาร์ตี้</button><button data-a="guild">เชิญกิลด์</button><button data-a="trade">ขอเทรด</button><button data-a="friend">เพิ่มเพื่อน</button><button data-a="w">กระซิบ</button><button data-a="duel">ท้าดวล</button>`;
    el.onclick = (ev) => { const a = ev.target.dataset.a; if (!a) return; if (a === 'party') G.send({ t: 'party', a: 'invite', name: e.n }); if (a === 'guild') G.send({ t: 'guild', a: 'invite', name: e.n }); if (a === 'w') { $('#chatIn').value = `/w ${e.n} `; UI.focusChat(); } if (a === 'duel') G.send({ t: 'chat', m: `/duel ${e.n}` }); if (a === 'trade') G.send({ t: 'trade', a: 'request', name: e.n }); if (a === 'friend') G.send({ t: 'friend', a: 'add', name: e.n }); closeCtx(); };
    document.body.appendChild(el); setTimeout(() => document.addEventListener('mousedown', closeCtx, { once: true }), 0);
  };
  function closeCtx() { for (const c of document.querySelectorAll('.ctx')) c.remove(); }

  // ================================================================ tooltips
  function setupTooltip() {
    const tip = $('#tip');
    document.addEventListener('mousemove', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip],[data-skill],[data-item],[data-itemid],[data-gear]');
      if (!t) { tip.hidden = true; return; }
      let html = '';
      if (t.dataset.skill) html = skillTip(t.dataset.skill);
      else if (t.dataset.item) html = itemTip(findItem(t.dataset.item));
      else if (t.dataset.itemid) html = itemTip({ id: t.dataset.itemid });
      else if (t.dataset.gear) html = itemTip(UI.gearPreview(t.dataset.gear));
      else html = esc(t.dataset.tip);
      if (!html) { tip.hidden = true; return; }
      tip.innerHTML = html; tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 16) + 'px';
      tip.style.top = Math.max(8, Math.min(innerHeight - h - 8, e.clientY + 16)) + 'px';
    });
  }
  function findItem(uid) {
    if (!G.char) return null;
    return G.char.inv.find((x) => x.uid === uid) || Object.values(G.char.equip).find((x) => x && x.uid === uid) || (UI.chest && UI.chest.items.find((x) => x.uid === uid)) || null;
  }
  UI.findItem = findItem;
  const OPT_LABEL = Object.fromEntries(D.OPTIONS.map((o) => [o[0], [o[1], o[3]]]));
  function statLine(k, v) { const l = OPT_LABEL[k] || [k, false]; return `${l[0]} +${v}${l[1] ? '%' : ''}`; }
  function itemTip(it) {
    if (!it) return '';
    if (it.type !== 'equip') {
      const d = D.ITEMS[it.id]; if (!d) return '';
      let extra = '';
      if (d.type === 'potion') extra = `${d.hp ? `ฟื้น HP ${fmt(d.hp)}` : ''}${d.sp ? `ฟื้น SP ${fmt(d.sp)}` : ''} · ต้อง Lv${d.lv}`;
      if (d.type === 'rune') extra = `${D.RUNE_KINDS[d.kind].type} Rune · ${statLine(D.RUNE_KINDS[d.kind].stat, F.runeValue(d.kind, d.tier))}<br>ฝังในอาวุธ/เกราะที่มีช่องรูน · รวม 3 อัน = ระดับถัดไป · ใส่ชนิดเดียวกัน 3 ชิ้น = Rune Set +25%`;
      if (d.type === 'jewel') extra = `${statLine(D.JEWELS[d.kind].stat, F.jewelValue(d.kind, d.tier))}<br>ฝังในเครื่องประดับ · รวม 5 อัน = ระดับถัดไป`;
      const desc = { tele_scroll: 'วาร์ปกลับเมืองล่าสุด', ore_refine: 'วัตถุดิบตีบวก +1 ~ +10', crystal_pure: 'วัตถุดิบตีบวก +11 ~ +15', crystal_divine: 'วัตถุดิบตีบวก +16 ~ +20', scroll_protect: 'ป้องกันของพังเมื่อตีบวกล้มเหลว', scroll_bless: 'ป้องกันระดับลดเมื่อตีบวกล้มเหลว', rune_drill: 'เจาะช่องรูนเพิ่ม (โอกาส 60%)', reroll_stone: 'สุ่มออปชั่นอุปกรณ์ใหม่', memory_crystal: 'รีเซ็ตสกิล', stat_reset: 'รีเซ็ตสเตตัส', guild_emblem: 'ใช้สร้างกิลด์', monster_core: 'ขายให้ร้านค้าได้' }[it.id] || '';
      if (d.type === 'card') extra = Object.entries(d.mods).map(([k, v]) => `<div class="opt">◆ ${statLine(k, v)}</div>`).join('') + '<small>ฝังในช่องรูนของอาวุธ/เกราะ</small>';
      if (d.type === 'buffitem' && d.buff) extra = Object.entries(d.buff).map(([k, v]) => `<div class="opt">◆ ${typeof v === 'number' ? statLine(k, v) : 'ธาตุอาวุธ: ' + v}</div>`).join('') + `<small>นาน ${Math.round(d.dur / 60)} นาที</small>`;
      if (d.type === 'anvil') extra = `โอกาสตีบวกสำเร็จ +${d.bonus}%`;
      const src = d.sp && D.SPECIES[d.sp] ? `<small class="src">ดรอปจาก: ${esc(D.SPECIES[d.sp].name)} · ${esc(D.SPECIES[d.sp].where)}</small>` : '';
      const catTh = { support: 'ซัพพอร์ต', material: 'วัตถุดิบ', refine: 'ตีบวก', socket: 'ฝังช่อง', junk: 'ขยะ', sell: 'ของขาย', box: 'กล่องสุ่ม', other: 'อื่นๆ' }[D.itemCategory(d)];
      return `<div class="tt"><b>${esc(d.n)}</b> <small>[${catTh}] ${esc(d.th || '')}</small><p>${extra || desc}</p>${src}${it.qty ? `<small>จำนวน ${it.qty}</small>` : ''}<small class="price">ขายได้ ${fmt(d.sell || Math.floor((d.price || 10) / 4))} z</small></div>`;
    }
    const R = D.RARITY[it.rarity];
    const st = F.itemStats(it, {});
    const base = ['atk', 'matk', 'def', 'mdef', 'hp'].filter((k) => st[k]).map((k) => `<div class="tl">${k.toUpperCase()} <b>${fmt(st[k])}</b></div>`).join('');
    const opts = (it.imp || []).map(([k, v]) => `<div class="opt imp">✦ ${statLine(k, v)}</div>`).join('') + (it.opts || []).map(([k, v, tr]) => `<div class="opt t${tr || 0}">◆ ${statLine(k, v)}${tr ? ` <small class="tier">T${tr}</small>` : ''}</div>`).join('');
    const gb = it.base && D.GEAR[it.base];
    const origin = gb ? `<small class="src">${gb.src === 'field' ? 'ดรอปที่ ' + esc((D.FARM_MAPS.find((f) => f.id === gb.map) || {}).name || '') : gb.src === 'dungeon' ? 'ดรอปในดันเจี้ยน ' + esc(D.DUNGEONS.find((x) => x.id === gb.dungeon).name) : gb.src === 'craft' ? 'คราฟต์ได้ (Alchemist)' : 'Mythic — คราฟต์จากวัตถุดิบ World Boss'}</small>` : '';
    const runes = it.sockets ? `<div class="sock">${Array.from({ length: it.sockets }, (_, i) => it.runes && it.runes[i] ? `<span style="--c:${D.ITEMS[it.runes[i]].icon}">${esc(D.ITEMS[it.runes[i]].n)}</span>` : '<span class="empty">ช่องรูน/การ์ดว่าง</span>').join('')}</div>` : '';
    const jw = it.jewelSlots ? `<div class="sock">${Array.from({ length: it.jewelSlots }, (_, i) => it.jewels && it.jewels[i] ? `<span style="--c:${D.ITEMS[it.jewels[i]].icon}">${esc(D.ITEMS[it.jewels[i]].n)}</span>` : '<span class="empty">ช่องอัญมณีว่าง</span>').join('')}</div>` : '';
    const cls = it.slot === 'weapon' ? F.classesForWeapon(it.wtype).map((c) => D.CLASSES[c].name).join(', ') : 'ทุกคลาส';
    const cur = it.slot && G.char.equip[it.slot === 'ring' ? 'ring1' : it.slot];
    let cmp = '';
    if (cur && cur.uid !== it.uid) { const cs = F.itemStats(cur, {}); const diff = ['atk', 'matk', 'def', 'hp'].map((k) => [k, (st[k] || 0) - (cs[k] || 0)]).filter(([, v]) => v); cmp = diff.length ? `<div class="cmp">เทียบกับที่สวม: ${diff.map(([k, v]) => `<span class="${v > 0 ? 'up' : 'down'}">${k.toUpperCase()} ${v > 0 ? '+' : ''}${fmt(v)}</span>`).join(' ')}</div>` : ''; }
    return `<div class="tt"><b style="color:${R.color}">${it.refine ? '+' + it.refine + ' ' : ''}${esc(it.name)}</b><small style="color:${R.color}">[${R.n}] ${D.SLOT_TH[it.slot] || it.slot} · iLv ${it.ilv} · ต้อง Lv ${it.reqLv}${it.quality ? ` · คุณภาพ <b style="color:${it.quality >= 110 ? '#ffd34a' : it.quality < 92 ? '#aaa' : '#fff'}">${it.quality}%</b>` : ''}</small>${base}${opts}${runes}${jw}${origin}<small>ใช้ได้: ${cls}</small>${cmp}<small class="price">ขายได้ ${fmt(sellPrice(it))} z</small></div>`;
  }
  function sellPrice(it) { if (it.type === 'equip') return Math.round((it.ilv * 25 + 40) * (1 + it.rarity * it.rarity * 0.8) * (1 + (it.refine || 0) * 0.15)); const d = D.ITEMS[it.id]; return d.sell || Math.floor((d.price || 10) / 4); }
  const SHAPE_TH = { single: 'เป้าเดียว', circle: 'วงกลม AoE', line: 'เส้นตรง', cone: 'รูปกรวย', chain: 'กระโดดหลายเป้า', self: 'ตัวเอง' };
  function skillTip(id) {
    const sk = SKS()[id]; if (!sk) return '';
    const lv = G.char ? G.skillLv(id) : 0;
    const parts = String(sk.desc).split(' · ◆ '), base = parts[0].split(' · ✦ ')[0];
    if (sk.cat) return `<div class="tt sk"><b>${esc(sk.name)}</b> <small>${{ atk: 'โจมตี', buff: 'บัฟ', ult: 'อัลติเมต', set: 'อัลติเมตคลาส' }[sk.cat]} · Lv ${lv}/${sk.maxLv} · ต้อง Lv${sk.reqLv}</small>${skillNumbers(sk, Math.max(1, lv))}<p>${esc(base)}</p>${sk.ability ? `<div class="abil"><b>✦</b> ${esc(sk.ability)}</div>` : ''}${parts[1] ? `<div class="mrole"><b>◆</b> ${esc(parts[1])}</div>` : ''}${skillChips(sk)}</div>`;
    return `<div class="tt sk"><b>${esc(sk.name)}</b> <small>Lv ${lv}/${sk.maxLv} · ต้อง Lv${sk.reqLv}</small>${skillNumbers(sk, Math.max(1, lv))}<p>${esc(sk.desc)}</p>${sk.trait ? `<div class="trait">✦ ${esc(sk.trait.th)}</div>` : ''}${skillChips(sk)}${window.VFX && VFX.ok && VFX.recipes[sk.id] ? `<small>VFX: ${esc(VFX.describe(sk.id))}</small>` : sk.fx ? `<small>เอฟเฟกต์: ${esc(sk.fx.pn)} · ${esc(sk.fx.mn)}</small>` : ''}</div>`;
  }
  function skillNumbers(sk, lv) {
    const m = F.skillMult(sk, lv);
    const parts = [];
    if (sk.kind !== 'ult') parts.push(`<span>SP <b>${F.skillSp(sk, lv)}</b></span>`); else parts.push('<span>ใช้ <b>ULT 100%</b></span>');
    parts.push(`<span>CD <b>${F.skillCd(sk, lv)}s</b></span>`);
    if (sk.cast) parts.push(`<span>ร่าย <b>${sk.cast}s</b></span>`);
    if (sk.kind === 'buff') parts.push(`<span>นาน <b>${sk.dur >= 60 ? Math.round(sk.dur / 60) + 'm' : sk.dur + 's'}</b></span>`);
    else {
      if (sk.dmg) parts.push(`<span>ดาเมจ <b>${Math.round(sk.dmg * m * 100)}%${sk.hits > 1 ? ' ×' + sk.hits : ''}</b></span>`);
      if (sk.perUnit) parts.push(`<span>+<b>${Math.round(sk.perUnit * m * 100)}%</b>/${sk.unit === 'res' ? 'แต้ม' : sk.unit === 'summon' ? 'สมุน' : 'ชั้น'}</span>`);
      if (sk.zone) parts.push(`<span>โซน <b>${Math.round(sk.zone.mult * m * 100)}%/${sk.zone.tick}s ${sk.zone.dur}s</b></span>`);
      parts.push(`<span>ระยะ <b>${sk.range}</b></span><span>${SHAPE_TH[sk.shape] || sk.shape}${sk.radius ? ' r' + sk.radius : ''}${sk.length ? ' ' + sk.length + 'ช่อง' : ''}</span>`);
    }
    return `<div class="nums">${parts.join('')}</div>`;
  }
  function skillChips(sk) {
    const c = [];
    for (const a of sk.applies || []) c.push(`<span class="tag" style="--c:${D.TAGS[a.tag].color}">ใส่ ${D.TAGS[a.tag].icon} ${D.TAGS[a.tag].n}${a.stacks > 1 ? ' ×' + a.stacks : ''}</span>`);
    for (const t of sk.consumes || []) c.push(`<span class="tag cons" style="--c:${D.TAGS[t].color}">ใช้ ${D.TAGS[t].icon} ${D.TAGS[t].n}</span>`);
    for (const [t, p] of sk.bonusIf || []) c.push(`<span class="tag bonus" style="--c:${D.TAGS[t].color}">ถ้ามี ${D.TAGS[t].n} +${p}%</span>`);
    if (sk.reaction) c.push(`<span class="tag" style="--c:${D.REACTIONS[sk.reaction].color}">⚡ ${D.REACTIONS[sk.reaction].n}</span>`);
    if (sk.cond) c.push(`<span class="tag cond">${sk.cond.type === 'targetHp' ? `HP เป้า < ${sk.cond.v}%` : sk.cond.type === 'selfHp' ? `HP เรา < ${sk.cond.v}%` : `Combo ≥ ${sk.cond.v}`}</span>`);
    if (sk.chainAfter) c.push(`<span class="tag cond">ต่อจาก ${esc(SKS()[sk.chainAfter] ? SKS()[sk.chainAfter].name : '')} ×1.5</span>`);
    if (sk.consumeRes) c.push('<span class="tag cond">ใช้พลังพิเศษทั้งหมด</span>');
    if (sk.move) c.push(`<span class="tag mv">เคลื่อนที่ ${sk.move.type} ${sk.move.dist}</span>`);
    if (sk.summon) c.push(`<span class="tag mv">เรียก ${sk.summon.count} ตัว</span>`);
    if (sk.trap) c.push('<span class="tag mv">กับดัก</span>');
    if (sk.heal) c.push(`<span class="tag heal">ฮีล ${sk.heal.pct}%</span>`);
    if (sk.party || (sk.transform && sk.transform.party)) c.push('<span class="tag heal">ทั้งปาร์ตี้</span>');
    if (sk.mods) for (const k in sk.mods) c.push(`<span class="tag heal">${k} ${typeof sk.mods[k] === 'number' ? '+' + sk.mods[k] : sk.mods[k]}</span>`);
    return c.length ? `<div class="chips">${c.join('')}</div>` : '';
  }

  // ================================================================ windows
  const WIN = {};
  UI.WIN = WIN; UI.esc = esc; UI.fmt = fmt; UI.sellPrice = (it) => sellPrice(it); UI.skillTip = (id) => skillTip(id); UI.itemTip = (it) => itemTip(it);
  UI.toggle = function (name) { if (UI.open.includes(name)) UI.close(name); else UI.show(name); };
  UI.show = function (name, opts) {
    const def = WIN[name]; if (!def) return;
    let w = UI.wins[name];
    if (!w) {
      w = document.createElement('div'); w.className = 'win'; w.dataset.name = name; w.style.width = def.w + 'px';
      w.innerHTML = `<div class="whead"><b>${def.title}</b><button class="x">✕</button></div><div class="wbody"></div>`;
      w.querySelector('.x').onclick = () => UI.close(name);
      drag(w, w.querySelector('.whead'));
      w.addEventListener('mousedown', () => focusWin(w));
      const body = w.querySelector('.wbody');
      body.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a && def.act) def.act(a.dataset.act, a.dataset, a, e); });
      body.addEventListener('change', (e) => { if (def.change) def.change(e.target, e); });
      body.addEventListener('input', (e) => { if (def.input) def.input(e.target, e); });
      $('#windows').appendChild(w);
      UI.wins[name] = w;
      const n = Object.keys(UI.wins).length;
      w.style.left = Math.max(10, Math.min(innerWidth - def.w - 10, 120 + (n % 6) * 40)) + 'px'; w.style.top = Math.max(10, 70 + (n % 5) * 26) + 'px';
    }
    w.opts = opts || w.opts || {};
    w.hidden = false;
    if (!UI.open.includes(name)) UI.open.push(name);
    focusWin(w);
    if (def.onOpen) def.onOpen(w);
    renderWin(name);
  };
  UI.close = function (name) { if (name === 'chest' && UI.chest) { G.send({ t: 'chest', id: UI.chest.id, a: 'close' }); UI.chest = null; } const w = UI.wins[name]; if (w) w.hidden = true; UI.open = UI.open.filter((x) => x !== name); };
  UI.closeTop = function () { const n = UI.open[UI.open.length - 1]; if (!n) return false; UI.close(n); return true; };
  let zTop = 100;
  function focusWin(w) { w.style.zIndex = ++zTop; const n = w.dataset.name; UI.open = UI.open.filter((x) => x !== n).concat(n); }
  function drag(el, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
      const mv = (ev) => { el.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - sx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - sy)) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
  }
  function renderWin(name) {
    const w = UI.wins[name], def = WIN[name];
    if (!w || w.hidden || !def || !G.char) return;
    const body = w.querySelector('.wbody');
    const sc = body.scrollTop;
    const inner = body.querySelector('.scrollKeep'); const isc = inner ? inner.scrollTop : 0;
    body.innerHTML = def.render(w.opts || {});
    body.scrollTop = sc;
    const ni = body.querySelector('.scrollKeep'); if (ni) ni.scrollTop = isc;
  }
  UI.renderWin = renderWin;
  UI.openNpc = function (n) {
    const r = n.role;
    if (r === 'shop') UI.show('shop'); else if (r === 'refine') UI.show('refine'); else if (r === 'rune') UI.show('rune');
    else if (r === 'teleport') UI.show('map'); else if (r === 'dungeon') UI.show('dungeon'); else if (r === 'guild') { UI.show('guild'); G.send({ t: 'info', what: 'gvg' }); }
    else if (r === 'arena') { UI.show('arena'); G.send({ t: 'info', what: 'wb' }); }
    else if (r === 'healer') G.send({ t: 'healer' });
    else if (r === 'training') G.send({ t: 'training' });
    else if (r === 'stairs') G.send({ t: 'stairs' });
    else if (r === 'chest') G.send({ t: 'chest', id: n.id, a: 'open' });
    else if (r === 'portal') G.send({ t: 'portal', id: n.id });
    else if (r === 'storage') UI.show('storage'); else if (r === 'market') UI.show('market'); else if (r === 'mail') UI.show('mail'); else if (r === 'quest') UI.show('quests'); else if (r === 'craft') UI.show('craft'); else if (r === 'stable') UI.show('pets', { tab: 'shop' });
  };
  UI.info = function (m) { UI.lastInfo = UI.lastInfo || {}; UI.lastInfo[m.what] = m; for (const w of UI.open) renderWin(w); };

  // ---------------------------------------------------------------- character
  WIN.char = {
    title: '👤 ตัวละคร', w: 640,
    render() {
      const ch = G.char, st = G.st, c = D.CLASSES[ch.cls];
      const slot = (s) => { const it = ch.equip[s]; return `<div class="eqslot" data-act="unequip" data-slot="${s}" data-th="${D.SLOT_TH[s]}" ${it ? `data-item="${it.uid}"` : ''}>${it ? `<img src="${ART.itemIcon(it)}">${it.refine ? `<em>+${it.refine}</em>` : ''}` : `<span>${D.SLOT_TH[s]}</span>`}</div>`; };
      const derived = [['ATK', st.atk], ['MATK', st.matk], ['DEF', st.def], ['MDEF', st.mdef], ['HP', st.maxHp], ['SP', st.maxSp], ['ASPD', st.aspd + '/s'], ['Crit', st.crit + '%'], ['Crit DMG', st.critDmg + '%'], ['Hit', st.hit], ['Flee', st.flee], ['ร่ายเร็ว', st.castReduce + '%'], ['ลด CD', st.cdr + '%'], ['เดิน', st.move], ['Lifesteal', st.lifesteal + '%'], ['ดาเมจ+', st.dmgPct + '%'], ['ลดดาเมจ', st.dmgReduce + '%'], ['คอมโบ+', st.comboDmg + '%'], ['บอส+', st.bossDmg + '%'], ['ดรอป+', st.dropPct + '%'], ['PvP+', st.pvpDmg + '%'], ['PvP ลด', st.pvpRes + '%'], ['ต้าน CC', st.ccRes + '%'], ['Combo Win', st.comboWin + 's']];
      const gearN = Object.values(ch.equip).filter(Boolean).length;
      return `<div class="charWin">
        <div class="paper"><div class="pdoll"><img src="${ART.portrait(ch.cls, ch.name, 140)}"><div class="pinfo"><b>${esc(ch.name)}</b><span style="color:${c.color}">${c.name} · Lv ${ch.lv}</span><small>${ch.guild ? '&lt;' + esc(ch.guild.name) + '&gt;' : 'ไม่มีกิลด์'}</small><small>Best Combo ${ch.bestCombo || 0}</small></div></div>
        <div class="eqgrid">${['head', 'necklace', 'weapon', 'armor', 'offhand', 'earring', 'cloak', 'ring1', 'gloves', 'ring2', 'boots', 'belt'].map(slot).join('')}</div><small class="hint">คลิกช่องเพื่อถอด · สวม ${gearN}/12 ${p_runesets()}</small></div>
        <div class="statCol"><div class="pts">ค่าสเตตัสเพิ่มขึ้นอัตโนมัติทุกเลเวล · Passive คงเหลือ <b>${ch.passivePts || 0}</b> <button class="btn tiny gold" data-act="tree">🌌 Passive Tree</button></div>
        ${(() => { const au = F.autoStats(ch.cls, ch.lv), gr = F.statGrowth(ch.cls), sb = ch.statBonus || {}, pm = (window.NO_PASSIVE ? NO_PASSIVE.modsOf(ch.passives) : {}); return D.STATS.map((s) => { const extra = (G.char.gear && G.char.gear[s] || 0) + (pm[s] || 0) + (sb[s] || 0); return `<div class="statRow auto" data-tip="${D.STAT_INFO[s]}"><b>${s.toUpperCase()}</b><span>${au[s] + extra}${extra ? `<em>(${au[s]} +${Math.round(extra)})</em>` : ''}</span><small>+${gr[s]}/เลเวล</small><i class="gbar" style="--w:${gr[s] / 0.8 * 100}%"></i></div>`; }).join(''); })()}
        <div class="derived">${derived.map(([k, v]) => `<div><small>${k}</small><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('')}</div>
        <button class="btn tiny" data-act="tree">ปรับแต่งด้วย Passive Tree (1000 โหนด)</button></div></div>`;
    },
    act(a, d) { if (a === 'unequip' && G.char.equip[d.slot]) G.send({ t: 'unequip', slot: d.slot }); if (a === 'tree') UI.show('passive'); }
  };
  function p_runesets() { const s = G.char.gear && G.char.gear.runeSets; return s && s.length ? '· Rune Set: ' + s.map((k) => D.RUNE_KINDS[k].n).join(', ') : ''; }

  // ---------------------------------------------------------------- inventory
  const INV_TABS = [['all', 'ทั้งหมด'], ['equip', 'อุปกรณ์'], ['use', 'ใช้ได้'], ['mat', 'วัตถุดิบ'], ['rune', 'รูน/การ์ด'], ['etc', 'ของขาย']];
  function invFilter(it, tab) {
    if (tab === 'all') return true;
    if (tab === 'equip') return it.type === 'equip';
    const d = D.ITEMS[it.id]; if (!d) return false;
    const cat = D.itemCategory(d);
    if (tab === 'use') return cat === 'support' || cat === 'box';
    if (tab === 'mat') return cat === 'material' || cat === 'refine';
    if (tab === 'rune') return cat === 'socket';
    if (tab === 'etc') return cat === 'junk' || cat === 'sell' || cat === 'other';
  }
  // inventory v9: CinderUI layout — equipment doll + attributes (left), tabbed 8-column bag (centre), item card (right)
  const EQ_ICON = { head: 'head', armor: 'chest', boots: 'feet', necklace: 'amulet', earring: 'trinket', ring1: 'ring', ring2: 'ring', weapon: 'weapon', offhand: 'offhand', cloak: 'chest', gloves: 'trinket', belt: 'trinket' };
  const INV_CAP = 150;
  WIN.inv = {
    title: 'INVENTORY · กระเป๋า', w: 1010,
    render() {
      const ch = G.char, st = G.st || {};
      let items = ch.inv.filter((it) => invFilter(it, UI.invTab));
      if (UI.invSort) items = items.slice().sort((x, y) => ((y.type === 'equip') - (x.type === 'equip')) || ((y.rarity || 0) - (x.rarity || 0)) || String(x.id || x.base).localeCompare(String(y.id || y.base)));
      const sel = findItem(UI.selItem);
      const rar = (it) => it.type === 'equip' ? ['common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary'][Math.min(5, it.rarity || 0)] : 'none';
      const cells = items.map((it) => `<div class="cell r-${rar(it)} ${UI.selItem === it.uid ? 'sel' : ''}" data-act="sel" data-uid="${it.uid}" data-item="${it.uid}" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${it.type === 'equip' ? '' : 'item:' + it.id}');event.dataTransfer.setData('from','')"><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty > 999 ? '999+' : it.qty}</span>` : ''}${it.refine ? `<em>+${it.refine}</em>` : ''}</div>`).join('');
      const shown = Math.max(40, Math.ceil((items.length + 1) / 8) * 8);
      const empties = '<div class="cell empty"></div>'.repeat(shown - items.length);
      const locked = ch.inv.length >= INV_CAP - 8 ? '' : '<div class="cell lock"></div>'.repeat(8);
      const slot = (s) => { const it = ch.equip[s]; return `<div class="eqs ${it ? 'r-' + rar(it) : 'emp'}" style="--ei:url(${new URL('client/assets/ui/cinder/', location.href).href}slot_equip_${EQ_ICON[s]}.png)" data-act="unequip" data-slot="${s}" data-tip="${D.SLOT_TH[s]}${it ? ' · คลิกเพื่อถอด' : ''}" ${it ? `data-item="${it.uid}"` : ''}>${it ? `<img src="${ART.itemIcon(it)}">${it.refine ? `<em>+${it.refine}</em>` : ''}` : ''}<i>${D.SLOT_TH[s]}</i></div>`; };
      const attrs = [['HP', st.maxHp], ['SP', st.maxSp], ['ATK', st.atk], ['MATK', st.matk], ['DEF', st.def], ['MDEF', st.mdef], ['Crit', (st.crit || 0) + '%'], ['ASPD', (Math.round((st.aspd || 0) * 100) / 100) + '/s']];
      const isUse = (it) => { const d = it && it.type !== 'equip' && D.ITEMS[it.id]; return d && ['potion', 'scroll', 'buffitem', 'cure', 'wing', 'box', 'pet', 'mount', 'petfood'].includes(d.type); };
      const main = sel ? (sel.type === 'equip' ? ['equip', 'สวมใส่'] : isUse(sel) ? ['use', 'ใช้'] : null) : null;
      let card = '<div class="ivCard empty"><div class="ivcHint">เลือกไอเทมเพื่อดูรายละเอียด<br><small>ดับเบิลคลิก = ใช้ / สวม · ลากยาไปวางที่ Hotbar ได้</small></div></div>';
      if (sel) {
        const d = sel.type === 'equip' ? null : D.ITEMS[sel.id];
        const nm = sel.type === 'equip' ? `${sel.refine ? '+' + sel.refine + ' ' : ''}${esc(sel.name)}` : esc(d.n);
        const sub = sel.type === 'equip' ? `${(D.RARITY[sel.rarity] || {}).n || ''} ${D.SLOT_TH[sel.slot] || ''}` : (d.th || d.type || '');
        card = `<div class="ivCard"><div class="ivcHead"><div class="cell r-${rar(sel)}"><img src="${ART.itemIcon(sel)}"></div><div><b style="color:${sel.type === 'equip' ? D.RARITY[sel.rarity].color : '#f6dc9a'}">${nm}</b><small>${esc(sub)}</small></div></div><div class="ivcBody scrollKeep2">${itemTip(sel)}</div>
          <div class="ivcFoot"><span class="coin">${fmt(sellPrice(sel) * (sel.qty || 1))}</span>
          ${d && (d.type === 'rune' && d.tier < 5 || d.type === 'jewel' && d.tier < 10) ? `<button class="kbtn" data-act="combine"><kbd>C</kbd>รวม ${d.type === 'rune' ? 3 : 5}→1</button>` : ''}
          ${d && ['potion', 'scroll', 'buffitem', 'cure', 'wing'].includes(d.type) ? '<button class="kbtn" data-act="hot"><kbd>H</kbd>ใส่ Hotbar</button>' : ''}
          <button class="kbtn" data-act="sell"><kbd>S</kbd>ขาย</button></div></div>`;
      }
      return `<div class="inv9">
        <div class="ivLeft"><h5>EQUIPMENT · อุปกรณ์</h5>
          <div class="ivDoll"><div class="col">${['head', 'armor', 'cloak', 'gloves', 'boots'].map(slot).join('')}</div><div class="fig"><div class="sil"></div><small>${esc(ch.name)}<br>Lv ${ch.lv}</small></div><div class="col">${['necklace', 'earring', 'ring1', 'ring2', 'belt'].map(slot).join('')}</div><div class="bot">${['weapon', 'offhand'].map(slot).join('')}</div></div>
          <h5>ATTRIBUTES · ค่าสถานะ</h5><div class="ivAttr">${attrs.map(([k, v], i) => `<div class="${i === 2 ? 'hl' : ''}"><span>${k}</span><b>${typeof v === 'number' ? fmt(v) : v || 0}</b></div>`).join('')}</div></div>
        <div class="ivMid"><div class="ivTabs">${INV_TABS.map(([k, n]) => `<button class="${UI.invTab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>
          <div class="ivBag"><div class="invGrid ivGrid scrollKeep" ondblclick="(function(e){const c=e.target.closest('[data-uid]');if(c)G.send({t:'use',uid:c.dataset.uid});})(event)">${cells}${empties}${locked}</div>
          <div class="ivMeta"><span class="coin">${fmt(ch.zeny)}</span><span>ช่อง ${ch.inv.length} / ${INV_CAP}</span></div></div>
          <div class="ivBtns"><span class="kh"><kbd>I</kbd>ปิด</span><button class="ibtn" data-act="sort">${UI.invSort ? 'ไม่เรียง' : 'เรียง'}</button><button class="ibtn" data-act="drop" ${sel ? '' : 'disabled'}>ทิ้ง</button><button class="ebtn" data-act="${main ? main[0] : 'none'}" ${main ? '' : 'disabled'}>${main ? main[1] : 'สวมใส่'}</button></div></div>
        <div class="ivRight">${card}</div></div>`;
    },
    act(a, d) {
      const sel = UI.selItem;
      if (a === 'tab') UI.invTab = d.k;
      else if (a === 'sort') UI.invSort = !UI.invSort;
      else if (a === 'unequip') { if (G.char.equip[d.slot]) G.send({ t: 'unequip', slot: d.slot }); }
      else if (a === 'sel') UI.selItem = d.uid;
      else if (a === 'equip') G.send({ t: 'equip', uid: sel });
      else if (a === 'use') G.send({ t: 'use', uid: sel });
      else if (a === 'sell') { const it = findItem(sel); if (it) (it.type !== 'equip' || it.rarity < 3 ? Promise.resolve(true) : UI.ask('ขายของหายากชิ้นนี้?')).then((y) => y && G.send({ t: 'sell', uid: sel, qty: it.qty })); UI.selItem = null; }
      else if (a === 'drop' && sel) { UI.ask('ทิ้งไอเทมนี้?', { danger: true, ok: 'ทิ้ง' }).then((y) => y && G.send({ t: 'drop', uid: sel })); UI.selItem = null; }
      else if (a === 'combine') { const it = findItem(sel); if (it) G.send({ t: 'combine', id: it.id }); }
      else if (a === 'hot') { const it = findItem(sel); const i = G.char.hotbar.findIndex((x, k) => !x && k >= 10 && k < HB_N); const j = i >= 0 ? i : G.char.hotbar.findIndex((x, k) => !x && k < HB_N); if (it && j >= 0) { G.char.hotbar[j] = 'item:' + it.id; saveHotbar(); } }
      renderWin('inv');
    }
  };

  // ---------------------------------------------------------------- dungeon treasure chest (shared by everyone in the dungeon)
  UI.chestView = function (m) {
    UI.chest = m;
    const def = WIN.chest; def.title = `${m.name}`;
    if (!UI.wins.chest || UI.wins.chest.hidden) UI.show('chest'); else renderWin('chest');
    const h = UI.wins.chest && UI.wins.chest.querySelector('.whead b'); if (h) h.textContent = (D.CHESTS[m.tier] || {}).n || m.name;
  };
  WIN.chest = {
    title: 'TREASURE', w: 470,
    render() {
      const m = UI.chest; if (!m) return '';
      const C0 = D.CHESTS[m.tier] || D.CHESTS[0];
      const rar = (it) => it.type === 'equip' ? ['common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary'][Math.min(5, it.rarity || 0)] : 'none';
      const cells = m.items.map((it) => `<div class="cell r-${rar(it)}" data-act="take" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty}</span>` : ''}</div>`).join('');
      const empties = '<div class="cell empty"></div>'.repeat(Math.max(0, 5 - m.items.length));
      return `<div class="chestWin" style="--cc:${C0.color}"><div class="chHead"><img src="client/assets/items/chest_w_${m.tier}.png"><div><b style="color:${C0.color}">${esc(C0.n)}</b><small>${esc(C0.th)} · ระดับ ${m.tier + 1}/6</small><small class="hint">${m.by ? `เปิดโดย ${esc(m.by)} · ` : ''}ทุกคนในดันเจี้ยนเห็นของชุดเดียวกัน — ใครหยิบก่อนได้ก่อน</small></div></div>
        <div class="invGrid ivGrid chGrid">${cells}${empties}</div>
        <div class="ivBtns"><span class="kh">คลิกไอเทม = เก็บเข้ากระเป๋า</span><button class="ebtn" data-act="all" ${m.items.length ? '' : 'disabled'}>เก็บทั้งหมด</button></div></div>`;
    },
    act(a, d) {
      const m = UI.chest; if (!m) return;
      if (a === 'take') G.send({ t: 'chest', id: m.id, a: 'take', uid: d.uid });
      if (a === 'all') G.send({ t: 'chest', id: m.id, a: 'all' });
    }
  };

  // ---------------------------------------------------------------- skills
  WIN.skills = {
    title: '📖 ตำราสกิล — โจมตี 15 · บัฟ 5 · อัลติเมต 5 · พาสซีฟ 5', w: 820,
    render(o) {
      const ch = G.char, C0 = D.CLASSES[ch.cls];
      const cat = o.cat || 'atk';
      const every = CSK()[ch.cls].map((id) => SKS()[id]);
      const inCat = (s, k) => (k === 'ult' ? s.cat === 'ult' || s.cat === 'set' : s.cat === k);
      const tabs = [['atk', '⚔ โจมตี'], ['buff', '✚ บัฟ'], ['ult', '★ อัลติเมต'], ['passive', '◈ พาสซีฟ']];
      const catTabs = `<div class="tabs">${tabs.map(([k, n]) => `<button class="${cat === k ? 'on' : ''}" data-act="cat" data-k="${k}">${n} <small>${k === 'passive' ? (C0.passives || []).length : every.filter((s) => inCat(s, k)).length}</small></button>`).join('')}</div>`;
      const learned = Object.keys(ch.skills).length;
      const m = C0.mech || {};
      const head = `<div class="skHead"><span>แต้มสกิล: <b class="big">${ch.skillPts}</b></span><span>เรียนแล้ว ${learned}/${every.length}</span><span>Lv ${ch.lv}</span><input id="skQ" placeholder="ค้นหาชื่อ / ความสามารถ" value="${esc(o.q || '')}"><button class="btn tiny" data-act="reset">รีเซ็ตสกิล</button></div>
      <div class="cmbox" style="--c:${m.c || C0.color}"><b>◆ กลไกประจำคลาส: ${esc(m.n || '')}</b> <small>(สูงสุด ${m.max || 0})</small><span>${esc(m.d || '')}</span></div>`;
      if (cat === 'passive') {
        const ps = C0.passives || [];
        return head + catTabs + `<div class="skList scrollKeep">${ps.map((q, i) => { const on = ch.lv >= q.lv; return `<div class="skCard pas ${on ? '' : 'lock'}"><div class="pasIc" style="--c:${C0.color}"><b>${['I', 'II', 'III', 'IV', 'V'][i] || i + 1}</b></div><div class="skMain"><div class="skTitle"><b>${esc(q.name)}</b><span class="tagk pas">พาสซีฟ</span><span class="req ${on ? 'ok' : 'bad'}">${on ? '✔ ทำงานแล้ว' : 'ปลดล็อก Lv' + q.lv}</span></div><div class="abil"><b>◈</b> ${esc(q.th)}</div></div></div>`; }).join('')}
          <div class="skCard pas"><div class="pasIc" style="--c:#9a7aff"><b>🌌</b></div><div class="skMain"><div class="skTitle"><b>Passive Tree</b><span class="tagk pas">ต้นไม้พาสซีฟ</span></div><div class="abil">แต้มพาสซีฟได้ทุกเลเวล · เลือกเส้นทางบนต้นไม้ร่วมของ 30 คลาส เพื่อเพิ่มค่าพลังและเอฟเฟกต์พิเศษ</div></div><div class="skBtns"><button class="btn gold" data-act="opentree">เปิดต้นไม้ ([)</button></div></div></div>`;
      }
      const q = (o.q || '').toLowerCase();
      const list = every.filter((s) => inCat(s, cat)).filter((s) => !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
      const KTAG = { atk: ['โจมตี', 'atk'], buff: ['บัฟ', 'buff'], ult: ['อัลติเมต', 'ult'], set: ['อัลติเมตคลาส', 'set'] };
      return head + catTabs + `<div class="skList scrollKeep">${list.map((s) => {
        const lv = ch.skills[s.id] || 0; const cost = s.kind === 'ult' ? 2 : 1; const can = ch.lv >= s.reqLv && lv < s.maxLv && ch.skillPts >= cost;
        const parts = s.desc.split(' · ◆ '), mechTxt = parts[1] || '', base = parts[0].split(' · ✦ ')[0];
        const ab = s.ability || '', abW = ab.includes(' → ') ? ab.split(' → ') : ['', ab];
        const kt = KTAG[s.cat] || KTAG.atk;
        return `<div class="skCard ${lv ? '' : 'unl'} ${ch.lv < s.reqLv ? 'lock' : ''}"><img src="${ART.skillIcon(s)}" draggable="true" data-skill="${s.id}" ondragstart="event.dataTransfer.setData('text/plain','${s.id}');event.dataTransfer.setData('from','')">
          <div class="skMain"><div class="skTitle"><b>${esc(s.name)}</b><span class="tagk ${kt[1]}">${kt[0]}</span><span class="lv">Lv ${lv}/${s.maxLv}</span><span class="req ${ch.lv < s.reqLv ? 'bad' : ''}">ต้อง Lv${s.reqLv}</span></div>
          ${skillNumbers(s, Math.max(1, lv))}<p class="base">${esc(base)}</p>
          ${ab ? `<div class="abil"><b>✦ ความสามารถเฉพาะ</b>${abW[0] ? `<span class="when">${esc(abW[0])}</span>→ ` : ''}${esc(abW[1])}</div>` : ''}
          ${mechTxt ? `<div class="mrole" style="--c:${m.c || C0.color}"><b>◆</b> ${esc(mechTxt)}</div>` : ''}${skillChips(s)}
          ${window.VFX && VFX.ok && VFX.recipes[s.id] ? `<div class="fxSig px">${VFX.swatch(s.id).map((c) => `<b style="background:${c}"></b>`).join('')}<span>VFX: ${esc(VFX.describe(s.id))}</span><button class="btn tiny" data-act="vfx" data-id="${s.id}" title="ดูเอฟเฟกต์สกิลนี้รอบตัวละคร">▶ ดู</button></div>` : ''}</div>
          <div class="skBtns"><button class="btn gold" data-act="learn" data-id="${s.id}" ${can ? '' : 'disabled'}>+${cost > 1 ? ' (2 แต้ม)' : ''}</button><button class="btn tiny" data-act="slot" data-id="${s.id}" ${lv ? '' : 'disabled'}>ใส่ปุ่ม</button></div></div>`;
      }).join('') || '<p class="hint">ไม่พบสกิลที่ตรงกับคำค้นหา</p>'}</div>`;
    },
    act(a, d) {
      if (a === 'cat') { UI.wins.skills.opts.cat = d.k; renderWin('skills'); }
      if (a === 'opentree') { UI.show('passive'); }
      if (a === 'learn') G.send({ t: 'learn', id: d.id });
      if (a === 'vfx' && window.VFX && VFX.ok) { const sk = SKS()[d.id], me = G.self, dir = Math.cos(G.ents.get(G.me) && G.ents.get(G.me).dir || 0) >= 0 ? 1 : -1; const reach = sk.shape === 'circle' && sk.self ? 0 : Math.min(6, sk.range || 4); VFX.cast({ s: G.me, sk: d.id, x: me.x, y: me.y, tx: me.x + dir * Math.max(1.5, reach), ty: me.y, sh: sk.shape, r: sk.radius || 0, self: sk.self ? 1 : 0, u: sk.kind === 'ult' ? 1 : 0 }); }
      if (a === 'reset') UI.ask('รีเซ็ตสกิลทั้งหมด? (ฟรีถึง Lv100)').then((y) => y && G.send({ t: 'resetSkills' }));
      if (a === 'slot') { if (G.char.hotbar.includes(d.id)) return UI.toast('อยู่ใน Hotbar แล้ว'); const i = G.char.hotbar.findIndex((x, k) => !x && k < HB_N); if (i < 0) return UI.toast('Hotbar เต็ม (20 ช่อง)', 'err'); G.char.hotbar[i] = d.id; saveHotbar(); UI.toast(`ใส่ ${SKS()[d.id].name} ที่ช่อง ${UI.hotkeyLabel(i)}`); }
    },
    input(t) { if (t.id === 'skQ') { const w = UI.wins.skills; w.opts.q = t.value; const pos = t.selectionStart; renderWin('skills'); const n = document.getElementById('skQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } }
  };
  // ---------------------------------------------------------------- auto
  const CONDS = [['always', 'ใช้เสมอ'], ['opener', 'เปิดฉาก (เป้าเลือดเต็ม)'], ['tag', 'เป้ามีแท็ก'], ['notag', 'เป้าไม่มีแท็ก'], ['targetHpBelow', 'HP เป้า < %'], ['selfHpBelow', 'HP เรา < %'], ['selfSpAbove', 'SP เรา > %'], ['mobsAround', 'มอนรอบตัว ≥'], ['comboAtLeast', 'Combo ≥'], ['isElite', 'เป้าเป็น Elite/Boss']];
  let autoDraft = null;
  WIN.auto = {
    title: '🤖 ระบบออโต้', w: 960,
    onOpen() { autoDraft = JSON.parse(JSON.stringify(G.char.auto)); },
    render() {
      const a = autoDraft || (autoDraft = JSON.parse(JSON.stringify(G.char.auto)));
      const learned = CSK()[G.char.cls].filter((id) => G.skillLv(id) && SKS()[id].kind === 'attack');
      const near = [...new Set([...G.ents.values()].filter((e) => e.k === 'm').map((e) => e.n.replace(/^Elite /, '')))].slice(0, 16);
      const chipList = (k) => `<div class="chipEdit">${a[k].map((n, i) => `<span class="chip">${esc(n)}<button data-act="rmchip" data-k="${k}" data-i="${i}">×</button></span>`).join('')}<input placeholder="พิมพ์ชื่อ + Enter" data-chipin="${k}"></div>`;
      const on = G.autoOn();
      return `<div class="autoTop ${on ? 'on' : ''}"><div><b>${on ? '● ออโต้กำลังทำงาน' : '○ ออโต้ปิดอยู่'}</b><small>${G.info.auto ? 'แผนที่นี้ใช้ออโต้ได้' : 'แผนที่นี้ห้ามใช้ออโต้ (PvP/GvG/World Boss)'}</small></div><button class="btn ${on ? 'danger' : 'gold'} big" data-act="toggle">${on ? 'หยุดออโต้' : 'เริ่มออโต้'}</button><button class="btn" data-act="save">💾 บันทึกการตั้งค่า</button></div>
      <div class="autoGrid scrollKeep">
        <section><h4>🎯 การเลือกเป้าหมาย</h4>
          <label>โหมด <select data-k="mode">${[['nearest', 'ใกล้สุด'], ['lowest', 'HP น้อยสุด'], ['priority', 'ตามลำดับ Whitelist'], ['defensive', 'ตีเฉพาะที่ตีเรา']].map(([v, n]) => `<option value="${v}" ${a.mode === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>รัศมีค้นหา <input type="range" min="4" max="40" value="${a.radius}" data-k="radius"><b>${a.radius} ช่อง</b></label>
          <label class="ck"><input type="checkbox" data-k="anchor" ${a.anchor ? 'checked' : ''}> ยึดจุดเริ่มต้น (ไม่เดินออกนอกวง)</label>
          <label class="ck"><input type="checkbox" data-k="avoidBoss" ${a.avoidBoss ? 'checked' : ''}> หลีกเลี่ยงบอส</label>
          <label class="ck"><input type="checkbox" data-k="ksProtect" ${a.ksProtect ? 'checked' : ''}> ไม่แย่งมอนคนอื่น (KS Protect)</label>
          <div class="sub">มอนที่ต้องการตี (Whitelist)</div>${chipList('whitelist')}
          <div class="sub">มอนที่ไม่ตี (Blacklist)</div>${chipList('blacklist')}
          <div class="sub">มอนใกล้ตัว: ${near.map((n) => `<button class="chip add" data-act="addw" data-n="${esc(n)}">+${esc(n)}</button>`).join('') || '-'}</div>
        </section>
        <section><h4>⚔ ลำดับสกิล (บนลงล่าง = ความสำคัญ)</h4>
          <div class="fightMode"><button class="${a.fight !== 'pvp' ? 'on' : ''}" data-act="fight" data-k="pve">🐺 PvE<small>ฟาร์มมอน / บอส</small></button><button class="${a.fight === 'pvp' ? 'on pvp' : ''}" data-act="fight" data-k="pvp">⚔ PvP<small>ล่าผู้เล่นศัตรู</small></button></div>
          ${a.fight === 'pvp' ? `<label>เป้าหมาย PvP <select data-k="pvpTarget">${[['lowest', 'HP % ต่ำสุด'], ['nearest', 'ใกล้สุด'], ['healer', 'ฮีลเลอร์ก่อน']].map(([v, n]) => `<option value="${v}" ${a.pvpTarget === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          <button class="btn gold" data-act="plan">🧠 จัดสกิลอัตโนมัติสำหรับ ${a.fight === 'pvp' ? 'PvP' : 'PvE'}</button>
          <small class="hint">${a.fight === 'pvp' ? 'PvP: เปิดด้วยสกิล CC → สกิลพุ่งเข้าหา → คอมโบต่อเมื่อติดสถานะ → ปิดท้ายเป้า HP ต่ำ · เน้นเป้าเดียว ร่ายเร็ว' : 'PvE: AoE เมื่อมอนรวมกลุ่ม → ตั้งคอมโบสถานะ → ดาเมจหลักตามค่า DPS · เน้นวงกว้าง/โซน/สมุน'} · ลำดับแยกกันระหว่าง PvE และ PvP</small>
          <div class="rot">${a.rotation.map((r, i) => `<div class="rotRow"><span class="n">${i + 1}</span><img src="${ART.skillIcon(SKS()[r.id])}" data-skill="${r.id}"><select data-rot="${i}" data-f="id">${learned.map((id) => `<option value="${id}" ${id === r.id ? 'selected' : ''}>${esc(SKS()[id].name)}</option>`).join('')}</select>
            <select data-rot="${i}" data-f="cond">${CONDS.map(([v, n]) => `<option value="${v}" ${r.cond === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
            ${['tag', 'notag'].includes(r.cond) ? `<select data-rot="${i}" data-f="v">${D.TAG_IDS.map((t) => `<option value="${t}" ${r.v === t ? 'selected' : ''}>${D.TAGS[t].n}</option>`).join('')}</select>` : ['always', 'opener', 'isElite'].includes(r.cond) ? '' : `<input type="number" data-rot="${i}" data-f="v" value="${+r.v || 0}" style="width:54px">`}
            <button class="btn tiny" data-act="up" data-i="${i}">▲</button><button class="btn tiny" data-act="down" data-i="${i}">▼</button><button class="btn tiny danger" data-act="rm" data-i="${i}">✕</button>${r.why ? `<em class="why">${esc(r.why)}</em>` : ''}</div>`).join('') || '<small class="hint">ยังไม่ได้ตั้ง → ใช้สกิลโจมตีจาก Hotbar ตามลำดับ</small>'}</div>
          <div class="acts"><button class="btn" data-act="addRot" ${learned.length ? '' : 'disabled'}>+ เพิ่มสกิล</button><button class="btn" data-act="fromHot">นำเข้าจาก Hotbar</button><button class="btn" data-act="combo">สร้างคอมโบอัตโนมัติ (S→L→F)</button><button class="btn danger" data-act="clearRot">ล้าง</button></div>
          <label>ใช้ Ultimate <select data-k="useUlt">${[['never', 'ไม่ใช้'], ['elite', 'เฉพาะ Elite/Boss'], ['always', 'ใช้ทันทีที่เต็ม']].map(([v, n]) => `<option value="${v}" ${a.useUlt === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="ck"><input type="checkbox" data-k="autoBuff" ${a.autoBuff ? 'checked' : ''}> ต่อบัฟอัตโนมัติ (สกิลบัฟที่เรียนแล้ว)</label>
          <label class="ck"><input type="checkbox" data-k="breakFree" ${a.breakFree ? 'checked' : ''}> ใช้ Break Free เมื่อติด CC</label>
          <label>ฮีลเพื่อนเมื่อ HP < <input type="range" min="0" max="95" value="${a.partyHeal}" data-k="partyHeal"><b>${a.partyHeal}%</b></label>
        </section>
        <section><h4>🧪 ยา & เอาตัวรอด</h4>
          <label>ใช้ยา HP เมื่อ < <input type="range" min="0" max="95" value="${a.hpPot}" data-k="hpPot"><b>${a.hpPot}%</b></label>
          <label>ใช้ยา SP เมื่อ < <input type="range" min="0" max="95" value="${a.spPot}" data-k="spPot"><b>${a.spPot}%</b></label>
          <label class="ck"><input type="checkbox" data-k="returnTown" ${a.returnTown ? 'checked' : ''}> กลับเมืองเมื่อยาหมด/กระเป๋าเต็ม</label>
          <label class="ck"><input type="checkbox" data-k="supply" ${a.supply ? 'checked' : ''}> ซื้อยาอัตโนมัติ แล้วกลับจุดเดิม</label>
          <label>จำนวนยาที่ซื้อ <input type="number" min="0" max="500" value="${a.potBuy}" data-k="potBuy" style="width:70px"></label>
          <label class="ck"><input type="checkbox" data-k="respawnReturn" ${a.respawnReturn ? 'checked' : ''}> ตายแล้วเกิดและกลับมาฟาร์มต่อ</label>
        </section>
        <section><h4>📦 เก็บของ & ออฟไลน์</h4>
          <label>เก็บอุปกรณ์ตั้งแต่ <select data-k="lootMinRarity">${D.RARITY.map((r, i) => `<option value="${i}" ${+a.lootMinRarity === i ? 'selected' : ''} style="color:${r.color}">${r.n}</option>`).join('')}</select></label>
          <label class="ck"><input type="checkbox" data-k="lootPotions" ${a.lootPotions ? 'checked' : ''}> เก็บยา</label>
          <label class="ck"><input type="checkbox" data-k="lootMats" ${a.lootMats ? 'checked' : ''}> เก็บวัตถุดิบ</label>
          <label class="ck"><input type="checkbox" data-k="offline" ${a.offline ? 'checked' : ''}> <b>ออโต้ออฟไลน์</b> — ปิดเว็บแล้วยังฟาร์มต่อ (สูงสุด 12 ชม.)</label>
          <small class="hint">ออโต้ทำงานบนเซิร์ฟเวอร์ · ของที่ไม่เก็บจะถูกขายเป็น Zeny อัตโนมัติ · คีย์ลัด \` เปิด/ปิด</small>
        </section></div>`;
    },
    act(a, d) {
      const A = autoDraft;
      const stash = () => { if (A.fight === 'pvp') A.rotPvp = A.rotation; else A.rotPve = A.rotation; };
      if (a === 'fight' && (A.fight || 'pve') !== d.k) { stash(); A.fight = d.k; A.rotation = (d.k === 'pvp' ? A.rotPvp : A.rotPve) || []; if (!A.rotation.length) A.rotation = F.autoPlan(CSK()[G.char.cls].filter((id) => G.skillLv(id)).map((id) => SKS()[id]), d.k); stash(); A.useUlt = d.k === 'pvp' ? 'always' : A.useUlt; }
      if (a === 'plan') { A.rotation = F.autoPlan(CSK()[G.char.cls].filter((id) => G.skillLv(id)).map((id) => SKS()[id]), A.fight || 'pve'); stash(); UI.toast(`จัดลำดับสกิล ${A.fight === 'pvp' ? 'PvP' : 'PvE'} อัตโนมัติแล้ว (${A.rotation.length} สกิล) — กดบันทึกเพื่อใช้`, 'gold'); }
      if (a === 'toggle') { stash(); G.send({ t: 'auto', cfg: A }); G.send({ t: 'autoOn', on: !G.autoOn() }); }
      if (a === 'save') { stash(); G.send({ t: 'auto', cfg: A }); UI.toast('บันทึกการตั้งค่าออโต้แล้ว', 'gold'); }
      if (a === 'rmchip') A[d.k].splice(+d.i, 1);
      if (a === 'addw' && !A.whitelist.includes(d.n)) A.whitelist.push(d.n);
      const learned = CSK()[G.char.cls].filter((id) => G.skillLv(id) && SKS()[id].kind === 'attack');
      if (a === 'addRot' && learned.length) A.rotation.push({ id: learned.find((id) => !A.rotation.some((r) => r.id === id)) || learned[0], cond: 'always', v: 0 });
      if (a === 'rm') A.rotation.splice(+d.i, 1);
      if (a === 'up' && +d.i > 0) { const r = A.rotation; [r[+d.i - 1], r[+d.i]] = [r[+d.i], r[+d.i - 1]]; }
      if (a === 'down' && +d.i < A.rotation.length - 1) { const r = A.rotation; [r[+d.i + 1], r[+d.i]] = [r[+d.i], r[+d.i + 1]]; }
      if (a === 'clearRot') A.rotation = [];
      if (a === 'fromHot') A.rotation = G.char.hotbar.filter((h) => h && SKS()[h] && SKS()[h].kind === 'attack' && G.skillLv(h)).map((id) => ({ id, cond: 'always', v: 0 }));
      if (a === 'combo') {
        // finishers first when their tag is present, then linkers when their bonus tag is present, then starters
        const sk = learned.map((id) => SKS()[id]);
        const rot = [];
        for (const s of sk.filter((s) => s.role === 'F' && s.consumes)) rot.push({ id: s.id, cond: 'tag', v: s.consumes[0] });
        for (const s of sk.filter((s) => s.cond && s.cond.type === 'targetHp')) rot.push({ id: s.id, cond: 'targetHpBelow', v: s.cond.v });
        for (const s of sk.filter((s) => s.role === 'L' && s.bonusIf)) rot.push({ id: s.id, cond: 'tag', v: s.bonusIf[0][0] });
        for (const s of sk.filter((s) => s.role === 'S')) rot.push({ id: s.id, cond: s.applies ? 'notag' : 'always', v: s.applies ? s.applies[0].tag : 0 });
        for (const s of sk.filter((s) => !rot.some((r) => r.id === s.id))) rot.push({ id: s.id, cond: 'always', v: 0 });
        A.rotation = rot.slice(0, 18);
        UI.toast('สร้างลำดับคอมโบจากบทบาทสกิลแล้ว', 'gold');
      }
      stash();
      renderWin('auto');
    },
    change(t) {
      const A = autoDraft;
      if (t.dataset.k) { const k = t.dataset.k; A[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' || t.type === 'number' || k === 'lootMinRarity' ? +t.value : t.value; renderWin('auto'); }
      if (t.dataset.rot !== undefined) { const r = A.rotation[+t.dataset.rot]; r[t.dataset.f] = t.type === 'number' ? +t.value : t.value; if (t.dataset.f === 'cond') r.v = ['tag', 'notag'].includes(t.value) ? 'airborne' : 0; renderWin('auto'); }
    },
    input(t) { if (t.type === 'range') { t.nextElementSibling.textContent = t.value + (t.dataset.k === 'radius' ? ' ช่อง' : '%'); } }
  };
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (e.key === 'Enter' && t.dataset && t.dataset.chipin) { const v = t.value.trim(); if (v && autoDraft) { autoDraft[t.dataset.chipin].push(v); t.value = ''; renderWin('auto'); } }
  }, true);

  // ---------------------------------------------------------------- world map / teleport
  WIN.map = {
    title: '🗺 แผนที่โลก & เทเลพอร์ต', w: 760,
    onOpen() { G.send({ t: 'info', what: 'boss' }); },
    render() {
      const boss = (UI.lastInfo && UI.lastInfo.boss) ? Object.fromEntries(UI.lastInfo.boss.list.map((b) => [b.map, b])) : {};
      const inTown = G.info.kind === 'town';
      const towns = D.TOWNS.map((t) => `<div class="town" style="--c:${D.BIOMES[t.biome].ground[0]}"><b>${t.name}</b><small>${t.th}</small><small>แนะนำ Lv${t.lv}+</small><button class="btn gold tiny" data-act="warp" data-m="${t.id}">วาร์ป (ฟรี)</button></div>`).join('');
      const regions = D.TOWNS.map((t) => `<div class="region"><h4>${t.name} Region</h4>${D.FARM_MAPS.filter((f) => f.town === t.id).map((f) => {
        const b = boss[f.name]; const ok = G.char.lv >= f.min - 5;
        return `<div class="farm ${ok ? '' : 'hard'}"><span class="biome" style="background:${D.BIOMES[f.biome].ground[0]}"></span><div><b>${f.name}</b> ${f.pk ? '<span class="badge red">PK</span>' : ''}<small>${f.th} · Lv ${f.min}–${f.max} · ${f.w}×${f.h}</small><small>${b ? (b.alive ? '👹 Field Boss อยู่!' : b.next != null ? `บอสเกิดใน ${Math.ceil(b.next / 60)} นาที` : '') : ''}</small></div><button class="btn tiny" data-act="warp" data-m="${f.id}" ${inTown || G.char.gm ? '' : 'disabled'}>${f.min * 15}z</button></div>`;
      }).join('')}</div>`).join('');
      return `<div class="mapTop"><div class="curMap"><canvas id="bigMap" width="220" height="220"></canvas><div><b>${esc(G.info.name)}</b><small>${esc(G.info.th)}</small><small>ตำแหน่ง ${G.self.x | 0}, ${G.self.y | 0}</small><small>${G.map.w}×${G.map.h} ช่อง</small></div></div>
        <div class="towns">${towns}</div></div>
        ${inTown ? '' : '<div class="warn">วาร์ปไปแผนที่ฟาร์มได้จากในเมือง (Gatekeeper) — ใช้ Return Scroll / Waygate เพื่อกลับเมือง</div>'}
        <div class="special"><button class="btn" data-act="warp" data-m="pvp_arena">⚔ Blood Colosseum (PvP)</button><button class="btn" data-act="warp" data-m="wb_arena">🌋 Ruined Sanctum (World Boss)</button><button class="btn" data-act="dg">🗼 ดันเจี้ยน 5×1000 ชั้น</button></div>
        <div class="regions scrollKeep">${regions}</div>`;
    },
    act(a, d) { if (a === 'warp') G.send({ t: 'warp', map: d.m }); if (a === 'dg') UI.show('dungeon'); }
  };
  const _renderWin = renderWin;
  renderWin = function (name) { _renderWin(name); if (name === 'map') drawBigMap(); };
  UI.renderWin = renderWin;
  function drawBigMap() {
    const cv = document.getElementById('bigMap'); if (!cv || !G.mini) return;
    const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 220, 220);
    const s = Math.min(220 / G.map.w, 220 / G.map.h);
    g.drawImage(G.mini, 0, 0, G.map.w * s, G.map.h * s);
    for (const e of G.ents.values()) if (e.k === 'n') { g.fillStyle = '#ffe14a'; g.fillRect(e.x * s - 2, e.y * s - 2, 4, 4); }
    g.fillStyle = '#5ad0ff'; g.beginPath(); g.arc(G.self.x * s, G.self.y * s, 4, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.stroke();
  }

  // ---------------------------------------------------------------- dungeon
  WIN.dungeon = {
    title: '🗼 ดันเจี้ยน — 5 ประเภท × 1000 ชั้น', w: 760,
    render(o) {
      const best = G.char.dungeonBest || {};
      return `<p class="hint">ทุก 10 ชั้นมีบอสประจำชั้น · ทุก 100 ชั้นมีบอสใหญ่ · กำจัดมอน 70% (หรือบอส) เพื่อเปิดบันได · เริ่มได้ที่ชั้น 1 หรือ Checkpoint (11, 21, 31...) ที่ผ่านมาแล้ว · ปาร์ตี้เข้าด้วยกันได้</p>
      <div class="dgList">${D.DUNGEONS.map((d) => {
        const b = best[d.id] || 0; const cps = [1]; for (let f = 11; f <= Math.min(1000, b + 1); f += 10) cps.push(f); if (b + 1 <= 1000 && !cps.includes(b + 1)) cps.push(b + 1);
        return `<div class="dg" style="--c:${D.ELEMENTS[d.element].color}"><div class="dgHead"><b>${d.name}</b><small>${d.th}</small></div><p>${d.desc}</p>
          <div class="prog"><i style="width:${b / 10}%"></i><span>ผ่านแล้ว ${b} / 1000</span></div>
          <small>มอน Lv ${D.dungeonLevel(d, Math.max(1, b + 1))} (ชั้น ${b + 1}) → Lv ${D.dungeonLevel(d, 1000)} (ชั้น 1000)</small>
          <div class="acts"><select data-dg="${d.id}">${cps.slice(-40).reverse().map((f) => `<option value="${f}">ชั้น ${f}</option>`).join('')}</select><button class="btn gold" data-act="enter" data-id="${d.id}">เข้าดันเจี้ยน</button></div></div>`;
      }).join('')}</div>${G.info.kind === 'dungeon' ? `<div class="acts"><button class="btn gold" data-act="stairs">ไปชั้นถัดไป (ต้องยืนที่บันได)</button><button class="btn" data-act="leave">ออกจากดันเจี้ยน</button></div>` : ''}`;
    },
    act(a, d) {
      if (a === 'enter') { const sel = document.querySelector(`[data-dg="${d.id}"]`); G.send({ t: 'dungeon', type: d.id, floor: +sel.value }); }
      if (a === 'stairs') G.send({ t: 'stairs' });
      if (a === 'leave') G.send({ t: 'use', id: 'tele_scroll' });
    }
  };

  // ---------------------------------------------------------------- shop
  WIN.shop = {
    title: '🛒 ร้านค้า', w: 560,
    render(o) {
      const list = D.SHOP[G.mapId] || D.SHOP.aurelia;
      const tab = o.tab || 'buy';
      const sellable = G.char.inv.filter((it) => it.type === 'equip' || (D.ITEMS[it.id] && D.ITEMS[it.id].type !== 'potion'));
      return `<div class="tabs"><button class="${tab === 'buy' ? 'on' : ''}" data-act="tab" data-k="buy">ซื้อ</button><button class="${tab === 'sell' ? 'on' : ''}" data-act="tab" data-k="sell">ขาย</button><span class="zeny">💰 ${fmt(G.char.zeny)}</span></div>
      ${tab === 'buy' ? `<div class="shopList scrollKeep">${list.map((id) => { const d = D.ITEMS[id]; return `<div class="shopRow"><img src="${ART.itemIcon({ id })}" data-itemid="${id}"><div><b>${d.n}</b><small>${d.th}${d.lv > 1 ? ' · Lv' + d.lv : ''}</small></div><span class="price">${fmt(d.price)} z</span><input type="number" min="1" max="999" value="${d.type === 'potion' ? 50 : 1}" data-q="${id}"><button class="btn gold tiny" data-act="buy" data-id="${id}">ซื้อ</button></div>`; }).join('')}</div>`
        : `<div class="acts"><button class="btn" data-act="sellJunk">ขายขยะ + Monster Core + อุปกรณ์ Common ทั้งหมด</button></div><div class="shopList scrollKeep">${sellable.map((it) => `<div class="shopRow"><img src="${ART.itemIcon(it)}" data-item="${it.uid}"><div><b style="color:${it.type === 'equip' ? D.RARITY[it.rarity].color : '#fff'}">${esc(it.type === 'equip' ? (it.refine ? '+' + it.refine + ' ' : '') + it.name : D.ITEMS[it.id].n)}</b><small>${it.qty ? '×' + it.qty : D.RARITY[it.rarity].n}</small></div><span class="price">${fmt(sellPrice(it) * (it.qty || 1))} z</span><button class="btn tiny" data-act="sell" data-uid="${it.uid}" data-q="${it.qty || 1}">ขาย</button></div>`).join('')}</div>`}`;
    },
    act(a, d) {
      const w = UI.wins.shop;
      if (a === 'tab') { w.opts.tab = d.k; renderWin('shop'); }
      if (a === 'buy') { const q = document.querySelector(`[data-q="${d.id}"]`); G.send({ t: 'buy', id: d.id, qty: +q.value || 1 }); }
      if (a === 'sell') G.send({ t: 'sell', uid: d.uid, qty: +d.q });
      if (a === 'sellJunk') for (const it of G.char.inv) if (it.id === 'monster_core' || (D.ITEMS[it.id] && D.ITEMS[it.id].type === 'junk') || (it.type === 'equip' && it.rarity === 0 && !Object.values(G.char.equip).some((e) => e && e.uid === it.uid))) G.send({ t: 'sell', uid: it.uid, qty: it.qty || 1 });
    }
  };

  // ---------------------------------------------------------------- refine
  function gearList() { return [...Object.values(G.char.equip).filter(Boolean).map((it) => ({ it, eq: 1 })), ...G.char.inv.filter((it) => it.type === 'equip').map((it) => ({ it, eq: 0 }))]; }
  const cnt = (id) => G.char.inv.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0);
  WIN.refine = {
    title: '⚒ ตีบวก +20', w: 700,
    render(o) {
      const list = gearList();
      const sel = list.find((x) => x.it.uid === o.uid) || list[0];
      let right = '<p class="hint">เลือกอุปกรณ์</p>';
      if (sel) {
        const it = sel.it; const isAcc = ['necklace', 'earring', 'ring'].includes(it.slot); const max = isAcc ? D.ACC_REFINE_MAX : 20;
        const cur = it.refine || 0, nx = cur + 1;
        if (cur >= max) right = `<div class="refBig"><img src="${ART.itemIcon(it)}"><b>+${cur} ${esc(it.name)}</b><p>ตีบวกสูงสุดแล้ว!</p></div>`;
        else {
          const cost = D.refineCost(nx), f = D.refineFail(nx), rate = Math.min(100, D.REFINE_RATES[nx - 1] + (G.char.pity || 0) * 0.5);
          const have = cnt(cost.mat);
          right = `<div class="refBig"><div class="refItem lv${Math.min(20, cur)}"><img src="${ART.itemIcon(it)}" data-item="${it.uid}"></div><b style="color:${D.RARITY[it.rarity].color}">${esc(it.name)}</b>
            <div class="refArrow"><span>+${cur}</span>➜<span class="nx">+${nx}</span></div>
            <div class="rate"><div class="rbar"><i style="width:${rate}%"></i></div><b>${rate.toFixed(1)}%</b>${G.char.pity ? `<small>Pity +${(G.char.pity * 0.5).toFixed(1)}%</small>` : ''}</div>
            <div class="reqs"><div class="${have >= cost.qty ? 'ok' : 'bad'}"><img src="${ART.itemIcon({ id: cost.mat })}">${D.ITEMS[cost.mat].n} ${have}/${cost.qty}</div><div class="${G.char.zeny >= cost.zeny ? 'ok' : 'bad'}">💰 ${fmt(cost.zeny)} Zeny</div></div>
            <div class="failInfo">${f.breakChance ? `⚠ ล้มเหลว: <b class="bad">ของพัง ${f.breakChance * 100}%</b> หรือ -${f.down}` : f.down ? `ล้มเหลว: ระดับลด ${f.downMin ? f.downMin + '~' : ''}${f.down}` : 'ล้มเหลว: ไม่มีผล (ปลอดภัย)'}</div>
            <label class="ck"><input type="checkbox" id="refProt" ${o.prot ? 'checked' : ''}> Protection Scroll (กันพัง) — มี ${cnt('scroll_protect')}</label>
            <label class="ck"><input type="checkbox" id="refBless" ${o.bless ? 'checked' : ''}> Blessed Scroll (กันลด) — มี ${cnt('scroll_bless')}</label>
            <label class="ck"><input type="checkbox" id="refAnvil" ${o.anvil ? 'checked' : ''}> ใช้ทั่ง/แร่เสริม (${D.ANVILS.map((a) => `${D.ITEMS[a].n.split(' ')[0]} ${cnt(a)}`).join(' · ')} · Enriched ${cnt('ore_enriched')} · Charm ${cnt('smith_charm')})</label>
            <button class="btn gold big" data-act="go" data-uid="${it.uid}">⚒ ตีบวก!</button>
            <small class="hint">โบนัส: อาวุธ/เกราะ +6% ต่อระดับ (เพิ่มขึ้นหลัง +10 และ +15) · +10/+15/+20 ปลดออร่าและโบนัสพิเศษ</small></div>`;
        }
      }
      return `<div class="twoCol"><div class="pickList scrollKeep">${list.map(({ it, eq }) => `<div class="pick ${sel && sel.it.uid === it.uid ? 'on' : ''}" data-act="pick" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}"><span style="color:${D.RARITY[it.rarity].color}">${it.refine ? '+' + it.refine + ' ' : ''}${esc(it.name)}</span>${eq ? '<em>สวมอยู่</em>' : ''}</div>`).join('')}</div><div class="refPanel">${right}<div id="refFx"></div></div></div>
      <details><summary>ตารางอัตราสำเร็จ +1 ~ +20</summary><div class="rateTable">${D.REFINE_RATES.map((r, i) => `<span>+${i + 1}<b>${r}%</b></span>`).join('')}</div></details>`;
    },
    act(a, d) {
      const w = UI.wins.refine;
      if (a === 'pick') { w.opts.uid = d.uid; renderWin('refine'); }
      if (a === 'go') { w.opts.uid = d.uid; w.opts.prot = $('#refProt').checked; w.opts.bless = $('#refBless').checked; w.opts.anvil = $('#refAnvil').checked; G.send({ t: 'refine', uid: d.uid, prot: w.opts.prot, bless: w.opts.bless, anvil: w.opts.anvil }); }
    }
  };
  UI.refineResult = function (m) {
    const fx = $('#refFx');
    const msg = m.ok ? `✨ สำเร็จ! +${m.to}` : m.broke ? '💥 พัง! ของหายไป...' : m.to < m.from ? `❌ ล้มเหลว ลดเป็น +${m.to}` : '❌ ล้มเหลว';
    UI.toast(msg, m.ok ? 'gold' : 'err');
    if (window.SFX) SFX.refine(m.ok, m.broke);
    if (fx) { fx.className = m.ok ? 'ok' : 'fail'; fx.textContent = msg; setTimeout(() => { fx.className = ''; fx.textContent = ''; }, 1600); }
    if (m.ok && UI.wins.refine) UI.wins.refine.opts.uid = m.uid;
  };

  // ---------------------------------------------------------------- runes & jewels
  WIN.rune = {
    title: '💎 รูน & ประดับ', w: 720,
    render(o) {
      const list = gearList();
      const sel = list.find((x) => x.it.uid === o.uid) || list[0];
      const gems = G.char.inv.filter((it) => D.ITEMS[it.id] && (D.ITEMS[it.id].type === 'rune' || D.ITEMS[it.id].type === 'jewel' || D.ITEMS[it.id].type === 'card'));
      let right = '';
      if (sel) {
        const it = sel.it;
        const socks = it.jewelSlots ? Array.from({ length: it.jewelSlots }, (_, i) => it.jewels && it.jewels[i]) : Array.from({ length: it.sockets || 0 }, (_, i) => it.runes[i]);
        const fit = gems.filter((g) => (it.jewelSlots ? D.ITEMS[g.id].type === 'jewel' : D.ITEMS[g.id].type === 'rune'));
        right = `<div class="runeTop"><img src="${ART.itemIcon(it)}" data-item="${it.uid}"><div><b style="color:${D.RARITY[it.rarity].color}">${esc(it.name)}</b><small>${it.jewelSlots ? 'ช่องอัญมณี' : 'ช่องรูน'} ${socks.filter(Boolean).length}/${socks.length}</small></div></div>
          <div class="sockets">${socks.map((s) => s ? `<div class="sock on" style="--c:${D.ITEMS[s].icon}"><img src="${ART.itemIcon({ id: s })}" data-itemid="${s}"></div>` : '<div class="sock"></div>').join('') || '<small class="hint">ไม่มีช่อง — ใช้ Rune Drill เจาะ</small>'}</div>
          <div class="acts">${!it.jewelSlots ? `<button class="btn" data-act="drill" data-uid="${it.uid}">🔩 เจาะช่อง (Rune Drill ×1 มี ${cnt('rune_drill')})</button>` : ''}<button class="btn" data-act="reroll" data-uid="${it.uid}">🎲 สุ่มออปชั่น (Reroll ×1 มี ${cnt('reroll_stone')})</button><button class="btn danger" data-act="unsock" data-uid="${it.uid}">ถอดทั้งหมด</button></div>
          <h4>ฝังลงอุปกรณ์นี้</h4><div class="gemList">${fit.map((g) => `<div class="gem" data-act="sock" data-uid="${it.uid}" data-gem="${g.uid}" data-itemid="${g.id}"><img src="${ART.itemIcon(g)}"><span>${D.ITEMS[g.id].n} ×${g.qty}</span></div>`).join('') || '<small class="hint">ไม่มีรูน/อัญมณีที่ใส่ได้</small>'}</div>`;
      }
      return `<div class="twoCol"><div class="pickList scrollKeep">${list.map(({ it, eq }) => `<div class="pick ${sel && sel.it.uid === it.uid ? 'on' : ''}" data-act="pick" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}"><span style="color:${D.RARITY[it.rarity].color}">${esc(it.name)}</span><em>${it.jewelSlots ? '◆' + (it.jewels || []).length + '/' + it.jewelSlots : '◇' + (it.runes || []).length + '/' + (it.sockets || 0)}</em></div>`).join('')}</div><div>${right}
        <h4>รวมรูน (3→1) / อัญมณี (5→1)</h4><div class="gemList">${gems.map((g) => { const d = D.ITEMS[g.id]; const need = d.type === 'rune' ? 3 : 5; const max = d.type === 'rune' ? 5 : 10; return `<div class="gem ${g.qty >= need && d.tier < max ? '' : 'dim'}" data-act="combine" data-id="${g.id}" data-itemid="${g.id}"><img src="${ART.itemIcon(g)}"><span>${d.n} ×${g.qty}</span></div>`; }).join('')}</div></div></div>`;
    },
    act(a, d) {
      const w = UI.wins.rune;
      if (a === 'pick') { w.opts.uid = d.uid; renderWin('rune'); }
      if (a === 'sock') { w.opts.uid = d.uid; G.send({ t: 'socket', uid: d.uid, gem: d.gem }); }
      if (a === 'drill') G.send({ t: 'drill', uid: d.uid });
      if (a === 'reroll') UI.ask('สุ่มออปชั่นใหม่ทั้งหมด?').then((y) => y && G.send({ t: 'reroll', uid: d.uid }));
      if (a === 'unsock') UI.ask('ถอดรูน/อัญมณีทั้งหมด (เสีย Zeny)?').then((y) => y && G.send({ t: 'unsocket', uid: d.uid }));
      if (a === 'combine') G.send({ t: 'combine', id: d.id });
    }
  };

  // ---------------------------------------------------------------- guild & gvg
  WIN.guild = {
    title: '🏰 กิลด์ & Guild War', w: 720,
    onOpen() { G.send({ t: 'info', what: 'gvg' }); },
    render() {
      const g = G.char.guild;
      const gv = UI.lastInfo && UI.lastInfo.gvg;
      const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
      const war = gv ? `<div class="gvg ${gv.active ? 'live' : ''}"><h4>⚔ Guild War ${gv.active ? `<span class="badge red">LIVE · เหลือ ${Math.ceil(gv.endsIn / 60)} นาที</span>` : `<small>ทุกวัน${days[gv.schedule.day]} ${gv.schedule.hour}:00 (${gv.schedule.durationMin} นาที)</small>`}</h4>
        <div class="castles">${gv.castles.map((c) => `<div class="castle"><b>${c.name}</b><small>${c.th}</small><span>เจ้าของ: <b>${esc(c.owner || '— ว่าง —')}</b></span><div class="prog"><i style="width:${c.core}%"></i><span>Core ${c.core}%</span></div><button class="btn tiny ${gv.active ? 'gold' : ''}" data-act="castle" data-id="${c.id}">เข้าปราสาท</button></div>`).join('')}</div>
        <small class="hint">ทำลาย Crystal Core กลางปราสาทเพื่อยึด · เจ้าของปราสาทได้ ATK/MATK/EXP +5% ต่อปราสาท และรางวัลหลังวอร์ · พันธมิตร 2 กิลด์</small></div>` : '';
      if (!g) return `<div class="gCreate"><h4>สร้างกิลด์</h4><p>ต้องเลเวล 20+ และ Guild Emblem 1 ชิ้น (ร้านค้า Aurelia/Skyreach)</p><input id="gName" placeholder="ชื่อกิลด์ 3-16 ตัว"><button class="btn gold" data-act="create">ก่อตั้งกิลด์</button><p class="hint">หรือให้หัวหน้ากิลด์เชิญคุณ (คลิกขวาที่ผู้เล่น)</p></div>${war}`;
      const me = g.members.find((m) => m.cid === G.char.id) || {};
      const officer = me.rank === 'master' || me.rank === 'officer';
      return `<div class="gHead"><div><h3>${esc(g.name)}</h3><small>Lv ${g.lv} · สมาชิก ${g.members.length} · ออนไลน์ ${g.members.filter((m) => m.on).length}${g.castles.length ? ' · 🏰 ' + g.castles.join(', ') : ''}</small></div><span class="rank">${me.rank}</span></div>
        <div class="notice">📜 ${esc(g.notice)} ${officer ? '<button class="btn tiny" data-act="notice">แก้ไข</button>' : ''}</div>
        <div class="acts">${officer ? '<input id="gInv" placeholder="ชื่อผู้เล่น"><button class="btn" data-act="invite">เชิญ</button>' : ''}${me.rank === 'master' ? '<input id="gAlly" placeholder="ชื่อกิลด์พันธมิตร"><button class="btn" data-act="ally">เป็นพันธมิตร</button>' : ''}<button class="btn danger" data-act="leave">${me.rank === 'master' ? 'ยุบ/ออก' : 'ออกจากกิลด์'}</button></div>
        <div class="members scrollKeep">${g.members.sort((a, b) => b.on - a.on || b.lv - a.lv).map((m) => `<div class="mem ${m.on ? 'on' : ''}"><i></i><img src="${ART.classIcon(m.cls, 24)}"><b>${esc(m.name)}</b><span>Lv${m.lv}</span><span class="rank">${m.rank}</span>${me.rank === 'master' && m.cid !== G.char.id ? `<button class="btn tiny" data-act="promote" data-n="${esc(m.name)}" data-r="${m.rank === 'officer' ? 'member' : 'officer'}">${m.rank === 'officer' ? 'ลดขั้น' : 'Officer'}</button><button class="btn tiny" data-act="promote" data-n="${esc(m.name)}" data-r="master">โอน Master</button>` : ''}${officer && m.rank !== 'master' && m.cid !== G.char.id ? `<button class="btn tiny danger" data-act="kick" data-n="${esc(m.name)}">เตะ</button>` : ''}</div>`).join('')}</div>${war}`;
    },
    act(a, d) {
      if (a === 'create') G.send({ t: 'guild', a: 'create', name: $('#gName').value });
      if (a === 'invite') G.send({ t: 'guild', a: 'invite', name: $('#gInv').value });
      if (a === 'ally') G.send({ t: 'guild', a: 'ally', name: $('#gAlly').value });
      if (a === 'leave') UI.ask('ออกจากกิลด์ (Master = ยุบกิลด์)?', { danger: true }).then((y) => y && G.send({ t: 'guild', a: 'leave' }));
      if (a === 'kick') UI.ask('เตะ ' + d.n + ' ออกจากกิลด์?', { danger: true }).then((y) => y && G.send({ t: 'guild', a: 'kick', name: d.n }));
      if (a === 'promote') G.send({ t: 'guild', a: 'rank', name: d.n, rank: d.r });
      if (a === 'notice') UI.ask('ประกาศกิลด์', { input: true, def: G.char.guild.notice }).then((v) => { if (v != null) G.send({ t: 'guild', a: 'notice', text: v }); });
      if (a === 'castle') G.send({ t: 'warp', map: d.id });
    }
  };
  WIN.party = {
    title: '👥 ปาร์ตี้', w: 420,
    render() {
      const pt = G.char.party;
      return `<div class="acts"><input id="pInv" placeholder="ชื่อผู้เล่น"><button class="btn gold" data-act="invite">เชิญเข้าปาร์ตี้</button></div>
        ${pt ? `<div class="members">${pt.members.map((m) => `<div class="mem on"><i></i><img src="${ART.classIcon(m.cls, 24)}"><b>${esc(m.name)}${pt.leader === m.cid ? ' ♛' : ''}</b><span>Lv${m.lv}</span><small>${esc(mapName(m.map))}</small>${pt.leader === G.char.id && m.cid !== G.char.id ? `<button class="btn tiny danger" data-act="kick" data-n="${esc(m.name)}">เตะ</button>` : ''}</div>`).join('')}</div><button class="btn danger" data-act="leave">ออกจากปาร์ตี้</button>` : '<p class="hint">ยังไม่มีปาร์ตี้ — สูงสุด 6 คน · แชร์ EXP (+12%/คน) · บัฟ/ฮีลปาร์ตี้ · เข้าดันเจี้ยนด้วยกัน · Element Reaction ข้ามคลาส</p>'}`;
    },
    act(a, d) { if (a === 'invite') G.send({ t: 'party', a: 'invite', name: $('#pInv').value }); if (a === 'leave') G.send({ t: 'party', a: 'leave' }); if (a === 'kick') G.send({ t: 'party', a: 'kick', name: d.n }); }
  };
  WIN.arena = {
    title: '⚔ Arena Master', w: 560,
    onOpen() { G.send({ t: 'info', what: 'wb' }); },
    render() {
      const wb = UI.lastInfo && UI.lastInfo.wb;
      return `<div class="arenaBtns"><button class="btn big" data-act="go" data-m="pvp_arena">⚔ เข้า Blood Colosseum<br><small>PvP ทุกคน (ยกเว้นปาร์ตี้) · ไม่เสีย EXP</small></button><button class="btn big gold" data-act="go" data-m="wb_arena">🌋 เข้า Ruined Sanctum<br><small>ลาน World Boss · PvP เปิดระหว่างบอสอยู่</small></button></div>
      ${wb ? `<h4>World Boss</h4><p>${wb.alive ? `👹 <b>${esc(wb.alive.name)}</b> HP ${wb.alive.hp}%` : `เกิดทุกวันเวลา ${wb.hours.map((h) => h + ':00').join(' / ')}`}</p>
      <div class="rankList">${wb.rank.map((r, i) => `<div><span>${i + 1}</span><img src="${ART.classIcon(r[2], 20)}"><b>${esc(r[0])}</b><em>${fmt(r[1])}</em></div>`).join('') || '<small class="hint">ยังไม่มีอันดับดาเมจรอบนี้</small>'}</div>
      <small class="hint">รางวัล: อันดับ 1 = Mythic + Divine ×3 · Top10 = Legendary · Top50 = Epic · ทุกคน = Rare + Pure Crystal · กิลด์ดาเมจสูงสุดได้บัฟ 24 ชม.</small>` : ''}`;
    },
    act(a, d) { if (a === 'go') G.send({ t: 'warp', map: d.m }); }
  };
  WIN.rank = {
    title: '🏆 จัดอันดับ & บอส', w: 640,
    onOpen() { G.send({ t: 'info', what: 'rank' }); G.send({ t: 'info', what: 'boss' }); G.send({ t: 'info', what: 'wb' }); },
    render(o) {
      const r = UI.lastInfo && UI.lastInfo.rank; const tab = o.tab || 'level';
      const b = UI.lastInfo && UI.lastInfo.boss;
      const tabs = [['level', 'เลเวล'], ['pvp', 'PvP Kills'], ['combo', 'Best Combo'], ['tower', 'ดันเจี้ยนสูงสุด'], ['boss', 'Field Boss']];
      let body = '<p class="hint">กำลังโหลด...</p>';
      if (tab === 'boss' && b) body = `<div class="rankList">${b.list.map((x) => `<div><b>${esc(x.map)}</b><em>${x.alive ? '<span class="badge red">ALIVE</span>' : x.next != null ? Math.ceil(x.next / 60) + ' นาที' : 'ยังไม่โหลด'}</em></div>`).join('')}</div>`;
      else if (r && r[tab]) body = `<div class="rankList">${r[tab].map((x, i) => `<div class="${i < 3 ? 'top' + (i + 1) : ''}"><span>${i + 1}</span><img src="${ART.classIcon(x.cls, 22)}"><b>${esc(x.name)}</b><small>Lv${x.lv}</small><em>${tab === 'level' ? 'Lv ' + x.lv : fmt(x.v)}</em></div>`).join('')}</div>`;
      return `<div class="tabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>${body}`;
    },
    act(a, d) { if (a === 'tab') { UI.wins.rank.opts.tab = d.k; renderWin('rank'); } }
  };

  // ---------------------------------------------------------------- GM panel
  WIN.gm = {
    title: '🛡 GM Control Panel', w: 760,
    render() {
      const quick = [['heal', '❤ Heal'], ['god', '🛡 God'], ['hide', '👻 Hide'], ['speed 3', '⚡ Speed×3'], ['speed 1', 'Speed×1'], ['lvup 10', '+10 Lv'], ['allskills', '📖 All Skills'], ['killall', '☠ Kill All'], ['spawnboss', '👹 Spawn Boss'], ['spawn wolf 10', '🐺 10 Wolves'], ['worldboss start', '🌋 World Boss'], ['gvg start 30', '⚔ GvG 30m'], ['gvg stop', 'GvG Stop'], ['event start doubleexp', '×2 EXP'], ['event stop doubleexp', 'EXP ×1'], ['event start doubledrop', '×2 Drop'], ['weather rain', '🌧 Rain'], ['weather snow', '❄ Snow'], ['weather none', '☀ Clear'], ['zeny 1000000', '💰 +1M'], ['item crystal_divine 10', 'Divine ×10'], ['item scroll_protect 10', 'Protect ×10'], ['gear weapon 100 5 +15', 'Mythic Weapon +15'], ['stairs', '🗼 Open Stairs'], ['who', '👥 Who'], ['bosstimer', '⏱ Boss Timers'], ['save', '💾 Save'], ['audit 20', '📜 Audit']];
      return `<div class="gmQuick">${quick.map(([c, n]) => `<button class="btn tiny" data-act="cmd" data-c="${esc(c)}">${n}</button>`).join('')}</div>
        <div class="gmLine"><input id="gmIn" placeholder="พิมพ์คำสั่ง เช่น warp golden_dunes / item pot_hp_3 100 / ban name 3 spam"><button class="btn gold" data-act="run">Run</button></div>
        <pre id="gmOut" class="gmOut">GM Lv ${G.char.gm} พร้อมใช้งาน — ทุกคำสั่งถูกบันทึกใน audit log</pre>
        <details open><summary>คำสั่งทั้งหมด (${(G.gmList || []).length})</summary><div class="gmList">${(G.gmList || []).map((c) => `<div data-act="fill" data-c="${esc(c.usage.replace(/^@/, '').split(' ')[0])}"><code>${esc(c.usage)}</code><span>${esc(c.desc)}</span><em>Lv${c.lv}</em></div>`).join('')}</div></details>`;
    },
    act(a, d) {
      if (a === 'cmd') G.send({ t: 'gm', cmd: d.c });
      if (a === 'run') { const v = $('#gmIn').value.trim(); if (v) G.send({ t: 'gm', cmd: v.replace(/^@/, '') }); }
      if (a === 'fill') { $('#gmIn').value = d.c + ' '; $('#gmIn').focus(); }
    }
  };
  document.addEventListener('keydown', (e) => { if (e.target.id === 'gmIn' && e.key === 'Enter') { const v = e.target.value.trim(); if (v) G.send({ t: 'gm', cmd: v.replace(/^@/, '') }); e.target.value = ''; } }, true);

  // ---------------------------------------------------------------- help
  WIN.help = {
    title: '❔ คู่มือ & ปุ่มลัด', w: 760,
    render() {
      const CREDITS = '<h4>เครดิตงานภาพ</h4><p class="credits">Terrain: Pixel Fantasy Terrain Pack 4 by Laphkal · Ashen props &amp; ground: Brimspire by PixLog · Tundra / forest / moon props: roboden tileset (CC0) · Dungeon tileset · Monsters: Topdown Monsters Part 1 · UI: CinderUI kit</p>';
      return CREDITS + `<div class="help scrollKeep"><h4>ปุ่มควบคุม</h4><div class="keys">
        <span><kbd>WASD</kbd>/<kbd>คลิกพื้น</kbd> เดิน</span><span><kbd>คลิกมอน</kbd> โจมตีปกติ</span><span><kbd>Tab</kbd> สลับเป้า</span><span><kbd>Space</kbd> ตีเป้าใกล้สุด</span>
        <span><kbd>1</kbd>–<kbd>0</kbd> Hotbar ชุดที่แสดง</span><span><kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>0</kbd> Hotbar อีกชุด</span><span><kbd>⇄</kbd> สลับชุด Hotbar 1/2</span><span><kbd>Q</kbd> Break Free</span><span><kbd>F1</kbd>/<kbd>F2</kbd> ยา HP/SP</span>
        <span><kbd>U</kbd> ตัวละคร</span><span><kbd>I</kbd> กระเป๋า</span><span><kbd>K</kbd> สกิล</span><span><kbd>O</kbd> ออโต้</span><span><kbd>\`</kbd> เปิด/ปิดออโต้</span><span><kbd>M</kbd> แผนที่</span><span><kbd>J</kbd> ดันเจี้ยน</span><span><kbd>G</kbd> กิลด์</span><span><kbd>P</kbd> ปาร์ตี้</span><span><kbd>R</kbd> อันดับ</span><span><kbd>Enter</kbd> แชท</span><span><kbd>ล้อเมาส์</kbd> ซูม</span><span><kbd>คลิกขวาผู้เล่น</kbd> เมนู</span><span><kbd>F10</kbd> GM</span></div>
        <h4>ระบบคอมโบ</h4><p>สกิลแบ่งเป็น <b class="rS">STARTER</b> (เปิด/ใส่แท็ก) → <b class="rL">LINKER</b> (โบนัสเมื่อเป้ามีแท็ก) → <b class="rF">FINISHER</b> (ใช้แท็กทิ้ง แลกดาเมจมหาศาล — ถ้าไม่มีแท็กดาเมจเหลือครึ่งเดียว) · ใช้สกิลต่างกันติดกันภายใน 2.5 วินาที = Combo +1 · ดาเมจ +3% ต่อ Combo (สูงสุด +60%) · Combo 5/10/15/20 เติมเกจ Ultimate</p>
        <div class="chips">${D.TAG_IDS.map((t) => `${ART.tagChip(t)}<small>${D.TAGS[t].th}</small>`).join(' ')}</div>
        <h4>ปฏิกิริยาธาตุ (ข้ามคลาสได้)</h4><div class="rxList">${Object.entries(D.REACTIONS).map(([k, r]) => `<div><b style="color:${r.color}">${r.n}</b><span>${r.need.map((n) => D.TAGS[n].n).join(r.all ? ' + ' : ' / ')} ${r.el ? '+ สกิลธาตุ ' + r.el.join('/') : ''}</span><em>×${r.mult}</em></div>`).join('')}</div>
        <h4>คำสั่งแชท</h4><p><code>/w ชื่อ ข้อความ</code> กระซิบ · <code>/p</code> ปาร์ตี้ · <code>/g</code> กิลด์ · <code>/world</code> แชทโลก · <code>/invite ชื่อ</code> · <code>/ginvite ชื่อ</code> · <code>/duel ชื่อ</code> · <code>@help</code> คำสั่ง GM</p>
        <h4>เนื้อหา</h4><p>5 เมืองหลัก · 25 แผนที่ฟาร์ม (Lv1–250) แต่ละแผนที่ใหญ่ 260–340 ช่อง พร้อม Field Boss · 5 ดันเจี้ยน × 1000 ชั้น · World Boss วันละ 3 รอบ · Guild War 5 ปราสาท · PvP Arena + Open PK (แผนที่ 21–25) · ตีบวก +20 · รูน 10 ชนิด × 5 ระดับ · อัญมณี 6 ชนิด × 10 ระดับ · 10 คลาส × 50 สกิล</p></div>`;
    }
  };
})();

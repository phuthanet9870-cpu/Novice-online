// Game client: network, state, input, prediction, rendering, VFX.
(function () {
  const D = NO_DATA, M = NO_MAP, F = NO_F;
  let SK = NO_SKILLS.SKILLS;
  const TS = ART.TS;
  const TAG_IDS = D.TAG_IDS;
  const G = window.G = {
    ws: null, me: 0, char: null, st: null, ents: new Map(), map: null, mapId: '', info: {}, self: { x: 0, y: 0 }, cam: { x: 0, y: 0 }, zoom: 1.25,
    sme: {}, target: 0, hover: 0, cds: {}, cdDur: {}, keys: {}, path: null, pending: null, parts: [], anims: [], texts: [], tele: [],
    shake: 0, flash: 0, lastMv: 0, sentX: 0, sentY: 0, mouse: { x: 0, y: 0, wx: 0, wy: 0 }, weather: '', t: 0, ping: 0, fps: 0
  };

  // ------------------------------------------------------------ network
  G.connect = function (onOpen) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = G.ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = onOpen;
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } const h = HANDLERS[m.t]; if (h) h(m); };
    ws.onclose = () => { UI.disconnected(); };
  };
  G.send = (m) => { if (G.ws && G.ws.readyState === 1) G.ws.send(JSON.stringify(m)); };

  const HANDLERS = {
    hello: () => {},
    auth: (m) => UI.onAuth(m),
    chars: (m) => UI.onChars(m),
    kicked: (m) => UI.kicked(m.m),
    err: (m) => UI.toast(m.m, 'err'),
    notice: (m) => UI.notice(m.m, m.k),
    chat: (m) => { UI.chat(m.ch, m.f, m.m); if (m.ch === 'map' && m.id) { const e = G.ents.get(m.id); if (e) { e.bubble = m.m; e.bubbleT = G.t + 5; } } },
    gm: (m) => UI.gmOut(m.m),
    gmlist: (m) => { G.gmList = m.list; },
    gmdata: (m) => UI.onGmData && UI.onGmData(m),
    enter: (m) => enterMap(m),
    snap: (m) => applySnap(m),
    char: (m) => { const { t, ...rest } = m; Object.assign(G.char, rest); if (rest.st) G.st = rest.st; UI.refresh(Object.keys(rest)); },
    cd: (m) => { G.cds[m.id] = performance.now() / 1000 + m.d; G.cdDur[m.id] = m.d; },
    cdreset: () => { G.cds = {}; },
    cdshift: (m) => { for (const k in G.cds) if (k !== m.except) G.cds[k] -= m.d; },
    range: (m) => { G.pending = { id: m.id, tid: m.tgt, r: m.r, until: G.t + 4 }; },
    dead: (m) => UI.dead(m),
    revived: () => UI.hideDead(),
    loot: (m) => UI.loot(m),
    refineRes: (m) => UI.refineResult(m),
    info: (m) => UI.info(m),
    invite: (m) => UI.invite(m),
    weather: (m) => { G.weather = m.w; },
    killfeed: (m) => UI.killfeed(m),
    autoReport: (m) => UI.autoReport(m),
    pong: (m) => { G.ping = Math.round(performance.now() - m.c); },
    storage: (m) => UI.onStorage(m), mail: (m) => UI.onMail(m), ah: (m) => UI.onAh(m), trade: (m) => UI.onTrade(m), ranked: (m) => UI.onRanked(m), loginReward: () => UI.loginPopup(),
    reloadSkills: () => { const s = document.createElement('script'); s.src = '/shared/skills.js?' + Date.now(); s.onload = () => { SK = NO_SKILLS.SKILLS; ART.clearIcons(); UI.refresh(['skills']); }; document.head.appendChild(s); }
  };

  function enterMap(m) {
    G.mapId = m.map; G.info = m.info; G.me = m.me;
    G.map = M.getMap(m.map);
    G.mini = ART.minimap(G.map);
    ART.resetChunks();
    G.ents.clear(); G.parts = []; G.anims = []; G.texts = []; G.tele = [];
    G.self.x = m.x; G.self.y = m.y; G.cam.x = m.x; G.cam.y = m.y; G.path = null; G.pending = null; G.target = 0;
    G.char = m.char; G.st = m.char.st;
    G.weather = m.info.weather || (D.BIOMES[G.map.def.biome] && G.map.def.biome === 'snow' ? 'snow' : G.map.def.biome === 'volcano' ? 'ash' : '');
    if (window.SFX) { SFX.setBiome(G.map.def.kind === 'town' ? 'town' : G.map.def.biome); SFX.startMusic(); }
    UI.onEnter(m);
  }

  function applySnap(m) {
    for (const a of m.a || []) {
      const e = Object.assign(G.ents.get(a.id) || {}, a);
      e.x = e.tx = a.x / 10; e.y = e.ty = a.y / 10;
      e.hp = e.hp === undefined ? 100 : e.hp; e.tags = e.tags || 0; e.fl = e.fl || 0; e.dir = e.dir || 0;
      G.ents.set(a.id, e);
    }
    for (const r of m.r || []) { G.ents.delete(r); if (G.target === r) G.target = 0; }
    for (const u of m.u) {
      const e = G.ents.get(u[0]); if (!e) continue;
      const nx = u[1] / 10, ny = u[2] / 10;
      if (Math.abs(nx - e.tx) > 0.01 || Math.abs(ny - e.ty) > 0.01) { e.dir = Math.atan2(ny - e.ty, nx - e.tx); e.movedAt = G.t; }
      e.tx = nx; e.ty = ny;
      if (e.hp !== u[3] && u[3] < e.hp) e.hitAt = G.t;
      e.hp = u[3]; e.tags = u[4]; e.fl = u[5];
    }
    const me = m.me;
    if (me) {
      if (me.st) { G.st = me.st; if (G.char) G.char.st = me.st; delete me.st; }
      if (me.buffs) { G.buffs = me.buffs.map((b) => ({ k: b[0], n: b[1], until: G.t + b[2], icon: b[3], debuff: b[4] })); delete me.buffs; UI.buffs(); }
      if (me.x !== undefined && (me.fp || (me.au && !(G.autoStopAt && G.t - G.autoStopAt < 1)) || me.dead)) {
        const d = Math.hypot(me.x - G.self.x, me.y - G.self.y);
        if (me.fp || d > 3) { G.self.x = me.x; G.self.y = me.y; G.path = null; }
        else { G.self.x += (me.x - G.self.x) * 0.5; G.self.y += (me.y - G.self.y) * 0.5; }
      }
      const prevLv = G.sme.lv;
      G.sme = me;
      if (G.char) { G.char.exp = me.exp; if (prevLv && me.lv !== prevLv) G.char.lv = me.lv; }
    }
    for (const f of m.fx || []) onFx(f);
    UI.hud();
  }

  // ------------------------------------------------------------ helpers
  const now = () => performance.now() / 1000;
  G.selfEnt = () => G.ents.get(G.me);
  G.isEnemy = function (e) {
    if (!e || e.id === G.me) return false;
    if (e.k === 'm') return true;
    if (e.k === 's') { const o = G.ents.get(e.own); return o ? G.isEnemy(o) : false; }
    if (e.k === 'c') return true;
    if (e.k === 'p') return G.info.pvp && !e.pt && !(G.char.guild && e.g && G.char.guild.name === e.g && (G.info.kind === 'castle' || G.info.kind === 'wb'));
    return false;
  };
  G.hasTag = (e, tag) => (e.tags & (1 << TAG_IDS.indexOf(tag))) !== 0;
  G.tagList = (e) => TAG_IDS.filter((t, i) => e.tags & (1 << i));
  G.skillLv = (id) => (G.char && G.char.skills[id]) || 0;
  G.cdLeft = (id) => Math.max(0, (G.cds[id] || 0) - now());
  G.toScreen = (x, y) => [(x - G.cam.x) * TS * G.zoom + G.cv.width / 2 / G.dpr, (y - G.cam.y) * TS * G.zoom + G.cv.height / 2 / G.dpr];
  G.toWorld = (sx, sy) => [(sx - G.cv.width / 2 / G.dpr) / (TS * G.zoom) + G.cam.x, (sy - G.cv.height / 2 / G.dpr) / (TS * G.zoom) + G.cam.y];
  G.autoOn = () => !!(G.sme && G.sme.au) && !(G.autoStopAt && G.t - G.autoStopAt < 1);
  // manual movement (click / WASD / joystick) takes control back from auto
  G.stopAuto = function () {
    if (!(G.sme && G.sme.au) || (G.autoStopAt && G.t - G.autoStopAt < 1)) return;
    G.autoStopAt = G.t;
    G.send({ t: 'autoOn', on: false });
    UI.toast('ปิดออโต้แล้ว — กลับมาควบคุมเอง');
  };

  // ------------------------------------------------------------ actions
  G.useSkill = function (id) {
    const sk = SK[id]; if (!sk) return;
    if (!G.skillLv(id)) return UI.toast('ยังไม่ได้เรียนสกิลนี้', 'err');
    if (G.autoOn()) return UI.toast('ปิดออโต้ก่อนกดสกิลเอง', 'err');
    if (G.cdLeft(id) > 0.05) return;
    let tid = G.target;
    const t = G.ents.get(tid);
    if (!t || !G.isEnemy(t) || t.fl & 1) { tid = 0; const n = G.nearestEnemy(12); if (n && (sk.shape === 'single' || sk.shape === 'chain')) { tid = n.id; G.target = n.id; } }
    let ax = G.mouse.wx, ay = G.mouse.wy;
    if (sk.self || sk.shape === 'single' || sk.shape === 'chain') { ax = undefined; ay = undefined; }
    const tt = G.ents.get(tid);
    if ((sk.shape === 'line' || sk.shape === 'cone') && tt) { ax = tt.x; ay = tt.y; }
    G.send({ t: 'sk', id, tid, x: ax, y: ay });
    G.cds[id] = Math.max(G.cds[id] || 0, now() + 0.15);
  };
  G.useHotbar = function (i) {
    const h = G.char.hotbar[i]; if (!h) return;
    if (h.startsWith('item:')) G.send({ t: 'use', id: h.slice(5) });
    else G.useSkill(h);
  };
  G.nearestEnemy = function (r) {
    let best = null, bd = r * r;
    for (const e of G.ents.values()) { if (!G.isEnemy(e) || e.fl & 1) continue; const d = (e.x - G.self.x) ** 2 + (e.y - G.self.y) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  };
  G.cycleTarget = function () {
    const list = [...G.ents.values()].filter((e) => G.isEnemy(e) && !(e.fl & 1) && Math.hypot(e.x - G.self.x, e.y - G.self.y) < 16).sort((a, b) => Math.hypot(a.x - G.self.x, a.y - G.self.y) - Math.hypot(b.x - G.self.x, b.y - G.self.y));
    if (!list.length) return;
    const i = list.findIndex((e) => e.id === G.target);
    G.target = list[(i + 1) % list.length].id;
  };
  G.walkTo = function (x, y) {
    if (G.autoOn()) return;
    const p = M.findPath(G.map, G.self.x, G.self.y, x, y, 12000);
    G.path = p && p.length ? p : null;
  };
  G.clickEntity = function (e) {
    if (e.k === 'i') { G.stopAuto(); G.lootGoal = e.id; G.walkTo(e.x, e.y); return; }
    G.target = e.id;
    if (e.k === 'n') { G.stopAuto(); G.npcGoal = e.id; G.walkTo(e.x, e.y + 1); G.send({ t: 'stop' }); return; }
    if (G.isEnemy(e)) { G.send({ t: 'atk', id: e.id }); G.chase = e.id; }
  };

  // ------------------------------------------------------------ input
  function setupInput() {
    const cv = G.cv;
    window.addEventListener('keydown', (ev) => {
      if (UI.typing()) return;
      const k = ev.key.toLowerCase();
      G.keys[k] = true;
      const hk = UI.hotkeyIndex(ev);
      if (hk >= 0) { G.useHotbar(hk); ev.preventDefault(); return; }
      if (k === 'tab') { G.cycleTarget(); ev.preventDefault(); }
      else if (k === ' ') { const it = G.nearestLoot(4); if (it) G.clickEntity(it); else { const e = G.ents.get(G.target) || G.nearestEnemy(10); if (e && G.isEnemy(e)) G.clickEntity(e); } ev.preventDefault(); }
      else if (k === 'f1') { G.send({ t: 'use', id: bestPot('hp') }); ev.preventDefault(); }
      else if (k === 'f2') { G.send({ t: 'use', id: bestPot('sp') }); ev.preventDefault(); }
      else if (k === 'q') G.send({ t: 'breakfree' });
      else if (k === 't') G.send({ t: 'mount' });
      else if (k === 'e') UI.emoteWheel();
      else if (k === 'escape') { if (!UI.closeTop()) UI.toggle('help'); }
      else if (k === 'enter') { UI.focusChat(); ev.preventDefault(); }
      else UI.windowKey(k, ev);
    });
    window.addEventListener('keyup', (ev) => { G.keys[ev.key.toLowerCase()] = false; });
    cv.addEventListener('mousemove', (ev) => { G.mouse.x = ev.clientX; G.mouse.y = ev.clientY; });
    cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
    cv.addEventListener('mousedown', (ev) => {
      UI.blurChat();
      const [wx, wy] = G.toWorld(ev.clientX, ev.clientY);
      const e = pickEntity(ev.clientX, ev.clientY);
      if (ev.button === 2) { if (e && e.k === 'p' && e.id !== G.me) UI.playerMenu(e, ev.clientX, ev.clientY); return; }
      if (e && e.id !== G.me) { G.clickEntity(e); return; }
      G.chase = null; G.npcGoal = null; G.send({ t: 'stop' });
      G.stopAuto();
      G.walkTo(wx, wy);
      G.anims.push({ k: 'click', x: wx, y: wy, t0: G.t, d: 0.5 });
    });
    cv.addEventListener('wheel', (ev) => { G.zoom = Math.max(0.55, Math.min(1.8, G.zoom * (ev.deltaY > 0 ? 0.9 : 1.1))); ev.preventDefault(); }, { passive: false });
    // touch: tap = click
    cv.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; G.mouse.x = t.clientX; G.mouse.y = t.clientY; cv.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 })); ev.preventDefault(); }, { passive: false });
    window.addEventListener('resize', resize);
  }
  function bestPot(kind) {
    let best = null;
    for (const it of G.char.inv) { const d = D.ITEMS[it.id]; if (d && d.type === 'potion' && d[kind] && d.lv <= G.char.lv && (!best || d[kind] > D.ITEMS[best][kind])) best = it.id; }
    return best;
  }
  G.bestPot = bestPot;
  function pickEntity(sx, sy) {
    let best = null, bd = 30 * 30;
    for (const e of G.ents.values()) {
      if (e.k === 'z' || (e.fl & 1 && e.k !== 'n')) continue;
      const [x, y] = G.toScreen(e.x, e.y);
      const sz = (e.sz || 1) * 22 * G.zoom;
      const d = (sx - x) ** 2 + (sy - (y - sz * 0.7)) ** 2;
      if (d < Math.max(bd, sz * sz) && d < bd + sz * sz) { bd = d; best = e; }
    }
    return best;
  }
  function resize() {
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.cv.width = innerWidth * G.dpr; G.cv.height = innerHeight * G.dpr;
    G.cv.style.width = innerWidth + 'px'; G.cv.style.height = innerHeight + 'px';
  }

  // ------------------------------------------------------------ movement & prediction
  function updateSelf(dt) {
    if (!G.map || !G.st) return;
    const se = G.selfEnt();
    const dead = G.sme.dead;
    const hard = se && (G.hasTag(se, 'stun') || G.hasTag(se, 'freeze') || G.hasTag(se, 'airborne') || G.hasTag(se, 'knockdown') || G.hasTag(se, 'root') || G.hasTag(se, 'fear'));
    if (G.autoOn() && !UI.typing() && ((G.joy && (G.joy.x || G.joy.y)) || G.keys.w || G.keys.a || G.keys.s || G.keys.d || G.keys.arrowup || G.keys.arrowdown || G.keys.arrowleft || G.keys.arrowright)) G.stopAuto();
    if (G.autoOn() || dead || hard || G.sme.cast) { if (se) { se.moving = G.autoOn() && Math.hypot(se.tx - se.x, se.ty - se.y) > 0.05; } return; }
    let vx = 0, vy = 0;
    if (G.joy && (G.joy.x || G.joy.y)) { vx = G.joy.x; vy = G.joy.y; }
    if (!UI.typing()) {
      if (G.keys.w || G.keys.arrowup) vy -= 1; if (G.keys.s || G.keys.arrowdown) vy += 1;
      if (G.keys.a || G.keys.arrowleft) vx -= 1; if (G.keys.d || G.keys.arrowright) vx += 1;
    }
    let speed = G.st.move * (se && G.hasTag(se, 'slow') ? 0.55 : 1);
    if (vx || vy) { G.path = null; G.chase = null; G.npcGoal = null; const l = Math.hypot(vx, vy); vx /= l; vy /= l; }
    else {
      // chase target into attack range
      const ch = G.chase && G.ents.get(G.chase);
      const pend = G.pending && G.pending.until > G.t ? G.ents.get(G.pending.tid) : null;
      const goal = pend || ch;
      if (goal && !(goal.fl & 1)) {
        const need = pend ? G.pending.r : G.st.range + (goal.sz || 0.6) * 0.4 + 0.3;
        const d = Math.hypot(goal.x - G.self.x, goal.y - G.self.y);
        if (d > need) { if (!G.path || !G.pathGoal || Math.hypot(G.pathGoal[0] - goal.x, G.pathGoal[1] - goal.y) > 1.5) { G.walkTo(goal.x, goal.y); G.pathGoal = [goal.x, goal.y]; } }
        else { G.path = null; if (pend) { G.send({ t: 'sk', id: G.pending.id, tid: G.pending.tid }); G.pending = null; } }
      } else if (ch) G.chase = null;
      if (G.lootGoal) { const it = G.ents.get(G.lootGoal); if (!it) G.lootGoal = null; else if (Math.hypot(it.x - G.self.x, it.y - G.self.y) < 1.9) { G.path = null; G.send({ t: 'pickup', id: it.id }); G.lootGoal = null; } }
      if (G.npcGoal) { const n = G.ents.get(G.npcGoal); if (n && Math.hypot(n.x - G.self.x, n.y - G.self.y) < 2.6) { G.path = null; UI.openNpc(n); G.npcGoal = null; } }
      if (G.path && G.path.length) {
        const [px, py] = G.path[0];
        const dx = px - G.self.x, dy = py - G.self.y, d = Math.hypot(dx, dy);
        if (d < 0.15) G.path.shift(); else { vx = dx / d; vy = dy / d; speed = Math.min(speed, d / dt); }
      }
    }
    if (vx || vy) {
      const nx = G.self.x + vx * speed * dt, ny = G.self.y + vy * speed * dt;
      if (M.walkable(G.map, nx, ny)) { G.self.x = nx; G.self.y = ny; }
      else if (M.walkable(G.map, nx, G.self.y)) G.self.x = nx;
      else if (M.walkable(G.map, G.self.x, ny)) G.self.y = ny;
      else G.path = null;
      if (se) { se.dir = Math.atan2(vy, vx); se.moving = true; }
    } else if (se) se.moving = false;
    if (G.t - G.lastMv > 0.1 && (Math.abs(G.self.x - G.sentX) > 0.01 || Math.abs(G.self.y - G.sentY) > 0.01)) {
      G.lastMv = G.t; G.sentX = G.self.x; G.sentY = G.self.y;
      G.send({ t: 'mv', x: Math.round(G.self.x * 100) / 100, y: Math.round(G.self.y * 100) / 100 });
    }
  }

  // ------------------------------------------------------------ FX
  const ELC = (el) => (D.ELEMENTS[el] || D.ELEMENTS.neutral).color;
  function burst(x, y, col, n, spd = 4, life = 0.6, size = 3, grav = 0) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = spd * (0.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav ? 2 : 0), life, max: life, col, size: size * (0.5 + Math.random()), grav }); }
  }
  G.burst = burst;
  // element-flavoured particles
  const EL_STYLE = {
    fire: [['#ff7a2a', '#ffd34a', '#ff3a1a'], 'dot', -2.5], ice: [['#bff0ff', '#7fdcff', '#ffffff'], 'shard', 0], water: [['#3d8bff', '#8ac8ff'], 'ring', 1.5],
    lightning: [['#fff35a', '#ffffff', '#9ad0ff'], 'spark', 0], wind: [['#9cf5b0', '#e0fff0'], 'ring', -0.5], earth: [['#c8964a', '#8a6a3a', '#e0c080'], 'shard', 5],
    holy: [['#fff6c0', '#ffe080', '#ffffff'], 'star', -1.5], dark: [['#a15cff', '#5a2a8a', '#2a1040'], 'dot', -1], poison: [['#86e04a', '#c0ff80'], 'ring', -1.2],
    blood: [['#ff3a4a', '#a01020'], 'dot', 4], neutral: [['#ffffff', '#dde4ec'], 'spark', 0]
  };
  G.elemBurst = function (x, y, el, n, spd = 4) {
    const st = EL_STYLE[el] || EL_STYLE.neutral;
    n = Math.round(n * (G.settings && G.settings.particles === 0 ? 0.4 : 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = spd * (0.3 + Math.random());
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, col: st[0][(Math.random() * st[0].length) | 0], size: 3 + Math.random() * 3, grav: st[2], sh: st[1] });
    }
  };
  // pets follow their owner (client-side only)
  const petPos = new Map();
  function drawPets(g, dt) {
    for (const e of G.ents.values()) {
      if (e.k !== 'p' || !e.pet || (e.fl & 1)) continue;
      const pd = D.PETS && D.PETS[e.pet[0]]; if (!pd) continue;
      let pp = petPos.get(e.id);
      const side = Math.cos(e.dir || 0) >= 0 ? -1 : 1;
      const tx = e.x + side * 1.1, ty = e.y + 0.4;
      if (!pp || Math.hypot(pp.x - tx, pp.y - ty) > 8) { pp = { x: tx, y: ty }; petPos.set(e.id, pp); }
      const d = Math.hypot(tx - pp.x, ty - pp.y);
      if (d > 0.3) { pp.x += (tx - pp.x) * Math.min(1, dt * 4); pp.y += (ty - pp.y) * Math.min(1, dt * 4); }
      g.save(); g.translate(pp.x, pp.y - (pd.shape === 'bird' || pd.shape === 'spirit' ? 0.5 : 0)); g.scale(1 / 32, 1 / 32);
      ART.drawMonster(g, { sh: pd.shape, col: pd.color, sz: 0.55 + e.pet[1] * 0.006, rk: 5, id: e.id, dir: e.dir }, 0, 0, G.t);
      g.restore();
    }
  }
  function onFx(f) {
    const t = G.t;
    const ent = f.t ? G.ents.get(f.t) : null;
    switch (f.k) {
      case 'hit': {
        const mine = f.s === G.me || f.t === G.me;
        if (UI.onHit) UI.onHit(f);
        if (!mine && !(ent && ent.k === 'p') && !(G.ents.get(f.t) && Math.hypot(f.x - G.self.x, f.y - G.self.y) < 14)) break;
        let col = '#fff', size = 15, txt = f.d.toLocaleString();
        if (f.h) { col = '#5aff8a'; txt = '+' + txt; }
        else if (f.t === G.me) { col = '#ff5a5a'; }
        else if (f.dot) { col = '#d08aff'; size = 12; }
        else if (f.c) { col = '#ffd34a'; size = 22; txt += '!'; G.shake = Math.max(G.shake, 3); }
        if (f.sh) { col = '#8ad0ff'; txt = 'ABSORB ' + txt; }
        G.texts.push({ x: f.x + (Math.random() - 0.5) * 0.8, y: f.y - 1, txt, col, size, t0: t, d: 1.0 + (f.c ? 0.3 : 0), vy: -1.6 });
        if (f.r) { const R = D.REACTIONS[f.r]; G.texts.push({ x: f.x, y: f.y - 2, txt: R ? R.n : String(f.r).toUpperCase(), col: R ? R.color : '#fff', size: 20, t0: t, d: 1.4, vy: -0.8, stroke: 1 }); }
        if (ent) { ent.hitAt = t; }
        if (!f.h && !f.dot) G.elemBurst(f.x, f.y - 0.6, f.el || 'neutral', f.c ? 12 : 6, 5);
        if (window.SFX && !f.h && !f.dot) { if (f.t === G.me) SFX.hurt(); else SFX.hit(f.c, f.el, mine); }
        break;
      }
      case 'cast': {
        const col = ELC(f.el);
        const caster = G.ents.get(f.s); if (caster) caster.attackAt = t;
        const big = f.u;
        const sfx = SK[f.sk] && SK[f.sk].fx;
        if (sfx) {
          const ox = f.sh === 'circle' && !f.self ? f.tx : f.sh === 'single' || f.sh === 'chain' ? f.tx : f.x, oy = f.sh === 'circle' && !f.self ? f.ty : f.sh === 'single' || f.sh === 'chain' ? f.ty : f.y;
          G.anims.push({ k: 'sig', fx: sfx, x: ox, y: oy, t0: t, d: sfx.d + (big ? 0.6 : 0), big, seed: f.sk.length * 31 + f.s });
          if (window.SFX && SFX.sig && Math.hypot(f.x - G.self.x, f.y - G.self.y) < 16) SFX.sig(sfx.snd, big);
        }
        if (window.SFX && Math.hypot(f.x - G.self.x, f.y - G.self.y) < 16) SFX.cast(f.el, big);
        if (big) { G.flash = 0.5; G.flashCol = col; G.shake = 8; if (f.s === G.me || (caster && Math.hypot(caster.x - G.self.x, caster.y - G.self.y) < 20)) UI.ultBanner(SK[f.sk] ? SK[f.sk].name : '', caster ? caster.n : '', col); }
        if (f.sh === 'buff') { burst(f.x, f.y - 0.5, '#9aff9a', 18, 2, 0.9, 3, -1); G.anims.push({ k: 'pillar', x: f.x, y: f.y, col: '#9aff9a', t0: t, d: 0.7 }); break; }
        if (f.sh === 'circle') {
          const ox = f.self ? f.x : f.tx, oy = f.self ? f.y : f.ty;
          G.anims.push({ k: 'ring', x: ox, y: oy, r: f.r || 3, col, t0: t, d: 0.55 });
          G.elemBurst(ox, oy, f.el, 24 + (f.r | 0) * 4, (f.r || 3) * 2.2);
        } else if (f.sh === 'line') {
          G.anims.push({ k: 'beam', x: f.x, y: f.y, tx: f.x + (f.tx - f.x) / (Math.hypot(f.tx - f.x, f.ty - f.y) || 1) * (f.len || 8), ty: f.y + (f.ty - f.y) / (Math.hypot(f.tx - f.x, f.ty - f.y) || 1) * (f.len || 8), col, t0: t, d: 0.4 });
        } else if (f.sh === 'cone') G.anims.push({ k: 'cone', x: f.x, y: f.y, a: Math.atan2(f.ty - f.y, f.tx - f.x), r: f.r || 4, col, t0: t, d: 0.4 });
        else if (f.sh === 'chain') G.anims.push({ k: 'bolt', x: f.x, y: f.y - 0.6, tx: f.tx, ty: f.ty - 0.6, col, t0: t, d: 0.3 });
        else {
          const ranged = caster && caster.k === 'p' && ['bow', 'gun', 'staff', 'scythe', 'mace'].includes(D.CLASSES[caster.c].weapon) && Math.hypot(f.tx - f.x, f.ty - f.y) > 3;
          if (ranged) G.anims.push({ k: 'proj', x: f.x, y: f.y - 0.6, tx: f.tx, ty: f.ty - 0.6, col, t0: t, d: 0.18, big: 1 });
          G.anims.push({ k: 'slash', x: f.tx, y: f.ty - 0.6, col, t0: t + (ranged ? 0.15 : 0), d: 0.3, a: Math.random() * 3 });
        }
        break;
      }
      case 'swing': { const c = G.ents.get(f.s); if (c) c.attackAt = t; if (window.SFX && f.s === G.me) SFX.swing(); G.anims.push({ k: 'swipe', x: f.tx, y: f.ty - 0.5, col: '#fff', t0: t, d: 0.18, a: Math.atan2(f.ty - f.y, f.tx - f.x) }); break; }
      case 'proj': { const c = G.ents.get(f.s); if (c) c.attackAt = t; if (window.SFX && f.s === G.me) SFX.shoot(); G.anims.push({ k: 'proj', x: f.x, y: f.y - 0.6, tx: f.tx, ty: f.ty - 0.6, col: ELC(f.el), t0: t, d: 0.22 }); break; }
      case 'dash': G.anims.push({ k: 'trail', x: f.x, y: f.y, tx: f.tx, ty: f.ty, t0: t, d: 0.35 }); burst(f.tx, f.ty, '#fff', 8, 3, 0.3); break;
      case 'die': if (window.SFX && ent && Math.hypot(f.x - G.self.x, f.y - G.self.y) < 14) SFX.die(); if (ent) { ent.dieAt = t; burst(f.x, f.y - 0.5, ent.col || '#fff', 16, 4, 0.7, 3); } if (f.t === G.target) G.target = 0; break;
      case 'tag': { if (!ent) break; const d = D.TAGS[f.tag]; G.texts.push({ x: f.x, y: f.y - 1.6, txt: d.n.toUpperCase(), col: d.color, size: 12, t0: t, d: 0.9, vy: -0.6 }); break; }
      case 'react': if (window.SFX) SFX.react(); burst(f.x, f.y - 0.6, D.REACTIONS[f.r] ? D.REACTIONS[f.r].color : '#fff', 30, 7, 0.7, 4); G.shake = Math.max(G.shake, 5); G.anims.push({ k: 'ring', x: f.x, y: f.y, r: 2.2, col: D.REACTIONS[f.r] ? D.REACTIONS[f.r].color : '#fff', t0: t, d: 0.5 }); break;
      case 'txt': G.texts.push({ x: f.x, y: f.y - 2, txt: f.m, col: f.c || '#fff', size: f.big ? 20 : 13, t0: t, d: 1.3, vy: -0.7, stroke: 1 }); break;
      case 'tele': G.tele.push({ x: f.x, y: f.y, r: f.r, t0: t, d: f.d }); break;
      case 'boom': G.anims.push({ k: 'ring', x: f.x, y: f.y, r: f.r || 2, col: ELC(f.el), t0: t, d: 0.45 }); burst(f.x, f.y, ELC(f.el), 20, (f.r || 2) * 3, 0.5, 4); G.shake = Math.max(G.shake, 3); break;
      case 'bolt': G.anims.push({ k: 'bolt', x: f.x, y: f.y - 0.6, tx: f.tx, ty: f.ty - 0.6, col: '#fff35a', t0: t, d: 0.3 }); break;
      case 'lvup': if (window.SFX && f.t === G.me) SFX.level(); G.anims.push({ k: 'pillar', x: f.x, y: f.y, col: '#ffd34a', t0: t, d: 1.6, big: 1 }); burst(f.x, f.y - 1, '#ffd34a', 40, 3, 1.4, 3, -1); G.texts.push({ x: f.x, y: f.y - 2.5, txt: 'LEVEL UP!', col: '#ffd34a', size: 22, t0: t, d: 2, vy: -0.4, stroke: 1 }); break;
      case 'loot': if (window.SFX && Math.hypot(f.x - G.self.x, f.y - G.self.y) < 10) SFX.coin(); if (f.z) G.texts.push({ x: f.x, y: f.y - 0.5, txt: '+' + f.z + 'z', col: '#ffe08a', size: 11, t0: t + 0.2, d: 1, vy: -1 }); if (f.n) burst(f.x, f.y - 0.3, '#ffe08a', 10, 2, 0.8, 2.5, -1); break;
      case 'pot': burst(f.x, f.y - 0.6, f.c || '#5f5', 10, 1.5, 0.8, 2.5, -1); break;
      case 'buffed': burst(f.x, f.y - 0.6, '#aaffaa', 14, 1.5, 0.9, 2.5, -1); break;
      case 'castbar': { const c = G.ents.get(f.s); if (c) { c.castUntil = t + f.d; c.castDur = f.d; } G.anims.push({ k: 'circle', x: f.x, y: f.y, col: '#9cf', t0: t, d: f.d }); break; }
      case 'mark': G.anims.push({ k: 'mark', id: f.t, t0: t, d: f.d }); break;
      case 'poof': burst(f.x, f.y - 0.4, '#bbb', 8, 2, 0.4); break;
      case 'trait': { const s = SK[f.sk]; const c = s && s.fx ? s.fx.c[1] : '#fff'; G.texts.push({ x: f.x, y: f.y - 2.3, txt: '✦ ' + f.m, col: c, size: 12, t0: t, d: 1.4, vy: -0.5, stroke: 1 }); if (s && s.fx) G.anims.push({ k: 'sig', fx: Object.assign({}, s.fx, { s: s.fx.s * 0.6 }), x: f.x, y: f.y, t0: t, d: 0.5, seed: 7 }); break; }
      case 'pick': if (window.SFX && f.t === G.me) SFX.loot(); burst(f.x, f.y - 0.3, '#ffe08a', 6, 2, 0.4, 2, -1); break;
      case 'emote': if (ent) { ent.emote = f.e; ent.emoteT = G.t + 3; } break;
      case 'ach': G.anims.push({ k: 'pillar', x: f.x, y: f.y, col: '#ffcc33', t0: t, d: 1.5, big: 1 }); burst(f.x, f.y - 1, '#ffcc33', 30, 3, 1.2, 3, -1); G.texts.push({ x: f.x, y: f.y - 2.8, txt: '🏅 ' + f.m, col: '#ffcc33', size: 16, t0: t, d: 2.2, vy: -0.3, stroke: 1 }); break;
    }
  }

  // ------------------------------------------------------------ render
  function render(dt) {
    const cv = G.cv, g = G.ctx;
    const W = cv.width / G.dpr, H = cv.height / G.dpr;
    g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g.fillStyle = G.map && G.map.def.kind === 'dungeon' ? '#07060c' : '#0d1015'; g.fillRect(0, 0, W, H);
    if (!G.map) return;
    // camera
    G.cam.x += (G.self.x - G.cam.x) * Math.min(1, dt * 10);
    G.cam.y += (G.self.y - G.cam.y) * Math.min(1, dt * 10);
    let sx = 0, sy = 0;
    if (G.settings && G.settings.shake === false) G.shake = 0;
    if (G.shake > 0.1) { sx = (Math.random() - 0.5) * G.shake; sy = (Math.random() - 0.5) * G.shake; G.shake *= 0.85; }
    g.save(); g.translate(sx, sy);
    const z = G.zoom, scale = TS * z;
    const ox = W / 2 - G.cam.x * scale, oy = H / 2 - G.cam.y * scale;
    // chunks
    const CHN = 16;
    const x0 = Math.floor((G.cam.x - W / 2 / scale) / CHN) - 1, x1 = Math.floor((G.cam.x + W / 2 / scale) / CHN) + 1;
    const y0 = Math.floor((G.cam.y - H / 2 / scale) / CHN) - 1, y1 = Math.floor((G.cam.y + H / 2 / scale) / CHN) + 1;
    g.imageSmoothingEnabled = z < 1;
    for (let cy = Math.max(0, y0); cy <= Math.min(Math.ceil(G.map.h / CHN), y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(Math.ceil(G.map.w / CHN), x1); cx++) {
      const c = ART.chunk(G.map, cx, cy);
      g.drawImage(c, ox + (cx * CHN - c.pad) * scale, oy + (cy * CHN - c.pad) * scale, c.width * z, c.height * z);
    }
    // dungeon darkness vignette
    g.save(); g.translate(ox, oy); g.scale(scale, scale);
    // ground decals: zones, telegraphs, click marks, target ring
    for (const e of G.ents.values()) if (e.k === 'z') drawZone(g, e);
    G.tele = G.tele.filter((tl) => G.t - tl.t0 < tl.d);
    for (const tl of G.tele) {
      const p = (G.t - tl.t0) / tl.d;
      g.fillStyle = 'rgba(255,40,40,0.18)'; g.beginPath(); g.arc(tl.x, tl.y, tl.r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,60,40,0.35)'; g.beginPath(); g.arc(tl.x, tl.y, tl.r * p, 0, 7); g.fill();
      g.strokeStyle = '#ff4030'; g.lineWidth = 0.08; g.beginPath(); g.arc(tl.x, tl.y, tl.r, 0, 7); g.stroke();
    }
    const tg = G.ents.get(G.target);
    if (tg) { g.strokeStyle = G.isEnemy(tg) ? '#ff5050' : '#5ad0ff'; g.lineWidth = 0.07; g.setLineDash([0.25, 0.15]); g.lineDashOffset = -G.t; g.beginPath(); g.ellipse(tg.x, tg.y, 0.8 * (tg.sz || 1), 0.4 * (tg.sz || 1), 0, 0, 7); g.stroke(); g.setLineDash([]); }
    if (G.path && G.path.length) { const l = G.path[G.path.length - 1]; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.05; g.beginPath(); g.arc(l[0], l[1], 0.3 + Math.sin(G.t * 6) * 0.05, 0, 7); g.stroke(); }
    g.restore();
    // entities (y-sorted)
    const list = [];
    for (const e of G.ents.values()) {
      if (e.k === 'z') continue;
      const k = Math.min(1, dt * 12);
      if (e.id === G.me) { e.x = G.self.x; e.y = G.self.y; }
      else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.moving = G.t - (e.movedAt || 0) < 0.25; }
      if (e.dieAt && G.t - e.dieAt > 1.2) continue;
      list.push(e);
    }
    list.sort((a, b) => a.y - b.y);
    for (const e of list) drawEntity(g, e, ox + e.x * scale, oy + e.y * scale, z);
    // fx in world space
    g.save(); g.translate(ox, oy); g.scale(scale, scale);
    drawAnims(g);
    drawPets(g, dt);
    for (const p of G.parts) {
      const a = p.life / p.max; g.globalAlpha = a; g.fillStyle = p.col; const sz = p.size / TS * (0.5 + a * 0.5);
      if (p.sh === 'shard') { g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); g.fillRect(-sz * 2, -sz * 0.4, sz * 4, sz * 0.8); g.restore(); }
      else if (p.sh === 'spark') { g.strokeStyle = p.col; g.lineWidth = sz * 0.7; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); g.stroke(); }
      else if (p.sh === 'ring') { g.strokeStyle = p.col; g.lineWidth = sz * 0.4; g.beginPath(); g.arc(p.x, p.y, sz * 1.4, 0, 7); g.stroke(); }
      else if (p.sh === 'star') { g.save(); g.translate(p.x, p.y); g.rotate(G.t * 4 + p.size); g.fillRect(-sz, -sz * 0.25, sz * 2, sz * 0.5); g.fillRect(-sz * 0.25, -sz, sz * 0.5, sz * 2); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, sz, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    g.restore();
    // overhead labels
    for (const e of list) drawOverhead(g, e, ox + e.x * scale, oy + e.y * scale, z);
    // floating texts
    for (const tx of G.texts) {
      const p = (G.t - tx.t0) / tx.d; if (p < 0) continue;
      const x = ox + tx.x * scale, y = oy + (tx.y + tx.vy * p) * scale;
      g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      const s = tx.size * (p < 0.12 ? 1 + (0.12 - p) * 4 : 1);
      g.font = `900 ${s}px "Kanit", sans-serif`; g.textAlign = 'center';
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(tx.txt, x, y);
      g.fillStyle = tx.col; g.fillText(tx.txt, x, y);
    }
    g.globalAlpha = 1;
    g.restore();
    // dungeon light
    if (G.map.def.kind === 'dungeon' || G.map.def.biome === 'abyss') {
      const [px, py] = G.toScreen(G.self.x, G.self.y);
      const gr = g.createRadialGradient(px, py - 10, 160 * z, px, py - 10, 760 * z);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(5,0,15,0.6)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    drawWeather(g, W, H, dt);
    if (G.flash > 0.01) { g.globalAlpha = G.flash; g.fillStyle = G.flashCol || '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; G.flash *= 0.88; }
    // vignette for low hp
    if (G.sme && G.sme.hp / G.sme.mhp < 0.25 && !G.sme.dead) {
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${0.3 + Math.sin(G.t * 6) * 0.1})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }
  function drawZone(g, e) {
    const col = e.col || '#fff';
    const pulse = 0.85 + Math.sin(G.t * 4 + e.id) * 0.1;
    if (e.zk === 'trap') {
      g.strokeStyle = col; g.lineWidth = 0.06; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(e.x, e.y, 0.55, 0, 7); g.stroke();
      g.save(); g.translate(e.x, e.y); g.rotate(G.t); g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * 2.094; g.moveTo(Math.cos(a) * 0.55, Math.sin(a) * 0.55); g.lineTo(Math.cos(a + 2.094) * 0.55, Math.sin(a + 2.094) * 0.55); } g.stroke(); g.restore();
      g.globalAlpha = 1; return;
    }
    g.globalAlpha = 0.22 * pulse; g.fillStyle = col; g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.fill();
    g.globalAlpha = 0.7; g.strokeStyle = col; g.lineWidth = 0.08; g.setLineDash([0.4, 0.25]); g.lineDashOffset = G.t * 0.8; g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.stroke(); g.setLineDash([]);
    g.globalAlpha = 1;
    if (Math.random() < 0.3) G.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 1.6, y: e.y + (Math.random() - 0.5) * e.r * 1.6, vx: 0, vy: -1.5, life: 0.7, max: 0.7, col, size: 3, grav: 0 });
  }
  const iconImgs = new Map();
  G.iconImg = (url) => { let im = iconImgs.get(url); if (!im) { im = new Image(); im.src = url; iconImgs.set(url, im); } return im; };
  G.nearestLoot = function (r) { let best = null, bd = r * r; for (const e of G.ents.values()) if (e.k === 'i' && e.mine) { const d = (e.x - G.self.x) ** 2 + (e.y - G.self.y) ** 2; if (d < bd) { bd = d; best = e; } } return best; };
  function drawGroundItem(g, e, x, y, z) {
    const rc = e.rar >= 0 ? D.RARITY[e.rar].color : e.it.id === 'zeny' ? '#ffd34a' : '#e8e8f0';
    const bob = Math.sin(G.t * 3 + e.id) * 2;
    g.save(); g.translate(x, y); g.scale(z, z); g.globalAlpha = e.mine ? 1 : 0.55;
    if (e.rar >= 2) { const gr = g.createLinearGradient(0, 0, 0, -70 - e.rar * 12); gr.addColorStop(0, rc); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha *= 0.35 + Math.sin(G.t * 4) * 0.1; g.fillStyle = gr; g.fillRect(-4 - e.rar, -70 - e.rar * 12, 8 + e.rar * 2, 70 + e.rar * 12); g.globalAlpha = e.mine ? 1 : 0.55; }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 3, 10, 4, 0, 0, 7); g.fill();
    if (e.it.id === 'zeny') { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ffd34a' : '#e0a820'; g.beginPath(); g.ellipse(-6 + (i * 5) % 13, -2 - Math.floor(i / 2) * 3 + bob * 0.3, 5, 2.5, 0, 0, 7); g.fill(); } }
    else { const im = G.iconImg(ART.itemIcon(e.it)); if (im.complete) g.drawImage(im, -12, -24 + bob, 24, 24); }
    g.restore();
  }
  function drawEntity(g, e, x, y, z) {
    if (e.k === 'i') return drawGroundItem(g, e, x, y, z);
    const t = G.t;
    g.save(); g.translate(x, y); g.scale(z, z);
    const dead = e.fl & 1;
    let lift = 0;
    if (G.hasTag(e, 'airborne')) lift = 18 + Math.sin(t * 6) * 2;
    if (dead) { const p = Math.min(1, (t - (e.dieAt || t)) / 1.0); g.globalAlpha = 1 - p * 0.9; }
    if (e.fl & 4) g.globalAlpha = e.id === G.me || !G.isEnemy(e) ? 0.35 : 0.08;
    // shadow
    const sz = e.sz || 1;
    if (e.k !== 'n' || (e.role !== 'stairs' && e.role !== 'portal')) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 2, 11 * sz * (lift ? 0.7 : 1), 4.5 * sz, 0, 0, 7); g.fill(); }
    g.translate(0, -lift);
    if (G.hasTag(e, 'knockdown') && !lift) { g.rotate(e.k === 'p' ? 1.3 : 0.4); g.translate(4, 4); }
    const flashHit = G.t - (e.hitAt || -9) < 0.1;
    if (e.attackAt && G.t - e.attackAt < 0.25) e.attackAnim = Math.sin((G.t - e.attackAt) / 0.25 * Math.PI); else e.attackAnim = 0;
    if (flashHit && !dead) g.filter = 'brightness(2.2)';
    if (e.k === 'p') {
      const gs = e.fl & 64 ? 1.7 : 1;
      if (e.mt) { ART.drawMount(g, e.mt, 0, 0, t + e.id, e.moving, Math.cos(e.dir || 0) >= 0 ? 1 : -1); g.translate(0, -14); }
      ART.drawPlayer(g, e, 0, 0, t + e.id, gs);
    }
    else if (e.k === 'm' || e.k === 's') ART.drawMonster(g, e, 0, 0, t);
    else if (e.k === 'n') ART.drawNpc(g, e, 0, 0, t);
    else if (e.k === 'c') ART.drawCore(g, e, 0, 0, t);
    g.filter = 'none';
    if (G.hasTag(e, 'freeze')) { g.fillStyle = 'rgba(120,210,255,0.45)'; ART.roundRect(g, -14 * sz, -38 * sz, 28 * sz, 42 * sz, 6); g.fill(); g.strokeStyle = '#cff'; g.lineWidth = 1.5; g.stroke(); }
    if (G.hasTag(e, 'stun')) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#ffe066'; g.font = '10px sans-serif'; g.fillText('★', Math.cos(a) * 10 - 4, -40 * sz + Math.sin(a) * 3); } }
    if (G.hasTag(e, 'burn') && Math.random() < 0.3) G.parts.push({ x: e.x + (Math.random() - 0.5) * 0.6, y: e.y - 0.6 - Math.random() * 0.5, vx: 0, vy: -1.4, life: 0.5, max: 0.5, col: '#ff7a2a', size: 3 });
    if (G.hasTag(e, 'poison') && Math.random() < 0.2) G.parts.push({ x: e.x + (Math.random() - 0.5) * 0.6, y: e.y - 0.5, vx: 0, vy: -0.8, life: 0.7, max: 0.7, col: '#7bd44a', size: 3 });
    if (G.hasTag(e, 'bleed') && Math.random() < 0.15) G.parts.push({ x: e.x + (Math.random() - 0.5) * 0.4, y: e.y - 0.8, vx: (Math.random() - 0.5), vy: 1, life: 0.5, max: 0.5, col: '#e8393c', size: 2.5, grav: 4 });
    if (G.hasTag(e, 'wet') && Math.random() < 0.1) G.parts.push({ x: e.x + (Math.random() - 0.5) * 0.6, y: e.y - 1, vx: 0, vy: 1.5, life: 0.4, max: 0.4, col: '#3d8bff', size: 2 });
    if (G.hasTag(e, 'shock') && Math.random() < 0.2) G.anims.push({ k: 'bolt', x: e.x - 0.3, y: e.y - 1.2, tx: e.x + 0.3, ty: e.y - 0.3, col: '#fff35a', t0: G.t, d: 0.1 });
    g.restore();
  }
  function drawOverhead(g, e, x, y, z) {
    if (e.k === 'z') return;
    if (e.k === 'i') {
      const near = Math.hypot(e.x - G.self.x, e.y - G.self.y) < 7;
      if (!(near || e.rar >= 2 || G.keys.alt)) return;
      g.textAlign = 'center'; g.font = `${e.rar >= 3 ? 700 : 500} 11px Kanit, sans-serif`;
      const col = e.rar >= 0 ? D.RARITY[e.rar].color : e.it.id === 'zeny' ? '#ffd34a' : '#e8e8f0';
      const w = g.measureText(e.n).width + 10;
      g.globalAlpha = e.mine ? 1 : 0.6; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w / 2, y - 44 * z, w, 15);
      g.fillStyle = col; g.fillText(e.n, x, y - 33 * z); g.globalAlpha = 1;
      return;
    }
    const dead = e.fl & 1;
    if ((e.fl & 4) && G.isEnemy(e)) return;
    const sz = e.sz || 1;
    let top = y - (e.k === 'p' ? 52 * (e.fl & 64 ? 1.7 : 1) : e.k === 'c' ? 80 : e.k === 'n' ? 44 : (36 * sz + 6)) * z;
    if (G.hasTag(e, 'airborne')) top -= 18 * z;
    g.textAlign = 'center';
    if (e.k === 'n') {
      const roleIcon = { shop: '🛒', refine: '⚒', rune: '💎', teleport: '🌀', dungeon: '🗼', guild: '🏰', arena: '⚔', healer: '✚', stairs: '⬇', portal: '🌀' }[e.role] || '!';
      g.font = `700 ${12}px Kanit, sans-serif`;
      label(g, e.n, x, top, '#ffe9a8');
      if (e.th) { g.font = '11px Kanit, sans-serif'; label(g, e.th, x, top + 13, '#cfe'); }
      g.font = '16px sans-serif'; g.fillText(roleIcon, x, top - 16 + Math.sin(G.t * 3) * 2);
      return;
    }
    if (dead) return;
    const isSelf = e.id === G.me;
    const enemy = G.isEnemy(e);
    // name
    let name = e.n;
    if (e.k === 'm' && e.lv) name = `Lv${e.lv} ${e.n}`;
    let col = e.k === 'm' ? (e.rk >= 2 ? '#ff9a3a' : e.rk === 1 ? '#ffd34a' : '#f0f0f0') : e.k === 'p' ? (e.ka ? '#ff3030' : isSelf ? '#9fe8ff' : e.pt ? '#7dff9a' : enemy ? '#ff7a7a' : '#ffffff') : '#cfc';
    if (e.k === 'p' && e.mt) top -= 14 * z;
    if (e.k === 's') name = e.n;
    g.font = `${e.k === 'm' && e.rk >= 2 ? 800 : 600} ${e.rk >= 2 ? 13 : 11}px Kanit, sans-serif`;
    if (e.title) { label(g, `「${e.title}」`, x, top - 26, '#ffcc66'); }
    if (e.gm) label(g, '[GM]', x, top - 14, '#ff5ad0');
    if (e.k === 'p' && e.g) label(g, `<${e.g}>`, x, top - (e.gm ? 26 : 14), '#ffd34a');
    if (e.k === 'm' || !isSelf || G.target === e.id) label(g, name, x, top, col);
    // hp bar
    const showHp = e.k !== 'p' || !isSelf || true;
    if (showHp && (e.hp < 100 || G.target === e.id || e.k === 'p' || e.rk >= 1 || e.k === 'c')) {
      const w = (e.rk >= 2 ? 56 : 36) * Math.min(1.2, z), h = e.rk >= 2 ? 5 : 4;
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x - w / 2 - 1, top + 4, w + 2, h + 2);
      g.fillStyle = e.k === 'p' ? (enemy ? '#ff4a4a' : isSelf ? '#4ae07a' : e.pt ? '#4ae07a' : '#4aa8ff') : e.k === 's' ? '#a08aff' : '#e84040';
      g.fillRect(x - w / 2, top + 5, w * e.hp / 100, h);
    }
    // tags
    const tags = G.tagList(e);
    if (tags.length) {
      g.font = '11px sans-serif';
      let tx = x - (tags.length - 1) * 7;
      for (const tgn of tags) { const d = D.TAGS[tgn]; g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(tx, top + 17, 6.5, 0, 7); g.fill(); g.fillStyle = d.color; g.fillText(d.icon, tx, top + 21); tx += 14; }
    }
    // cast bar
    if (e.castUntil && e.castUntil > G.t && e.id !== G.me) {
      const p = 1 - (e.castUntil - G.t) / e.castDur;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 20, top + 26, 40, 4); g.fillStyle = '#9cf'; g.fillRect(x - 20, top + 26, 40 * p, 4);
    }
    if (e.emote && e.emoteT > G.t) { const k = 1 - (e.emoteT - G.t) / 3; g.font = `${28 + (k < 0.1 ? (0.1 - k) * 120 : 0)}px sans-serif`; g.fillText(e.emote, x, top - 30 - k * 10); }
    if (e.bubble && e.bubbleT > G.t) {
      g.font = '12px Kanit, sans-serif'; const w = Math.min(220, g.measureText(e.bubble).width + 16);
      g.fillStyle = 'rgba(255,255,255,0.92)'; ART.roundRect(g, x - w / 2, top - 46, w, 22, 8); g.fill();
      g.fillStyle = '#222'; g.fillText(e.bubble.slice(0, 40), x, top - 31);
    }
  }
  function label(g, s, x, y, col) { g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); }

  function drawAnims(g) {
    const t = G.t;
    G.anims = G.anims.filter((a) => t - a.t0 < a.d);
    for (const a of G.anims) {
      const p = (t - a.t0) / a.d; if (p < 0) continue;
      g.globalAlpha = 1 - p;
      switch (a.k) {
        case 'ring': g.strokeStyle = a.col; g.lineWidth = 0.18 * (1 - p) + 0.03; g.beginPath(); g.arc(a.x, a.y, a.r * (0.3 + p * 0.8), 0, 7); g.stroke(); g.globalAlpha = (1 - p) * 0.25; g.fillStyle = a.col; g.beginPath(); g.arc(a.x, a.y, a.r * (0.3 + p * 0.8), 0, 7); g.fill(); break;
        case 'beam': { g.strokeStyle = a.col; g.lineWidth = 0.5 * (1 - p); g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y - 0.5); g.lineTo(a.tx, a.ty - 0.5); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 0.15 * (1 - p); g.stroke(); break; }
        case 'cone': g.fillStyle = a.col; g.globalAlpha = (1 - p) * 0.45; g.beginPath(); g.moveTo(a.x, a.y); g.arc(a.x, a.y, a.r * (0.4 + p * 0.6), a.a - 0.95, a.a + 0.95); g.closePath(); g.fill(); break;
        case 'bolt': { g.strokeStyle = a.col; g.lineWidth = 0.08; g.beginPath(); g.moveTo(a.x, a.y); const n = 6; for (let i = 1; i <= n; i++) { const k = i / n; g.lineTo(a.x + (a.tx - a.x) * k + (i < n ? (Math.random() - 0.5) * 0.5 : 0), a.y + (a.ty - a.y) * k + (i < n ? (Math.random() - 0.5) * 0.5 : 0)); } g.stroke(); break; }
        case 'proj': { const x = a.x + (a.tx - a.x) * p, y = a.y + (a.ty - a.y) * p; g.globalAlpha = 1; g.fillStyle = a.col; g.beginPath(); g.arc(x, y, a.big ? 0.22 : 0.14, 0, 7); g.fill(); g.strokeStyle = a.col; g.lineWidth = 0.08; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (a.tx - a.x) * 0.15, y - (a.ty - a.y) * 0.15); g.stroke(); break; }
        case 'slash': { g.strokeStyle = a.col; g.lineWidth = 0.14 * (1 - p) + 0.02; g.beginPath(); g.arc(a.x, a.y, 0.6 + p * 0.4, a.a, a.a + 2.2 * Math.min(1, p * 3)); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 0.05; g.stroke(); break; }
        case 'swipe': g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.08; g.beginPath(); g.arc(a.x, a.y, 0.45, a.a - 1, a.a - 1 + 2 * p); g.stroke(); break;
        case 'trail': { g.strokeStyle = 'rgba(200,230,255,0.7)'; g.lineWidth = 0.45 * (1 - p); g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y - 0.5); g.lineTo(a.tx, a.ty - 0.5); g.stroke(); break; }
        case 'pillar': { const gr = g.createLinearGradient(a.x, a.y, a.x, a.y - 4); gr.addColorStop(0, a.col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.globalAlpha = (1 - p) * 0.6; g.fillRect(a.x - (a.big ? 0.8 : 0.5), a.y - 4, a.big ? 1.6 : 1, 4); break; }
        case 'click': g.strokeStyle = '#fff'; g.lineWidth = 0.05; g.beginPath(); g.arc(a.x, a.y, 0.4 * (1 - p) + 0.1, 0, 7); g.stroke(); break;
        case 'circle': g.globalAlpha = 0.6; g.strokeStyle = a.col; g.lineWidth = 0.06; g.beginPath(); g.arc(a.x, a.y, 0.9, -Math.PI / 2, -Math.PI / 2 + p * 6.283); g.stroke(); break;
        case 'sig': drawSig(g, a, p); break;
        case 'mark': { const e = G.ents.get(a.id); if (!e) break; g.globalAlpha = 0.9; g.strokeStyle = '#ff4060'; g.lineWidth = 0.06; g.beginPath(); g.arc(e.x, e.y - 0.7, 0.6, 0, 7); g.stroke(); g.font = '0.5px Kanit'; g.fillStyle = '#ff4060'; g.textAlign = 'center'; g.fillText(Math.ceil(a.d - (t - a.t0)), e.x, e.y - 1.6); break; }
      }
    }
    g.globalAlpha = 1;
  }

  // ---- signature cast visuals: every skill has its own pattern / motion / palette
  function drawSig(g, a, p) {
    const fx = a.fx, c = fx.c, n = fx.n, S = fx.s * (a.big ? 2 : 1);
    const dir = fx.m === 'cw' ? 1 : fx.m === 'ccw' ? -1 : 0;
    const rot = dir * p * 5 + a.seed;
    const pul = fx.m === 'pulse' ? 1 + 0.25 * Math.sin(p * 22) : 1;
    const R = S * (0.5 + p * 1.6) * pul;
    const col = (i) => c[i % 3];
    g.save(); g.translate(a.x, a.y - 0.5); g.globalAlpha = Math.max(0, 1 - p); g.lineCap = 'round';
    g.strokeStyle = c[0]; g.fillStyle = c[0]; g.lineWidth = 0.08;
    const ring = (r, w, cc) => { g.strokeStyle = cc; g.lineWidth = w; g.beginPath(); g.arc(0, 0, Math.max(0.01, r), 0, 7); g.stroke(); };
    switch (fx.p) {
      case 'nova': ring(R, 0.16 * (1 - p) + 0.03, c[0]); ring(R * 0.65, 0.07, c[1]); break;
      case 'spiral': for (let i = 0; i < n; i++) { const an = i / n * Math.PI * 3 + rot, r = R * i / n; g.fillStyle = col(i); g.beginPath(); g.arc(Math.cos(an) * r, Math.sin(an) * r, 0.07 + 0.05 * S, 0, 7); g.fill(); } break;
      case 'starburst': for (let i = 0; i < n; i++) { const an = i / n * 6.283 + rot; g.strokeStyle = col(i); g.lineWidth = 0.07; g.beginPath(); g.moveTo(Math.cos(an) * R * 0.2, Math.sin(an) * R * 0.2); g.lineTo(Math.cos(an) * R, Math.sin(an) * R); g.stroke(); } break;
      case 'rain': for (let i = 0; i < n; i++) { const x = Math.cos(i * 2.39 + a.seed) * S * 1.6 * ((i % 4) / 4 + 0.3), y0 = -3 + ((p * 4 + i * 0.37) % 3); g.strokeStyle = col(i); g.lineWidth = 0.06; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 0.15, y0 + 0.6); g.stroke(); } break;
      case 'pillar': { const gr = g.createLinearGradient(0, 0, 0, -4 * S); gr.addColorStop(0, c[0]); gr.addColorStop(0.6, c[1]); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; const w = 0.5 * S * pul; g.fillRect(-w / 2, -4 * S * Math.min(1, p * 3), w, 4 * S * Math.min(1, p * 3)); ring(w, 0.05, c[2]); break; }
      case 'crescent': for (let i = 0; i < 3; i++) { g.strokeStyle = col(i); g.lineWidth = 0.22 - i * 0.06; g.beginPath(); g.arc(0, 0, R * (1 - i * 0.15), rot + i * 0.3, rot + i * 0.3 + Math.PI * 0.85); g.stroke(); } break;
      case 'cross': g.rotate(rot); for (let k = 0; k < 2; k++) { g.strokeStyle = col(k); g.lineWidth = 0.14; g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.stroke(); g.rotate(Math.PI / 2); } break;
      case 'vortex': for (let i = 0; i < Math.min(n, 10); i++) { const r = R * (1 - p) * (1 - i / 12) + 0.1; g.strokeStyle = col(i); g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, r, rot + i, rot + i + 2.2); g.stroke(); } break;
      case 'fan': g.rotate(rot * 0.3); for (let i = 0; i < n; i++) { const an = -1 + 2 * i / Math.max(1, n - 1); g.strokeStyle = col(i); g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * R, Math.sin(an) * R); g.stroke(); } break;
      case 'beam': g.rotate(rot * 0.5); for (const s2 of [-1, 1]) { g.strokeStyle = col(s2 + 1); g.lineWidth = 0.18 * (1 - p) + 0.03; g.beginPath(); g.moveTo(-R * 1.4, s2 * 0.25 * S); g.lineTo(R * 1.4, s2 * 0.25 * S); g.stroke(); } break;
      case 'orbit': for (let i = 0; i < Math.min(n, 9); i++) { const an = i / Math.min(n, 9) * 6.283 + rot; g.fillStyle = col(i); g.beginPath(); g.arc(Math.cos(an) * R * 0.75, Math.sin(an) * R * 0.75, 0.12 * S, 0, 7); g.fill(); } break;
      case 'shock': g.rotate(rot * 0.4); for (let i = 0; i < 2; i++) { g.strokeStyle = col(i); g.lineWidth = 0.07; const r = R * (1 - i * 0.35); g.strokeRect(-r, -r, r * 2, r * 2); } break;
      case 'petals': for (let i = 0; i < Math.min(n, 10); i++) { const an = i / Math.min(n, 10) * 6.283 + rot; g.save(); g.rotate(an); g.fillStyle = col(i); g.beginPath(); g.ellipse(R * 0.6, 0, 0.35 * S, 0.12 * S, 0, 0, 7); g.fill(); g.restore(); } break;
      case 'runes': ring(R, 0.05, c[0]); ring(R * 0.8, 0.03, c[1]); for (let i = 0; i < Math.min(n, 12); i++) { const an = i / Math.min(n, 12) * 6.283 + rot; g.save(); g.translate(Math.cos(an) * R * 0.9, Math.sin(an) * R * 0.9); g.rotate(an); g.strokeStyle = col(i); g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.08, -0.1); g.lineTo(0, 0.1); g.lineTo(0.08, -0.1); g.stroke(); g.restore(); } break;
      case 'web': for (let i = 0; i < Math.min(n, 10); i++) { const a1 = i * 2.4 + a.seed, a2 = i * 1.3 + 2 + a.seed; g.strokeStyle = col(i); g.lineWidth = 0.04; g.beginPath(); g.moveTo(Math.cos(a1) * R, Math.sin(a1) * R); g.lineTo((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4); g.lineTo(Math.cos(a2) * R, Math.sin(a2) * R); g.stroke(); } break;
      case 'comet': { const k = Math.min(1, p * 2.2); const x = -3 * (1 - k) * S, y = -3 * (1 - k) * S; g.strokeStyle = c[1]; g.lineWidth = 0.25 * S; g.beginPath(); g.moveTo(x - 1.2 * S, y - 1.2 * S); g.lineTo(x, y); g.stroke(); g.fillStyle = c[0]; g.beginPath(); g.arc(x, y, 0.25 * S, 0, 7); g.fill(); if (k >= 1) ring(R, 0.08, c[2]); break; }
      case 'geyser': for (let i = 0; i < n; i++) { const x = ((i * 0.618 + a.seed) % 1 - 0.5) * 0.8 * S, h = (p * 4 + i * 0.21) % 1 * 3 * S; g.fillStyle = col(i); g.beginPath(); g.arc(x, -h, 0.07 * S, 0, 7); g.fill(); } break;
      case 'ripple': for (let i = 0; i < 3; i++) { const q = (p + i / 3) % 1; ring(S * 2 * q, 0.06 * (1 - q), col(i)); } break;
      case 'wings': for (const s2 of [-1, 1]) { g.fillStyle = col(s2 + 1); g.beginPath(); g.moveTo(0, -0.2); g.quadraticCurveTo(s2 * R * 1.2, -R * 1.2, s2 * R * 1.4, -0.1); g.quadraticCurveTo(s2 * R * 0.8, -0.2, 0, 0.1); g.fill(); } break;
      case 'chains': for (let i = 0; i < Math.min(n, 14); i++) { const an = i / Math.min(n, 14) * 6.283 + rot; g.save(); g.translate(Math.cos(an) * R, Math.sin(an) * R); g.rotate(an + Math.PI / 2 * (i % 2)); g.strokeStyle = col(i); g.lineWidth = 0.04; g.beginPath(); g.ellipse(0, 0, 0.14 * S, 0.07 * S, 0, 0, 7); g.stroke(); g.restore(); } break;
      case 'hex': g.rotate(rot * 0.5); for (let k = 0; k < 2; k++) { g.strokeStyle = col(k); g.lineWidth = 0.07; g.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * 6.283, r = R * (1 - k * 0.4); i ? g.lineTo(Math.cos(an) * r, Math.sin(an) * r) : g.moveTo(Math.cos(an) * r, Math.sin(an) * r); } g.stroke(); } break;
      case 'meteor': for (let i = 0; i < Math.min(n, 8); i++) { const k = Math.min(1, p * 2 + i * 0.07); const sx = Math.cos(i * 2.1 + a.seed) * S * 1.5, sy = Math.sin(i * 2.1 + a.seed) * S * 0.8; const x = sx + 2 * (1 - k), y = sy - 3 * (1 - k); g.fillStyle = col(i); g.beginPath(); g.arc(x, y, 0.1 * S, 0, 7); g.fill(); g.strokeStyle = col(i + 1); g.lineWidth = 0.04; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.5, y - 0.7); g.stroke(); } break;
      case 'blades': for (let i = 0; i < Math.min(n, 10); i++) { const an = i / Math.min(n, 10) * 6.283 + rot; g.save(); g.rotate(an); g.translate(R * 0.8, 0); g.fillStyle = col(i); g.beginPath(); g.moveTo(0.35 * S, 0); g.lineTo(-0.1, -0.06 * S); g.lineTo(-0.1, 0.06 * S); g.closePath(); g.fill(); g.restore(); } break;
      case 'sparkle': for (let i = 0; i < n; i++) { const x = Math.cos(i * 2.4 + a.seed) * S * 1.5 * ((i * 0.37) % 1), y = Math.sin(i * 2.4 + a.seed) * S * 1.2 * ((i * 0.53) % 1); const tw = Math.abs(Math.sin(p * 18 + i)); g.fillStyle = col(i); g.save(); g.translate(x, y); g.rotate(rot); g.fillRect(-0.15 * tw * S, -0.025, 0.3 * tw * S, 0.05); g.fillRect(-0.025, -0.15 * tw * S, 0.05, 0.3 * tw * S); g.restore(); } break;
    }
    g.restore();
  }
  const weatherParts = [];
  function drawWeather(g, W, H, dt) {
    const w = G.weather; if (!w) { weatherParts.length = 0; return; }
    const target = w === 'rain' ? 220 : 120;
    while (weatherParts.length < target) weatherParts.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() });
    g.save();
    for (const p of weatherParts) {
      if (w === 'rain') { p.x -= 120 * dt * p.s; p.y += 700 * dt * p.s; g.strokeStyle = 'rgba(170,200,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 3, p.y - 12 * p.s); g.stroke(); }
      else if (w === 'snow') { p.x += Math.sin(G.t + p.s * 10) * 20 * dt; p.y += 50 * dt * p.s; g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(p.x, p.y, 1.5 * p.s + 0.5, 0, 7); g.fill(); }
      else if (w === 'ash') { p.x += 15 * dt; p.y -= 30 * dt * p.s; g.fillStyle = `rgba(255,${120 + p.s * 60 | 0},60,0.6)`; g.fillRect(p.x, p.y, 2, 2); }
      else if (w === 'petals') { p.x += 40 * dt * p.s; p.y += 35 * dt * p.s; g.fillStyle = 'rgba(255,170,200,0.8)'; g.beginPath(); g.ellipse(p.x, p.y, 3, 1.6, G.t + p.s * 5, 0, 7); g.fill(); }
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; } if (p.y < -12) { p.y = H + 8; p.x = Math.random() * W; } if (p.x < -10) p.x = W + 5; if (p.x > W + 10) p.x = -5;
    }
    g.restore();
  }

  // ------------------------------------------------------------ main loop
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    G.t += dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { G.fps = fpsN; fpsAcc = 0; fpsN = 0; }
    if (G.map) {
      updateSelf(dt);
      for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; p.life -= dt; }
      G.parts = G.parts.filter((p) => p.life > 0);
      if (G.parts.length > 1500) G.parts.splice(0, G.parts.length - 1500);
      G.texts = G.texts.filter((x) => G.t - x.t0 < x.d);
      const [wx, wy] = G.toWorld(G.mouse.x, G.mouse.y); G.mouse.wx = wx; G.mouse.wy = wy;
      render(dt);
      UI.frame(dt);
    }
    requestAnimationFrame(frame);
  }
  G.start = function () {
    G.cv = document.getElementById('game');
    G.ctx = G.cv.getContext('2d');
    resize(); setupInput();
    requestAnimationFrame(frame);
    setInterval(() => G.send({ t: 'ping', c: performance.now() }), 5000);
  };
})();

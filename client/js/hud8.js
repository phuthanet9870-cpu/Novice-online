// HUD v8 — every piece of the in-game HUD drawn with the CinderUI images: player unit frame, target frame, boss bar,
// compass plate, EXP bar, buff frames, quest tracker, loot toasts, cursors and the damage vignette.
(function () {
  const $ = (s) => document.querySelector(s);
  const A = new URL('client/assets/ui/cinder/', location.href).href;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => (window.UI && UI.fmt ? UI.fmt(n) : String(n));
  const D = NO_DATA;
  // layered bar: back / fill (clipped) / frame, optional ghost trail and caption
  const bar = (cls, fill, ghost) => `<div class="cb ${cls}"><i class="cb-back"></i>${ghost ? '<i class="cb-ghost"></i>' : ''}<i class="cb-fill" style="--img:url(${A}${fill}.png)"></i><i class="cb-frame"></i><span></span></div>`;
  function setCb(el, frac, txt) { if (!el) return; frac = Math.max(0, Math.min(1, frac)); el.style.setProperty('--p', (frac * 100).toFixed(2) + '%'); const s = el.querySelector('span'); if (s && s.textContent !== txt) s.textContent = txt; }
  function build() {
    const hud = $('#hud'); if (!hud || !$('#pframe') || $('#uf8')) return !!$('#uf8');
    hud.classList.add('c8');
    // ---- player unit frame
    const uf = document.createElement('div'); uf.id = 'uf8';
    uf.innerHTML = `<img class="uf-por" alt=""><div class="uf-name"><b></b><small></small></div>
      <div class="uf-hp"><i class="f"></i><span></span></div><div class="uf-sp"><i class="f"></i><span></span></div><div class="uf-res"><i class="f"></i><span></span></div>
      <div class="uf-lv"><b></b></div>`;
    hud.appendChild(uf);
    // ---- buffs under the frame use the buff frame image (existing #buffs keeps its data)
    // ---- target frame + boss bar
    const tf = document.createElement('div'); tf.id = 'tf8'; tf.hidden = true;
    tf.innerHTML = `<div class="tf-hp"><i class="f"></i><span></span></div><div class="tf-sub"></div><canvas class="tf-por" width="72" height="72"></canvas><div class="tf-name"></div>`;
    hud.appendChild(tf);
    const bb = document.createElement('div'); bb.id = 'boss8'; bb.hidden = true;
    bb.innerHTML = `<div class="bb-name"></div><div class="bb-bar"><i class="bb-back"></i><i class="bb-ghost"></i><i class="bb-fill"></i><i class="bb-frame"></i><span></span></div><div class="bb-sub"></div>`;
    hud.appendChild(bb);
    // ---- compass plate with the map name
    const cp = document.createElement('div'); cp.id = 'compass8'; cp.innerHTML = '<i class="ticks"></i><b></b><small></small>'; hud.appendChild(cp);
    // ---- big EXP bar under the skill bar
    const hb = $('#bottom'); if (hb && !$('#exp8')) { const x = document.createElement('div'); x.id = 'exp8'; x.innerHTML = bar('l', 'bar_l_fill_xp'); hb.appendChild(x); }
    // ---- damage vignette
    const vg = document.createElement('div'); vg.id = 'vign8'; document.body.appendChild(vg);
    return true;
  }
  let lastHp = -1, ghostP = 1, ghostAt = 0, lastTarget = 0;
  function update() {
    if (!build()) return;
    const me = G.sme, ch = G.char; if (!me || !ch) return;
    const C0 = D.CLASSES[ch.cls] || {};
    const uf = $('#uf8');
    const por = uf.querySelector('.uf-por'); const pk = ch.cls + ch.name; if (por.dataset.k !== pk) { por.dataset.k = pk; por.src = ART.portrait(ch.cls, ch.name, 120); }
    uf.querySelector('.uf-name b').textContent = ch.name; uf.querySelector('.uf-name small').textContent = `${C0.name || ''} · ${C0.th || ''}`;
    uf.querySelector('.uf-lv b').textContent = me.lv;
    const set = (sel, v, mx, txt) => { const el = uf.querySelector(sel); el.style.setProperty('--p', Math.max(0, Math.min(100, v / Math.max(1, mx) * 100)) + '%'); el.querySelector('span').textContent = txt; };
    set('.uf-hp', me.hp, me.mhp, `${fmt(Math.round(me.hp))} / ${fmt(me.mhp)}`);
    set('.uf-sp', me.sp, me.msp, `${fmt(Math.round(me.sp))} / ${fmt(me.msp)}`);
    set('.uf-res', me.res, me.rmax || 1, `${(C0.res && C0.res.name) || ''} ${Math.floor(me.res)}/${me.rmax}`);
    if (lastHp >= 0 && me.hp < lastHp - me.mhp * 0.04) { const v = $('#vign8'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); }
    lastHp = me.hp;
    $('#vign8').classList.toggle('low', me.hp / me.mhp < 0.3 && !me.dead);
    // compass: map name + level band
    const cp = $('#compass8'); const mn = $('#mapName') ? $('#mapName').textContent : ''; const ms = $('#mapSub') ? $('#mapSub').textContent : '';
    if (cp.dataset.k !== mn + ms) { cp.dataset.k = mn + ms; cp.querySelector('b').textContent = mn; cp.querySelector('small').textContent = ms; }
    cp.querySelector('.ticks').style.backgroundPositionX = (-(G.self ? G.self.x : 0) * 12) + 'px';
    // EXP
    const next = NO_F.expToNext(me.lv); setCb($('#exp8 .cb'), ch.lv >= 250 ? 1 : me.exp / next, ch.lv >= 250 ? 'MAX LEVEL' : `EXP ${(me.exp / next * 100).toFixed(2)}%`);
    // target / boss
    const e = G.ents.get(G.target), tf = $('#tf8'), bb = $('#boss8');
    const boss = e && e.k === 'm' && e.rk >= 2;
    if (!e || e.id === G.me || e.k === 'z' || e.k === 'n' || e.k === 'i') { tf.hidden = true; bb.hidden = true; } // gates, stairs, chests and NPCs have no HP bar
    else if (boss) {
      tf.hidden = true; bb.hidden = false;
      if (lastTarget !== e.id) { lastTarget = e.id; ghostP = e.hp / 100; }
      const p = e.hp / 100; if (p < ghostP) { if (G.t - ghostAt > 0.6) ghostP = Math.max(p, ghostP - 0.004); } else ghostP = p; if (Math.abs(p - ghostP) > 0.001 && ghostAt === 0) ghostAt = G.t; if (p >= ghostP) ghostAt = 0;
      bb.style.setProperty('--p', (p * 100).toFixed(2) + '%'); bb.style.setProperty('--g', (ghostP * 100).toFixed(2) + '%');
      bb.querySelector('.bb-name').textContent = e.n; bb.querySelector('span').textContent = e.hp + '%';
      bb.querySelector('.bb-sub').textContent = `${e.rk === 4 ? 'WORLD BOSS' : e.rk === 3 ? 'DUNGEON BOSS' : 'FIELD BOSS'} · Lv ${e.lv} · ${(D.ELEMENTS[e.el] || {}).n || ''}${e.ws ? ' · ' + e.ws : ''}`;
    } else {
      bb.hidden = true; tf.hidden = false;
      tf.style.setProperty('--p', e.hp + '%');
      tf.querySelector('.tf-name').textContent = e.n || '';
      tf.querySelector('.tf-hp span').textContent = e.k === 'n' ? '' : e.hp + '%';
      tf.querySelector('.tf-sub').textContent = e.k === 'm' ? `Lv ${e.lv}${e.rk === 1 ? ' · ELITE' : ''} · ${(D.ELEMENTS[e.el] || {}).n || ''}` : e.k === 'p' ? `Lv ${e.lv} · ${(D.CLASSES[e.c] || {}).name || ''}` : e.k === 'n' ? (e.th || '') : '';
      const cv = tf.querySelector('.tf-por');
      if (cv.dataset.k !== String(e.id)) { cv.dataset.k = String(e.id); const g = cv.getContext('2d'); g.clearRect(0, 0, 72, 72); try { if (e.k === 'm' || e.k === 's') { g.save(); g.translate(36, 52); g.scale(0.9, 0.9); ART.drawMonster(g, Object.assign({}, e, { x: 0, y: 0, preview: 1 }), 0, 0, 0); g.restore(); } else if (e.k === 'p') { const im = new Image(); im.onload = () => g.drawImage(im, 4, 4, 64, 64); im.src = ART.classIcon(e.c, 64); } } catch (err) {} }
    }
  }
  // buffs: every buff sits in the CinderUI buff/debuff frame with its initials
  const _buffs = UI.buffs; UI.buffs = function () { _buffs.apply(this, arguments); for (const b of document.querySelectorAll('#buffs .buff')) b.classList.add('c8'); };
  // loot: CinderUI toast with the item icon, like "ITEM ACQUIRED"
  UI.loot = function (m) {
    if (window.SFX) { if (m.items.some((x) => /Legendary|Mythic|Epic/.test(x))) SFX.rare(); else SFX.loot(); }
    for (const it of m.items) {
      const el = document.createElement('div'); el.className = 'lootItem c8';
      const rare = /Mythic/.test(it) ? '#ff3a4a' : /Legendary/.test(it) ? '#ff9a2a' : /Epic/.test(it) ? '#c06cff' : /Rare/.test(it) ? '#4aa8ff' : '#f0e2c0';
      el.innerHTML = `<i class="gem" style="--c:${rare}"></i><div><small>ITEM ACQUIRED</small><b style="color:${rare}">${esc(it)}</b></div>`;
      $('#lootFeed').appendChild(el); setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
    }
    while ($('#lootFeed').children.length > 5) $('#lootFeed').firstChild.remove();
  };
  // cursors by what is under the mouse
  let curK = '';
  function cursor() {
    const cv = $('#game'); if (!cv || !G.ents || !G.mouse) return;
    let k = 'pointer'; const wx = G.mouse.wx, wy = G.mouse.wy;
    if (wx !== undefined) for (const e of G.ents.values()) { if (e.id === G.me || e.k === 'z') continue; if (Math.abs(e.x - wx) < 0.7 * (e.sz || 1) && wy < e.y + 0.4 && wy > e.y - 1.8 * (e.sz || 1)) { k = e.k === 'i' ? 'loot' : e.k === 'n' ? 'talk' : e.k === 'm' || (e.k === 'p' && G.isEnemy && G.isEnemy(e)) ? 'attack' : 'interact'; break; } }
    if (k !== curK) { curK = k; cv.style.cursor = `url(${A}cursor_${k}.png) 4 2, auto`; }
  }
  setInterval(() => { try { update(); cursor(); } catch (err) { if (!window._hud8err) { window._hud8err = 1; console.warn('hud8', err); } } }, 100);
  document.body.style.cursor = `url(${A}cursor_pointer.png) 4 2, auto`;
})();

// Extra windows: quests, achievements, pets/mounts, mail, auction, storage, trade, crafting, friends, settings, emotes, ranked, guild progression.
(function () {
  const D = NO_DATA, F = NO_F;
  const WIN = UI.WIN, esc = UI.esc, fmt = UI.fmt;
  const $ = (s) => document.querySelector(s);
  const render = (n) => UI.renderWin(n);
  const cnt = (id) => G.char.inv.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0);
  const icon = (id, extra = '') => `<img class="ic" src="${ART.itemIcon({ id })}" data-itemid="${id}" ${extra}>`;
  const iname = (it) => it.type === 'equip' ? `<span style="color:${D.RARITY[it.rarity].color}">${it.refine ? '+' + it.refine + ' ' : ''}${esc(it.name)}</span>` : esc((D.ITEMS[it.id] || {}).n || it.id);
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' นาที' : m < 1440 ? Math.round(m / 60) + ' ชม.' : Math.round(m / 1440) + ' วัน'; };

  // ---------------------------------------------------------------- settings
  G.settings = Object.assign({ sfx: 0.6, music: 0.25, shake: true, particles: 1, dmg: true, names: true, fxq: 'high', maxPlayers: 0, othersFx: true }, (() => { try { return JSON.parse(localStorage.getItem('no_settings') || '{}'); } catch (e) { return {}; } })());
  // graphics quality presets — each one changes real rendering work:
  //   low  : render scale 1×, no bloom pass, 25 live effects, 1/3 particles, no screen shake
  //   med  : render scale up to 1.5×, no bloom pass, 55 live effects, 60% particles
  //   high : render scale up to 3× (sharpest), bloom glow, 120 live effects, full particles
  G.FXQ = { low: { dpr: 1, bloom: 0, glow: 0, cap: 25, part: 0.34, shake: 0 }, med: { dpr: 1.5, bloom: 1, glow: 0.45, cap: 55, part: 0.6, shake: 1 }, high: { dpr: 3, bloom: 1, glow: 0.7, cap: 120, part: 1, shake: 1 } };
  G.fx = () => G.FXQ[G.settings.fxq] || G.FXQ.high;
  G.applyGfx = () => { G.settings.particles = G.settings.fxq === 'low' ? 0 : 1; if (G.resize) G.resize(); };
  setTimeout(() => G.applyGfx && G.applyGfx(), 0);
  function saveSettings() { try { localStorage.setItem('no_settings', JSON.stringify(G.settings)); } catch (e) {} if (window.SFX) { SFX.setVol(G.settings.sfx); SFX.setMusic(G.settings.music); } }
  WIN.settings = {
    title: '⚙ ตั้งค่า', w: 420,
    render() {
      const s = G.settings;
      return `<div class="setList">
        <label>เสียงเอฟเฟกต์ <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-s="sfx"><b>${Math.round(s.sfx * 100)}%</b></label>
        <label>เพลงพื้นหลัง <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-s="music"><b>${Math.round(s.music * 100)}%</b></label>
        <label class="ck"><input type="checkbox" data-s="shake" ${s.shake ? 'checked' : ''}> สั่นหน้าจอ</label>
        <h4>กราฟิก & เอฟเฟกต์</h4>
        <div class="segRow"><span>คุณภาพเอฟเฟกต์</span>${[['low', 'ต่ำ'], ['med', 'กลาง'], ['high', 'สูง']].map(([k, n]) => `<button class="seg ${s.fxq === k ? 'on' : ''}" data-act="fxq" data-k="${k}">${n}</button>`).join('')}</div>
        <small class="hint">${{ low: 'ต่ำ: ความละเอียด 1× · ไม่มีแสงเรือง · อนุภาค 1/3 · ไม่สั่นจอ — ลื่นที่สุด', med: 'กลาง: ความละเอียด 1.5× · แสงเรืองฟุ้ง + แสงพิกเซล · อนุภาค 60%', high: 'สูง: ความละเอียดเต็มจอ (สูงสุด 3×) · แสงเรืองฟุ้งเต็มที่ + แสงพิกเซล · อนุภาคเต็ม' }[s.fxq] || ''}</small>
        <div class="segRow"><span>แสดงผู้เล่นอื่น</span>${[[5, '5'], [10, '10'], [30, '30'], [0, 'ทั้งหมด']].map(([k, n]) => `<button class="seg ${(+s.maxPlayers || 0) === k ? 'on' : ''}" data-act="maxp" data-k="${k}">${n}</button>`).join('')}</div>
        <small class="hint">แสดงเฉพาะผู้เล่นที่ใกล้ที่สุดตามจำนวนที่เลือก (สมาชิกปาร์ตี้แสดงเสมอ) · ตอนนี้มีผู้เล่นอื่นในแผนที่ ${[...G.ents.values()].filter((e) => e.k === 'p' && e.id !== G.me).length} คน</small>
        <div class="segRow"><span>เอฟเฟกต์ผู้เล่นอื่น</span><button class="seg ${s.othersFx !== false ? 'on' : ''}" data-act="ofx" data-k="1">เปิด — เห็นทั้งหมด</button><button class="seg ${s.othersFx === false ? 'on' : ''}" data-act="ofx" data-k="0">ปิด — เห็นแค่ของตัวเอง</button></div>
        <label>ซูมกล้อง <input type="range" min="0.55" max="1.8" step="0.05" value="${G.zoom}" data-s="zoom"><b>${G.zoom.toFixed(2)}×</b></label>
        <p class="hint">ปุ่มลัดใหม่: <kbd>T</kbd> ขี่พาหนะ · <kbd>E</kbd> อีโมต · <kbd>L</kbd> ภารกิจ · <kbd>Y</kbd> ความสำเร็จ · <kbd>F</kbd> เพื่อน · <kbd>,</kbd> สัตว์เลี้ยง · <kbd>.</kbd> ตั้งค่า</p>
        <div class="setBtns"><button class="btn gold" data-act="lobby">⟲ กลับไปล็อบบี้</button><button class="btn danger" data-act="logout">ออกจากระบบ</button></div></div>`;
    },
    act(a, d) {
      if (a === 'logout') { try { sessionStorage.removeItem('no_sess'); } catch (er) {} location.reload(); }
      if (a === 'lobby') { for (const n of [...UI.open]) UI.close(n); G.send({ t: 'toLobby' }); return; }
      if (a === 'fxq') { G.settings.fxq = d.k; G.applyGfx(); }
      if (a === 'maxp') G.settings.maxPlayers = +d.k;
      if (a === 'ofx') { G.settings.othersFx = d.k === '1'; if (!G.settings.othersFx && window.VFX && VFX.clearOthers) VFX.clearOthers(G.me); }
      saveSettings(); UI.renderWin('settings');
    },
    change(t) { const k = t.dataset.s; if (!k) return; if (k === 'zoom') G.zoom = +t.value; else G.settings[k] = t.type === 'checkbox' ? (t.checked ? (k === 'particles' ? 1 : true) : (k === 'particles' ? 0 : false)) : +t.value; saveSettings(); render('settings'); },
    input(t) { if (t.type === 'range') t.nextElementSibling.textContent = t.dataset.s === 'zoom' ? (+t.value).toFixed(2) + '×' : Math.round(t.value * 100) + '%'; if (t.dataset.s === 'zoom') G.zoom = +t.value; else if (t.dataset.s) { G.settings[t.dataset.s] = +t.value; saveSettings(); } }
  };

  // ---------------------------------------------------------------- quests
  const rewardHtml = (r) => [r.expMul ? `<span class="chip">EXP ×${r.expMul}%</span>` : '', r.zeny ? `<span class="chip">💰 ${fmt(r.zeny)}</span>` : '', ...(r.items || []).map(([id, q]) => `<span class="chip">${icon(id, 'style="width:18px;height:18px;vertical-align:middle"')} ${esc(D.ITEMS[id].n)} ×${q}</span>`)].join('');
  WIN.quests = {
    title: '📜 ภารกิจ & รางวัลรายวัน', w: 680,
    render(o) {
      const q = G.char.quests || {}; const tab = o.tab || 'main';
      const mq = D.MAIN_QUESTS[q.main];
      let body = '';
      if (tab === 'main') {
        body = mq ? `<div class="qCard main"><div class="qHead"><b>บทที่ ${q.main + 1}/${D.MAIN_QUESTS.length}: ${esc(mq.n)}</b>${G.char.lv < mq.lv ? `<span class="badge red">ต้อง Lv${mq.lv}</span>` : ''}</div><p>${esc(mq.desc)}</p>
          <div class="prog"><i style="width:${Math.min(100, (mq.type === 'level' ? G.char.lv : mq.type === 'floor' ? ((G.char.dungeonBest || {})[mq.dg] || 0) : q.prog) / mq.v * 100)}%"></i><span>${mq.type === 'level' ? G.char.lv : mq.type === 'floor' ? ((G.char.dungeonBest || {})[mq.dg] || 0) : q.prog} / ${mq.v}</span></div>
          <div class="chips">${rewardHtml(mq.reward)}</div>${mq.map ? `<button class="btn tiny" data-act="go" data-m="${mq.map}">🗺 ไปแผนที่นี้</button>` : ''}<button class="btn gold" data-act="claim" data-kind="main">รับรางวัล</button></div>
          <h4>เส้นทางเนื้อเรื่อง</h4><div class="qChain scrollKeep">${D.MAIN_QUESTS.map((x, i) => `<div class="${i < q.main ? 'done' : i === q.main ? 'cur' : ''}"><span>${i < q.main ? '✔' : i + 1}</span>${esc(x.n)}<small>Lv${x.lv}</small></div>`).join('')}</div>`
          : '<p>🏆 ทำภารกิจหลักครบทั้งหมดแล้ว!</p>';
      } else if (tab === 'daily') {
        const list = (q.daily && q.daily.list) || [];
        body = `<p class="hint">รีเซ็ตทุกวัน · ทำครบ ${list.length} ภารกิจรับโบนัสเพิ่ม · ได้ Valor Token ไปแลกของที่ Alchemist</p>` + list.map((d) => { const def = D.DAILY_POOL.find((x) => x.id === d.id) || {}; return `<div class="qCard ${d.claimed ? 'claimed' : d.done ? 'ready' : ''}"><div class="qHead"><b>${esc(def.n)}</b><span>${d.claimed ? '✔ รับแล้ว' : d.done ? 'สำเร็จ!' : ''}</span></div><p>${esc(def.desc)}</p><div class="prog"><i style="width:${d.prog / def.v * 100}%"></i><span>${d.prog}/${def.v}</span></div>${d.done && !d.claimed ? `<button class="btn gold tiny" data-act="claim" data-kind="daily" data-id="${d.id}">รับรางวัล</button>` : ''}</div>`; }).join('');
      } else {
        const lg = G.char.login || {}; const today = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
        const day = lg.claimed === today ? (lg.streak - 1) % 7 : (lg.streak || 0) % 7;
        body = `<p class="hint">ล็อกอินต่อเนื่องเพื่อรับรางวัลที่ดีขึ้น — ต่อเนื่อง ${lg.streak || 0} วัน</p><div class="cal">${D.LOGIN_REWARDS.map((r, i) => `<div class="${i < day || (i === day && lg.claimed === today) ? 'got' : i === day ? 'now' : ''}"><b>วันที่ ${i + 1}</b>${(r.items || []).map(([id, q]) => `${icon(id)}<small>×${q}</small>`).join('')}<small>💰${fmt(r.zeny)}</small></div>`).join('')}</div>
          <button class="btn gold big" data-act="login" ${lg.claimed === today ? 'disabled' : ''}>${lg.claimed === today ? 'รับแล้ววันนี้' : '🎁 รับรางวัลวันนี้'}</button>`;
      }
      return `<div class="tabs">${[['main', 'ภารกิจหลัก'], ['daily', 'ภารกิจรายวัน'], ['login', 'ล็อกอินรายวัน']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>${body}`;
    },
    act(a, d) {
      const w = UI.wins.quests;
      if (a === 'tab') { w.opts.tab = d.k; render('quests'); }
      if (a === 'claim') G.send({ t: 'quest', kind: d.kind, id: d.id });
      if (a === 'login') G.send({ t: 'loginClaim' });
      if (a === 'go') G.send({ t: 'warp', map: d.m });
    }
  };
  UI.loginPopup = function () { setTimeout(() => { UI.show('quests', { tab: 'login' }); }, 1500); };

  // ---------------------------------------------------------------- achievements & titles
  WIN.achieve = {
    title: '🏅 ความสำเร็จ & ฉายา', w: 700,
    render() {
      const c = G.char, got = c.ach || [];
      const bonus = {};
      for (const a of D.ACHIEVEMENTS) if (got.includes(a.id) && a.bonus) for (const k in a.bonus) bonus[k] = (bonus[k] || 0) + a.bonus[k];
      return `<div class="achTop"><div><b>${got.length}/${D.ACHIEVEMENTS.length}</b> ความสำเร็จ</div><div>ฉายาปัจจุบัน: <select data-title>${['', ...(c.titles || [])].map((t) => `<option value="${esc(t)}" ${c.title === t ? 'selected' : ''}>${t ? esc(t) : '— ไม่แสดง —'}</option>`).join('')}</select></div></div>
        <div class="chips">โบนัสถาวรรวม: ${Object.entries(bonus).map(([k, v]) => `<span class="tag heal">${k} +${Math.round(v * 10) / 10}</span>`).join('') || '-'}</div>
        <div class="achGrid scrollKeep">${D.ACHIEVEMENTS.map((a) => `<div class="ach ${got.includes(a.id) ? 'got' : ''}"><span class="aic">${a.icon}</span><div><b>${esc(a.n)}</b><small>${esc(a.desc)}</small><small>ฉายา「${esc(a.title)}」${a.bonus ? ' · ' + Object.entries(a.bonus).map(([k, v]) => k + ' +' + v).join(', ') : ''}</small></div></div>`).join('')}</div>`;
    },
    change(t) { if (t.dataset.title !== undefined) G.send({ t: 'title', title: t.value }); }
  };

  // ---------------------------------------------------------------- pets & mounts
  WIN.pets = {
    title: '🐾 สัตว์เลี้ยง & พาหนะ', w: 680,
    render(o) {
      const c = G.char; const tab = o.tab || 'pets';
      let body = '';
      if (tab === 'pets') {
        body = (c.pets || []).length ? `<div class="petList">${c.pets.map((p) => { const d = D.PETS[p.id]; const on = c.pet && c.pet.id === p.id; return `<div class="pet ${on ? 'on' : ''}"><canvas data-petcv="${p.id}" width="80" height="70"></canvas><div><b>${esc(d.n)}</b><small>${esc(d.th)} · Lv ${p.lv}/${D.PET_MAX}</small><small>โบนัส: ${d.stat} +${Math.round(d.per * p.lv * 10) / 10}</small><div class="prog"><i style="width:${p.lv >= D.PET_MAX ? 100 : p.exp / D.petExpNext(p.lv) * 100}%"></i><span>${p.lv >= D.PET_MAX ? 'MAX' : p.exp + '/' + D.petExpNext(p.lv)}</span></div></div><button class="btn ${on ? '' : 'gold'} tiny" data-act="pet" data-id="${on ? '' : p.id}">${on ? 'เก็บ' : 'เรียก'}</button></div>`; }).join('')}</div><p class="hint">สัตว์เลี้ยงได้ EXP เมื่อคุณกำจัดมอน หรือให้ Pet Treat (ใช้จากกระเป๋า) · ติดตามคุณและให้โบนัสสเตตัส</p>` : '<p class="hint">ยังไม่มีสัตว์เลี้ยง — ซื้อไข่ที่ Tamer Rook ในเมือง แล้วใช้จากกระเป๋า</p>';
      } else if (tab === 'mounts') {
        body = `<div class="petList">${Object.entries(D.MOUNTS).map(([k, m]) => { const own = (c.mounts || []).includes(k); return `<div class="pet ${c.mount === k && own ? 'on' : ''} ${own ? '' : 'dim'}"><canvas data-mountcv="${k}" width="80" height="70"></canvas><div><b>${esc(m.n)}</b><small>${esc(m.th)} · ความเร็ว +${m.speed}% · ต้อง Lv${m.lv}</small><small>${own ? 'เป็นเจ้าของ' : 'ยังไม่มี (' + fmt(m.price) + 'z)'}</small></div>${own ? `<button class="btn gold tiny" data-act="ride" data-id="${k}">${c.mount === k && G.char.mount ? 'ลง/ขี่' : 'ขี่'}</button>` : ''}</div>`; }).join('')}</div><p class="hint">กด <kbd>T</kbd> เพื่อขึ้น/ลงพาหนะ · ลงอัตโนมัติเมื่อโจมตี · ใช้ไม่ได้ในดันเจี้ยน/ปราสาท</p>`;
      } else {
        body = `<p class="hint">${G.info.kind === 'town' ? 'ร้านของ Tamer Rook' : '⚠ ซื้อได้เฉพาะในเมือง'}</p><div class="shopList scrollKeep">${D.STABLE.map((id) => { const d = D.ITEMS[id]; return `<div class="shopRow">${icon(id)}<div><b>${esc(d.n)}</b><small>${esc(d.th)}${d.lv > 1 ? ' · Lv' + d.lv : ''}${d.pet ? ' · ' + D.PETS[d.pet].stat + ' +' + D.PETS[d.pet].per + '/lv' : d.mount ? ' · +' + D.MOUNTS[d.mount].speed + '% speed' : ''}</small></div><span class="price">${fmt(d.price * (d.type === 'petfood' ? 10 : 1))} z</span><span>${d.type === 'petfood' ? '×10' : ''}</span><button class="btn gold tiny" data-act="buy" data-id="${id}">ซื้อ</button></div>`; }).join('')}</div>`;
      }
      return `<div class="tabs">${[['pets', '🐾 สัตว์เลี้ยง'], ['mounts', '🐎 พาหนะ'], ['shop', '🛒 ร้านสัตว์']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>${body}`;
    },
    act(a, d) {
      const w = UI.wins.pets;
      if (a === 'tab') { w.opts.tab = d.k; render('pets'); drawPetCanvases(); }
      if (a === 'pet') G.send({ t: 'pet', id: d.id || null });
      if (a === 'ride') G.send({ t: 'mount', id: d.id });
      if (a === 'buy') G.send({ t: 'stableBuy', id: d.id });
    }
  };
  function drawPetCanvases() {
    for (const cv of document.querySelectorAll('[data-petcv]')) { const d = D.PETS[cv.dataset.petcv]; const g = cv.getContext('2d'); g.clearRect(0, 0, 80, 70); ART.drawMonster(g, { sh: d.shape, col: d.color, sz: 1.3, rk: 5, id: 1 }, 40, 60, G.t); }
    for (const cv of document.querySelectorAll('[data-mountcv]')) { const g = cv.getContext('2d'); g.clearRect(0, 0, 80, 70); g.save(); g.translate(36, 62); g.scale(1.3, 1.3); ART.drawMount(g, cv.dataset.mountcv, 0, 0, G.t, false, 1); g.restore(); }
  }
  setInterval(() => { if (UI.open.includes('pets')) drawPetCanvases(); }, 150);

  // ---------------------------------------------------------------- mail
  let mailList = [];
  UI.onMail = (m) => { mailList = m.list; render('mail'); };
  WIN.mail = {
    title: '✉ จดหมาย', w: 640,
    onOpen() { G.send({ t: 'mail', a: 'list' }); },
    render(o) {
      const tab = o.tab || 'in';
      if (tab === 'send') {
        const sel = o.att || [];
        return `${tabs(tab)}<div class="mailForm"><input id="mTo" placeholder="ชื่อผู้รับ" value="${esc(o.to || '')}"><input id="mSubj" placeholder="หัวข้อ" maxlength="40"><textarea id="mBody" placeholder="ข้อความ" maxlength="300"></textarea>
          <div>แนบ Zeny <input id="mZ" type="number" min="0" value="0" style="width:120px"> · แนบไอเทม (สูงสุด 5): ${sel.map((u) => { const it = UI.findItem(u); return it ? `<span class="chip">${iname(it)}<button data-act="unatt" data-uid="${u}">×</button></span>` : ''; }).join('')}</div>
          <div class="attPick scrollKeep">${G.char.inv.filter((it) => !sel.includes(it.uid) && !(D.ITEMS[it.id] && D.ITEMS[it.id].type === 'currency')).map((it) => `<div class="cell" data-act="att" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty}</span>` : ''}</div>`).join('')}</div>
          <button class="btn gold" data-act="send">ส่งจดหมาย (ค่าส่ง ${100 + sel.length * 200}z)</button></div>`;
      }
      return `${tabs(tab)}<div class="acts"><button class="btn gold tiny" data-act="claimAll">รับของทั้งหมด</button><button class="btn tiny" data-act="refresh">รีเฟรช</button></div><div class="mailList scrollKeep">${mailList.map((m) => `<div class="mailRow ${m.read ? '' : 'new'}"><div><b>${esc(m.subj)}</b><small>จาก ${esc(m.from)} · ${ago(m.at)}ที่แล้ว</small>${m.body ? `<p>${esc(m.body)}</p>` : ''}<div class="chips">${(m.items || []).map((it) => `<span class="chip" data-item="">${iname(it)} ×${it.qty || 1}</span>`).join('')}${m.zeny ? `<span class="chip">💰 ${fmt(m.zeny)}</span>` : ''}</div></div>${(m.items || []).length || m.zeny ? `<button class="btn gold tiny" data-act="claim" data-id="${m.id}">รับ</button>` : ''}<button class="btn tiny danger" data-act="del" data-id="${m.id}">ลบ</button></div>`).join('') || '<p class="hint">กล่องจดหมายว่าง</p>'}</div>`;
    },
    act(a, d) {
      const w = UI.wins.mail;
      if (a === 'tab') { w.opts.tab = d.k; render('mail'); }
      if (a === 'claim') G.send({ t: 'mail', a: 'claim', id: d.id });
      if (a === 'claimAll') G.send({ t: 'mail', a: 'claimAll' });
      if (a === 'del') G.send({ t: 'mail', a: 'del', id: d.id });
      if (a === 'refresh') G.send({ t: 'mail', a: 'list' });
      if (a === 'att') { w.opts.att = (w.opts.att || []); if (w.opts.att.length < 5) w.opts.att.push(d.uid); w.opts.to = $('#mTo').value; render('mail'); }
      if (a === 'unatt') { w.opts.att = (w.opts.att || []).filter((x) => x !== d.uid); render('mail'); }
      if (a === 'send') { G.send({ t: 'mail', a: 'send', to: $('#mTo').value, subj: $('#mSubj').value, body: $('#mBody').value, zeny: +$('#mZ').value || 0, uids: w.opts.att || [] }); w.opts.att = []; w.opts.tab = 'in'; }
    }
  };
  function tabs(tab) { return `<div class="tabs">${[['in', '📥 กล่องจดหมาย'], ['send', '📤 เขียนจดหมาย']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>`; }

  // ---------------------------------------------------------------- auction house
  let ahData = { list: [], mine: [], total: 0 };
  UI.onAh = (m) => { ahData = m; render('market'); };
  WIN.market = {
    title: '🏛 ตลาดประมูล', w: 820,
    onOpen(w) { const o = w.opts || {}; G.send({ t: 'ah', a: 'search', q: o.q, cat: o.cat, sort: o.sort }); },
    render(o) {
      const tab = o.tab || 'buy';
      const cats = [['', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'เกราะ'], ['acc', 'ประดับ'], ['rune', 'รูน/อัญมณี'], ['mat', 'วัสดุ/ใช้งาน']];
      const row = (a, mine) => `<div class="ahRow"><img src="${ART.itemIcon(a.item)}" ${a.item.type === 'equip' ? '' : `data-itemid="${a.item.id}"`}><div>${iname(a.item)} ${a.item.qty > 1 ? '×' + a.item.qty : ''}<small>ผู้ขาย ${esc(a.seller)} · เหลือ ${Math.floor(a.left / 60)} ชม.${a.item.type === 'equip' ? ' · iLv' + a.item.ilv + ' · ' + (a.item.opts || []).length + ' ออปชั่น' : ''}</small></div><span class="price">${fmt(a.price)} z${a.item.qty > 1 ? `<small>${fmt(a.price / a.item.qty)}/ชิ้น</small>` : ''}</span>${mine ? `<button class="btn tiny danger" data-act="cancel" data-id="${a.id}">ยกเลิก</button>` : `<button class="btn gold tiny" data-act="buy" data-id="${a.id}" ${G.char.zeny < a.price ? 'disabled' : ''}>ซื้อ</button>`}</div>`;
      let body;
      if (tab === 'buy') body = `<div class="ahBar"><input id="ahQ" placeholder="ค้นหาชื่อไอเทม" value="${esc(o.q || '')}"><select id="ahCat">${cats.map(([k, n]) => `<option value="${k}" ${o.cat === k ? 'selected' : ''}>${n}</option>`).join('')}</select><select id="ahSort">${[['low', 'ราคาต่ำ→สูง'], ['high', 'ราคาสูง→ต่ำ'], ['new', 'ใหม่ล่าสุด']].map(([k, n]) => `<option value="${k}" ${o.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn gold" data-act="search">ค้นหา</button></div>
        <small class="hint">พบ ${ahData.total} รายการ · 💰 ${fmt(G.char.zeny)} Zeny · เงินจากการขายส่งทางจดหมาย (หักภาษี 5%)</small><div class="ahList scrollKeep">${ahData.list.map((a) => row(a)).join('') || '<p class="hint">ไม่มีสินค้า</p>'}</div>`;
      else if (tab === 'mine') body = `<div class="ahList scrollKeep">${ahData.mine.map((a) => row(a, true)).join('') || '<p class="hint">ยังไม่ได้วางขาย</p>'}</div>`;
      else {
        const sel = UI.findItem(o.sel);
        body = `<div class="twoCol"><div class="pickList scrollKeep">${G.char.inv.filter((it) => !(D.ITEMS[it.id] && D.ITEMS[it.id].type === 'currency')).map((it) => `<div class="pick ${o.sel === it.uid ? 'on' : ''}" data-act="pick" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}"><span>${iname(it)}${it.qty > 1 ? ' ×' + it.qty : ''}</span></div>`).join('')}</div>
          <div>${sel ? `<h4>${iname(sel)}</h4>${sel.qty > 1 ? `<label>จำนวน <input id="ahQty" type="number" min="1" max="${sel.qty}" value="${sel.qty}"></label>` : ''}<label>ราคารวม (Zeny) <input id="ahPrice" type="number" min="1" value="${Math.max(1, UI.sellPrice(sel) * (sel.qty || 1) * 3)}"></label><p class="hint">ค่าวางขาย 2% · ภาษีเมื่อขายได้ 5% · วางได้ 48 ชม. · สูงสุด 20 รายการ</p><button class="btn gold" data-act="sell" data-uid="${sel.uid}">วางขาย</button>` : '<p class="hint">เลือกไอเทมจากซ้ายมือ</p>'}</div></div>`;
      }
      return `<div class="tabs">${[['buy', '🔎 ซื้อ'], ['sell', '💰 วางขาย'], ['mine', `📋 ของฉัน (${ahData.mine.length})`]].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}${G.info.kind !== 'town' ? '<span class="badge orange">ดูได้ทุกที่ · ซื้อ/ขายในเมือง</span>' : ''}</div>${body}`;
    },
    act(a, d) {
      const w = UI.wins.market, o = w.opts;
      const q = () => ({ q: o.q, cat: o.cat, sort: o.sort });
      if (a === 'tab') { o.tab = d.k; render('market'); }
      if (a === 'search') { o.q = $('#ahQ').value; o.cat = $('#ahCat').value; o.sort = $('#ahSort').value; G.send({ t: 'ah', a: 'search', ...q() }); }
      if (a === 'buy') UI.ask('ยืนยันการซื้อ?').then((y) => y && G.send({ t: 'ah', a: 'buy', id: d.id, ...q() }));
      if (a === 'cancel') G.send({ t: 'ah', a: 'cancel', id: d.id, ...q() });
      if (a === 'pick') { o.sel = d.uid; render('market'); }
      if (a === 'sell') { G.send({ t: 'ah', a: 'sell', uid: d.uid, qty: +($('#ahQty') || {}).value || 1, price: +$('#ahPrice').value, ...q() }); o.sel = null; o.tab = 'mine'; }
    }
  };

  // ---------------------------------------------------------------- storage
  let store = { items: [], zeny: 0, max: 300 };
  UI.onStorage = (m) => { store = m; render('storage'); };
  WIN.storage = {
    title: '📦 คลังเก็บของ (ใช้ร่วมทุกตัวละครในบัญชี)', w: 760,
    onOpen() { G.send({ t: 'storage', a: 'open' }); },
    render() {
      const gx = G.char.guildX;
      const cell = (it, act) => `<div class="cell" data-act="${act}" data-uid="${it.uid}" ${it.type === 'equip' ? '' : `data-itemid="${it.id}"`}><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty > 999 ? '999+' : it.qty}</span>` : ''}${it.refine ? `<em>+${it.refine}</em>` : ''}</div>`;
      return `<div class="stTop"><span>คลัง ${store.items.length}/${store.max} · 💰 ${fmt(store.zeny)}</span><input id="stZ" type="number" min="0" placeholder="Zeny" style="width:110px"><button class="btn tiny" data-act="putZ">ฝาก Zeny</button><button class="btn tiny" data-act="takeZ">ถอน Zeny</button><button class="btn tiny gold" data-act="putAll">ฝากวัสดุ/รูนทั้งหมด</button></div>
        <div class="twoGrid"><div><h4>กระเป๋า (คลิก = ฝาก)</h4><div class="invGrid small scrollKeep">${G.char.inv.map((it) => cell(it, 'put')).join('')}</div></div><div><h4>คลัง (คลิก = เบิก)</h4><div class="invGrid small">${store.items.map((it) => cell(it, 'take')).join('')}</div></div></div>
        ${gx ? `<h4>🏰 คลังกิลด์ (${gx.storage.length}/${60 + gx.lv * 5}) — คลิกของในกระเป๋าพร้อม Shift = ฝากเข้ากิลด์</h4><div class="invGrid small">${gx.storage.map((it) => cell(it, 'gtake')).join('') || '<small class="hint">ว่าง</small>'}</div>` : ''}`;
    },
    act(a, d, el, ev) {
      if (a === 'put') { if (ev.shiftKey && G.char.guildX) G.send({ t: 'gstore', a: 'put', uid: d.uid }); else G.send({ t: 'storage', a: 'put', uid: d.uid }); }
      if (a === 'take') G.send({ t: 'storage', a: 'take', uid: d.uid });
      if (a === 'gtake') G.send({ t: 'gstore', a: 'take', uid: d.uid });
      if (a === 'putZ') G.send({ t: 'storage', a: 'putZ', z: +$('#stZ').value || 0 });
      if (a === 'takeZ') G.send({ t: 'storage', a: 'takeZ', z: +$('#stZ').value || 0 });
      if (a === 'putAll') G.send({ t: 'storage', a: 'putAll' });
    }
  };

  // ---------------------------------------------------------------- trade
  let trade = null;
  UI.onTrade = (m) => {
    if (m.closed) { trade = null; UI.close('trade'); if (m.why && m.why !== 'done') UI.toast(m.why, 'err'); return; }
    trade = m; if (!UI.open.includes('trade')) UI.show('trade'); else render('trade');
  };
  WIN.trade = {
    title: '🤝 แลกเปลี่ยน', w: 720,
    render() {
      if (!trade) return '<p class="hint">ไม่มีการเทรด — คลิกขวาที่ผู้เล่นแล้วเลือก "ขอเทรด"</p>';
      const side = (s, mine) => `<div class="tSide ${s.lock ? 'locked' : ''}"><h4>${esc(s.name)} ${s.lock ? '🔒' : ''} ${s.ok ? '✅' : ''}</h4><div class="invGrid small">${s.items.map((it) => `<div class="cell" ${mine && !s.lock ? `data-act="rm" data-uid="${it.uid}"` : ''} data-item="${it.uid}"><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty}</span>` : ''}</div>`).join('')}</div><div class="zeny">💰 ${fmt(s.zeny)}</div></div>`;
      const offered = trade.me.items.map((x) => x.uid);
      return `<div class="twoGrid">${side(trade.me, true)}${side(trade.them)}</div>
        ${trade.me.lock ? '' : `<h4>เลือกไอเทมจากกระเป๋า</h4><div class="invGrid small scrollKeep">${G.char.inv.filter((it) => !offered.includes(it.uid)).map((it) => `<div class="cell" data-act="add" data-uid="${it.uid}" data-item="${it.uid}"><img src="${ART.itemIcon(it)}">${it.qty > 1 ? `<span class="q">${it.qty}</span>` : ''}</div>`).join('')}</div>
        <div class="acts">Zeny <input id="trZ" type="number" min="0" value="${trade.me.zeny}" style="width:130px"><button class="btn tiny" data-act="z">ตั้ง</button></div>`}
        <div class="acts"><button class="btn" data-act="lock" ${trade.me.lock ? 'disabled' : ''}>🔒 ล็อก</button><button class="btn gold" data-act="ok" ${trade.me.lock && trade.them.lock && !trade.me.ok ? '' : 'disabled'}>✅ ยืนยันแลก</button><button class="btn danger" data-act="cancel">ยกเลิก</button></div>
        <small class="hint">ทั้งสองฝ่ายต้องล็อกแล้วกดยืนยัน · แก้ไขรายการ = ปลดล็อกทั้งคู่ · ตรวจสอบของอีกฝ่ายก่อนยืนยันทุกครั้ง</small>`;
    },
    act(a, d) {
      if (a === 'add') G.send({ t: 'trade', a: 'add', uid: d.uid });
      if (a === 'rm') G.send({ t: 'trade', a: 'remove', uid: d.uid });
      if (a === 'z') G.send({ t: 'trade', a: 'zeny', z: +$('#trZ').value || 0 });
      if (a === 'lock' || a === 'ok' || a === 'cancel') G.send({ t: 'trade', a });
    }
  };

  // ---------------------------------------------------------------- crafting & token shop
  WIN.craft = {
    title: '⚗ คราฟต์ & แลกโทเคน', w: 720,
    render(o) {
      const tab = o.tab || 'craft';
      let body;
      if (tab === 'craft') body = `<div class="shopList scrollKeep">${D.RECIPES.map((r, i) => { const ok = r.req.every(([id, q]) => cnt(id) >= q) && G.char.zeny >= r.zeny && G.char.lv >= r.lv; return `<div class="recipe ${ok ? '' : 'dim'}">${icon(r.out)}<div><b>${esc(D.ITEMS[r.out].n)} ×${r.q}</b><small>${r.req.map(([id, q]) => `<span class="${cnt(id) >= q ? 'ok' : 'bad'}">${esc(D.ITEMS[id].n)} ${cnt(id)}/${q}</span>`).join(' · ')} · 💰${fmt(r.zeny)}${r.lv > 1 ? ' · Lv' + r.lv : ''}</small></div><button class="btn gold tiny" data-act="craft" data-i="${i}" data-n="1" ${ok ? '' : 'disabled'}>คราฟต์</button><button class="btn tiny" data-act="craft" data-i="${i}" data-n="10" ${ok ? '' : 'disabled'}>×10</button></div>`; }).join('')}</div><p class="hint">วัตถุดิบ: Monster Core / Wild Herb / Mana Dust ดรอปจากมอนทั่วไป</p>`;
      else body = `<p>คุณมี ${icon('daily_token')} Valor Token <b>${cnt('daily_token')}</b> · ${icon('arena_token')} Arena Medal <b>${cnt('arena_token')}</b></p><div class="shopList scrollKeep">${D.TOKEN_SHOP.map(([id, cost, cur], i) => `<div class="shopRow">${icon(id)}<div><b>${esc(D.ITEMS[id].n)}</b><small>${esc(D.ITEMS[id].th || '')}</small></div><span class="price">${cost} ${cur === 'daily_token' ? '★' : '⚔'}</span><span></span><button class="btn gold tiny" data-act="tok" data-i="${i}" ${cnt(cur) >= cost ? '' : 'disabled'}>แลก</button></div>`).join('')}</div>`;
      return `<div class="tabs">${[['craft', '⚗ คราฟต์'], ['token', '★ แลกโทเคน']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${n}</button>`).join('')}</div>${body}`;
    },
    act(a, d) { const w = UI.wins.craft; if (a === 'tab') { w.opts.tab = d.k; render('craft'); } if (a === 'craft') G.send({ t: 'craft', i: +d.i, n: +d.n }); if (a === 'tok') G.send({ t: 'tokenBuy', i: +d.i }); }
  };

  // ---------------------------------------------------------------- friends
  WIN.friends = {
    title: '💬 เพื่อน', w: 440,
    render() {
      const list = G.char.friends || [];
      return `<div class="acts"><input id="frIn" placeholder="ชื่อตัวละคร"><button class="btn gold" data-act="add">เพิ่มเพื่อน</button><button class="btn tiny" data-act="ref">รีเฟรช</button></div>
        <div class="members">${list.sort((a, b) => b.on - a.on).map((f) => `<div class="mem ${f.on ? 'on' : ''}"><i></i>${f.cls ? `<img src="${ART.classIcon(f.cls, 24)}">` : ''}<b>${esc(f.name)}</b><span>Lv${f.lv}</span><small>${esc(f.map || '')}</small><button class="btn tiny" data-act="w" data-n="${esc(f.name)}">กระซิบ</button><button class="btn tiny" data-act="pt" data-n="${esc(f.name)}">ปาร์ตี้</button><button class="btn tiny danger" data-act="rm" data-n="${esc(f.name)}">×</button></div>`).join('') || '<p class="hint">ยังไม่มีเพื่อน — คลิกขวาที่ผู้เล่นเพื่อเพิ่ม</p>'}</div>`;
    },
    act(a, d) {
      if (a === 'add') G.send({ t: 'friend', a: 'add', name: $('#frIn').value });
      if (a === 'rm') G.send({ t: 'friend', a: 'remove', name: d.n });
      if (a === 'ref') G.send({ t: 'refreshChar' });
      if (a === 'pt') G.send({ t: 'party', a: 'invite', name: d.n });
      if (a === 'w') { $('#chatIn').value = `/w ${d.n} `; UI.focusChat(); }
    }
  };

  // ---------------------------------------------------------------- emote wheel
  UI.emoteWheel = function () {
    let el = $('#emoteWheel');
    if (el) { el.remove(); return; }
    el = document.createElement('div'); el.id = 'emoteWheel';
    el.innerHTML = D.EMOTES.map((e, i) => `<button data-i="${i}" style="--a:${i / D.EMOTES.length * 360}deg">${e}</button>`).join('');
    el.onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (b) G.send({ t: 'emote', i: +b.dataset.i }); el.remove(); };
    document.body.appendChild(el);
    setTimeout(() => el.isConnected && el.remove(), 5000);
  };

  // ---------------------------------------------------------------- ranked arena (extends Arena window)
  const baseArena = WIN.arena.render;
  WIN.arena.render = function (o) {
    const c = G.char; const tier = D.rankTier(c.mmr || 1000);
    return `<div class="ranked"><h4>🏆 Ranked Arena 1v1</h4><div class="rkTop"><span class="tier" style="--c:${tier[2]}">${tier[1]}</span><div><b>MMR ${c.mmr || 1000}</b><small>ชนะ ${c.rw || 0} · แพ้ ${c.rl || 0} · ต้อง Lv30+</small></div>
      <button class="btn ${c.queue ? 'danger' : 'gold'} big" data-act="queue">${c.queue ? '⏳ กำลังหาคู่... (ยกเลิก)' : '⚔ เข้าคิวจัดอันดับ'}</button></div>
      <small class="hint">ระบบจับคู่ตาม MMR · สู้ 3 นาที · ชนะได้ Arena Medal ×3 (แพ้ ×1) แลกของที่ Alchemist · ${D.RANK_TIERS.map((t) => `<span style="color:${t[2]}">${t[1]} ${t[0]}+</span>`).join(' · ')}</small></div>` + baseArena(o);
  };
  const baseArenaAct = WIN.arena.act;
  WIN.arena.act = function (a, d) { if (a === 'queue') G.send({ t: 'ranked', on: !G.char.queue }); else baseArenaAct(a, d); };
  UI.onRanked = function (m) {
    if (m.state === 'start') { UI.banner(`⚔ RANKED: VS ${m.vs}`, `${D.CLASSES[m.vsCls].name} · MMR ${m.vsMmr} — เริ่มใน ${m.at} วินาที`, 'pvp'); UI.close('arena'); }
    if (m.state === 'end') { UI.banner(m.won ? '🏆 VICTORY' : '💀 DEFEAT', `MMR ${m.delta > 0 ? '+' : ''}${m.delta} → ${m.mmr} (${m.tier})`, m.won ? 'event' : 'boss'); if (window.SFX) m.won ? SFX.level() : SFX.death(); }
  };

  // ---------------------------------------------------------------- guild progression (extends Guild window)
  const baseGuild = WIN.guild.render;
  WIN.guild.render = function (o) {
    const gx = G.char.guildX; const g = G.char.guild;
    let ext = '';
    if (g && gx) {
      const master = g.master === G.char.id;
      ext = `<div class="gProg"><div><b>Guild Lv ${gx.lv}</b>/${D.GUILD_MAX_LV}<div class="prog"><i style="width:${gx.exp / gx.next * 100}%"></i><span>${fmt(gx.exp)} / ${fmt(gx.next)}</span></div><small>EXP กิลด์ได้จากสมาชิกฆ่ามอน (3%) · แต้มสกิลกิลด์ ${gx.points}</small></div>
        <div class="gSkills">${Object.entries(D.GUILD_SKILLS).map(([k, s]) => `<div><b>${s.n}</b><small>${s.th} · ${Object.entries(s.mods).map(([m, v]) => m + ' +' + v + '/lv').join(', ')}</small><span>Lv ${gx.skills[k] || 0}/${s.max}</span>${master ? `<button class="btn tiny gold" data-act="gskill" data-k="${k}" ${gx.points > 0 && (gx.skills[k] || 0) < s.max ? '' : 'disabled'}>+</button>` : ''}</div>`).join('')}</div>
        <button class="btn tiny" data-act="gstore">📦 คลังกิลด์ (${gx.storage.length})</button></div>`;
    }
    return ext + baseGuild(o);
  };
  const baseGuildAct = WIN.guild.act;
  WIN.guild.act = function (a, d) { if (a === 'gskill') G.send({ t: 'gskill', k: d.k }); else if (a === 'gstore') UI.show('storage'); else baseGuildAct(a, d); };

  // ---------------------------------------------------------------- touch controls (mobile)
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.addEventListener('DOMContentLoaded', () => {});
    const pad = document.createElement('div'); pad.id = 'joy'; pad.innerHTML = '<i></i>';
    const atk = document.createElement('div'); atk.id = 'touchBtns'; atk.innerHTML = '<button data-k="atk">⚔</button><button data-k="tab">🎯</button><button data-k="pot">❤</button><button data-k="auto">🤖</button><button data-k="mount">🐎</button>';
    const attach = () => { const h = document.getElementById('hud'); if (!h) return setTimeout(attach, 300); h.appendChild(pad); h.appendChild(atk); };
    attach();
    G.joy = { x: 0, y: 0 };
    let id = null, cx = 0, cy = 0;
    pad.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; id = t.identifier; const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    pad.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === id) { let dx = t.clientX - cx, dy = t.clientY - cy; const l = Math.hypot(dx, dy); const m = Math.min(l, 50); if (l > 8) { G.joy.x = dx / l; G.joy.y = dy / l; } else { G.joy.x = G.joy.y = 0; } pad.querySelector('i').style.transform = `translate(${dx / (l || 1) * m}px,${dy / (l || 1) * m}px)`; } e.preventDefault(); }, { passive: false });
    const end = () => { id = null; G.joy.x = G.joy.y = 0; pad.querySelector('i').style.transform = ''; };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
    atk.addEventListener('touchstart', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault();
      const k = b.dataset.k;
      if (k === 'atk') { const n = G.ents.get(G.target) || G.nearestEnemy(10); if (n && G.isEnemy(n)) G.clickEntity(n); }
      if (k === 'tab') G.cycleTarget();
      if (k === 'pot') G.send({ t: 'use', id: G.bestPot('hp') });
      if (k === 'auto') G.send({ t: 'autoOn', on: !G.autoOn() });
      if (k === 'mount') G.send({ t: 'mount' });
    }, { passive: false });
    document.body.classList.add('touch');
  }
})();
// ---------------------------------------------------------------- on-screen quest tracker
(function () {
  const D = NO_DATA;
  setInterval(() => {
    const hud = document.getElementById('hud'); if (!hud || hud.hidden || !G.char || !G.char.quests) return;
    let el = document.getElementById('tracker');
    if (!el) { el = document.createElement('div'); el.id = 'tracker'; el.className = 'glass'; el.onclick = () => UI.show('quests'); hud.appendChild(el); }
    const q = G.char.quests, mq = D.MAIN_QUESTS[q.main];
    const val = mq ? (mq.type === 'level' ? G.char.lv : mq.type === 'floor' ? ((G.char.dungeonBest || {})[mq.dg] || 0) : q.prog) : 0;
    const dl = (q.daily && q.daily.list) || [];
    el.innerHTML = `<b>📜 ภารกิจ</b>${mq ? `<div class="${val >= mq.v ? 'ok' : ''}">${UI.esc(mq.n)} <span>${Math.min(val, mq.v)}/${mq.v}</span></div>` : ''}${dl.filter((d) => !d.claimed).slice(0, 3).map((d) => { const def = D.DAILY_POOL.find((x) => x.id === d.id) || {}; return `<div class="${d.done ? 'ok' : ''}">${UI.esc(def.n)} <span>${d.prog}/${def.v}</span></div>`; }).join('')}`;
  }, 1000);
})();
// ---------------------------------------------------------------- guide: new systems
(function () {
  const base = UI.WIN.help.render;
  UI.WIN.help.render = function () {
    return base().replace('</div>$', '') + `<div class="help"><h4>ระบบเพิ่มเติม</h4><p>
      📜 <b>ภารกิจหลัก ${NO_DATA.MAIN_QUESTS.length} บท</b> + ภารกิจรายวัน 5 อย่าง + ล็อกอินรายวัน 7 วัน (L) ·
      🏅 <b>ความสำเร็จ ${NO_DATA.ACHIEVEMENTS.length} อย่าง</b> ปลดฉายาและโบนัสถาวร (Y) ·
      🐾 <b>สัตว์เลี้ยง 7 ตัว</b> เลเวล 1–30 ให้โบนัสสเตตัส · 🐎 <b>พาหนะ 5 แบบ</b> กด T ·
      🏛 <b>ตลาดประมูล</b> · 🤝 <b>เทรด</b> (คลิกขวาผู้เล่น) · ✉ <b>จดหมาย</b> ส่งของ/Zeny · 📦 <b>คลัง</b> ใช้ร่วมทั้งบัญชี + คลังกิลด์ ·
      ⚗ <b>คราฟต์ ${NO_DATA.RECIPES.length} สูตร</b> + ร้านแลกโทเคน · 🏆 <b>Ranked Arena 1v1</b> MMR 6 ระดับ ·
      🏰 <b>กิลด์เลเวล 1–20</b> + สกิลกิลด์ 5 อย่าง · ☠ <b>Karma</b>: ฆ่าผู้บริสุทธิ์ในแผนที่ PK = ชื่อแดง ตายแล้วดรอปของ · 😀 อีโมต (E) · 💬 เพื่อน (F) · ⚙ ตั้งค่าเสียง/กราฟิก (.)</p></div>`;
  };
})();

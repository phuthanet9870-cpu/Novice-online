// Online play for the single-page build. Everyone who has the page open joins the artifact's live room.
// The first page to arrive hosts the world (its in-page server is authoritative); later pages connect their client
// to that host through the room instead of their own in-page server. Messages are batched, deflated and chunked to
// fit the room's 4 KiB / ~40-per-second budget. Characters of guests are mirrored back to their own browser, so
// whoever hosts next brings everyone's progress along.
(function () {
  const VER = '__NO_VER__';
  const ROOM = 'novice-world';
  const KEY = 'novice_online_db_v1';
  const NET = window.NO_NET = { mode: 'solo', host: null, me: null, online: 1, status: 'กำลังค้นหาเซิร์ฟเวอร์ออนไลน์…', listeners: [] };
  const tell = () => { for (const f of NET.listeners) try { f(NET); } catch (e) {} };
  let decide; const ready = new Promise((r) => (decide = r));
  let R = null;
  const started = Date.now();

  // ---------------------------------------------------------------- codec
  async function pack(str) {
    if (typeof CompressionStream === 'undefined') return 'r' + str;
    const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const buf = new Uint8Array(await new Response(cs).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'z' + btoa(s);
  }
  async function unpack(p) {
    if (p[0] === 'r') return p.slice(1);
    const bin = atob(p.slice(1)); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ds = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(ds).text();
  }
  // send budget shared by everything this page emits
  let tokens = 30, lastRefill = performance.now();
  const take = () => { const n = performance.now(); tokens = Math.min(34, tokens + (n - lastRefill) / 1000 * 32); lastRefill = n; if (tokens >= 1) { tokens--; return true; } return false; };
  let seq = 1;
  const CH = 3000;
  // queue of packets, each sent as one or more chunk emits
  function makeOutbox(topic, to) {
    const ob = { q: [], parts: [], busy: false };
    ob.push = (str) => { ob.q.push(str); };
    ob.flush = async () => {
      if (ob.busy) return; ob.busy = true;
      try {
        if (!ob.parts.length && ob.q.length) {
          const body = JSON.stringify(ob.q); ob.q = [];
          const z = await pack(body), id = seq++, n = Math.ceil(z.length / CH);
          for (let i = 0; i < n; i++) ob.parts.push({ to, id, i, n, z: z.slice(i * CH, (i + 1) * CH) });
        }
        while (ob.parts.length && take()) { const p = ob.parts.shift(); R.emit(topic, p).catch(() => {}); }
      } finally { ob.busy = false; }
    };
    return ob;
  }
  function makeInbox(onBatch) {
    const asm = new Map();
    return async (d) => {
      if (!d || typeof d.z !== 'string') return;
      let a = asm.get(d.id); if (!a) { a = { parts: new Array(d.n), got: 0, at: Date.now() }; asm.set(d.id, a); }
      if (!a.parts[d.i]) { a.parts[d.i] = d.z; a.got++; }
      if (a.got < d.n) { for (const [k, v] of asm) if (Date.now() - v.at > 8000) asm.delete(k); return; }
      asm.delete(d.id);
      try { const arr = JSON.parse(await unpack(a.parts.join(''))); onBatch(arr); } catch (e) {}
    };
  }

  // ---------------------------------------------------------------- local save mirror (guests)
  function mirrorSave(pkt) {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      data.accounts = data.accounts || {}; data.chars = data.chars || {};
      const key = String(pkt.acc.user).toLowerCase(); const mine = data.accounts[key];
      const acc = Object.assign({}, pkt.acc, { gm: mine ? mine.gm : 0, savedAt: Date.now() });
      data.accounts[key] = acc; for (const c of pkt.chars) data.chars[c.id] = c;
      localStorage.setItem(KEY, JSON.stringify(data));
      // keep this page's own (idle) server in step, or its autosave would write the old copy back
      const db = window.__NO_REQ('./db'); db.data.accounts[key] = acc; for (const c of pkt.chars) db.data.chars[c.id] = c;
    } catch (e) {}
  }
  function localAccounts() {
    try { const data = JSON.parse(localStorage.getItem(KEY) || '{}'); return Object.values(data.accounts || {}).map((a) => ({ acc: a, chars: (a.chars || []).map((id) => data.chars[id]).filter(Boolean) })); } catch (e) { return []; }
  }

  // ---------------------------------------------------------------- host side
  const conns = new Map();
  function hostAccept(peer) {
    let c = conns.get(peer); if (c) return c;
    if (conns.size >= 6) return null;
    const out = makeOutbox('s2c', peer);
    const srv = { readyState: 1, h: {}, on(ev, fn) { this.h[ev] = fn; }, send(data) { if (srv.readyState === 1) out.push(data); }, close() { srv.readyState = 3; out.push(JSON.stringify({ t: '_close' })); } };
    c = { peer, srv, out, user: null };
    conns.set(peer, c);
    window.__NO_WSS().h.connection(srv, { headers: {}, socket: { remoteAddress: 'room:' + peer.slice(0, 8) } });
    out.push(JSON.stringify({ t: '_open' }));
    NET.online = conns.size + 1; tell();
    return c;
  }
  function hostDrop(peer) { const c = conns.get(peer); if (!c) return; saveFor(c); conns.delete(peer); c.srv.readyState = 3; if (c.srv.h.close) c.srv.h.close(); NET.online = conns.size + 1; tell(); }
  function importAccounts(list) {
    const db = window.__NO_REQ('./db');
    for (const { acc, chars } of list || []) {
      if (!acc || !acc.user || !Array.isArray(chars)) continue;
      const key = String(acc.user).toLowerCase(), have = db.data.accounts[key];
      if (have && (have.hash !== acc.hash || have.salt !== acc.salt)) continue; // someone else's account with that name
      if (have && (have.savedAt || 0) >= (acc.savedAt || 0) && have.chars.length) continue;
      const ok = [];
      for (const c of chars) {
        if (!c || !c.id || !c.name) continue;
        const other = db.charByName(c.name); if (other && other.id !== c.id) c.name = (c.name + '_' + c.id.slice(-3)).slice(0, 14);
        db.data.chars[c.id] = c; ok.push(c.id);
      }
      db.data.accounts[key] = Object.assign({}, acc, { gm: have ? have.gm : 0, chars: ok });
    }
    db.dirty = true;
  }
  function saveFor(c) {
    if (!c.user) return;
    try {
      window.__NO_REQ('./gm').saveAll();
      const db = window.__NO_REQ('./db'), acc = db.data.accounts[c.user.toLowerCase()]; if (!acc) return;
      const pkt = { t: '_save', acc: Object.assign({}, acc, { savedAt: Date.now() }), chars: acc.chars.map((id) => db.data.chars[id]).filter(Boolean) };
      c.out.push(JSON.stringify(pkt));
    } catch (e) {}
  }
  function startHost() {
    NET.mode = 'host'; NET.status = 'ออนไลน์ · คุณเป็นโฮสต์'; tell();
    const inbox = new Map();
    R.on('c2s', (msg) => {
      const d = msg.data; if (!d || d.to !== NET.me || msg.sameTab) return;
      const c = hostAccept(msg.peer); if (!c) return;
      if (d.hello) return;
      let ib = inbox.get(msg.peer); if (!ib) { ib = makeInbox((arr) => { for (const s of arr) deliver(c, s); }); inbox.set(msg.peer, ib); }
      ib(d);
    });
    const deliver = (c, s) => {
      let m; try { m = JSON.parse(s); } catch (e) { return; }
      if (m.t === '_import') { importAccounts(m.list); return; }
      if ((m.t === 'login' || m.t === 'register') && m.user) c.user = String(m.user);
      if (c.srv.h.message) c.srv.h.message(s);
    };
    setInterval(() => { for (const c of conns.values()) c.out.flush(); }, 120);
    setInterval(() => { for (const c of conns.values()) saveFor(c); }, 20000);
    R.onPeers((ch) => { for (const p of ch.left) hostDrop(p.peer); });
  }

  // ---------------------------------------------------------------- guest side
  class RemoteSocket {
    constructor() {
      this.readyState = 0;
      const out = this.out = makeOutbox('c2s', NET.host);
      const inbox = makeInbox((arr) => {
        for (const s of arr) {
          if (s === '{"t":"_open"}') { if (this.readyState === 0) { this.readyState = 1; out.push(JSON.stringify({ t: '_import', list: localAccounts() })); this.onopen && this.onopen(); } continue; }
          if (s === '{"t":"_close"}') { this.close(); continue; }
          if (s.startsWith('{"t":"_save"')) { try { mirrorSave(JSON.parse(s)); } catch (e) {} continue; }
          this.onmessage && this.onmessage({ data: s });
        }
      });
      R.on('s2c', (msg) => { if (msg.data && msg.data.to === NET.me) inbox(msg.data); });
      R.onPeers((ch) => { if (ch.left.some((p) => p.peer === NET.host)) this.close(); });
      R.emit('c2s', { to: NET.host, hello: 1 }).catch(() => {});
      this.timer = setInterval(() => out.flush(), 60);
      setTimeout(() => { if (this.readyState === 0) { NET.status = 'ติดต่อโฮสต์ไม่ได้ — เล่นคนเดียว'; tell(); this.close(); } }, 12000);
    }
    send(d) { if (this.readyState === 1) this.out.push(d); }
    close() { if (this.readyState === 3) return; this.readyState = 3; clearInterval(this.timer); this.onclose && this.onclose({}); }
  }

  // ---------------------------------------------------------------- the socket the client uses
  const Local = window.WebSocket;
  class NetSocket {
    constructor() {
      this.readyState = 0;
      ready.then((mode) => {
        const s = this.s = mode === 'guest' ? new RemoteSocket() : new Local();
        s.onopen = () => { this.readyState = 1; this.onopen && this.onopen(); };
        s.onmessage = (e) => this.onmessage && this.onmessage(e);
        s.onclose = (e) => { this.readyState = 3; this.onclose && this.onclose(e); };
      });
    }
    send(d) { if (this.s) this.s.send(d); }
    close() { if (this.s) this.s.close(); }
  }
  window.WebSocket = NetSocket;

  // ---------------------------------------------------------------- election
  async function boot() {
    const solo = (why) => { NET.mode = 'solo'; NET.status = why; tell(); decide('solo'); };
    if (!window.claude || !claude.use) return solo('ออฟไลน์ · เล่นคนเดียว');
    let room = null;
    try { room = await claude.use('room'); } catch (e) {}
    if (!room) return solo('ออฟไลน์ · เล่นคนเดียว (ห้องออนไลน์ไม่พร้อม)');
    try { R = await room.join(ROOM); } catch (e) { R = room; }
    try { await R.presence({ g: 'novice', v: VER, t: started, host: false }); } catch (e) {}
    // wait for the room to answer, then look for a live host of the same build
    const deadline = Date.now() + 2600;
    let host = null;
    while (Date.now() < deadline && !host) {
      await new Promise((r) => setTimeout(r, 250));
      const ps = R.peers();
      const me = ps.find((p) => p.sameTab); if (me) NET.me = me.peer;
      host = ps.find((p) => !p.sameTab && p.presence && p.presence.g === 'novice' && p.presence.v === VER && p.presence.host);
    }
    if (!NET.me) { const me = R.peers().find((p) => p.sameTab); if (me) NET.me = me.peer; }
    if (!NET.me) return solo('ออฟไลน์ · เล่นคนเดียว');
    if (host) { NET.mode = 'guest'; NET.host = host.peer; NET.status = 'ออนไลน์ · เชื่อมต่อโลกของโฮสต์'; tell(); decide('guest'); }
    else {
      try { await R.presence({ host: true }); } catch (e) {}
      startHost(); decide('host');
    }
    const count = () => { NET.online = R.peers().filter((p) => p.presence && p.presence.g === 'novice' && p.presence.v === VER).length || 1; tell(); };
    R.onPeers(count); count();
  }
  window.__NO_NET_BOOT = boot;
})();

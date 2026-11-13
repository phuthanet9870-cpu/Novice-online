// Economy: account storage, mail, auction house, player trade, crafting, token & stable shops.
const D = require('../shared/data2.js');
const F = require('../shared/formulas.js');
const rng = require('../shared/rng.js').rng(Date.now() & 0xffffff);
const db = require('./db');
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const P = require('./progress');
const S = require('./social');

const E = module.exports;
const send = (p, m) => p && p.sess && p.sess.send(m);
const err = (p, m) => { send(p, { t: 'err', m }); return false; };
const note = (p, m, k = 'system') => send(p, { t: 'notice', k, m });
const inTown = (p) => p.inst && p.inst.def.kind === 'town' || p.gm;
const sync = (p, k) => C.sendChar(p, k);
const uid = () => 'u' + db.nextId();
function data() { const d = db.data; d.storage = d.storage || {}; d.mail = d.mail || {}; d.auction = d.auction || []; return d; }

// ------------------------------------------------------------------ storage (shared per account)
const STORE_MAX = 300;
function store(p) { const d = data(); const k = p.char.acc; return d.storage[k] || (d.storage[k] = { items: [], zeny: 0 }); }
E.storageSend = (p) => send(p, { t: 'storage', items: store(p).items, zeny: store(p).zeny, max: STORE_MAX });
E.storage = function (p, m) {
  if (!inTown(p)) return err(p, 'ใช้คลังได้ในเมือง (Keeper Odo/Ivo)');
  const st = store(p), c = p.char;
  if (m.a === 'put') {
    const it = I.find(c, m.uid); if (!it) return;
    const q = it.type === 'equip' ? undefined : Math.max(1, Math.min(it.qty, m.qty | 0 || it.qty));
    if (it.type === 'equip' || !st.items.find((x) => x.id === it.id)) if (st.items.length >= STORE_MAX) return err(p, 'คลังเต็ม');
    const tk = I.removeUid(c, m.uid, q);
    if (tk.type === 'equip') st.items.push(tk);
    else { const ex = st.items.find((x) => x.id === tk.id); if (ex) ex.qty += tk.qty; else st.items.push({ uid: uid(), id: tk.id, qty: tk.qty }); }
  } else if (m.a === 'take') {
    const i = st.items.findIndex((x) => x.uid === m.uid); if (i < 0) return;
    const it = st.items[i];
    if (it.type === 'equip') { if (!I.addEquip(c, it)) return err(p, 'กระเป๋าเต็ม'); st.items.splice(i, 1); }
    else { const q = Math.max(1, Math.min(it.qty, m.qty | 0 || it.qty)); if (!I.addItem(c, it.id, q)) return err(p, 'กระเป๋าเต็ม'); it.qty -= q; if (it.qty <= 0) st.items.splice(i, 1); }
  } else if (m.a === 'putZ') { const z = Math.max(0, Math.min(c.zeny, m.z | 0)); c.zeny -= z; st.zeny += z; }
  else if (m.a === 'takeZ') { const z = Math.max(0, Math.min(st.zeny, m.z | 0)); st.zeny -= z; c.zeny += z; }
  else if (m.a === 'putAll') { // deposit all materials/runes/jewels
    for (const it of [...c.inv]) { const d = D.ITEMS[it.id]; if (d && ['mat', 'loot', 'rune', 'jewel', 'currency'].includes(d.type)) E.storage(p, { a: 'put', uid: it.uid, qty: it.qty }); }
  }
  db.dirty = true;
  E.storageSend(p); sync(p, ['inv', 'zeny']);
};

// ------------------------------------------------------------------ mail
E.unread = (c) => (data().mail[c.id] || []).filter((m) => !m.read || ((m.items || []).length || m.zeny) && !m.claimed).length;
P.unread = E.unread;
E.mailSystem = function (charId, subj, body, items, zeny, from = 'ระบบ') {
  const box = data().mail[charId] || (data().mail[charId] = []);
  box.unshift({ id: 'm' + db.nextId(), from, subj, body, items: items || [], zeny: zeny || 0, at: Date.now(), read: 0, claimed: 0 });
  if (box.length > 100) box.length = 100;
  db.dirty = true;
  const q = W.players.get(charId); if (q) { note(q, `✉ จดหมายใหม่จาก ${from}: ${subj}`); sync(q, ['unread']); }
};
P.mailSystem = E.mailSystem;
E.mailList = (p) => send(p, { t: 'mail', list: data().mail[p.char.id] || [] });
E.mail = function (p, m) {
  const c = p.char; const box = data().mail[c.id] || (data().mail[c.id] = []);
  if (m.a === 'list') return E.mailList(p);
  if (m.a === 'read') { const ml = box.find((x) => x.id === m.id); if (ml) ml.read = 1; }
  else if (m.a === 'claim') {
    const ml = box.find((x) => x.id === m.id); if (!ml || ml.claimed) return;
    for (const it of ml.items) { const ok = it.type === 'equip' ? I.addEquip(c, it) : I.addItem(c, it.id, it.qty); if (!ok) return err(p, 'กระเป๋าเต็ม'); }
    c.zeny += ml.zeny || 0; ml.claimed = 1; ml.read = 1; ml.items = []; ml.zeny = 0;
  } else if (m.a === 'claimAll') { for (const ml of box) if (!ml.claimed && (ml.items.length || ml.zeny)) E.mail(p, { a: 'claim', id: ml.id }); }
  else if (m.a === 'del') { const i = box.findIndex((x) => x.id === m.id); if (i >= 0 && (box[i].claimed || !box[i].items.length && !box[i].zeny)) box.splice(i, 1); }
  else if (m.a === 'send') {
    const to = db.charByName(m.to); if (!to) return err(p, 'ไม่พบผู้รับ');
    if (to.id === c.id) return err(p, 'ส่งให้ตัวเองไม่ได้');
    const uids = (Array.isArray(m.uids) ? m.uids : []).slice(0, 5);
    const z = Math.max(0, m.zeny | 0); const fee = 100 + uids.length * 200;
    if (c.zeny < z + fee) return err(p, `Zeny ไม่พอ (ค่าส่ง ${fee})`);
    const items = [];
    for (const u of uids) { const it = I.find(c, u); if (!it) continue; const d = D.ITEMS[it.id]; if (d && d.type === 'currency') continue; items.push(I.removeUid(c, u)); }
    c.zeny -= z + fee;
    E.mailSystem(to.id, String(m.subj || 'ไม่มีหัวข้อ').slice(0, 40), String(m.body || '').slice(0, 300), items, z, c.name);
    note(p, `ส่งจดหมายถึง ${to.name} แล้ว`);
  }
  db.dirty = true;
  E.mailList(p); sync(p, ['inv', 'zeny', 'unread']);
};

// ------------------------------------------------------------------ auction house
const AH_FEE = 0.02, AH_TAX = 0.05, AH_HOURS = 48, AH_MAX = 20;
function ahView(a) { return { id: a.id, seller: a.sellerName, item: a.item, price: a.price, left: Math.max(0, Math.round((a.expires - Date.now()) / 60000)) }; }
E.ah = function (p, m) {
  const c = p.char; const ah = data().auction;
  if (m.a === 'search') {
    const q = String(m.q || '').toLowerCase();
    let list = ah.filter((a) => {
      const it = a.item; const d = it.type === 'equip' ? null : D.ITEMS[it.id];
      const name = (it.type === 'equip' ? it.name : d ? d.n : '').toLowerCase();
      if (q && !name.includes(q)) return false;
      if (m.cat === 'equip' && it.type !== 'equip') return false;
      if (m.cat === 'weapon' && it.slot !== 'weapon') return false;
      if (m.cat === 'armor' && (it.type !== 'equip' || it.slot === 'weapon' || ['necklace', 'earring', 'ring'].includes(it.slot))) return false;
      if (m.cat === 'acc' && !(it.type === 'equip' && ['necklace', 'earring', 'ring'].includes(it.slot))) return false;
      if (m.cat === 'rune' && !(d && (d.type === 'rune' || d.type === 'jewel'))) return false;
      if (m.cat === 'mat' && !(d && ['mat', 'loot', 'potion', 'buffitem', 'pet', 'mount', 'petfood', 'scroll'].includes(d.type))) return false;
      if (m.rar !== undefined && m.rar !== '' && it.type === 'equip' && it.rarity < +m.rar) return false;
      if (m.minRef && it.type === 'equip' && (it.refine || 0) < +m.minRef) return false;
      return true;
    });
    const unit = (a) => a.price / (a.item.qty || 1);
    list.sort(m.sort === 'new' ? (a, b) => b.at - a.at : m.sort === 'high' ? (a, b) => unit(b) - unit(a) : (a, b) => unit(a) - unit(b));
    return send(p, { t: 'ah', list: list.slice(0, 80).map(ahView), total: list.length, mine: ah.filter((a) => a.seller === c.id).map(ahView) });
  }
  if (!inTown(p)) return err(p, 'ใช้ตลาดประมูลได้ในเมือง (Broker Selene)');
  if (m.a === 'sell') {
    const it = I.find(c, m.uid); if (!it) return err(p, 'ไม่พบไอเทม');
    const d = D.ITEMS[it.id]; if (d && d.type === 'currency') return err(p, 'ไอเทมนี้ขายไม่ได้');
    const price = Math.max(1, Math.min(2e9, Math.floor(+m.price || 0)));
    if (ah.filter((a) => a.seller === c.id).length >= AH_MAX) return err(p, `วางขายได้สูงสุด ${AH_MAX} รายการ`);
    const fee = Math.max(10, Math.floor(price * AH_FEE));
    if (c.zeny < fee) return err(p, `ค่าวางขาย ${fee} Zeny`);
    const q = it.type === 'equip' ? undefined : Math.max(1, Math.min(it.qty, m.qty | 0 || it.qty));
    c.zeny -= fee;
    const item = I.removeUid(c, m.uid, q); if (item.type !== 'equip') item.uid = uid();
    ah.push({ id: 'a' + db.nextId(), seller: c.id, sellerName: c.name, item, price, at: Date.now(), expires: Date.now() + AH_HOURS * 3600e3 });
    note(p, `วางขาย ${I.itemName(item)} ×${item.qty || 1} ราคา ${price.toLocaleString()} Zeny (ค่าธรรมเนียม ${fee})`);
  } else if (m.a === 'buy') {
    const i = ah.findIndex((a) => a.id === m.id); if (i < 0) return err(p, 'รายการนี้ถูกซื้อไปแล้ว');
    const a = ah[i];
    if (a.seller === c.id) return err(p, 'ซื้อของตัวเองไม่ได้');
    if (c.zeny < a.price) return err(p, 'Zeny ไม่พอ');
    const ok = a.item.type === 'equip' ? I.addEquip(c, a.item) : I.addItem(c, a.item.id, a.item.qty);
    if (!ok) return err(p, 'กระเป๋าเต็ม');
    c.zeny -= a.price; ah.splice(i, 1);
    const got = Math.floor(a.price * (1 - AH_TAX));
    E.mailSystem(a.seller, `ขายได้: ${I.itemName(a.item)}`, `ผู้ซื้อ ${c.name} · ราคา ${a.price.toLocaleString()} หักภาษี 5%`, [], got, 'ตลาดประมูล');
    const sp = W.players.get(a.seller); if (sp) P.event(sp, 'sell'); else { const sc = db.data.chars[a.seller]; if (sc) { sc.cnt = sc.cnt || {}; sc.cnt.sold = (sc.cnt.sold || 0) + 1; } }
    note(p, `ซื้อ ${I.itemName(a.item)} สำเร็จ`);
  } else if (m.a === 'cancel') {
    const i = ah.findIndex((a) => a.id === m.id && a.seller === c.id); if (i < 0) return;
    const a = ah.splice(i, 1)[0];
    E.mailSystem(c.id, `ยกเลิกการขาย: ${I.itemName(a.item)}`, '', [a.item], 0, 'ตลาดประมูล');
  }
  db.dirty = true;
  sync(p, ['inv', 'zeny']);
  E.ah(p, { a: 'search', q: m.q, cat: m.cat, sort: m.sort });
};
E.ahExpire = function () {
  const ah = data().auction; const t = Date.now();
  for (let i = ah.length - 1; i >= 0; i--) if (ah[i].expires < t) { const a = ah.splice(i, 1)[0]; E.mailSystem(a.seller, `หมดเวลาขาย: ${I.itemName(a.item)}`, 'ไอเทมถูกส่งคืน', [a.item], 0, 'ตลาดประมูล'); }
};

// ------------------------------------------------------------------ player trade
const trades = new Map(); let tradeSeq = 1;
function tradeOf(p) { return p.trade && trades.get(p.trade); }
function tradeSync(tr) {
  for (const [me, other] of [[tr.a, tr.b], [tr.b, tr.a]]) {
    const view = (q) => ({ name: q.name, items: tr.offer[q.char.id].uids.map((u) => I.find(q.char, u)).filter(Boolean), zeny: tr.offer[q.char.id].zeny, lock: tr.offer[q.char.id].lock, ok: tr.offer[q.char.id].ok });
    send(me, { t: 'trade', id: tr.id, me: view(me), them: view(other) });
  }
}
function tradeEnd(tr, why) {
  trades.delete(tr.id);
  for (const q of [tr.a, tr.b]) { q.trade = null; send(q, { t: 'trade', closed: 1, why }); }
}
E.trade = function (p, m) {
  if (m.a === 'request') {
    const q = W.findPlayerByName(m.name);
    if (!q || q === p) return err(p, 'ไม่พบผู้เล่น');
    if (q.inst !== p.inst || W.dist(p, q) > 12) return err(p, 'ต้องอยู่ใกล้กัน (12 ช่อง)');
    if (q.trade || p.trade) return err(p, 'ผู้เล่นกำลังเทรดอยู่');
    q.invites = q.invites || {}; q.invites['trade' + p.id] = Date.now() / 1000 + 30;
    send(q, { t: 'invite', kind: 'trade', id: p.id, from: p.name });
    return note(p, `ส่งคำขอเทรดถึง ${q.name}`);
  }
  if (m.a === 'accept') {
    const q = p.inst.entities.get(m.id);
    if (!q || q.kind !== 'p' || !p.invites || !(p.invites['trade' + q.id] > Date.now() / 1000)) return err(p, 'คำขอหมดอายุ');
    if (q.trade || p.trade) return err(p, 'กำลังเทรดอยู่');
    const tr = { id: tradeSeq++, a: q, b: p, offer: { [q.char.id]: { uids: [], zeny: 0, lock: 0, ok: 0 }, [p.char.id]: { uids: [], zeny: 0, lock: 0, ok: 0 } } };
    trades.set(tr.id, tr); p.trade = q.trade = tr.id;
    return tradeSync(tr);
  }
  const tr = tradeOf(p); if (!tr) return;
  const mine = tr.offer[p.char.id];
  const reset = () => { for (const k in tr.offer) { tr.offer[k].lock = 0; tr.offer[k].ok = 0; } };
  if (m.a === 'cancel') return tradeEnd(tr, `${p.name} ยกเลิกการเทรด`);
  if (m.a === 'add') {
    if (mine.lock) return; const it = I.find(p.char, m.uid); if (!it) return;
    const d = D.ITEMS[it.id]; if (d && d.type === 'currency') return err(p, 'ไอเทมนี้เทรดไม่ได้');
    if (mine.uids.length >= 10 || mine.uids.includes(m.uid)) return;
    mine.uids.push(m.uid); reset();
  } else if (m.a === 'remove') { if (mine.lock) return; mine.uids = mine.uids.filter((u) => u !== m.uid); reset(); }
  else if (m.a === 'zeny') { if (mine.lock) return; mine.zeny = Math.max(0, Math.min(p.char.zeny, m.z | 0)); reset(); }
  else if (m.a === 'lock') mine.lock = 1;
  else if (m.a === 'ok') {
    if (!Object.values(tr.offer).every((o) => o.lock)) return err(p, 'ทั้งสองฝ่ายต้องล็อกก่อน');
    mine.ok = 1;
    if (Object.values(tr.offer).every((o) => o.ok)) return execTrade(tr);
  }
  tradeSync(tr);
};
function execTrade(tr) {
  const A = tr.a, B = tr.b;
  if (A.inst !== B.inst || W.dist(A, B) > 14) return tradeEnd(tr, 'อยู่ไกลกันเกินไป');
  const oa = tr.offer[A.char.id], ob = tr.offer[B.char.id];
  const ia = oa.uids.map((u) => I.find(A.char, u)), ib = ob.uids.map((u) => I.find(B.char, u));
  if (ia.includes(undefined) || ib.includes(undefined) || A.char.zeny < oa.zeny || B.char.zeny < ob.zeny) return tradeEnd(tr, 'ไอเทม/Zeny เปลี่ยนแปลง — ยกเลิก');
  if (A.char.inv.length - ia.length + ib.length > 150 || B.char.inv.length - ib.length + ia.length > 150) return tradeEnd(tr, 'กระเป๋าเต็ม');
  for (const u of oa.uids) { const it = I.removeUid(A.char, u); if (it.type === 'equip') I.addEquip(B.char, it); else I.addItem(B.char, it.id, it.qty); }
  for (const u of ob.uids) { const it = I.removeUid(B.char, u); if (it.type === 'equip') I.addEquip(A.char, it); else I.addItem(A.char, it.id, it.qty); }
  A.char.zeny += ob.zeny - oa.zeny; B.char.zeny += oa.zeny - ob.zeny;
  db.dirty = true;
  require('fs').appendFile(require('path').join(process.env.NO_DATA_DIR || require('path').join(__dirname, '..', 'data'), 'trade.log'), `${new Date().toISOString()}\t${A.name}->${B.name}\t${ia.map(I.itemName).join(',')} +${oa.zeny}z\t<->\t${ib.map(I.itemName).join(',')} +${ob.zeny}z\n`, () => {});
  for (const q of [A, B]) { sync(q, ['inv', 'zeny']); note(q, 'เทรดสำเร็จ!', 'level'); }
  tradeEnd(tr, 'done');
}
E.onLogout = function (p) { const tr = tradeOf(p); if (tr) tradeEnd(tr, 'ผู้เล่นออฟไลน์'); };

// ------------------------------------------------------------------ crafting & shops
E.craft = function (p, idx, n) {
  const r = D.RECIPES[idx | 0]; if (!r) return;
  const c = p.char;
  if (c.lv < r.lv) return err(p, `ต้องเลเวล ${r.lv}`);
  n = Math.max(1, Math.min(50, n | 0));
  let made = 0;
  for (let k = 0; k < n; k++) {
    if (c.zeny < r.zeny || !r.req.every(([id, q]) => I.count(c, id) >= q)) break;
    if (r.out.startsWith('gear:') && c.inv.length >= (c.invMax || 120)) break;
    for (const [id, q] of r.req) I.consume(c, id, q);
    c.zeny -= r.zeny;
    if (r.out.startsWith('gear:')) {
      const g = F.genFromBase(rng, r.out.slice(5), r.rar, r.ilv); g.uid = 'u' + db.nextId(); g.src = 'Crafted';
      I.addEquip(c, g);
      S.broadcast({ t: 'notice', k: 'loot', m: `⚒ ${c.name} คราฟต์ [${D.RARITY[g.rarity].n}] ${g.name} สำเร็จ!` });
    } else I.addItem(c, r.out, r.q);
    made++;
  }
  if (!made) return err(p, 'วัตถุดิบหรือ Zeny ไม่พอ');
  note(p, `⚗ คราฟต์ ${r.out.startsWith('gear:') ? D.GEAR[r.out.slice(5)].n : D.ITEMS[r.out].n} ×${r.q * made} สำเร็จ`);
  P.event(p, 'craft', { n: made });
  sync(p, ['inv', 'zeny']);
};
E.tokenBuy = function (p, idx) {
  const row = D.TOKEN_SHOP[idx | 0]; if (!row) return;
  const [id, cost, cur] = row; const c = p.char;
  if (!I.consume(c, cur, cost)) return err(p, `ต้องใช้ ${D.ITEMS[cur].n} ×${cost}`);
  I.addItem(c, id, 1); note(p, `แลก ${D.ITEMS[id].n} สำเร็จ`); sync(p, ['inv']);
};
E.stableBuy = function (p, id) {
  if (!inTown(p)) return err(p, 'ซื้อได้ที่ Tamer Rook ในเมือง');
  if (!D.STABLE.includes(id)) return;
  const d = D.ITEMS[id]; const c = p.char;
  if (c.lv < (d.lv || 1)) return err(p, `ต้องเลเวล ${d.lv}`);
  const qty = d.type === 'petfood' ? 10 : 1;
  if (c.zeny < d.price * qty) return err(p, 'Zeny ไม่พอ');
  if (!I.addItem(c, id, qty)) return err(p, 'กระเป๋าเต็ม');
  c.zeny -= d.price * qty; note(p, `ซื้อ ${d.n} ×${qty}`); sync(p, ['inv', 'zeny']);
};

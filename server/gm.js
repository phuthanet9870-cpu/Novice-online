// GM commands (@command) with 5 permission levels and an audit log.
const D = require('../shared/data.js');
const F = require('../shared/formulas.js');
const M = require('../shared/mapgen.js');
const RNG = require('../shared/rng.js');
const { SKILLS, CLASS_SKILLS } = require('../shared/skills.js');
const db = require('./db');
const W = require('./world');
const C = require('./combat');
const I = require('./items');
const S = require('./social');
const A = require('./auto');

const G = module.exports;
const r = RNG.rng(Date.now() & 0xfffffff);
const allMaps = () => [...D.TOWNS.map((t) => t.id), ...D.FARM_MAPS.map((f) => f.id), ...Object.keys(D.SPECIAL_MAPS), ...D.CASTLES.map((c) => c.id)];
const target = (p, name) => (name ? W.findPlayerByName(name) : p);
const need = (q, name) => { if (!q) throw new Error(`ไม่พบผู้เล่น "${name}" (ต้องออนไลน์)`); return q; };
const sync = (q) => { C.recalc(q); q.sess && q.sess.send({ t: 'char', ...C.charPayload(q) }); };

// [minLevel, usage, description, handler(p, args) -> string]
const CMDS = {
  help: [1, '@help [cmd]', 'แสดงคำสั่ง GM', (p, a) => {
    if (a[0] && CMDS[a[0]]) return `${CMDS[a[0]][1]} — ${CMDS[a[0]][2]} (Lv${CMDS[a[0]][0]})`;
    return Object.entries(CMDS).filter(([, c]) => c[0] <= p.gm).map(([k, c]) => `${c[1]} — ${c[2]}`).join('\n');
  }],
  who: [1, '@who', 'รายชื่อผู้เล่นออนไลน์', () => [...W.players.values()].map((q) => `${q.name} Lv${q.lv} ${D.CLASSES[q.cls].name} @${q.inst ? q.inst.mapId : '-'}${q.sess ? '' : ' (offline-auto)'}`).join('\n') || 'ไม่มี'],
  where: [1, '@where [player]', 'ดูตำแหน่ง', (p, a) => { const q = need(target(p, a[0]), a[0]); return `${q.name}: ${q.inst.mapId} (${q.x.toFixed(1)}, ${q.y.toFixed(1)})`; }],
  warp: [1, '@warp <map> [x y]', 'วาร์ปตัวเอง (map id หรือ dg:<type>:<floor>)', (p, a) => {
    const id = a[0]; if (!id) return 'maps: ' + allMaps().join(', ');
    const inst = id.startsWith('dg:') ? id + '#gm' + p.char.id : id;
    if (!M.getMapDef(id)) return 'ไม่พบแผนที่';
    W.enterMap(p, inst, a[1] !== undefined ? +a[1] : undefined, a[2] !== undefined ? +a[2] : undefined); return 'warped → ' + id;
  }],
  goto: [1, '@goto <player>', 'ไปหาผู้เล่น', (p, a) => { const q = need(target(p, a[0]), a[0]); W.enterMap(p, q.inst.id, q.x, q.y); return 'ok'; }],
  recall: [2, '@recall <player>', 'ดึงผู้เล่นมาหา', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); W.enterMap(q, p.inst.id, p.x, p.y); return 'ok'; }],
  recallall: [3, '@recallall', 'ดึงทุกคนมาหา', (p) => { let n = 0; for (const q of W.players.values()) if (q !== p) { W.enterMap(q, p.inst.id, p.x, p.y); n++; } return `recalled ${n}`; }],
  hide: [1, '@hide', 'ล่องหน (GM)', (p) => { p.hidden = !p.hidden; for (const q of p.inst.players) q.known.delete(p.id); return 'hide: ' + p.hidden; }],
  god: [2, '@god', 'อมตะ / ไม่ใช้ SP / ไม่มีคูลดาวน์เกจ', (p) => { p.god = !p.god; return 'god: ' + p.god; }],
  speed: [1, '@speed <1-10>', 'ความเร็วเดิน', (p, a) => { p.speedMul = Math.max(0.5, Math.min(10, +a[0] || 1)); return 'speed ×' + p.speedMul; }],
  heal: [1, '@heal [player]', 'ฮีลเต็ม', (p, a) => { const q = need(target(p, a[0]), a[0]); q.hp = q.maxHp; q.sp = q.maxSp; q.ult = 100; q.tags.clear(); return 'healed ' + q.name; }],
  revive: [2, '@revive <player>', 'ชุบชีวิต', (p, a) => { const q = need(target(p, a[0]), a[0]); if (q.dead) { q.dead = false; q.hp = q.maxHp; } return 'revived'; }],
  kill: [3, '@kill <player>', 'ฆ่าผู้เล่น', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); C.onDeath(q, p); return 'killed'; }],
  info: [1, '@info <player>', 'ข้อมูลผู้เล่น', (p, a) => {
    const name = a[0] || p.name; const q = W.findPlayerByName(name); const ch = q ? q.char : db.charByName(name); if (!ch) return 'ไม่พบ';
    return `${ch.name} [${ch.id}] acc=${ch.acc} ${D.CLASSES[ch.cls].name} Lv${ch.lv} exp=${ch.exp} zeny=${ch.zeny}\nstats=${JSON.stringify(ch.stats)} pts=${ch.statPts}/${ch.skillPts}\nskills=${Object.keys(ch.skills).length} inv=${ch.inv.length} guild=${ch.guild || '-'} kills=${ch.kills || 0} pvp=${ch.pvpKills || 0}${q ? `\nip=${q.sess ? q.sess.ip : 'offline'} map=${q.inst.mapId}` : ''}`;
  }],
  lvup: [3, '@lvup <n> [player]', 'เพิ่มเลเวล', (p, a) => { const q = need(target(p, a[1]), a[1]); const n = Math.max(1, +a[0] || 1); for (let i = 0; i < n && q.char.lv < D.MAX_LEVEL; i++) I.gainExp(q, F.expToNext(q.char.lv) - q.char.exp + 1); sync(q); return `${q.name} → Lv${q.char.lv}`; }],
  setlv: [4, '@setlv <lv> [player]', 'ตั้งเลเวล (คำนวณแต้มใหม่)', (p, a) => {
    const q = need(target(p, a[1]), a[1]); const lv = Math.max(1, Math.min(D.MAX_LEVEL, +a[0] || 1)); const ch = q.char;
    ch.lv = lv; q.lv = lv; ch.exp = 0; ch.stats = Object.assign({}, D.CLASSES[ch.cls].start); ch.statPts = 5 + F.statPointsAt(lv);
    ch.skills = {}; ch.skills[CLASS_SKILLS[ch.cls][0]] = 1; ch.skillPts = F.skillPointsAt(lv) - 1; sync(q); return `${q.name} Lv${lv} (สเตตัส/สกิลรีเซ็ต)`;
  }],
  stat: [4, '@stat <str|agi|vit|int|dex|luk> <n> [player]', 'ตั้งค่าสเตตัส', (p, a) => { const q = need(target(p, a[2]), a[2]); if (!D.STATS.includes(a[0])) return 'stat ผิด'; q.char.stats[a[0]] = Math.max(1, Math.min(F.STAT_MAX, +a[1] || 1)); sync(q); return 'ok'; }],
  statpoint: [3, '@statpoint <n> [player]', 'เพิ่มแต้มสเตตัส', (p, a) => { const q = need(target(p, a[1]), a[1]); q.char.statPts += +a[0] || 0; sync(q); return 'ok'; }],
  skillpoint: [3, '@skillpoint <n> [player]', 'เพิ่มแต้มสกิล', (p, a) => { const q = need(target(p, a[1]), a[1]); q.char.skillPts += +a[0] || 0; sync(q); return 'ok'; }],
  allskills: [4, '@allskills [player]', 'เรียนทุกสกิลระดับสูงสุด', (p, a) => { const q = need(target(p, a[0]), a[0]); for (const id of CLASS_SKILLS[q.cls]) q.char.skills[id] = SKILLS[id].maxLv; sync(q); return '50 skills maxed'; }],
  resetskill: [3, '@resetskill [player]', 'รีเซ็ตสกิล (ฟรี)', (p, a) => { const q = need(target(p, a[0]), a[0]); const ch = q.char; ch.skills = {}; ch.skills[CLASS_SKILLS[ch.cls][0]] = 1; ch.skillPts = F.skillPointsAt(ch.lv) - 1; sync(q); return 'ok'; }],
  zeny: [3, '@zeny <n> [player]', 'เพิ่ม/ลด Zeny', (p, a) => { const q = need(target(p, a[1]), a[1]); q.char.zeny = Math.max(0, q.char.zeny + (+a[0] || 0)); sync(q); return `${q.name}: ${q.char.zeny.toLocaleString()} Zeny`; }],
  item: [3, '@item <id> [qty] [player]', 'สร้างไอเทม (ดูรายการ: @itemlist)', (p, a) => { const q = need(target(p, a[2]), a[2]); if (!D.ITEMS[a[0]]) return 'ไม่พบไอเทม id'; I.addItem(q.char, a[0], Math.max(1, +a[1] || 1)); sync(q); return 'ok'; }],
  itemlist: [1, '@itemlist [filter]', 'รายการ id ไอเทม', (p, a) => Object.keys(D.ITEMS).filter((k) => !a[0] || k.includes(a[0])).join(', ')],
  gear: [3, '@gear <slot> <ilv> <rarity0-5> [+refine] [player]', 'สร้างอุปกรณ์ (slot: weapon/offhand/head/armor/cloak/boots/necklace/earring/ring1)', (p, a) => {
    const slots = [...D.SLOTS.filter((s) => s !== 'ring2')];
    if (!slots.includes(a[0])) return 'slot: ' + slots.join('/');
    const ref = a[3] && a[3].startsWith('+') ? +a[3].slice(1) : 0; const q = need(target(p, ref ? a[4] : a[3]), ref ? a[4] : a[3]);
    const it = F.genEquip(r, a[0], Math.max(1, +a[1] || q.lv), Math.max(0, Math.min(5, +a[2] || 0)), D.CLASSES[q.cls].weapon); it.refine = Math.min(20, ref);
    I.addEquip(q.char, it); sync(q); return `${it.name} +${it.refine}`;
  }],
  refine: [4, '@refine <slot> <+n> [player]', 'ตั้งระดับตีบวกของที่สวม', (p, a) => { const q = need(target(p, a[2]), a[2]); const it = q.char.equip[a[0]]; if (!it) return 'ไม่มีของในช่องนั้น'; it.refine = Math.max(0, Math.min(20, +String(a[1]).replace('+', '') || 0)); sync(q); return 'ok'; }],
  delitem: [3, '@delitem <id> <qty> <player>', 'ลบไอเทม', (p, a) => { const q = need(target(p, a[2]), a[2]); I.consume(q.char, a[0], Math.min(I.count(q.char, a[0]), +a[1] || 1)); sync(q); return 'ok'; }],
  mailall: [4, '@mailall <id> <qty> [ข้อความ]', 'แจกไอเทมทุกคนที่ออนไลน์', (p, a) => { if (!D.ITEMS[a[0]]) return 'id ผิด'; let n = 0; for (const q of W.players.values()) { I.addItem(q.char, a[0], +a[1] || 1); sync(q); n++; } S.announce(`🎁 ของขวัญจาก GM: ${D.ITEMS[a[0]].n} x${+a[1] || 1} ${a.slice(2).join(' ')}`, 'event'); return `ส่งให้ ${n} คน`; }],
  spawn: [2, '@spawn <ชื่อมอน|family> [n] [lv] [elite]', 'เรียกมอนสเตอร์', (p, a) => {
    const name = (a[0] || '').toLowerCase(); let fam = null;
    for (const b in D.FAMILIES) for (const f of D.FAMILIES[b]) if (f[0].toLowerCase().replace(/ /g, '') === name.replace(/_/g, '')) fam = f;
    if (!fam) return 'families: ' + [...new Set(Object.values(D.FAMILIES).flat().map((f) => f[0].replace(/ /g, '')))].join(', ');
    const n = Math.min(100, +a[1] || 1), lv = Math.max(1, Math.min(320, +a[2] || p.lv));
    for (let i = 0; i < n; i++) { const pos = M.randomWalkable(p.inst.map, r, p, 5); W.spawnMonster(p.inst, { fam, lv, rank: a[3] ? 1 : 0, x: pos.x, y: pos.y, extra: { noRespawn: true } }); }
    return `spawned ${n}× ${fam[0]} Lv${lv}`;
  }],
  spawnboss: [2, '@spawnboss [lv]', 'เรียกบอสที่ตำแหน่งตัวเอง', (p, a) => { const fams = D.FAMILIES[p.inst.def.biome] || D.FAMILIES.ruins; const fam = r.pick(fams); const m = W.spawnMonster(p.inst, { fam, lv: +a[0] || p.lv, rank: 2, x: p.x + 3, y: p.y, name: fam[0] + ' ' + r.pick(D.BOSS_TITLES), extra: { noRespawn: true } }); return 'boss ' + m.name; }],
  worldboss: [3, '@worldboss start [0-3] | stop', 'ควบคุม World Boss', (p, a) => {
    if (a[0] === 'stop') { if (S.wb.alive) { S.wb.alive.inst.remove(S.wb.alive); S.wb.alive = null; } return 'stopped'; }
    return S.spawnWorldBoss(a[1] !== undefined ? +a[1] : undefined) ? 'world boss spawned at wb_arena' : 'มี World Boss อยู่แล้ว';
  }],
  killall: [2, '@killall', 'ฆ่ามอนทั้งแผนที่', (p) => { let n = 0; for (const e of [...p.inst.entities.values()]) if (e.kind === 'm' && !e.dead) { C.onDeath(e, p); n++; } return `killed ${n}`; }],
  bosstimer: [2, '@bosstimer [map] [sec]', 'ดู/ตั้งเวลาเกิด Field Boss', (p, a) => {
    if (a[0] && a[1] !== undefined) { const st = S.fieldBoss[a[0]] || (S.fieldBoss[a[0]] = { alive: null }); st.nextAt = Date.now() / 1000 + (+a[1] || 0); W.getInstance(a[0]); return 'ok'; }
    return Object.entries(S.fieldBoss).map(([k, v]) => `${k}: ${v.alive ? 'ALIVE' : Math.max(0, Math.round(v.nextAt - Date.now() / 1000)) + 's'}`).join('\n') || 'ยังไม่มีแผนที่ฟาร์มที่ถูกโหลด';
  }],
  announce: [1, '@announce <ข้อความ>', 'ประกาศทั้งเซิร์ฟ', (p, a) => { S.announce(`📢 [GM] ${a.join(' ')}`, 'gm'); return 'ok'; }],
  rate: [4, '@rate <exp|drop|refine> <x>', 'ตั้งเรทเซิร์ฟ', (p, a) => {
    if (!['exp', 'drop', 'refine'].includes(a[0])) return JSON.stringify(db.data.settings);
    db.data.settings[a[0]] = Math.max(0.1, Math.min(100, +a[1] || 1)); db.dirty = true;
    S.announce(`⚡ เรท ${a[0].toUpperCase()} ตอนนี้ ×${db.data.settings[a[0]]}`, 'event'); return JSON.stringify(db.data.settings);
  }],
  event: [2, '@event <start|stop> <doubleexp|doubledrop|refine>', 'อีเวนต์สำเร็จรูป', (p, a) => {
    const map = { doubleexp: 'exp', doubledrop: 'drop', refine: 'refine' }[a[1]]; if (!map) return 'events: doubleexp, doubledrop, refine';
    db.data.settings[map] = a[0] === 'start' ? (map === 'refine' ? 1.5 : 2) : 1; db.dirty = true;
    S.announce(a[0] === 'start' ? `🎉 อีเวนต์ ${a[1]} เริ่มแล้ว!` : `อีเวนต์ ${a[1]} จบแล้ว`, 'event'); return 'ok';
  }],
  gvg: [3, '@gvg <start [min]|stop|info>', 'ควบคุมกิลด์วอร์', (p, a) => { if (a[0] === 'start') { S.startGvg(+a[1] || 60); return 'started'; } if (a[0] === 'stop') { S.stopGvg(); return 'stopped'; } return JSON.stringify(S.gvg); }],
  castle: [4, '@castle setowner <castle_id> <guild name|none>', 'ตั้งเจ้าของปราสาท', (p, a) => {
    if (a[0] !== 'setowner' || !D.CASTLES.find((c) => c.id === a[1])) return 'castles: ' + D.CASTLES.map((c) => c.id).join(', ');
    const g = Object.values(db.data.guilds).find((x) => x.name.toLowerCase() === a.slice(2).join(' ').toLowerCase());
    db.data.castles[a[1]] = { owner: g ? g.id : null }; db.dirty = true; return 'owner → ' + (g ? g.name : 'none');
  }],
  pvp: [3, '@pvp <on|off|reset> [map]', 'เปิด/ปิด PvP แผนที่', (p, a) => { const id = a[1] || p.inst.mapId; const f = W.flags[id] = W.flags[id] || {}; if (a[0] === 'reset') delete f.pvp; else f.pvp = a[0] === 'on'; return `${id} pvp=${f.pvp}`; }],
  auto: [3, '@auto <on|off|reset> [map]', 'อนุญาต/ห้ามออโต้ในแผนที่', (p, a) => { const id = a[1] || p.inst.mapId; const f = W.flags[id] = W.flags[id] || {}; if (a[0] === 'reset') delete f.noAuto; else f.noAuto = a[0] === 'off'; for (const q of W.players.values()) if (q.inst && q.inst.mapId === id && f.noAuto && q.auto.on) A.setOn(q, false); return `${id} auto=${!f.noAuto}`; }],
  weather: [2, '@weather <none|rain|snow|ash|petals> [map]', 'สภาพอากาศ', (p, a) => { const id = a[1] || p.inst.mapId; (W.flags[id] = W.flags[id] || {}).weather = a[0] === 'none' ? '' : a[0]; for (const q of W.players.values()) if (q.inst && q.inst.mapId === id) q.sess && q.sess.send({ t: 'weather', w: W.flags[id].weather }); return 'ok'; }],
  reload: [5, '@reload', 'คอมไพล์สกิลจาก docs ใหม่ + โหลดใหม่ (ไม่ต้องรีสตาร์ท)', () => {
    require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, '..', 'tools', 'build-skills.js')]);
    const pth = require.resolve('../shared/skills.js'); delete require.cache[pth];
    const fresh = require('../shared/skills.js'); Object.assign(SKILLS, fresh.SKILLS); Object.assign(CLASS_SKILLS, fresh.CLASS_SKILLS);
    S.broadcast({ t: 'reloadSkills' }); return `reloaded ${Object.keys(SKILLS).length} skills`;
  }],
  save: [4, '@save', 'บันทึกฐานข้อมูลทันที', () => { G.saveAll(); return 'saved'; }],
  maintenance: [5, '@maintenance <min> [ข้อความ]', 'ประกาศปิดปรับปรุง แล้วปิดเซิร์ฟ', (p, a) => { const m = Math.max(1, +a[0] || 5); S.announce(`🛠 ปิดปรับปรุงในอีก ${m} นาที ${a.slice(1).join(' ')}`, 'gm'); setTimeout(() => G.shutdown(), m * 60000); return 'scheduled'; }],
  shutdown: [5, '@shutdown [sec]', 'ปิดเซิร์ฟ (บันทึกก่อน)', (p, a) => { const s = Math.max(0, +a[0] || 10); S.announce(`⛔ เซิร์ฟเวอร์จะปิดในอีก ${s} วินาที`, 'gm'); setTimeout(() => G.shutdown(), s * 1000); return 'ok'; }],
  mute: [3, '@mute <player> <min>', 'ห้ามแชท', (p, a) => { const ch = (W.findPlayerByName(a[0]) || {}).char || db.charByName(a[0]); if (!ch) return 'ไม่พบ'; ch.mutedUntil = Date.now() + (+a[1] || 10) * 60000; return 'muted'; }],
  unmute: [3, '@unmute <player>', 'ยกเลิกห้ามแชท', (p, a) => { const ch = (W.findPlayerByName(a[0]) || {}).char || db.charByName(a[0]); if (ch) ch.mutedUntil = 0; return 'ok'; }],
  kick: [3, '@kick <player>', 'เตะออกจากเกม', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); if (q.sess) q.sess.kick('ถูกเตะโดย GM'); else { G.persist(q); W.removePlayer(q); } return 'kicked'; }],
  jail: [3, '@jail <player> [min]', 'ส่งเข้าคุก', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); q.char.jailUntil = Date.now() + (+a[1] || 30) * 60000; W.enterMap(q, 'jail'); q.char.lastTown = 'jail'; return 'jailed'; }],
  unjail: [3, '@unjail <player>', 'ปล่อยจากคุก', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); q.char.jailUntil = 0; q.char.lastTown = 'aurelia'; W.enterMap(q, 'aurelia'); return 'ok'; }],
  ban: [3, '@ban <player> <days|perm> [เหตุผล]', 'แบนบัญชี (Lv3: ไม่เกิน 7 วัน)', (p, a) => {
    const ch = (W.findPlayerByName(a[0]) || {}).char || db.charByName(a[0]); if (!ch) return 'ไม่พบ';
    const acc = db.account(ch.acc); if (!acc) return 'ไม่พบบัญชี';
    if (acc.gm >= p.gm) return 'แบน GM ระดับเท่ากันหรือสูงกว่าไม่ได้';
    if (a[1] === 'perm' && p.gm < 4) return 'แบนถาวรต้อง GM Lv4+';
    const days = a[1] === 'perm' ? 36500 : Math.min(p.gm < 4 ? 7 : 3650, +a[1] || 1);
    acc.banned = Date.now() + days * 86400e3; acc.banReason = a.slice(2).join(' ');
    const q = W.findPlayerByName(a[0]); if (q && q.sess) q.sess.kick('บัญชีถูกแบน'); db.dirty = true; return `banned ${acc.user} ${a[1] === 'perm' ? 'permanently' : days + ' days'}`;
  }],
  unban: [3, '@unban <account>', 'ปลดแบน', (p, a) => { const acc = db.account(a[0]) || db.account((db.charByName(a[0]) || {}).acc); if (!acc) return 'ไม่พบ'; acc.banned = 0; db.dirty = true; return 'ok'; }],
  ipban: [4, '@ipban <ip|player>', 'แบน IP', (p, a) => { const q = W.findPlayerByName(a[0]); const ip = q && q.sess ? q.sess.ip : a[0]; db.data.ipBans.push(ip); if (q && q.sess) q.sess.kick('IP ถูกแบน'); db.dirty = true; return 'ip banned ' + ip; }],
  gmset: [5, '@gmset <account|player> <0-5>', 'ตั้งระดับ GM', (p, a) => { const acc = db.account(a[0]) || db.account((db.charByName(a[0]) || {}).acc); if (!acc) return 'ไม่พบ'; acc.gm = Math.max(0, Math.min(5, +a[1] || 0)); for (const q of W.players.values()) if (q.char.acc === acc.user.toLowerCase()) { q.gm = acc.gm; sync(q); } db.dirty = true; return `${acc.user} gm=${acc.gm}`; }],
  dungeon: [2, '@dungeon <type> <floor>', 'วาร์ปเข้าดันเจี้ยนชั้นใดก็ได้', (p, a) => { if (!D.DUNGEONS.find((d) => d.id === a[0])) return 'types: ' + D.DUNGEONS.map((d) => d.id).join(', '); S.enterDungeon(p, a[0], +a[1] || 1); return 'ok'; }],
  stairs: [2, '@stairs', 'เปิดบันไดดันเจี้ยนทันที', (p) => { const inst = p.inst; if (inst.def.kind !== 'dungeon') return 'ไม่ได้อยู่ในดันเจี้ยน'; inst.kills = inst.mobTotal; S.checkStairs(inst, { floorBoss: true }); return 'opened'; }],
  title: [3, '@title <player> <ข้อความ>', 'ตั้งฉายาเหนือหัว', (p, a) => { const q = need(W.findPlayerByName(a[0]), a[0]); q.title = a.slice(1).join(' ').slice(0, 24); for (const o of q.inst.players) o.known.delete(q.id); return 'ok'; }],
  audit: [5, '@audit [n]', 'ดู GM audit log ล่าสุด', (p, a) => { try { const lines = require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'gm_audit.log'), 'utf8').trim().split('\n'); return lines.slice(-(+a[0] || 15)).join('\n'); } catch (e) { return 'ว่าง'; } }]
};
G.CMDS = CMDS;
G.list = (lvl) => Object.entries(CMDS).filter(([, c]) => c[0] <= lvl).map(([k, c]) => ({ cmd: k, lv: c[0], usage: c[1], desc: c[2] }));

G.run = function (p, line) {
  const parts = line.trim().replace(/^[@/]/, '').split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  const cmd = CMDS[name];
  let out;
  if (!p.gm) out = 'คุณไม่มีสิทธิ์ GM';
  else if (!cmd) out = `ไม่รู้จักคำสั่ง @${name} — พิมพ์ @help`;
  else if (cmd[0] > p.gm) out = `ต้องเป็น GM Lv${cmd[0]} ขึ้นไป`;
  else { try { out = String(cmd[3](p, parts) ?? 'ok'); } catch (e) { out = 'ERROR: ' + e.message; } db.audit(`${p.acc}/${p.name}`, line, out); }
  p.sess && p.sess.send({ t: 'gm', m: out });
  return out;
};

// set by index.js
G.persist = () => {}; G.saveAll = () => {}; G.shutdown = () => process.exit(0);

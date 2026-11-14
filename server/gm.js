// GM commands (@command) with 5 permission levels and an audit log.
const D = require('../shared/data2.js');
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
  god: [2, '@god', 'อมตะ / ไม่ใช้ SP / ไม่ใช้เกจอัลติ (สลับ)', (p) => { p.god = !p.god; p.gmf = p.gmf || {}; p.gmf.god = p.god ? 1 : 0; p.char.gmf = Object.assign({}, p.gmf); sync(p); return 'god: ' + p.god; }],
  gmmode: [2, '@gmmode <god|nocd|nosp|nocast|onehit|peace|autoloot|dmg <x>|all|off>', 'โหมดตัวละคร GM (เฉพาะบัญชี GM เท่านั้น): อมตะ, ไม่มีคูลดาวน์, ไม่ใช้ SP/เกจ, ร่ายทันที, ตีทีเดียวตาย, มอนไม่โจมตี, ดาเมจ ×x', (p, a) => {
    const f = p.gmf || (p.gmf = {});
    const k = (a[0] || '').toLowerCase();
    const KEYS = ['god', 'nocd', 'nosp', 'nocast', 'onehit', 'peace', 'autoloot'];
    if (k === 'all') KEYS.forEach((x) => (f[x] = 1));
    else if (k === 'off') { for (const x of Object.keys(f)) delete f[x]; }
    else if (k === 'dmg') f.dmg = Math.max(0.1, Math.min(10000, +a[1] || 1));
    else if (KEYS.includes(k)) f[k] = f[k] ? 0 : 1;
    else return 'gmmode: ' + JSON.stringify(f);
    p.god = !!f.god; if (f.nocd) { p.cds = {}; p.sess && p.sess.send({ t: 'cdreset' }); }
    p.char.gmf = Object.assign({}, f);
    sync(p); return 'gmmode: ' + (Object.entries(f).filter(([, v]) => v).map(([x, v]) => (v === 1 ? x : x + '×' + v)).join(', ') || 'off');
  }],
  setclass: [3, '@setclass <class> [player]', 'เปลี่ยนคลาส (เลเวล/ไอเทมคงเดิม · สกิล, Hotbar, Passive รีเซ็ต · อาวุธที่ไม่ตรงคลาสย้ายเข้ากระเป๋าและได้อาวุธคลาสใหม่)', (p, a) => {
    const cls = (a[0] || '').toLowerCase();
    if (!D.CLASSES[cls]) return 'classes: ' + D.CLASS_IDS.join(', ');
    const q = need(target(p, a[1]), a[1]); const ch = q.char;
    if (ch.cls === cls) return `${q.name} เป็น ${D.CLASSES[cls].name} อยู่แล้ว`;
    for (const b of [...q.buffs.keys()]) q.buffs.delete(b);
    q.summons.forEach((s) => W.killQuiet(s)); q.summons = [];
    ch.cls = cls; q.cls = cls;
    const first = CLASS_SKILLS[cls][0];
    ch.skills = { [first]: 1 }; ch.skillPts = F.skillPointsAt(ch.lv) - 1;
    ch.hotbar = ch.hotbar.map((h) => (h && h.startsWith('item:') ? h : null)); I.defaultHotbar(ch);
    ch.passives = []; q.res = 0; q.cds = {}; q.combo = 0; q.ult = 0;
    if (ch.auto) { ch.auto.rotation = []; ch.auto.rotPve = []; ch.auto.rotPvp = []; }
    if (q.auto) { q.auto.rotation = []; q.auto.rotPve = []; q.auto.rotPvp = []; q.auto._plan = null; q.auto._planKey = null; }
    const w = ch.equip.weapon, wt = D.CLASSES[cls].weapon;
    if (w && w.wtype !== wt) {
      delete ch.equip.weapon; I.addEquip(ch, w);
      const nw = F.genEquip(r, 'weapon', Math.max(1, w.ilv || ch.lv), w.rarity || 0, wt); nw.uid = 'u' + db.nextId(); nw.refine = w.refine || 0; ch.equip.weapon = nw;
    }
    q.sess && q.sess.send({ t: 'cdreset' });
    W.enterMap(q, q.inst.id, q.x, q.y);
    sync(q); q.sess && q.sess.send({ t: 'char', ...C.charPayload(q) });
    return `${q.name} → ${D.CLASSES[cls].name} (Lv ${ch.lv}) — ใช้ @allskills เพื่อเรียนสกิลทั้งหมด`;
  }],
  book: [1, '@book <species_id>', 'ข้อมูล/ตารางดรอปของมอนสเตอร์ในสมุด', (p, a) => { const s = D.SPECIES[a[0]]; if (!s) return 'ตัวอย่าง id: ' + Object.keys(D.SPECIES).slice(0, 12).join(', '); return `${s.name} Lv${s.lv}-${s.lvMax} ${s.where}\n` + D.dropTable(a[0]).map(([id, c, q]) => `${id.startsWith('gear:') ? D.GEAR[id.slice(5)].n : D.ITEMS[id].n} ${c}%${q > 1 ? ' ×' + q : ''}`).join('\n'); }],
  spawnsp: [2, '@spawnsp <species_id> [n] [lv]', 'เรียกมอนตามสมุดมอนสเตอร์ (ดรอปตามตารางของสายพันธุ์นั้น)', (p, a) => {
    const s = D.SPECIES[a[0]]; if (!s) return 'ไม่พบ species';
    const n = Math.min(50, +a[1] || 1), lv = Math.max(1, Math.min(320, +a[2] || s.lv)), rk = s.rank || 0;
    for (let i = 0; i < n; i++) { const pos = M.randomWalkable(p.inst.map, r, p, 6); W.spawnMonster(p.inst, { fam: s.fam, lv, rank: rk, x: pos.x, y: pos.y, name: s.name, color: s.color, sp: s.id, extra: { noRespawn: true } }); }
    return `spawned ${n}× ${s.name} Lv${lv}`;
  }],
  gearb: [3, '@gearb <base_id> <rarity0-5> [ilv] [+refine] [player]', 'สร้างอุปกรณ์จากฐานไอเทมที่มีชื่อ (ดู @gearlist)', (p, a) => {
    const b = D.GEAR[a[0]]; if (!b) return 'ไม่พบ base';
    const q = need(target(p, a[4]), a[4]);
    const it = F.genFromBase(r, b.id, Math.max(0, Math.min(5, +a[1] || 0)), +a[2] || b.ilv || q.lv); it.refine = Math.min(20, +(String(a[3] || '0').replace('+', '')) || 0);
    I.addEquip(q.char, it); sync(q); return `${q.name} ← [${D.RARITY[it.rarity].n}] ${it.name}`;
  }],
  gearlist: [1, '@gearlist [filter]', 'รายการ base id อุปกรณ์', (p, a) => Object.keys(D.GEAR).filter((k) => !a[0] || k.includes(a[0]) || D.GEAR[k].n.toLowerCase().includes(a[0].toLowerCase())).slice(0, 120).join(', ')],
  pickupall: [2, '@pickupall', 'เก็บไอเทมบนพื้นทั้งแผนที่', (p) => { let n = 0; for (const e of [...p.inst.entities.values()]) if (e.kind === 'i' && !e.dead) { I.pickup(p, e.id, 'force'); n++; } return `picked ${n}`; }],
  clearground: [2, '@clearground', 'ลบไอเทมบนพื้นทั้งแผนที่', (p) => { let n = 0; for (const e of [...p.inst.entities.values()]) if (e.kind === 'i') { p.inst.remove(e); n++; } return `removed ${n}`; }],
  cdreset: [2, '@cdreset [player]', 'รีเซ็ตคูลดาวน์ทั้งหมด', (p, a) => { const q = need(target(p, a[0]), a[0]); q.cds = {}; q.sess && q.sess.send({ t: 'cdreset' }); return 'ok'; }],
  buffall: [3, '@buffall', 'บัฟทุกคนที่ออนไลน์ (ATK/MATK/DEF +20% 30 นาที)', () => { let n = 0; for (const q of W.players.values()) { C.addBuff(q, 'gm_bless', { atkPct: 20, matkPct: 20, defPct: 20 }, 1800, 'GM Blessing', '✨'); n++; } S.announce('✨ GM มอบพรให้ทุกคน (30 นาที)', 'gm'); return `buffed ${n}`; }],
  respawnmap: [2, '@respawnmap', 'เกิดมอนทุกตัวในแผนที่ใหม่ทันที', (p) => { const inst = p.inst; const q = inst.respawnQ || []; for (const x of q) x.at = 0; return `respawn ${q.length}`; }],
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
  stat: [4, '@stat <str|agi|vit|int|dex|luk> <n> [player]', 'ตั้งโบนัสสเตตัส (บวกเพิ่มจากค่าอัตโนมัติ)', (p, a) => { const q = need(target(p, a[2]), a[2]); if (!D.STATS.includes(a[0])) return 'stat ผิด'; q.char.statBonus = q.char.statBonus || {}; q.char.statBonus[a[0]] = +a[1] || 0; sync(q); return `${q.name} ${a[0]} bonus ${q.char.statBonus[a[0]]}`; }],
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
  worldboss: [3, '@worldboss start [0-' + (D.WORLD_BOSSES.length - 1) + '] | stop', 'ควบคุม World Boss', (p, a) => {
    if (a[0] === 'stop') { if (S.wb.alive) { S.wb.alive.inst.remove(S.wb.alive); S.wb.alive = null; } return 'stopped'; }
    return S.spawnWorldBoss(a[1] !== undefined ? +a[1] : undefined) ? 'world boss spawned at wb_arena' : 'มี World Boss อยู่แล้ว';
  }],
  bossart: [2, '@bossart <sprite|list> [lv]', 'เรียกบอสสไปรต์ใหม่ข้างตัว (ทดสอบ)', (p, a) => {
    const wbName = {}; for (const w of D.WORLD_BOSSES) { const k = D.BOSS_SPRITES.world[w.id]; if (k) wbName[k] = w.name; }
    const names = Object.assign({}, D.BOSS_NAMES, wbName), keys = Object.keys(names); if (!a[0] || a[0] === 'list' || !names[a[0]]) return keys.join(', ');
    const fams = D.FAMILIES[p.inst.def.biome] || D.FAMILIES.ruins;
    const m = W.spawnMonster(p.inst, { fam: fams[0], lv: +a[1] || p.lv, rank: 2, x: p.x + 3, y: p.y, name: names[a[0]], extra: { noRespawn: true, spr: a[0] } }); return 'boss ' + m.name;
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
    require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, '..', 'tools', 'build-skills5.js')]);
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
  pet: [3, '@pet <bunny|fox|owl|cat|turtle|wisp|drake> [lv]', 'ให้สัตว์เลี้ยง', (p, a) => { const P = require('./progress'); if (!D.PETS[a[0]]) return Object.keys(D.PETS).join(', '); P.init(p.char); let pet = p.char.pets.find((x) => x.id === a[0]); if (!pet) { pet = { id: a[0], lv: 1, exp: 0 }; p.char.pets.push(pet); } pet.lv = Math.max(1, Math.min(D.PET_MAX, +a[1] || pet.lv)); p.char.pet = pet; sync(p); P.refreshLook(p); return 'pet ' + a[0] + ' lv' + pet.lv; }],
  mount: [3, '@mount <pony|horse|wolf|griffin|dragon>', 'ให้พาหนะ', (p, a) => { if (!D.MOUNTS[a[0]]) return Object.keys(D.MOUNTS).join(', '); require('./progress').init(p.char); if (!p.char.mounts.includes(a[0])) p.char.mounts.push(a[0]); p.char.mount = a[0]; sync(p); return 'ok'; }],
  quest: [4, '@quest <index> [player]', 'ตั้งภารกิจหลัก (ข้ามไป)', (p, a) => { const q = need(target(p, a[1]), a[1]); require('./progress').init(q.char); q.char.quests.main = Math.max(0, Math.min(D.MAIN_QUESTS.length, +a[0] || 0)); q.char.quests.prog = 0; sync(q); return 'main quest → ' + q.char.quests.main; }],
  mmr: [4, '@mmr <n> [player]', 'ตั้ง MMR จัดอันดับ', (p, a) => { const q = need(target(p, a[1]), a[1]); q.char.mmr = +a[0] || 1000; sync(q); return 'mmr ' + q.char.mmr; }],
  karma: [3, '@karma <n> [player]', 'ตั้ง Karma (ชื่อแดง)', (p, a) => { const q = need(target(p, a[1]), a[1]); q.char.karma = Math.max(0, +a[0] || 0); require('./progress').refreshLook(q); return 'karma ' + q.char.karma; }],
  sendmail: [3, '@sendmail <player> <item_id> <qty> [ข้อความ]', 'ส่งไอเทมทางจดหมาย (ผู้เล่นออฟไลน์ได้)', (p, a) => { const ch = db.charByName(a[0]); if (!ch) return 'ไม่พบ'; if (!D.ITEMS[a[1]]) return 'id ผิด'; require('./econ').mailSystem(ch.id, 'ของขวัญจาก GM', a.slice(3).join(' '), [{ id: a[1], qty: +a[2] || 1, uid: 'u' + db.nextId() }], 0, 'GM'); return 'sent'; }],
  guildlv: [4, '@guildlv <lv>', 'ตั้งเลเวลกิลด์ของตัวเอง', (p, a) => { const g = db.data.guilds[p.char.guild]; if (!g) return 'ไม่มีกิลด์'; g.lv = Math.max(1, Math.min(D.GUILD_MAX_LV, +a[0] || 1)); g.exp = 0; db.dirty = true; sync(p); return 'guild lv ' + g.lv; }],
  achieve: [4, '@achieve [player]', 'ตรวจความสำเร็จใหม่', (p, a) => { const q = need(target(p, a[0]), a[0]); require('./progress').checkAch(q); return 'checked'; }],
  passive: [3, '@passive <points N|reset|all> [player]', 'แต้ม/รีเซ็ต Passive Tree (all = เลือกทุกโหนดที่ต่อถึงได้ตามแต้ม)', (p, a) => {
    const q = need(target(p, a[2] || (a[0] === 'points' ? a[2] : a[1])), a[2] || a[1]); const c = q.char; const T = require('../shared/passives.js');
    if (a[0] === 'points') c.passiveBonus = (c.passiveBonus || 0) + (+a[1] || 0);
    else if (a[0] === 'reset') c.passives = [];
    else if (a[0] === 'all') { c.passiveBonus = (c.passiveBonus || 0) + 1000; let added = true; while (added) { added = false; for (const nd of T.nodes) if (T.canAllocate(c.cls, c.passives, nd.id)) { c.passives.push(nd.id); added = true; } } }
    sync(q); return `${q.name}: ${c.passives.length} nodes, bonus pts ${c.passiveBonus || 0}`;
  }],
  gearx: [3, '@gearx <slot> <wtype|-> <tier0-9> <rarity0-5> <refine> [player]', 'สร้างอุปกรณ์ตามระดับ (ใช้โดยหน้าต่าง GM)', (p, a) => {
    const slot = a[0]; if (![...D.SLOTS, 'ring'].includes(slot)) return 'slot ผิด';
    const q = need(target(p, a[5]), a[5]);
    const tier = Math.max(0, Math.min(9, +a[2] || 0));
    const it = F.genEquip(r, slot === 'ring' ? 'ring1' : slot, Math.max(1, tier * 25 + 1), Math.max(0, Math.min(5, +a[3] || 0)), a[1] !== '-' ? a[1] : D.CLASSES[q.cls].weapon);
    it.refine = Math.max(0, Math.min(['necklace', 'earring', 'ring'].includes(it.slot) ? 10 : 20, +a[4] || 0));
    I.addEquip(q.char, it); sync(q); return `${q.name} ← [${D.RARITY[it.rarity].n}] +${it.refine} ${it.name}`;
  }],
  spawnx: [2, '@spawnx <family> <n> <lv> <rank0-4>', 'เรียกมอนตามระดับ (0 ปกติ, 1 Elite, 2 บอส, 3 บอสดันเจี้ยน, 4 World Boss)', (p, a) => {
    let fam = null; for (const b in D.FAMILIES) for (const f of D.FAMILIES[b]) if (f[0].toLowerCase().replace(/ /g, '') === String(a[0]).toLowerCase()) fam = f;
    if (!fam) return 'ไม่พบ family';
    const n = Math.min(50, +a[1] || 1), lv = Math.max(1, Math.min(320, +a[2] || p.lv)), rk = Math.max(0, Math.min(4, +a[3] || 0));
    for (let i = 0; i < n; i++) { const pos = M.randomWalkable(p.inst.map, r, p, 6); W.spawnMonster(p.inst, { fam, lv, rank: rk, x: pos.x, y: pos.y, name: (rk === 1 ? 'Elite ' : '') + fam[0] + (rk >= 2 ? ' ' + r.pick(D.BOSS_TITLES) : ''), extra: { noRespawn: true } }); }
    return `spawned ${n}× ${fam[0]} Lv${lv} rank${rk}`;
  }],
  drop: [3, '@drop <item_id> [qty]', 'วางไอเทมบนพื้นตรงตำแหน่งตัวเอง', (p, a) => { if (!D.ITEMS[a[0]]) return 'id ผิด'; W.dropItem(p.inst, p.x, p.y, { uid: 'u' + db.nextId(), id: a[0], qty: +a[1] || 1 }, []); return 'dropped'; }],
  ent: [2, '@ent <kill|heal|hp|remove|freeze> <entityId> [value]', 'ควบคุม entity (มอน/ผู้เล่น/NPC) ด้วย id', (p, a) => {
    const e = p.inst.entities.get(+a[1]); if (!e) return 'ไม่พบ entity ในแผนที่นี้';
    if (a[0] === 'kill') C.onDeath(e, p); else if (a[0] === 'heal') e.hp = e.maxHp; else if (a[0] === 'hp') e.hp = Math.max(1, e.maxHp * Math.min(100, +a[2] || 100) / 100);
    else if (a[0] === 'remove') p.inst.remove(e); else if (a[0] === 'freeze') C.applyTag(e, 'freeze', 1, +a[2] || 10, p);
    return `${a[0]} → ${e.name || e.id}`;
  }],
  tp: [2, '@tp <x> <y>', 'วาร์ปในแผนที่เดิม', (p, a) => { W.enterMap(p, p.inst.id, +a[0], +a[1]); return 'ok'; }],
  gmdata: [1, '@gmdata', 'ข้อมูลสำหรับหน้าต่าง GM', (p) => { G.data(p); return 'ok'; }],
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
G.data = function (p) {
  const S = require('./social');
  p.sess && p.sess.send({ t: 'gmdata', rates: db.data.settings, flags: W.flags[p.inst.mapId] || {}, map: p.inst.mapId,
    players: [...W.players.values()].map((q) => ({ name: q.name, cls: q.cls, lv: q.lv, map: q.inst ? q.inst.mapId : '', gm: q.gm, off: q.sess ? 0 : 1, hp: Math.round(q.hp / q.maxHp * 100), id: q.id, zeny: q.char.zeny, karma: q.char.karma || 0 })),
    accounts: Object.keys(db.data.accounts).length, chars: Object.keys(db.data.chars).length,
    gvg: S.gvg.active, wb: S.worldBossAlive(), castles: D.CASTLES.map((c) => [c.id, (db.data.guilds[S.castleOwner(c.id)] || {}).name || '-']),
    bosses: Object.entries(S.fieldBoss).map(([k, v]) => [k, v.alive ? -1 : Math.max(0, Math.round(v.nextAt - Date.now() / 1000))]),
    ents: [...p.inst.entities.values()].filter((e) => e.kind === 'm' || e.kind === 'p').slice(0, 300).map((e) => [e.id, e.kind, e.name, e.lv || 0, Math.round(e.hp / e.maxHp * 100), Math.round(W.dist(p, e))]).sort((x, y) => x[5] - y[5]).slice(0, 60) });
};
G.persist = () => {}; G.saveAll = () => {}; G.shutdown = () => process.exit(0);

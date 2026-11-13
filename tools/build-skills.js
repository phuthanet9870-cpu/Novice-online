// Compiles docs/classes/*.md (the design source of truth) into shared/skills.js.
// Every skill gets structured mechanics (shape, tags, consumes, conditions, movement...)
// and its own unique SP / cooldown / cast / range / damage numbers.
const fs = require('fs');
const path = require('path');
const D = require('../shared/data.js');
const { hashStr } = require('../shared/rng.js');

const DOCS = path.join(__dirname, '..', 'docs', 'classes');
const OUT = path.join(__dirname, '..', 'shared', 'skills.js');

const TAGWORDS = [
  ['armorbreak', /Armor Break/i], ['holybrand', /Holy Brand/i], ['airborne', /Airborne/i], ['knockdown', /Knockdown/i],
  ['stun', /\bStun\b/i], ['bleed', /\bBleed\b/i], ['poison', /\bPoison\b/i], ['burn', /\bBurn\b/], ['chill', /\bChill\b/i],
  ['freeze', /\bFreeze\b|แช่แข็ง/i], ['wet', /\bWet\b/], ['shock', /\bShock\b/], ['mark', /\bMark\b/], ['curse', /\bCurse\b/],
  ['slow', /\bSlow\b|ชะลอ/], ['root', /\bRoot\b|ตรึง/], ['silence', /Silence/i], ['fear', /\bFear\b|กลัว/], ['blind', /Blind/]
];
const RES_WORDS = /Blade Charge|Bulwark|Fury|Shadow Point|Focus|Element Orb|Orb|Faith|Chi|Soul Shard|Shard|Heat|SP ทั้งหมด/;
const REACTION_WORDS = { electrocute: /Electrocute/i, firestorm: /Firestorm/i, shatter: /Shatter/i, steam: /Steam/i, toxic: /Toxic Blaze/i, purge: /Purge/i, twilight: /Twilight/i, hemorrhage: /Hemorrhage/i };

const num = (s) => parseFloat(String(s).replace(/,/g, ''));
const round1 = (x) => Math.round(x * 10) / 10;

function tagsIn(s) {
  const out = [];
  for (const [id, re] of TAGWORDS) if (re.test(s)) out.push(id);
  return out;
}

function detectElement(cls, branch, name, desc) {
  const s = name + ' ' + desc;
  if (/Holy(?! Brand)|ศักดิ์สิทธิ์|แสง|Divine|Radiant|Sacred|Seraph|Angel|Heaven/.test(s) && !/Heaven Splitter|Heaven Dropkick|Heaven's Arrow/.test(name)) return 'holy';
  if (/Dark|มืด|Shadow Bolt|Soul|Abyss|อเวจี|Umbral|Death|Doom|Necro|Void/.test(s) && cls === 'warlock') return 'dark';
  if (/Lightning|Thunder|สายฟ้า|ฟ้าผ่า|Static|Shock Round|Plasma|Electro|Zeus|Railgun/.test(s)) return 'lightning';
  if (/Ice|Frost|Frozen|Glacial|Blizzard|Cryo|น้ำแข็ง|Hail|Winter|Absolute Zero/.test(s)) return 'ice';
  if (/Water|Tidal|Rain Call|น้ำ(?!แข็ง)|Wet/.test(name) || /Water Ball|Tidal Wave|Rain Call/.test(name)) return 'water';
  if (/Fire|Flame|ไฟ|Meteor Strike|Magma|Inferno|Phoenix|Napalm|Combustion|Ignite|Heat Surge|Armageddon/.test(s) && !/Fire Trap/.test('x')) return 'fire';
  if (/Wind|Gale|Tornado|ลม|Cyclone|Storm Volley/.test(s)) return 'wind';
  if (/Stone|Earth|Boulder|Rock|หิน|Quake|Tectonic|Landslide|Fault|Crater|แผ่นดิน/.test(s)) return 'earth';
  if (/Venom|Toxic|Poison|พิษ|Acid|Plague|Noxious/.test(s)) return 'poison';
  if (/Blood|Crimson|เลือด|Sanguine|Gore|Hemorrhage/.test(s)) return 'blood';
  if (cls === 'cleric') return 'holy';
  if (cls === 'warlock') return 'dark';
  if (cls === 'elementalist') return branch === 'Cryo' ? 'ice' : branch === 'Storm' ? 'lightning' : 'fire';
  return 'neutral';
}

function parseTable(md) {
  const atk = [], ult = [], buff = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim().replace(/\*\*/g, ''));
    if (/^\d+$/.test(c[0]) && c.length >= 5) atk.push({ idx: +c[0], name: c[1], branch: c[2], role: c[3], desc: c[4] });
    else if (/^U\d$/.test(c[0])) ult.push({ idx: +c[0].slice(1), name: c[1], awaken: c[2], desc: c[3] });
    else if (/^B\d$/.test(c[0])) buff.push({ idx: +c[0].slice(1), name: c[1], desc: c[2] });
  }
  return { atk, ult, buff };
}

const EXCL = /(HP|ลด|ฮีล|ฟื้น|Lifesteal|ดูด|โอกาส|Crit|DEF|SP|ความเร็ว|ต้าน|Boss|บอส|ได้รับ|สะท้อน|ทำต่อเป้า|ไปหัก|เกจ|Armor Break|MATK|ซับ)\s*[\w\s]{0,4}$/;

function parseDamage(t, sk) {
  // returns {per, hits, perUnit, zone}
  let m;
  const res = { per: 0, hits: 1, perUnit: 0, base: 0 };
  // zone ticks:  80%/0.5s , 100%/s
  m = t.match(/(\d[\d,.]*)%\s*\/\s*(\d*\.?\d*)s/);
  if (m && !/(ฮีล|ฟื้น)\s*$/.test(t.slice(0, m.index))) {
    const dm = t.replace(m[0], '').match(/(\d+(?:\.\d+)?)\s*(?:วิ|s)\b/);
    sk.zone = { mult: num(m[1]) / 100, tick: m[2] ? num(m[2]) : 1, dur: dm ? num(dm[1]) : 6 };
  }
  // per-unit scaling: "80%/Charge", "5% ต่อ Fury", "120% ต่อชั้น", "300% ต่อศพ", "160%/Shard"
  m = t.match(/(\d[\d,.]*)%\s*(?:\/|ต่อ\s*)(Charge|Fury|Shard|แต้ม|ชั้น|Heat|Faith|ศพ|ตัว|Chi)/);
  if (m) {
    res.perUnit = num(m[1]) / 100; res.unit = m[2];
    const b = t.slice(0, m.index).match(/(\d[\d,.]*)%\s*\+\s*$/);
    if (b) res.base = num(b[1]) / 100;
  }
  m = t.match(/(\d[\d,.]*)%\s*[×x]\s*(\d+)/);
  if (m) { res.per = num(m[1]) / 100; res.hits = +m[2]; return res; }
  m = t.match(/(\d+)\s*[×x]\s*(\d[\d,.]*)%/);
  if (m) { res.per = num(m[2]) / 100; res.hits = +m[1]; return res; }
  m = t.match(/(\d+)\/(\d+)\/(\d+)%/);
  if (m) { res.per = (num(m[1]) + num(m[2]) + num(m[3])) / 300; res.hits = 3; return res; }
  const re = /([+\-<>≥]?)(\d[\d,.]*)%(?!\/|\s*ต่อ)/g;
  while ((m = re.exec(t))) {
    if (m[1]) continue;
    const before = t.slice(Math.max(0, m.index - 14), m.index);
    if (EXCL.test(before)) continue;
    if (/[<>≥]\s*$/.test(before)) continue;
    if (/^\s*(HP|MaxSP|ของ)/.test(t.slice(m.index + m[0].length))) continue;
    const v = num(m[2]);
    if (v < 25 && !res.perUnit) continue;
    if (res.perUnit && Math.abs(v / 100 - res.perUnit) < 1e-6) continue;
    if (res.perUnit && Math.abs(v / 100 - res.base) < 1e-6) continue;
    res.per = v / 100; res.hits = 1;
    // "Nครั้ง/ลูก/นัด" without ×
    const h = t.match(/(\d+)\s*(?:ครั้ง|ลูก|นัด|หมัด|ขวาน)/);
    if (h && +h[1] > 1 && +h[1] <= 30 && !/ครั้ง\s*\d/.test(t)) { res.hits = +h[1]; res.per = v / 100 / Math.max(1, Math.min(+h[1], 3)); }
    return res;
  }
  return res;
}

function parseShape(t, sk, clsDef) {
  let m;
  const defRange = sk.melee ? clsDef.range : Math.max(clsDef.range, 6);
  sk.range = defRange;
  if ((m = t.match(/ระยะ\s*(\d+)/))) sk.range = +m[1];
  if (/ระยะทั้งจอ|ทั้งจอ|ทั่วจอ|ในจอ|ทะลุจอ/.test(t)) { sk.shape = 'circle'; sk.radius = 14; sk.self = true; }
  else if ((m = t.match(/(?:AoE\s*)?(\d+)\s*×\s*(\d+)(?![\d,]*%)/)) && +m[1] <= 20 && +m[2] <= 20) {
    sk.shape = 'circle'; sk.radius = round1(Math.max(+m[1], +m[2]) / 2 + 0.3);
    sk.self = sk.melee || /รอบตัว|หมุน|กระทืบ|ทุบพื้น|รอบ/.test(t);
  } else if (/กรวย|ครึ่งวงกลม/.test(t)) { sk.shape = 'cone'; sk.radius = sk.melee ? 4 : 6; sk.self = true; }
  else if ((m = t.match(/(\d+)\s*ทิศ/))) { sk.shape = 'circle'; sk.radius = 5; sk.self = true; }
  else if (/รอบตัว|หมุน(?!ยิง)|รอบเป้า/.test(t)) { sk.shape = 'circle'; sk.radius = /รอบเป้า/.test(t) ? 2.5 : 3; sk.self = !/รอบเป้า/.test(t); }
  else if ((m = t.match(/(?:กระโดด|เด้ง|กระโดดไป)\s*(\d+)\s*เป้า/))) { sk.shape = 'chain'; sk.chain = +m[1]; }
  else if ((m = t.match(/(?:เส้นตรง|ทะลุ|แนว|ในเส้น|รอยแยก|ยาว|เส้น)[^\d]{0,12}(\d+)\s*ช่อง/)) || /ทะลุ|เส้นตรง|ในเส้น/.test(t)) {
    sk.shape = 'line'; sk.length = m ? +m[1] : Math.max(6, sk.range); sk.width = 1.3;
  } else sk.shape = 'single';
  if (/AoE/.test(t) && sk.shape === 'single') { sk.shape = 'circle'; sk.radius = 2.5; sk.self = sk.melee; }
}

function parseMove(t, sk) {
  let m;
  if ((m = t.match(/(?:พุ่ง|สไลด์)\S*\s*(\d+)\s*ช่อง/))) sk.move = { type: 'dash', dist: +m[1] };
  else if (/พุ่ง/.test(t)) sk.move = { type: 'dash', dist: 6 };
  else if ((m = t.match(/(?:ถอยหลัง|ด้านหลัง|กลิ้งหลบ|หลบไปด้านหลัง)\s*(\d+)\s*ช่อง/))) sk.move = { type: 'back', dist: +m[1] };
  else if (/วาร์ป(?!พริบตา)/.test(t)) { m = t.match(/(\d+)\s*ช่อง/); sk.move = { type: 'blink', dist: m ? +m[1] : 7 }; }
  else if (/วาร์ปพริบตา/.test(t)) { m = t.match(/(\d+)\s*ช่อง/); sk.move = { type: 'jump', dist: m ? +m[1] : 6 }; }
  else if ((m = t.match(/กระโดด(?!หลบ)(?!ไป)\S*\s*(\d+)\s*ช่อง/))) sk.move = { type: 'leap', dist: +m[1] };
  else if (/กระโดดหาเป้า|ค้ำหอกกระโดด/.test(t)) sk.move = { type: 'leap', dist: 7 };
  if ((m = t.match(/ดึง[^\d]{0,10}(\d+)\s*ช่อง/))) sk.pull = +m[1];
  else if (/ดึง|เกี่ยว|ดูดเป้า|ดูด.*เข้ากลาง|ดึงเข้า/.test(t)) sk.pull = 5;
  if ((m = t.match(/(?:ผลัก|Knockback)[^\d]{0,6}(\d+)\s*ช่อง/))) sk.push = +m[1];
  else if (/ผลัก|Knockback|ดีด(?!.*Airborne)/.test(t)) sk.push = 3;
}

function parseSupport(t, sk) {
  let m;
  if ((m = t.match(/ฮีล(?:ใหญ่)?\s*(\d+)%\s*HP/)) || (m = t.match(/ฮีล(?:พวก|เพื่อน)?\s*(\d+)%/))) sk.heal = { pct: +m[1], who: /ปาร์ตี้|พวก|AoE|ทั้ง/.test(t) ? 'party' : 'lowest' };
  if ((m = t.match(/ฮีล\s*(\d+)%\/s/))) sk.heal = { pct: +m[1], who: 'party', zone: true };
  if (/ฮีลเพื่อน HP ต่ำสุด\s*(\d+)%\s*ของดาเมจ/.test(t)) sk.healFromDmg = 1.0;
  if ((m = t.match(/ฟื้น HP\s*(\d+)%/))) sk.selfHeal = +m[1];
  if ((m = t.match(/ฟื้น HP\s*(\d+)%\/ชั้น/))) sk.selfHealPerStack = +m[1];
  if ((m = t.match(/(?:Lifesteal|ดูดเลือด|ดูด HP)\s*(\d+)%/))) sk.lifesteal = +m[1];
  else if (/ดูดเลือด|ดูด HP/.test(t)) sk.lifesteal = 20;
  if ((m = t.match(/โล่(?:หิน|กระดูก)?\s*(?:ซับ)?\s*(\d+)%\s*(HP|MaxSP)?/))) sk.shield = { pct: +m[1] };
  else if ((m = t.match(/ได้โล่\S*\s*(\d+)%/))) sk.shield = { pct: +m[1] };
  if ((m = t.match(/เสีย HP\s*(\d+)%/))) sk.hpCost = +m[1];
  if ((m = t.match(/เรียก[^\d]*?(\d+)?\s*ตัว/)) || /เรียก|ร่างแยก|Summon/.test(t + sk.name)) {
    const c = t.match(/(\d+)\s*ตัว/); const d = t.match(/(\d+)s/);
    sk.summon = { count: c ? +c[1] : 1, dur: d ? +d[1] : 20 };
  }
  if (/กับดัก/.test(t) && !/จุดระเบิดกับดัก|ยิงกับดัก|โดนกับดัก/.test(t)) sk.trap = true;
  if (/จุดระเบิดกับดัก/.test(t)) sk.detonate = 'trap';
  if (/จุด Inner Explosion/.test(t)) sk.detonate = 'delayed';
  if (/ทุก Bleed บนเป้า/.test(t)) sk.detonate = 'dots';
  if ((m = t.match(/(?:หลัง|ติดเป้า|ฝังชี: ระเบิดหลัง)\s*(\d+)s/))) sk.delay = +m[1];
  if (/ล่องหน/.test(t) && sk.kind !== 'buff') { m = t.match(/ล่องหน\s*(\d+)s/); sk.stealth = m ? +m[1] : 4; }
  if ((m = t.match(/สกิลถัดไป[^\d+]*\+(\d+)%/)) || (m = t.match(/ทำซ้ำ\s*(\d+)%/))) sk.nextBonus = +m[1];
  if (/ลบบัฟ|Dispel|ลบ\s*buff/i.test(t)) { m = t.match(/ลบบัฟ(?:เป้า|ศัตรู)?\s*(\d+)/); sk.dispel = m ? +m[1] : 1; }
  if (/ล้าง debuff|ลบ debuff/.test(t)) sk.cleanse = true;
  if ((m = t.match(/สะท้อน\s*(\d+)%/))) sk.reflect = +m[1];
  if (/อมตะ|ไม่ตาย/.test(t)) sk.invuln = true;
  if (/ไม่ติด CC|ไม่ติด Stun|ไม่มีพลาด/.test(t)) sk.ccImmune = true;
  if (/ชุบ/.test(t)) sk.revive = true;
  if (/รีเซ็ต CD/.test(t)) sk.resetCd = true;
  if (/ฟื้น HP\/SP เต็ม/.test(t)) sk.fullRestore = true;
  if ((m = t.match(/ฆ่าทันที/))) { const h = t.match(/HP\s*<\s*(\d+)%/); sk.execute = h ? +h[1] : 15; }
  if (/ยั่วยุ/.test(t)) sk.taunt = true;
  if ((m = t.match(/เผา SP เป้า\s*(\d+)%/))) sk.manaBurn = +m[1];
  if ((m = t.match(/(?:\+|ได้)\s*(\d+)\s*(?:Blade Charge|Fury|Chi|Shard|Bulwark|Shadow Point)/))) sk.resGain = +m[1];
  if ((m = t.match(/\+(\d+)\s*Fury/))) sk.resGain = +m[1];
  if ((m = t.match(/ทะลุ DEF\s*(\d+)%/))) sk.pierce = +m[1] / 100;
  else if (/ทะลุ DEF|ทะลุทุกอย่าง|True Damage/.test(t)) sk.pierce = 0.5;
  if (/Crit แน่นอน|Crit 100%|Crit$/.test(t)) sk.critBonus = 100;
  else if ((m = t.match(/Crit\s*\+(\d+)%/))) sk.critBonus = +m[1];
  if ((m = t.match(/ดาเมจต่อสิ่งก่อสร้าง\s*×(\d+)|\(×(\d+) ต่อสิ่งก่อสร้าง\)/))) sk.siege = +(m[1] || m[2]);
}

const BUFF_MODS = [
  ['atkPct', /(?<!M)ATK(?: ปาร์ตี้)?\s*\+(\d+)%/], ['matkPct', /MATK\s*\+(\d+)%/], ['defPct', /(?<!M)DEF\s*\+(\d+)%/], ['mdefPct', /MDEF\s*\+(\d+)%/],
  ['aspdPct', /(?:ASPD|ความเร็วโจมตี)(?: ปาร์ตี้)?\s*\+(\d+)%/], ['movePct', /ความเร็ว(?:เดิน)?(?:ปาร์ตี้)?\s*([+\-]\d+)%/],
  ['crit', /Crit\s*\+(\d+)(?!%)/], ['critDmg', /Crit damage\s*\+(\d+)%/], ['flee', /Flee\s*\+(\d+)/], ['hit', /Hit\s*\+(\d+)/],
  ['hpPct', /HP สูงสุด\s*\+(\d+)%/], ['spPct', /SP\s*\+(\d+)%/], ['lifesteal', /Lifesteal\s*(\d+)%/], ['dmgReduce', /(?:ลดดาเมจ\S*|รับดาเมจ\s*-)\s*(\d+)%/],
  ['comboWin', /Combo Window\s*\+(\d+(?:\.\d+)?)s/], ['castReduce', /ลดเวลาร่าย\s*(\d+)%/], ['dmgPct', /ดาเมจ[^\d+]{0,18}\+(\d+)%/],
  ['regenPct', /regen\s*\+(\d+)%/i], ['ccRes', /ต้าน(?: CC| สถานะ)\s*\+?(\d+)%/], ['dropPct', /ดรอปเรต\s*\+(\d+)%/], ['spRegen', /SP regen ×(\d+)/]
];
function parseBuffMods(t) {
  const mods = {};
  for (const [k, re] of BUFF_MODS) { const m = t.match(re); if (m) mods[k] = num(m[1]); }
  let m;
  const sm = t.match(/((?:STR|AGI|VIT|INT|DEX|LUK)(?:\/(?:STR|AGI|VIT|INT|DEX|LUK))*)\s*\+(\d+)/);
  if (sm) for (const s of sm[1].split('/')) mods[s.toLowerCase()] = +sm[2];
  if ((m = t.match(/DEF\s*-(\d+)%/))) mods.defPct = -num(m[1]);
  if ((m = t.match(/HP regen\s*-(\d+)%/))) mods.regenPct = -num(m[1]);
  if (/ไม่ติด Stun|ไม่ติด CC|ต้าน Knockback/.test(t)) mods.ccImmune = 1;
  if (/ล่องหน/.test(t)) mods.stealth = 1;
  if (/อมตะ/.test(t)) mods.invuln = 1;
  if ((m = t.match(/ธาตุ (Holy)|เป็นธาตุ (Holy)/))) mods.element = 'holy';
  if (/เลือกธาตุ|ใส่ธาตุ/.test(t)) mods.element = 'cycle';
  if ((m = t.match(/บล็อก\s*(\d+)\s*ฮิต|ซับ\s*(\d+)\s*ครั้ง/))) mods.blocks = +(m[1] || m[2]);
  if ((m = t.match(/ระยะ(?:หอก)?\s*\+(\d+)/))) mods.range = +m[1];
  if (/รับดาเมจแทน|ดูดดาเมจ/.test(t)) mods.guardAlly = 30;
  if ((m = t.match(/สะท้อน\s*(\d+)%/))) mods.reflect = +m[1];
  if (/สลับกระสุน|Reload/.test(t)) mods.aspdPct = (mods.aspdPct || 0) + 5;
  return mods;
}

function build() {
  const files = fs.readdirSync(DOCS).filter((f) => /^\d+_.+\.md$/.test(f)).sort();
  const SKILLS = {};
  const CLASS_SKILLS = {};
  for (const f of files) {
    const cls = f.replace(/^\d+_/, '').replace(/\.md$/, '');
    const clsDef = D.CLASSES[cls];
    if (!clsDef) throw new Error('Unknown class ' + cls);
    const md = fs.readFileSync(path.join(DOCS, f), 'utf8');
    const { atk, ult, buff } = parseTable(md);
    if (atk.length !== 40 || ult.length !== 5 || buff.length !== 5) throw new Error(`${cls}: ${atk.length}/${ult.length}/${buff.length}`);
    const list = [];
    const nameToId = {};
    const branchCount = {};
    const branchOrder = Object.keys(clsDef.branches);
    let basicN = 0;

    atk.forEach((r) => {
      const id = `${cls}_${String(r.idx).padStart(2, '0')}`;
      nameToId[r.name.toLowerCase()] = id;
      const t = r.desc.replace(/\(=Freeze\)/g, '');
      // reaction notes like "เป้า Wet → Electrocute" describe a reaction, not a tag applied by this skill
      const noteRe = /(?:เป้า\s*)?([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)?)(?:\s*\+\s*[A-Z][A-Za-z]*(?:\s*\([^)]*\))?)?\s*→\s*(Electrocute|Firestorm|Twilight|Purge|Shatter|Steam Burst|Toxic Blaze)/g;
      const melee = clsDef.scale === 'melee' || (cls === 'warlock' && r.branch === 'Reaper') || (cls === 'cleric' && r.branch === 'Inquis' && /กระบอง|ตี|พุ่ง/.test(t)) || (cls === 'gunslinger' && /Point Blank|Kick Back|Slide/.test(r.name));
      const sk = { id, cls, kind: 'attack', idx: r.idx, name: r.name, desc: r.desc, branch: r.branch, role: r.role === '–' ? '-' : r.role, melee };
      sk.element = detectElement(cls, r.branch, r.name, t);
      sk.dmgType = clsDef.dmg;
      let s = t.replace(noteRe, ' ');
      // --- consumption
      let m;
      const consumes = [];
      const cre = /ใช้\s+([^→:]+?)\s*(?:→|:)/g;
      while ((m = cre.exec(t))) {
        const ph = m[1];
        if (RES_WORDS.test(ph)) sk.consumeRes = true;
        if (/DoT/.test(ph)) consumes.push('bleed', 'poison', 'burn');
        for (const tg of tagsIn(ph)) consumes.push(tg);
        const st = ph.match(/≥\s*(\d+)/); if (st) sk.minStacks = +st[1];
        const c3 = ph.match(/Chill\s*(\d+)/); if (c3) sk.minStacks = +c3[1];
        s = s.replace(m[0], ' ');
      }
      const gre = /กับ(?:เป้า)?\s*([A-Z][A-Za-z]*(?:[ \/][A-Z][A-Za-z]*)*)\s*(?:→|:)/g;
      while ((m = gre.exec(t))) { for (const tg of tagsIn(m[1])) consumes.push(tg); s = s.replace(m[0], ' '); }
      const req = /\+\s*([A-Z][A-Za-z ]*?)\s*(?:→|:)/g;
      while ((m = req.exec(t))) { for (const tg of tagsIn(m[1])) consumes.push(tg); s = s.replace(m[0], ' '); }
      if (consumes.length) sk.consumes = [...new Set(consumes)];
      if (/Shadow Point 5 แต้ม|ต้อง Orb|Heat ≥\s*(\d+)/.test(t)) { sk.needRes = (m = t.match(/Heat ≥\s*(\d+)/)) ? +m[1] : clsDef.res.max; }
      // --- bonus if tag present
      const bonus = [];
      const bre = /เป้า(?:ที่)?\s*([A-Z][A-Za-z]*(?:[ \/][A-Z][A-Za-z]*)*)\s*\+(\d+)%/g;
      while ((m = bre.exec(t))) { for (const tg of tagsIn(m[1])) bonus.push([tg, +m[2]]); s = s.replace(m[0], ' '); }
      if ((m = t.match(/เป้าลอย\s*(?:\+(\d+)%|×([\d.]+))/))) { bonus.push(['airborne', m[1] ? +m[1] : Math.round((num(m[2]) - 1) * 100)]); s = s.replace(m[0], ' '); }
      if ((m = t.match(/ใช้ Airborne ×([\d.]+)/))) bonus.push(['airborne', Math.round((num(m[1]) - 1) * 100)]);
      if ((m = t.match(/เป้าที่มี DoT\s*\+(\d+)%/))) sk.dotBonus = +m[1];
      if (bonus.length) sk.bonusIf = bonus;
      // --- conditions
      if ((m = t.match(/(?:HP เป้า|เป้า HP)\s*<\s*(\d+)%/))) sk.cond = { type: 'targetHp', v: +m[1] };
      else if ((m = t.match(/HP(?: เรา)?\s*<\s*(\d+)%/))) sk.cond = { type: 'selfHp', v: +m[1] };
      if ((m = t.match(/ยิ่ง HP เรา(?:น้อย|ต่ำ)/)) || /ยิ่ง HP เราต่ำ/.test(t)) sk.lowHpScale = true;
      if ((m = t.match(/ถ้า Combo\s*≥\s*(\d+)\s*ทำ\s*(\d+)%/))) sk.comboUp = { n: +m[1], mult: +m[2] / 100 };
      else if ((m = t.match(/Combo\s*≥\s*(\d+)/))) sk.cond = { type: 'combo', v: +m[1] };
      if ((m = t.match(/\(หลัง ([A-Z][A-Za-z ']+)\)/))) sk.chainAfterName = m[1].trim().toLowerCase();
      if ((m = t.match(/ด้านหลัง\s*(\d+)%.*ด้านหน้า\s*(\d+)%/))) sk.backstab = { back: +m[1] / 100, front: +m[2] / 100 };
      if (/จากล่องหน/.test(t)) sk.fromStealth = 1.5;
      for (const k in REACTION_WORDS) if (REACTION_WORDS[k].test(t) && !/→ (Electrocute|Firestorm)$/.test(t)) { sk.reaction = k; break; }
      // --- damage
      const dmg = parseDamage(t, sk);
      sk.dmg = round1((dmg.per || 0) * 100) / 100; sk.hits = dmg.hits;
      if (dmg.perUnit) { sk.perUnit = dmg.perUnit; sk.unit = /ศพ|ตัว/.test(dmg.unit) ? 'summon' : (sk.consumeRes || /Charge|Fury|Shard|แต้ม|Heat|Faith|Chi/.test(dmg.unit)) ? 'res' : 'stack'; if (dmg.base) sk.dmg = dmg.base; }
      if (sk.backstab) { sk.dmg = sk.backstab.back; sk.hits = 1; }
      // --- shape, movement, support
      parseShape(t, sk, clsDef);
      parseMove(t, sk);
      parseSupport(t, sk);
      // --- tags applied
      const applies = [];
      for (const tg of tagsIn(s)) {
        if (sk.consumes && sk.consumes.includes(tg) && !new RegExp(TAGWORDS.find((x) => x[0] === tg)[1].source + '\\s*(\\d|ทุก|AoE|1|2|3)').test(s)) continue;
        const re = TAGWORDS.find((x) => x[0] === tg)[1];
        const mm = s.match(new RegExp('(' + re.source + ')\\s*(\\d+(?:\\.\\d+)?)\\s*(ชั้น|s)?'));
        const ap = { tag: tg, stacks: 1, dur: D.TAGS[tg].dur };
        if (mm && mm[mm.length - 1] === 'ชั้น') ap.stacks = +mm[mm.length - 2];
        else if (mm && mm[mm.length - 1] === 's') ap.dur = +mm[mm.length - 2];
        if (/ไม่ติด|ต้าน|ลบ/.test(s.slice(Math.max(0, s.search(re) - 8), s.search(re)))) continue;
        const ext = s.match(new RegExp(re.source + '\\s*\\+(\\d+(?:\\.\\d+)?)s'));
        if (ext) { ap.extend = +ext[1]; }
        if (/ยืด/.test(s) && new RegExp('ยืด\\s*' + re.source).test(s)) ap.extend = ap.extend || 2;
        applies.push(ap);
      }
      if (/ลอยสูง|ยกเป้า|ยก(?:ทุก)?เป้า/.test(t) && !applies.find((a) => a.tag === 'airborne')) applies.push({ tag: 'airborne', stacks: 1, dur: 1.5 });
      if (/ยืด Bleed|ยืด Poison|ยืดทุก DoT/.test(t)) sk.extendDots = (m = t.match(/\+?(\d+)s/)) ? +m[1] : 3;
      if (applies.length) sk.applies = applies;
      if (sk.reaction === 'shatter' && !sk.consumes) sk.consumes = ['freeze', 'chill'];
      // utility / self-buff skills inside the attack list
      if (!sk.dmg && !sk.perUnit && !sk.zone) {
        const mods = parseBuffMods(t);
        const dm = t.match(/(\d+(?:\.\d+)?)\s*(?:s|วิ)\b/);
        if (Object.keys(mods).length) sk.selfBuff = { mods, dur: dm ? num(dm[1]) : 6 };
        if (!sk.summon && !sk.selfBuff && !sk.move && !sk.trap && !sk.detonate && !sk.applies && !sk.stealth && !sk.nextBonus && !sk.dispel && !sk.cleanse && !sk.shield && !sk.extendDots && !sk.heal && !sk.reflect && !sk.taunt && !sk.pull) sk.dmg = 1.0;
        if (sk.applies && !sk.dmg && sk.shape !== 'single') sk.dmg = 0.4;
      }
      if (sk.trap && !sk.dmg) sk.dmg = 1.2;
      if (!sk.dmg && !sk.perUnit && !sk.zone && (sk.applies || sk.move || sk.pull || sk.push || sk.taunt || sk.dispel || sk.detonate || sk.reaction || sk.manaBurn)) {
        const hj = (hashStr(id + 'b') & 255) / 255;
        sk.dmg = round1(sk.role === 'F' ? 2.3 + hj * 0.8 : 0.8 + hj * 0.6);
      }
      // --- unique numbers
      const h = hashStr(id);
      const jit = (n) => (((h >>> (n * 4)) & 15) + r.idx * 0.37 % 1) / 16;
      const total = (sk.dmg || 0) * (sk.hits || 1) + (sk.perUnit ? sk.perUnit * (sk.unit === 'res' ? Math.min(clsDef.res.max, 5) : 3) * 0.6 : 0) + (sk.zone ? sk.zone.mult * sk.zone.dur / sk.zone.tick * 0.5 : 0);
      const hardCC = (sk.applies || []).filter((a) => D.TAGS[a.tag].cc).length;
      let cd = 1.6 + total * 0.85 + (sk.role === 'F' ? 2.2 : sk.role === 'S' ? 0.6 : 0) + (sk.move ? 1.6 : 0) + (sk.radius ? sk.radius * 0.45 : 0) + hardCC * 1.4;
      if (!total) cd = 9 + (sk.summon ? 14 : 0) + (sk.stealth ? 6 : 0) + (sk.selfBuff ? sk.selfBuff.dur * 1.2 : 0);
      if (sk.cond && sk.cond.type === 'combo') cd *= 0.7;
      if (sk.chainAfterName) cd = Math.min(cd, 1.2);
      sk.cd = round1(Math.max(0.8, Math.min(45, cd + jit(1) * 0.9)));
      sk.sp = Math.round(5 + total * 4.2 + (sk.radius ? 5 : 0) + (sk.role === 'F' ? 4 : 0) + (sk.summon ? 15 : 0) + jit(2) * 4) * (clsDef.dmg === 'mag' ? 1.35 : 1) | 0;
      const cm = t.match(/ร่าย\s*(\d+(?:\.\d+)?)s/);
      sk.cast = cm ? num(cm[1]) : (clsDef.dmg === 'mag' && total >= 2.5 ? round1(0.3 + total * 0.12 + jit(3) * 0.2) : 0);
      sk.range = round1(sk.range + (sk.melee ? jit(4) * 0.4 : jit(4) * 1.2));
      sk.maxLv = 10;
      // required level
      if (r.branch === 'พื้นฐาน') { sk.reqLv = [1, 1, 2, 4, 7, 10, 14, 18][basicN] || 20 + basicN * 6; basicN++; }
      else {
        const k = branchCount[r.branch] = (branchCount[r.branch] || 0) + 1;
        const bi = branchOrder.indexOf(r.branch);
        sk.reqLv = Math.min(210, 3 + (k - 1) * 17 + bi * 2);
      }
      if (r.idx === 40 && r.branch === 'พื้นฐาน') sk.reqLv = 60;
      if (r.branch === 'Fusion') sk.reqLv = [90, 140, 190][r.idx - 38];
      SKILLS[id] = sk; list.push(id);
    });
    // resolve chain names
    for (const id of list) { const sk = SKILLS[id]; if (sk.chainAfterName) { sk.chainAfter = nameToId[sk.chainAfterName] || null; delete sk.chainAfterName; } }

    ult.forEach((r) => {
      const id = `${cls}_U${r.idx}`;
      const t = r.desc;
      const sk = { id, cls, kind: 'ult', idx: r.idx, name: r.name, desc: r.desc, branch: 'Ultimate', role: 'U', melee: false };
      sk.element = detectElement(cls, '', r.name, t);
      sk.dmgType = clsDef.dmg;
      const dmg = parseDamage(t, sk);
      sk.dmg = dmg.per; sk.hits = dmg.hits;
      if (!sk.dmg && /\d+\s*ลูก|ครั้ง/.test(t)) { sk.dmg = 0.9; sk.hits = 10; }
      parseShape(t, sk, clsDef);
      if (sk.shape === 'circle' && !/เป้าเดียว/.test(t)) { sk.self = true; sk.radius = Math.max(sk.radius, 5); }
      if (sk.shape === 'single' || sk.shape === 'line') { if (!/เป้าเดียว|เป้า HP/.test(t)) { sk.shape = sk.shape === 'line' ? 'line' : 'circle'; sk.radius = sk.radius || 7; sk.self = true; sk.length = sk.length || 15; } }
      parseMove(t, sk); parseSupport(t, sk);
      const ap = tagsIn(t).map((tg) => ({ tag: tg, stacks: /(\d+) ชั้น/.test(t) ? +t.match(/(\d+) ชั้น/)[1] : 1, dur: Math.max(D.TAGS[tg].dur, (t.match(/(\d+(?:\.\d+)?)s/) || [0, 0])[1] * 1 || 0) }));
      if (/แช่แข็ง/.test(t) && !ap.find((a) => a.tag === 'freeze')) ap.push({ tag: 'freeze', stacks: 1, dur: 3 });
      if (/Airborne|ยก/.test(t) && !ap.find((a) => a.tag === 'airborne')) ap.push({ tag: 'airborne', stacks: 1, dur: 3 });
      if (ap.length) sk.applies = ap;
      const tm = t.match(/(\d+)s\s*:|แปลงร่าง\s*(\d+)s|(\d+)s(?=\s*:)/);
      const durm = t.match(/(\d+)s/);
      if (tm || (!sk.dmg && durm)) {
        const mods = parseBuffMods(t);
        mods.dmgPct = (mods.dmgPct || 0) + 35; mods.cdr = 40;
        if (/ไม่มี CD/.test(t)) mods.cdr = 85;
        if (/Lifesteal\s*(\d+)%/.test(t)) mods.lifesteal = +t.match(/Lifesteal\s*(\d+)%/)[1];
        if (/ไม่ติด CC|ไม่ตาย|อมตะ/.test(t)) mods.ccImmune = 1;
        if (/ล่องหน/.test(t)) mods.stealth = 1;
        if (/Crit 100%/.test(t)) mods.crit = 100;
        if (/ตัวใหญ่/.test(t)) mods.giant = 1;
        if (/ปาร์ตี้|ทั้งปาร์ตี้/.test(t) && /รับดาเมจ|ลดลง/.test(t)) mods.dmgReduce = 60;
        sk.transform = { dur: +(tm ? (tm[1] || tm[2] || tm[3]) : durm[1]), mods, party: /ปาร์ตี้|โดม|พื้นที่/.test(t) };
        if (!sk.dmg) { sk.shape = 'self'; }
      }
      if (sk.summon) sk.summon.count = Math.max(sk.summon.count, (t.match(/(\d+)\s*ตัว/) || [0, 6])[1] * 1);
      sk.reqLv = [60, 60, 150, 150, 220][r.idx - 1];
      sk.maxLv = 5; sk.sp = 0;
      const h = hashStr(id);
      sk.cd = round1(60 + r.idx * 12 + ((h & 255) / 255) * 9);
      sk.cast = /ร่าย\s*(\d+)s/.test(t) ? +t.match(/ร่าย\s*(\d+)s/)[1] : 0;
      sk.range = Math.max(sk.range || 0, 8);
      SKILLS[id] = sk; list.push(id);
    });

    buff.forEach((r) => {
      const id = `${cls}_B${r.idx}`;
      const t = r.desc;
      const sk = { id, cls, kind: 'buff', idx: r.idx, name: r.name, desc: r.desc, branch: 'Buff', role: 'B' };
      sk.mods = parseBuffMods(t);
      if (!Object.keys(sk.mods).length) sk.mods = { dmgPct: 8 };
      if (/Bleed ที่ใส่ \+1|ชั้น Poison \+1/.test(t)) sk.mods.extraStack = 1;
      if (/ได้ Shadow Point จากทุก Crit|Chi ได้ 2 เท่า|Focus สะสมเร็วขึ้น|Fury ได้เร็วขึ้น/.test(t)) sk.mods.resGainPct = 100;
      sk.party = /ปาร์ตี้|ทั้งปาร์ตี้|ธง|เพื่อน/.test(t);
      let m;
      if ((m = t.match(/\((\d+) นาที\)/))) sk.dur = +m[1] * 60;
      else if ((m = t.match(/(\d+)s(?!\))/)) && !/CD/.test(t.slice(m.index - 4, m.index))) sk.dur = +m[1];
      else sk.dur = 300;
      if ((m = t.match(/CD\s*(\d+)s/))) sk.cd = +m[1]; else sk.cd = sk.dur <= 20 ? Math.round(sk.dur * 3.5) : 8;
      const h = hashStr(id);
      sk.cd = round1(sk.cd + ((h & 15) / 15) * 1.5);
      sk.sp = Math.round(20 + r.idx * 6 + (sk.party ? 15 : 0) + ((h >> 4) & 7)) * (clsDef.dmg === 'mag' ? 1.3 : 1) | 0;
      sk.cast = 0; sk.maxLv = 10; sk.range = 0;
      sk.reqLv = [5, 20, 45, 80, 120][r.idx - 1];
      SKILLS[id] = sk; list.push(id);
    });
    CLASS_SKILLS[cls] = list;
  }
  return { SKILLS, CLASS_SKILLS };
}

const { SKILLS, CLASS_SKILLS } = build();
const designCount = require('./skill-design.js')(SKILLS, CLASS_SKILLS, Object.keys(D.CLASSES).filter((c) => CLASS_SKILLS[c]));
console.log('distinct designs:', designCount);
// uniqueness report: no two skills in a class share the exact same numeric profile
let dup = 0;
for (const cls in CLASS_SKILLS) {
  const seen = new Set();
  for (const id of CLASS_SKILLS[cls]) {
    const s = SKILLS[id];
    const key = [s.dmg, s.hits, s.cd, s.sp, s.range, s.cast, s.shape].join('/');
    if (seen.has(key)) { dup++; console.warn('duplicate profile', id, key); }
    seen.add(key);
  }
}
const report = require('./skill-traits.js')(SKILLS, CLASS_SKILLS, Object.keys(D.CLASSES).filter((c) => CLASS_SKILLS[c]));
console.log('uniqueness across all skills:', JSON.stringify(report));
for (const k of ['traits', 'traitText', 'visuals', 'sounds', 'profiles']) if (report[k] !== report.total) { console.error(`NOT UNIQUE: ${k} ${report[k]}/${report.total}`); process.exit(1); }
if (report.names !== report.total) console.warn(`WARNING: duplicate skill names ${report.names}/${report.total}`);
{ // human-readable catalog of every skill's unique identity
  let md = '# Skill Catalog — 500 สกิล ไม่ซ้ำกันทั้งเกม\n\n> สร้างอัตโนมัติโดย `tools/build-skills.js` — ทุกสกิลมีคุณสมบัติเฉพาะ (Trigger → Effect), รูปแบบเอฟเฟกต์ + สี และเสียงที่ไม่ซ้ำกับสกิลอื่นในเกม\n\n';
  md += `ตรวจความไม่ซ้ำ: ${JSON.stringify(report)}\n`;
  for (const cls of Object.keys(CLASS_SKILLS)) {
    md += `\n## ${D.CLASSES[cls].name} (${D.CLASSES[cls].th})\n\n| สกิล | Lv | ความสามารถหลัก | ✦ คุณสมบัติเฉพาะ | เอฟเฟกต์ | เสียง |\n|---|---|---|---|---|---|\n`;
    for (const id of [...CLASS_SKILLS[cls]].sort((a, b) => SKILLS[a].reqLv - SKILLS[b].reqLv)) {
      const k = SKILLS[id];
      md += `| ${k.name} | ${k.reqLv} | ${k.desc.replace(/\|/g, '/')} | ${k.trait.th} | ${k.fx.pn} · ${k.fx.mn} · ${k.fx.c[0]} | ${k.fx.snd[0]} ${k.fx.snd[1]}Hz |\n`;
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'SKILLS_CATALOG.md'), md);
}
const body = `// AUTO-GENERATED by tools/build-skills.js from docs/classes/*.md — do not edit by hand.
(function (root, data) { if (typeof module === 'object' && module.exports) module.exports = data; else root.NO_SKILLS = data; })(typeof self !== 'undefined' ? self : this, ${JSON.stringify({ SKILLS, CLASS_SKILLS })});
`;
fs.writeFileSync(OUT, body);
console.log(`skills: ${Object.keys(SKILLS).length} across ${Object.keys(CLASS_SKILLS).length} classes, duplicate profiles: ${dup}`);

// Gives every skill in the game a one-of-a-kind identity:
//  - trait: a signature "trigger → effect" mechanic (no two skills in the whole game share one)
//  - fx: a unique visual signature (pattern + motion + palette) and a unique sound
// Also guarantees every skill's numeric/mechanical profile is unique across all classes.
const { rng, hashStr } = require('../shared/rng.js');

const TAG_TH = { airborne: 'Airborne', knockdown: 'Knockdown', stun: 'Stun', bleed: 'Bleed', poison: 'Poison', burn: 'Burn', chill: 'Chill', freeze: 'Freeze', wet: 'Wet', shock: 'Shock', mark: 'Mark', armorbreak: 'Armor Break', curse: 'Curse', slow: 'Slow', root: 'Root', holybrand: 'Holy Brand', silence: 'Silence', fear: 'Fear', blind: 'Blind' };
const EL_TH = { fire: 'ไฟ', ice: 'น้ำแข็ง', water: 'น้ำ', lightning: 'สายฟ้า', wind: 'ลม', earth: 'ดิน', holy: 'ศักดิ์สิทธิ์', dark: 'มืด', poison: 'พิษ', blood: 'โลหิต' };
const TAGS = Object.keys(TAG_TH), ELS = Object.keys(EL_TH);

// trigger: [id, needsTarget, variants, text]
const TRIGGERS = [
  ['cast', false, [null], () => 'ทุกครั้งที่ใช้'],
  ['crit', true, [null], () => 'เมื่อติดคริติคอล'],
  ['kill', true, [null], () => 'เมื่อสังหารเป้าหมาย'],
  ['tag', true, TAGS, (v) => `ถ้าเป้ามี ${TAG_TH[v]}`],
  ['clean', true, [null], () => 'ถ้าเป้าไม่มีสถานะใดเลย'],
  ['lowhp', false, [35, 50], (v) => `เมื่อ HP ตัวเองต่ำกว่า ${v}%`],
  ['fullhp', false, [null], () => 'เมื่อ HP ตัวเองเต็ม'],
  ['combo', false, [5, 8, 12, 16], (v) => `เมื่อคอมโบ ≥ ${v}`],
  ['nth', false, [2, 3, 4, 5], (v) => `ทุกการใช้ครั้งที่ ${v}`],
  ['boss', true, [null], () => 'เมื่อโดน Elite หรือบอส'],
  ['multi', true, [3, 5], (v) => `เมื่อโดนศัตรู ≥ ${v} ตัวพร้อมกัน`],
  ['fullres', false, [null], () => 'เมื่อพลังพิเศษเต็ม'],
  ['fresh', true, [null], () => 'กับเป้าที่ HP ยังเต็ม'],
  ['finish', true, [25, 40], (v) => `เมื่อ HP เป้าต่ำกว่า ${v}%`],
  ['moving', false, [null], () => 'ถ้าใช้ขณะกำลังเคลื่อนที่'],
  ['still', false, [null], () => 'ถ้ายืนนิ่งก่อนใช้ 2 วินาที']
];
// effect: [id, needsTarget, variants, text(v, n), number(cd, rnd)]
const r1 = (x) => Math.round(x * 10) / 10;
const EFFECTS = [
  ['tag', true, TAGS, (v) => `ใส่ ${TAG_TH[v]} ให้เป้า`, () => 0],
  ['heal', false, [null], (v, n) => `ฟื้น HP ${n}%`, (cd, r) => Math.round(3 + cd * 0.35 + r * 3)],
  ['shield', false, [null], (v, n) => `ได้โล่ ${n}% ของ HP สูงสุด`, (cd, r) => Math.round(5 + cd * 0.5 + r * 4)],
  ['cdr', false, [null], (v, n) => `ลดคูลดาวน์สกิลอื่นทั้งหมด ${n} วินาที`, (cd, r) => r1(0.5 + cd * 0.08 + r)],
  ['sp', false, [null], (v, n) => `คืน SP ${n}%`, (cd, r) => Math.round(3 + cd * 0.3 + r * 3)],
  ['res', false, [null], (v, n) => `พลังพิเศษเพิ่ม ${n}`, (cd, r) => 1 + Math.round(r * 2)],
  ['ult', false, [null], (v, n) => `เกจอัลติเมต +${n}%`, (cd, r) => Math.round(4 + cd * 0.4 + r * 4)],
  ['echo', true, ELS, (v, n) => `ฟาดซ้ำธาตุ${EL_TH[v]} ${n}%`, (cd, r) => Math.round(35 + cd * 4 + r * 20)],
  ['nova', true, [null], (v, n) => `ระเบิดรอบเป้า ${n}% รัศมี 3 ช่อง`, (cd, r) => Math.round(40 + cd * 4 + r * 20)],
  ['spread', true, [null], () => 'แพร่สถานะทั้งหมดของเป้าไปยังศัตรูรอบข้าง', () => 0],
  ['pull', true, [null], () => 'ดูดศัตรูรอบเป้าเข้าหาเป้า', () => 0],
  ['haste', false, [null], (v, n) => `ความเร็วเดิน +${n}% 4 วินาที`, (cd, r) => Math.round(15 + r * 20)],
  ['fury', false, [null], (v, n) => `ดาเมจ +${n}% 5 วินาที`, (cd, r) => Math.round(6 + cd * 0.5 + r * 6)],
  ['cleanse', false, [null], () => 'ล้างสถานะผิดปกติของตัวเองทั้งหมด', () => 0],
  ['true', true, [null], (v, n) => `ดาเมจจริง ${n}% ของ HP สูงสุดเป้า (บอส/ผู้เล่น ได้ 1/5)`, (cd, r) => r1(1 + cd * 0.15 + r)],
  ['execute', true, [null], (v, n) => `สังหารทันทีถ้า HP เป้าเหลือต่ำกว่า ${n}% (ยกเว้นบอสและผู้เล่น)`, (cd, r) => Math.round(6 + r * 6)],
  ['vamp', true, [null], (v, n) => `ดูดเลือด ${n}% ของดาเมจครั้งนี้`, (cd, r) => Math.round(10 + r * 20)],
  ['zone', false, ELS, (v) => `ทิ้งพื้นที่ธาตุ${EL_TH[v]} 3 วินาที`, () => 0],
  ['chain', true, [2, 3, 4], (v) => `ประกายกระโดดไปอีก ${v} เป้า`, (cd, r) => Math.round(30 + r * 30)],
  ['ward', false, [null], (v, n) => `ลดดาเมจที่ได้รับ ${n}% 3 วินาที`, (cd, r) => Math.round(12 + r * 18)],
  ['blink', true, [null], () => 'วาร์ปไปด้านหลังเป้าหมาย', () => 0],
  ['reset', false, [null], () => 'รีเซ็ตคูลดาวน์ของสกิลนี้ทันที', () => 0],
  ['expose', true, [null], (v, n) => `เป้ารับดาเมจเพิ่ม ${n}% 4 วินาที`, (cd, r) => Math.round(8 + r * 12)],
  ['summon', false, [null], () => 'เรียกภูตประจำสกิลมาช่วยสู้ 6 วินาที', () => 0],
  ['knock', false, [null], () => 'คลื่นกระแทกผลักศัตรูรอบตัว 3 ช่อง', () => 0],
  ['nextcrit', false, [null], () => 'การโจมตีถัดไปติดคริติคอลแน่นอน', () => 0],
  ['zeny', true, [null], (v, n) => `ได้ Zeny ${n} × เลเวลเป้า`, (cd, r) => Math.round(2 + r * 4)],
  ['partyheal', true, [null], (v, n) => `ฮีลตัวเองและเพื่อนรอบตัว ${n}% ของดาเมจ`, (cd, r) => Math.round(8 + r * 15)],
  ['stealth', false, [null], () => 'ล่องหน 2 วินาที', () => 0],
  ['weaken', true, [null], (v, n) => `ลดพลังโจมตีของเป้า ${n}% 5 วินาที`, (cd, r) => Math.round(10 + r * 15)]
];

const PATTERNS = [
  ['nova', 'วงแหวนระเบิด'], ['spiral', 'เกลียวหมุน'], ['starburst', 'ดาวแตก'], ['rain', 'ฝนดาว'], ['pillar', 'เสาแสง'], ['crescent', 'คมจันทร์เสี้ยว'],
  ['cross', 'กากบาท'], ['vortex', 'น้ำวน'], ['fan', 'พัดคลี่'], ['beam', 'ลำแสงคู่'], ['orbit', 'ลูกแก้วโคจร'], ['shock', 'คลื่นสี่เหลี่ยม'],
  ['petals', 'กลีบดอกไม้'], ['runes', 'วงเวทรูน'], ['web', 'ใยสายฟ้า'], ['comet', 'ดาวหาง'], ['geyser', 'น้ำพุพลัง'], ['ripple', 'ระลอกคลื่น'],
  ['wings', 'ปีก'], ['chains', 'โซ่ตรวน'], ['hex', 'หกเหลี่ยม'], ['meteor', 'อุกกาบาตจิ๋ว'], ['blades', 'ดาบลอยฟ้า'], ['sparkle', 'ประกายระยิบ']
];
const MOTIONS = [['cw', 'หมุนตามเข็ม'], ['ccw', 'หมุนทวนเข็ม'], ['pulse', 'เต้นเป็นจังหวะ']];
const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

function isSelfOnly(sk) { return sk.kind === 'buff' || (sk.kind === 'ult' && !sk.dmg) || (!sk.dmg && !sk.perUnit && !sk.zone && !sk.applies && !sk.trap); }

module.exports = function assign(SKILLS, CLASS_SKILLS, CLASS_ORDER) {
  const R = rng('novice-traits-v1');
  // all trigger/effect variant pairs, shuffled deterministically
  const pairs = [];
  for (const t of TRIGGERS) for (const tv of t[2]) for (const e of EFFECTS) for (const ev of e[2]) {
    if (t[0] === 'tag' && e[0] === 'tag' && tv === ev) continue;
    if (e[0] === 'reset' && ['cast', 'fresh', 'moving', 'clean', 'fullhp'].includes(t[0])) continue;
    if (e[0] === 'execute' && ['cast', 'fresh', 'clean'].includes(t[0])) continue;
    pairs.push({ t, tv, e, ev, k: R() });
  }
  pairs.sort((a, b) => a.k - b.k);
  const usedTriple = new Set(), usedBase = new Set();
  const ids = []; for (const c of CLASS_ORDER) ids.push(...CLASS_SKILLS[c]);
  // interleave classes so each class draws from the whole pool evenly
  const order = []; for (let i = 0; i < 50; i++) for (const c of CLASS_ORDER) order.push(CLASS_SKILLS[c][i]);
  for (const id of order) {
    const sk = SKILLS[id];
    const self = isSelfOnly(sk);
    let pick = null;
    for (const pass of [0, 1]) {
      for (const p of pairs) {
        const key = `${p.t[0]}:${p.tv}|${p.e[0]}:${p.ev}`;
        if (usedTriple.has(key)) continue;
        if (pass === 0 && usedBase.has(p.t[0] + '|' + p.e[0])) continue;
        if (self && (p.t[1] || p.e[1])) continue;
        // avoid giving a skill a trait it already does natively
        if (p.e[0] === 'tag' && (sk.applies || []).some((a) => a.tag === p.ev)) continue;
        if (p.e[0] === 'summon' && sk.summon) continue;
        if (p.e[0] === 'stealth' && sk.stealth) continue;
        pick = p; usedTriple.add(key); usedBase.add(p.t[0] + '|' + p.e[0]); break;
      }
      if (pick) break;
    }
    const h = hashStr(id + 'trait');
    const rr = ((h >>> 3) % 1000) / 1000;
    const n = pick.e[4](Math.min(sk.cd || 10, 60), rr);
    sk.trait = { tr: pick.t[0], tv: pick.tv, ef: pick.e[0], ev: pick.ev, n, th: `${pick.t[3](pick.tv)} → ${pick.e[3](pick.ev, n)}` };
  }
  // visual + audio signatures
  CLASS_ORDER.forEach((cls, ci) => {
    const rc = rng('fx-' + cls);
    const combos = []; for (let p = 0; p < PATTERNS.length; p++) for (let m = 0; m < MOTIONS.length; m++) combos.push([p, m, rc()]);
    combos.sort((a, b) => a[2] - b[2]);
    CLASS_SKILLS[cls].forEach((id, i) => {
      const g = ci * 50 + i;
      const sk = SKILLS[id];
      const [p, m] = combos[i];
      const hue = (g * 137.508) % 360;
      const h2 = (hue + 30 + (g % 7) * 12) % 360, h3 = (hue + 180 + (g % 3) * 20) % 360;
      sk.fx = {
        p: PATTERNS[p][0], pn: PATTERNS[p][1], m: MOTIONS[m][0], mn: MOTIONS[m][1],
        c: [`hsl(${hue.toFixed(1)},88%,62%)`, `hsl(${h2.toFixed(1)},92%,74%)`, `hsl(${h3.toFixed(1)},70%,55%)`],
        n: 8 + ((g * 13) % 17), s: r1(0.8 + ((g * 7) % 9) / 10), d: r1(0.5 + ((g * 11) % 8) / 10),
        snd: [WAVES[g % 4], Math.round(120 + g * 1.7), r1(0.35 + ((g * 31) % 17) / 10)]
      };
    });
  });
  // make every skill's numeric + mechanical profile unique across ALL classes
  const profile = (s) => [s.kind, s.shape, s.dmg, s.hits, s.cd, s.sp, s.range, s.cast, s.radius || 0, s.length || 0, s.element || '', (s.applies || []).map((a) => a.tag + a.stacks).join(','), s.move ? s.move.type + s.move.dist : ''].join('/');
  const seen = new Set();
  for (const id of ids) {
    const s = SKILLS[id];
    let k = profile(s);
    while (seen.has(k)) { s.cd = r1(s.cd + 0.1); k = profile(s); }
    seen.add(k);
  }
  // report
  const uniq = (f) => new Set(ids.map((id) => f(SKILLS[id]))).size;
  return {
    total: ids.length,
    traits: uniq((s) => `${s.trait.tr}:${s.trait.tv}|${s.trait.ef}:${s.trait.ev}`),
    traitText: uniq((s) => s.trait.th),
    visuals: uniq((s) => `${s.fx.p}|${s.fx.m}|${s.fx.c.join()}`),
    sounds: uniq((s) => s.fx.snd.join()),
    profiles: uniq(profile),
    names: uniq((s) => s.name.toLowerCase())
  };
};
module.exports.PATTERNS = PATTERNS;

// Skill compiler v5: tools/kits/<class>.js (hand-written) → shared/skills.js
// A kit lists, for one class: concept, material, 5 passives, 40 actives, 5 ultimates, 5 buffs.
//   active:  ['Name', 'form k=v … | ops … >> form … | ops …']        (>> separates steps of a combo)
//   ult:     ['Name', same program syntax]
//   buff:    ['Name', 'atk20 crit10', seconds, party?]
//   passive: ['Name', on, 'stat mods' | 'params | ops']             on: stat, hit, crit, skill, basic, kill, hurt, lowhp, tick
// Numbers in a form: d (damage × per hit), r radius, l length, w width, a angle°, n count, h hits, t seconds, k tick, dl delay, s speed
// The compiler writes Thai descriptions from the mechanics, sets cooldown / SP / level from the power of the program,
// and refuses to build if any two skills in the game share the same program (form sequence + effects).
const fs = require('fs'), path = require('path');
const D = require('../shared/data.js');
const { hashStr } = require('../shared/rng.js');
const KITS = path.join(__dirname, 'kits');
const r1 = (x) => Math.round(x * 10) / 10;
const TAGS = Object.keys(D.TAGS);
const TAG_TH = { airborne: 'ลอยกลางอากาศ', knockdown: 'ล้มลง', stun: 'มึนงง', bleed: 'เลือดไหล', poison: 'พิษ', burn: 'ไฟลุก', chill: 'หนาวสั่น', freeze: 'แช่แข็ง', wet: 'เปียก', shock: 'ช็อต', mark: 'ตีตรา', armorbreak: 'เกราะแตก', curse: 'คำสาป', slow: 'ช้าลง', root: 'ตรึง', holybrand: 'ตราศักดิ์สิทธิ์', silence: 'ใบ้', fear: 'หวาดกลัว', blind: 'ตาบอด' };
const DOT = { bleed: 1, poison: 1, burn: 1, chill: 1 };
const MODK = { atk: 'atkPct', matk: 'matkPct', def: 'defPct', mdef: 'mdefPct', aspd: 'aspdPct', move: 'movePct', crit: 'crit', cdmg: 'critDmg', ls: 'lifesteal', dr: 'dmgReduce', hp: 'hpPct', sp: 'spPct', regen: 'regenPct', cdr: 'cdr', cast: 'castReduce', flee: 'flee', hit: 'hit', dmg: 'dmgPct', ccr: 'ccRes', ccimm: 'ccImmune', reflect: 'reflect', range: 'range', boss: 'bossDmg', str: 'str', agi: 'agi', vit: 'vit', int: 'int', dex: 'dex', luk: 'luk', combo: 'comboDmg', drop: 'dropPct', summon: 'summonBuff', stealth: 'stealth' };
const MOD_TH = { atkPct: 'ATK', matkPct: 'MATK', defPct: 'DEF', mdefPct: 'MDEF', aspdPct: 'ความเร็วโจมตี', movePct: 'ความเร็วเดิน', crit: 'คริติคอล', critDmg: 'แรงคริ', lifesteal: 'ดูดเลือด', dmgReduce: 'ลดดาเมจที่รับ', hpPct: 'HP สูงสุด', spPct: 'SP สูงสุด', regenPct: 'ฟื้นฟู', cdr: 'ลดคูลดาวน์', castReduce: 'ร่ายเร็วขึ้น', flee: 'หลบหลีก', hit: 'แม่นยำ', dmgPct: 'ดาเมจ', ccRes: 'ต้านสถานะ', ccImmune: 'ไม่ติดสถานะควบคุม', reflect: 'สะท้อนดาเมจ', range: 'ระยะ', bossDmg: 'ดาเมจใส่บอส', str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK', comboDmg: 'ดาเมจคอมโบ', dropPct: 'ดรอป', summonBuff: 'สมุนแกร่งขึ้น', stealth: 'ล่องหน' };
const PCT = new Set(['atkPct', 'matkPct', 'defPct', 'mdefPct', 'aspdPct', 'movePct', 'critDmg', 'lifesteal', 'dmgReduce', 'hpPct', 'spPct', 'regenPct', 'cdr', 'castReduce', 'dmgPct', 'ccRes', 'reflect', 'bossDmg', 'comboDmg', 'dropPct']);
function mods(str) { const o = {}; for (const t of String(str).split(/[\s,]+/).filter(Boolean)) { const m = t.match(/^([a-z]+)(-?[\d.]+)?$/); if (!m || !MODK[m[1]]) throw new Error('bad mod ' + t); o[MODK[m[1]]] = m[2] === undefined ? 1 : +m[2]; } return o; }
const modsTh = (m) => Object.entries(m).map(([k, v]) => (v === 1 && ['ccImmune', 'summonBuff', 'stealth'].includes(k) ? MOD_TH[k] : `${MOD_TH[k] || k} ${v > 0 ? '+' : ''}${v}${PCT.has(k) ? '%' : ''}`)).join(' · ');

// ------------------------------------------------------------------ program parser
const FORMS = ['self', 'bolt', 'pierce', 'fan', 'arc', 'boomer', 'spiral', 'homing', 'split', 'bounce', 'chainline', 'beam', 'sweep', 'cone', 'slash', 'thrust', 'spin', 'nova', 'ring', 'cross', 'star', 'burst', 'rain', 'meteor', 'pillar', 'field', 'wall', 'dash', 'leap', 'blink', 'hook', 'tether', 'orbit', 'mine', 'totem', 'summon', 'mark', 'vortex', 'wave', 'shards', 'echo', 'swap', 'aura', 'drop'];
function parseOp(tok) {
  let ch; let m = tok.match(/^(\d+)%(.+)$/); if (m) { ch = +m[1]; tok = m[2]; }
  const op = (o) => (ch ? Object.assign(o, { ch }) : o);
  if ((m = tok.match(/^([a-z]+)(\d*\.?\d+)?$/)) && TAGS.includes(m[1])) return op({ o: 'tag', t: m[1], v: m[2] ? +m[2] : 0 });
  if ((m = tok.match(/^(vs|pop):([a-z]+)\+(\d+)$/))) return op({ o: m[1], t: m[2], v: +m[3] });
  if ((m = tok.match(/^(behind|full|boss|myhp|perres|combo|stacks|alone|crit|pierce|drain)\+?(\d+)$/))) return op({ o: m[1], v: +m[2] });
  if ((m = tok.match(/^low(\d+)$/))) return op({ o: 'low', v: +m[1] });
  if ((m = tok.match(/^far>(\d+)$/))) return op({ o: 'far', v: +m[1] });
  if ((m = tok.match(/^near<(\d+)$/))) return op({ o: 'near', v: +m[1] });
  if ((m = tok.match(/^(p?buff):([a-z0-9.,-]+)\/(\d+)$/))) return op({ o: m[1], mods: mods(m[2]), v: +m[3] });
  if ((m = tok.match(/^(res)\+(\d+)$/))) return op({ o: 'res', v: +m[2] });
  if ((m = tok.match(/^([a-z]+)(\d*\.?\d+)?$/))) {
    const K = ['pull', 'push', 'lift', 'exec', 'spread', 'expose', 'weaken', 'sunder', 'burnsp', 'steal', 'taunt', 'detonate', 'heal', 'pheal', 'shield', 'pshield', 'spend', 'cdr', 'refund', 'resetkill', 'haste', 'stealth', 'cleanse', 'pcleanse', 'next', 'ult', 'nextcrit', 'back', 'immune', 'hpcost', 'rewind', 'clone', 'echo', 'corpse', 'gold', 'gamble', 'reflect', 'gauge'];
    if (K.includes(m[1])) return op({ o: m[1], v: m[2] ? +m[2] : 0 });
  }
  throw new Error('bad op ' + tok);
}
function parseProg(src) {
  return src.split('>>').map((part) => {
    const [f0, o0] = part.split('|');
    const toks = f0.trim().split(/\s+/);
    const st = { f: toks[0], d: 0, ops: [] };
    if (!FORMS.includes(st.f)) throw new Error('bad form ' + st.f);
    for (const t of toks.slice(1)) { const q = t.match(/^([a-z]+)=(.+)$/); if (q) { st[q[1]] = q[2].replace(/_/g, ' '); continue; } const m = t.match(/^([a-z]+)(-?[\d.]+)?$/); if (!m) throw new Error('bad param ' + t); st[m[1]] = m[2] === undefined ? 1 : +m[2]; }
    if (st.self) { st.at = 'self'; delete st.self; }
    st.ops = (o0 || '').trim().split(/\s+/).filter(Boolean).map(parseOp);
    st.opm = {}; for (const o of st.ops) if (['crit', 'pierce', 'drain'].includes(o.o)) st.opm[o.o] = o.v;
    return st;
  });
}

// ------------------------------------------------------------------ Thai descriptions
const FTH = {
  self: () => 'ใช้กับตัวเอง',
  bolt: (s) => `ยิงกระสุนพลังพุ่งตรงใส่เป้าแรกในระยะ ${s.l || 9} ช่อง`,
  pierce: (s) => `ยิงทะลุเป็นเส้นตรงยาว ${s.l || 10} ช่อง โดนทุกตัวตามแนว`,
  fan: (s) => `ยิงกระจาย ${s.n || 5} ลูกเป็นรูปพัด ${s.a || 50}°`,
  arc: (s) => `โยนโค้งตกระเบิดรัศมี ${s.r || 2.2} ช่อง`,
  boomer: (s) => `ขว้างออกไป ${s.l || 8} ช่องแล้ววกกลับ โดนทั้งขาไปและขากลับ`,
  spiral: (s) => `คลื่นวนเป็นเกลียวขยายจากตัวถึง ${s.r || 5} ช่อง ${s.h || 6} จังหวะ`,
  homing: (s) => `ปล่อย ${s.n || 3} ลูกไล่ล่าศัตรูใกล้สุดเอง`,
  split: (s) => `กระสุนแตกตัวเมื่อโดนเป้า กระเด็นใส่อีก ${s.n || 3} ตัวรอบข้าง`,
  bounce: (s) => `เด้งต่อกัน ${s.n || 4} เป้า (แรงลดลงทีละทอด)`,
  chainline: (s) => `ลากเส้นพลังจากตัวไปหาศัตรู ${s.n || 4} ตัวที่ใกล้ที่สุดพร้อมกัน`,
  beam: (s) => `ยิงลำแสงค้าง ${s.t || 1} วิ ยาว ${s.l || 10} ช่อง กระแทก ${s.h || 4} ครั้ง`,
  sweep: (s) => `กวาดลำพลัง ${s.a || 180}° รอบตัวยาว ${s.l || 7} ช่อง`,
  cone: (s) => `ปล่อยพลังรูปกรวย ${s.a || 70}° ไกล ${s.r || 5} ช่อง`,
  slash: (s) => `ฟันเป็นวงโค้ง ${s.a || 130}° ระยะ ${s.r || 2.6} ช่อง${(s.h || 1) > 1 ? ` ${s.h} ครั้ง` : ''}`,
  thrust: (s) => `แทงพุ่งเป็นเส้นยาว ${s.l || 4} ช่อง${(s.h || 1) > 1 ? ` รัว ${s.h} ครั้ง` : ''}`,
  spin: (s) => `หมุนรอบตัวรัศมี ${s.r || 2.6} ช่อง ${s.h || 3} รอบ`,
  nova: (s) => `ระเบิดคลื่นวงแหวนขยายออกจากตัวถึง ${s.r || 5} ช่อง`,
  ring: (s) => `สร้างวงแหวนรัศมี ${s.r || 3.5} ช่องที่เป้า โดนเฉพาะขอบวง`,
  cross: (s) => `ผ่าเป็นรูปกากบาท${s.x ? 'เฉียง' : ''}ยาว ${(s.l || 4) * 2} ช่องที่เป้า`,
  star: (s) => `แตกเป็นดาว ${s.n || 5} แฉกยาว ${s.l || 4} ช่องที่เป้า`,
  burst: (s) => `ระเบิดรัศมี ${s.r || 2.5} ช่อง${s.at === 'self' ? 'รอบตัว' : 'ที่เป้า'}`,
  rain: (s) => `ถล่มลงมา ${s.n || 8} ลูกสุ่มในรัศมี ${s.r || 3.5} ช่อง`,
  meteor: (s) => `หมายจุดแล้วถล่มลงมาหลัง ${s.dl || 1.1} วิ รัศมี ${s.r || 3} ช่อง`,
  pillar: (s) => `เสาพลังผุดขึ้นที่เป้า กระแทก ${s.h || 4} ครั้ง`,
  field: (s) => `สร้างอาณาเขตรัศมี ${s.r || 3} ช่อง ${s.t || 5} วิ ทำดาเมจทุก ${s.k || 1} วิ`,
  wall: (s) => `ตั้งกำแพงยาว ${s.l || 5} ช่องขวางหน้า ${s.t || 4} วิ`,
  dash: (s) => `พุ่งตัว ${s.l || 6} ช่องชนทุกตัวตามทาง${s.trail ? ' ทิ้งรอยพลังไว้ ' + (s.t || 3) + ' วิ' : ''}`,
  leap: (s) => `กระโดดไปไกลสุด ${s.l || 6} ช่อง กระแทกพื้นรัศมี ${s.r || 2.5} ช่อง`,
  blink: () => 'วาร์ปไปด้านหลังเป้าแล้วโจมตีทันที',
  hook: (s) => `เหวี่ยงตะขอ ${s.l || 8} ช่อง เกี่ยวศัตรูตัวแรกดึงเข้ามา`,
  tether: (s) => `ผูกสายพลังกับเป้า ${s.t || 2.5} วิ กระแทก ${s.h || 5} ครั้งถ้าอยู่ในระยะ`,
  orbit: (s) => `ลูกพลัง ${s.n || 3} ลูกโคจรรอบตัว ${s.t || 4} วิ`,
  mine: (s) => `วางกับระเบิด ${s.n || 1} ลูก ระเบิดเมื่อศัตรูเหยียบ (อยู่ ${s.t || 15} วิ)`,
  totem: (s) => `ปักตอเทมที่เป้า ปล่อยคลื่นทุก ${s.k || 1} วิ นาน ${s.t || 6} วิ`,
  summon: (s) => `เรียก${s.nm || 'สมุน'} ${s.n || 1} ตัว อยู่ ${s.t || 15} วิ`,
  mark: (s) => `ฝังเครื่องหมายที่เป้า ระเบิดหลัง ${s.dl || 2} วิ`,
  vortex: (s) => `เปิดน้ำวนดูดศัตรูเข้ากลาง ${s.t || 2} วิ`,
  wave: (s) => `คลื่นกว้าง ${s.w || 4} ช่องเคลื่อนไปข้างหน้า ${s.l || 9} ช่อง`,
  shards: (s) => `ระเบิดที่เป้าแล้วสะเก็ดพุ่งออก ${s.n || 6} ทิศ`,
  echo: (s) => `กระแทกจุดเดิมซ้ำ ${s.h || 3} ครั้ง แรงขึ้นทุกครั้ง`,
  swap: () => 'สลับตำแหน่งกับเป้าแล้วโจมตี',
  aura: (s) => `ออร่ารอบตัวรัศมี ${s.r || 2.5} ช่อง ${s.t || 5} วิ`,
  drop: (s) => `ถล่มเป็นแนว ${s.n || 5} จุดยาว ${s.l || 8} ช่อง`
};
function opTh(o) {
  const c = o.ch ? `โอกาส ${o.ch}% ` : '';
  switch (o.o) {
    case 'tag': return c + (DOT[o.t] ? `${TAG_TH[o.t]} ${o.v || 1} ชั้น` : `${TAG_TH[o.t]}${o.v ? ' ' + o.v + ' วิ' : ''}`);
    case 'vs': return `เป้าที่${TAG_TH[o.t]} แรงขึ้น ${o.v}%`;
    case 'pop': return `สลาย${TAG_TH[o.t]}บนเป้า แรงขึ้น ${o.v}% ต่อชั้น`;
    case 'behind': return `จากด้านหลัง +${o.v}%`;
    case 'full': return `เป้า HP เต็ม +${o.v}%`;
    case 'boss': return `ใส่บอส/อีลิท +${o.v}%`;
    case 'myhp': return `ยิ่ง HP เราต่ำยิ่งแรง (สูงสุด +${o.v}%)`;
    case 'perres': return `+${o.v}% ต่อแต้มพลังพิเศษ`;
    case 'combo': return `+${o.v}% ต่อคอมโบ`;
    case 'stacks': return `+${o.v}% ต่อชั้นสถานะบนเป้า`;
    case 'alone': return `เป้าที่อยู่ลำพัง +${o.v}%`;
    case 'crit': return `คริติคอล +${o.v}%`;
    case 'pierce': return `ทะลุเกราะ ${o.v}%`;
    case 'drain': return `ดูดเลือด ${o.v}%`;
    case 'low': return `เป้า HP ต่ำกว่า ${o.v}% แรง ×1.8`;
    case 'far': return `เป้าไกลเกิน ${o.v} ช่อง ×1.5`;
    case 'near': return `เป้าใกล้กว่า ${o.v} ช่อง ×1.5`;
    case 'gamble': return 'สุ่มแรง ×0.5 ถึง ×3';
    case 'pull': return c + `ดึงเข้ามา ${o.v} ช่อง`;
    case 'push': return c + `กระเด็น ${o.v} ช่อง`;
    case 'lift': return c + 'ปัดลอยขึ้นฟ้า';
    case 'exec': return `สังหารทันทีถ้า HP เป้า < ${o.v}% (ไม่รวมบอส)`;
    case 'spread': return 'แพร่สถานะของเป้าไปยังศัตรูรอบข้าง';
    case 'expose': return `เป้ารับดาเมจเพิ่ม ${o.v}% 5 วิ`;
    case 'weaken': return `เป้าโจมตีเบาลง ${o.v}% 5 วิ`;
    case 'sunder': return 'ทำลายเกราะเป้า';
    case 'burnsp': return `เผา SP เป้า ${o.v}%`;
    case 'steal': return 'ขโมยบัฟของเป้า 1 อย่าง';
    case 'taunt': return `ยั่วยุ ${o.v || 4} วิ`;
    case 'detonate': return 'จุดระเบิด DoT ทุกชั้นบนเป้าทันที';
    case 'heal': return `ฟื้น HP ตัวเอง ${o.v}%`;
    case 'pheal': return `ฮีลปาร์ตี้ ${o.v}%`;
    case 'shield': return `โล่ ${o.v}% ของ HP`;
    case 'pshield': return `โล่ทั้งปาร์ตี้ ${o.v}%`;
    case 'res': return `พลังพิเศษ +${o.v}`;
    case 'spend': return 'ใช้พลังพิเศษทั้งหมด';
    case 'cdr': return `ลดคูลดาวน์สกิลอื่น ${o.v} วิ`;
    case 'refund': return `${o.v}% คูลดาวน์รีเซ็ตทันที`;
    case 'resetkill': return 'ฆ่าได้ = รีเซ็ตคูลดาวน์';
    case 'haste': return `เร่งความเร็ว +${o.v}% 4 วิ`;
    case 'stealth': return `ล่องหน ${o.v} วิ`;
    case 'cleanse': return 'ล้างสถานะผิดปกติ';
    case 'pcleanse': return 'ล้างสถานะทั้งปาร์ตี้';
    case 'next': return `สกิลถัดไปแรงขึ้น ${o.v}%`;
    case 'ult': return `เกจอัลติเมต +${o.v}%`;
    case 'nextcrit': return 'การโจมตีถัดไปคริแน่นอน';
    case 'back': return `ถอยหลัง ${o.v} ช่อง`;
    case 'buff': return `บัฟตัวเอง ${o.v} วิ: ${modsTh(o.mods)}`;
    case 'pbuff': return `บัฟปาร์ตี้ ${o.v} วิ: ${modsTh(o.mods)}`;
    case 'immune': return `อมตะ ${o.v} วิ`;
    case 'hpcost': return `แลก HP ${o.v}%`;
    case 'rewind': return `ย้อนเวลาตัวเองกลับไป ${o.v || 3} วิก่อน (ตำแหน่ง + HP)`;
    case 'clone': return `สร้างร่างลวง ${o.v || 1} ร่าง`;
    case 'echo': return `เกิดซ้ำอีกครั้งแรง ${o.v}%`;
    case 'corpse': return `ระเบิดศพรอบเป้าสูงสุด ${o.v || 3} ศพ`;
    case 'gold': return `ฆ่าได้รับ Zeny ×${o.v}`;
    case 'reflect': return `สะท้อนดาเมจ ${o.v}% 4 วิ`;
    case 'gauge': return `เกจอัลติเมต +${o.v}%`;
  }
  return o.o;
}
const stepTh = (s) => [FTH[s.f](s) + (s.d ? ` · ${Math.round(s.d * 100)}%${(s.h || 1) > 1 && !['spin', 'pillar', 'beam', 'echo', 'vortex', 'tether', 'spiral', 'sweep'].includes(s.f) ? '' : ''}` : '')].concat(s.ops.filter((o) => !['crit', 'pierce', 'drain'].includes(o.o) || true).map(opTh)).join(' · ');

// ------------------------------------------------------------------ numbers
const HITS = { spin: 'h', pillar: 'h', beam: 'h', echo: 'h', vortex: 'h', tether: 'h', spiral: 'h', slash: 'h', thrust: 'h' };
const AREA = { fan: 1.6, arc: 1.8, boomer: 1.6, spiral: 2, homing: 1.4, split: 1.6, bounce: 1.8, chainline: 1.8, beam: 1.6, sweep: 2, cone: 1.8, slash: 1.5, spin: 2, nova: 2.2, ring: 1.6, cross: 1.7, star: 1.8, burst: 1.8, rain: 1.6, meteor: 2, pillar: 1.2, field: 2, wall: 1.6, dash: 1.4, leap: 1.6, wave: 2, shards: 1.7, echo: 1.4, aura: 1.8, drop: 1.6, orbit: 1.6, totem: 1.8, mine: 1.4, mark: 1.5 };
function power(st) {
  let hits = HITS[st.f] ? (st[HITS[st.f]] || 3) : st.f === 'field' || st.f === 'aura' || st.f === 'totem' || st.f === 'wall' ? Math.round((st.t || 5) / (st.k || 1)) * 0.6 : st.f === 'orbit' ? (st.t || 4) * 0.8 : st.f === 'rain' ? (st.n || 8) * 0.35 : st.f === 'fan' || st.f === 'homing' ? (st.n || 3) * 0.6 : st.f === 'boomer' ? 1.8 : st.f === 'summon' ? (st.n || 1) * 2 : 1;
  return (st.d || 0) * hits * (AREA[st.f] || 1);
}
// a design token per program so icon drawing and other legacy readers understand the skill's shape
const TOK = { self: 'buff', bolt: 'bolt', pierce: 'pierce', fan: 'volley', arc: 'grenade', boomer: 'throw', spiral: 'spin', homing: 'shot', split: 'ricochet', bounce: 'ricochet', chainline: 'ricochet', beam: 'lance', sweep: 'arc', cone: 'arc', slash: 'strike', thrust: 'lance', spin: 'spin', nova: 'nova', ring: 'quake', cross: 'strike', star: 'nova', burst: 'quake', rain: 'rain', meteor: 'rain', pillar: 'zone', field: 'zone', wall: 'zone', dash: 'dash', leap: 'leap', blink: 'blink', hook: 'pull', tether: 'pull', orbit: 'spin', mine: 'trap', totem: 'zone', summon: 'summon', mark: 'delayed', vortex: 'pull', wave: 'wave', shards: 'nova', echo: 'combo', swap: 'blink', aura: 'zone', drop: 'rain' };
const ULT_TOK = { rain: 'barrage', meteor: 'nuke', nova: 'nuke', burst: 'nuke', field: 'zoneself', aura: 'zoneself', totem: 'zoneheal', summon: 'summonArmy', pierce: 'megaline', beam: 'megaline', mark: 'execute', sweep: 'executeSweep', vortex: 'blackhole', chainline: 'ricochetUlt', bounce: 'ricochetUlt', homing: 'ricochetUlt', mine: 'traps', self: 'transform', leap: 'nuke', bolt: 'single', echo: 'barrage', drop: 'barrage' };
const MELEE = new Set(['slash', 'thrust', 'spin', 'dash', 'leap', 'blink', 'swap']);
const TARGETED = new Set(['bolt', 'split', 'bounce', 'blink', 'tether', 'mark', 'swap', 'homing']);
function compat(sk, cls) {
  const s = sk.prog[0];
  const C = D.CLASSES[cls];
  sk.melee = MELEE.has(s.f);
  sk.range = r1(s.rg || (sk.melee ? Math.max(C.range, s.f === 'dash' || s.f === 'leap' ? (s.l || 6) : s.f === 'thrust' ? (s.l || 4) : s.r || 2.6) : TARGETED.has(s.f) ? Math.max(6, C.range + 1) : ['pierce', 'beam', 'wave', 'hook', 'drop', 'boomer'].includes(s.f) ? (s.l || 8) : Math.max(6, C.range)));
  if (s.f === 'self' || s.f === 'summon') sk.shape = 'self';
  else if (TARGETED.has(s.f)) sk.shape = 'single';
  else if (['pierce', 'beam', 'wave', 'hook', 'drop', 'dash', 'boomer', 'thrust'].includes(s.f)) { sk.shape = 'line'; sk.length = s.l || 8; }
  else if (['cone', 'slash', 'fan', 'sweep'].includes(s.f)) { sk.shape = 'cone'; sk.radius = s.r || s.l || 4; }
  else { sk.shape = 'circle'; sk.radius = s.r || 3; sk.self = ['spin', 'nova', 'aura', 'orbit', 'spiral', 'chainline'].includes(s.f) || s.at === 'self'; }
}

const CLASH = [];
function build() {
  const files = fs.readdirSync(KITS).filter((f) => f.endsWith('.js')).sort();
  const SKILLS = {}, CLASS_SKILLS = {}, PASSIVES = {}, KITINFO = {};
  const progSeen = new Map(), names = new Map();
  const order = Object.keys(D.CLASSES);
  for (const cls of order) {
    const file = path.join(KITS, cls + '.js');
    if (!fs.existsSync(file)) { // while kits are being written: borrow the old skill set (dev only, LEGACY_SKILLS=path)
      if (!process.env.LEGACY_SKILLS) throw new Error('no kit for ' + cls);
      const L = require(process.env.LEGACY_SKILLS); CLASS_SKILLS[cls] = L.CLASS_SKILLS[cls]; for (const id of CLASS_SKILLS[cls]) SKILLS[id] = L.SKILLS[id]; PASSIVES[cls] = []; continue;
    }
    const K = require(file);
    if (K.actives.length !== 40 || K.ults.length !== 5 || K.buffs.length !== 5 || K.passives.length !== 5) throw new Error(`${cls}: ${K.actives.length}/${K.ults.length}/${K.buffs.length}/${K.passives.length}`);
    const C = D.CLASSES[cls], list = [];
    KITINFO[cls] = { concept: K.concept, material: K.material, inspired: K.inspired || '' };
    const add = (sk) => {
      const nm = sk.name.toLowerCase(); if (names.has(nm)) CLASH.push(`duplicate name "${sk.name}" (${names.get(nm)} / ${sk.id})`); names.set(nm, sk.id);
      SKILLS[sk.id] = sk; list.push(sk.id);
    };
    const sig = (sk) => { const k = sk.prog.map((s) => s.f + (s.trail ? '+trail' : '') + (s.turret ? '+turret' : '') + (s.f === 'summon' ? '/' + (s.shape || 'spirit') : '') + (s.at === 'self' ? '@self' : '') + '[' + s.ops.map((o) => o.o + (o.t || '') + (o.mods ? '{' + Object.keys(o.mods).sort().join('/') + '}' : '')).sort().join(',') + ']').join('>'); if (progSeen.has(k)) CLASH.push(`${sk.id} "${sk.name}" = ${progSeen.get(k)}  (${k})`); else progSeen.set(k, `${sk.id} "${sk.name}"`); };
    K.actives.forEach(([name, src, note], i) => {
      const id = `${cls}_a${String(i + 1).padStart(2, '0')}`;
      const prog = parseProg(src);
      const pw = prog.reduce((a, s) => a + power(s), 0), util = prog.reduce((a, s) => a + s.ops.length, 0) + prog.length - 1;
      const h = hashStr(id);
      const sk = { id, cls, kind: 'attack', idx: i + 1, name, note: note || '', element: C.element, dmgType: C.dmg, maxLv: 10, prog };
      sk.reqLv = i < 2 ? 1 : Math.round(3 + (i - 2) * 5.3);
      sk.cd = r1(Math.max(1.2, Math.min(28, 1.6 + pw * 1.25 + util * 0.55 + (h % 7) / 10)));
      sk.sp = Math.round((6 + pw * 5 + util * 2) * (C.dmg === 'mag' ? 1.3 : 1));
      sk.cast = C.dmg === 'mag' && pw > 2.8 ? r1(0.3 + pw * 0.06) : 0;
      sk.dmg = r1(prog[0].d || 0); sk.hits = 1;
      compat(sk, cls);
      sk.desc = prog.map(stepTh).join(' ➜ ');
      sk.design = (TOK[prog[0].f] || 'strike') + '|' + prog.map((x) => x.f).join('>');
      sig(sk); add(sk);
    });
    K.ults.forEach(([name, src, note], i) => {
      const id = `${cls}_u${i + 1}`;
      const prog = parseProg(src);
      const sk = { id, cls, kind: 'ult', idx: i + 1, name, note: note || '', element: C.element, dmgType: C.dmg, maxLv: 5, prog, gauge: true, sp: 0, cast: 0 };
      sk.reqLv = [40, 80, 120, 170, 220][i]; sk.cd = r1(55 + i * 12 + (hashStr(id) % 80) / 10);
      sk.dmg = r1(prog[0].d || 0); sk.hits = 1; compat(sk, cls);
      sk.desc = prog.map(stepTh).join(' ➜ ');
      sk.design = 'ult:' + (ULT_TOK[prog[0].f] || 'nuke') + ':{}';
      sig(sk); add(sk);
    });
    K.buffs.forEach(([name, m, dur, party, note], i) => {
      const id = `${cls}_b${i + 1}`;
      const sk = { id, cls, kind: 'buff', idx: i + 1, name, note: note || '', maxLv: 10, mods: mods(m), party: !!party, dur, range: 0, cast: 0, shape: 'self' };
      sk.reqLv = [5, 20, 45, 80, 120][i]; sk.cd = r1(dur <= 20 ? dur * 3 : 6 + i); sk.sp = Math.round(18 + i * 7 + (party ? 14 : 0));
      sk.design = 'buff:' + JSON.stringify(sk.mods);
      sk.desc = `${party ? 'บัฟทั้งปาร์ตี้' : 'บัฟตัวเอง'} ${dur >= 60 ? Math.round(dur / 60) + ' นาที' : dur + ' วินาที'}: ${modsTh(sk.mods)}`;
      add(sk);
    });
    PASSIVES[cls] = K.passives.map(([name, on, spec, note], i) => {
      const q = { id: `${cls}_p${i + 1}`, name, on, lv: [1, 25, 60, 110, 170][i], note: note || '' };
      if (on === 'stat') { q.mods = mods(spec); q.desc = 'ติดตัวตลอด: ' + modsTh(q.mods); }
      else {
        const [a, b] = spec.split('|');
        for (const t of a.trim().split(/\s+/).filter(Boolean)) { const m = t.match(/^([a-z]+)([\d.]+)$/); if (!m) throw new Error('bad passive param ' + t); q[m[1]] = +m[2]; }
        q.ops = (b || '').trim().split(/\s+/).filter(Boolean).map(parseOp);
        const W = { hit: 'เมื่อโจมตีโดน', crit: 'เมื่อติดคริติคอล', skill: 'เมื่อสกิลโดนเป้า', basic: 'เมื่อโจมตีปกติโดน', kill: 'เมื่อสังหารศัตรู', hurt: 'เมื่อถูกโจมตี', lowhp: 'เมื่อ HP ต่ำกว่า 35% และถูกโจมตี', tick: `ทุก ${q.every || 5} วินาที` }[on];
        q.desc = `${W}${q.ch ? ` (โอกาส ${q.ch}%)` : ''}: ` + [q.d ? `ดาเมจ ${Math.round(q.d * 100)}%${q.r ? ' รัศมี ' + q.r + ' ช่อง' : ''}` : ''].concat(q.ops.map(opTh)).filter(Boolean).join(' · ') + ` (คูลดาวน์ภายใน ${q.icd || 1} วิ)`;
      }
      return q;
    });
    CLASS_SKILLS[cls] = list;
  }
  return { SKILLS, CLASS_SKILLS, PASSIVES, KITINFO, n: progSeen.size };
}
const out = build();
if (CLASH.length) { console.error('SAME PROGRAM (' + CLASH.length + '):\n' + CLASH.join('\n')); process.exit(1); }
const body = `// AUTO-GENERATED by tools/build-skills5.js from tools/kits/*.js — do not edit by hand.
(function (root, data) { if (typeof module === 'object' && module.exports) module.exports = data; else root.NO_SKILLS = data; })(typeof self !== 'undefined' ? self : this, ${JSON.stringify({ SKILLS: out.SKILLS, CLASS_SKILLS: out.CLASS_SKILLS, PASSIVES: out.PASSIVES, KITINFO: out.KITINFO })});
`;
fs.writeFileSync(path.join(__dirname, '..', 'shared', 'skills.js'), body);
const forms = {}; for (const s of Object.values(out.SKILLS)) if (s.prog) for (const st of s.prog) forms[st.f] = (forms[st.f] || 0) + 1;
console.log(`skills: ${Object.keys(out.SKILLS).length} in ${Object.keys(out.CLASS_SKILLS).length} classes · unique programs ${out.n} · passives ${Object.values(out.PASSIVES).flat().length}`);
console.log('forms used:', Object.keys(forms).length, '/', FORMS.length);

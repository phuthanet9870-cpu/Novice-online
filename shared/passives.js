// Passive skill tree: exactly 1000 nodes on 14 concentric rings (shared, deterministic).
// Every class starts at its own spot on ring 4; sectors around each start lean toward that class's style,
// outer rings are stronger, notables carry named multi-stat bonuses and keystones are big trade-offs.
(function (root, factory) {
  const isNode = typeof require === 'function';
  const m = factory(isNode ? require('./rng.js') : root.NO_RNG, isNode ? require('./data2.js') : root.NO_DATA);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.NO_PASSIVE = m;
})(typeof self !== 'undefined' ? self : this, function (RNG, D) {
  const RINGS = 14;
  const ringCount = (k) => (k === 14 ? 90 : 10 * k);
  const ringRadius = (k) => 70 + k * 62;
  const START_RING = 4;
  const SECTOR_THEMES = [
    [['str', 5], ['atkPct', 2], ['comboDmg', 2], ['critDmg', 4]],
    [['vit', 5], ['defPct', 3], ['hpPct', 2.5], ['ccRes', 2], ['dmgReduce', 1]],
    [['str', 5], ['lifesteal', 0.6], ['hpPct', 2], ['aspdPct', 2]],
    [['agi', 5], ['crit', 1.5], ['critDmg', 4], ['movePct', 2]],
    [['dex', 5], ['atkPct', 2], ['aspdPct', 2], ['crit', 1.2]],
    [['int', 5], ['matkPct', 2.2], ['castReduce', 2], ['spPct', 3]],
    [['int', 4], ['mdefPct', 3], ['regenPct', 8], ['hpPct', 2]],
    [['agi', 4], ['comboDmg', 2.5], ['aspdPct', 2], ['str', 3]],
    [['int', 5], ['matkPct', 2], ['cdr', 0.8], ['dmgPct', 1.2]],
    [['dex', 5], ['crit', 1.4], ['aspdPct', 1.8], ['bossDmg', 2.5]],
    [['agi', 5], ['cdr', 0.8], ['dex', 4], ['movePct', 1.8]],
    [['int', 5], ['matkPct', 2], ['hpPct', 2], ['regenPct', 8]],
    [['str', 5], ['lifesteal', 0.6], ['hpPct', 2.5], ['critDmg', 4]],
    [['agi', 5], ['crit', 1.5], ['critDmg', 4.5], ['flee', 3]],
    [['int', 5], ['matkPct', 2.2], ['castReduce', 2], ['dex', 4]]
  ];
  const NSEC = SECTOR_THEMES.length;
  const GENERIC = [['luk', 4], ['dropPct', 1.5], ['pvpDmg', 1.5], ['pvpRes', 1.5], ['hpPct', 1.5], ['dmgPct', 1]];
  const LABEL = {
    str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK', atkPct: 'ATK %', matkPct: 'MATK %', defPct: 'DEF %', mdefPct: 'MDEF %', hpPct: 'HP สูงสุด %', spPct: 'SP สูงสุด %',
    crit: 'Critical', critDmg: 'Crit Damage %', aspdPct: 'ความเร็วโจมตี %', castReduce: 'ร่ายเร็ว %', cdr: 'ลดคูลดาวน์ %', movePct: 'ความเร็วเดิน %', lifesteal: 'Lifesteal %',
    dmgPct: 'ดาเมจทั้งหมด %', dmgReduce: 'ลดดาเมจที่ได้รับ %', comboDmg: 'ดาเมจคอมโบ %', bossDmg: 'ดาเมจต่อบอส %', pvpDmg: 'ดาเมจ PvP %', pvpRes: 'ลดดาเมจ PvP %',
    ccRes: 'ต้านการควบคุม %', dropPct: 'อัตราดรอป %', regenPct: 'ฟื้นฟู HP %', comboWin: 'เวลาต่อคอมโบ (วินาที)', flee: 'Flee', hit: 'Hit'
  };
  const KEYSTONES = [
    ['Glass Cannon', { dmgPct: 40, hpPct: -30 }], ['Juggernaut', { defPct: 60, ccRes: 30, movePct: -15 }], ['Blood Pact', { lifesteal: 6, regenPct: -100 }],
    ['Wind Dancer', { movePct: 25, flee: 60, defPct: -25 }], ['Eternal Chain', { comboWin: 2, comboDmg: 20, aspdPct: -10 }], ['Arcane Overflow', { matkPct: 35, spPct: 40, hpPct: -20 }],
    ['Iron Will', { dmgReduce: 15, critDmg: -40 }], ['Assassin\'s Creed', { crit: 25, hpPct: -20 }], ['Unwavering Stance', { ccRes: 60, flee: -80 }],
    ['Elemental Equilibrium', { dmgPct: 15, castReduce: 20, cdr: -10 }], ['Giant\'s Blood', { hpPct: 40, aspdPct: -20 }], ['Swift Killer', { aspdPct: 30, atkPct: -10, matkPct: -10 }],
    ['Sanctum', { regenPct: 200, dmgPct: -15 }], ['Bloodlust', { atkPct: 30, matkPct: 30, dmgReduce: -10 }], ['Titan Slayer', { bossDmg: 40, dmgPct: -10 }],
    ['Pain Attunement', { critDmg: 50, hpPct: -15 }], ['Mind over Matter', { mdefPct: 50, defPct: 30, dmgPct: -10 }], ['Lucky Star', { dropPct: 30, luk: 40, atkPct: -8 }],
    ['Warlord', { pvpDmg: 25, pvpRes: 15, bossDmg: -20 }], ['Time Bender', { cdr: 15, castReduce: 25, hpPct: -15 }],
    ['Borrowed Hours', { aspdPct: 25, cdr: 10, defPct: -20 }], ['Frozen Clock', { ccRes: 40, flee: 30, dmgPct: -8 }], ['Divine Right', { matkPct: 30, hpPct: 15, movePct: -12 }], ['Heaven\'s Mercy', { regenPct: 250, defPct: 20, dmgPct: -12 }],
    ['Infernal Hunger', { lifesteal: 8, atkPct: 20, regenPct: -100 }], ['Demon Hide', { hpPct: 35, defPct: 25, critDmg: -30 }], ['Nightblade', { critDmg: 60, crit: 15, hpPct: -25 }], ['Abyssal Gaze', { dmgPct: 25, flee: 25, defPct: -30 }],
    ['Prismatic Focus', { matkPct: 35, castReduce: 15, hpPct: -20 }], ['Eternal Dawn', { regenPct: 180, mdefPct: 40, atkPct: -15 }]
  ];
  const ADJ = ['Fierce', 'Silent', 'Burning', 'Frozen', 'Radiant', 'Hollow', 'Iron', 'Crimson', 'Storm', 'Ancient', 'Wild', 'Sacred', 'Shadow', 'Golden', 'Feral', 'Gleaming', 'Thorned', 'Ashen', 'Verdant', 'Arcane', 'Savage', 'Celestial', 'Restless', 'Bitter', 'Tidal', 'Quiet', 'Molten', 'Lunar', 'Solar', 'Grim'];
  const NOUN = ['Heart', 'Edge', 'Bastion', 'Fang', 'Eye', 'Pulse', 'Oath', 'Tempest', 'Root', 'Crown', 'Spark', 'Mantle', 'Howl', 'Veil', 'Anvil', 'Bloom', 'Talon', 'Ember', 'Current', 'Rune', 'Spire', 'Wake', 'Chorus', 'Gale', 'Vigil', 'Marrow', 'Prism', 'Tide', 'Hymn', 'Scar'];

  const nodes = [], edges = [];
  const index = {};
  const R = RNG.rng('passive-tree-v1');
  let nid = 0;
  for (let k = 1; k <= RINGS; k++) {
    const n = ringCount(k), off = k * 0.137;
    index[k] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + off;
      const r = ringRadius(k);
      const node = { id: nid++, k, i, x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r), a, adj: [] };
      nodes.push(node); index[k].push(node);
    }
  }
  const link = (a, b) => { if (a === b || a.adj.includes(b.id)) return; a.adj.push(b.id); b.adj.push(a.id); edges.push([a.id, b.id]); };
  const sectorOf = (a) => { let x = a / (Math.PI * 2); x -= Math.floor(x); return Math.round(x * NSEC) % NSEC; };
  // class starts: ring 4, nearest node to the class angle
  const starts = {};
  D.CLASS_IDS.forEach((cls, c) => {
    const target = (c / D.CLASS_IDS.length) * Math.PI * 2;
    let best = null, bd = 9;
    for (const nd of index[START_RING]) { let d = Math.abs(((nd.a - target + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = nd; } }
    best.type = 'start'; best.cls = cls; starts[cls] = best.id;
  });
  // ring links with gaps, radial links to nearest node on next ring
  for (let k = 1; k <= RINGS; k++) {
    const ring = index[k];
    for (let i = 0; i < ring.length; i++) if (RNG.hash2(k, i, 77) > 0.2 || k === 1) link(ring[i], ring[(i + 1) % ring.length]);
    if (k < RINGS) for (const nd of ring) {
      const next = index[k + 1];
      let best = null, bd = 1e9;
      for (const o of next) { const d = (o.x - nd.x) ** 2 + (o.y - nd.y) ** 2; if (d < bd) { bd = d; best = o; } }
      if (RNG.hash2(k, nd.i, 91) < 0.5 || nd.adj.length < 2) link(nd, best);
    }
  }
  // guarantee everything is reachable
  const seen = new Set([nodes[0].id]); const q = [nodes[0]];
  while (q.length) { const c = q.pop(); for (const a of c.adj) if (!seen.has(a)) { seen.add(a); q.push(nodes[a]); } }
  for (const nd of nodes) if (!seen.has(nd.id)) {
    const inner = nd.k > 1 ? index[nd.k - 1] : index[nd.k + 1];
    let best = null, bd = 1e9; for (const o of inner) if (seen.has(o.id)) { const d = (o.x - nd.x) ** 2 + (o.y - nd.y) ** 2; if (d < bd) { bd = d; best = o; } }
    if (best) link(nd, best);
    const st = [nd]; seen.add(nd.id); while (st.length) { const c = st.pop(); for (const a of c.adj) if (!seen.has(a)) { seen.add(a); st.push(nodes[a]); } }
  }
  // keystones: 2 per sector on rings 12-14
  let ks = 0;
  for (let s = 0; s < NSEC; s++) for (const k of [12, 14]) {
    const ring = index[k];
    const target = (s / NSEC) * Math.PI * 2 + (k === 12 ? 0.12 : -0.12);
    let best = null, bd = 9;
    for (const nd of ring) { if (nd.type) continue; let d = Math.abs(((nd.a - target + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = nd; } }
    const [name, mods] = KEYSTONES[ks++];
    best.type = 'keystone'; best.name = name; best.mods = mods;
  }
  // notables & minors
  let nameI = 0;
  for (const nd of nodes) {
    if (nd.type === 'start') { nd.mods = {}; nd.name = D.CLASSES[nd.cls].name + ' Start'; continue; }
    if (nd.type === 'keystone') continue;
    const sec = sectorOf(nd.a);
    const theme = SECTOR_THEMES[sec];
    const scale = 1 + nd.k * 0.07;
    const h = RNG.hash2(nd.k, nd.i, 5);
    if ((nd.i + nd.k * 3) % 7 === 0 && nd.k > 1) {
      nd.type = 'notable';
      const a = theme[(nd.i + nd.k) % theme.length], b = theme[(nd.i + nd.k + 1) % theme.length], c = GENERIC[(nd.i * 7 + nd.k) % GENERIC.length];
      nd.mods = { [a[0]]: +(a[1] * 2.2 * scale).toFixed(1) };
      nd.mods[b[0]] = +((nd.mods[b[0]] || 0) + b[1] * 1.6 * scale).toFixed(1);
      if (h > 0.5) nd.mods[c[0]] = +((nd.mods[c[0]] || 0) + c[1] * 1.2 * scale).toFixed(1);
      nd.name = `${ADJ[(nameI * 7) % 30]} ${NOUN[(nameI * 11 + Math.floor(nameI / 30)) % 30]}`; nameI++;
    } else {
      nd.type = 'minor';
      const opt = h < 0.12 ? GENERIC[Math.floor(h * 50) % GENERIC.length] : theme[Math.floor(h * 997) % theme.length];
      nd.mods = { [opt[0]]: +(opt[1] * scale).toFixed(1) };
    }
  }
  // make notable names unique
  const used = new Set();
  for (const nd of nodes) if (nd.type === 'notable') { let nm = nd.name, j = 2; while (used.has(nm)) nm = nd.name + ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII'][j++ - 2]; used.add(nm); nd.name = nm; }

  // ---------------------------------------------------------------- special effects: every notable and keystone does something of its own
  const TAGS = ['burn', 'chill', 'freeze', 'shock', 'wet', 'poison', 'bleed', 'curse', 'stun', 'slow', 'root', 'knockdown', 'airborne', 'armorbreak', 'mark', 'blind', 'holybrand', 'fear', 'silence'];
  const ELS = ['fire', 'ice', 'lightning', 'water', 'wind', 'earth', 'holy', 'dark', 'poison', 'blood', 'neutral'];
  const HIT_TAGS = ['burn', 'chill', 'shock', 'poison', 'bleed', 'curse', 'slow', 'wet', 'mark', 'armorbreak', 'blind', 'holybrand'];
  const FX_TYPES = [
    ['execute', null, 8, 'ดาเมจ +{v}% ต่อเป้าที่ HP < 35%'], ['opener', null, 10, 'ดาเมจ +{v}% ต่อเป้าที่ HP ≥ 90%'], ['rage', null, 9, 'ดาเมจ +{v}% เมื่อ HP ตัวเอง < 40%'], ['calm', null, 6, 'ดาเมจ +{v}% เมื่อ HP ตัวเอง > 90%'],
    ['vsElite', null, 8, 'ดาเมจ +{v}% ต่อ Elite / บอส'], ['comboStack', null, 2, 'ดาเมจ +{v}% ต่อทุก 10 คอมโบ'], ['critHeal', null, 0.8, 'คริติคอลฟื้น HP {v}% (ทุก 1 วิ)'], ['critSp', null, 2, 'คริติคอลฟื้น SP {v}'],
    ['killHeal', null, 3, 'ฆ่าศัตรู: ฟื้น HP {v}%'], ['killSp', null, 3, 'ฆ่าศัตรู: ฟื้น SP {v}%'], ['killCdr', null, 0.3, 'ฆ่าศัตรู: ลดคูลดาวน์ทุกสกิล {v} วิ'], ['killHaste', null, 8, 'ฆ่าศัตรู: ความเร็วเดิน/โจมตี +{v}% 4 วิ'],
    ['killBlast', null, 6, 'ฆ่าศัตรู: ศพระเบิดสร้างดาเมจ {v}% ของ HP สูงสุดของมัน รอบตัว'], ['ward', null, 6, 'HP < 35%: รับดาเมจลดลง {v}%'], ['thorns', null, 6, 'สะท้อน {v}% ของดาเมจที่ได้รับ'], ['spRefund', null, 5, 'ใช้สกิล: โอกาส {v}% คืน SP ทั้งหมด'],
    ['ultCharge', null, 10, 'เกจอัลติชาร์จเร็วขึ้น {v}%'], ['shieldOnUlt', null, 6, 'ใช้อัลติ: ได้โล่ {v}% ของ HP สูงสุด'], ['firstStrike', null, 15, 'โจมตีแรกต่อเป้าใหม่: ดาเมจ +{v}%'], ['dodgeHeal', null, 1, 'ทุกครั้งที่ศัตรูพลาด (Flee): ฟื้น HP {v}%']
  ];
  const FXP = [];
  for (const t of FX_TYPES) FXP.push([t[0], null]);
  for (const tg of TAGS) FXP.push(['vsTag', tg]);
  for (const el of ELS) FXP.push(['elem', el]);
  for (const tg of HIT_TAGS) FXP.push(['onHitTag', tg]);
  const FXV = { vsTag: [7, 'ดาเมจ +{v}% ต่อเป้าที่ติด {p}'], elem: [7, 'สกิลธาตุ {p} แรงขึ้น +{v}%'], onHitTag: [6, 'โจมตี: โอกาส {v}% ใส่ {p} 3 วิ'] };
  for (const t of FX_TYPES) FXV[t[0]] = [t[2], t[3]];
  const KEY_FX = [['execute', null, 30], ['ward', null, 25], ['critHeal', null, 3], ['killHaste', null, 30], ['comboStack', null, 6], ['spRefund', null, 18], ['thorns', null, 25], ['firstStrike', null, 60], ['lastStand', null, 1], ['elem', 'neutral', 25],
    ['killHeal', null, 10], ['ultCharge', null, 40], ['shieldOnUlt', null, 25], ['rage', null, 35], ['vsElite', null, 30], ['killBlast', null, 25], ['dodgeHeal', null, 4], ['killSp', null, 12], ['opener', null, 40], ['killCdr', null, 1.5]];
  FXV.lastStand = [1, 'ได้รับดาเมจถึงตาย: รอดด้วย HP 1 และอมตะ 2 วิ (ทุก 60 วิ)'];
  const usedFx = new Set();
  let kI = 0;
  for (const nd of nodes) {
    if (nd.type === 'keystone') { const [t, pr, v] = KEY_FX[kI++ % KEY_FX.length]; nd.fx = { t, p: pr, v }; usedFx.add(t + ':' + pr + ':k'); continue; }
    if (nd.type !== 'notable') continue;
    let i = RNG.hashStr('pfx' + nd.id) % FXP.length, g = 0;
    while (usedFx.has(FXP[i][0] + ':' + FXP[i][1] + ':' + Math.floor(nd.k / 5)) && g++ < FXP.length) i = (i + 1) % FXP.length;
    usedFx.add(FXP[i][0] + ':' + FXP[i][1] + ':' + Math.floor(nd.k / 5));
    const [t, pr] = FXP[i], base = FXV[t][0];
    nd.fx = { t, p: pr, v: +(base * (0.7 + nd.k * 0.05)).toFixed(1) };
  }
  { const seen = new Set(); for (const nd of nodes) if (nd.fx) { let k; while (seen.has(k = nd.fx.t + ':' + nd.fx.p + ':' + nd.fx.v)) nd.fx.v = +(nd.fx.v + 0.1).toFixed(1); seen.add(k); } }
  function fxText(fx) { if (!fx) return ''; const d = FXV[fx.t]; return d ? d[1].replace('{v}', fx.v).replace('{p}', fx.p ? ((D.TAGS[fx.p] && D.TAGS[fx.p].n) || (D.ELEMENTS[fx.p] && (D.ELEMENTS[fx.p].n || fx.p)) || fx.p) : '') : ''; }
  // summed effects of an allocation: { execute: 30, 'vsTag:burn': 9, ... }
  function fxOf(ids) {
    const out = {};
    for (const id of ids || []) { const nd = nodes[id]; if (!nd || !nd.fx) continue; const k = nd.fx.p ? nd.fx.t + ':' + nd.fx.p : nd.fx.t; out[k] = +((out[k] || 0) + nd.fx.v).toFixed(1); }
    return out;
  }

  function modsOf(ids) {
    const out = {};
    for (const id of ids || []) { const nd = nodes[id]; if (!nd || !nd.mods) continue; for (const k in nd.mods) out[k] = +((out[k] || 0) + nd.mods[k]).toFixed(1); }
    return out;
  }
  function canAllocate(cls, alloc, id) {
    const nd = nodes[id]; if (!nd || nd.type === 'start') return false;
    const set = new Set(alloc); set.add(starts[cls]);
    if (set.has(id)) return false;
    return nd.adj.some((a) => set.has(a));
  }
  function canRefund(cls, alloc, id) {
    const set = new Set(alloc); if (!set.has(id)) return false;
    set.delete(id);
    const st = starts[cls]; const reach = new Set([st]); const q2 = [st];
    while (q2.length) { const c = q2.pop(); for (const a of nodes[c].adj) if (set.has(a) && !reach.has(a)) { reach.add(a); q2.push(a); } }
    for (const a of set) if (!reach.has(a)) return false;
    return true;
  }
  function describe(mods) { return Object.entries(mods).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${LABEL[k] || k}`); }
  const points = (lv, bonus) => Math.max(0, lv - 1) + Math.floor(lv / 10) + (bonus || 0);
  return { VERSION: 2, nodes, edges, starts, modsOf, fxOf, fxText, canAllocate, canRefund, describe, LABEL, points, RINGS, ringRadius, count: nodes.length };
});

// Static game data shared by server and client.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.NO_DATA = m;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_LEVEL = 250;

  // ---------------------------------------------------------------- Classes
  // Every class has its own base numbers, growth, weapon, range and resource.
  const CLASSES = {
    blade_knight: {
      name: 'Blade Knight', th: 'อัศวินดาบ', weapon: 'sword', color: '#e2a03f', color2: '#8a5a1c',
      role: 'DPS ประชิด / Bruiser', desc: 'นักดาบที่ปั่นศัตรูขึ้นฟ้า ซ้อนเลือดออก และฟันหนักทำลายเกราะ',
      hp0: 160, hpLv: 38, vitHp: 14, sp0: 40, spLv: 3.2, intSp: 5, aspd: 1.15, move: 5.2, range: 2.2,
      dmg: 'phys', scale: 'melee', res: { name: 'Blade Charge', max: 5, gain: 1 }, element: 'neutral',
      start: { str: 9, agi: 7, vit: 7, int: 2, dex: 5, luk: 3 }, rating: { atk: 4, def: 3, spd: 3, mag: 1, sup: 1, diff: 2 },
      branches: { 'พื้นฐาน': 'Basic', Sky: 'Sky Blade', Crimson: 'Crimson Edge', Iron: 'Iron Vanguard' }
    },
    guardian: {
      name: 'Guardian', th: 'ผู้พิทักษ์', weapon: 'spear', color: '#5fa8e8', color2: '#2c4f7a',
      role: 'Tank / Control', desc: 'กำแพงเหล็กของปาร์ตี้ ล็อกเป้า ดึง ผลัก และสะท้อนแสงศักดิ์สิทธิ์',
      hp0: 220, hpLv: 46, vitHp: 18, sp0: 45, spLv: 3.0, intSp: 5, aspd: 0.95, move: 4.8, range: 2.6,
      dmg: 'phys', scale: 'melee', res: { name: 'Bulwark', max: 5, gain: 1 }, element: 'neutral',
      start: { str: 7, agi: 3, vit: 11, int: 4, dex: 5, luk: 3 }, rating: { atk: 2, def: 5, spd: 1, mag: 2, sup: 3, diff: 2 },
      branches: { 'พื้นฐาน': 'Basic', Bastion: 'Bastion', Lancer: 'Lancer', Aegis: 'Holy Aegis' }
    },
    berserker: {
      name: 'Berserker', th: 'นักรบคลั่ง', weapon: 'axe', color: '#d9483b', color2: '#6e1d16',
      role: 'Burst / Lifesteal', desc: 'แลกเลือดเป็นพลัง ยิ่งใกล้ตายยิ่งแรง ทุบพื้นถล่มทั้งฝูง',
      hp0: 200, hpLv: 44, vitHp: 15, sp0: 30, spLv: 2.4, intSp: 4, aspd: 1.05, move: 5.0, range: 2.3,
      dmg: 'phys', scale: 'melee', res: { name: 'Fury', max: 100, gain: 8 }, element: 'neutral',
      start: { str: 11, agi: 5, vit: 9, int: 1, dex: 3, luk: 4 }, rating: { atk: 5, def: 3, spd: 2, mag: 0, sup: 1, diff: 1 },
      branches: { 'พื้นฐาน': 'Basic', Bloodrage: 'Bloodrage', Earth: 'Earthshaker', 'Wild Hunt': 'Wild Hunt' }
    },
    shadow_assassin: {
      name: 'Shadow Assassin', th: 'นักฆ่าเงา', weapon: 'dagger', color: '#9b6ce0', color2: '#3d2466',
      role: 'Assassinate / พิษ', desc: 'ล่องหน วาร์ปหลังเป้า ใส่พิษ และปิดฉากด้วยคริติคอลเดียว',
      hp0: 130, hpLv: 30, vitHp: 11, sp0: 45, spLv: 3.4, intSp: 5, aspd: 1.45, move: 5.8, range: 1.9,
      dmg: 'phys', scale: 'melee', res: { name: 'Shadow Point', max: 5, gain: 1 }, element: 'poison',
      start: { str: 6, agi: 11, vit: 4, int: 2, dex: 6, luk: 6 }, rating: { atk: 5, def: 1, spd: 5, mag: 0, sup: 0, diff: 4 },
      branches: { 'พื้นฐาน': 'Basic', Venom: 'Venom', Phantom: 'Phantom', Storm: 'Blade Storm' }
    },
    ranger: {
      name: 'Ranger', th: 'พรานป่า', weapon: 'bow', color: '#5cc46b', color2: '#22572b',
      role: 'DPS ระยะไกล / กับดัก', desc: 'พลธนูระยะไกล วางกับดักธาตุ และล่าร่วมกับเหยี่ยวและหมาป่า',
      hp0: 125, hpLv: 29, vitHp: 10, sp0: 55, spLv: 3.6, intSp: 5, aspd: 1.25, move: 5.3, range: 10,
      dmg: 'phys', scale: 'ranged', res: { name: 'Focus', max: 5, gain: 1 }, element: 'wind',
      start: { str: 4, agi: 8, vit: 4, int: 3, dex: 12, luk: 5 }, rating: { atk: 4, def: 1, spd: 4, mag: 1, sup: 1, diff: 3 },
      branches: { 'พื้นฐาน': 'Basic', Sharp: 'Sharpshooter', Trapper: 'Trapper', Beast: 'Beast Master' }
    },
    elementalist: {
      name: 'Elementalist', th: 'จอมเวทธาตุ', weapon: 'staff', color: '#4ad0e0', color2: '#1d5662',
      role: 'AoE Magic / Reaction', desc: 'ผสมไฟ น้ำแข็ง สายฟ้า สร้างปฏิกิริยาธาตุทำลายล้างทั้งจอ',
      hp0: 100, hpLv: 24, vitHp: 9, sp0: 90, spLv: 6.4, intSp: 8, aspd: 0.85, move: 4.9, range: 9.5,
      dmg: 'mag', scale: 'magic', res: { name: 'Element Orb', max: 3, gain: 1 }, element: 'fire',
      start: { str: 1, agi: 3, vit: 4, int: 13, dex: 9, luk: 2 }, rating: { atk: 5, def: 1, spd: 2, mag: 5, sup: 2, diff: 4 },
      branches: { 'พื้นฐาน': 'Basic', Pyro: 'Pyro', Cryo: 'Cryo', Storm: 'Storm', Fusion: 'Fusion' }
    },
    cleric: {
      name: 'Cleric', th: 'นักบวช', weapon: 'mace', color: '#f2e27a', color2: '#7f6b1a',
      role: 'Healer / Holy DPS', desc: 'ผู้รักษาที่ตีไปฮีลไป ทุบคนนอกรีต และชุบชีวิตทั้งกองทัพ',
      hp0: 140, hpLv: 31, vitHp: 12, sp0: 85, spLv: 5.8, intSp: 8, aspd: 0.9, move: 5.0, range: 7.5,
      dmg: 'mag', scale: 'magic', res: { name: 'Faith', max: 100, gain: 6 }, element: 'holy',
      start: { str: 4, agi: 3, vit: 7, int: 11, dex: 7, luk: 2 }, rating: { atk: 2, def: 3, spd: 2, mag: 4, sup: 5, diff: 3 },
      branches: { 'พื้นฐาน': 'Basic', Divine: 'Divine', Sanct: 'Sanctuary', Inquis: 'Inquisitor' }
    },
    monk: {
      name: 'Monk', th: 'นักพรตหมัด', weapon: 'knuckle', color: '#f08a3c', color2: '#7a3c10',
      role: 'Combo Chain / Chi', desc: 'ราชาคอมโบ ต่อหมัดและเตะลอยฟ้าไม่รู้จบ ปิดด้วย Asura Strike',
      hp0: 150, hpLv: 34, vitHp: 13, sp0: 60, spLv: 4.2, intSp: 6, aspd: 1.35, move: 5.5, range: 1.8,
      dmg: 'phys', scale: 'melee', res: { name: 'Chi Sphere', max: 5, gain: 1 }, element: 'neutral',
      start: { str: 9, agi: 9, vit: 6, int: 3, dex: 4, luk: 2 }, rating: { atk: 4, def: 2, spd: 4, mag: 1, sup: 1, diff: 5 },
      branches: { 'พื้นฐาน': 'Basic', Fist: 'Iron Fist', Kick: 'Tempest Kick', Spirit: 'Spirit Palm' }
    },
    warlock: {
      name: 'Warlock', th: 'จอมคำสาป', weapon: 'scythe', color: '#a94dd6', color2: '#3a1250',
      role: 'DoT / Curse / Summon', desc: 'สาปแช่ง ซ้อน DoT เรียกกองทัพผี และเก็บเกี่ยววิญญาณด้วยเคียว',
      hp0: 115, hpLv: 27, vitHp: 11, sp0: 80, spLv: 5.6, intSp: 7, aspd: 0.95, move: 4.9, range: 8.5,
      dmg: 'mag', scale: 'magic', res: { name: 'Soul Shard', max: 5, gain: 1 }, element: 'dark',
      start: { str: 3, agi: 4, vit: 6, int: 12, dex: 6, luk: 3 }, rating: { atk: 4, def: 2, spd: 2, mag: 5, sup: 2, diff: 3 },
      branches: { 'พื้นฐาน': 'Basic', Hex: 'Hex', Necro: 'Necromancy', Reaper: 'Reaper' }
    },
    gunslinger: {
      name: 'Gunslinger', th: 'มือปืน', weapon: 'gun', color: '#c9c9c9', color2: '#4a4a4a',
      role: 'Mobile DPS / Burst', desc: 'Gun-fu ปืนคู่ สไนเปอร์ไรเฟิล และระเบิดลูกซอง ระวัง Overheat',
      hp0: 120, hpLv: 28, vitHp: 10, sp0: 50, spLv: 3.4, intSp: 5, aspd: 1.4, move: 5.4, range: 8.5,
      dmg: 'phys', scale: 'ranged', res: { name: 'Heat', max: 100, gain: 7 }, element: 'neutral',
      start: { str: 4, agi: 9, vit: 4, int: 2, dex: 11, luk: 7 }, rating: { atk: 5, def: 1, spd: 5, mag: 0, sup: 1, diff: 4 },
      branches: { 'พื้นฐาน': 'Basic', Dual: 'Dual Gun', Marks: 'Marksman', Demo: 'Demolition' }
    }
  };
  const CLASS_IDS = Object.keys(CLASSES);
  const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
  const STAT_INFO = {
    str: 'ATK กายภาพ (ประชิด)', agi: 'ความเร็วโจมตี, Flee', vit: 'HP, DEF, ต้านสถานะ',
    int: 'MATK, SP, MDEF', dex: 'Hit, ความเร็วร่าย, ATK ระยะไกล', luk: 'Critical, ดรอป'
  };

  // ---------------------------------------------------------------- Combo tags
  const TAGS = {
    airborne: { n: 'Airborne', th: 'ลอยฟ้า', icon: '⬆', color: '#8fd3ff', dur: 1.5, cc: 'hard' },
    knockdown: { n: 'Knockdown', th: 'ล้ม', icon: '⬇', color: '#d0a070', dur: 2, cc: 'hard' },
    stun: { n: 'Stun', th: 'มึน', icon: '✶', color: '#ffe066', dur: 1.5, cc: 'hard' },
    bleed: { n: 'Bleed', th: 'เลือดออก', icon: '♦', color: '#e8393c', dur: 6, maxStack: 5, dot: 0.12 },
    poison: { n: 'Poison', th: 'พิษ', icon: '☠', color: '#7bd44a', dur: 8, maxStack: 5, dot: 0.09 },
    burn: { n: 'Burn', th: 'ติดไฟ', icon: '♨', color: '#ff7a2a', dur: 5, maxStack: 3, dot: 0.15 },
    chill: { n: 'Chill', th: 'หนาว', icon: '❄', color: '#a8e6ff', dur: 4, maxStack: 3 },
    freeze: { n: 'Freeze', th: 'แช่แข็ง', icon: '❆', color: '#58c8ff', dur: 3, cc: 'hard' },
    wet: { n: 'Wet', th: 'เปียก', icon: '💧', color: '#3d8bff', dur: 6 },
    shock: { n: 'Shock', th: 'ช็อต', icon: 'ϟ', color: '#f6f058', dur: 2 },
    mark: { n: 'Mark', th: 'ตราประทับ', icon: '◎', color: '#ff4f9a', dur: 8 },
    armorbreak: { n: 'Armor Break', th: 'เกราะแตก', icon: '⛉', color: '#c0c0c0', dur: 6 },
    curse: { n: 'Curse', th: 'คำสาป', icon: '☾', color: '#b05cff', dur: 10 },
    slow: { n: 'Slow', th: 'ชะลอ', icon: '≈', color: '#80a0c0', dur: 3 },
    root: { n: 'Root', th: 'ตรึง', icon: '⌘', color: '#6f9a4a', dur: 2, cc: 'root' },
    holybrand: { n: 'Holy Brand', th: 'ตราศักดิ์สิทธิ์', icon: '✝', color: '#fff2a0', dur: 8 },
    silence: { n: 'Silence', th: 'ใบ้', icon: '✕', color: '#9a9ab0', dur: 2 },
    fear: { n: 'Fear', th: 'หวาดกลัว', icon: '!', color: '#6a3a8a', dur: 2, cc: 'hard' },
    blind: { n: 'Blind', th: 'ตาบอด', icon: '◐', color: '#555', dur: 2 }
  };
  const TAG_IDS = Object.keys(TAGS);

  const ELEMENTS = {
    neutral: { n: 'Neutral', color: '#e8e8e8' }, fire: { n: 'Fire', color: '#ff6a2a' }, ice: { n: 'Ice', color: '#7fdcff' },
    water: { n: 'Water', color: '#3d8bff' }, lightning: { n: 'Lightning', color: '#fff35a' }, wind: { n: 'Wind', color: '#9cf5b0' },
    earth: { n: 'Earth', color: '#c8964a' }, holy: { n: 'Holy', color: '#fff6c0' }, dark: { n: 'Dark', color: '#a15cff' },
    poison: { n: 'Poison', color: '#86e04a' }, blood: { n: 'Blood', color: '#ff3a4a' }
  };

  const REACTIONS = {
    electrocute: { n: 'ELECTROCUTE', need: ['wet'], el: ['lightning'], mult: 2.0, color: '#fff35a' },
    firestorm: { n: 'FIRESTORM', need: ['burn'], el: ['wind'], mult: 1.6, color: '#ff8a3a' },
    shatter: { n: 'SHATTER', need: ['freeze', 'chill'], el: ['neutral', 'earth', 'blood'], heavy: true, mult: 2.5, color: '#bff0ff' },
    steam: { n: 'STEAM BURST', need: ['freeze', 'chill'], el: ['fire'], mult: 1.8, color: '#e0e0e0' },
    toxic: { n: 'TOXIC BLAZE', need: ['poison'], el: ['fire'], mult: 1.6, color: '#a0e050' },
    purge: { n: 'PURGE', need: ['curse'], el: ['holy'], mult: 3.0, color: '#fff6c0' },
    twilight: { n: 'TWILIGHT', need: ['holybrand'], el: ['dark'], mult: 2.2, color: '#d8a0ff' },
    hemorrhage: { n: 'HEMORRHAGE', need: ['bleed', 'armorbreak'], all: true, el: null, mult: 1.3, color: '#ff4040' }
  };

  // ---------------------------------------------------------------- World
  const BIOMES = {
    meadow: { ground: ['#5d9b47', '#67a84f', '#548f40'], path: '#b59a64', water: '#3b7fc4', obj: 'tree', obj2: 'flower', tint: '#9fd36a' },
    forest: { ground: ['#3f7a3a', '#467f3e', '#386d33'], path: '#8b7350', water: '#2f6aa0', obj: 'pine', obj2: 'bush', tint: '#3a6a30' },
    swamp: { ground: ['#4d5e3a', '#56663f', '#465533'], path: '#6b5a3a', water: '#3a5a46', obj: 'deadtree', obj2: 'reed', tint: '#4a5a30' },
    beach: { ground: ['#e3cf94', '#ead7a0', '#d9c288'], path: '#cbb27a', water: '#2a9fd0', obj: 'palm', obj2: 'shell', tint: '#f0e0a0' },
    ruins: { ground: ['#7d806f', '#878a78', '#737665'], path: '#9e9a88', water: '#3a6080', obj: 'pillar', obj2: 'rubble', tint: '#a0a090' },
    desert: { ground: ['#d6b06a', '#ddb873', '#cda862'], path: '#b8935a', water: '#3a90b0', obj: 'cactus', obj2: 'bones', tint: '#e8c070' },
    snow: { ground: ['#e6eef5', '#dde7ef', '#eef4fa'], path: '#b8c4d0', water: '#6ab0e0', obj: 'snowpine', obj2: 'iceshard', tint: '#ffffff' },
    crystal: { ground: ['#4a4f78', '#525883', '#43476e'], path: '#6a6f98', water: '#5ad0e0', obj: 'crystal', obj2: 'gem', tint: '#9a8cff' },
    volcano: { ground: ['#4a3530', '#523b35', '#43302b'], path: '#6a4a3a', water: '#ff5a1a', obj: 'lavarock', obj2: 'ember', tint: '#ff6a2a' },
    sky: { ground: ['#cfe3ff', '#d8e9ff', '#c4dafb'], path: '#f2f2ff', water: '#ffffff', obj: 'cloudtree', obj2: 'feather', tint: '#ffffff' },
    abyss: { ground: ['#2a2238', '#30273f', '#251e31'], path: '#43375a', water: '#120a1a', obj: 'voidspire', obj2: 'eye', tint: '#7a3aff' },
    town: { ground: ['#6aa356', '#73ad5e', '#62984f'], path: '#c9b48a', water: '#3b7fc4', obj: 'tree', obj2: 'flower', tint: '#ffe0a0' }
  };

  const TOWNS = [
    { id: 'aurelia', name: 'Aurelia', th: 'นครหลวงออเรเลีย', biome: 'meadow', lv: 1, w: 150, h: 150 },
    { id: 'sandhaven', name: 'Sandhaven', th: 'เมืองท่าทะเลทราย', biome: 'desert', lv: 40, w: 140, h: 140 },
    { id: 'frostholm', name: 'Frostholm', th: 'ป้อมหิมะฟรอสต์โฮล์ม', biome: 'snow', lv: 80, w: 140, h: 140 },
    { id: 'emberforge', name: 'Emberforge', th: 'เมืองช่างตีเหล็ก', biome: 'volcano', lv: 130, w: 140, h: 140 },
    { id: 'skyreach', name: 'Skyreach', th: 'นครลอยฟ้า', biome: 'sky', lv: 180, w: 140, h: 140 }
  ];

  const FARM_MAPS = [
    ['verdant_fields', 'Verdant Fields', 'ทุ่งเขียวขจี', 'meadow', 1, 10, 'aurelia'],
    ['whisper_woods', 'Whispering Woods', 'ป่ากระซิบ', 'forest', 8, 18, 'aurelia'],
    ['mossy_hollow', 'Mossy Hollow', 'แอ่งตะไคร่', 'swamp', 15, 25, 'aurelia'],
    ['sunny_coast', 'Sunny Coast', 'ชายฝั่งแสงแดด', 'beach', 22, 32, 'aurelia'],
    ['stone_ruins', 'Old Stone Ruins', 'ซากหินโบราณ', 'ruins', 30, 40, 'aurelia'],
    ['golden_dunes', 'Golden Dunes', 'เนินทรายทองคำ', 'desert', 38, 48, 'sandhaven'],
    ['scorpion_canyon', 'Scorpion Canyon', 'หุบเขาแมงป่อง', 'desert', 46, 56, 'sandhaven'],
    ['mirage_oasis', 'Mirage Oasis', 'โอเอซิสภาพลวง', 'beach', 54, 64, 'sandhaven'],
    ['sunken_temple', 'Sunken Temple', 'วิหารจมทราย', 'ruins', 62, 72, 'sandhaven'],
    ['thornwild', 'Thornwild Jungle', 'ป่าหนามดิบ', 'forest', 70, 80, 'sandhaven'],
    ['frostbite_plains', 'Frostbite Plains', 'ทุ่งน้ำค้างแข็ง', 'snow', 80, 90, 'frostholm'],
    ['glacier_rift', 'Glacier Rift', 'รอยแยกธารน้ำแข็ง', 'snow', 90, 100, 'frostholm'],
    ['howling_peaks', 'Howling Peaks', 'ยอดเขาหอนลม', 'snow', 100, 110, 'frostholm'],
    ['crystal_caverns', 'Crystal Caverns', 'ถ้ำคริสตัล', 'crystal', 110, 120, 'frostholm'],
    ['blightmarsh', 'Blightmarsh', 'บึงเน่า', 'swamp', 120, 130, 'frostholm'],
    ['ashen_wastes', 'Ashen Wastes', 'ดินแดนเถ้าถ่าน', 'volcano', 130, 140, 'emberforge'],
    ['magma_falls', 'Magma Falls', 'น้ำตกลาวา', 'volcano', 140, 150, 'emberforge'],
    ['obsidian_fort', 'Obsidian Fortress', 'ป้อมออบซิเดียน', 'ruins', 150, 160, 'emberforge'],
    ['dragonbone', 'Dragonbone Valley', 'หุบเขากระดูกมังกร', 'desert', 160, 170, 'emberforge'],
    ['storm_highlands', 'Storm Highlands', 'ที่ราบสูงพายุ', 'crystal', 170, 180, 'emberforge'],
    ['cloud_gardens', 'Cloud Gardens', 'สวนเมฆา', 'sky', 180, 192, 'skyreach'],
    ['celestial_ruins', 'Celestial Ruins', 'ซากวิหารสวรรค์', 'sky', 192, 205, 'skyreach'],
    ['void_frontier', 'Void Frontier', 'ชายแดนความว่างเปล่า', 'abyss', 205, 220, 'skyreach'],
    ['shattered_realm', 'Shattered Realm', 'แดนแตกสลาย', 'abyss', 220, 235, 'skyreach'],
    ['abyssal_throne', 'Abyssal Throne', 'บัลลังก์อเวจี', 'abyss', 235, 250, 'skyreach']
  ].map((a, i) => ({ id: a[0], name: a[1], th: a[2], biome: a[3], min: a[4], max: a[5], town: a[6], idx: i,
    w: 260 + (i % 5) * 20, h: 260 + ((i * 3) % 5) * 20, pk: i >= 20 }));

  const DUNGEONS = [
    { id: 'abyss_tower', name: 'Abyss Tower', th: 'หอคอยอเวจี', biome: 'abyss', element: 'dark', desc: 'หอคอยผสมทุกธาตุ ไต่ขึ้นไป 1000 ชั้น', lvBase: 5 },
    { id: 'inferno_depths', name: 'Inferno Depths', th: 'ห้วงนรกเพลิง', biome: 'volcano', element: 'fire', desc: 'มอนธาตุไฟ ดรอป Divine Crystal ดี', lvBase: 8 },
    { id: 'frost_crypt', name: 'Frost Crypt', th: 'สุสานน้ำแข็ง', biome: 'snow', element: 'ice', desc: 'มอนน้ำแข็ง/อันเดด ดรอปรูน', lvBase: 8 },
    { id: 'shadow_labyrinth', name: 'Shadow Labyrinth', th: 'เขาวงกตเงา', biome: 'crystal', element: 'dark', desc: 'เขาวงกตกว้าง มอนหลบหลีกสูง ดรอปประดับ/อัญมณี', lvBase: 10 },
    { id: 'sky_sanctum', name: 'Sky Sanctum', th: 'วิหารฟากฟ้า', biome: 'sky', element: 'holy', desc: 'มอนศักดิ์สิทธิ์ ดรอปอุปกรณ์ Legendary', lvBase: 12 }
  ];
  const DUNGEON_FLOORS = 1000;
  const dungeonLevel = (d, floor) => Math.min(320, Math.floor(d.lvBase + floor * 0.3));

  const SPECIAL_MAPS = {
    pvp_arena: { id: 'pvp_arena', name: 'Blood Colosseum', th: 'สนาม PvP', biome: 'ruins', w: 90, h: 90, pvp: true, noAuto: true },
    wb_arena: { id: 'wb_arena', name: 'Ruined Sanctum', th: 'ลานเวิลด์บอส', biome: 'abyss', w: 120, h: 120, noAuto: true },
    jail: { id: 'jail', name: 'GM Jail', th: 'คุก', biome: 'ruins', w: 30, h: 30, noAuto: true }
  };
  const CASTLES = [
    { id: 'castle_valor', name: 'Castle Valor', th: 'ปราสาทแห่งความกล้า', biome: 'meadow' },
    { id: 'castle_dawn', name: 'Castle Dawn', th: 'ปราสาทรุ่งอรุณ', biome: 'desert' },
    { id: 'castle_frost', name: 'Castle Frost', th: 'ปราสาทน้ำแข็ง', biome: 'snow' },
    { id: 'castle_ember', name: 'Castle Ember', th: 'ปราสาทถ่านเพลิง', biome: 'volcano' },
    { id: 'castle_zenith', name: 'Castle Zenith', th: 'ปราสาทจุดสูงสุด', biome: 'sky' }
  ];

  // Monster families per biome: shape drives the client art, beh drives AI.
  const FAMILIES = {
    meadow: [['Jelly', 'slime', 'melee', 0, 'water'], ['Bunny', 'beast', 'melee', 0, 'neutral'], ['Sprout', 'plant', 'ranged', 0, 'earth'], ['Buzzbee', 'insect', 'melee', 1, 'wind']],
    forest: [['Wolf', 'beast', 'melee', 1, 'neutral'], ['Treant', 'plant', 'melee', 0, 'earth'], ['Spider', 'insect', 'melee', 1, 'poison'], ['Owl', 'bird', 'ranged', 0, 'wind'], ['Shroom', 'mushroom', 'caster', 0, 'poison']],
    swamp: [['Bog Slime', 'slime', 'melee', 1, 'poison'], ['Toad', 'beast', 'ranged', 0, 'water'], ['Leech', 'insect', 'melee', 1, 'blood'], ['Witch Moss', 'plant', 'caster', 0, 'poison'], ['Marsh Wraith', 'spirit', 'caster', 1, 'dark']],
    beach: [['Crab', 'crab', 'melee', 0, 'water'], ['Gull', 'bird', 'melee', 1, 'wind'], ['Sea Jelly', 'slime', 'melee', 0, 'water'], ['Drowned', 'undead', 'melee', 1, 'water']],
    ruins: [['Skeleton', 'undead', 'melee', 1, 'dark'], ['Golem', 'golem', 'melee', 0, 'earth'], ['Wisp', 'spirit', 'caster', 1, 'holy'], ['Gargoyle', 'bird', 'melee', 1, 'earth'], ['Fallen Knight', 'knight', 'melee', 1, 'dark']],
    desert: [['Scorpion', 'scorpion', 'melee', 1, 'poison'], ['Sandworm', 'insect', 'melee', 1, 'earth'], ['Mummy', 'undead', 'melee', 1, 'dark'], ['Dust Djinn', 'spirit', 'caster', 1, 'wind'], ['Vulture', 'bird', 'melee', 1, 'wind']],
    snow: [['Yeti', 'golem', 'melee', 1, 'ice'], ['Frost Wolf', 'beast', 'melee', 1, 'ice'], ['Frost Wisp', 'spirit', 'caster', 1, 'ice'], ['Ice Golem', 'golem', 'melee', 0, 'ice'], ['Snow Owl', 'bird', 'ranged', 1, 'ice']],
    crystal: [['Crystal Golem', 'golem', 'melee', 0, 'earth'], ['Gem Spider', 'insect', 'melee', 1, 'earth'], ['Shard Wisp', 'spirit', 'caster', 1, 'lightning'], ['Prism Slime', 'slime', 'melee', 1, 'lightning']],
    volcano: [['Imp', 'imp', 'caster', 1, 'fire'], ['Magma Golem', 'golem', 'melee', 1, 'fire'], ['Salamander', 'beast', 'melee', 1, 'fire'], ['Ember Wisp', 'spirit', 'caster', 1, 'fire'], ['Fire Drake', 'dragon', 'ranged', 1, 'fire']],
    sky: [['Harpy', 'bird', 'melee', 1, 'wind'], ['Thunderbird', 'bird', 'ranged', 1, 'lightning'], ['Cloud Slime', 'slime', 'melee', 0, 'water'], ['Sky Knight', 'knight', 'melee', 1, 'holy'], ['Seraph Construct', 'golem', 'caster', 1, 'holy']],
    abyss: [['Void Wraith', 'spirit', 'caster', 1, 'dark'], ['Abyss Knight', 'knight', 'melee', 1, 'dark'], ['Gazer', 'eye', 'caster', 1, 'dark'], ['Void Drake', 'dragon', 'ranged', 1, 'dark'], ['Shadow Beast', 'beast', 'melee', 1, 'dark']]
  };
  const BOSS_TITLES = ['the Tyrant', 'the Devourer', 'the Ancient', 'the Undying', 'the Colossus', 'the Dread', 'the Sovereign', 'the Wrathful', 'Overlord', 'the Eternal'];
  const MONSTER_PREFIX = ['', 'Elder ', 'Wild ', 'Feral ', 'Savage ', 'Grim ', 'Dire ', 'Ancient ', 'Cursed ', 'Primal '];

  const WORLD_BOSSES = [
    { id: 'wb_kraken', name: 'Abyssal Leviathan', shape: 'eye', element: 'water', color: '#3a70ff' },
    { id: 'wb_dragon', name: 'Ignaroth the World Burner', shape: 'dragon', element: 'fire', color: '#ff5a1a' },
    { id: 'wb_titan', name: 'Gaia Colossus', shape: 'golem', element: 'earth', color: '#b08040' },
    { id: 'wb_lich', name: 'Mor\'Vael the Lich Emperor', shape: 'undead', element: 'dark', color: '#a050ff' }
  ];
  const WORLD_BOSS_HOURS = [12, 19, 22];
  const GVG_SCHEDULE = { day: 6, hour: 20, durationMin: 60 }; // Saturday 20:00

  // ---------------------------------------------------------------- Items
  const RARITY = [
    { id: 'common', n: 'Common', th: 'ธรรมดา', color: '#d8d8d8', opts: 0, mult: 1.0 },
    { id: 'uncommon', n: 'Uncommon', th: 'ไม่ธรรมดา', color: '#5ee06a', opts: 1, mult: 1.1 },
    { id: 'rare', n: 'Rare', th: 'หายาก', color: '#4aa8ff', opts: 2, mult: 1.25 },
    { id: 'epic', n: 'Epic', th: 'มหากาพย์', color: '#c06cff', opts: 3, mult: 1.45 },
    { id: 'legendary', n: 'Legendary', th: 'ตำนาน', color: '#ff9a2a', opts: 4, mult: 1.7 },
    { id: 'mythic', n: 'Mythic', th: 'เทพนิยาย', color: '#ff3a4a', opts: 5, mult: 2.0 }
  ];
  const SLOTS = ['weapon', 'offhand', 'head', 'armor', 'cloak', 'boots', 'necklace', 'earring', 'ring1', 'ring2'];
  const SLOT_TH = { weapon: 'อาวุธ', offhand: 'มือรอง', head: 'หมวก', armor: 'เกราะ', cloak: 'ผ้าคลุม', boots: 'รองเท้า', necklace: 'สร้อยคอ', earring: 'ต่างหู', ring1: 'แหวน', ring2: 'แหวน' };
  const ACCESSORY_SLOTS = ['necklace', 'earring', 'ring1', 'ring2'];
  const WEAPON_NAMES = {
    sword: ['Short Sword', 'Knight Blade', 'Claymore', 'Runeblade', 'Dragonfang Sword', 'Starsteel Saber', 'Excelsior', 'Sunsplitter', 'Celestial Edge', 'Worldcleaver'],
    spear: ['Iron Pike', 'Guard Lance', 'Halberd', 'Rune Lance', 'Dragoon Spear', 'Aegis Pike', 'Valkyrie Lance', 'Skypiercer', 'Holy Longinus', 'Eternal Bulwark'],
    axe: ['Hand Axe', 'War Axe', 'Bearded Axe', 'Rune Cleaver', 'Bloodreaver', 'Titan Axe', 'Ragefang', 'Doombringer', 'Worldsplitter', 'Godslayer Axe'],
    dagger: ['Knife', 'Stiletto', 'Twin Fangs', 'Venom Kris', 'Shadow Katar', 'Nightclaw', 'Viper Edge', 'Phantom Blades', 'Eclipse Fang', 'Void Reaper'],
    bow: ['Short Bow', 'Hunter Bow', 'Long Bow', 'Rune Bow', 'Gale Bow', 'Falcon Wing', 'Starshot', 'Dragonstring', 'Celestial Arc', 'Eternity Bow'],
    staff: ['Wand', 'Oak Staff', 'Crystal Rod', 'Rune Staff', 'Elemental Scepter', 'Arcane Spire', 'Staff of Storms', 'Phoenix Rod', 'Astral Staff', 'Primordial Staff'],
    mace: ['Club', 'Morning Star', 'Holy Mace', 'Rune Mace', 'Saint Hammer', 'Prayer Book', 'Divine Scepter', 'Seraph Mace', 'Archangel Codex', 'Miracle Hammer'],
    knuckle: ['Wraps', 'Iron Knuckle', 'Tiger Claw', 'Rune Fist', 'Dragon Gauntlet', 'Chi Gloves', 'Asura Fist', 'Heaven Knuckle', 'Bodhi Gauntlet', 'Fist of Eternity'],
    scythe: ['Dark Tome', 'Bone Sickle', 'Grimoire', 'Rune Scythe', 'Necronomicon', 'Soul Reaper', 'Lich Codex', 'Abyss Scythe', 'Eclipse Grimoire', 'Death\'s Embrace'],
    gun: ['Flintlock', 'Revolver', 'Twin Pistols', 'Rune Rifle', 'Hand Cannon', 'Storm Rifle', 'Dragon Musket', 'Railcaster', 'Star Blaster', 'Infinite Arsenal']
  };
  const ARMOR_NAMES = {
    offhand: ['Buckler', 'Kite Shield', 'Tower Shield', 'Rune Shield', 'Aegis', 'Dragon Shield', 'Holy Bulwark', 'Sky Ward', 'Celestial Guard', 'Eternal Aegis'],
    head: ['Cap', 'Helm', 'Great Helm', 'Rune Circlet', 'Dragon Helm', 'Crown of Valor', 'Seraph Halo', 'Storm Crown', 'Star Diadem', 'Godhead'],
    armor: ['Cloth Tunic', 'Leather Armor', 'Chain Mail', 'Rune Plate', 'Dragon Scale', 'Mithril Plate', 'Seraph Robe', 'Storm Armor', 'Astral Plate', 'Eternal Armor'],
    cloak: ['Cape', 'Traveler Cloak', 'Shadow Cape', 'Rune Mantle', 'Dragon Wings', 'Phoenix Cloak', 'Seraph Mantle', 'Storm Cape', 'Nebula Shroud', 'Void Mantle'],
    boots: ['Sandals', 'Boots', 'Greaves', 'Rune Boots', 'Dragon Greaves', 'Windwalkers', 'Seraph Steps', 'Storm Treads', 'Starwalkers', 'Eternal Greaves'],
    necklace: ['Pendant', 'Silver Chain', 'Amulet', 'Rune Locket', 'Dragon Heart', 'Phoenix Tear', 'Seraph Charm', 'Storm Talisman', 'Star Pendant', 'Heart of Eternity'],
    earring: ['Stud', 'Hoop Earring', 'Gem Earring', 'Rune Earring', 'Dragon Earring', 'Moon Drop', 'Seraph Feather', 'Storm Earring', 'Starlight Drop', 'Echo of Gods'],
    ring: ['Band', 'Silver Ring', 'Gem Ring', 'Rune Ring', 'Dragon Ring', 'Phoenix Ring', 'Seraph Ring', 'Storm Ring', 'Star Ring', 'Ring of Eternity']
  };
  // Random option pool: [key, label, base value per item-level, isPercent]
  const OPTIONS = [
    ['atkPct', 'ATK', 0.035, true], ['matkPct', 'MATK', 0.035, true], ['hpPct', 'HP สูงสุด', 0.04, true], ['defPct', 'DEF', 0.04, true],
    ['crit', 'Critical', 0.05, false], ['critDmg', 'Crit Damage', 0.1, true], ['aspdPct', 'ความเร็วโจมตี', 0.03, true],
    ['cdr', 'ลดคูลดาวน์', 0.02, true], ['lifesteal', 'Lifesteal', 0.012, true], ['movePct', 'ความเร็วเดิน', 0.02, true],
    ['str', 'STR', 0.06, false], ['agi', 'AGI', 0.06, false], ['vit', 'VIT', 0.06, false], ['int', 'INT', 0.06, false], ['dex', 'DEX', 0.06, false], ['luk', 'LUK', 0.06, false],
    ['comboDmg', 'ดาเมจคอมโบ', 0.03, true], ['bossDmg', 'ดาเมจต่อบอส', 0.04, true], ['pvpDmg', 'ดาเมจ PvP', 0.03, true], ['pvpRes', 'ลดดาเมจ PvP', 0.03, true]
  ];

  const RUNE_KINDS = {
    fury: { n: 'Fury Rune', stat: 'atkPct', per: 3, color: '#ff5a3a', type: 'Offense' },
    arcane: { n: 'Arcane Rune', stat: 'matkPct', per: 3, color: '#5ad0ff', type: 'Offense' },
    keen: { n: 'Keen Rune', stat: 'crit', per: 2, color: '#ffe05a', type: 'Offense' },
    combo: { n: 'Combo Rune', stat: 'comboDmg', per: 3, color: '#ff8ae0', type: 'Skill' },
    haste: { n: 'Haste Rune', stat: 'cdr', per: 1.5, color: '#9cf5b0', type: 'Skill' },
    swift: { n: 'Swift Rune', stat: 'aspdPct', per: 2.5, color: '#a0ff70', type: 'Utility' },
    bastion: { n: 'Bastion Rune', stat: 'defPct', per: 4, color: '#c0c0c0', type: 'Defense' },
    vigor: { n: 'Vigor Rune', stat: 'hpPct', per: 4, color: '#5ee06a', type: 'Defense' },
    leech: { n: 'Leech Rune', stat: 'lifesteal', per: 0.8, color: '#e0303a', type: 'Utility' },
    titan: { n: 'Titan Rune (Boss)', stat: 'bossDmg', per: 6, color: '#ff9a2a', type: 'Boss' }
  };
  const RUNE_TIERS = ['I', 'II', 'III', 'IV', 'V'];
  const JEWELS = {
    ruby: { n: 'Ruby', stat: 'atkPct', per: 1.5, color: '#ff3a4a' }, sapphire: { n: 'Sapphire', stat: 'matkPct', per: 1.5, color: '#3a7aff' },
    emerald: { n: 'Emerald', stat: 'hpPct', per: 2, color: '#3ae06a' }, topaz: { n: 'Topaz', stat: 'crit', per: 1, color: '#ffd03a' },
    diamond: { n: 'Diamond', stat: 'defPct', per: 2, color: '#e0f4ff' }, amethyst: { n: 'Amethyst', stat: 'cdr', per: 0.8, color: '#b05cff' }
  };

  // Stackable items (consumables & materials)
  const ITEMS = {
    pot_hp_1: { n: 'Red Potion', th: 'ยาแดง', type: 'potion', hp: 250, lv: 1, price: 25, icon: '#e33' },
    pot_hp_2: { n: 'Orange Potion', th: 'ยาส้ม', type: 'potion', hp: 900, lv: 30, price: 90, icon: '#f83' },
    pot_hp_3: { n: 'Yellow Potion', th: 'ยาเหลือง', type: 'potion', hp: 2600, lv: 80, price: 260, icon: '#fd3' },
    pot_hp_4: { n: 'White Potion', th: 'ยาขาว', type: 'potion', hp: 6500, lv: 140, price: 650, icon: '#eee' },
    pot_hp_5: { n: 'Elixir of Life', th: 'อีลิกเซอร์', type: 'potion', hp: 15000, lv: 200, price: 1500, icon: '#f5a' },
    pot_sp_1: { n: 'Blue Potion', th: 'ยาฟ้า', type: 'potion', sp: 60, lv: 1, price: 60, icon: '#39f' },
    pot_sp_2: { n: 'Mana Potion', th: 'ยามานา', type: 'potion', sp: 180, lv: 50, price: 180, icon: '#36d' },
    pot_sp_3: { n: 'Grand Mana Potion', th: 'ยามานาใหญ่', type: 'potion', sp: 500, lv: 120, price: 500, icon: '#63f' },
    pot_sp_4: { n: 'Ether of Sages', th: 'อีเธอร์', type: 'potion', sp: 1200, lv: 200, price: 1200, icon: '#a3f' },
    tele_scroll: { n: 'Return Scroll', th: 'ม้วนกลับเมือง', type: 'scroll', price: 100, icon: '#9cf' },
    ore_refine: { n: 'Refine Ore', th: 'แร่ตีบวก', type: 'mat', price: 300, icon: '#aaa' },
    crystal_pure: { n: 'Pure Refine Crystal', th: 'คริสตัลบริสุทธิ์', type: 'mat', price: 0, icon: '#7df' },
    crystal_divine: { n: 'Divine Crystal', th: 'คริสตัลศักดิ์สิทธิ์', type: 'mat', price: 0, icon: '#fd7' },
    scroll_protect: { n: 'Protection Scroll', th: 'ม้วนกันพัง', type: 'mat', price: 25000, icon: '#7f7' },
    scroll_bless: { n: 'Blessed Scroll', th: 'ม้วนกันลด', type: 'mat', price: 60000, icon: '#ff7' },
    rune_drill: { n: 'Rune Drill', th: 'สว่านเจาะรู', type: 'mat', price: 15000, icon: '#c96' },
    reroll_stone: { n: 'Reroll Stone', th: 'หินสุ่มออปชั่น', type: 'mat', price: 20000, icon: '#c6f' },
    memory_crystal: { n: 'Memory Crystal', th: 'คริสตัลรีเซ็ตสกิล', type: 'mat', price: 50000, icon: '#6ff' },
    stat_reset: { n: 'Rebirth Elixir', th: 'ยารีเซ็ตสเตตัส', type: 'mat', price: 50000, icon: '#f6f' },
    guild_emblem: { n: 'Guild Emblem', th: 'ตรากิลด์', type: 'mat', price: 100000, icon: '#fc3' },
    monster_core: { n: 'Monster Core', th: 'แกนมอนสเตอร์', type: 'loot', price: 0, sell: 15, icon: '#a86' }
  };
  for (const k in RUNE_KINDS) for (let t = 1; t <= 5; t++)
    ITEMS[`rune_${k}_${t}`] = { n: `${RUNE_KINDS[k].n} ${RUNE_TIERS[t - 1]}`, th: 'รูน', type: 'rune', kind: k, tier: t, sell: 100 * t * t, icon: RUNE_KINDS[k].color };
  for (const k in JEWELS) for (let l = 1; l <= 10; l++)
    ITEMS[`jewel_${k}_${l}`] = { n: `${JEWELS[k].n} Lv${l}`, th: 'อัญมณี', type: 'jewel', kind: k, tier: l, sell: 80 * l * l, icon: JEWELS[k].color };

  const SHOP = {
    aurelia: ['pot_hp_1', 'pot_hp_2', 'pot_sp_1', 'tele_scroll', 'ore_refine', 'scroll_protect', 'rune_drill', 'reroll_stone', 'memory_crystal', 'stat_reset', 'guild_emblem'],
    sandhaven: ['pot_hp_1', 'pot_hp_2', 'pot_hp_3', 'pot_sp_1', 'pot_sp_2', 'tele_scroll', 'ore_refine', 'scroll_protect', 'rune_drill', 'reroll_stone'],
    frostholm: ['pot_hp_2', 'pot_hp_3', 'pot_sp_2', 'pot_sp_3', 'tele_scroll', 'ore_refine', 'scroll_protect', 'scroll_bless', 'rune_drill', 'reroll_stone', 'memory_crystal'],
    emberforge: ['pot_hp_3', 'pot_hp_4', 'pot_sp_2', 'pot_sp_3', 'tele_scroll', 'ore_refine', 'scroll_protect', 'scroll_bless', 'rune_drill', 'reroll_stone', 'memory_crystal', 'stat_reset'],
    skyreach: ['pot_hp_4', 'pot_hp_5', 'pot_sp_3', 'pot_sp_4', 'tele_scroll', 'ore_refine', 'scroll_protect', 'scroll_bless', 'rune_drill', 'reroll_stone', 'memory_crystal', 'stat_reset', 'guild_emblem']
  };

  // Refine +1..+20 (index = target level - 1)
  const REFINE_RATES = [100, 96, 92, 88, 84, 80, 70, 62, 54, 45, 40, 33, 27, 21, 15, 12, 9, 6, 4, 2];
  const ACC_REFINE_MAX = 10;
  function refineCost(target) {
    if (target <= 10) return { mat: 'ore_refine', qty: 1 + Math.floor(target / 3), zeny: 500 * target * target };
    if (target <= 15) return { mat: 'crystal_pure', qty: target - 9, zeny: 20000 * (target - 9) };
    return { mat: 'crystal_divine', qty: target - 14, zeny: 100000 * (target - 14) };
  }
  // what happens on failure when trying to reach `target`
  function refineFail(target) {
    if (target <= 6) return { down: 0, breakChance: 0 };
    if (target <= 10) return { down: 1, breakChance: 0 };
    if (target <= 15) return { down: 3, downMin: 1, breakChance: 0 };
    return { down: 3, breakChance: 0.6 };
  }

  // NPC layout in every town (offset from town center)
  const TOWN_NPCS = [
    { role: 'shop', name: 'Merchant Lyra', th: 'ร้านค้า', dx: -8, dy: -4, color: '#f0c050' },
    { role: 'refine', name: 'Blacksmith Torvald', th: 'ช่างตีบวก', dx: 8, dy: -4, color: '#d06a3a' },
    { role: 'rune', name: 'Runemaster Ysolde', th: 'ช่างรูน/ประดับ', dx: 10, dy: 3, color: '#8a6aff' },
    { role: 'teleport', name: 'Gatekeeper Aris', th: 'เทเลพอร์ต', dx: 0, dy: -9, color: '#5ad0ff' },
    { role: 'dungeon', name: 'Warden Kael', th: 'ผู้คุมดันเจี้ยน', dx: -10, dy: 3, color: '#a050ff' },
    { role: 'guild', name: 'Herald Brann', th: 'กิลด์ / ปราสาท', dx: -5, dy: 8, color: '#ffd03a' },
    { role: 'arena', name: 'Arena Master Vex', th: 'สนาม PvP / World Boss', dx: 5, dy: 8, color: '#ff4f5a' },
    { role: 'healer', name: 'Sister Mira', th: 'ฮีลฟรี + บัฟ', dx: 0, dy: 4, color: '#ffffff' }
  ];

  return {
    MAX_LEVEL, CLASSES, CLASS_IDS, STATS, STAT_INFO, TAGS, TAG_IDS, ELEMENTS, REACTIONS, BIOMES, TOWNS, FARM_MAPS,
    DUNGEONS, DUNGEON_FLOORS, dungeonLevel, SPECIAL_MAPS, CASTLES, FAMILIES, BOSS_TITLES, MONSTER_PREFIX, WORLD_BOSSES,
    WORLD_BOSS_HOURS, GVG_SCHEDULE, RARITY, SLOTS, SLOT_TH, ACCESSORY_SLOTS, WEAPON_NAMES, ARMOR_NAMES, OPTIONS,
    RUNE_KINDS, RUNE_TIERS, JEWELS, ITEMS, SHOP, REFINE_RATES, ACC_REFINE_MAX, refineCost, refineFail, TOWN_NPCS
  };
});

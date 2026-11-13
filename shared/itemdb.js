// Item database v2 (RO-style): every monster species of every region has its own materials, junk, trophy and card;
// every field map has its own named gear (Common–Epic), dungeons drop named Legendary gear, and Legendary/Mythic
// gear can be crafted from regional trophies + boss materials. Generated deterministically, shared by server & client.
(function (root, factory) {
  const isNode = typeof require === 'function' && typeof module === 'object';
  const D = isNode ? require('./data.js') : root.NO_DATA;
  const RNG = isNode ? require('./rng.js') : root.NO_RNG;
  factory(D, RNG);
  if (isNode && module.exports) module.exports = D;
})(typeof self !== 'undefined' ? self : this, function (D, RNG) {
  if (D.ITEMDB) return; D.ITEMDB = true;
  const H = (s) => RNG.hashStr(s);
  const r1 = (x) => Math.round(x * 10) / 10;
  const add = (id, o) => { D.ITEMS[id] = o; return id; };

  // ---------------------------------------------------------------- bigger affix pool (random options on every piece of gear)
  const EL_TH = { fire: 'ไฟ', ice: 'น้ำแข็ง', lightning: 'สายฟ้า', water: 'น้ำ', wind: 'ลม', earth: 'ดิน', holy: 'ศักดิ์สิทธิ์', dark: 'มืด', poison: 'พิษ', blood: 'โลหิต', neutral: 'ไร้ธาตุ' };
  const MORE_OPTS = [
    ['mdefPct', 'MDEF', 0.04, true], ['flee', 'Flee', 0.12, false], ['hit', 'Hit', 0.12, false], ['castReduce', 'ร่ายเร็ว', 0.025, true], ['dmgReduce', 'ลดดาเมจที่ได้รับ', 0.012, true],
    ['ccRes', 'ต้านการควบคุม', 0.04, true], ['regenPct', 'ฟื้นฟู HP', 0.25, true], ['spPct', 'SP สูงสุด', 0.04, true], ['dmgPct', 'ดาเมจทั้งหมด', 0.018, true], ['dropPct', 'อัตราดรอป', 0.03, true],
    ['atk', 'ATK', 0.5, false], ['matk', 'MATK', 0.5, false], ['hp', 'HP', 2.6, false], ['def', 'DEF', 0.3, false]
  ];
  for (const el in EL_TH) {
    MORE_OPTS.push([el + 'Dmg', `ดาเมจธาตุ${EL_TH[el]}`, 0.035, true]);
    MORE_OPTS.push([el + 'Res', `ต้านธาตุ${EL_TH[el]}`, 0.04, true]);
  }
  for (const o of MORE_OPTS) if (!D.OPTIONS.some((x) => x[0] === o[0])) D.OPTIONS.push(o);
  // name parts from an item's strongest option: "<Prefix> <base> <of Suffix>"
  D.AFFIX_NAME = {
    atkPct: ['Brutal', 'of Might'], matkPct: ['Arcane', 'of Sorcery'], hpPct: ['Hearty', 'of the Bear'], defPct: ['Sturdy', 'of the Turtle'], crit: ['Keen', 'of Precision'], critDmg: ['Savage', 'of Ruin'],
    aspdPct: ['Swift', 'of Haste'], cdr: ['Timeless', 'of Ages'], lifesteal: ['Vampiric', 'of the Leech'], movePct: ['Fleet', 'of the Wind'], str: ['Mighty', 'of the Ox'], agi: ['Nimble', 'of the Cat'],
    vit: ['Robust', 'of the Oak'], int: ['Wise', 'of the Owl'], dex: ['Deft', 'of the Hawk'], luk: ['Lucky', 'of Fortune'], comboDmg: ['Rhythmic', 'of Chains'], bossDmg: ['Giantslayer', 'of the Titan'],
    pvpDmg: ['Duelist', 'of Conquest'], pvpRes: ['Stalwart', 'of the Bastion'], mdefPct: ['Warded', 'of Warding'], flee: ['Elusive', 'of Shadows'], hit: ['Accurate', 'of the Eagle'], castReduce: ['Fluent', 'of Incantation'],
    dmgReduce: ['Bulwark', 'of Endurance'], ccRes: ['Unbending', 'of Will'], regenPct: ['Renewing', 'of Renewal'], spPct: ['Mystic', 'of the Well'], dmgPct: ['Fierce', 'of Slaughter'], dropPct: ['Prospector', 'of Plunder'],
    atk: ['Sharp', 'of Edges'], matk: ['Charged', 'of Sparks'], hp: ['Vital', 'of Life'], def: ['Plated', 'of Iron'],
    fireDmg: ['Blazing', 'of Embers'], iceDmg: ['Frigid', 'of Winter'], lightningDmg: ['Shocking', 'of Thunder'], waterDmg: ['Tidal', 'of the Deep'], windDmg: ['Gale', 'of Storms'], earthDmg: ['Quaking', 'of Stone'],
    holyDmg: ['Hallowed', 'of Light'], darkDmg: ['Umbral', 'of Night'], poisonDmg: ['Venomous', 'of Venom'], bloodDmg: ['Sanguine', 'of Blood'], neutralDmg: ['Pure', 'of Purity'],
    fireRes: ['Fireproof', 'of the Salamander'], iceRes: ['Insulated', 'of the Yeti'], lightningRes: ['Grounded', 'of the Rod'], waterRes: ['Sealed', 'of the Reef'], windRes: ['Anchored', 'of the Mountain'], earthRes: ['Rooted', 'of the Hills'],
    holyRes: ['Profane', 'of Heresy'], darkRes: ['Radiant', 'of Dawn'], poisonRes: ['Antidotal', 'of Purging'], bloodRes: ['Clotting', 'of Mending'], neutralRes: ['Tempered', 'of Balance']
  };

  // ---------------------------------------------------------------- more monster families: every biome gets six more (100+ monster types)
  const MORE_FAM = {
    meadow: [['Puffball', 'slime', 'melee', 0, 'wind'], ['Field Mouse', 'beast', 'melee', 0, 'neutral'], ['Honey Moth', 'insect', 'ranged', 0, 'wind'], ['Clover Sprite', 'spirit', 'caster', 0, 'holy'], ['Mud Crab', 'crab', 'melee', 0, 'earth'], ['Scarecrow', 'undead', 'melee', 1, 'neutral']],
    forest: [['Tusk Boar', 'beast', 'melee', 1, 'earth'], ['Bark Golem', 'golem', 'melee', 0, 'earth'], ['Hornet', 'insect', 'melee', 1, 'poison'], ['Dryad', 'spirit', 'caster', 1, 'earth'], ['Woodland Imp', 'imp', 'caster', 1, 'wind'], ['Grizzly', 'beast', 'melee', 1, 'neutral']],
    swamp: [['Croco', 'beast', 'melee', 1, 'water'], ['Rot Zombie', 'undead', 'melee', 1, 'poison'], ['Gloom Shroom', 'mushroom', 'caster', 1, 'dark'], ['Mosquito Swarm', 'insect', 'melee', 1, 'blood'], ['Bog Eye', 'eye', 'caster', 1, 'poison'], ['Mire Golem', 'golem', 'melee', 0, 'water']],
    beach: [['Hermit Crab', 'crab', 'melee', 0, 'earth'], ['Sea Serpent', 'dragon', 'ranged', 1, 'water'], ['Coral Golem', 'golem', 'melee', 0, 'water'], ['Pirate Skeleton', 'undead', 'melee', 1, 'neutral'], ['Siren', 'spirit', 'caster', 1, 'water'], ['Starfish', 'slime', 'melee', 0, 'water']],
    ruins: [['Lich Acolyte', 'undead', 'caster', 1, 'dark'], ['Stone Sentinel', 'golem', 'melee', 1, 'earth'], ['Ruin Bat', 'bird', 'melee', 1, 'dark'], ['Mimic', 'crab', 'melee', 1, 'neutral'], ['Wraith Knight', 'knight', 'melee', 1, 'dark'], ['Cursed Tome', 'eye', 'caster', 1, 'dark']],
    desert: [['Sand Golem', 'golem', 'melee', 0, 'earth'], ['Desert Fox', 'beast', 'melee', 1, 'fire'], ['Cactus Brute', 'plant', 'melee', 1, 'earth'], ['Sand Wraith', 'spirit', 'caster', 1, 'wind'], ['Anubis Guard', 'knight', 'melee', 1, 'dark'], ['Fire Ant', 'insect', 'melee', 1, 'fire']],
    snow: [['Snow Hare', 'beast', 'melee', 0, 'ice'], ['Frost Giant', 'golem', 'melee', 1, 'ice'], ['Ice Wraith', 'spirit', 'caster', 1, 'ice'], ['Penguin Knight', 'knight', 'melee', 1, 'water'], ['Frost Wyrm', 'dragon', 'ranged', 1, 'ice'], ['Snow Slime', 'slime', 'melee', 0, 'ice']],
    crystal: [['Quartz Bat', 'bird', 'melee', 1, 'lightning'], ['Geode Crab', 'crab', 'melee', 1, 'earth'], ['Crystal Eye', 'eye', 'caster', 1, 'lightning'], ['Amethyst Knight', 'knight', 'melee', 1, 'dark'], ['Lumin Moth', 'insect', 'ranged', 1, 'holy'], ['Mana Elemental', 'spirit', 'caster', 1, 'lightning']],
    volcano: [['Lava Slime', 'slime', 'melee', 1, 'fire'], ['Hellhound', 'beast', 'melee', 1, 'fire'], ['Obsidian Golem', 'golem', 'melee', 1, 'earth'], ['Flame Knight', 'knight', 'melee', 1, 'fire'], ['Ash Ghoul', 'undead', 'caster', 1, 'fire'], ['Phoenix Chick', 'bird', 'ranged', 1, 'fire']],
    sky: [['Cloud Sheep', 'beast', 'melee', 0, 'wind'], ['Storm Wisp', 'spirit', 'caster', 1, 'lightning'], ['Valkyrie', 'knight', 'melee', 1, 'holy'], ['Sky Serpent', 'dragon', 'ranged', 1, 'wind'], ['Angel Eye', 'eye', 'caster', 1, 'holy'], ['Feather Golem', 'golem', 'melee', 1, 'wind']],
    abyss: [['Void Slime', 'slime', 'melee', 1, 'dark'], ['Bone Dragon', 'dragon', 'ranged', 1, 'dark'], ['Abyss Imp', 'imp', 'caster', 1, 'dark'], ['Nightmare', 'beast', 'melee', 1, 'dark'], ['Soul Eater', 'eye', 'caster', 1, 'dark'], ['Void Golem', 'golem', 'melee', 1, 'dark']]
  };
  for (const b in MORE_FAM) if (D.FAMILIES[b]) for (const f of MORE_FAM[b]) if (!D.FAMILIES[b].some((x) => x[0] === f[0])) D.FAMILIES[b].push(f);
  D.FAMILY_COUNT = new Set(Object.values(D.FAMILIES).flat().map((f) => f[0])).size;

  // ---------------------------------------------------------------- regions
  D.REGIONS = [
    { id: 'aurelia', n: 'Aurelia Plains', th: 'ที่ราบออเรเลีย', town: 'aurelia', adj: 'Aurelian', maps: [0, 1, 2, 3, 4], color: '#7ad05a' },
    { id: 'sandhaven', n: 'Sandhaven Sands', th: 'ทะเลทรายแซนด์เฮเวน', town: 'sandhaven', adj: 'Sunforged', maps: [5, 6, 7, 8, 9], color: '#e0b050' },
    { id: 'frostholm', n: 'Frostholm North', th: 'แดนเหนือฟรอสต์โฮล์ม', town: 'frostholm', adj: 'Glacierheart', maps: [10, 11, 12, 13, 14], color: '#8ad0ff' },
    { id: 'emberforge', n: 'Emberforge Wastes', th: 'แดนเพลิงเอมเบอร์ฟอร์จ', town: 'emberforge', adj: 'Emberlord', maps: [15, 16, 17, 18, 19], color: '#ff7a3a' },
    { id: 'skyreach', n: 'Skyreach Heavens', th: 'สรวงสวรรค์สกายรีช', town: 'skyreach', adj: 'Skyborne', maps: [20, 21, 22, 23, 24], color: '#c8b0ff' }
  ];
  D.regionOfMap = (idx) => D.REGIONS[Math.min(4, Math.floor(idx / 5))];
  const MAP_ADJ = ['Verdant', 'Whisperwood', 'Mossbound', 'Seabreeze', 'Ruinstone', 'Goldsand', 'Scorpion', 'Mirage', 'Templar', 'Thornwild',
    'Frostbite', 'Glacial', 'Howling', 'Crystalline', 'Blighted', 'Ashen', 'Magmaforged', 'Obsidian', 'Dragonbone', 'Stormcalled',
    'Cloudwoven', 'Celestial', 'Voidtouched', 'Shardbound', 'Abyssal'];
  D.MAP_ADJ = MAP_ADJ;

  // ---------------------------------------------------------------- monster parts by body shape: [common, uncommon, trophy, junk] + icon keys
  const PARTS = {
    slime: [['Gel', 'gel'], ['Jelly Core', 'orb'], ['Prismatic Nucleus', 'orb'], ['Sticky Residue', 'gel']],
    beast: [['Fur', 'fur'], ['Fang', 'fang'], ['Alpha Heart', 'heart'], ['Matted Hair', 'fur']],
    plant: [['Leaf', 'leaf'], ['Root', 'root'], ['Heartwood Seed', 'seed'], ['Withered Twig', 'root']],
    insect: [['Chitin', 'chitin'], ['Stinger', 'stinger'], ['Queen Jelly', 'gel'], ['Broken Wing', 'feather']],
    bird: [['Feather', 'feather'], ['Talon', 'talon'], ['Sky Plume', 'feather'], ['Molted Down', 'feather']],
    mushroom: [['Spore', 'spore'], ['Cap', 'cap'], ['Mycelium Crown', 'cap'], ['Rotten Stalk', 'root']],
    spirit: [['Ectoplasm', 'ecto'], ['Soul Shard', 'shard'], ['Spirit Essence', 'orb'], ['Faded Wisp', 'ecto']],
    undead: [['Bone', 'bone'], ['Grave Dust', 'dust'], ['Phylactery', 'orb'], ['Rotten Bandage', 'cloth']],
    golem: [['Stone Fragment', 'stone'], ['Golem Core', 'core'], ['Titan Heart', 'heart'], ['Pebble', 'stone']],
    knight: [['Armor Plate', 'plate'], ['Knight Seal', 'seal'], ['Oathbound Crest', 'seal'], ['Rusted Rivet', 'plate']],
    crab: [['Shell', 'shell'], ['Pincer', 'pincer'], ['Pearl Heart', 'pearl'], ['Cracked Shell', 'shell']],
    scorpion: [['Carapace', 'chitin'], ['Venom Gland', 'gland'], ['Royal Stinger', 'stinger'], ['Dry Husk', 'chitin']],
    imp: [['Horn', 'horn'], ['Ember Core', 'ember'], ['Infernal Sigil', 'seal'], ['Ash Clump', 'dust']],
    dragon: [['Scale', 'scale'], ['Dragon Fang', 'fang'], ['Dragon Heart', 'heart'], ['Shed Skin', 'cloth']],
    eye: [['Lens', 'lens'], ['Optic Nerve', 'root'], ['Void Iris', 'lens'], ['Murky Tear', 'gel']]
  };
  const ELC = (el) => (D.ELEMENTS[el] || D.ELEMENTS.neutral).color;

  // ---------------------------------------------------------------- card stat pool (every species card is a distinct pair)
  const CARD_POOL = [
    ['atkPct', 0.9], ['matkPct', 0.9], ['hpPct', 1.1], ['defPct', 1.2], ['mdefPct', 1.2], ['crit', 0.5], ['critDmg', 1.6], ['aspdPct', 0.8],
    ['cdr', 0.35], ['lifesteal', 0.25], ['movePct', 0.7], ['str', 1.2], ['agi', 1.2], ['vit', 1.2], ['int', 1.2], ['dex', 1.2], ['luk', 1.2],
    ['comboDmg', 1], ['bossDmg', 1.3], ['dropPct', 0.8], ['flee', 1.5], ['hit', 1.5], ['castReduce', 0.6], ['dmgReduce', 0.35], ['ccRes', 0.9],
    ['regenPct', 4], ['spPct', 1.2], ['dmgPct', 0.5], ['pvpDmg', 0.9], ['pvpRes', 0.9]
  ];
  const usedCards = new Set();
  function cardMods(key, tier) {
    const h = H('card:' + key);
    let a = (h >>> 0) % CARD_POOL.length, b = (h >>> 7) % CARD_POOL.length, k = 0;
    while ((a === b || usedCards.has(a + ':' + b)) && k++ < 900) { b = (b + 1) % CARD_POOL.length; if (b === 0) a = (a + 1) % CARD_POOL.length; }
    usedCards.add(a + ':' + b);
    const sc = 1 + tier * 0.22;
    const v = (p) => { const x = CARD_POOL[p][1] * sc * 2; return CARD_POOL[p][1] >= 1 ? Math.round(x) : r1(x); };
    return { [CARD_POOL[a][0]]: v(a), [CARD_POOL[b][0]]: r1(v(b) * 0.7) || 0.1 };
  }

  // ---------------------------------------------------------------- species (bestiary entries)
  D.SPECIES = {};
  const famColor = (biome, name) => { const h = H(biome + name); return `hsl(${h % 360},${45 + (h >> 9) % 35}%,${45 + (h >> 17) % 18}%)`; };
  D.famColor = famColor;
  const usedNames = new Set();
  function addSpecies(id, o) {
    let n = o.name; if (usedNames.has(n)) n = o.alt + ' ' + o.fam[0]; usedNames.add(n); o.name = n;
    o.id = id; o.shape = o.fam[1]; o.element = o.fam[4] || 'neutral'; o.color = o.color || famColor(o.biome, o.fam[0]);
    const P = PARTS[o.shape] || PARTS.beast, tier = o.tier, base = n.replace(/^Elite /, '');
    const sell = (k) => Math.round((6 + o.lv * 0.9) * k);
    o.mats = [
      add(`mat_${id}_1`, { n: `${base} ${P[0][0]}`, th: `วัตถุดิบ · ${o.where}`, type: 'loot', mat: 1, ic: P[0][1], icon: o.color, sell: sell(1), tier, sp: id }),
      add(`mat_${id}_2`, { n: `${base} ${P[1][0]}`, th: `วัตถุดิบหายาก · ${o.where}`, type: 'loot', mat: 2, ic: P[1][1], icon: ELC(o.element), sell: sell(3), tier, sp: id }),
      add(`mat_${id}_3`, { n: `Pristine ${base} ${P[2][0]}`, th: `ถ้วยรางวัล (คราฟต์ Legendary) · ${o.where}`, type: 'loot', mat: 3, ic: P[2][1], icon: '#ffd34a', sell: sell(25), tier, sp: id, glow: 1 })
    ];
    o.junk = add(`junk_${id}`, { n: `${base} ${P[3][0]}`, th: 'ไอเทมขยะ (ขายร้านค้า)', type: 'junk', ic: P[3][1], icon: '#8a8070', sell: sell(1.6), tier, sp: id });
    o.card = add(`card_${id}`, { n: `${base} Card`, th: 'การ์ดมอนสเตอร์ (ฝังในช่องรูน)', type: 'card', mods: cardMods(id, tier), ic: 'card', icon: o.color, sell: 500 + o.lv * 40, tier, sp: id, shape: o.shape, el: o.element });
    D.SPECIES[id] = o;
    return o;
  }

  // ---------------------------------------------------------------- named gear bases
  D.GEAR = {};
  const SLOT_LIST = ['offhand', 'head', 'armor', 'cloak', 'boots', 'necklace', 'earring', 'ring'];
  const BIOME_IMP = {
    meadow: [['hpPct', 0.05], ['regenPct', 0.3]], forest: [['aspdPct', 0.035], ['dex', 0.07]], swamp: [['ccRes', 0.05], ['lifesteal', 0.012]],
    beach: [['movePct', 0.03], ['flee', 0.12]], ruins: [['defPct', 0.05], ['mdefPct', 0.05]], desert: [['critDmg', 0.12], ['crit', 0.05]],
    snow: [['dmgReduce', 0.015], ['hpPct', 0.05]], crystal: [['matkPct', 0.04], ['castReduce', 0.03]], volcano: [['atkPct', 0.04], ['dmgPct', 0.02]],
    sky: [['cdr', 0.02], ['spPct', 0.05]], abyss: [['dmgPct', 0.025], ['lifesteal', 0.012]]
  };
  const WEAPON_IMP = { sword: 'atkPct', spear: 'defPct', axe: 'critDmg', dagger: 'crit', bow: 'aspdPct', staff: 'matkPct', mace: 'matkPct', knuckle: 'comboDmg', scythe: 'lifesteal', gun: 'aspdPct', chakram: 'cdr', orb: 'matkPct', claw: 'lifesteal', katana: 'critDmg', prism: 'castReduce' };
  const IMP_PER = { cdr: 0.02, castReduce: 0.03, atkPct: 0.04, defPct: 0.05, critDmg: 0.12, crit: 0.05, aspdPct: 0.035, matkPct: 0.04, comboDmg: 0.04, lifesteal: 0.012 };
  function addGear(id, o) { o.id = id; D.GEAR[id] = o; return id; }
  // field gear: every map has its own 10 weapons + 8 armours/accessories (Common–Epic)
  D.MAP_GEAR = {};
  D.FARM_MAPS.forEach((f, i) => {
    const adj = MAP_ADJ[i], tier = Math.min(9, Math.floor(((f.min + f.max) / 2) / 25)), ilv = Math.round((f.min + f.max) / 2);
    const list = [];
    for (const wt in D.WEAPON_NAMES) {
      const noun = D.WEAPON_NAMES[wt][tier].split(' ').slice(-1)[0];
      const imp = [[WEAPON_IMP[wt], IMP_PER[WEAPON_IMP[wt]]], BIOME_IMP[f.biome][i % 2]];
      list.push(addGear(`g_${f.id}_${wt}`, { n: `${adj} ${noun}`, slot: 'weapon', wtype: wt, ilv, imp, map: f.id, region: D.regionOfMap(i).id, maxR: 3, src: 'field' }));
    }
    for (const s of SLOT_LIST) {
      const nm = D.ARMOR_NAMES[s][tier];
      list.push(addGear(`g_${f.id}_${s}`, { n: `${adj} ${nm.split(' ').slice(-1)[0]}`, slot: s, ilv, imp: [BIOME_IMP[f.biome][(i + SLOT_LIST.indexOf(s)) % 2]], map: f.id, region: D.regionOfMap(i).id, maxR: 3, src: 'field' }));
    }
    // make names unique
    for (const id of list) { const g = D.GEAR[id]; let n = g.n, k = 2; while (Object.values(D.GEAR).some((x) => x !== g && x.n === n)) n = g.n + ' ' + ['II', 'III', 'IV', 'V'][k++ - 2]; g.n = n; }
    D.MAP_GEAR[f.id] = list;
  });
  // dungeon legendaries
  const LEG_NOUN = {
    sword: 'Greatblade', spear: 'Glaive', axe: 'Executioner', dagger: 'Fangblade', bow: 'Longbow', staff: 'Spire', mace: 'Reliquary', knuckle: 'Gauntlets', scythe: 'Reaper', gun: 'Hand Cannon', chakram: 'Chronowheel', orb: 'Godsphere', claw: 'Ripclaws', katana: 'Nodachi', prism: 'Lightcore',
    offhand: 'Bulwark', head: 'Crown', armor: 'Warplate', cloak: 'Mantle', boots: 'Striders', necklace: 'Pendant', earring: 'Earring', ring: 'Signet'
  };
  const DG_ADJ = { abyss_tower: 'Towerborn', inferno_depths: 'Hellfire', frost_crypt: 'Rimebound', shadow_labyrinth: 'Umbral', sky_sanctum: 'Seraphic' };
  const DG_IMP = { abyss_tower: [['dmgPct', 0.035], ['hpPct', 0.06]], inferno_depths: [['atkPct', 0.06], ['critDmg', 0.18]], frost_crypt: [['dmgReduce', 0.025], ['ccRes', 0.08]], shadow_labyrinth: [['crit', 0.08], ['flee', 0.2]], sky_sanctum: [['matkPct', 0.06], ['cdr', 0.03]] };
  D.DUNGEON_GEAR = {};
  for (const dg of D.DUNGEONS) {
    D.DUNGEON_GEAR[dg.id] = [];
    for (const k of [...Object.keys(D.WEAPON_NAMES), ...SLOT_LIST]) {
      const isW = !!D.WEAPON_NAMES[k];
      D.DUNGEON_GEAR[dg.id].push(addGear(`lg_${dg.id}_${k}`, { n: `${DG_ADJ[dg.id]} ${LEG_NOUN[k]}`, slot: isW ? 'weapon' : k, wtype: isW ? k : undefined, ilv: 0,
        imp: [...DG_IMP[dg.id], isW ? [WEAPON_IMP[k], IMP_PER[WEAPON_IMP[k]] * 1.6] : ['hpPct', 0.04]], dungeon: dg.id, minR: 4, maxR: 4, src: 'dungeon' }));
    }
  }
  // crafted regional legendaries + mythics
  const CR_NOUN = {
    sword: 'Oathblade', spear: 'Dragoon Lance', axe: 'Warcleaver', dagger: 'Twin Talons', bow: 'Warbow', staff: 'Scepter', mace: 'Sanctifier', knuckle: 'Fists', scythe: 'Grimoire', gun: 'Repeater', chakram: 'Timewheel', orb: 'Sphere', claw: 'Talons', katana: 'Blade of Dusk', prism: 'Prism',
    offhand: 'Aegis', head: 'Helm', armor: 'Cuirass', cloak: 'Shroud', boots: 'Greaves', necklace: 'Amulet', earring: 'Charm', ring: 'Band'
  };
  const MY_NAME = {
    sword: 'Genesis, Edge of Dawn', spear: 'Gungnir Eternal', axe: 'Ragnarok Cleaver', dagger: 'Nihil & Nox', bow: 'Astral Hunter', staff: 'Primordial Codex Staff', mace: 'Hammer of Creation', knuckle: 'Fists of the Void Monk', scythe: 'Harvester of Worlds', gun: 'Infinity Engine', chakram: 'Ouroboros, the Endless Hour', orb: 'Heart of the Creator', claw: 'Talons of the Fallen King', katana: 'Kuro-Oblivion', prism: 'Prism of the First Dawn',
    offhand: 'Wall of Ages', head: 'Crown of the First King', armor: 'Celestial Carapace', cloak: 'Shroud of Stars', boots: 'Worldwalkers', necklace: 'Heart of Eternity', earring: 'Whisper of Gods', ring: 'Ring of Origin'
  };
  D.CRAFT_GEAR = {};
  for (const rg of D.REGIONS) {
    D.CRAFT_GEAR[rg.id] = [];
    for (const k of [...Object.keys(D.WEAPON_NAMES), ...SLOT_LIST]) {
      const isW = !!D.WEAPON_NAMES[k];
      D.CRAFT_GEAR[rg.id].push(addGear(`cg_${rg.id}_${k}`, { n: `${rg.adj} ${CR_NOUN[k]}`, slot: isW ? 'weapon' : k, wtype: isW ? k : undefined, ilv: 0,
        imp: [[isW ? WEAPON_IMP[k] : 'hpPct', (isW ? IMP_PER[WEAPON_IMP[k]] : 0.05) * 1.8], ['dmgPct', 0.02], [['bossDmg', 'pvpDmg', 'comboDmg', 'cdr', 'lifesteal'][D.REGIONS.indexOf(rg)], 0.04]], region: rg.id, minR: 4, maxR: 4, src: 'craft' }));
    }
  }
  D.MYTHIC_GEAR = [];
  for (const k of [...Object.keys(D.WEAPON_NAMES), ...SLOT_LIST]) {
    const isW = !!D.WEAPON_NAMES[k];
    D.MYTHIC_GEAR.push(addGear(`my_${k}`, { n: MY_NAME[k], slot: isW ? 'weapon' : k, wtype: isW ? k : undefined, ilv: 250,
      imp: [[isW ? WEAPON_IMP[k] : 'hpPct', (isW ? IMP_PER[WEAPON_IMP[k]] : 0.05) * 2.5], ['dmgPct', 0.035], ['bossDmg', 0.06], ['cdr', 0.02]], minR: 5, maxR: 5, src: 'mythic' }));
  }

  // ---------------------------------------------------------------- boss materials
  D.FARM_MAPS.forEach((f, i) => add(`bm_${f.id}`, { n: `${MAP_ADJ[i]} Sovereign Crest`, th: `วัตถุดิบบอส · Field Boss ${f.name}`, type: 'loot', mat: 4, ic: 'seal', icon: '#ff5a5a', sell: 2000 + f.min * 80, tier: Math.floor(i / 5), glow: 1 }));
  for (const dg of D.DUNGEONS) add(`dsig_${dg.id}`, { n: `${DG_ADJ[dg.id]} Guardian Sigil`, th: `วัตถุดิบบอส · บอสดันเจี้ยน ${dg.name}`, type: 'loot', mat: 4, ic: 'seal', icon: ELC(dg.element), sell: 8000, glow: 1 });
  const WB_MAT = { wb_kraken: ['Leviathan Pearl', 'pearl'], wb_dragon: ['World Burner Heart', 'heart'], wb_titan: ['Gaia Core', 'core'], wb_lich: ['Lich Emperor Phylactery', 'orb'] };
  for (const wb of D.WORLD_BOSSES) add(`wbm_${wb.id}`, { n: WB_MAT[wb.id][0], th: 'วัตถุดิบ World Boss (คราฟต์ Mythic)', type: 'loot', mat: 5, ic: WB_MAT[wb.id][1], icon: wb.color, sell: 50000, glow: 2 });

  // ---------------------------------------------------------------- species: fields, dungeons, bosses
  D.FARM_MAPS.forEach((f, i) => {
    const fams = D.FAMILIES[f.biome], rg = D.regionOfMap(i);
    const prefix = D.MONSTER_PREFIX[Math.min(9, Math.floor(i / 2.6))];
    fams.forEach((fam, fi) => addSpecies(`${f.id}.${fi}`, { name: prefix + fam[0], alt: MAP_ADJ[i], fam, biome: f.biome, map: f.id, region: rg.id, lv: f.min, lvMax: f.max, tier: Math.floor(i / 2.5), where: f.name, kind: 'field' }));
    const bf = fams[i % fams.length];
    addSpecies(`${f.id}.boss`, { name: `${bf[0]} ${D.BOSS_TITLES[i % D.BOSS_TITLES.length]}`, alt: MAP_ADJ[i], fam: bf, biome: f.biome, map: f.id, region: rg.id, lv: f.max + 3, lvMax: f.max + 3, tier: Math.floor(i / 2.5) + 1, where: f.name, kind: 'fieldboss', rank: 2 });
  });
  D.DUNGEONS.forEach((dg, di) => {
    const fams = D.FAMILIES[dg.biome];
    fams.forEach((fam, fi) => addSpecies(`${dg.id}.${fi}`, { name: `${DG_ADJ[dg.id]} ${fam[0]}`, alt: DG_ADJ[dg.id], fam, biome: dg.biome, dungeon: dg.id, region: 'dungeon', lv: dg.lvBase, lvMax: 300, tier: 6 + di, where: dg.name, kind: 'dungeon' }));
    addSpecies(`${dg.id}.boss`, { name: `${DG_ADJ[dg.id]} Floor Guardian`, alt: DG_ADJ[dg.id], fam: fams[0], biome: dg.biome, dungeon: dg.id, region: 'dungeon', lv: dg.lvBase + 3, lvMax: 305, tier: 8 + di, where: dg.name + ' (ทุก 10 ชั้น)', kind: 'dboss', rank: 3, color: ELC(dg.element) });
  });
  for (const wb of D.WORLD_BOSSES) addSpecies(`wb.${wb.id}`, { name: wb.name, alt: 'World', fam: [wb.name, wb.shape, 'melee', 1, wb.element], biome: 'abyss', region: 'world', lv: 250, lvMax: 250, tier: 12, where: 'Ruined Sanctum (World Boss)', kind: 'world', rank: 4, color: wb.color });

  // ---------------------------------------------------------------- support / consumables / refine / treasures / boxes
  const REGION_FOOD = {
    aurelia: [['Meadow Honey Bread', { hpPct: 5, regenPct: 30 }], ['Clover Tea', { spPct: 8 }], ['Forest Berry Tart', { aspdPct: 4 }], ['Seabreeze Grilled Fish', { movePct: 6 }]],
    sandhaven: [['Spiced Scorpion Skewer', { atkPct: 5 }], ['Oasis Date Cake', { hpPct: 6 }], ['Desert Mint Tea', { castReduce: 6 }], ['Temple Flatbread', { defPct: 8 }]],
    frostholm: [['Yeti Stew', { hpPct: 8, dmgReduce: 2 }], ['Glacier Ice Cream', { crit: 4 }], ['Crystal Candy', { matkPct: 5 }], ['Smoked Bog Eel', { ccRes: 10 }]],
    emberforge: [['Lava Pepper Steak', { atkPct: 7 }], ['Ember Chili Soup', { critDmg: 12 }], ['Obsidian Rock Candy', { defPct: 12 }], ['Dragonbone Broth', { hpPct: 10, lifesteal: 1 }]],
    skyreach: [['Cloud Soufflé', { flee: 30, movePct: 5 }], ['Angel Food Cake', { matkPct: 8, spPct: 8 }], ['Void Truffle', { dmgPct: 5 }], ['Starfruit Nectar', { cdr: 4 }]]
  };
  D.REGION_SUPPORT = {};
  for (const rg of D.REGIONS) {
    D.REGION_SUPPORT[rg.id] = REGION_FOOD[rg.id].map(([n, buff], k) => add(`food_${rg.id}_${k}`, { n, th: `อาหารประจำภูมิภาค (${Object.entries(buff).map(([a, b]) => a + ' +' + b).join(', ')} 15 นาที)`, type: 'buffitem', buff, dur: 900, price: 0, sell: 60 + D.REGIONS.indexOf(rg) * 80, lv: 1 + D.REGIONS.indexOf(rg) * 45, ic: 'food', icon: rg.color }));
  }
  const ELEM_OIL = { fire: 'Flame Oil', ice: 'Frost Oil', lightning: 'Storm Oil', earth: 'Quake Oil', wind: 'Gale Oil', holy: 'Blessed Oil', dark: 'Shadow Oil', poison: 'Venom Oil', water: 'Tidal Oil' };
  for (const el in ELEM_OIL) add(`oil_${el}`, { n: ELEM_OIL[el], th: `เคลือบอาวุธเป็นธาตุ ${D.ELEMENTS[el] ? D.ELEMENTS[el].n || el : el} 10 นาที`, type: 'buffitem', buff: { element: el }, dur: 600, price: 4000, sell: 300, ic: 'oil', icon: ELC(el) });
  const SUPPORT = [
    ['pot_conc', 'Concentration Draught', 'ความเร็วโจมตี +8% 30 นาที', { aspdPct: 8 }, 1800, 800, '#ffa040'],
    ['pot_awake', 'Awakening Draught', 'ความเร็วโจมตี +14% 30 นาที', { aspdPct: 14 }, 1800, 2500, '#ff6a20'],
    ['pot_berserk', 'Berserk Draught', 'ความเร็วโจมตี +20% ATK +5% 30 นาที', { aspdPct: 20, atkPct: 5 }, 1800, 6000, '#ff2a2a'],
    ['pot_wisdom', 'Sage Draught', 'MATK +8% ร่ายเร็ว +10% 30 นาที', { matkPct: 8, castReduce: 10 }, 1800, 6000, '#6a8aff'],
    ['pot_guard', 'Guardian Draught', 'ลดดาเมจ 6% 10 นาที', { dmgReduce: 6 }, 600, 3000, '#9ab0c8'],
    ['pot_swift', 'Swiftfoot Tonic', 'ความเร็วเดิน +15% 10 นาที', { movePct: 15 }, 600, 1200, '#9cf5b0'],
    ['pot_lucky', 'Four-Leaf Tonic', 'ดรอป +15% 30 นาที', { dropPct: 15 }, 1800, 0, '#5ae06a'],
    ['pot_crit', 'Hawkeye Tonic', 'Critical +8 10 นาที', { crit: 8 }, 600, 2500, '#ffe05a'],
    ['pot_boss', 'Giantslayer Tonic', 'ดาเมจต่อบอส +12% 10 นาที', { bossDmg: 12 }, 600, 0, '#ff9a2a'],
    ['pot_combo', 'Rhythm Tonic', 'ดาเมจคอมโบ +10% 10 นาที', { comboDmg: 10 }, 600, 0, '#ff8ae0'],
    ['pot_exp2', 'Greater Scroll of Wisdom', 'EXP +100% 30 นาที', { expPct: 100 }, 1800, 0, '#4affb0'],
    ['pot_drop2', 'Greater Scroll of Fortune', 'ดรอป +60% 30 นาที', { dropPct: 60 }, 1800, 0, '#ffd04a']
  ];
  for (const [id, n, th, buff, dur, price, c] of SUPPORT) add(id, { n, th, type: 'buffitem', buff, dur, price, sell: Math.max(50, price / 5 | 0), ic: /scroll/i.test(n) ? 'scroll' : 'flask', icon: c });
  const STAT_FOOD = { str: 'Steak', agi: 'Fruit Salad', vit: 'Stew', int: 'Herb Soup', dex: 'Sushi', luk: 'Fortune Cookie' };
  for (const s in STAT_FOOD) for (let t = 1; t <= 2; t++) add(`sfood_${s}_${t}`, { n: `${t === 2 ? 'Royal ' : ''}${STAT_FOOD[s]}`, th: `${s.toUpperCase()} +${t * 8} 30 นาที`, type: 'buffitem', buff: { [s]: t * 8 }, dur: 1800, price: t === 1 ? 3000 : 0, sell: 200 * t, ic: 'food', icon: { str: '#ff6a4a', agi: '#8aff6a', vit: '#ffb04a', int: '#6a9aff', dex: '#4affe0', luk: '#ffe04a' }[s] });
  const CURES = [['cure_herb', 'Green Herb', 'แก้ Poison', ['poison'], 50, '#5ac85a'], ['cure_water', 'Holy Water', 'แก้ Curse / Fear', ['curse', 'fear'], 300, '#bfe8ff'],
    ['cure_eye', 'Eye Drops', 'แก้ Blind', ['blind'], 150, '#8ad0ff'], ['cure_thaw', 'Warm Tonic', 'แก้ Freeze / Chill / Slow', ['freeze', 'chill', 'slow'], 300, '#ffb04a'],
    ['cure_all', 'Panacea', 'ล้างสถานะผิดปกติทั้งหมด', ['*'], 1500, '#ff8ae0'], ['cure_royal', 'Royal Jelly', 'ล้างสถานะทั้งหมด + ฟื้น HP 20%', ['*'], 0, '#ffe08a']];
  for (const [id, n, th, tags, price, c] of CURES) add(id, { n, th, type: 'cure', tags, heal: id === 'cure_royal' ? 20 : 0, price, sell: Math.max(10, price / 5 | 0), ic: id === 'cure_herb' ? 'leaf' : 'flask', icon: c });
  add('fly_wing', { n: 'Fly Wing', th: 'วาร์ปสุ่มภายในแผนที่', type: 'wing', price: 60, sell: 15, ic: 'feather', icon: '#a0f0ff' });
  // refine support
  const ANVILS = [['anvil_1', 'Bronze Anvil', 3, 5000, '#c08050'], ['anvil_2', 'Silver Anvil', 6, 25000, '#c8c8d8'], ['anvil_3', 'Golden Anvil', 10, 0, '#ffd34a'], ['anvil_4', 'Emperium Anvil', 15, 0, '#ff6ad0']];
  for (const [id, n, b, price, c] of ANVILS) add(id, { n, th: `เพิ่มโอกาสตีบวกสำเร็จ +${b}% (ใช้อัตโนมัติเมื่อติ๊กในหน้าตีบวก)`, type: 'anvil', bonus: b, price, sell: Math.max(500, price / 5 | 0) || 3000 * b, ic: 'anvil', icon: c });
  D.ANVILS = ANVILS.map((a) => a[0]);
  add('ore_rough', { n: 'Rough Ore', th: 'แร่ดิบ (หลอม 5 → Refine Ore)', type: 'mat', price: 0, sell: 20, ic: 'stone', icon: '#9a8a7a' });
  add('ore_enriched', { n: 'Enriched Ore', th: 'ใช้แทน Refine Ore + โอกาสสำเร็จ +5%', type: 'mat', price: 0, sell: 800, ic: 'stone', icon: '#d0d8ff', glow: 1 });
  add('crystal_shard', { n: 'Crystal Shard', th: 'เศษคริสตัล (คราฟต์ Pure Crystal)', type: 'mat', price: 0, sell: 120, ic: 'shard', icon: '#7df' });
  add('divine_shard', { n: 'Divine Shard', th: 'เศษศักดิ์สิทธิ์ (คราฟต์ Divine Crystal)', type: 'mat', price: 0, sell: 600, ic: 'shard', icon: '#fd7' });
  add('smith_charm', { n: "Smith's Charm", th: 'ระดับไม่ลดเมื่อตีบวก +7~+10 ล้มเหลว (เหมือนม้วนกันลดแบบเบา)', type: 'mat', price: 12000, sell: 2000, ic: 'seal', icon: '#ffb070' });
  // treasures: sell-only valuables, different in every region
  const TREASURE = {
    aurelia: ['Old Copper Coin', 'Silver Locket', 'Shepherd Bell', 'Mossy Idol', 'Pirate Doubloon', 'Cracked Crown Jewel', 'Ancient Map Fragment', 'Knight Medal'],
    sandhaven: ['Golden Scarab', 'Sand Glass Hourglass', 'Pharaoh Ring', 'Mirage Pearl', 'Temple Censer', 'Jungle Idol', 'Sunstone', 'Desert Rose'],
    frostholm: ['Frozen Coin', 'Aurora Crystal', 'Mammoth Ivory', 'Glacier Diamond', 'Runic Tablet', 'Prism Lens', 'Bog Amber', 'Wolf Totem'],
    emberforge: ['Molten Gold Nugget', 'Obsidian Mirror', 'Fire Opal', 'Dragon Tooth Necklace', 'Forge Master Seal', 'Ash Urn', 'Storm Glass', 'Salamander Egg'],
    skyreach: ['Feather of Dawn', 'Celestial Coin', 'Star Fragment', 'Void Pearl', 'Shattered Halo', 'Throne Relic', 'Angel Tear', 'Eternity Hourglass']
  };
  D.REGION_TREASURE = {};
  for (const rg of D.REGIONS) D.REGION_TREASURE[rg.id] = TREASURE[rg.id].map((n, k) => add(`tre_${rg.id}_${k}`, { n, th: `ของมีค่า ${rg.n} (ขายได้ราคาดี)`, type: 'treasure', price: 0, sell: Math.round((300 + k * 120) * Math.pow(2.2, D.REGIONS.indexOf(rg))), ic: ['coin', 'gem', 'relic'][k % 3], icon: rg.color }));
  // boxes
  D.REGIONS.forEach((rg, k) => add(`box_${rg.id}`, { n: `${rg.adj} Supply Crate`, th: `กล่องเสบียง ${rg.n}: สุ่มวัตถุดิบ/อาหาร/ของมีค่าประจำภูมิภาค`, type: 'box', box: 'region', region: rg.id, price: 0, sell: 100 * (k + 1), ic: 'box', icon: rg.color }));
  add('box_blue', { n: 'Old Blue Box', th: 'สุ่มอุปกรณ์จากทุกภูมิภาค (Common–Epic)', type: 'box', box: 'gear', price: 0, sell: 500, ic: 'box', icon: '#4a8aff' });
  add('box_purple', { n: 'Old Purple Box', th: 'สุ่มไอเทมซัพพอร์ต/ตีบวก', type: 'box', box: 'support', price: 0, sell: 800, ic: 'box', icon: '#a05aff' });
  add('box_card', { n: 'Old Card Album', th: 'สุ่มการ์ดมอนสเตอร์ 1 ใบ', type: 'box', box: 'card', price: 0, sell: 3000, ic: 'box', icon: '#ffd34a' });
  add('box_legend', { n: 'Ancient Relic Chest', th: 'สุ่มอุปกรณ์ Legendary จากดันเจี้ยน', type: 'box', box: 'legend', price: 0, sell: 20000, ic: 'box', icon: '#ff9a2a', glow: 1 });

  // ---------------------------------------------------------------- drop tables (what the bestiary shows; the server rolls exactly these)
  // [itemId | 'gear:<base>', chance %, qty]
  D.dropTable = function (spId) {
    const s = D.SPECIES[spId]; if (!s) return [];
    if (s._drops) return s._drops;
    const boss = s.kind === 'fieldboss' || s.kind === 'dboss' || s.kind === 'world';
    const out = [];
    out.push([s.mats[0], boss ? 100 : 30, boss ? 8 : 1], [s.mats[1], boss ? 80 : 8, boss ? 4 : 1], [s.mats[2], boss ? 25 : 0.6, 1], [s.junk, boss ? 100 : 42, boss ? 5 : 1], [s.card, boss ? 2 : s.kind === 'dungeon' ? 0.08 : 0.04, 1]);
    if (s.kind === 'fieldboss') out.push(['bm_' + s.map, 100, 1]);
    if (s.kind === 'dboss') out.push(['dsig_' + s.dungeon, 100, 1]);
    if (s.kind === 'world') out.push(['wbm_' + s.id.slice(3), 100, 2]);
    const rg = s.region;
    if (D.REGION_SUPPORT[rg]) {
      const h = H(spId);
      out.push([D.REGION_SUPPORT[rg][(h >>> 0) % 4], boss ? 60 : 2.5, 1], [D.REGION_TREASURE[rg][(h >>> 0) % 8], boss ? 50 : 1.2, 1], [D.REGION_TREASURE[rg][(h >>> 4) % 8], boss ? 30 : 0.6, 1], ['box_' + rg, boss ? 40 : 0.4, 1]);
    }
    if (s.map) {
      const list = D.MAP_GEAR[s.map], fams = D.FAMILIES[s.biome].length, fi = s.kind === 'fieldboss' ? -1 : +spId.split('.')[1];
      list.forEach((g, k) => { if (fi < 0 || k % fams === fi) out.push(['gear:' + g, fi < 0 ? 12 : 0.7, 1]); });
    }
    if (s.dungeon) {
      const list = D.DUNGEON_GEAR[s.dungeon], fams = D.FAMILIES[s.biome].length, fi = s.kind === 'dboss' ? -1 : +spId.split('.')[1];
      list.forEach((g, k) => { if (fi < 0 || k % fams === fi) out.push(['gear:' + g, fi < 0 ? 3 : 0.03, 1]); });
      out.push(['box_legend', s.kind === 'dboss' ? 8 : 0.05, 1], ['box_blue', s.kind === 'dboss' ? 30 : 1, 1]);
    }
    if (s.kind === 'world') { for (const g of D.MYTHIC_GEAR) out.push(['gear:' + g, 1.5, 1]); out.push(['box_legend', 100, 3], ['anvil_4', 30, 1]); }
    // generic odds every monster has
    out.push(['ore_rough', boss ? 100 : 6, boss ? 10 : 1], ['fly_wing', 3, 1], ['cure_herb', 2, 1], ['box_blue', boss ? 20 : 0.15, 1], ['box_purple', boss ? 15 : 0.1, 1], ['box_card', boss ? 5 : 0.01, 1]);
    if (s.lv >= 50) out.push(['crystal_shard', boss ? 60 : 1.5, boss ? 5 : 1]);
    if (s.lv >= 120) out.push(['divine_shard', boss ? 30 : 0.4, boss ? 3 : 1]);
    if (s.lv >= 30) out.push(['anvil_1', boss ? 10 : 0.08, 1]);
    if (s.lv >= 90) out.push(['anvil_2', boss ? 6 : 0.04, 1]);
    if (boss) out.push(['anvil_3', 3, 1], ['ore_enriched', 40, 2], ['smith_charm', 20, 1]);
    s._drops = out;
    return out;
  };

  // ---------------------------------------------------------------- recipes: refine helpers, gear crafting
  D.RECIPES.push(
    { out: 'ore_refine', q: 1, req: [['ore_rough', 5]], zeny: 200, lv: 1 },
    { out: 'crystal_pure', q: 1, req: [['crystal_shard', 10], ['ore_refine', 3]], zeny: 15000, lv: 50 },
    { out: 'crystal_divine', q: 1, req: [['divine_shard', 10], ['crystal_pure', 2]], zeny: 120000, lv: 120 },
    { out: 'ore_enriched', q: 1, req: [['ore_refine', 5], ['crystal_shard', 3]], zeny: 5000, lv: 40 },
    { out: 'anvil_2', q: 1, req: [['anvil_1', 3]], zeny: 30000, lv: 60 },
    { out: 'anvil_3', q: 1, req: [['anvil_2', 3], ['crystal_divine', 1]], zeny: 200000, lv: 120 },
    { out: 'cure_all', q: 3, req: [['cure_herb', 5], ['herb', 5]], zeny: 800, lv: 20 }
  );
  // regional legendaries: trophies of that region's monsters + field boss crests
  for (const rg of D.REGIONS) {
    const sp = Object.values(D.SPECIES).filter((s) => s.region === rg.id && s.kind === 'field');
    const ri = D.REGIONS.indexOf(rg), lv = 40 + ri * 48;
    D.CRAFT_GEAR[rg.id].forEach((g, k) => {
      const a = sp[k % sp.length], b = sp[(k * 7 + 3) % sp.length], c = sp[(k * 11 + 5) % sp.length];
      const crest = 'bm_' + D.FARM_MAPS[rg.maps[k % 5]].id;
      D.RECIPES.push({ out: 'gear:' + g, rar: 4, ilv: Math.min(250, lv + 10), q: 1, cat: 'legendary', region: rg.id,
        req: [[a.mats[2], 3], [b.mats[2], 2], [c.mats[1], 20], [crest, 2], [ri < 2 ? 'crystal_pure' : 'crystal_divine', 3 + ri]], zeny: 200000 * (ri + 1), lv });
    });
  }
  // mythics: a trophy from every region, dungeon sigils and world boss materials
  D.MYTHIC_GEAR.forEach((g, k) => {
    const regTro = D.REGIONS.map((rg, ri) => { const sp = Object.values(D.SPECIES).filter((s) => s.region === rg.id && s.kind === 'field'); return [sp[(k + ri) % sp.length].mats[2], 5]; });
    const wb = D.WORLD_BOSSES[k % 4].id, dg = D.DUNGEONS[k % 5].id;
    D.RECIPES.push({ out: 'gear:' + g, rar: 5, ilv: 250, q: 1, cat: 'mythic', req: [...regTro, ['wbm_' + wb, 3], ['dsig_' + dg, 5], ['crystal_divine', 15]], zeny: 25000000, lv: 220 });
  });

  // shops: sell some of the new support items
  const addShop = (town, ids) => D.SHOP[town] && D.SHOP[town].push(...ids.filter((x) => !D.SHOP[town].includes(x)));
  for (const t of Object.keys(D.SHOP)) addShop(t, ['fly_wing', 'cure_herb', 'cure_eye', 'pot_conc', 'pot_swift', 'anvil_1']);
  addShop('sandhaven', ['cure_water', 'pot_awake', 'oil_fire', 'oil_wind', 'oil_earth', 'oil_water']);
  addShop('frostholm', ['cure_thaw', 'cure_water', 'pot_awake', 'pot_guard', 'oil_ice', 'oil_lightning', 'smith_charm', 'anvil_2']);
  addShop('emberforge', ['cure_all', 'pot_berserk', 'pot_wisdom', 'pot_crit', 'oil_fire', 'oil_dark', 'oil_poison', 'smith_charm', 'anvil_2']);
  addShop('skyreach', ['cure_all', 'pot_berserk', 'pot_wisdom', 'pot_crit', 'oil_holy', 'oil_lightning', 'smith_charm', 'anvil_2']);
  for (const s in STAT_FOOD) addShop(D.REGIONS[Object.keys(STAT_FOOD).indexOf(s) % 5].town, [`sfood_${s}_1`]);

  // item categories for UI filters
  D.itemCategory = (d) => ({ potion: 'support', buffitem: 'support', cure: 'support', wing: 'support', scroll: 'support', loot: 'material', mat: 'refine', anvil: 'refine', rune: 'socket', jewel: 'socket', card: 'socket', junk: 'junk', treasure: 'sell', box: 'box', currency: 'other', pet: 'other', mount: 'other', petfood: 'support', zeny: 'other' }[d.type] || 'other');
  D.ITEM_COUNT = Object.keys(D.ITEMS).length + Object.keys(D.GEAR).length;
});

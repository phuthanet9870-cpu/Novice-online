// Skill designer v3: rebuilds every skill's mechanics around its class identity.
//  - 40 Active per class: composed from the class's own pools (delivery × status × combo hook × utility), steered by the
//    skill's name, with no repeated combination inside the class and no repeated full profile in the whole game.
//  - 5 Ultimate + 5 Buff per class: hand-designed below.
// Descriptions are generated from the final mechanics, so the text always matches what the skill does.
const { hashStr } = require('../shared/rng.js');
const r1 = (x) => Math.round(x * 10) / 10;
const TAG = { airborne: 'Airborne', knockdown: 'Knockdown', stun: 'Stun', bleed: 'Bleed', poison: 'Poison', burn: 'Burn', chill: 'Chill', freeze: 'Freeze', wet: 'Wet', shock: 'Shock', mark: 'Mark', armorbreak: 'Armor Break', curse: 'Curse', slow: 'Slow', root: 'Root', holybrand: 'Holy Brand', silence: 'Silence', fear: 'Fear', blind: 'Blind' };
const ELT = { neutral: 'กายภาพ', fire: 'ไฟ', ice: 'น้ำแข็ง', water: 'น้ำ', lightning: 'สายฟ้า', wind: 'ลม', earth: 'ดิน', holy: 'ศักดิ์สิทธิ์', dark: 'มืด', poison: 'พิษ', blood: 'โลหิต' };
const DUR = { airborne: 1.5, knockdown: 2, stun: 1.5, bleed: 6, poison: 8, burn: 5, chill: 4, freeze: 3, wet: 6, shock: 2, mark: 8, armorbreak: 6, curse: 10, slow: 3, root: 2, holybrand: 8, silence: 2, fear: 2, blind: 2 };
const DOTS = ['bleed', 'poison', 'burn'];

// ---------------------------------------------------------------- class kits
const KITS = {
  blade_knight: { res: 'Blade Charge', range: 2.3, D: ['strike', 'combo', 'spin', 'arc', 'wave', 'dash', 'leap', 'pull', 'quake'], T: ['airborne', 'bleed', 'armorbreak', 'knockdown', 'slow', 'stun'], H: ['consume', 'bonus', 'perStack', 'perRes', 'chain', 'execute', 'combo', 'none'], U: ['lifesteal', 'shield', 'push', 'nextBonus', 'resGain', 'pierce', 'taunt', 'none'], E: ['neutral', 'blood', 'wind'] },
  guardian: { res: 'Bulwark', range: 2.7, D: ['strike', 'arc', 'wave', 'dash', 'pull', 'quake', 'spin', 'leap', 'zone'], T: ['stun', 'knockdown', 'root', 'holybrand', 'armorbreak', 'slow', 'silence'], H: ['consume', 'bonus', 'perRes', 'lowhp', 'chain', 'combo', 'none'], U: ['shield', 'taunt', 'push', 'selfHeal', 'reflect', 'cleanse', 'pull', 'none'], E: ['neutral', 'holy', 'earth'] },
  berserker: { res: 'Fury', range: 2.4, D: ['strike', 'combo', 'spin', 'leap', 'dash', 'quake', 'arc', 'throw', 'wave'], T: ['bleed', 'knockdown', 'armorbreak', 'stun', 'mark', 'fear'], H: ['lowhp', 'perRes', 'consume', 'bonus', 'perStack', 'execute', 'none'], U: ['lifesteal', 'hpCost', 'selfHeal', 'push', 'resGain', 'nextBonus', 'none'], E: ['neutral', 'blood', 'earth'] },
  shadow_assassin: { res: 'Shadow Point', range: 1.9, D: ['strike', 'combo', 'blink', 'dash', 'arc', 'spin', 'throw', 'trap', 'delayed'], T: ['poison', 'bleed', 'mark', 'silence', 'blind', 'slow', 'stun'], H: ['backstab', 'stealthOpen', 'consume', 'perStack', 'execute', 'bonus', 'chain', 'none'], U: ['stealth', 'nextBonus', 'lifesteal', 'pierce', 'dispel', 'extendDots', 'resGain', 'none'], E: ['poison', 'dark', 'neutral'] },
  ranger: { res: 'Focus', range: 10, D: ['shot', 'pierce', 'volley', 'rain', 'trap', 'ricochet', 'backstep', 'summon', 'zone'], T: ['mark', 'root', 'slow', 'burn', 'chill', 'wet', 'airborne', 'knockdown'], H: ['bonus', 'consume', 'perRes', 'chain', 'combo', 'execute', 'none'], U: ['push', 'nextBonus', 'resGain', 'pierce', 'stealth', 'selfHeal', 'none'], E: ['wind', 'fire', 'ice', 'lightning', 'neutral'] },
  elementalist: { res: 'Element Orb', range: 9.5, D: ['bolt', 'nova', 'rain', 'zone', 'lance', 'ricochet', 'delayed', 'arc', 'blinkcast'], T: ['burn', 'chill', 'wet', 'shock', 'airborne', 'slow', 'root'], H: ['consume', 'bonus', 'perRes', 'combo', 'reaction', 'none'], U: ['shield', 'manaBurn', 'nextBonus', 'push', 'cleanse', 'resGain', 'none'], E: ['fire', 'ice', 'water', 'lightning', 'wind', 'earth'] },
  cleric: { res: 'Faith', range: 7.5, D: ['bolt', 'nova', 'zone', 'lance', 'ricochet', 'strike', 'rain', 'pull', 'quake'], T: ['holybrand', 'stun', 'silence', 'blind', 'root', 'slow'], H: ['purge', 'bonus', 'chain', 'combo', 'lowhp', 'consume', 'none'], U: ['partyHeal', 'shield', 'cleanse', 'dispel', 'healFromDmg', 'manaBurn', 'taunt', 'none'], E: ['holy', 'neutral'] },
  monk: { res: 'Chi Sphere', range: 1.9, D: ['combo', 'strike', 'spin', 'leap', 'dash', 'wave', 'pull', 'quake', 'blink'], T: ['airborne', 'knockdown', 'stun', 'armorbreak', 'silence', 'root'], H: ['chain', 'combo', 'consume', 'perRes', 'bonus', 'execute', 'none'], U: ['nextBonus', 'resGain', 'selfHeal', 'push', 'pierce', 'cleanse', 'none'], E: ['neutral', 'wind', 'holy'] },
  warlock: { res: 'Soul Shard', range: 8.5, D: ['bolt', 'zone', 'delayed', 'ricochet', 'summon', 'scythe', 'arc', 'pull', 'nova'], T: ['curse', 'poison', 'fear', 'silence', 'slow', 'bleed', 'blind'], H: ['perStack', 'consume', 'bonus', 'perSummon', 'execute', 'lowhp', 'none'], U: ['lifesteal', 'extendDots', 'manaBurn', 'dispel', 'hpCost', 'selfHeal', 'none'], E: ['dark', 'poison', 'blood'] },
  gunslinger: { res: 'Heat', range: 8.5, D: ['shot', 'combo', 'pierce', 'arc', 'grenade', 'rain', 'ricochet', 'dash', 'backstep'], T: ['mark', 'armorbreak', 'burn', 'chill', 'shock', 'slow', 'knockdown', 'airborne'], H: ['perRes', 'bonus', 'consume', 'execute', 'combo', 'chain', 'none'], U: ['push', 'pierce', 'nextBonus', 'resGain', 'blindAoe', 'selfHeal', 'none'], E: ['neutral', 'fire', 'lightning', 'ice'] },
  chrono_stalker: { res: 'Chrono Charge', range: 6.5, D: ['throw', 'ricochet', 'delayed', 'blink', 'dash', 'zone', 'combo', 'wave', 'trap'], T: ['slow', 'freeze', 'stun', 'root', 'mark', 'chill', 'silence'], H: ['consume', 'bonus', 'perRes', 'chain', 'combo', 'execute', 'none'], U: ['cdShift', 'haste', 'nextBonus', 'resGain', 'push', 'pierce', 'none'], E: ['neutral', 'lightning', 'ice', 'wind'] },
  divine_sovereign: { res: 'Divinity', range: 9, D: ['bolt', 'rain', 'nova', 'lance', 'zone', 'delayed', 'pull', 'ricochet', 'summon'], T: ['holybrand', 'stun', 'shock', 'silence', 'blind', 'root'], H: ['purge', 'bonus', 'consume', 'chain', 'execute', 'none'], U: ['partyHeal', 'shield', 'cleanse', 'dispel', 'healFromDmg', 'haste', 'none'], E: ['holy', 'lightning'] },
  hellfiend: { res: 'Hellfire', range: 2.1, D: ['strike', 'combo', 'spin', 'dash', 'leap', 'quake', 'arc', 'pull', 'wave'], T: ['burn', 'bleed', 'fear', 'curse', 'knockdown', 'armorbreak', 'stun'], H: ['lowhp', 'perRes', 'consume', 'bonus', 'perStack', 'execute', 'none'], U: ['lifesteal', 'hpCost', 'selfHeal', 'push', 'haste', 'resGain', 'none'], E: ['fire', 'blood', 'dark'] },
  void_walker: { res: 'Void Essence', range: 2.0, D: ['strike', 'combo', 'blink', 'pull', 'dash', 'arc', 'spin', 'throw', 'delayed'], T: ['blind', 'fear', 'silence', 'curse', 'mark', 'slow', 'root'], H: ['backstab', 'stealthOpen', 'consume', 'execute', 'bonus', 'chain', 'none'], U: ['stealth', 'pull', 'manaBurn', 'dispel', 'nextBonus', 'cdShift', 'none'], E: ['dark', 'poison', 'neutral'] },
  lightbringer: { res: 'Radiance', range: 9, D: ['lance', 'ricochet', 'bolt', 'nova', 'zone', 'rain', 'wave', 'delayed', 'pull'], T: ['blind', 'holybrand', 'burn', 'shock', 'stun', 'slow'], H: ['bonus', 'consume', 'perRes', 'chain', 'combo', 'none'], U: ['partyHeal', 'cleanse', 'pierce', 'nextBonus', 'shield', 'haste', 'none'], E: ['holy', 'lightning', 'fire'] },
};
// v4 signature mechanics, themed per class (implemented in server/combat.js mechanics())
const MECH = {
  blade_knight: ['echo', 'stackSelf', 'boomerang', 'resetOnKill', 'split', 'none'], guardian: ['wall', 'echo', 'orbit', 'stackSelf', 'none'],
  berserker: ['stackSelf', 'overcharge', 'resetOnKill', 'echo', 'trail', 'none'], shadow_assassin: ['resetOnKill', 'split', 'echo', 'trail', 'none'],
  ranger: ['split', 'boomerang', 'wall', 'echo', 'none'], elementalist: ['orbit', 'wall', 'echo', 'split', 'overcharge', 'none'],
  cleric: ['orbit', 'wall', 'echo', 'overcharge', 'none'], monk: ['echo', 'stackSelf', 'trail', 'resetOnKill', 'none'],
  warlock: ['orbit', 'split', 'echo', 'wall', 'overcharge', 'none'], gunslinger: ['split', 'boomerang', 'overcharge', 'resetOnKill', 'none'],
  chrono_stalker: ['echo', 'orbit', 'boomerang', 'resetOnKill', 'none'], divine_sovereign: ['orbit', 'wall', 'echo', 'overcharge', 'none'],
  hellfiend: ['trail', 'stackSelf', 'overcharge', 'orbit', 'none'], void_walker: ['resetOnKill', 'split', 'echo', 'trail', 'none'],
  lightbringer: ['split', 'boomerang', 'orbit', 'wall', 'none']
};
// the 15 classes designed later (tools/new-classes.js) join the same tables
{
  const N = require('./new-classes.js');
  for (const [id, c] of Object.entries(N)) {
    KITS[id] = Object.assign({ res: c.res.name }, c.kit); MECH[id] = c.mech;
  }
}
function mechFits(m, out) {
  if (m === 'trail') return !!(out.move && out.move.type === 'dash');
  if (m === 'boomerang') return out.shape === 'line' || (out.shape === 'single' && !out.melee);
  if (m === 'split') return out.shape === 'single' || out.shape === 'chain';
  if (m === 'wall') return !out.self;
  return true;
}
// name keywords → preferred delivery / status
const NAME_D = [
  [/Spin|Whirl|Tornado|Cyclone|Flurry|Storm(?! Volley)|Dance|Hundred|Waltz|Kata/i, 'spin'], [/Wave|Beam|Ray|Lance|Spear|Pierce|Penetrat|Line|Railgun|Splitter|Fault|Thrust/i, 'wave'],
  [/Rain|Hail|Meteor|Barrage|Mortar|Volley|Cluster/i, 'rain'], [/Dash|Charge|Rush|Lunge|Pounce|Slide|Tackle|Juggernaut/i, 'dash'], [/Leap|Drop|Dive|Fall|Jump|Vault|Comet/i, 'leap'],
  [/Blink|Step|Shadow Swap|Relocation/i, 'blink'], [/Hook|Grip|Chain(?! Lightning)|Pull|Rift|Gate/i, 'pull'], [/Trap|Mine|Snare|Claymore|Spike/i, 'trap'],
  [/Nova|Burst|Explosion|Quake|Slam|Stomp|Shock(?!wave)|Ground|Crater|Earth|Upheaval|Landslide/i, 'quake'], [/Fan|Cone|Buckshot|Cleave|Sweep|Arc|Crescent/i, 'arc'],
  [/Bolt|Shot|Arrow|Throw|Orb|Knife|Disc|Round|Bullet/i, 'shot'], [/Field|Pillar|Wall|Cloud|Sanctuary|Circle|Zone|Blizzard|Static/i, 'zone'],
  [/Summon|Raise|Skeleton|Wraith|Pack|Drone|Knight$/i, 'summon'], [/Doom|Delayed|Inner|Demolition|Detonate|Mark of/i, 'delayed'], [/Combo|Double|Twin|Triple|Hundred|Seven|Thousand|Rapid|Fan the/i, 'combo']
];
const NAME_T = [
  [/Rising|Uppercut|Juggle|Launch|Air|Sky|Talon|Tornado|Spring|Cyclone/i, 'airborne'], [/Bleed|Blood|Crimson|Gore|Lacerat|Gash|Red|Sanguine|Vein/i, 'bleed'],
  [/Venom|Toxic|Poison|Plague|Acid|Noxious|Viper|Rot/i, 'poison'], [/Fire|Flame|Burn|Inferno|Napalm|Ember|Magma|Phoenix|Heat|Ignite/i, 'burn'],
  [/Frost|Ice|Freeze|Glacial|Cryo|Hail|Snow|Blizzard/i, 'chill'], [/Water|Tidal|Rain/i, 'wet'], [/Thunder|Lightning|Static|Shock|Spark/i, 'shock'],
  [/Holy|Sacred|Divine|Radiant|Seraph|Smite|Light|Angel|Heaven/i, 'holybrand'], [/Curse|Hex|Malediction|Wither|Agony|Corruption/i, 'curse'], [/Mark|Target|Hunter|Lock/i, 'mark'],
  [/Armor|Break|Splitter|Crush|Sunder|Piercer/i, 'armorbreak'], [/Snare|Root|Pin|Prison|Grip|Bind/i, 'root'], [/Silence|Garrote|Lotus/i, 'silence'],
  [/Fear|Terror|Howl|Dread/i, 'fear'], [/Flash|Smoke|Blind/i, 'blind'], [/Slow|Kneecap|Weight|Sweep/i, 'slow'], [/Stun|Bash|Pressure|Slam|Concuss/i, 'stun'], [/Kick|Drop|Ground|Fall|Tackle/i, 'knockdown']
];
const pickName = (name, list, pool) => { for (const [re, v] of list) if (re.test(name) && pool.includes(v)) return v; return null; };

// ---------------------------------------------------------------- hand-designed ultimates & buffs
const ULTS = {
  blade_knight: [
    ['megaline', { len: 18, dmg: 22, tag: ['bleed', 3, 8], pierce: 1 }], ['zoneself', { dur: 6, mult: 1.5, r: 4, tag: ['armorbreak', 1] }], ['executeSweep', { r: 7, th: 20, dmg: 16 }],
    ['delayedAoe', { r: 6, dmg: 26, delay: 1.5 }], ['transform', { dur: 12, mods: { critDmg: 80, aspdPct: 35 }, fullRes: 1 }]],

  guardian: [
    ['blackhole', { r: 7, dmg: 8, tag: ['stun', 1, 2.5] }], ['transform', { dur: 12, mods: { dmgReduce: 60, reflect: 40 } }], ['zoneheal', { dur: 8, heal: 7, r: 6 }],
    ['nuke', { r: 7, dmg: 15, tag: ['knockdown', 1, 3] }], ['dome', { dur: 10, mods: { dmgReduce: 50, ccRes: 50 }, party: 1 }]],

  berserker: [
    ['barrage', { r: 7, dmg: 1.6, hits: 25, tag: ['bleed', 1] }], ['transform', { dur: 12, mods: { lifesteal: 30, dmgPct: 35 } }], ['stackburst', { r: 6, tag: ['armorbreak', 3], per: 2 }],
    ['zonetarget', { dur: 6, mult: 2.2, r: 5, tag: ['knockdown', 1] }], ['transform', { dur: 10, mods: { giant: 1, ccImmune: 1, aspdPct: 50 } }]],

  shadow_assassin: [
    ['execute', { th: 35, dmg: 34 }], ['zoneself', { dur: 5, mult: 2, r: 3, tag: ['poison', 2] }], ['plague', { r: 14, tag: ['poison', 4], tag2: ['blind', 1] }],
    ['nuke', { r: 10, dmg: 14, tag: ['silence', 1, 3] }], ['transform', { dur: 10, mods: { stealth: 1, critDmg: 70, movePct: 30 } }]],

  ranger: [
    ['barrage', { r: 12, dmg: 1.3, hits: 35, tag: ['mark', 1] }], ['zonetarget', { dur: 7, mult: 2, r: 6, tag: ['slow', 1] }], ['summonArmy', { n: 4, dur: 15, mult: 1, shape: 'beast' }],
    ['megaline', { len: 25, dmg: 24, tag: ['root', 1, 3] }], ['transform', { dur: 12, mods: { aspdPct: 45, range: 4 } }]],

  elementalist: [
    ['nuke', { r: 12, dmg: 9, tag: ['burn', 3, 6] }], ['zonetarget', { dur: 8, mult: 2.4, r: 6, tag: ['chill', 2] }], ['ricochetUlt', { n: 12, dmg: 3.5, tag: ['shock', 1] }],
    ['blackhole', { r: 9, dmg: 28, tag: ['wet', 1, 6] }], ['transform', { dur: 15, mods: { matkPct: 40, cdr: 30 } }]],

  cleric: [
    ['saint', { dur: 4, revive: 0, heal: 40 }], ['nuke', { r: 12, dmg: 16, tag: ['holybrand', 1, 10] }], ['zoneheal', { dur: 10, heal: 9, r: 7 }],
    ['revive', { heal: 60 }], ['transform', { dur: 15, mods: { regenPct: 300, dmgReduce: 25 }, party: 1 }]],

  monk: [
    ['barrage', { r: 5, dmg: 1.4, hits: 28, tag: ['stun', 1] }], ['single', { dmg: 30, pierce: 1, tag: ['knockdown', 1, 3] }], ['nuke', { r: 6, dmg: 15, tag: ['airborne', 1, 3] }],
    ['transform', { dur: 12, mods: { comboWin: 3, aspdPct: 40 } }], ['transform', { dur: 10, mods: { dmgPct: 50, ccImmune: 1 }, fullRes: 1 }]],

  warlock: [
    ['plague', { r: 14, tag: ['curse', 1], tag2: ['fear', 1] }], ['summonArmy', { n: 8, dur: 18, mult: 0.8, shape: 'undead' }], ['blackhole', { r: 8, dmg: 26, tag: ['curse', 1, 4] }],
    ['executeSweep', { r: 8, th: 18, dmg: 14 }], ['transform', { dur: 12, mods: { lifesteal: 15, matkPct: 45 } }]],

  gunslinger: [
    ['barrage', { r: 10, dmg: 1, hits: 40, tag: ['shock', 1] }], ['delayedAoe', { r: 5, dmg: 30, delay: 2 }], ['traps', { n: 10 }],
    ['single', { dmg: 38, pierce: 1, cast: 1.5, range: 20 }], ['transform', { dur: 12, mods: { aspdPct: 55, crit: 30 } }]],

  chrono_stalker: [
    ['nuke', { r: 14, dmg: 5, tag: ['freeze', 1, 3] }], ['stackburst', { r: 7, tag: ['slow', 4], per: 1.8 }], ['barrage', { r: 9, dmg: 1.1, hits: 30, tag: ['slow', 1] }],
    ['saint', { dur: 3, revive: 0, heal: 60 }], ['transform', { dur: 12, mods: { cdr: 90, aspdPct: 30 } }]],
  divine_sovereign: [
    ['nuke', { r: 14, dmg: 20, tag: ['holybrand', 1, 10] }], ['revive', { heal: 70 }], ['barrage', { r: 12, dmg: 1.6, hits: 30, tag: ['shock', 1] }],
    ['transform', { dur: 15, mods: { matkPct: 50, dmgReduce: 30, regenPct: 200 }, party: 1 }], ['zoneheal', { dur: 10, heal: 8, r: 7, invuln: 1 }]],
  hellfiend: [
    ['transform', { dur: 15, mods: { giant: 1, dmgPct: 45, lifesteal: 15 } }], ['zonetarget', { dur: 8, mult: 2.6, r: 6, tag: ['burn', 2] }], ['nuke', { r: 9, dmg: 24, tag: ['burn', 3, 5] }],
    ['plague', { r: 14, tag: ['bleed', 3], tag2: ['fear', 1] }], ['transform', { dur: 12, mods: { dmgPct: 60, ccImmune: 1, invuln: 1 } }]],
  void_walker: [
    ['plague', { r: 14, tag: ['blind', 1], tag2: ['fear', 1] }], ['blackhole', { r: 10, dmg: 30, tag: ['silence', 1, 3] }], ['zoneself', { dur: 6, mult: 1.8, r: 4, tag: ['curse', 1] }],
    ['nuke', { r: 12, dmg: 18, tag: ['blind', 1, 4] }], ['transform', { dur: 12, mods: { stealth: 1, critDmg: 80, dmgPct: 35 } }]],
  lightbringer: [
    ['nuke', { r: 14, dmg: 16, tag: ['blind', 1, 3] }], ['megaline', { len: 24, dmg: 26, tag: ['holybrand', 1, 8], pierce: 1 }], ['zoneheal', { dur: 8, heal: 12, r: 7 }],
    ['transform', { dur: 15, mods: { matkPct: 50, castReduce: 40 } }], ['transform', { dur: 10, mods: { movePct: 60, aspdPct: 50, cdr: 40 } }]]
};
const BUFFS_NEW = {}, ULTS_NEW = {};
for (const [id, c] of Object.entries(require('./new-classes.js'))) { ULTS_NEW[id] = c.ults.map((u) => [u[2], u[3]]); BUFFS_NEW[id] = c.buffs.map((b) => Object.assign({}, b[1])); }
const BUFFS = {
  blade_knight: [{ atkPct: 12, crit: 10 }, { aspdPct: 18, movePct: 10 }, { lifesteal: 6, critDmg: 15 }, { dmgReduce: 15, ccRes: 30, short: 10 }, { comboDmg: 15, comboWin: 1 }],
  guardian: [{ defPct: 35, mdefPct: 20 }, { guardAlly: 35, party: 1 }, { hpPct: 20, regenPct: 120 }, { blocks: 4, short: 20 }, { ccRes: 30, dmgReduce: 10, party: 1 }],
  berserker: [{ atkPct: 20, defPct: -15 }, { aspdPct: 22, lifesteal: 4 }, { ccImmune: 1, short: 8 }, { critDmg: 30, hpPct: -10 }, { resGainPct: 100, dmgPct: 8, party: 1 }],
  shadow_assassin: [{ crit: 18, flee: 20 }, { movePct: 22, cdr: 6 }, { critDmg: 25, extraStack: 1 }, { flee: 45, short: 10 }, { dmgPct: 10, resGainPct: 100 }],
  ranger: [{ range: 2, crit: 12 }, { aspdPct: 16, movePct: 12, party: 1 }, { element: 'cycle' }, { hit: 40, critDmg: 15 }, { summonBuff: 1, atkPct: 10 }],
  elementalist: [{ matkPct: 18, castReduce: 15 }, { spPct: 30, spRegen: 3 }, { cdr: 10, party: 1 }, { spShield: 25 }, { element: 'cycle', matkPct: 6 }],
  cleric: [{ int: 12, vit: 12, party: 1 }, { regenPct: 150, party: 1 }, { blocks: 5, short: 25, party: 1 }, { element: 'holy', party: 1 }, { mdefPct: 25, ccRes: 25, party: 1 }],
  monk: [{ aspdPct: 20, comboWin: 1 }, { resGainPct: 100, crit: 12 }, { defPct: 25, regenPct: 100 }, { comboDmg: 20 }, { movePct: 20, flee: 20, party: 1 }],
  warlock: [{ matkPct: 22, hpPct: -10 }, { soulSiphon: 1, lifesteal: 4 }, { summonBuff: 1, matkPct: 8 }, { blocks: 3, short: 45 }, { cdr: 8, castReduce: 15 }],
  gunslinger: [{ crit: 22, hit: 20 }, { aspdPct: 24 }, { element: 'cycle', crit: 5 }, { heatSink: 1, aspdPct: 8 }, { dropPct: 8, movePct: 15, party: 1 }],
  chrono_stalker: [{ aspdPct: 20, movePct: 15 }, { cdr: 12 }, { flee: 35, short: 12 }, { regenPct: 150, spRegen: 2 }, { ccImmune: 1, short: 8 }],
  divine_sovereign: [{ matkPct: 12, hpPct: 10, party: 1 }, { dmgPct: 10, party: 1 }, { blocks: 4, short: 30, party: 1 }, { castReduce: 25, spPct: 20 }, { str: 8, agi: 8, vit: 8, int: 8, dex: 8, luk: 8, party: 1 }],
  hellfiend: [{ atkPct: 15, critDmg: 15 }, { defPct: 35, hpPct: 10 }, { lifesteal: 10, aspdPct: 10 }, { dmgPct: 20, regenPct: -60 }, { regenPct: 250, ccRes: 20 }],
  void_walker: [{ flee: 30, movePct: 15 }, { crit: 20, hit: 30 }, { lifesteal: 5, critDmg: 25 }, { dmgPct: 14, defPct: -20 }, { cdr: 8, aspdPct: 12 }],
  lightbringer: [{ matkPct: 15, party: 1 }, { dmgReduce: 15, blocks: 3, short: 20 }, { regenPct: 200, party: 1 }, { resGainPct: 100, matkPct: 8 }, { castReduce: 20, hit: 30, party: 1 }]
};
Object.assign(ULTS, ULTS_NEW); Object.assign(BUFFS, BUFFS_NEW);
const MOD_TH = { atkPct: 'ATK', matkPct: 'MATK', defPct: 'DEF', mdefPct: 'MDEF', aspdPct: 'ความเร็วโจมตี', movePct: 'ความเร็วเดิน', crit: 'Critical', critDmg: 'Crit Damage', flee: 'Flee', hit: 'Hit', hpPct: 'HP สูงสุด', spPct: 'SP สูงสุด', lifesteal: 'Lifesteal', dmgReduce: 'ลดดาเมจ', comboWin: 'เวลาคอมโบ (วิ)', comboDmg: 'ดาเมจคอมโบ', castReduce: 'ร่ายเร็ว', dmgPct: 'ดาเมจ', regenPct: 'ฟื้นฟู HP', ccRes: 'ต้านควบคุม', dropPct: 'อัตราดรอป', cdr: 'ลดคูลดาวน์', range: 'ระยะโจมตี', guardAlly: 'รับดาเมจแทนเพื่อน', str: 'STR', int: 'INT', dex: 'DEX', agi: 'AGI', blocks: 'บล็อกการโจมตี (ครั้ง)', spRegen: 'ฟื้น SP ×', extraStack: 'ชั้นสถานะเพิ่ม', resGainPct: 'พลังพิเศษได้เร็วขึ้น' };
const pctKeys = new Set(['atkPct', 'matkPct', 'defPct', 'mdefPct', 'aspdPct', 'movePct', 'critDmg', 'hpPct', 'spPct', 'lifesteal', 'dmgReduce', 'comboDmg', 'castReduce', 'dmgPct', 'regenPct', 'ccRes', 'dropPct', 'cdr', 'guardAlly', 'resGainPct']);
function modsText(m) {
  const out = [];
  for (const k in m) {
    if (['party', 'short'].includes(k)) continue;
    if (k === 'ccImmune') out.push('ไม่ติดสถานะควบคุม'); else if (k === 'stealth') out.push('ล่องหน (ไม่หลุดเมื่อโจมตี)'); else if (k === 'invuln') out.push('อมตะ'); else if (k === 'giant') out.push('ร่างยักษ์ (AoE ใหญ่ขึ้น 50%)');
    else if (k === 'element') out.push(m[k] === 'cycle' ? 'เปลี่ยนธาตุอาวุธวนไฟ→น้ำแข็ง→สายฟ้า→ลม→ดิน ทุกครั้งที่ใช้' : 'อาวุธธาตุศักดิ์สิทธิ์');
    else if (k === 'soulSiphon') out.push('DoT ทุกชนิดดูด HP 2% ให้ตัวเอง'); else if (k === 'summonBuff') out.push('สมุน/สัตว์เลี้ยงแข็งแกร่งขึ้น'); else if (k === 'spShield') out.push(`ดาเมจ ${m[k]}% ไปหัก SP แทน HP`); else if (k === 'heatSink') out.push('Heat ลดเร็วขึ้น 2 เท่า');
    else out.push(`${MOD_TH[k] || k} ${m[k] > 0 ? '+' : ''}${m[k]}${pctKeys.has(k) ? '%' : ''}`);
  }
  return out.join(' · ');
}

// ---------------------------------------------------------------- names generated from the actual mechanics
const WEAPON_WORD = { sword: 'Slash', spear: 'Thrust', axe: 'Cleave', dagger: 'Stab', bow: 'Arrow', staff: 'Bolt', mace: 'Smite', knuckle: 'Fist', scythe: 'Reap', gun: 'Shot', chakram: 'Disc', orb: 'Orb', claw: 'Rend', katana: 'Iai', prism: 'Ray' };
const DNOUN = {
  strike: ['Strike', 'Blow', 'Rend', 'Smash', 'Assault', 'Edge'], combo: ['Flurry', 'Onslaught', 'Frenzy', 'Rampage', 'Barrage', 'Chainblows'], spin: ['Whirlwind', 'Cyclone', 'Vortex', 'Spiral', 'Tempest', 'Pirouette'],
  arc: ['Crescent', 'Sweep', 'Arc', 'Fan', 'Reaver', 'Halfmoon'], wave: ['Wave', 'Lance', 'Ray', 'Piercer', 'Beam', 'Spear'], lance: ['Lance', 'Ray', 'Beam', 'Spear', 'Wave', 'Lancet'], pierce: ['Piercer', 'Skewer', 'Lance', 'Needle', 'Ray', 'Spike'],
  dash: ['Charge', 'Rush', 'Lunge', 'Surge', 'Stampede', 'Dash'], leap: ['Drop', 'Meteor', 'Plunge', 'Leap', 'Descent', 'Comet'], blink: ['Step', 'Phantom', 'Shift', 'Blink', 'Ambush', 'Flicker'], blinkcast: ['Shift', 'Phase', 'Warp', 'Flicker', 'Blink', 'Displace'],
  pull: ['Hook', 'Grasp', 'Tether', 'Chain', 'Lure', 'Snatch'], quake: ['Quake', 'Shockwave', 'Eruption', 'Pulse', 'Burst', 'Tremor'], nova: ['Nova', 'Burst', 'Pulse', 'Flare', 'Eruption', 'Bloom'],
  throw: ['Javelin', 'Throw', 'Hurl', 'Toss', 'Dart', 'Missile'], shot: ['Shot', 'Bolt', 'Round', 'Missile', 'Dart', 'Snipe'], bolt: ['Bolt', 'Missile', 'Orb', 'Spark', 'Shard', 'Comet'],
  volley: ['Volley', 'Spread', 'Scatter', 'Salvo', 'Hailshot', 'Fanfire'], rain: ['Rain', 'Bombard', 'Downpour', 'Deluge', 'Hail', 'Barrage'], grenade: ['Grenade', 'Cluster', 'Charge', 'Bomb', 'Canister', 'Shell'],
  ricochet: ['Ricochet', 'Chain', 'Arc', 'Relay', 'Bounce', 'Cascade'], trap: ['Trap', 'Mine', 'Snare', 'Rune', 'Glyph', 'Ward'], zone: ['Field', 'Circle', 'Ground', 'Mire', 'Sanctum', 'Domain'],
  delayed: ['Doom', 'Fuse', 'Seal', 'Countdown', 'Brand', 'Omen'], summon: ['Calling', 'Legion', 'Pack', 'Host', 'Servants', 'Swarm'], backstep: ['Retreat', 'Evasion', 'Recoil', 'Disengage', 'Backflip', 'Withdraw'],
  scythe: ['Harvest', 'Sever', 'Cull', 'Reaping', 'Scythe', 'Requiem']
};
const TADJ = {
  airborne: ['Rising', 'Skyward', 'Soaring', 'Uplifting'], bleed: ['Crimson', 'Bloody', 'Sanguine', 'Lacerating'], armorbreak: ['Sundering', 'Shattering', 'Rending', 'Breaking'], knockdown: ['Toppling', 'Crushing', 'Grounding', 'Felling'],
  slow: ['Hobbling', 'Sluggish', 'Leaden', 'Dragging'], stun: ['Stunning', 'Dazing', 'Concussive', 'Jarring'], root: ['Binding', 'Rooting', 'Anchoring', 'Fettering'], holybrand: ['Holy', 'Radiant', 'Sacred', 'Hallowed'],
  silence: ['Silent', 'Hushing', 'Muting', 'Quieting'], mark: ["Hunter's", 'Marking', 'Branding', 'Tracking'], fear: ['Dread', 'Terror', 'Haunting', 'Fearsome'], poison: ['Venomous', 'Toxic', 'Noxious', 'Viper'],
  blind: ['Blinding', 'Shrouding', 'Dazzling', 'Veiled'], burn: ['Blazing', 'Searing', 'Infernal', 'Ember'], chill: ['Frost', 'Glacial', 'Rime', 'Shivering'], wet: ['Tidal', 'Drenching', 'Torrent', 'Misting'],
  shock: ['Thunder', 'Static', 'Voltaic', 'Stormcall'], curse: ['Cursed', 'Hexed', 'Accursed', 'Blighted'], freeze: ['Frozen', 'Arctic', 'Permafrost', 'Icebound']
};
const HOOK_WORD = { consume: 'Finale', perStack: 'Detonation', perRes: 'Overflow', perSummon: 'Sacrifice', purge: 'Purge', execute: 'Execution', chain: 'Follow-up', combo: 'Crescendo', lowhp: 'Desperation', backstab: 'Treachery', stealthOpen: 'Ambush', reaction: 'Catalyst', bonus: 'Exploit', none: 'Art' };
function makeName(sk, d, t, hk, cls, usedNames, weapon) {
  const nouns = [...(DNOUN[d] || ['Strike'])];
  if (d === 'strike' || d === 'combo') nouns.unshift(WEAPON_WORD[weapon]);
  const adjs = TADJ[t] || ['Mighty'];
  const h = hashStr(sk.id + 'name-v4');
  for (let k = 0; k < adjs.length * nouns.length; k++) {
    const a = adjs[(h + k) % adjs.length], n = nouns[(Math.floor(h / 7) + Math.floor(k / adjs.length)) % nouns.length];
    const nm = `${a} ${n}`; if (!usedNames.has(nm.toLowerCase())) { usedNames.add(nm.toLowerCase()); return nm; }
  }
  for (const a of adjs) for (const n of nouns) { const nm = `${a} ${n} ${HOOK_WORD[hk]}`; if (!usedNames.has(nm.toLowerCase())) { usedNames.add(nm.toLowerCase()); return nm; } }
  return sk.name;
}

// ---------------------------------------------------------------- active skill builder
function buildActive(sk, kit, cls, used, prev, idxInClass) {
  const h = hashStr(sk.id + 'v4');
  const rnd = (n) => (hashStr(sk.id + ':v4:' + n) % 10007) / 10007;
  const role = sk.role;
  let D = pickName(sk.name, NAME_D, kit.D);
  let T = pickName(sk.name, NAME_T, kit.T);
  const hookPool = role === 'F' ? kit.H.filter((x) => ['consume', 'perStack', 'perRes', 'execute', 'purge', 'perSummon', 'reaction', 'lowhp'].includes(x)) : role === 'L' ? kit.H.filter((x) => ['bonus', 'chain', 'combo', 'backstab', 'stealthOpen'].includes(x)) : role === 'S' ? ['none', ...kit.H.filter((x) => ['backstab', 'stealthOpen'].includes(x))] : kit.H;
  let pick = null;
  for (let pass = 0; pass < 4 && !pick; pass++) {
    const Ds = D && pass < 2 ? [D] : [...kit.D].sort((a, b) => ((hashStr(sk.id + a) % 97) - (hashStr(sk.id + b) % 97)));
    const Ts = T && pass < 1 ? [T] : [...kit.T].sort((a, b) => ((hashStr(sk.id + a + 't') % 97) - (hashStr(sk.id + b + 't') % 97)));
    const Hs = pass < 3 ? [...hookPool] : [...kit.H];
    const Us = [...kit.U].sort((a, b) => ((hashStr(sk.id + a + 'u') % 97) - (hashStr(sk.id + b + 'u') % 97)));
    outer: for (const d of Ds) for (const t of Ts) for (const hk of Hs.sort((a, b) => ((hashStr(sk.id + a + 'h') % 97) - (hashStr(sk.id + b + 'h') % 97)))) for (const u of Us) {
      const key = `${d}|${t}|${hk}|${u}`;
      if (used.has(key)) continue;
      if (hk === 'chain' && !prev) continue;
      pick = { d, t, hk, u }; used.add(key); break outer;
    }
  }
  const { d, t, hk, u } = pick;
  const el = (t === 'burn' ? 'fire' : t === 'chill' || t === 'freeze' ? 'ice' : t === 'wet' ? 'water' : t === 'shock' ? 'lightning' : t === 'holybrand' ? 'holy' : t === 'curse' ? 'dark' : t === 'poison' ? 'poison' : t === 'bleed' ? 'blood' : null);
  const element = el && kit.E.includes(el) ? el : kit.E[(h >>> 5) % kit.E.length];
  const melee = ['strike', 'combo', 'spin', 'arc', 'dash', 'leap', 'pull', 'quake', 'blink', 'scythe'].includes(d) && kit.range < 4 || ['spin', 'quake', 'scythe'].includes(d) && cls !== 'elementalist';
  const out = { id: sk.id, cls, kind: 'attack', idx: sk.idx, name: sk.name, branch: 'Active', role, reqLv: sk.reqLv, maxLv: 10, element, dmgType: sk.dmgType, melee: melee || kit.range < 4 };
  const lvl = 1 + idxInClass / 40; // later skills hit harder
  let base = (role === 'F' ? 2.8 : role === 'L' ? 2.0 : role === 'S' ? 1.6 : 1.8) * (0.85 + rnd(1) * 0.35) * lvl;
  const rngBase = kit.range;
  out.range = r1(rngBase + (rngBase < 4 ? rnd(2) * 0.6 : rnd(2) * 2));
  let what;
  switch (d) {
    case 'strike': out.shape = 'single'; out.hits = 1 + Math.floor(rnd(3) * 2); what = `ฟาดเป้าเดียว`; break;
    case 'combo': out.shape = 'single'; out.hits = 3 + Math.floor(rnd(3) * 4); base *= 1.1; what = `โจมตีรัว ${out.hits} ครั้ง`; break;
    case 'spin': out.shape = 'circle'; out.self = true; out.radius = r1(2.5 + rnd(4) * 1.5); out.hits = 2 + Math.floor(rnd(3) * 3); base *= 0.8; what = `หมุนโจมตีรอบตัว รัศมี ${out.radius}`; break;
    case 'arc': out.shape = 'cone'; out.radius = r1(rngBase < 4 ? 3.5 + rnd(4) : 6 + rnd(4) * 2); base *= 0.9; what = rngBase < 4 ? `ฟันเป็นรูปกรวยข้างหน้า ${out.radius} ช่อง` : `ยิงกระจายรูปกรวย ${out.radius} ช่อง`; break;
    case 'wave': case 'lance': case 'pierce': out.shape = 'line'; out.length = Math.round(6 + rnd(4) * 6); out.width = 1.3; if (rngBase < 4) out.range = out.length; base *= 0.95; what = `ปล่อยคลื่นทะลุเส้นตรง ${out.length} ช่อง`; break;
    case 'dash': out.shape = 'line'; out.move = { type: 'dash', dist: 4 + Math.floor(rnd(4) * 4) }; out.length = out.move.dist + 1; out.width = 1.5; base *= 0.9; what = `พุ่งทะลุ ${out.move.dist} ช่อง โจมตีทุกเป้าในเส้นทาง`; break;
    case 'leap': out.shape = 'circle'; out.self = true; out.radius = r1(2 + rnd(4)); out.move = { type: 'leap', dist: 5 + Math.floor(rnd(5) * 3) }; what = `กระโดด ${out.move.dist} ช่องแล้วกระแทกพื้นรัศมี ${out.radius}`; break;
    case 'blink': case 'blinkcast': out.shape = 'single'; out.move = { type: 'blink', dist: 7 }; what = `วาร์ปไปด้านหลังเป้าแล้วโจมตี`; break;
    case 'pull': out.shape = 'single'; out.pull = 4 + Math.floor(rnd(5) * 3); base *= 0.8; what = `เกี่ยวเป้าดึงเข้ามา ${out.pull} ช่อง`; break;
    case 'quake': case 'nova': out.shape = 'circle'; out.self = true; out.radius = r1(3 + rnd(4) * 2); base *= 0.85; what = `ระเบิดพลังรอบตัวรัศมี ${out.radius}`; break;
    case 'throw': case 'shot': case 'bolt': out.shape = 'single'; out.range = Math.max(out.range, r1(7 + rnd(2) * 4)); what = `ยิง/ขว้างเป้าเดียวระยะ ${out.range}`; break;
    case 'volley': out.shape = 'cone'; out.radius = r1(6 + rnd(4) * 2); out.hits = 2 + Math.floor(rnd(3) * 2); base *= 0.8; what = `ยิงกระจายรูปกรวย ${out.hits} ระลอก`; break;
    case 'rain': case 'grenade': out.shape = 'circle'; out.self = false; out.radius = r1(d === 'grenade' ? 2.2 + rnd(4) : 2.8 + rnd(4) * 1.5); out.hits = d === 'grenade' ? 1 : 4 + Math.floor(rnd(3) * 4); out.range = Math.max(out.range, 8); base *= 0.85; what = d === 'grenade' ? `ขว้างระเบิดลงจุดเป้า รัศมี ${out.radius}` : `ถล่มพื้นที่เป้า ${out.hits} ครั้ง รัศมี ${out.radius}`; break;
    case 'ricochet': out.shape = 'chain'; out.chain = 3 + Math.floor(rnd(4) * 3); out.range = Math.max(out.range, 8); base *= 0.85; what = `กระดอนไปมา ${out.chain} เป้า`; break;
    case 'trap': out.shape = 'single'; out.trap = true; what = `วางกับดัก (สูงสุด 6 อัน) ระเบิดเมื่อศัตรูเหยียบ`; break;
    case 'zone': out.shape = 'circle'; out.self = false; out.radius = r1(2.5 + rnd(4) * 1.5); out.zone = { mult: r1(0.35 + rnd(5) * 0.4), tick: [0.5, 1, 1.5][(h >>> 7) % 3], dur: 4 + Math.floor(rnd(6) * 5) }; out.range = Math.max(out.range, 7); base *= 0.5; what = `สร้างพื้นที่ ${out.zone.dur} วิ ดาเมจ ${Math.round(out.zone.mult * 100)}% ทุก ${out.zone.tick} วิ`; break;
    case 'delayed': out.shape = 'single'; out.delay = 2 + Math.floor(rnd(5) * 3); base *= 1.9; what = `ฝังพลังที่เป้า ระเบิดหลัง ${out.delay} วินาที`; break;
    case 'summon': out.shape = 'single'; out.summon = { count: 1 + Math.floor(rnd(3) * 3), dur: 12 + Math.floor(rnd(4) * 12) }; base *= 0.6; what = `เรียกสมุน ${out.summon.count} ตัว ${out.summon.dur} วิ แล้วโจมตีเป้า`; break;
    case 'backstep': out.shape = 'single'; out.move = { type: 'back', dist: 3 + Math.floor(rnd(4) * 3) }; what = `ถอยหลัง ${out.move.dist} ช่องพร้อมยิงสวน`; break;
    case 'scythe': out.shape = 'cone'; out.radius = r1(3 + rnd(3)); out.melee = true; out.range = 2.6; what = `เหวี่ยงเคียวกวาดรูปกรวย`; break;
    default: out.shape = 'single'; what = 'โจมตี';
  }
  out.hits = out.hits || 1;
  // status
  const stacks = DOTS.includes(t) ? 1 + Math.floor(rnd(6) * 3) : t === 'chill' ? 1 + Math.floor(rnd(6) * 2) : 1;
  const dur = r1(DUR[t] * (0.8 + rnd(7) * 0.5));
  if (hk !== 'consume' && hk !== 'perStack' && hk !== 'purge') out.applies = [{ tag: t, stacks, dur }];
  const parts = [what];
  // hook
  switch (hk) {
    case 'consume': { const ct = kit.T[(kit.T.indexOf(t) + 1 + (h >>> 9) % (kit.T.length - 1)) % kit.T.length]; out.consumes = [ct]; base *= 1.7; out.applies = [{ tag: t, stacks, dur }]; parts.push(`ใช้สถานะ ${TAG[ct]} ของเป้าเพื่อดาเมจ ×1.15 (ไม่มี = ครึ่งเดียว)`); break; }
    case 'perStack': { const ct = DOTS.includes(t) ? t : kit.T.find((x) => DOTS.includes(x)) || 'bleed'; out.consumes = [ct]; out.perUnit = r1(0.7 + rnd(8) * 0.7); out.unit = 'stack'; base *= 0.6; parts.push(`ระเบิด ${TAG[ct]} ทุกชั้น +${Math.round(out.perUnit * 100)}% ต่อชั้น`); break; }
    case 'purge': out.consumes = ['curse']; out.reaction = 'purge'; base *= 1.6; out.applies = [{ tag: t, stacks, dur }]; parts.push('ถ้าเป้าติด Curse เกิดปฏิกิริยา PURGE ×3'); break;
    case 'perRes': out.consumeRes = true; out.perUnit = kit.res === 'Fury' || kit.res === 'Heat' || kit.res === 'Faith' ? Math.round((0.04 + rnd(8) * 0.04) * 100) / 100 : r1(0.5 + rnd(8) * 0.6); out.unit = 'res'; parts.push(`ใช้ ${kit.res} ทั้งหมด +${Math.round(out.perUnit * 100)}% ต่อแต้ม`); break;
    case 'perSummon': out.perUnit = r1(1.5 + rnd(8) * 1.5); out.unit = 'summon'; parts.push(`สังเวยสมุนทั้งหมด +${Math.round(out.perUnit * 100)}% ต่อตัว`); break;
    case 'bonus': { const bt = kit.T[(kit.T.indexOf(t) + 2 + (h >>> 10) % 3) % kit.T.length]; const pct = 40 + Math.round(rnd(9) * 60); out.bonusIf = [[bt, pct]]; parts.push(`ถ้าเป้ามี ${TAG[bt]} ดาเมจ +${pct}%`); break; }
    case 'chain': out.chainAfter = prev; parts.push('ต่อจากสกิลก่อนหน้าในตำรา = ×1.5 (ไม่ต่อ = ×0.7)'); break;
    case 'combo': out.cond = { type: 'combo', v: 3 + Math.floor(rnd(21) * 8) }; base *= 1.3; parts.push(`แรงเต็มเมื่อคอมโบ ≥ ${out.cond.v}`); break;
    case 'execute': out.cond = { type: 'targetHp', v: 20 + Math.floor(rnd(22) * 16) }; base *= 2.2; parts.push(`ปิดฉาก: แรงเต็มเมื่อ HP เป้า < ${out.cond.v}%`); break;
    case 'lowhp': out.lowHpScale = true; parts.push('ยิ่ง HP ตัวเองต่ำ ยิ่งแรง (สูงสุด ×2.5)'); break;
    case 'backstab': out.backstab = { back: r1(base * 1.8), front: r1(base * 0.8) }; parts.push('จากด้านหลังแรงขึ้นมาก'); break;
    case 'stealthOpen': out.fromStealth = 1.5; parts.push('ใช้ขณะล่องหน ×1.5 และคริติคอลแน่นอน'); break;
    case 'reaction': out.reaction = ['electrocute', 'steam', 'firestorm', 'toxic'][(h >>> 13) % 4]; base *= 1.3; parts.push(`บังคับเกิดปฏิกิริยา ${out.reaction.toUpperCase()} ถ้าเป้ามีสถานะที่ตรง`); break;
  }
  // utility
  switch (u) {
    case 'lifesteal': out.lifesteal = 6 + Math.round(rnd(10) * 14); parts.push(`ดูดเลือด ${out.lifesteal}%`); break;
    case 'shield': out.shield = { pct: 6 + Math.round(rnd(10) * 10) }; parts.push(`ได้โล่ ${out.shield.pct}% HP`); break;
    case 'push': out.push = 2 + Math.floor(rnd(14) * 3); parts.push(`ผลักศัตรู ${out.push} ช่อง`); break;
    case 'pull': if (!out.pull) { out.pull = 3; parts.push('ดูดศัตรูเข้าหาจุดโจมตี'); } break;
    case 'nextBonus': out.nextBonus = 20 + Math.round(rnd(10) * 40); parts.push(`สกิลถัดไป +${out.nextBonus}%`); break;
    case 'resGain': out.resGain = 1 + Math.floor(rnd(15) * 2); parts.push(`+${kit.res} ${out.resGain}`); break;
    case 'pierce': out.pierce = r1(0.2 + rnd(10) * 0.4); parts.push(`ทะลุ DEF ${Math.round(out.pierce * 100)}%`); break;
    case 'taunt': out.taunt = true; parts.push('ยั่วยุมอนที่โดน 4 วิ'); break;
    case 'selfHeal': out.selfHeal = 4 + Math.round(rnd(10) * 8); parts.push(`ฟื้น HP ${out.selfHeal}%`); break;
    case 'reflect': out.reflect = 20 + Math.round(rnd(10) * 20); parts.push(`สะท้อนดาเมจ ${out.reflect}% 4 วิ`); break;
    case 'cleanse': out.cleanse = true; parts.push('ล้างสถานะผิดปกติของปาร์ตี้รอบตัว'); break;
    case 'hpCost': out.hpCost = 4 + Math.floor(rnd(16) * 5); base *= 1.3; parts.push(`แลก HP ${out.hpCost}% เพื่อดาเมจ ×1.3`); break;
    case 'stealth': out.stealth = 2 + Math.floor(rnd(17) * 3); parts.push(`ล่องหน ${out.stealth} วิหลังใช้`); break;
    case 'dispel': out.dispel = 1 + Math.floor(rnd(18) * 2); parts.push(`ลบบัฟศัตรู ${out.dispel} อัน`); break;
    case 'extendDots': out.extendDots = 2 + Math.floor(rnd(19) * 3); parts.push(`ยืด DoT บนเป้า +${out.extendDots} วิ`); break;
    case 'manaBurn': out.manaBurn = 10 + Math.floor(rnd(20) * 15); parts.push(`เผา SP เป้า ${out.manaBurn}%`); break;
    case 'partyHeal': out.heal = { pct: 4 + Math.round(rnd(11) * 8), who: 'party' }; parts.push(`ฮีลปาร์ตี้ ${out.heal.pct}%`); break;
    case 'healFromDmg': out.healFromDmg = r1(0.4 + rnd(11) * 0.6); parts.push(`ฮีลเพื่อน HP ต่ำสุด ${Math.round(out.healFromDmg * 100)}% ของดาเมจ`); break;
    case 'cdShift': out.cdShift = r1(1 + rnd(10) * 2); parts.push(`ลดคูลดาวน์สกิลอื่นทั้งหมด ${out.cdShift} วิ`); break;
    case 'haste': out.haste = 15 + Math.round(rnd(10) * 15); parts.push(`เร่งเวลา: ความเร็วโจมตี/เดิน +${out.haste}% 4 วิ`); break;
    case 'blindAoe': out.applies = (out.applies || []).concat([{ tag: 'blind', stacks: 1, dur: r1(1.5 + rnd(12)) }]); break;
  }
  // signature mechanic (v4)
  const pool = MECH[cls] || ['none'];
  let mech = 'none';
  for (let k = 0; k < pool.length; k++) { const m = pool[(idxInClass + (h >>> 3) + k) % pool.length]; if (mechFits(m, out)) { mech = m; break; } }
  switch (mech) {
    case 'echo': out.echo = { delay: r1(0.6 + rnd(30) * 0.6), mult: Math.round((0.35 + rnd(31) * 0.25) * 100) / 100 }; base *= 0.85; parts.push(`เสียงสะท้อน: ซ้ำอีกครั้งหลัง ${out.echo.delay} วิ แรง ${Math.round(out.echo.mult * 100)}%`); break;
    case 'orbit': out.orbit = { n: 2 + Math.floor(rnd(32) * 3), dur: 4 + Math.floor(rnd(33) * 4), r: 1.9, mult: Math.round((0.12 + rnd(34) * 0.12) * 100) / 100 }; base *= 0.8; parts.push(`ลูกพลัง ${out.orbit.n} ลูกโคจรรอบตัว ${out.orbit.dur} วิ ทำดาเมจทุก 0.5 วิ`); break;
    case 'wall': out.wall = { dur: 4 + Math.floor(rnd(35) * 3), mult: Math.round((0.15 + rnd(36) * 0.15) * 100) / 100 }; base *= 0.85; parts.push(`สร้างกำแพงธาตุขวางทาง ${out.wall.dur} วิ`); break;
    case 'boomerang': out.boomerang = Math.round((0.5 + rnd(37) * 0.3) * 100) / 100; base *= 0.85; parts.push(`บูมเมอแรง: วกกลับมาโดนอีกครั้ง ${Math.round(out.boomerang * 100)}%`); break;
    case 'split': out.split = { n: 2 + Math.floor(rnd(38) * 2), mult: Math.round((0.35 + rnd(39) * 0.25) * 100) / 100 }; base *= 0.9; parts.push(`แตกตัวกระโดดไปหาศัตรูใกล้เคียง ${out.split.n} ตัว ${Math.round(out.split.mult * 100)}%`); break;
    case 'trail': out.trail = { dur: 3 + Math.floor(rnd(40) * 3), mult: Math.round((0.15 + rnd(41) * 0.15) * 100) / 100 }; parts.push(`ทิ้งรอยธาตุตามเส้นทางพุ่ง ${out.trail.dur} วิ`); break;
    case 'stackSelf': out.stackSelf = { pct: 3 + Math.floor(rnd(42) * 4), max: 5 }; parts.push(`ทุกครั้งที่โดน: ดาเมจตัวเอง +${out.stackSelf.pct}% ซ้อนได้ 5 ชั้น (6 วิ)`); break;
    case 'resetOnKill': out.resetOnKill = 1; parts.push('สังหารเป้า = รีเซ็ตคูลดาวน์สกิลนี้ทันที'); break;
    case 'overcharge': out.overcharge = { sp: 8 + Math.floor(rnd(43) * 6), mult: Math.round((1.3 + rnd(44) * 0.2) * 100) / 100 }; parts.push(`โอเวอร์ชาร์จ: ใช้ SP เพิ่ม ${out.overcharge.sp}% ของสูงสุด เพื่อแรง ×${out.overcharge.mult}`); break;
  }
  out.mech = mech;
  out.dmg = r1(Math.min(7.5, base) * (out.hits > 1 ? 1 / Math.sqrt(out.hits) : 1));
  if (out.backstab) out.dmg = out.backstab.back;
  if (out.applies) parts.splice(1, 0, out.applies.map((a) => `ใส่ ${TAG[a.tag]}${a.stacks > 1 ? ' ' + a.stacks + ' ชั้น' : ''} ${a.dur} วิ`).join(' · '));
  parts.splice(1, 0, `${Math.round(out.dmg * 100)}%${out.hits > 1 ? ' ×' + out.hits : ''} ธาตุ${ELT[element]}`);
  out.desc = parts.join(' · ');
  out.design = `${d}|${t}|${hk}|${u}|${mech}`;
  out._naming = [d, t, hk];
  return out;
}

function buildUlt(sk, cls, i, kit) {
  const [type, o] = ULTS[cls][i];
  const out = { id: sk.id, cls, kind: 'ult', idx: sk.idx, name: sk.name, branch: 'Ultimate', role: 'U', reqLv: [60, 60, 150, 150, 220][i], maxLv: 5, element: kit.E[i % kit.E.length], dmgType: sk.dmgType, melee: false, sp: 0, cast: o.cast || 0, range: o.range || 8, hits: 1 };
  const tagTxt = (t) => t ? ` · ใส่ ${TAG[t[0]]}${t[1] > 1 ? ' ' + t[1] + ' ชั้น' : ''}` : '';
  const ap = (t) => (t ? [{ tag: t[0], stacks: t[1] || 1, dur: t[2] || DUR[t[0]] }] : undefined);
  switch (type) {
    case 'nuke': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: o.dmg / (o.hits || 1), hits: o.hits || 1, applies: ap(o.tag) }); if (o.leap) out.move = { type: 'leap', dist: 8 }; out.desc = `${o.leap ? 'กระโดดลงทุ่ม' : 'ปลดปล่อยพลัง'}รอบตัวรัศมี ${o.r} รวม ${Math.round(o.dmg * 100)}%${o.hits ? ' (' + o.hits + ' ฮิต)' : ''}${tagTxt(o.tag)}`; break;
    case 'barrage': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: o.dmg, hits: o.hits, applies: ap(o.tag) }); out.desc = `ถล่มทุกเป้าในรัศมี ${o.r} ทั้งหมด ${o.hits} ครั้ง ครั้งละ ${Math.round(o.dmg * 100)}%${tagTxt(o.tag)}`; break;
    case 'stackburst': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: r1(3 + o.per * o.tag[1]), applies: ap(o.tag) }); out.desc = `ใส่ ${TAG[o.tag[0]]} ${o.tag[1]} ชั้นทุกเป้ารอบตัว แล้วระเบิดทุกชั้น +${Math.round(o.per * 100)}%/ชั้น`; break;
    case 'megaline': Object.assign(out, { shape: 'line', length: o.len, width: 2.2, dmg: o.dmg, applies: ap(o.tag), pierce: o.pierce ? 0.6 : 0, range: o.len }); out.desc = `ลำพลังยักษ์เส้นตรง ${o.len} ช่อง ${Math.round(o.dmg * 100)}%${o.pierce ? ' ทะลุ DEF 60%' : ''}${tagTxt(o.tag)}`; break;
    case 'transform': Object.assign(out, { shape: 'self', dmg: 0, transform: { dur: o.dur, mods: o.mods, party: !!o.party } }); if (o.mods.invuln) out.invuln = true; if (o.fullRes) out.resGain = 99; out.desc = `แปลงร่าง ${o.dur} วิ${o.party ? ' (ทั้งปาร์ตี้)' : ''}: ${modsText(o.mods)}${o.fullRes ? ` · ${kit.res} เต็มทันที` : ''}`; break;
    case 'dome': Object.assign(out, { shape: 'self', dmg: 0, transform: { dur: o.dur, mods: o.mods, party: true } }); out.desc = `สร้างโดมป้องกัน ${o.dur} วิ ปาร์ตี้รอบตัว: ${modsText(o.mods)}`; break;
    case 'saint': Object.assign(out, { shape: 'self', dmg: 0, invuln: true, transform: { dur: o.dur, mods: { ccImmune: 1 }, party: true }, heal: { pct: o.heal, who: 'party' } }); out.desc = `ปาร์ตี้รอบตัวอมตะ ${o.dur} วิ และฟื้น HP ${o.heal}%`; break;
    case 'blackhole': Object.assign(out, { shape: 'circle', self: false, radius: o.r, dmg: o.dmg, pull: 6, applies: ap(o.tag), cast: 0.8 }); out.desc = `เปิดหลุมดำรัศมี ${o.r} ดูดทุกเป้าเข้ากลาง ${Math.round(o.dmg * 100)}%${tagTxt(o.tag)}`; break;
    case 'plague': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: 1.2, applies: [...ap(o.tag), ...(o.tag2 ? ap(o.tag2) : [])] }); out.desc = `แพร่ ${TAG[o.tag[0]]}${o.tag2 ? ' + ' + TAG[o.tag2[0]] : ''} ไปทุกเป้าในจอ${o.cut ? ' และลดฮีลที่เป้าได้รับ 40%' : ''}`; break;
    case 'execute': Object.assign(out, { shape: 'single', dmg: o.dmg, execute: o.th, range: 6 }); out.desc = `เป้าเดียว: ศัตรูทั่วไป HP < ${o.th}% ตายทันที · บอสโดน ${Math.round(o.dmg * 100)}%`; break;
    case 'executeSweep': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: o.dmg, execute: o.th }); out.desc = `เคียวยักษ์กวาดรัศมี ${o.r} ${Math.round(o.dmg * 100)}% ศัตรูทั่วไป HP < ${o.th}% ตายทันที`; break;
    case 'zoneself': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: 0.5, zone: { mult: o.mult, tick: 0.5, dur: o.dur }, applies: ap(o.tag) }); out.desc = `กลายเป็นพายุใบมีดรอบตัว ${o.dur} วิ ${Math.round(o.mult * 100)}% ทุก 0.5 วิ${tagTxt(o.tag)}`; break;
    case 'zonetarget': Object.assign(out, { shape: 'circle', self: false, radius: o.r, dmg: 0.6, zone: { mult: o.mult, tick: 1, dur: o.dur }, applies: ap(o.tag), range: 12 }); out.desc = `ฝนธาตุถล่มพื้นที่รัศมี ${o.r} ${o.dur} วิ ${Math.round(o.mult * 100)}%/วิ${tagTxt(o.tag)}`; break;
    case 'traps': Object.assign(out, { shape: 'single', dmg: 2.5, trap: true, multiTrap: o.n }); out.desc = `วางทุ่นระเบิด ${o.n} จุดรอบตัวทันที`; break;
    case 'summonArmy': Object.assign(out, { shape: 'self', dmg: 0, summon: { count: o.n, dur: o.dur }, summonMult: o.mult, summonShape: o.shape }); out.desc = `เรียก${o.shape === 'drone' ? 'ป้อมปืนกล' : o.shape === 'beast' ? 'สัตว์วิญญาณยักษ์' : 'กองทัพผี'} ${o.n} ตัว ${o.dur} วิ (แรง ${Math.round(o.mult * 100)}%)`; break;
    case 'ricochetUlt': Object.assign(out, { shape: 'chain', chain: o.n, dmg: o.dmg, applies: ap(o.tag), range: 12 }); out.desc = `สายฟ้าล่าเป้ากระโดด ${o.n} เป้า ${Math.round(o.dmg * 100)}%${tagTxt(o.tag)}`; break;
    case 'revive': Object.assign(out, { shape: 'self', dmg: 0, revive: true, heal: { pct: o.heal, who: 'party' } }); out.desc = `ชุบชีวิตสมาชิกปาร์ตี้ที่ตายในรัศมี 12 ช่อง และฮีลทั้งปาร์ตี้ ${o.heal}%`; break;
    case 'zoneheal': Object.assign(out, { shape: 'circle', self: true, radius: o.r, dmg: 0, heal: { pct: o.heal, who: 'party', zone: true }, invuln: true, transform: { dur: 3, mods: {}, party: true } }); out.desc = `วิหารศักดิ์สิทธิ์รัศมี ${o.r} ฮีล ${o.heal}%/วิ และปาร์ตี้อมตะ 3 วิ`; break;
    case 'miracle': Object.assign(out, { shape: 'self', dmg: 0, fullRestore: true, resetCd: true }); out.desc = 'ฟื้น HP/SP เต็มทั้งปาร์ตี้ และรีเซ็ตคูลดาวน์สกิลทั้งหมด (ยกเว้นอัลติเมต)'; break;
    case 'single': Object.assign(out, { shape: 'single', dmg: o.dmg, pierce: o.pierce ? 0.8 : 0, applies: ap(o.tag), range: o.range || 3 }); out.desc = `โจมตีเป้าเดียว ${Math.round(o.dmg * 100)}%${o.pierce ? ' ทะลุ DEF 80%' : ''}${o.cast ? ' (ร่าย ' + o.cast + ' วิ)' : ''}${tagTxt(o.tag)}`; break;
    case 'delayedAoe': Object.assign(out, { shape: 'circle', self: false, radius: o.r, dmg: o.dmg, delay: o.delay, range: 14 }); out.desc = `ยิงพิกัดดาวเทียม ระเบิดหลัง ${o.delay} วิ รัศมี ${o.r} ${Math.round(o.dmg * 100)}%`; break;
  }
  out.design = 'ult:' + type + ':' + JSON.stringify(o);
  return out;
}

function buildBuff(sk, cls, i) {
  const m = Object.assign({}, BUFFS[cls][i]);
  const party = !!m.party, short = m.short; delete m.party; delete m.short;
  if (m.spShield) { m.dmgReduce = m.spShield; }
  const dur = short || [1800, 600, 300, 900, 600][i];
  const h = hashStr(sk.id);
  const out = { id: sk.id, cls, kind: 'buff', idx: sk.idx, name: sk.name, branch: 'Buff', role: 'B', reqLv: [5, 20, 45, 80, 120][i], maxLv: 10, mods: m, party, dur, range: 0, cast: 0 };
  out.cd = r1(short ? short * 3.5 : 6 + i * 1.3 + (h % 10) / 10);
  out.sp = Math.round(18 + i * 7 + (party ? 14 : 0) + (h >> 5) % 6);
  out.desc = `${party ? 'บัฟทั้งปาร์ตี้' : 'บัฟตัวเอง'} ${dur >= 60 ? Math.round(dur / 60) + ' นาที' : dur + ' วินาที'}: ${modsText(BUFFS[cls][i])}`;
  out.design = 'buff:' + JSON.stringify(m);
  return out;
}

module.exports = function redesign(SKILLS, CLASS_SKILLS, CLASS_ORDER) {
  const designs = new Set();
  const usedNames = new Set();
  for (const id in SKILLS) if (SKILLS[id].kind !== 'attack') usedNames.add(SKILLS[id].name.toLowerCase());
  const used = new Set(); // shared by all classes: no delivery|status|hook|utility combo repeats anywhere
  for (const cls of CLASS_ORDER) {
    const kit = KITS[cls];
    const ids = CLASS_SKILLS[cls];
    const actives = ids.filter((id) => SKILLS[id].kind === 'attack').sort((a, b) => SKILLS[a].reqLv - SKILLS[b].reqLv || SKILLS[a].idx - SKILLS[b].idx);
    let prev = null;
    actives.forEach((id, i) => {
      const old = SKILLS[id];
      const sk = buildActive(old, kit, cls, used, prev, i);
      sk.name = makeName(old, sk._naming[0], sk._naming[1], sk._naming[2], cls, usedNames, (require('../shared/data2.js').CLASSES[cls] || require('./class-roster.js')[Object.keys(require('./class-roster.js')).find((k) => require('./class-roster.js')[k].oldId === cls)]).weapon); delete sk._naming;
      // cooldown / cost / cast from the final power so every number reflects the design
      const h = hashStr(id + 'n');
      const total = sk.dmg * sk.hits + (sk.perUnit ? sk.perUnit * 3 : 0) + (sk.zone ? sk.zone.mult * sk.zone.dur / sk.zone.tick * 0.4 : 0);
      sk.cd = r1(Math.max(1, Math.min(40, 1.2 + total * 0.8 + (sk.move ? 1.5 : 0) + (sk.radius || 0) * 0.4 + (sk.summon ? 12 : 0) + (sk.stealth ? 4 : 0) + (sk.chainAfter ? -1 : 0) + ((h % 9) / 10))));
      sk.sp = Math.round((5 + total * 4 + (sk.radius ? 5 : 0) + (sk.summon ? 12 : 0) + (h >> 4) % 5) * (sk.dmgType === 'mag' ? 1.3 : 1));
      sk.cast = sk.dmgType === 'mag' && total >= 2.5 && !sk.move ? r1(0.3 + total * 0.1 + ((h >> 8) % 3) / 10) : 0;
      SKILLS[id] = sk; prev = id;
      designs.add(sk.design);
    });
    ids.filter((id) => SKILLS[id].kind === 'ult').forEach((id, i) => { const sk = buildUlt(SKILLS[id], cls, i, kit); const h = hashStr(id); sk.cd = r1(60 + i * 12 + (h % 90) / 10); SKILLS[id] = sk; designs.add(cls + sk.design); });
    ids.filter((id) => SKILLS[id].kind === 'buff').forEach((id, i) => { SKILLS[id] = buildBuff(SKILLS[id], cls, i); designs.add(cls + SKILLS[id].design); });
  }
  return designs.size;
};

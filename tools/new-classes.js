// Designs for the 15 classes that had no skill set in the original 50-skill system.
// Each class: identity (resource, branches), a design kit (delivery D, statuses T, combo hooks H, utilities U, elements E),
// its signature mechanics, 5 hand-designed ultimates, 5 buffs and 40 active names grouped by branch
// (names steer the designer toward a delivery/status). tools/gen-class-docs.js writes docs/classes/*.md from this.
// Every ultimate set below uses a different combination and no two classes share the same last ultimate.
module.exports = {
  paladin: {
    res: { name: 'Zeal', max: 5, gain: 1 }, role: 'Holy Bruiser / ปกป้อง',
    desc: 'อัศวินศักดิ์สิทธิ์ ฟาดค้อนแสงตีตราศัตรู ปกป้องเพื่อนด้วยคำสาบาน',
    branches: { 'พื้นฐาน': 'Basic', Crusade: 'Crusade', Oath: 'Oath', Sanctum: 'Sanctum' },
    kit: { range: 1.9, D: ['strike', 'arc', 'leap', 'quake', 'dash', 'wave', 'combo', 'pull', 'zone'], T: ['holybrand', 'stun', 'knockdown', 'armorbreak', 'blind', 'slow'], H: ['consume', 'bonus', 'perRes', 'chain', 'combo', 'execute', 'none'], U: ['shield', 'partyHeal', 'cleanse', 'taunt', 'selfHeal', 'reflect', 'none'], E: ['holy', 'neutral', 'lightning'] },
    mech: ['wall', 'echo', 'stackSelf', 'resetOnKill', 'none'],
    ults: [['Hammer of Dawn', 'Awaken I', 'nuke', { r: 8, dmg: 20, tag: ['holybrand', 1, 10], leap: 1 }], ['Aegis of the Oath', 'Awaken I', 'dome', { dur: 10, mods: { dmgReduce: 45, ccRes: 40 } }], ['Verdict Sweep', 'Awaken II', 'executeSweep', { r: 6, th: 22, dmg: 15 }], ['Second Dawn', 'Awaken II', 'revive', { heal: 50 }], ['Consecrated Ground', 'Awaken III', 'zonetarget', { dur: 8, mult: 2.3, r: 6, tag: ['blind', 1] }]],
    buffs: [['Blessed Steel', { atkPct: 10, defPct: 15 }], ['Oath of Valor', { hpPct: 12, ccRes: 20, party: 1 }], ['Devotion Aura', { mdefPct: 25, regenPct: 80, party: 1 }], ['Divine Shield', { blocks: 4, dmgReduce: 20, short: 15 }], ['Zealous Heart', { resGainPct: 100, aspdPct: 10 }]],
    names: {
      'พื้นฐาน': ['Holy Strike', 'Shield Bash', 'Radiant Slash', 'Light Thrust', 'Crusader Blow', 'Sacred Arc', 'Judging Hammer'],
      Crusade: ['Crusader Charge', 'Holy Leap', 'Smite Ground', 'Radiant Wave', 'Blinding Arc', 'Valor Rush', 'Heaven Drop', 'Sacred Quake', 'Light Lance', 'Crusade Combo', 'Purging Slam'],
      Oath: ['Oath Bind', 'Vow Strike', 'Pledge Hook', 'Martyr Blow', 'Penance Bash', 'Faithful Cleave', 'Oathkeeper Rend', 'Covenant Grip', 'Solemn Sweep', 'Iron Vow', 'Sworn Edge'],
      Sanctum: ['Sanctum Circle', 'Holy Ground', 'Consecrate', 'Halo Pulse', 'Divine Field', 'Sacred Pillar', 'Light Burst', 'Blessed Nova', 'Haven Ward', 'Seraphic Slam', 'Dawn Shock']
    }
  },
  cryomancer: {
    res: { name: 'Frost Core', max: 5, gain: 1 }, role: 'Control Mage / แช่แข็ง',
    desc: 'จอมเวทน้ำแข็ง ชะลอ แช่แข็ง แล้วทุบให้แตกกระจาย',
    branches: { 'พื้นฐาน': 'Basic', Glacier: 'Glacier', Blizzard: 'Blizzard', Shatter: 'Shatter' },
    kit: { range: 8, D: ['bolt', 'lance', 'nova', 'rain', 'zone', 'ricochet', 'delayed', 'trap', 'arc'], T: ['chill', 'freeze', 'slow', 'root', 'wet', 'silence'], H: ['consume', 'bonus', 'perStack', 'combo', 'reaction', 'none'], U: ['shield', 'push', 'nextBonus', 'manaBurn', 'cdShift', 'resGain', 'none'], E: ['ice', 'water', 'wind'] },
    mech: ['wall', 'orbit', 'split', 'echo', 'none'],
    ults: [['Absolute Zero', 'Awaken I', 'stackburst', { r: 8, tag: ['chill', 4], per: 2 }], ['Endless Winter', 'Awaken I', 'zonetarget', { dur: 9, mult: 2.1, r: 7, tag: ['slow', 1] }], ['Glacial Spear', 'Awaken II', 'megaline', { len: 22, dmg: 24, tag: ['freeze', 1, 3], pierce: 1 }], ['Ice Age', 'Awaken II', 'nuke', { r: 12, dmg: 12, tag: ['freeze', 1, 4] }], ['Hailstorm Requiem', 'Awaken III', 'barrage', { r: 9, dmg: 1.3, hits: 32, tag: ['chill', 1] }]],
    buffs: [['Frost Armor', { defPct: 20, mdefPct: 20 }], ['Cold Focus', { matkPct: 15, castReduce: 12 }], ['Ice Barrier', { dmgReduce: 25, short: 12 }], ['Winter Mind', { spPct: 25, spRegen: 2 }], ['Crystal Ward', { ccRes: 30, mdefPct: 15, party: 1 }]],
    names: {
      'พื้นฐาน': ['Frost Bolt', 'Ice Shard', 'Chill Orb', 'Snow Dart', 'Rime Spark', 'Frozen Shot', 'Glacial Bolt'],
      Glacier: ['Glacier Lance', 'Ice Wall', 'Frost Pillar', 'Permafrost Field', 'Ice Prison', 'Frozen Root', 'Glacial Spike', 'Iceberg Drop', 'Cryo Line', 'Frost Snare', 'Glacier Fault'],
      Blizzard: ['Blizzard', 'Hail Rain', 'Snow Storm', 'Frost Nova', 'Icy Gust', 'Winter Cyclone', 'Sleet Volley', 'Frost Cloud', 'Freezing Wind', 'Snow Burst', 'Cold Front'],
      Shatter: ['Shatter Burst', 'Ice Splinter', 'Crystal Ricochet', 'Frozen Detonate', 'Brittle Doom', 'Cold Snap', 'Ice Mine', 'Rime Explosion', 'Fracture Wave', 'Glass Breaker', 'Frost Delayed Bloom']
    }
  },
  stormcaller: {
    res: { name: 'Static', max: 100, gain: 8 }, role: 'Burst Mage / สายฟ้า',
    desc: 'ผู้เรียกพายุ สะสมไฟฟ้าสถิตแล้วปลดปล่อยสายฟ้ากระโดดทั้งฝูง',
    branches: { 'พื้นฐาน': 'Basic', Thunder: 'Thunder', Tempest: 'Tempest', Surge: 'Surge' },
    kit: { range: 8, D: ['bolt', 'ricochet', 'rain', 'nova', 'lance', 'blinkcast', 'zone', 'delayed', 'volley'], T: ['shock', 'stun', 'wet', 'airborne', 'slow', 'blind'], H: ['perRes', 'consume', 'bonus', 'combo', 'reaction', 'chain', 'none'], U: ['haste', 'push', 'nextBonus', 'cdShift', 'pierce', 'manaBurn', 'none'], E: ['lightning', 'wind', 'water'] },
    mech: ['split', 'overcharge', 'echo', 'orbit', 'none'],
    ults: [['Thousand Volts', 'Awaken I', 'ricochetUlt', { n: 14, dmg: 3.2, tag: ['shock', 1] }], ['Eye of the Storm', 'Awaken I', 'blackhole', { r: 9, dmg: 24, tag: ['wet', 1, 6] }], ['Skyfall Barrage', 'Awaken II', 'barrage', { r: 10, dmg: 1.2, hits: 36, tag: ['shock', 1] }], ['Ride the Lightning', 'Awaken II', 'transform', { dur: 12, mods: { movePct: 40, castReduce: 35, matkPct: 25 } }], ['Wrath of Heaven', 'Awaken III', 'delayedAoe', { r: 7, dmg: 34, delay: 2 }]],
    buffs: [['Charged Mind', { matkPct: 16, crit: 8 }], ['Tailwind', { movePct: 18, aspdPct: 10, party: 1 }], ['Conductor', { resGainPct: 100, spRegen: 2 }], ['Static Shell', { reflect: 25, short: 12 }], ['Storm Sense', { hit: 35, castReduce: 15 }]],
    names: {
      'พื้นฐาน': ['Spark Bolt', 'Static Shot', 'Shock Orb', 'Lightning Dart', 'Thunder Bolt', 'Volt Spark', 'Arc Bolt'],
      Thunder: ['Chain Lightning', 'Thunder Ricochet', 'Storm Relay', 'Static Cascade', 'Thunderclap', 'Bolt Lance', 'Lightning Ray', 'Thunder Burst', 'Spark Chain', 'Shock Nova', 'Thunder Line'],
      Tempest: ['Tempest Rain', 'Storm Volley', 'Lightning Rain', 'Gale Cyclone', 'Tornado Spark', 'Cloud Field', 'Static Field', 'Squall Barrage', 'Wind Shock', 'Rising Storm', 'Thunder Cloud'],
      Surge: ['Surge Blink', 'Overload', 'Static Detonate', 'Plasma Surge', 'Delayed Thunder', 'Ion Burst', 'Capacitor Doom', 'Discharge', 'Volt Step', 'Short Circuit', 'Megavolt']
    }
  },
  necromancer: {
    res: { name: 'Corpse', max: 6, gain: 1 }, role: 'Summoner / ศพ',
    desc: 'จอมเวทมรณะ ปลุกศพเป็นกองทัพ ระเบิดศพ และดูดชีวิตจากความตาย',
    branches: { 'พื้นฐาน': 'Basic', Bone: 'Bone', Plague: 'Plague', Grave: 'Grave' },
    kit: { range: 8, D: ['bolt', 'summon', 'nova', 'zone', 'delayed', 'pull', 'ricochet', 'rain', 'trap'], T: ['poison', 'curse', 'fear', 'slow', 'root', 'bleed'], H: ['perSummon', 'perStack', 'consume', 'bonus', 'execute', 'lowhp', 'none'], U: ['lifesteal', 'extendDots', 'shield', 'manaBurn', 'hpCost', 'resGain', 'none'], E: ['dark', 'poison', 'blood'] },
    mech: ['orbit', 'echo', 'split', 'wall', 'none'],
    ults: [['Army of the Dead', 'Awaken I', 'summonArmy', { n: 9, dur: 20, mult: 0.75, shape: 'undead' }], ['Pestilence', 'Awaken I', 'plague', { r: 14, tag: ['poison', 4], tag2: ['slow', 1] }], ['Corpse Explosion', 'Awaken II', 'stackburst', { r: 7, tag: ['curse', 3], per: 2.2 }], ['Bone Prison', 'Awaken II', 'blackhole', { r: 7, dmg: 22, tag: ['root', 1, 3] }], ['Lich Ascendant', 'Awaken III', 'transform', { dur: 15, mods: { lifesteal: 12, matkPct: 40, summonBuff: 1 } }]],
    buffs: [['Bone Armor', { defPct: 25, blocks: 2 }], ['Death Pact', { matkPct: 18, hpPct: -8 }], ['Grave Chill', { soulSiphon: 1, mdefPct: 15 }], ['Master of Bones', { summonBuff: 1, matkPct: 6 }], ['Unholy Will', { ccRes: 25, regenPct: 60 }]],
    names: {
      'พื้นฐาน': ['Bone Bolt', 'Grave Dart', 'Rot Shot', 'Skull Orb', 'Death Bolt', 'Plague Shard', 'Corpse Spark'],
      Bone: ['Raise Skeleton', 'Bone Spear', 'Bone Prison', 'Skeleton Knight', 'Bone Wall', 'Ossuary Burst', 'Marrow Lance', 'Rib Cage Bind', 'Bone Ricochet', 'Skull Pile', 'Bone Spike'],
      Plague: ['Plague Cloud', 'Toxic Field', 'Rot Nova', 'Noxious Rain', 'Venom Doom', 'Blight Zone', 'Wither Curse', 'Acid Pool', 'Plague Mine', 'Contagion', 'Decay Pulse'],
      Grave: ['Grave Hook', 'Raise Wraith', 'Soul Pull', 'Death Mark', 'Tomb Detonate', 'Dread Wail', 'Corpse Lance', 'Requiem Burst', 'Fear Howl', 'Grave Grip', 'Last Rites']
    }
  },
  druid: {
    res: { name: 'Bloom', max: 100, gain: 6 }, role: 'Nature Healer / ธรรมชาติ',
    desc: 'ดรูอิด รากไม้ตรึงศัตรู ดอกไม้ฮีลเพื่อน และเรียกพลังแห่งป่า',
    branches: { 'พื้นฐาน': 'Basic', Grove: 'Grove', Thorn: 'Thorn', Moon: 'Moon' },
    kit: { range: 7.5, D: ['bolt', 'zone', 'nova', 'pull', 'summon', 'rain', 'trap', 'quake', 'wave'], T: ['root', 'poison', 'slow', 'wet', 'bleed', 'knockdown'], H: ['bonus', 'chain', 'consume', 'perStack', 'combo', 'lowhp', 'none'], U: ['partyHeal', 'healFromDmg', 'cleanse', 'shield', 'selfHeal', 'extendDots', 'none'], E: ['earth', 'poison', 'water'] },
    mech: ['orbit', 'wall', 'trail', 'echo', 'none'],
    ults: [['World Tree', 'Awaken I', 'zoneheal', { dur: 10, heal: 10, r: 7 }], ['Wrath of the Wild', 'Awaken I', 'summonArmy', { n: 5, dur: 18, mult: 0.9, shape: 'beast' }], ['Strangling Roots', 'Awaken II', 'plague', { r: 12, tag: ['root', 1], tag2: ['poison', 3] }], ['Moonfall', 'Awaken II', 'nuke', { r: 9, dmg: 22, tag: ['slow', 1, 4] }], ['Rebirth Bloom', 'Awaken III', 'miracle', {}]],
    buffs: [['Bark Skin', { defPct: 30, hpPct: 8 }], ['Rejuvenation', { regenPct: 180, party: 1 }], ['Wild Growth', { hpPct: 12, party: 1 }], ['Moon Blessing', { matkPct: 14, spRegen: 2 }], ['Nature Ward', { ccRes: 30, mdefPct: 20, party: 1 }]],
    names: {
      'พื้นฐาน': ['Thorn Shot', 'Seed Bolt', 'Leaf Dart', 'Vine Lash', 'Sap Orb', 'Pollen Spark', 'Acorn Shot'],
      Grove: ['Entangle Root', 'Grove Field', 'Vine Grip', 'Bramble Snare', 'Overgrowth', 'Mossy Ground', 'Briar Wall', 'Root Prison', 'Living Pull', 'Grove Circle', 'Sapling Summon'],
      Thorn: ['Thorn Rain', 'Spike Volley', 'Thorn Nova', 'Bramble Burst', 'Poison Bloom', 'Toxic Spore', 'Nettle Trap', 'Thorn Quake', 'Thistle Wave', 'Rose Mine', 'Hedge Spike'],
      Moon: ['Moonbeam', 'Lunar Wave', 'Star Seed', 'Tidal Bloom', 'Night Bloom', 'Moon Pulse', 'Crescent Rain', 'Moon Ground', 'Lunar Spark', 'Eclipse Root', 'Silver Dew']
    }
  },
  shadowdancer: {
    res: { name: 'Rhythm', max: 8, gain: 1 }, role: 'Combo Assassin / เต้นรำ',
    desc: 'นักเต้นเงา ต่อจังหวะการเต้นเป็นคอมโบไม่รู้จบ ยิ่งต่อยิ่งเร็ว',
    branches: { 'พื้นฐาน': 'Basic', Tango: 'Tango', Veil: 'Veil', Finale: 'Finale' },
    kit: { range: 1.4, D: ['combo', 'spin', 'dash', 'blink', 'arc', 'strike', 'throw', 'leap', 'backstep'], T: ['bleed', 'blind', 'slow', 'silence', 'airborne', 'mark'], H: ['combo', 'chain', 'backstab', 'consume', 'perRes', 'execute', 'none'], U: ['haste', 'stealth', 'nextBonus', 'lifesteal', 'resGain', 'cdShift', 'none'], E: ['dark', 'wind', 'neutral'] },
    mech: ['trail', 'echo', 'resetOnKill', 'stackSelf', 'none'],
    ults: [['Danse Macabre', 'Awaken I', 'barrage', { r: 5, dmg: 1.5, hits: 30, tag: ['bleed', 1] }], ['Curtain of Night', 'Awaken I', 'plague', { r: 12, tag: ['blind', 1], tag2: ['silence', 1] }], ['Midnight Waltz', 'Awaken II', 'transform', { dur: 10, mods: { aspdPct: 55, flee: 40, comboWin: 2 } }], ['Thousand Steps', 'Awaken II', 'zoneself', { dur: 6, mult: 1.9, r: 4, tag: ['slow', 1] }], ['Final Bow', 'Awaken III', 'execute', { th: 30, dmg: 30 }]],
    buffs: [['Light Feet', { movePct: 20, flee: 20 }], ['Tempo', { aspdPct: 22 }], ['Shadow Step', { flee: 45, short: 10 }], ['Encore', { comboDmg: 22, comboWin: 1 }], ['Dark Rhythm', { crit: 15, critDmg: 15 }]],
    names: {
      'พื้นฐาน': ['Twin Cut', 'Step Slash', 'Spin Kick', 'Dancing Stab', 'Quick Flurry', 'Swift Rend', 'Flick Strike'],
      Tango: ['Tango Flurry', 'Waltz Spin', 'Pirouette', 'Double Step', 'Triple Twirl', 'Tango Dash', 'Rising Spin', 'Twirl Combo', 'Rapid Dance', 'Shadow Waltz', 'Vortex Step'],
      Veil: ['Veil Blink', 'Smoke Step', 'Blind Flash', 'Phantom Step', 'Silent Rend', 'Shade Throw', 'Veil Dash', 'Mark of Night', 'Backflip', 'Silence Cut', 'Dark Fan'],
      Finale: ['Finale Strike', 'Last Dance', 'Crescendo Cut', 'Curtain Call', 'Encore Slash', 'Bloody Bow', 'Grand Jete', 'Red Waltz', 'Final Spin', 'Coda Rend', 'Bravo Burst']
    }
  },
  engineer: {
    res: { name: 'Scrap', max: 10, gain: 1 }, role: 'Turrets / กับดักกล',
    desc: 'วิศวกร ตั้งป้อมปืน วางทุ่นระเบิด และยิงจรวดจากระยะไกล',
    branches: { 'พื้นฐาน': 'Basic', Turret: 'Turret', Demolition: 'Demolition', Gadget: 'Gadget' },
    kit: { range: 7, D: ['shot', 'grenade', 'trap', 'summon', 'rain', 'pierce', 'zone', 'volley', 'backstep'], T: ['shock', 'burn', 'slow', 'knockdown', 'armorbreak', 'stun'], H: ['perSummon', 'perRes', 'consume', 'bonus', 'execute', 'none'], U: ['push', 'shield', 'pierce', 'nextBonus', 'resGain', 'cdShift', 'none'], E: ['lightning', 'fire', 'neutral'] },
    mech: ['boomerang', 'overcharge', 'split', 'wall', 'none'],
    ults: [['Turret Fortress', 'Awaken I', 'summonArmy', { n: 4, dur: 20, mult: 1, shape: 'drone' }], ['Carpet Bomb', 'Awaken I', 'zonetarget', { dur: 6, mult: 2.6, r: 7, tag: ['burn', 2] }], ['Claymore Grid', 'Awaken II', 'traps', { n: 12 }], ['Railgun Prototype', 'Awaken II', 'single', { dmg: 36, pierce: 1, cast: 1.2, range: 18 }], ['Orbital Laser', 'Awaken III', 'megaline', { len: 26, dmg: 25, tag: ['shock', 1, 3], pierce: 1 }]],
    buffs: [['Overclock', { aspdPct: 20, castReduce: 10 }], ['Reinforced Plating', { defPct: 30, hpPct: 8 }], ['Targeting HUD', { crit: 18, hit: 30 }], ['Field Repair', { regenPct: 150, party: 1 }], ['Supply Drop', { dropPct: 6, spPct: 15, party: 1 }]],
    names: {
      'พื้นฐาน': ['Rivet Shot', 'Bolt Round', 'Wrench Throw', 'Spark Bullet', 'Nail Shot', 'Gear Disc', 'Piston Shot'],
      Turret: ['Turret Drone', 'Summon Drone', 'Sentry Pack', 'Tesla Pylon', 'Flame Turret', 'Laser Line', 'Rail Pierce', 'Drone Volley', 'Shock Field', 'Barrier Wall', 'Gatling Spread'],
      Demolition: ['Cluster Grenade', 'Rocket Barrage', 'Napalm Canister', 'Demolition Charge', 'Mortar Rain', 'Sticky Bomb', 'Blast Mine', 'Shrapnel Burst', 'Dynamite Toss', 'Breach Charge', 'Fire Bomb'],
      Gadget: ['Net Launcher', 'Spring Trap', 'Magnet Hook', 'Smoke Canister', 'Jetpack Retreat', 'Taser Snare', 'EMP Pulse', 'Glue Mine', 'Tripwire', 'Shock Trap', 'Rocket Jump']
    }
  },
  spellblade: {
    res: { name: 'Rune Edge', max: 4, gain: 1 }, role: 'Magic Swordsman / ร่ายดาบ',
    desc: 'นักดาบเวท สลักรูนบนคมดาบ ฟันแล้วระเบิดเวทต่อเนื่อง',
    branches: { 'พื้นฐาน': 'Basic', Runeblade: 'Runeblade', Tide: 'Tide', Arcane: 'Arcane' },
    kit: { range: 1.6, D: ['strike', 'combo', 'wave', 'arc', 'blinkcast', 'dash', 'nova', 'lance', 'delayed'], T: ['wet', 'chill', 'shock', 'mark', 'silence', 'airborne'], H: ['chain', 'consume', 'perRes', 'reaction', 'bonus', 'combo', 'none'], U: ['nextBonus', 'shield', 'manaBurn', 'pierce', 'cdShift', 'resGain', 'none'], E: ['water', 'ice', 'lightning', 'neutral'] },
    mech: ['echo', 'orbit', 'boomerang', 'split', 'none'],
    ults: [['Rune Cataclysm', 'Awaken I', 'nuke', { r: 9, dmg: 18, tag: ['wet', 1, 6], hits: 3 }], ['Tidal Blade', 'Awaken I', 'megaline', { len: 18, dmg: 23, tag: ['chill', 2, 4] }], ['Spell Mirror', 'Awaken II', 'dome', { dur: 8, mods: { reflect: 35, mdefPct: 40 } }], ['Hundred Runes', 'Awaken II', 'ricochetUlt', { n: 10, dmg: 3.8, tag: ['mark', 1] }], ['Arcane Ascension', 'Awaken III', 'stackburst', { r: 7, tag: ['shock', 3], per: 2.4 }]],
    buffs: [['Enchant Blade', { element: 'cycle', atkPct: 8 }], ['Mana Edge', { matkPct: 14, atkPct: 8 }], ['Rune Guard', { mdefPct: 25, blocks: 2 }], ['Flowing Form', { aspdPct: 15, castReduce: 15 }], ['Arcane Insight', { cdr: 10, spRegen: 2 }]],
    names: {
      'พื้นฐาน': ['Rune Slash', 'Arcane Cut', 'Spell Thrust', 'Glyph Edge', 'Mana Strike', 'Sigil Blow', 'Charm Cleave'],
      Runeblade: ['Runeblade Wave', 'Rune Lance', 'Glyph Combo', 'Twin Rune', 'Rune Burst', 'Blade Ray', 'Rune Detonate', 'Inscribed Rend', 'Rune Arc', 'Sigil Spiral', 'Runic Doom'],
      Tide: ['Tidal Slash', 'Water Lance', 'Wave Cutter', 'Frost Edge', 'Torrent Rush', 'Rain Blade', 'Ice Thrust', 'Tide Sweep', 'Undertow Hook', 'Splash Nova', 'Deep Current'],
      Arcane: ['Arcane Blink', 'Spell Break', 'Silence Edge', 'Mana Burst', 'Phase Strike', 'Static Blade', 'Thunder Cut', 'Arcane Missile', 'Rising Rune', 'Mark of Spells', 'Void Glyph']
    }
  },
  beastmaster: {
    res: { name: 'Bond', max: 100, gain: 7 }, role: 'Pet Fighter / สัตว์ป่า',
    desc: 'นายพรานผู้ผูกพันสัตว์ป่า ต่อสู้เคียงข้างหมาป่า เหยี่ยว และหมี',
    branches: { 'พื้นฐาน': 'Basic', Pack: 'Pack', Fang: 'Fang', Primal: 'Primal' },
    kit: { range: 2.1, D: ['strike', 'summon', 'dash', 'leap', 'combo', 'pull', 'arc', 'quake', 'throw'], T: ['bleed', 'knockdown', 'mark', 'fear', 'root', 'poison'], H: ['perSummon', 'bonus', 'chain', 'consume', 'perRes', 'execute', 'none'], U: ['lifesteal', 'selfHeal', 'push', 'taunt', 'haste', 'resGain', 'none'], E: ['earth', 'neutral', 'wind'] },
    mech: ['trail', 'stackSelf', 'echo', 'resetOnKill', 'none'],
    ults: [['Bear Form', 'Awaken I', 'transform', { dur: 14, mods: { giant: 1, hpPct: 30, defPct: 40, atkPct: 25 } }], ['Primal Roar', 'Awaken I', 'plague', { r: 12, tag: ['fear', 1], tag2: ['mark', 1] }], ['Stampede', 'Awaken II', 'megaline', { len: 20, dmg: 22, tag: ['knockdown', 1, 2] }], ['Alpha Hunt', 'Awaken II', 'execute', { th: 28, dmg: 28 }], ['Call of the Pack', 'Awaken III', 'summonArmy', { n: 6, dur: 18, mult: 0.85, shape: 'beast' }]],
    buffs: [['Pack Leader', { summonBuff: 1, atkPct: 10 }], ['Hunter Instinct', { crit: 14, movePct: 12 }], ['Thick Hide', { defPct: 25, hpPct: 10 }], ['Wild Bond', { resGainPct: 100, lifesteal: 4 }], ['Feral Howl', { aspdPct: 15, party: 1 }]],
    names: {
      'พื้นฐาน': ['Claw Swipe', 'Spear Thrust', 'Fang Bite', 'Maul Strike', 'Talon Rend', 'Hunter Blow', 'Pounce Strike'],
      Pack: ['Summon Wolf Pack', 'Hawk Dive', 'Pack Rush', 'Howl', 'Wolf Pounce', 'Bear Slam', 'Boar Charge', 'Raptor Leap', 'Pack Tackle', 'Serpent Bite', 'Hound Drag'],
      Fang: ['Fang Flurry', 'Bloody Maul', 'Gore Rend', 'Crimson Fang', 'Savage Bite', 'Rip Combo', 'Sanguine Claw', 'Lacerate', 'Vein Tear', 'Red Talon', 'Venom Fang'],
      Primal: ['Primal Quake', 'Earth Stomp', 'Roar of Terror', 'Hunter Mark', 'Snare Net', 'Root Trap', 'Ground Slam', 'Thunder Hoof', 'Wild Sweep', 'Beast Javelin', 'Tusk Throw']
    }
  },
  starhunter: {
    res: { name: 'Starlight', max: 3, gain: 1 }, role: 'Celestial Archer / ดวงดาว',
    desc: 'นักล่าดวงดาว ยิงศรแสงดาวตก ลากเส้นกลุ่มดาวระหว่างเป้า',
    branches: { 'พื้นฐาน': 'Basic', Comet: 'Comet', Constellation: 'Constellation', Nebula: 'Nebula' },
    kit: { range: 9, D: ['shot', 'pierce', 'rain', 'ricochet', 'volley', 'delayed', 'backstep', 'zone', 'lance'], T: ['mark', 'holybrand', 'blind', 'slow', 'burn', 'stun'], H: ['bonus', 'perRes', 'consume', 'chain', 'execute', 'combo', 'none'], U: ['nextBonus', 'pierce', 'haste', 'push', 'cdShift', 'stealth', 'none'], E: ['holy', 'fire', 'lightning'] },
    mech: ['split', 'boomerang', 'orbit', 'echo', 'none'],
    ults: [['Meteor Shower', 'Awaken I', 'barrage', { r: 11, dmg: 1.4, hits: 30, tag: ['burn', 1] }], ['Constellation Bind', 'Awaken I', 'ricochetUlt', { n: 9, dmg: 4.2, tag: ['root', 1] }], ['Supernova Arrow', 'Awaken II', 'delayedAoe', { r: 6, dmg: 30, delay: 1.6 }], ['Celestial Dome', 'Awaken II', 'zonetarget', { dur: 8, mult: 2.5, r: 6, tag: ['holybrand', 1] }], ['Polaris Shot', 'Awaken III', 'single', { dmg: 34, pierce: 1, cast: 1, range: 20, tag: ['mark', 1, 10] }]],
    buffs: [['Star Sight', { range: 2, hit: 30 }], ['Comet Speed', { aspdPct: 18, movePct: 12 }], ['North Star', { crit: 16, critDmg: 15 }], ['Twinkle Veil', { flee: 30, short: 12 }], ['Astral Chart', { cdr: 8, party: 1 }]],
    names: {
      'พื้นฐาน': ['Star Arrow', 'Light Shot', 'Comet Shot', 'Spark Arrow', 'Twinkle Shot', 'Dawn Arrow', 'Star Bolt'],
      Comet: ['Comet Rain', 'Meteor Volley', 'Star Barrage', 'Falling Star', 'Comet Pierce', 'Burning Comet', 'Flare Arrow', 'Sun Lance', 'Meteor Drop', 'Ember Comet', 'Astral Pierce'],
      Constellation: ['Constellation Chain', 'Star Ricochet', 'Orion Mark', 'Polaris Line', 'Gemini Shot', 'Leo Volley', 'Star Relay', 'Hunter Mark', 'Zodiac Bind', 'Lyra Ray', 'Draco Lance'],
      Nebula: ['Nebula Field', 'Star Doom', 'Void Star', 'Dust Cloud', 'Blinding Nova', 'Starfall Zone', 'Gravity Star', 'Backstep Shot', 'Aurora Ray', 'Stun Star', 'Quasar Delayed']
    }
  },
  seraph: {
    res: { name: 'Grace', max: 100, gain: 6 }, role: 'Winged Lancer / ฟ้า',
    desc: 'ทูตสวรรค์ถือหอก บินโฉบจากฟ้า ฮีลเพื่อนด้วยขนนกศักดิ์สิทธิ์',
    branches: { 'พื้นฐาน': 'Basic', Wing: 'Wing', Choir: 'Choir', Halo: 'Halo' },
    kit: { range: 2.1, D: ['leap', 'lance', 'dash', 'strike', 'wave', 'nova', 'rain', 'pull', 'zone'], T: ['holybrand', 'airborne', 'blind', 'stun', 'silence', 'knockdown'], H: ['bonus', 'chain', 'purge', 'combo', 'consume', 'none'], U: ['partyHeal', 'healFromDmg', 'cleanse', 'haste', 'shield', 'push', 'none'], E: ['holy', 'wind', 'lightning'] },
    mech: ['orbit', 'echo', 'trail', 'boomerang', 'none'],
    ults: [['Judgement Spear', 'Awaken I', 'single', { dmg: 38, pierce: 1, range: 10, tag: ['holybrand', 1, 10] }], ['Feather Storm', 'Awaken I', 'barrage', { r: 8, dmg: 1.3, hits: 28, tag: ['blind', 1] }], ['Archangel Dive', 'Awaken II', 'nuke', { r: 7, dmg: 24, tag: ['airborne', 1, 2], leap: 1 }], ['Choir of Light', 'Awaken II', 'zoneheal', { dur: 8, heal: 9, r: 6 }], ['Wings of Heaven', 'Awaken III', 'saint', { dur: 3, revive: 0, heal: 45 }]],
    buffs: [['Halo', { mdefPct: 20, regenPct: 100, party: 1 }], ['Swift Wings', { movePct: 22, flee: 15 }], ['Holy Lance', { atkPct: 14, element: 'holy' }], ['Guardian Feather', { blocks: 3, short: 20, party: 1 }], ['Hymn', { aspdPct: 12, castReduce: 12, party: 1 }]],
    names: {
      'พื้นฐาน': ['Holy Thrust', 'Wing Strike', 'Light Spear', 'Feather Lance', 'Radiant Stab', 'Halo Blow', 'Angel Pierce'],
      Wing: ['Sky Dive', 'Wing Rush', 'Heaven Drop', 'Feather Rain', 'Soaring Lance', 'Rising Wing', 'Angel Fall', 'Wind Dive', 'Air Lance', 'Talon Dive', 'Glide Strike'],
      Choir: ['Choir Nova', 'Hymn Wave', 'Psalm Burst', 'Silence Prayer', 'Blinding Chorus', 'Sacred Ground', 'Holy Pull', 'Grace Field', 'Requiem Ray', 'Sanctus Pulse', 'Angel Song'],
      Halo: ['Halo Ring', 'Divine Lance', 'Holy Pillar', 'Seraph Ray', 'Radiant Spear', 'Light Wave', 'Heaven Line', 'Smite Thrust', 'Sun Halo', 'Luminous Doom', 'Halo Burst']
    }
  },
  reaper: {
    res: { name: 'Souls', max: 10, gain: 1 }, role: 'Scythe Executioner / เก็บวิญญาณ',
    desc: 'ยมทูตถือเคียว เก็บวิญญาณจากการฆ่า ใช้วิญญาณปิดฉากศัตรู',
    branches: { 'พื้นฐาน': 'Basic', Harvest: 'Harvest', Doom: 'Doom', Specter: 'Specter' },
    kit: { range: 1.9, D: ['scythe', 'strike', 'spin', 'pull', 'blink', 'delayed', 'arc', 'dash', 'wave'], T: ['curse', 'fear', 'bleed', 'mark', 'silence', 'slow'], H: ['execute', 'perRes', 'consume', 'bonus', 'lowhp', 'stealthOpen', 'none'], U: ['lifesteal', 'stealth', 'pull', 'dispel', 'resGain', 'hpCost', 'none'], E: ['dark', 'blood', 'neutral'] },
    mech: ['resetOnKill', 'echo', 'stackSelf', 'trail', 'none'],
    ults: [['Grand Harvest', 'Awaken I', 'executeSweep', { r: 8, th: 25, dmg: 16 }], ['Soul Reckoning', 'Awaken I', 'stackburst', { r: 6, tag: ['curse', 4], per: 2 }], ['Death Sentence', 'Awaken II', 'execute', { th: 40, dmg: 32 }], ['Underworld Gate', 'Awaken II', 'blackhole', { r: 8, dmg: 26, tag: ['fear', 1, 3] }], ['Pale Rider', 'Awaken III', 'zoneself', { dur: 7, mult: 2.1, r: 4.5, tag: ['bleed', 2] }]],
    buffs: [['Soul Feast', { lifesteal: 8, critDmg: 12 }], ['Shroud', { flee: 25, movePct: 12 }], ['Death Grip', { atkPct: 16, hit: 20 }], ['Ethereal', { dmgReduce: 30, short: 8 }], ['Reaper Toll', { resGainPct: 100, crit: 8 }]],
    names: {
      'พื้นฐาน': ['Scythe Reap', 'Soul Cut', 'Grave Slash', 'Death Sweep', 'Dark Sever', 'Bone Reap', 'Cull Strike'],
      Harvest: ['Harvest Spin', 'Reaping Whirl', 'Soul Harvest', 'Cull the Weak', 'Crescent Reap', 'Blood Harvest', 'Red Requiem', 'Sever Vein', 'Gore Sweep', 'Sanguine Reap', 'Crimson Arc'],
      Doom: ['Doom Mark', 'Death Mark', 'Delayed Doom', 'Curse of Ends', 'Fear Wail', 'Dread Toll', 'Omen Brand', 'Hex Scythe', 'Agony Line', 'Wither Wave', 'Malediction'],
      Specter: ['Specter Blink', 'Soul Hook', 'Phantom Step', 'Chain Pull', 'Shade Dash', 'Ghost Grip', 'Silent Reap', 'Wraith Rush', 'Spirit Snatch', 'Haunting Lunge', 'Slow Death']
    }
  },
  jester: {
    res: { name: 'Laughter', max: 100, gain: 9 }, role: 'Trickster Thrower / กลลวง',
    desc: 'ตัวตลก ขว้างไพ่และจักร โยนระเบิดหัวเราะ ทุกการโจมตีมีเรื่องเซอร์ไพรส์',
    branches: { 'พื้นฐาน': 'Basic', Cards: 'Cards', Circus: 'Circus', Prank: 'Prank' },
    kit: { range: 6, D: ['throw', 'ricochet', 'volley', 'grenade', 'trap', 'backstep', 'blink', 'spin', 'delayed'], T: ['blind', 'stun', 'fear', 'slow', 'silence', 'mark', 'airborne'], H: ['bonus', 'combo', 'consume', 'perRes', 'chain', 'execute', 'none'], U: ['stealth', 'push', 'dispel', 'nextBonus', 'haste', 'manaBurn', 'none'], E: ['wind', 'neutral', 'fire', 'poison'] },
    mech: ['boomerang', 'split', 'echo', 'resetOnKill', 'none'],
    ults: [['Wheel of Fortune', 'Awaken I', 'ricochetUlt', { n: 12, dmg: 3.4, tag: ['stun', 1] }], ['Grand Finale', 'Awaken I', 'delayedAoe', { r: 6, dmg: 28, delay: 1.5 }], ['Big Top', 'Awaken II', 'blackhole', { r: 8, dmg: 20, tag: ['blind', 1, 3] }], ['House of Cards', 'Awaken II', 'traps', { n: 9 }], ['Laughing Madness', 'Awaken III', 'plague', { r: 14, tag: ['fear', 1], tag2: ['silence', 1] }]],
    buffs: [['Lucky Coin', { crit: 14, dropPct: 5 }], ['Juggler', { aspdPct: 18 }], ['Smoke and Mirrors', { flee: 40, short: 10 }], ['Showtime', { dmgPct: 12, party: 1 }], ['Joker Card', { critDmg: 25, luk: 10 }]],
    names: {
      'พื้นฐาน': ['Card Throw', 'Disc Toss', 'Knife Juggle', 'Joker Dart', 'Ace Shot', 'Trick Throw', 'Pie Toss'],
      Cards: ['Card Fan', 'Royal Flush', 'Card Ricochet', 'Ace Volley', 'Deck Spread', 'Queen Bounce', 'Wild Card', 'Spade Relay', 'Diamond Cascade', 'Jack Spin', 'Shuffle Storm'],
      Circus: ['Circus Bomb', 'Confetti Cluster', 'Balloon Mine', 'Ring of Fire', 'Cannon Grenade', 'Clown Trap', 'Juggling Bomb', 'Fire Hoop', 'Firecracker', 'Tightrope Snare', 'Stilt Stomp'],
      Prank: ['Prank Blink', 'Whoopee Mine', 'Flash Powder', 'Rubber Chicken', 'Backflip', 'Surprise Box', 'Laughing Gas', 'Delayed Joke', 'Banana Snare', 'Fear Mask', 'Silent Mime']
    }
  },
  loki: {
    res: { name: 'Mischief', max: 5, gain: 1 }, role: 'Illusionist / ภาพลวง',
    desc: 'เทพกลลวง สร้างภาพลวงตา สลับที่ศัตรู ปั่นหัวทั้งสนามรบ',
    branches: { 'พื้นฐาน': 'Basic', Illusion: 'Illusion', Deceit: 'Deceit', Ragnarok: 'Ragnarok' },
    kit: { range: 7.5, D: ['bolt', 'blinkcast', 'summon', 'delayed', 'ricochet', 'zone', 'pull', 'nova', 'lance'], T: ['fear', 'silence', 'curse', 'blind', 'mark', 'freeze', 'slow'], H: ['consume', 'bonus', 'chain', 'perSummon', 'execute', 'combo', 'none'], U: ['stealth', 'dispel', 'manaBurn', 'cdShift', 'nextBonus', 'pull', 'none'], E: ['dark', 'ice', 'fire', 'poison'] },
    mech: ['split', 'echo', 'orbit', 'overcharge', 'none'],
    ults: [['Hall of Mirrors', 'Awaken I', 'summonArmy', { n: 6, dur: 14, mult: 0.7, shape: 'shadow' }], ['Fimbulwinter', 'Awaken I', 'zonetarget', { dur: 10, mult: 2, r: 8, tag: ['freeze', 1] }], ['Serpent of Midgard', 'Awaken II', 'megaline', { len: 24, dmg: 22, tag: ['poison', 3, 8] }], ['Trickster Gambit', 'Awaken II', 'transform', { dur: 12, mods: { stealth: 1, cdr: 45, matkPct: 20 } }], ['Twilight of the Gods', 'Awaken III', 'nuke', { r: 13, dmg: 14, tag: ['curse', 1, 8] }]],
    buffs: [['Silver Tongue', { matkPct: 12, castReduce: 12 }], ['Shapeshift', { flee: 30, movePct: 18 }], ['Mischief Mind', { resGainPct: 100, cdr: 6 }], ['Mirror Image', { blocks: 3, short: 25 }], ['Allfather Ruse', { crit: 12, critDmg: 18 }]],
    names: {
      'พื้นฐาน': ['Trick Bolt', 'Shade Orb', 'Illusion Dart', 'Hex Spark', 'Cursed Bolt', 'Mirror Shard', 'Jest Bolt'],
      Illusion: ['Summon Illusion', 'Mirror Clone', 'Phantom Pack', 'Mirage Step', 'Shadow Swap', 'Blink Ruse', 'Double Image', 'Illusory Wall', 'Mirage Field', 'Fake Gate', 'Doppel Burst'],
      Deceit: ['Deceit Mark', 'Silver Hook', 'Silence Lie', 'Fear Whisper', 'Blinding Ruse', 'Curse of Lies', 'Delayed Betrayal', 'False Ricochet', 'Hex Chain', 'Mark of Loki', 'Poison Tongue'],
      Ragnarok: ['Ragnarok Nova', 'Frost Giant Lance', 'Fire of Muspel', 'Serpent Venom', 'Wolf Fang Doom', 'Frozen Doom', 'Twilight Ray', 'Midgard Quake', 'Burning Rift', 'Gjallar Burst', 'Doom Zone']
    }
  },
  shadowmancer: {
    res: { name: 'Umbra', max: 5, gain: 1 }, role: 'Shadow Caster / เงา',
    desc: 'จอมเวทเงา ดึงเงาของศัตรูมาเป็นอาวุธ กลืนแสงและพลังชีวิต',
    branches: { 'พื้นฐาน': 'Basic', Gloom: 'Gloom', Devour: 'Devour', Eclipse: 'Eclipse' },
    kit: { range: 7.5, D: ['bolt', 'pull', 'zone', 'nova', 'delayed', 'summon', 'wave', 'rain', 'ricochet'], T: ['blind', 'curse', 'silence', 'fear', 'root', 'slow'], H: ['perStack', 'consume', 'bonus', 'lowhp', 'perSummon', 'execute', 'none'], U: ['lifesteal', 'shield', 'manaBurn', 'dispel', 'pull', 'extendDots', 'none'], E: ['dark', 'poison', 'blood'] },
    mech: ['orbit', 'wall', 'echo', 'overcharge', 'none'],
    ults: [['Total Eclipse', 'Awaken I', 'plague', { r: 14, tag: ['blind', 1], tag2: ['curse', 1] }], ['Maw of Night', 'Awaken I', 'blackhole', { r: 9, dmg: 27, tag: ['silence', 1, 3] }], ['Shadow Legion', 'Awaken II', 'summonArmy', { n: 7, dur: 16, mult: 0.8, shape: 'shadow' }], ['Devour Light', 'Awaken II', 'nuke', { r: 10, dmg: 19, tag: ['fear', 1, 3] }], ['Umbral Throne', 'Awaken III', 'dome', { dur: 9, mods: { lifesteal: 20, dmgReduce: 30 } }]],
    buffs: [['Dark Pact', { matkPct: 18, hpPct: -6 }], ['Shadow Cloak', { flee: 25, dmgReduce: 10 }], ['Night Hunger', { lifesteal: 6, soulSiphon: 1 }], ['Gloom Ward', { mdefPct: 30, short: 20 }], ['Umbral Focus', { castReduce: 18, cdr: 6 }]],
    names: {
      'พื้นฐาน': ['Shadow Bolt', 'Gloom Orb', 'Dark Spark', 'Night Shard', 'Umbra Dart', 'Dusk Bolt', 'Shade Missile'],
      Gloom: ['Gloom Field', 'Darkness Zone', 'Blinding Fog', 'Shadow Rain', 'Night Cloud', 'Dusk Wave', 'Gloom Nova', 'Fear Pulse', 'Silence Veil', 'Shadow Wall', 'Black Mist'],
      Devour: ['Devour Hook', 'Shadow Grip', 'Hunger Pull', 'Soul Drain', 'Maw Bite', 'Gnaw Doom', 'Leech Ray', 'Shadow Root', 'Consume Light', 'Feast Burst', 'Swallow Shade'],
      Eclipse: ['Eclipse Ray', 'Moonless Doom', 'Black Sun', 'Umbral Ricochet', 'Summon Shade', 'Shadow Servant', 'Night Lance', 'Corona Curse', 'Penumbra Burst', 'Dark Star', 'Eclipse Bind']
    }
  }
};

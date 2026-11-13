// Extended game data: quests, achievements, pets, mounts, crafting, guild skills, ranked, economy.
(function (root, factory) {
  const D = typeof require === 'function' ? require('./data.js') : root.NO_DATA;
  factory(D);
  if (typeof module === 'object' && module.exports) module.exports = D;
})(typeof self !== 'undefined' ? self : this, function (D) {
  if (D.EXT) return; D.EXT = true;

  // ---------------------------------------------------------------- new NPCs in every town
  D.TOWN_NPCS.push(
    { role: 'storage', name: 'Keeper Odo', th: 'คลังเก็บของ', dx: 7, dy: -11, color: '#b08a5a' },
    { role: 'market', name: 'Broker Selene', th: 'ตลาดประมูล', dx: 12, dy: -1, color: '#5ae0b0' },
    { role: 'mail', name: 'Postmaster Pip', th: 'ไปรษณีย์', dx: -12, dy: -1, color: '#e05a5a' },
    { role: 'quest', name: 'Quest Board', th: 'ภารกิจ / รางวัลรายวัน', dx: 0, dy: 12, color: '#ffd34a' },
    { role: 'craft', name: 'Alchemist Nyx', th: 'คราฟต์ / แลกโทเคน', dx: 12, dy: 7, color: '#8ad04a' },
    { role: 'stable', name: 'Tamer Rook', th: 'สัตว์เลี้ยง / พาหนะ', dx: -12, dy: 7, color: '#c87a3a' },
    { role: 'storage', name: 'Keeper Ivo', th: 'คลังเก็บของ', dx: -7, dy: -11, color: '#b08a5a' }
  );
  D.TOWN_NPCS.push({ role: 'training', name: 'Drillmaster Hugo', th: 'ลานฝึกซ้อม (ทดสอบดาเมจ)', dx: -8, dy: 11, color: '#c8a060' });
  D.SPECIAL_MAPS.training = { id: 'training', kind: 'training', name: 'Training Grounds', th: 'ลานฝึกซ้อม', biome: 'meadow', w: 64, h: 52 };
  D.ITEMS.zeny = { n: 'Zeny', th: 'เงิน', type: 'zeny', price: 0, icon: '#ffd34a' };
  D.SPECIAL_MAPS.duel_arena = { id: 'duel_arena', name: 'Ranked Arena', th: 'สนามจัดอันดับ', biome: 'ruins', w: 36, h: 36, pvp: true, noAuto: true };

  // ---------------------------------------------------------------- pets & mounts
  D.PETS = {
    bunny: { n: 'Fluffy Bunny', th: 'กระต่ายปุย', shape: 'beast', color: '#f4e4e8', stat: 'hpPct', per: 0.4, price: 30000, lv: 1 },
    fox: { n: 'Ember Fox', th: 'จิ้งจอกเพลิง', shape: 'beast', color: '#ff7a2a', stat: 'atkPct', per: 0.3, price: 120000, lv: 30 },
    owl: { n: 'Frost Owl', th: 'นกฮูกน้ำแข็ง', shape: 'bird', color: '#9ad8ff', stat: 'matkPct', per: 0.3, price: 120000, lv: 30 },
    cat: { n: 'Lucky Cat', th: 'แมวนำโชค', shape: 'beast', color: '#ffd34a', stat: 'dropPct', per: 0.35, price: 250000, lv: 60 },
    turtle: { n: 'Iron Turtle', th: 'เต่าเหล็ก', shape: 'golem', color: '#7a9a7a', stat: 'defPct', per: 0.4, price: 250000, lv: 60 },
    wisp: { n: 'Spirit Wisp', th: 'ภูตวิญญาณ', shape: 'spirit', color: '#c0a0ff', stat: 'cdr', per: 0.15, price: 600000, lv: 120 },
    drake: { n: 'Baby Drake', th: 'มังกรน้อย', shape: 'dragon', color: '#ff5a5a', stat: 'critDmg', per: 0.6, price: 1500000, lv: 180 }
  };
  D.PET_MAX = 30;
  D.petExpNext = (lv) => 30 + lv * lv * 6;
  D.MOUNTS = {
    pony: { n: 'Meadow Pony', th: 'ม้าแคระ', speed: 25, lv: 15, price: 50000, color: '#c8a070' },
    horse: { n: 'War Horse', th: 'ม้าศึก', speed: 35, lv: 50, price: 300000, color: '#6a4a2a' },
    wolf: { n: 'Dire Wolf', th: 'หมาป่ายักษ์', speed: 45, lv: 100, price: 900000, color: '#6a6a7a' },
    griffin: { n: 'Griffin', th: 'กริฟฟิน', speed: 55, lv: 160, price: 2500000, color: '#e0c070' },
    dragon: { n: 'Ancient Dragon', th: 'มังกรโบราณ', speed: 70, lv: 220, price: 8000000, color: '#a03030' }
  };
  for (const k in D.PETS) D.ITEMS['egg_' + k] = { n: D.PETS[k].n + ' Egg', th: 'ไข่สัตว์เลี้ยง', type: 'pet', pet: k, price: D.PETS[k].price, lv: D.PETS[k].lv, icon: D.PETS[k].color };
  for (const k in D.MOUNTS) D.ITEMS['mount_' + k] = { n: D.MOUNTS[k].n + ' Whistle', th: 'นกหวีดพาหนะ', type: 'mount', mount: k, price: D.MOUNTS[k].price, lv: D.MOUNTS[k].lv, icon: D.MOUNTS[k].color };
  D.STABLE = [...Object.keys(D.PETS).map((k) => 'egg_' + k), ...Object.keys(D.MOUNTS).map((k) => 'mount_' + k), 'pet_food'];
  D.ITEMS.pet_food = { n: 'Pet Treat', th: 'ขนมสัตว์เลี้ยง (EXP สัตว์ +40)', type: 'petfood', price: 500, lv: 1, icon: '#ffa0c0' };

  // ---------------------------------------------------------------- consumables & currencies
  Object.assign(D.ITEMS, {
    exp_scroll: { n: 'Scroll of Wisdom', th: 'EXP +50% 30 นาที', type: 'buffitem', buff: { expPct: 50 }, dur: 1800, price: 0, sell: 200, icon: '#8affc8' },
    drop_scroll: { n: 'Scroll of Fortune', th: 'ดรอป +30% 30 นาที', type: 'buffitem', buff: { dropPct: 30 }, dur: 1800, price: 0, sell: 200, icon: '#ffe08a' },
    battle_elixir: { n: 'Battle Elixir', th: 'ATK/MATK +10% 10 นาที', type: 'buffitem', buff: { atkPct: 10, matkPct: 10 }, dur: 600, price: 0, sell: 100, icon: '#ff8a5a' },
    iron_elixir: { n: 'Iron Elixir', th: 'DEF +20% ลดดาเมจ 5% 10 นาที', type: 'buffitem', buff: { defPct: 20, dmgReduce: 5 }, dur: 600, price: 0, sell: 100, icon: '#9ab0c8' },
    daily_token: { n: 'Valor Token', th: 'โทเคนเกียรติยศ (แลกของที่ Alchemist)', type: 'currency', price: 0, icon: '#ffcc33' },
    arena_token: { n: 'Arena Medal', th: 'เหรียญอารีน่า (แลกของที่ Alchemist)', type: 'currency', price: 0, icon: '#ff5a7a' },
    herb: { n: 'Wild Herb', th: 'สมุนไพร (วัตถุดิบคราฟต์)', type: 'loot', price: 0, sell: 8, icon: '#5ac85a' },
    mana_dust: { n: 'Mana Dust', th: 'ผงมานา (วัตถุดิบคราฟต์)', type: 'loot', price: 0, sell: 12, icon: '#7a9aff' }
  });
  D.ITEMS.monster_core.th = 'แกนมอนสเตอร์ (วัตถุดิบคราฟต์ / ขายได้)';

  D.RECIPES = [
    { out: 'pot_hp_2', q: 5, req: [['pot_hp_1', 5], ['herb', 3]], zeny: 100, lv: 20 },
    { out: 'pot_hp_3', q: 5, req: [['pot_hp_2', 5], ['herb', 5], ['monster_core', 2]], zeny: 500, lv: 70 },
    { out: 'pot_hp_4', q: 5, req: [['pot_hp_3', 5], ['herb', 8], ['monster_core', 5]], zeny: 2000, lv: 130 },
    { out: 'pot_hp_5', q: 5, req: [['pot_hp_4', 5], ['herb', 12], ['mana_dust', 5]], zeny: 6000, lv: 190 },
    { out: 'pot_sp_2', q: 5, req: [['pot_sp_1', 5], ['mana_dust', 3]], zeny: 200, lv: 40 },
    { out: 'pot_sp_3', q: 5, req: [['pot_sp_2', 5], ['mana_dust', 6]], zeny: 900, lv: 110 },
    { out: 'pot_sp_4', q: 5, req: [['pot_sp_3', 5], ['mana_dust', 10], ['monster_core', 5]], zeny: 3000, lv: 190 },
    { out: 'tele_scroll', q: 3, req: [['monster_core', 3]], zeny: 50, lv: 1 },
    { out: 'battle_elixir', q: 1, req: [['herb', 6], ['monster_core', 6]], zeny: 1500, lv: 30 },
    { out: 'iron_elixir', q: 1, req: [['herb', 6], ['mana_dust', 4]], zeny: 1500, lv: 30 },
    { out: 'ore_refine', q: 1, req: [['monster_core', 12]], zeny: 500, lv: 10 },
    { out: 'crystal_pure', q: 1, req: [['ore_refine', 8], ['mana_dust', 10], ['monster_core', 20]], zeny: 30000, lv: 60 },
    { out: 'crystal_divine', q: 1, req: [['crystal_pure', 6], ['mana_dust', 30]], zeny: 250000, lv: 140 },
    { out: 'scroll_protect', q: 1, req: [['crystal_pure', 2], ['monster_core', 30]], zeny: 15000, lv: 60 },
    { out: 'rune_drill', q: 1, req: [['ore_refine', 4], ['monster_core', 15]], zeny: 8000, lv: 40 },
    { out: 'reroll_stone', q: 1, req: [['mana_dust', 15], ['monster_core', 15]], zeny: 10000, lv: 40 },
    { out: 'pet_food', q: 5, req: [['herb', 4]], zeny: 200, lv: 1 }
  ];
  D.TOKEN_SHOP = [
    ['exp_scroll', 5, 'daily_token'], ['drop_scroll', 5, 'daily_token'], ['crystal_pure', 8, 'daily_token'], ['scroll_protect', 15, 'daily_token'],
    ['scroll_bless', 30, 'daily_token'], ['crystal_divine', 40, 'daily_token'], ['memory_crystal', 20, 'daily_token'], ['rune_drill', 10, 'daily_token'],
    ['battle_elixir', 6, 'arena_token'], ['iron_elixir', 6, 'arena_token'], ['reroll_stone', 10, 'arena_token'], ['crystal_divine', 35, 'arena_token'], ['scroll_bless', 25, 'arena_token']
  ];

  // ---------------------------------------------------------------- quests
  D.MAIN_QUESTS = [];
  D.FARM_MAPS.forEach((f, i) => {
    D.MAIN_QUESTS.push({ id: 'mq_' + f.id, n: `บุกเบิก ${f.name}`, desc: `กำจัดมอนสเตอร์ใน ${f.name} (${f.th}) ให้ได้ ${30 + i * 4} ตัว`, type: 'kill', map: f.id, v: 30 + i * 4, lv: Math.max(1, f.min - 3),
      reward: { expMul: 6 + i * 0.4, zeny: 2000 + f.min * 300, items: [[i < 8 ? 'pot_hp_2' : i < 16 ? 'pot_hp_3' : 'pot_hp_4', 20], [i % 3 === 0 ? 'crystal_pure' : 'ore_refine', i % 3 === 0 ? 2 : 5]] } });
    if (i % 5 === 4) {
      const dg = D.DUNGEONS[(i / 5) | 0];
      const floor = 10 + i * 8;
      D.MAIN_QUESTS.push({ id: 'mq_dg_' + i, n: `ไต่ ${dg.name}`, desc: `ผ่าน ${dg.name} (${dg.th}) ถึงชั้น ${floor}`, type: 'floor', dg: dg.id, v: floor, lv: f.min,
        reward: { expMul: 10 + i, zeny: 20000 + f.min * 800, items: [['crystal_pure', 3], ['scroll_protect', 1], ['daily_token', 5]] } });
    }
    if (i % 6 === 5) D.MAIN_QUESTS.push({ id: 'mq_lv_' + i, n: `ก้าวข้ามขีดจำกัด`, desc: `ไปให้ถึงเลเวล ${f.max}`, type: 'level', v: f.max, lv: f.min,
      reward: { expMul: 0, zeny: 50000 + f.max * 1000, items: [['crystal_divine', 1 + ((i / 6) | 0)], ['exp_scroll', 2]] } });
  });
  D.MAIN_QUESTS.push({ id: 'mq_final', n: 'ตำนานแห่ง Novice', desc: 'ไปให้ถึงเลเวล 250', type: 'level', v: 250, lv: 235, reward: { expMul: 0, zeny: 10000000, items: [['crystal_divine', 20], ['scroll_bless', 5]] } });
  D.DAILY_POOL = [
    { id: 'd_kill', n: 'นักล่าประจำวัน', desc: 'กำจัดมอนสเตอร์ 150 ตัว', type: 'kill', v: 150 },
    { id: 'd_elite', n: 'ล่ามอนเรืองแสง', desc: 'กำจัด Elite 8 ตัว', type: 'elite', v: 8 },
    { id: 'd_combo', n: 'จอมคอมโบ', desc: 'ทำคอมโบให้ถึง 12', type: 'combo', v: 12 },
    { id: 'd_floor', n: 'นักไต่หอคอย', desc: 'ผ่านดันเจี้ยน 5 ชั้น', type: 'floor', v: 5 },
    { id: 'd_refine', n: 'ช่างตีเหล็ก', desc: 'ตีบวกสำเร็จ 3 ครั้ง', type: 'refine', v: 3 },
    { id: 'd_craft', n: 'นักเล่นแร่แปรธาตุ', desc: 'คราฟต์ไอเทม 3 ครั้ง', type: 'craft', v: 3 },
    { id: 'd_pvp', n: 'นักสู้', desc: 'ชนะ PvP 2 ครั้ง (อารีน่า/ดวล/จัดอันดับ)', type: 'pvp', v: 2 },
    { id: 'd_boss', n: 'ผู้ปราบบอส', desc: 'ร่วมกำจัดบอส 1 ตัว (Field/Dungeon/World)', type: 'boss', v: 1 },
    { id: 'd_skill', n: 'ฝึกวิชา', desc: 'ใช้สกิล 200 ครั้ง', type: 'skill', v: 200 },
    { id: 'd_trade', n: 'พ่อค้า', desc: 'ขายของในตลาดประมูลหรือร้านค้า 10 ครั้ง', type: 'sell', v: 10 }
  ];
  D.DAILY_COUNT = 5;
  D.LOGIN_REWARDS = [
    { items: [['pot_hp_2', 30]], zeny: 5000 }, { items: [['ore_refine', 10]], zeny: 10000 }, { items: [['exp_scroll', 1]], zeny: 15000 },
    { items: [['crystal_pure', 3]], zeny: 20000 }, { items: [['scroll_protect', 1], ['pet_food', 10]], zeny: 30000 }, { items: [['drop_scroll', 2], ['daily_token', 5]], zeny: 50000 },
    { items: [['crystal_divine', 1], ['scroll_bless', 1], ['daily_token', 10]], zeny: 100000 }
  ];

  // ---------------------------------------------------------------- achievements (unlock titles + permanent bonuses)
  const A = (id, n, desc, stat, v, title, bonus, icon) => ({ id, n, desc, stat, v, title, bonus: bonus || null, icon: icon || '🏅' });
  D.ACHIEVEMENTS = [
    A('k100', 'นักล่ามือใหม่', 'กำจัดมอน 100 ตัว', 'kills', 100, 'Hunter', null, '🗡'), A('k1000', 'นักล่าตัวจริง', 'กำจัดมอน 1,000 ตัว', 'kills', 1000, 'Slayer', { atkPct: 1, matkPct: 1 }, '⚔'),
    A('k10000', 'ผู้ล้างเผ่าพันธุ์', 'กำจัดมอน 10,000 ตัว', 'kills', 10000, 'Exterminator', { atkPct: 2, matkPct: 2 }, '☠'), A('k50000', 'มหันตภัย', 'กำจัดมอน 50,000 ตัว', 'kills', 50000, 'Calamity', { dmgPct: 3 }, '🌋'),
    A('e50', 'ล่าแสง', 'กำจัด Elite 50 ตัว', 'elites', 50, 'Glow Hunter', { dropPct: 2 }, '✨'), A('b10', 'ผู้ปราบบอส', 'กำจัดบอส 10 ตัว', 'bosses', 10, 'Boss Slayer', { bossDmg: 3 }, '👹'), A('b100', 'ฝันร้ายของบอส', 'กำจัดบอส 100 ตัว', 'bosses', 100, 'Bane of Kings', { bossDmg: 6 }, '👑'),
    A('lv50', 'ก้าวแรก', 'เลเวล 50', 'lv', 50, 'Adventurer', { hpPct: 2 }, '🌱'), A('lv100', 'ผู้ตื่นรู้', 'เลเวล 100', 'lv', 100, 'Awakened', { hpPct: 3 }, '🌿'), A('lv150', 'วีรชน', 'เลเวล 150', 'lv', 150, 'Hero', { hpPct: 3, defPct: 3 }, '🌳'),
    A('lv200', 'ตำนาน', 'เลเวล 200', 'lv', 200, 'Legend', { atkPct: 3, matkPct: 3 }, '🏔'), A('lv250', 'เหนือมนุษย์', 'เลเวล 250', 'lv', 250, 'Transcendent', { dmgPct: 5, hpPct: 5 }, '🌌'),
    A('c10', 'คอมโบเริ่มต้น', 'คอมโบ 10', 'combo', 10, 'Combo Rookie', null, '🔥'), A('c20', 'คอมโบมาสเตอร์', 'คอมโบ 20', 'combo', 20, 'Combo Master', { comboDmg: 3 }, '💥'), A('c40', 'คอมโบไม่รู้จบ', 'คอมโบ 40', 'combo', 40, 'Infinite Chain', { comboDmg: 6 }, '♾'),
    A('r10', '+10!', 'ตีบวก +10 สำเร็จ', 'refine', 10, 'Smith', null, '⚒'), A('r15', '+15!!', 'ตีบวก +15 สำเร็จ', 'refine', 15, 'Master Smith', { atkPct: 1 }, '🔨'), A('r20', '+20!!!', 'ตีบวก +20 สำเร็จ', 'refine', 20, 'God of Forge', { atkPct: 3, matkPct: 3 }, '🌟'),
    A('f100', 'นักไต่หอ', 'ผ่านดันเจี้ยนชั้น 100', 'floor', 100, 'Climber', { hpPct: 2 }, '🗼'), A('f500', 'ผู้พิชิตกึ่งทาง', 'ผ่านดันเจี้ยนชั้น 500', 'floor', 500, 'Abyss Walker', { dmgReduce: 2 }, '🕳'), A('f1000', 'ผู้พิชิต 1000 ชั้น', 'ผ่านดันเจี้ยนชั้น 1000', 'floor', 1000, 'Conqueror of Depths', { dmgPct: 5 }, '🏆'),
    A('p10', 'มือใหม่ PvP', 'ฆ่าผู้เล่น 10 ครั้ง', 'pvp', 10, 'Duelist', { pvpDmg: 2 }, '🤺'), A('p100', 'ราชันสนามรบ', 'ฆ่าผู้เล่น 100 ครั้ง', 'pvp', 100, 'Warlord', { pvpDmg: 4, pvpRes: 3 }, '🛡'),
    A('wb5', 'ผู้ท้าเทพ', 'ร่วมสู้ World Boss 5 ครั้ง', 'wb', 5, 'Godchallenger', { bossDmg: 3 }, '🌋'), A('cr50', 'นักเล่นแร่', 'คราฟต์ 50 ครั้ง', 'crafts', 50, 'Alchemist', null, '⚗'),
    A('ah20', 'เศรษฐี', 'ขายของในตลาด 20 ครั้ง', 'sold', 20, 'Tycoon', null, '💰'), A('q20', 'นักผจญภัย', 'ทำภารกิจหลัก 20 ภารกิจ', 'quests', 20, 'Questmaster', { hpPct: 2 }, '📜'),
    A('dq30', 'ขยันทุกวัน', 'ทำภารกิจรายวัน 30 ภารกิจ', 'dailies', 30, 'Diligent', { dropPct: 2 }, '📅'), A('pet30', 'คู่หูที่ดีที่สุด', 'สัตว์เลี้ยงเลเวล 30', 'petlv', 30, 'Beast Friend', { hpPct: 2 }, '🐾'),
    A('rk1500', 'นักสู้ระดับทอง', 'MMR จัดอันดับ 1500', 'mmr', 1500, 'Gold Gladiator', { pvpRes: 3 }, '🥇'), A('rk1900', 'ตำนานอารีน่า', 'MMR จัดอันดับ 1900', 'mmr', 1900, 'Arena Legend', { pvpDmg: 5 }, '💎')
  ];

  // ---------------------------------------------------------------- guild progression
  D.GUILD_MAX_LV = 20;
  D.guildExpNext = (lv) => 20000 * lv * lv;
  D.GUILD_SKILLS = {
    vitality: { n: 'Guild Vitality', th: 'HP สูงสุด', mods: { hpPct: 2 }, max: 5 },
    might: { n: 'Guild Might', th: 'ATK/MATK', mods: { atkPct: 1.5, matkPct: 1.5 }, max: 5 },
    fortune: { n: 'Guild Fortune', th: 'EXP / ดรอป', mods: { expPct: 3, dropPct: 2 }, max: 5 },
    haste: { n: 'Guild Haste', th: 'ความเร็วเดิน / ลด CD', mods: { movePct: 2, cdr: 1 }, max: 5 },
    bulwark: { n: 'Guild Bulwark', th: 'DEF / ลดดาเมจ PvP', mods: { defPct: 2, pvpRes: 1.5 }, max: 5 }
  };

  // ---------------------------------------------------------------- ranked arena
  D.RANK_TIERS = [[0, 'Bronze', '#c08050'], [1100, 'Silver', '#c8c8d8'], [1300, 'Gold', '#ffd34a'], [1500, 'Platinum', '#6ae0d0'], [1700, 'Diamond', '#8ab0ff'], [1900, 'Legend', '#ff5ad0']];
  D.rankTier = (mmr) => { let t = D.RANK_TIERS[0]; for (const x of D.RANK_TIERS) if (mmr >= x[0]) t = x; return t; };
  D.EMOTES = ['😀', '😂', '😎', '😡', '😭', '❤️', '👍', '👋', '🙏', '💤', '🔥', '❓'];

  // shops also sell the extra consumables
  for (const k in D.SHOP) D.SHOP[k].push('pet_food');
});

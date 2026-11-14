# Novice Online

MMORPG แนวแอ็กชันคอมโบที่เล่นบนเว็บด้วย HTML5 — PvP, Guild War, Field/World Boss, ฟาร์มรูน/ประดับ, ตีบวก +20, เลเวล 250
30 คลาส × 55 สกิล (40 แอคทีฟ / 5 อัลติเมต / 5 บัฟ / 5 พาสซีฟ) ออกแบบใหม่ทั้งหมดไม่ซ้ำกัน, 5 เมือง, 25 แผนที่ฟาร์ม, 5 ดันเจี้ยน × 1000 ชั้น, ระบบออโต้ และคำสั่ง GM

## เริ่มเล่น

```bash
npm install
npm start            # คอมไพล์สกิลจาก docs แล้วเปิดเซิร์ฟเวอร์ที่ http://localhost:8080
```

- เปิด `http://localhost:8080` สมัครสมาชิก → สร้างตัวละคร (เลือกคลาสได้ทันที) → เข้าเกม
- **บัญชีแรกที่สมัครจะได้ GM Lv5 อัตโนมัติ** หรือกำหนดเองด้วย `GM_USERS=name1,name2 npm start`
- ตัวแปรอื่น: `PORT` (ค่าเริ่มต้น 8080), `NO_DATA_DIR` (ที่เก็บฐานข้อมูล, ค่าเริ่มต้น `data/`)
- สถานะเซิร์ฟเวอร์: `GET /health` (ผู้เล่น, จำนวน entity, เวลาต่อ tick, RAM)

## เนื้อหา

| ระบบ | รายละเอียด |
|---|---|
| คลาส | Blade Knight, Guardian, Berserker, Shadow Assassin, Ranger, Elementalist, Cleric, Monk, Warlock, Gunslinger — ค่าพลังเริ่มต้น HP/SP/ASPD/ความเร็ว/ระยะ/พลังพิเศษ ไม่ซ้ำกัน |
| สกิล | 30 คลาส × (40 แอคทีฟ · 5 อัลติเมต · 5 บัฟ · 5 พาสซีฟ) เขียนด้วยมือใน `tools/kits/<class>.js` — แต่ละสกิลเป็นโปรแกรมรูปทรง (44 แบบ เช่น บูมเมอแรง เกลียว วงแหวน กากบาท น้ำวน สายผูก) + ผลการโจมตี คอมไพล์ด้วย `tools/build-skills5.js` ซึ่งไม่ยอมให้สองสกิลในเกมมีโปรแกรมเดียวกัน · เอฟเฟกต์วาดด้วยวัสดุประจำคลาส 30 แบบ (`client/js/vfx5.js`) |
| คอมโบ | Starter → Linker → Finisher, แท็กสถานะ 19 ชนิด, Combo Counter (+3%/คอมโบ, สูงสุด +60%), เติมเกจ Ultimate, 8 ปฏิกิริยาธาตุข้ามคลาส |
| บิลด์ | แต้มสกิล ~300 จาก 475 ที่ต้องใช้อัปครบ → ต้องเลือกสาย, 6 สเตตัส (ค่าแต้มเพิ่มขึ้นทุก 25), รีเซ็ตได้ |
| แผนที่ | 5 เมือง (140–150 ช่อง), 25 แผนที่ฟาร์ม (260–340 ช่อง, Lv1–250, แผนที่ 21–25 เป็น Open PK), สร้างแบบ procedural และ deterministic (เซิร์ฟ/ไคลเอนต์สร้างแผนที่เดียวกันจาก seed) |
| ดันเจี้ยน | Abyss Tower, Inferno Depths, Frost Crypt, Shadow Labyrinth, Sky Sanctum ประเภทละ 1000 ชั้น — บอสทุก 10 ชั้น, บอสใหญ่ทุก 100 ชั้น, เริ่มที่ Checkpoint ได้, ปาร์ตี้เข้าด้วยกันได้ |
| บอส | Field Boss ทุกแผนที่ฟาร์ม (MVP), World Boss วันละ 3 รอบ (12:00/19:00/22:00) จัดอันดับดาเมจและเปิด PvP ในลาน, บอสมี Phase/Stagger/Telegraph |
| ไอเทม | 6 ระดับความหายาก, ออปชั่นสุ่ม, ตีบวก +20 (Pity, กันพัง/กันลด), รูน 10 ชนิด × 5 ระดับ + Rune Set, อัญมณี 6 ชนิด × 10 ระดับ, เจาะช่อง/สุ่มออปชั่น/รวมรูน |
| PvP / GvG | Blood Colosseum, ดวล, Open PK, Guild War 5 ปราสาท (ทำลาย Crystal Core), พันธมิตร, บัฟเจ้าของปราสาท |
| สังคม | ปาร์ตี้ 6 คน (แชร์ EXP), กิลด์ (ยศ/ประกาศ/พันธมิตร), แชท แผนที่/โลก/ปาร์ตี้/กิลด์/กระซิบ, จัดอันดับ |
| ออโต้ | คลิกเดิน/WASD/จอยสติ๊ก = ปิดออโต้ทันที · ทำงานฝั่งเซิร์ฟเวอร์: เลือกเป้า (ใกล้สุด/HP น้อย/ลำดับ/ป้องกันตัว), Whitelist/Blacklist, รัศมี/ยึดจุด, ลำดับสกิลพร้อมเงื่อนไข 10 แบบ, สร้างคอมโบ S→L→F อัตโนมัติ, ยา, บัฟ, ฮีลเพื่อน, Break Free, กลับเมืองซื้อยาแล้วกลับจุดเดิม, ฟาร์มออฟไลน์ 12 ชม. |
| ตัวละคร | ค่าสเตตัสโตอัตโนมัติแบบ ARPG · Passive Skill Tree 1000 โหนด (Notable 137, Keystone 20) |
| ของดรอป | ดรอปบนพื้นเท่านั้น คลิก/Space เพื่อเก็บ · สิทธิ์เก็บ 30 วินาทีแรกเป็นของผู้ฆ่า/ปาร์ตี้ · ออโต้เก็บตามตัวกรอง · ทิ้งของ = วางลงพื้น |
| ลานฝึกซ้อม | Training Grounds (NPC Drillmaster Hugo ทุกเมือง): หุ่น Lv1–250, หุ่นบอส, หุ่น 7 ธาตุ, มิเตอร์ DPS |
| ภารกิจ | ภารกิจหลัก 35 บท (ทุกแผนที่ฟาร์ม + ดันเจี้ยน + เลเวล), ภารกิจรายวันสุ่ม 5 อย่าง, รางวัลล็อกอิน 7 วัน, ตัวติดตามภารกิจบนจอ |
| ความสำเร็จ | 31 ความสำเร็จ ปลดฉายา (แสดงเหนือหัว) และโบนัสสเตตัสถาวร |
| เศรษฐกิจ | ตลาดประมูล (ค้นหา/กรอง/เรียง, ภาษี 5%), เทรดผู้เล่นแบบล็อก+ยืนยัน, จดหมายแนบของ/Zeny, คลังร่วมบัญชี 300 ช่อง, คราฟต์ 17 สูตร, ร้านแลก Valor Token / Arena Medal |
| สัตว์เลี้ยง & พาหนะ | สัตว์เลี้ยง 7 ตัว (Lv1–30, เดินตาม, ให้โบนัส), พาหนะ 5 แบบ (+25–70% ความเร็ว, กด T) |
| PvP เพิ่มเติม | Ranked Arena 1v1 จับคู่ตาม MMR (Elo) 6 ระดับ, ระบบ Karma ชื่อแดงในแผนที่ PK (ตายแล้วดรอปของให้ผู้ฆ่า) |
| กิลด์ | เลเวลกิลด์ 1–20 (EXP จากสมาชิก), สกิลกิลด์ 5 อย่าง, คลังกิลด์ |
| อื่นๆ | เพื่อน, อีโมต 12 แบบ, เสียงเอฟเฟกต์และเพลงสังเคราะห์ (WebAudio), อนุภาคตามธาตุ, จอยสติ๊กสัมผัสบนมือถือ, หน้าตั้งค่า |
| GM | หน้าต่างเครื่องมือ GM แบบไอคอน (F10): เสกไอเทม/อุปกรณ์ทุกระดับ, เสกมอนทุกชนิด/ระดับ, ควบคุม entity, จัดการผู้เล่น, ค่าพลัง+, เรท/อีเวนต์/โลก, Console · 60+ คำสั่ง 5 ระดับสิทธิ์ + GM Panel ในเกม (F10) + Audit Log (`data/gm_audit.log`) |

## ปุ่มควบคุม

`WASD`/คลิกพื้น เดิน · คลิกมอน ตีปกติ · `Tab` สลับเป้า · `Space` ตีเป้าใกล้สุด · `1`–`=` และ `Z X C V B N` Hotbar 18 ช่อง ·
`Q` Break Free · `F1`/`F2` ยา · `U` ตัวละคร · `I` กระเป๋า · `K` สกิล · `O` ออโต้ · `` ` `` เปิด/ปิดออโต้ · `M` แผนที่ ·
`J` ดันเจี้ยน · `G` กิลด์ · `P` ปาร์ตี้ · `R` อันดับ · `L` ภารกิจ · `Y` ความสำเร็จ · `F` เพื่อน · `,` สัตว์เลี้ยง · `.` ตั้งค่า · `T` ขี่พาหนะ · `E` อีโมต · `H` คู่มือ · `F10` GM · `Enter` แชท · ล้อเมาส์ ซูม · คลิกขวาผู้เล่น = เมนู

## คำสั่ง GM (ตัวอย่าง)

พิมพ์ในแชทขึ้นต้นด้วย `@` หรือใช้ GM Panel (`F10`) · `@help` แสดงคำสั่งทั้งหมดตามระดับสิทธิ์

```
@warp <map> [x y]        @goto / @recall / @recallall    @hide  @god  @speed <n>
@lvup <n> [p]  @setlv    @stat  @statpoint  @skillpoint   @allskills  @resetskill
@item <id> [n] [p]       @gear <slot> <ilv> <rarity> [+refine]   @refine  @zeny  @mailall
@spawn <family> [n] [lv] [elite]   @spawnboss   @worldboss start|stop   @killall  @bosstimer
@announce  @rate exp|drop|refine <x>  @event start|stop doubleexp|doubledrop|refine
@gvg start|stop  @castle setowner  @pvp on|off [map]  @auto on|off [map]  @weather
@dungeon <type> <floor>  @stairs  @pet  @mount  @quest  @mmr  @karma  @sendmail  @guildlv  @mute  @kick  @jail  @ban  @unban  @ipban  @gmset
@reload (คอมไพล์สกิลจาก docs ใหม่โดยไม่ต้องรีสตาร์ท)  @save  @maintenance  @shutdown  @audit
```

## โครงสร้างโค้ด

```
docs/                 GAME_CONCEPT.md
tools/build-skills.js แปลงตารางสกิลใน docs → ข้อมูลกลไกเกม (shape, tags, consumes, เงื่อนไข, การเคลื่อนที่, ซัมมอน ฯลฯ)
shared/               ใช้ร่วมกันทั้งเซิร์ฟเวอร์และเบราว์เซอร์
  data2.js            ภารกิจ ความสำเร็จ สัตว์เลี้ยง พาหนะ สูตรคราฟต์ สกิลกิลด์ ระดับจัดอันดับ
  data.js             คลาส แท็ก ธาตุ ปฏิกิริยา แผนที่ ดันเจี้ยน ไอเทม ตารางตีบวก
  formulas.js         สเตตัส EXP มอนสเตอร์ สร้างอุปกรณ์
  mapgen.js           สร้างแผนที่แบบ deterministic + A* pathfinding
  skills.js           (generated)
server/
  index.js            HTTP + WebSocket protocol, บันทึกอัตโนมัติ
  world.js            instance/แผนที่, spatial grid, AI มอนสเตอร์/ซัมมอน, snapshot 10Hz, tick 20Hz
  combat.js           ดาเมจ แท็ก ปฏิกิริยา คอมโบ การทำงานของสกิลทั้งหมด บัฟ การตาย
  items.js            กระเป๋า เลเวล ดรอป ร้านค้า ตีบวก รูน อัญมณี
  auto.js             ระบบออโต้
  progress.js         ภารกิจ ความสำเร็จ ฉายา สัตว์เลี้ยง พาหนะ Karma Ranked Arena เลเวล/สกิล/คลังกิลด์ เพื่อน อีโมต
  econ.js             คลัง จดหมาย ตลาดประมูล เทรด คราฟต์ ร้านโทเคน/สัตว์
  social.js           ปาร์ตี้ กิลด์ แชท Guild War Field/World Boss ดันเจี้ยน อันดับ
  gm.js               คำสั่ง GM
  db.js               ฐานข้อมูล JSON (atomic save) — เปลี่ยนเป็น PostgreSQL ได้โดยคง API เดิม
client/               HTML5 Canvas + DOM HUD (ไม่ต้อง build)
  js/art.js           กราฟิก procedural ทั้งหมด (พื้น ต้นไม้ ตัวละคร 10 คลาส มอน 17 แบบ ไอคอนสกิล/ไอเทม)
  js/game.js          เน็ตเวิร์ก การเดินแบบ predict, input, กล้อง, เรนเดอร์, VFX
  js/ui.js, ui2.js    HUD และหน้าต่างทั้งหมด
  js/sfx.js           เสียงเอฟเฟกต์ + เพลง (สังเคราะห์ด้วย WebAudio)
```

เซิร์ฟเวอร์เป็นตัวตัดสินทุกอย่าง (ดาเมจ ดรอป ตีบวก ตำแหน่งถูกตรวจความเร็ว/การชน) ไคลเอนต์ทำแค่ทำนายการเดินของตัวเอง
แผนที่ที่ไม่มีผู้เล่นจะหลับเองหลัง 30 วินาที มอนที่อยู่ไกลผู้เล่นจะคิดช้าลง — ทดสอบโหลด 38 แผนที่พร้อมกัน (~8,000 entity) ใช้ ~1.4 ms ต่อ tick

## แก้ไขสกิล / บาลานซ์

แก้สกิลใน `tools/kits/<class>.js` แล้วรัน `node tools/build-skills5.js` (หรือ `@reload` ในเกม)
จากนั้น `npm run build:skills` หรือ `@reload` ในเกม — ตัวคอมไพล์จะแปลงเป็นกลไกและรายงานถ้ามีสกิลที่ค่าซ้ำกัน

## Skill VFX (in-house engine)

`client/js/vfx.js` is our own effect engine. No third-party effect library is used.

**Recipes.** Every skill (1500) gets its own recipe built from 35 effect painters, for example:

- projectiles in 13 styles, and 8 slash styles
- rings, pillars, lightning, beams, waves, cones, rains
- black holes, sigils, fields, spikes
- auras, shields, wings, clocks, portals, chains
- impacts

Each recipe is chosen from the skill's delivery, element, class motif, weapon and statuses, and uses a palette of its own. All 1500 recipes are distinct.

**Rendering.**

- Effects draw into a 16 px-per-tile layer.
- An ordered dither thresholds that layer for crisp pixel art, which is then scaled up with nearest-neighbour.
- On top of that sit soft light, ground decals, debris physics, shadows, hit-stop, screen shake and a darkened screen on ultimates.
- Picking up loot has no effect.
- `client/vfx-gallery.html` renders every class's effects frame by frame for review.

## Classes v3 (15)

Five new classes, each with 40 Active + 5 Ultimate + 5 Buff skills, its own weapon, art and effect motif:

| Class | Theme | Weapon | Motif |
|---|---|---|---|
| **Chrono Stalker** (นักล่าเวลา) | time | twin chakram | clock |
| **Divine Sovereign** (เทพผู้ครองฟ้า) | god | divine orb | halo and wings |
| **Hellfiend** (ปีศาจนรก) | demon | claws | hellfire wings |
| **Void Walker** (ผู้เดินในความมืด) | darkness | shadow katana | void rifts |
| **Lightbringer** (ผู้นำแสง) | light | prism | rainbow beams |

New skill mechanics: cooldown shift and self-haste.

The passive tree was re-laid out for 15 starting points. Old allocations are refunded once, automatically.

## Balance v2

Monster HP and ATK now climb with level, and skill damage is scaled by `F.SKILL_DMG`. Against a same-level normal monster:

- a kill takes about 2–3 skills or 6–10 basic hits
- a monster hit deals about 4–8% of a geared player's HP
- a solo field boss lasts about 50–100 s

EXP is raised to match. PvP damage multiplier is ×0.5.

## Hotbar

50 slots in 5 rows of 10, collapsible to 20.

| Row | Keys |
|---|---|
| 1 | 1–0 |
| 2 | Shift+1–0 (Z X C V B N still work) |
| 3 | Alt+1–0 |
| 4–5 | click only |

## Items, Monster Book, crafting (v5)

`shared/itemdb.js` generates **1,843 items**: 1,195 stackables and 648 named gear bases.

- **Monster species (178):** every monster species in every region has its own items:
  - common, rare and Pristine trophy materials
  - a junk item for selling
  - a card that fits a rune socket (178 cards, each with a unique stat pair)
- **Field gear:** each of the 25 field maps drops its own 18 named items (10 weapons, 8 armours and accessories). Field monsters drop **Common–Epic** only.
- **Legendary:** comes from dungeon monsters and floor bosses (90 named), from Ancient Relic Chests, or from crafting (90 regional, needing trophies plus Field Boss crests).
- **Mythic:** 18 items, crafted from trophies of every region, Guardian Sigils and World Boss materials; World Bosses also drop them (rarely).
- **Other items:**
  - Support: regional foods, element oils, draughts, stat foods, cures, Fly Wing.
  - Refine: Rough Ore, Enriched Ore, shards, anvils, Smith's Charm.
  - Sellables: regional treasures.
  - Random boxes.
- **Monster Book** (📕, key `]`): every species with portrait, level, element, location, kill count and its full drop table with rates. You can search by monster, map or item.

## Passive tree special effects

All 137 notables and 20 keystones carry a unique special effect on top of their stats. Examples:

- execute and opener damage
- damage against tagged targets
- element mastery
- on-hit status
- crit heal
- kill effects: heal, SP, cooldown, haste, corpse blast
- ward, thorns, SP refund
- faster ultimate charge, shield on ultimate
- Last Stand
- dodge heal

## Auto: PvE / PvP

The auto window switches between **PvE** (farm monsters) and **PvP** (hunt hostile players, with lowest-HP / nearest / healer-first targeting). Each mode keeps its own skill rotation.

**🧠 Auto-arrange** (`F.autoPlan`) scores every learned skill for the chosen mode:

- **PvE:** AoE when packs are around, set up and pay off combos, then raw DPS.
- **PvP:** open with crowd control, follow with gap-closers, combo payoffs and executes; quick single-target skills are favoured.

## GM modes

`@gmmode god|nocd|nosp|nocast|onehit|peace|autoloot|dmg <x>|all|off` turns on immortal, no cooldown, no SP / ult cost, instant cast, one-hit kill, monsters ignore you, auto-loot, or a damage multiplier.

These modes are saved per GM character and reset for non-GM accounts.

New GM window pages:

- **GM modes**
- **Named gear:** spawn any base at any rarity and iLv
- **Monster Book spawner**

New commands: `@spawnsp`, `@gearb`, `@gearlist`, `@book`, `@pickupall`, `@clearground`, `@cdreset`, `@buffall`, `@respawnmap`.

## Icons

- **Skill icons** are 32×32 pixel art with a class backdrop and motif, a glyph showing the skill's mechanic, an element emblem, a status pip and a frame by kind. All 500 are unique.
- **Item icons:** the new item types have pixel icons, all unique.

## Skills v4 — signature mechanics
Every active skill has one signature mechanic (`sk.mech`), chosen per class from its own pool (`tools/skill-design.js` `MECH`) and implemented server-side in `server/combat.js` `mechanics()`:

| mech | effect |
|---|---|
| echo | re-hits the same targets after a delay at reduced power |
| orbit | orbs circle the caster and hit anything they touch |
| wall | an elemental wall laid across the aim direction |
| trail | leaves an elemental trail along the dash path |
| boomerang | returns to the caster and hits again |
| split | splits into the nearest extra enemies |
| stackSelf | each cast stacks +damage on yourself |
| resetOnKill | killing the target resets the cooldown |
| overcharge | spends extra SP when available for a big multiplier |

Tooltips and skill cards show the mechanic as a gold chip. Orbit / wall / trail zones and echo / boomerang hits have their own visuals in `client/js/vfx.js`.

## VFX v4
Pixel-art look, written in-house:
- Effects step at 14 fps (projectiles and zones at 30 fps).
- Debris particles are drawn on the same 16 px-per-tile pixel layer.
- A quarter-size bloom pass adds a soft glow to bright pixels.

## Bosses (sprite pack)
Field bosses (25 maps), dungeon floor bosses (5 dungeons) and world bosses (20, 16 of them new) use the animated sprite atlases in `client/js/bossart.js`. Each atlas has idle, run, attack, hit and death rows, built from the supplied Duelyst unit pack.
- `D.BOSS_SPRITES` maps maps, dungeons and world bosses to sprites; `D.BOSS_NAMES` holds their in-game names.
- Sprites are anchored to their shadow and switch animation by state.
- GM test command: `@bossart <sprite|list> [lv]`.

## HUD v2
- The menu dock is grouped into labelled sections: ตัวละคร / ผจญภัย / สังคม & ค้าขาย / ระบบ. Every button has a name and a shortcut key.
- The 🧭 HUD guide highlights each HUD element with a numbered note. It opens on first login and from the menu.

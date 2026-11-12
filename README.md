# Novice Online

MMORPG แนวแอ็กชันคอมโบที่เล่นบนเว็บด้วย HTML5 — PvP, Guild War, Field/World Boss, ฟาร์มรูน/ประดับ, ตีบวก +20, เลเวล 250
10 คลาส × 50 สกิล (40 โจมตี / 5 อัลติเมต / 5 บัฟ), 5 เมือง, 25 แผนที่ฟาร์ม, 5 ดันเจี้ยน × 1000 ชั้น, ระบบออโต้ และคำสั่ง GM

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
| สกิล | 500 สกิล คอมไพล์จาก `docs/classes/*.md` → `shared/skills.js` (ไม่มีสองสกิลในคลาสเดียวกันที่ค่า SP/CD/ดาเมจ/ระยะ/รูปแบบซ้ำกัน) |
| คอมโบ | Starter → Linker → Finisher, แท็กสถานะ 19 ชนิด, Combo Counter (+3%/คอมโบ, สูงสุด +60%), เติมเกจ Ultimate, 8 ปฏิกิริยาธาตุข้ามคลาส |
| บิลด์ | แต้มสกิล ~300 จาก 475 ที่ต้องใช้อัปครบ → ต้องเลือกสาย, 6 สเตตัส (ค่าแต้มเพิ่มขึ้นทุก 25), รีเซ็ตได้ |
| แผนที่ | 5 เมือง (140–150 ช่อง), 25 แผนที่ฟาร์ม (260–340 ช่อง, Lv1–250, แผนที่ 21–25 เป็น Open PK), สร้างแบบ procedural และ deterministic (เซิร์ฟ/ไคลเอนต์สร้างแผนที่เดียวกันจาก seed) |
| ดันเจี้ยน | Abyss Tower, Inferno Depths, Frost Crypt, Shadow Labyrinth, Sky Sanctum ประเภทละ 1000 ชั้น — บอสทุก 10 ชั้น, บอสใหญ่ทุก 100 ชั้น, เริ่มที่ Checkpoint ได้, ปาร์ตี้เข้าด้วยกันได้ |
| บอส | Field Boss ทุกแผนที่ฟาร์ม (MVP), World Boss วันละ 3 รอบ (12:00/19:00/22:00) จัดอันดับดาเมจและเปิด PvP ในลาน, บอสมี Phase/Stagger/Telegraph |
| ไอเทม | 6 ระดับความหายาก, ออปชั่นสุ่ม, ตีบวก +20 (Pity, กันพัง/กันลด), รูน 10 ชนิด × 5 ระดับ + Rune Set, อัญมณี 6 ชนิด × 10 ระดับ, เจาะช่อง/สุ่มออปชั่น/รวมรูน |
| PvP / GvG | Blood Colosseum, ดวล, Open PK, Guild War 5 ปราสาท (ทำลาย Crystal Core), พันธมิตร, บัฟเจ้าของปราสาท |
| สังคม | ปาร์ตี้ 6 คน (แชร์ EXP), กิลด์ (ยศ/ประกาศ/พันธมิตร), แชท แผนที่/โลก/ปาร์ตี้/กิลด์/กระซิบ, จัดอันดับ |
| ออโต้ | ทำงานฝั่งเซิร์ฟเวอร์: เลือกเป้า (ใกล้สุด/HP น้อย/ลำดับ/ป้องกันตัว), Whitelist/Blacklist, รัศมี/ยึดจุด, ลำดับสกิลพร้อมเงื่อนไข 10 แบบ, สร้างคอมโบ S→L→F อัตโนมัติ, ยา, บัฟ, ฮีลเพื่อน, Break Free, กลับเมืองซื้อยาแล้วกลับจุดเดิม, ฟาร์มออฟไลน์ 12 ชม. |
| GM | 50+ คำสั่ง 5 ระดับสิทธิ์ + GM Panel ในเกม (F10) + Audit Log (`data/gm_audit.log`) |

## ปุ่มควบคุม

`WASD`/คลิกพื้น เดิน · คลิกมอน ตีปกติ · `Tab` สลับเป้า · `Space` ตีเป้าใกล้สุด · `1`–`=` และ `Z X C V B N` Hotbar 18 ช่อง ·
`Q` Break Free · `F1`/`F2` ยา · `U` ตัวละคร · `I` กระเป๋า · `K` สกิล · `O` ออโต้ · `` ` `` เปิด/ปิดออโต้ · `M` แผนที่ ·
`J` ดันเจี้ยน · `G` กิลด์ · `P` ปาร์ตี้ · `R` อันดับ · `H` คู่มือ · `F10` GM · `Enter` แชท · ล้อเมาส์ ซูม · คลิกขวาผู้เล่น = เมนู

## คำสั่ง GM (ตัวอย่าง)

พิมพ์ในแชทขึ้นต้นด้วย `@` หรือใช้ GM Panel (`F10`) · `@help` แสดงคำสั่งทั้งหมดตามระดับสิทธิ์

```
@warp <map> [x y]        @goto / @recall / @recallall    @hide  @god  @speed <n>
@lvup <n> [p]  @setlv    @stat  @statpoint  @skillpoint   @allskills  @resetskill
@item <id> [n] [p]       @gear <slot> <ilv> <rarity> [+refine]   @refine  @zeny  @mailall
@spawn <family> [n] [lv] [elite]   @spawnboss   @worldboss start|stop   @killall  @bosstimer
@announce  @rate exp|drop|refine <x>  @event start|stop doubleexp|doubledrop|refine
@gvg start|stop  @castle setowner  @pvp on|off [map]  @auto on|off [map]  @weather
@dungeon <type> <floor>  @stairs  @mute  @kick  @jail  @ban  @unban  @ipban  @gmset
@reload (คอมไพล์สกิลจาก docs ใหม่โดยไม่ต้องรีสตาร์ท)  @save  @maintenance  @shutdown  @audit
```

## โครงสร้างโค้ด

```
docs/                 GAME_CONCEPT.md + docs/classes/*.md (ต้นฉบับดีไซน์สกิลทั้ง 500)
tools/build-skills.js แปลงตารางสกิลใน docs → ข้อมูลกลไกเกม (shape, tags, consumes, เงื่อนไข, การเคลื่อนที่, ซัมมอน ฯลฯ)
shared/               ใช้ร่วมกันทั้งเซิร์ฟเวอร์และเบราว์เซอร์
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
  social.js           ปาร์ตี้ กิลด์ แชท Guild War Field/World Boss ดันเจี้ยน อันดับ
  gm.js               คำสั่ง GM
  db.js               ฐานข้อมูล JSON (atomic save) — เปลี่ยนเป็น PostgreSQL ได้โดยคง API เดิม
client/               HTML5 Canvas + DOM HUD (ไม่ต้อง build)
  js/art.js           กราฟิก procedural ทั้งหมด (พื้น ต้นไม้ ตัวละคร 10 คลาส มอน 17 แบบ ไอคอนสกิล/ไอเทม)
  js/game.js          เน็ตเวิร์ก การเดินแบบ predict, input, กล้อง, เรนเดอร์, VFX
  js/ui.js            HUD และหน้าต่างทั้งหมด
```

เซิร์ฟเวอร์เป็นตัวตัดสินทุกอย่าง (ดาเมจ ดรอป ตีบวก ตำแหน่งถูกตรวจความเร็ว/การชน) ไคลเอนต์ทำแค่ทำนายการเดินของตัวเอง
แผนที่ที่ไม่มีผู้เล่นจะหลับเองหลัง 30 วินาที มอนที่อยู่ไกลผู้เล่นจะคิดช้าลง — ทดสอบโหลด 38 แผนที่พร้อมกัน (~8,000 entity) ใช้ ~1.4 ms ต่อ tick

## แก้ไขสกิล / บาลานซ์

แก้ตารางใน `docs/classes/XX_<class>.md` (คำอธิบายภาษาไทยมีตัวเลขและคีย์เวิร์ด เช่น `200%`, `AoE 3×3`, `Airborne`, `ใช้ Bleed →`)
จากนั้น `npm run build:skills` หรือ `@reload` ในเกม — ตัวคอมไพล์จะแปลงเป็นกลไกและรายงานถ้ามีสกิลที่ค่าซ้ำกัน

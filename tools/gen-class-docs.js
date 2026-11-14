// Writes docs/classes/16..30_*.md (the design source read by tools/build-skills.js) from tools/new-classes.js.
const fs = require('fs'), path = require('path');
const N = require('./new-classes.js'), R = require('./class-roster.js');
const ROLES = ['S', 'L', 'F', '–'];
let n = 16;
for (const [id, c] of Object.entries(N)) {
  const cl = R[id];
  let md = `# ${n}. ${cl.name} (${cl.th})\nอาวุธ: ${cl.wname} · ทรัพยากรพิเศษ: **${c.res.name}**\n\n> ${c.desc}\n\n**สายบิลด์**\n`;
  for (const b of Object.keys(c.branches)) if (b !== 'พื้นฐาน') md += `- **${c.branches[b]}**\n`;
  md += `\n## สกิลโจมตี (40)\n| # | สกิล | สาย | บทบาท | ผล |\n|---|---|---|---|---|\n`;
  let i = 1;
  for (const [b, list] of Object.entries(c.names)) list.forEach((nm, k) => { md += `| ${i} | ${nm} | ${b} | ${ROLES[(i * 3 + Math.floor(i / 4)) % 4]} | โจมตี ${b === 'พื้นฐาน' ? 150 : 200}% |\n`; i++; });
  md += `\n## Ultimate (5)\n| # | สกิล | ปลด | ผล |\n|---|---|---|---|\n`;
  c.ults.forEach((u, k) => { md += `| U${k + 1} | **${u[0]}** | ${u[1]} | ${u[2]} |\n`; });
  md += `\n## Buff (5)\n| # | สกิล | ผล |\n|---|---|---|\n`;
  c.buffs.forEach((b, k) => { md += `| B${k + 1} | ${b[0]} | บัฟ |\n`; });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'classes', `${n}_${id}.md`), md);
  n++;
}
console.log('docs written:', n - 16);

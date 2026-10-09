// node tools/round-capture.js <seed> <outdir> —— 跑一局（自動操作到一個結局），存截圖、事件、規則書。
import { writeFileSync, mkdirSync } from 'node:fs';
import { open } from './pw.js';
const seed = process.argv[2] || 'round1', DIR = process.argv[3] || 'docs/playtest/round-1';
mkdirSync(DIR, { recursive: true });
const pw = await open({ url: `http://localhost:5173/?autostart&seed=${seed}` });
const shot = (n) => pw.shot(DIR, n);
const until = async (fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
await until(async () => (await pw.status()).opening === 0, 8);
await shot('01-start');
// 玩法：到處惹書寫條文、接受一個舒適、喚醒村民（砸廣播器讓他們安靜）、觀察兩個時鐘
await pw.eval(() => window.__game.setActivity(20));
await pw.goto([33, 50]); await pw.face([0, -1]);
let o = await pw.options(); let i = o.findIndex(x => x.verb === 'break' && x.target?.startsWith('speaker')); if (i >= 0) await pw.act(i);
await shot('02-break-speaker');
await pw.wait(3); await shot('03-book-writes');
// 接受舒適
await pw.eval(() => { const g = window.__game.game; const h = g.villagers.find(v => v.level !== 'puppet'); if (h) { h.pos = [g.player.cell[0] + 1, g.player.cell[1]]; h.fpos = [...h.pos]; } });
await pw.face([1, 0]); o = await pw.options(); i = o.findIndex(x => x.verb === 'accept'); if (i >= 0) await pw.act(i);
await shot('04-comfort');
await pw.eval(() => window.__game.designer(true)); await pw.wait(0.3); await shot('05-designer');
// 推高活性看後期
await pw.eval(() => window.__game.setActivity(75)); await pw.wait(3); await shot('06-late-stage');
const st = await pw.status(), rules = await pw.designerRules ? await pw.eval(() => window.__game.rules()) : [];
writeFileSync(`${DIR}/status.json`, JSON.stringify(st, null, 1));
writeFileSync(`${DIR}/rulebook.json`, JSON.stringify(await pw.eval(() => window.__game.rules()), null, 1));
writeFileSync(`${DIR}/events.json`, JSON.stringify(await pw.log(), null, 1));
writeFileSync(`${DIR}/events.txt`, (await pw.log()).map(e => `[${e.t.toFixed(1)}s] ${e.type}\t${e.text}`).join('\n'));
console.log('captured to', DIR, '— activity', st.activity, 'stage', st.stage, 'assim', st.assim, 'rules', st.rules);
await pw.close();

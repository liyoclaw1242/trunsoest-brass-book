// node tools/playtest-r5.js —— R5 驗收：六種結局各達成一次，確認結局畫面與統計。固定種子。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';
const DIR = 'docs/playtest/r5';
const results = []; const check = (n, ok, info = '') => { results.push({ n, ok, info }); console.log(ok ? 'PASS' : 'FAIL', n, info); };
const overlay = pw => pw.eval(() => document.getElementById('overlay').hidden ? '' : document.getElementById('overlay').innerText);
const ENDING_CN = { transformed: '被轉化', escape: '逃跑', empty: '空村', exile: '放逐', unheard: '無人聆聽', destroyed: '損毀' };

async function drive(label, seed, fn, shot) {
  const pw = await open({ url: `http://localhost:5173/?autostart&nohunt&seed=${seed}` });
  await pw.wait(0.8);
  await fn(pw);
  await pw.wait(0.6);
  const m = await pw.eval(() => window.__game.match());
  const ov = await overlay(pw);
  const okState = m.state === label || (label === 'transformed' && m.state === 'transformed');
  check(`${ENDING_CN[label]}：達成並顯示結局畫面`, okState && ov.includes(ENDING_CN[label]) && /種子|用時/.test(ov), `state=${m.state} ov=${ov.slice(0, 30).replace(/\n/g, ' ')}`);
  await pw.shot(DIR, shot);
  await pw.close();
}

// 1 被轉化（活性）
await drive('transformed', 'e-activity', async pw => { await pw.eval(() => window.__game.setActivity(99.5)); await pw.eval(() => { window.__game.game.match.activity.opt.tickSec = 1; window.__game.game.match.activity.opt.timeGain = 5; }); await pw.wait(3); }, '01-transformed-activity');
// 2 被轉化（同化度）
await drive('transformed', 'e-assim', async pw => { await pw.eval(() => { for (let i = 0; i < 5; i++) window.__game.game.match.assim.captured(); }); }, '02-transformed-assim');
// 3 逃跑
await drive('escape', 'e-escape', async pw => { await pw.eval(() => window.__game.place([16, 52])); }, '03-escape');
// 4 空村（封印一）
await drive('empty', 'e-empty', async pw => { await pw.eval(() => { for (const v of window.__game.game.villagers) v.level = 'awake'; window.__game.place([16, 52]); }); }, '04-empty');
// 5 放逐（封印二）
await drive('exile', 'e-exile', async pw => { await pw.eval(() => { const g = window.__game.game; const b = [...g.world.objects.values()].find(o => o.type === 'book'); b.pos = [92, 92]; for (const v of g.villagers) v.pos = [49, 52]; }); }, '05-exile');
// 6 損毀（封印四）
await drive('destroyed', 'e-destroyed', async pw => { await pw.eval(() => { const b = [...window.__game.game.world.objects.values()].find(o => o.type === 'book'); b.state = 'destroyed'; window.__game.game.world.emit('object', { object: b, before: 'closed' }); }); }, '06-destroyed');
// 7 無人聆聽（封印三）
await drive('unheard', 'e-unheard', async pw => { await pw.eval(() => { const g = window.__game.game; g.match.opt.unheardSec = 1.5; g.match.lastCognition = g.match.t; for (const o of g.world.objects.values()) { if (o.type === 'speaker') o.state = 'broken'; if (o.type === 'notice') o.state = 'defaced'; } g.villagers.slice(0, 3).forEach(v => v.level = 'awake'); }); await pw.wait(2.2); }, '07-unheard');

writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
process.exit(results.every(r => r.ok) ? 0 : 1);

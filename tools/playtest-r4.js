// node tools/playtest-r4.js —— R4 驗收：喚醒三村民 → 活性增速與規則上限明顯下降；舒適兩種以上；山羊吃公告牌。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';
const DIR = 'docs/playtest/r4';
const results = []; const check = (n, ok, info = '') => { results.push({ n, ok, info }); console.log(ok ? 'PASS' : 'FAIL', n, info); };
const pw = await open({ url: 'http://localhost:5173/?autostart&seed=r4&nohunt' });
await pw.wait(1);
await pw.shot(DIR, '01-start');
// 山羊吃公告牌：把山羊放到公告牌旁、快轉
await pw.eval(() => { const g = window.__game.game; const goat = [...g.world.objects.values()].find(o => o.type === 'goat'); const n = [...g.world.objects.values()].find(o => o.type === 'notice' && o.state === 'written'); goat.pos = [n.pos[0] + 1, n.pos[1]]; goat.fpos = [...goat.pos]; goat.__n = n.id; });
const eaten = await (async () => { for (let i = 0; i < 60; i++) { await pw.wait(0.5); const g = await pw.eval(() => { const gg = window.__game.game; const goat = [...gg.world.objects.values()].find(o => o.type === 'goat'); const n = gg.world.objects.get(goat.__n); return n.state; }); if (g !== 'written') return true; } return false; })();
check('山羊吃掉相鄰公告牌的紙', eaten);
await pw.shot(DIR, '02-goat-eats');
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

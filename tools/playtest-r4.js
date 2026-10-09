// node tools/playtest-r4.js —— R4 驗收：喚醒三村民 → 活性增速與規則上限明顯下降；舒適兩種以上；山羊吃公告牌。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';
const DIR = 'docs/playtest/r4';
const results = []; const check = (n, ok, info = '') => { results.push({ n, ok, info }); console.log(ok ? 'PASS' : 'FAIL', n, info); };
const pw = await open({ url: 'http://localhost:5173/?autostart&seed=r4&nohunt' });
await pw.wait(1);
// 活性增速：全村工作 vs 喚醒三人
await pw.eval(() => window.__game.setActivity(10));
let a0 = (await pw.status()).activity; await pw.wait(22); let a1 = (await pw.status()).activity;
const rateFull = a1 - a0; const cap0 = (await pw.status()).ruleCap;
await pw.eval(() => { const g = window.__game.game; for (const v of g.villagers.slice(0, 3)) window.__game.wake(v.id); });
await pw.wait(1); const cap1 = (await pw.status()).ruleCap;
await pw.eval(() => window.__game.setActivity(10));
let b0 = (await pw.status()).activity; await pw.wait(22); let b1 = (await pw.status()).activity;
const rateWoke = b1 - b0;
check('喚醒三人 → 活性增速下降', rateWoke < rateFull, `全村 +${rateFull.toFixed(2)}/22s vs 喚醒後 +${rateWoke.toFixed(2)}/22s`);
check('喚醒三人 → 規則上限下降', cap1 < cap0, `${cap0}→${cap1}`);
check('勞動比例下降', (await pw.status()).laborRatio < 0.6, String((await pw.status()).laborRatio));
await pw.eval(() => window.__game.designer(true)); await pw.shot(DIR, '01-strike');
// 山羊吃公告牌：把山羊放到公告牌旁、快轉
await pw.eval(() => { const g = window.__game.game; const goat = [...g.world.objects.values()].find(o => o.type === 'goat'); const n = [...g.world.objects.values()].find(o => o.type === 'notice' && o.state === 'written'); goat.pos = [n.pos[0] + 1, n.pos[1]]; goat.fpos = [...goat.pos]; goat.__n = n.id; });
const eaten = await (async () => { for (let i = 0; i < 60; i++) { await pw.wait(0.5); const g = await pw.eval(() => { const gg = window.__game.game; const goat = [...gg.world.objects.values()].find(o => o.type === 'goat'); const n = gg.world.objects.get(goat.__n); return n.state; }); if (g !== 'written') return true; } return false; })();
check('山羊吃掉相鄰公告牌的紙', eaten);
await pw.shot(DIR, '02-goat-eats');
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

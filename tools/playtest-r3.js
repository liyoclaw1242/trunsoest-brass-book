// node tools/playtest-r3.js —— R3 驗收：固定種子，截圖每一項介面都看得到。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';
const DIR = 'docs/playtest/r3';
const results = []; const check = (n, ok, info = '') => { results.push({ n, ok, info }); console.log(ok ? 'PASS' : 'FAIL', n, info); };
const has = (pw, sel) => pw.eval(s => !!document.querySelector(s) && !document.querySelector(s).hidden, sel);
const text = (pw, sel) => pw.eval(s => (document.querySelector(s)?.innerText || ''), sel);

const pw = await open({ url: 'http://localhost:5173/?autostart&seed=r3demo' });
await pw.wait(3);
// 活性量表與階段、同化度、勞動
check('活性量表＋階段顯示', (await text(pw, '#meters')).includes('活性') && /前期|中期|後期/.test(await text(pw, '#meters')));
check('同化度量表', (await text(pw, '#meters')).includes('同化度'));
check('勞動人數與規則上限', /\d+ 人勞動供養/.test(await text(pw, '#meters')) && /規則上限 \d+/.test(await text(pw, '#meters')));
await pw.shot(DIR, '01-meters');
// 書寫中提示：拉高活性讓書常動筆，惹它寫
await pw.eval(() => window.__game.setActivity(40));
await pw.goto([49, 47]); // 靠近書台一帶惹事
for (let i = 0; i < 20; i++) { await pw.eval(() => window.__game.step([0, 1])); await pw.wait(0.1); await pw.eval(() => window.__game.step([0, -1])); await pw.wait(0.1); if (await has(pw, '#writing')) break; }
let wrote = await has(pw, '#writing') || (await pw.log()).some(e => e.type === 'writing' || e.type === 'write');
check('書寫中提示（或已寫下條文）', wrote);
await pw.shot(DIR, '02-writing');
// 設計者視角：等級、權重、種子
await pw.eval(() => window.__game.designer(true)); await pw.wait(0.3);
const dz = await text(pw, '#designer');
check('設計者視角：種子＋權重＋等級', dz.includes('種子') && dz.includes('權重') && /\d+\/\d+\/\d+/.test(dz), dz.slice(0, 44));
await pw.shot(DIR, '03-designer');
await pw.eval(() => window.__game.designer(false));
// 舒適：走到村民旁接受（找最近的 half 村民）
// 把一個 half 村民放到外鄉人旁邊，確保接受得到舒適
await pw.eval(() => { const g = window.__game.game; const me = g.player.cell; const h = g.villagers.find(x => x.level === 'half'); h.pos = [me[0] + 1, me[1]]; h.fpos = [...h.pos]; h.path = []; h.move = null; });
await pw.face([1, 0]);
{ const o = await pw.options(); const i = o.findIndex(x => x.verb === 'accept'); check('有「接受舒適」選項', i >= 0, o.map(x => x.label).slice(0, 4).join('|')); if (i >= 0) { await pw.act(i); await pw.wait(0.3); } }
const s2 = await pw.status();
check('接受舒適 → 同化度上升、meters 顯示舒適', s2.assim >= 1 && (await text(pw, '#meters')).includes('舒適'), JSON.stringify({ assim: s2.assim, comforts: s2.comforts }));
await pw.shot(DIR, '04-comfort');
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
const errs = pw.console.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
check('瀏覽器沒有錯誤', errs.length === 0, errs.join(' | '));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

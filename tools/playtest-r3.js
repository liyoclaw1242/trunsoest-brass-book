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
// 舒適：走到商人旁接受（舒適由市集的商人提供）
// 商人會走回自己的店鋪，所以把商人釘在它的店鋪工作位、再把外鄉人放到它旁邊，確保接受得到舒適
await pw.eval(() => {
  const g = window.__game.game; const h = g.villagers.find(x => x.role === 'merchant') || g.villagers.find(x => x.level === 'half');
  const shop = [...g.world.objects.values()].find(o => o.type === 'shop');
  const spot = shop ? (g.grid.neighbors(shop.pos).find(c => !g.grid.blocked(c)) || shop.pos) : [h.pos[0], h.pos[1]];
  h.pos = [...spot]; h.fpos = [...spot]; h.path = []; h.move = null; h.goal = null;   // 釘在店鋪工作位，不會再走開
  const adj = g.grid.neighbors(spot).find(c => !g.grid.blocked(c) && !g.grid.houseAt(c)) || [spot[0] + 1, spot[1]];
  g.player.cell = [...adj]; g.player.pos = [...adj]; g.player.actor.pos = [...adj];
  g.opening = 0;   // 開場公告凍結已結束（本測試驗的是舒適機制，不是開場）
});
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

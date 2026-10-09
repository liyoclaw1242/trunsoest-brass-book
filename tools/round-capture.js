// node tools/round-capture.js <seed> <outdir> —— 跑一局（真的動手），存截圖、事件、規則書、status。
import { writeFileSync, mkdirSync } from 'node:fs';
import { open } from './pw.js';
const seed = process.argv[2] || 'round2', DIR = process.argv[3] || 'docs/playtest/round-2';
mkdirSync(DIR, { recursive: true });
const pw = await open({ url: `http://localhost:5173/?autostart&seed=${seed}` });
const shot = n => pw.shot(DIR, n);
const until = async (fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
const adj = async (cell) => { const spot = await pw.eval(c => { const g = window.__game.game; for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) { const a=[c[0]+d[0],c[1]+d[1]]; if(!g.grid.blocked(a)&&g.grid.inRange(a)) return a; } return null; }, cell); return spot; };
const doV = async (verb, pred) => { const o = await pw.options(); const i = o.findIndex(x => x.verb === verb && (!pred || pred(x))); return i >= 0 ? pw.act(i) : null; };
await until(async () => (await pw.status()).opening === 0, 8);
await shot('01-start');
// 砸最近的廣播器（從相鄰格）
const sp = await pw.eval(() => { const g = window.__game.game; const s = [...g.world.objects.values()].find(o => o.type === 'speaker'); return { id: s.id, pos: s.pos }; });
let spot = await adj(sp.pos); if (spot) { await pw.goto(spot); await pw.eval((c) => { const g=window.__game.game; g.player.facing=[c[0]-g.player.cell[0],c[1]-g.player.cell[1]]; }, sp.pos); await doV('break', x => x.target === sp.id); }
await pw.wait(3); await shot('02-after-break');
// 接受一個舒適（把一個 half 村民挪到旁邊）
await pw.eval(() => { const g = window.__game.game; const h = g.villagers.find(v => v.level === 'half' && !v.dead); if (h) { h.pos = [g.player.cell[0]+1, g.player.cell[1]]; h.fpos=[...h.pos]; } });
await pw.face([1, 0]); await doV('accept'); await shot('03-comfort');
// 喚醒：拿村民信物還給他（找地上的信物）
const ks = await pw.eval(() => { const g = window.__game.game; const k = [...g.world.objects.values()].find(o => o.type === 'keepsake' && o.pos); return k ? { id: k.id, pos: k.pos, owner: k.owner } : null; });
if (ks) { const sp2 = await adj(ks.pos); if (sp2) { await pw.goto(sp2); await pw.eval(c=>{const g=window.__game.game;g.player.facing=[c[0]-g.player.cell[0],c[1]-g.player.cell[1]];}, ks.pos); await doV('take', x=>x.target===ks.id); } }
await shot('04-took-keepsake');
await pw.eval(() => window.__game.designer(true)); await pw.wait(0.3); await shot('05-designer');
// 推到後期看定義類
await pw.eval(() => window.__game.setActivity(78)); await pw.wait(4); await shot('06-late');
const st = await pw.status();
writeFileSync(`${DIR}/status.json`, JSON.stringify(st, null, 1));
writeFileSync(`${DIR}/rulebook.json`, JSON.stringify(await pw.eval(() => window.__game.rules()), null, 1));
writeFileSync(`${DIR}/events.txt`, (await pw.log()).map(e => `[${e.t.toFixed(1)}s] ${e.type}\t${e.text}`).join('\n'));
console.log('captured', DIR, 'activity', st.activity, 'stage', st.stage, 'assim', st.assim, 'comforts', JSON.stringify(st.comforts), 'rules', st.rules, 'awakened', st.villagers.filter(v=>v.level==='awake').length);
await pw.close();

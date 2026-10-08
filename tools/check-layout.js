// node tools/check-layout.js —— 對照 docs/scene-spec.md「村子的佈局要求」檢查 public/scene.json，並印 ASCII 地圖。
//  1. 廣播覆蓋大部分村子，但至少兩塊聽不到的角落（範圍內、面積 ≥ 12 格的連通安靜區）
//  2. 信物、公告牌、通往邊界的路在廣播範圍內
//  3. 從中心到邊界至少三條「不同」路線（兩兩共用格子 < 30%）
//  4. 從中心出發、全程不進任何廣播範圍（出生點所在的廣播器除外），不能走到邊界
import { readFileSync } from 'node:fs';
import { Grid, dist } from '../engine/grid.js';

const scene = JSON.parse(readFileSync(process.argv[2] || 'public/scene.json', 'utf8'));
const meta = JSON.parse(readFileSync('public/scene.meta.json', 'utf8'));
const grid = new Grid(scene.filter(o => o.pos), { roads: meta.roads || [] });
const speakers = scene.filter(o => o.type === 'speaker');
const inB = (p, except = null) => speakers.some(s => s.id !== except && dist(s.pos, p) <= s.radius);
const inside = p => grid.inRange(p), outside = p => !grid.inRange(p);
const start = meta.start;
const fails = [], notes = [];
const K = (x, y) => `${x},${y}`;

// 1. 覆蓋率與安靜角落
let total = 0, covered = 0; const quiet = new Set();
for (let x = grid.min[0]; x <= grid.max[0]; x++) for (let y = grid.min[1]; y <= grid.max[1]; y++) {
  const p = [x, y]; if (!inside(p) || grid.blocked(p)) continue;
  total++; if (inB(p)) covered++; else quiet.add(K(x, y));
}
const seen = new Set(), pockets = [];
for (const k of quiet) {
  if (seen.has(k)) continue;
  const q = [k.split(',').map(Number)], cells = []; seen.add(k);
  while (q.length) { const c = q.pop(); cells.push(c); for (const n of grid.neighbors(c)) { const nk = K(...n); if (quiet.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(n); } } }
  pockets.push(cells);
}
const big = pockets.filter(p => p.length >= 12);
notes.push(`廣播覆蓋 ${covered}/${total} 格（${Math.round(covered / total * 100)}%），聽不到的連通區 ${pockets.length} 塊，其中 ≥12 格的 ${big.length} 塊：${big.map(p => `${p.length}格@(${p[0]})`).join('、')}`);
if (big.length < 2) fails.push('聽不到的角落不足兩塊');
if (covered / total < 0.6) fails.push('廣播覆蓋不到六成');

// 2. 關鍵位置在廣播範圍內
for (const o of scene.filter(o => o.type === 'keepsake' || o.type === 'notice' || o.type === 'clothes' || o.type === 'lamp')) if (!inB(o.pos)) fails.push(`${o.id} 不在廣播範圍內`);

// 3. 三條不同路線：對每個界石方向找最短路，取兩兩重疊 < 30% 的
const routes = [];
const bounds = scene.filter(o => o.type === 'boundary');
for (const b of bounds) {
  const goal = [b.pos[0] + Math.sign(b.pos[0] - grid.center()[0]), b.pos[1] + Math.sign(b.pos[1] - grid.center()[1])];
  const p = grid.path(start, goal);
  if (p) routes.push({ via: b.id, cells: new Set(p.map(c => K(...c))), path: p });
}
const distinct = [];
for (const r of routes) {
  if (distinct.every(d => { let s = 0; for (const c of r.cells) if (d.cells.has(c)) s++; return s / Math.min(r.cells.size, d.cells.size) < 0.3; })) distinct.push(r);
}
notes.push(`中心到邊界可達路線 ${routes.length} 條，互不重疊（<30%）的 ${distinct.length} 條：${distinct.map(r => `${r.via}(${r.path.length}步)`).join('、')}`);
if (distinct.length < 3) fails.push('中心到邊界不同路線不足三條');
// 2b. 通往邊界的路在廣播範圍內：每條不同路線至少一半的格子在範圍內
for (const r of distinct) { const n = r.path.filter(c => inB(c)).length; if (n / r.path.length < 0.4) fails.push(`${r.via} 這條路只有 ${n}/${r.path.length} 格在廣播範圍內`); }

// 4. 安靜路線（出生點那台廣播器除外）
const startSpk = speakers.filter(s => dist(s.pos, start) <= s.radius).map(s => s.id);
const quietOnly = c => !grid.blocked(c) && !startSpk.some(id => true) ? true : !grid.blocked(c) && !inB(c, startSpk[0]);
const r4 = grid.minCost(start, outside, c => inB(c, startSpk[0]));
notes.push(`出生點在 ${startSpk.join(',') || '（無）'} 範圍內；排除它之後，從中心走到範圍外至少要經過 ${r4 ? r4.cost : '∞'} 格廣播範圍`);
if (r4 && r4.cost === 0) fails.push('存在全程不進廣播範圍的逃脫路線');
// 也算「完全不排除」的版本給參考
const r4b = grid.minCost(start, outside, c => inB(c));
notes.push(`不排除任何廣播器：至少經過 ${r4b ? r4b.cost : '∞'} 格廣播範圍`);

// ASCII 地圖：# 擋路、~ 廣播範圍、. 安靜、o 範圍外、S 出生點、K 信物、N 公告牌、V 村民、B 書
const rows = [];
for (let y = grid.max[1]; y >= grid.min[1]; y--) {
  let row = '';
  for (let x = grid.min[0]; x <= grid.max[0]; x++) {
    const p = [x, y]; let ch;
    const o = scene.find(o => o.pos && o.pos[0] === x && o.pos[1] === y && !['house', 'lectern'].includes(o.type));
    if (o?.type === 'book') ch = 'B'; else if (o?.type === 'keepsake') ch = 'K'; else if (o?.type === 'notice') ch = 'N';
    else if (o?.type === 'villager') ch = 'V'; else if (o?.type === 'outsider') ch = 'S'; else if (o?.type === 'speaker') ch = 'A';
    else if (o?.type === 'boundary') ch = '+'; else if (o?.type === 'door') ch = 'D'; else if (o?.type === 'cart') ch = 'C';
    else if (r4 && r4.cost === 0 && r4.path.some(c => c[0] === x && c[1] === y)) ch = '*';
    else if (o?.type === 'lamppost') ch = 'L'; else if (o?.type === 'clothes') ch = 'W'; else if (o?.type === 'lamp') ch = 'l';
    else if (grid.blocked(p)) ch = '#'; else if (!inside(p)) ch = ' '; else if (inB(p)) ch = (grid.zone(p) === 'road' ? '=' : '~'); else ch = (grid.zone(p) === 'road' ? '-' : '.');
    row += ch;
  }
  rows.push(row);
}
console.log(rows.join('\n'));
for (const n of notes) console.log('INFO', n);
for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? `佈局檢查失敗：${fails.length} 項` : '佈局檢查通過');
process.exit(fails.length ? 1 : 0);

// node tools/puzzle-verify.js —— BFS 驗證每一關可解、印出最短解長度，避免出不可解或有 bug 的關。
import { Puzzle } from '../src/puzzle/game.js';
import { LEVELS } from '../src/puzzle/levels.js';
const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
function solve(level) {
  const p = new Puzzle(level);
  const start = p.snapshot();
  const seen = new Set([start]);
  let frontier = [[start, '']]; let depth = 0;
  const CAP = 800000;
  while (frontier.length && depth < 90) {
    if (seen.size > CAP) return { ok: false, explored: seen.size, capped: true };
    const next = [];
    for (const [s, path] of frontier) {
      for (const [k, d] of Object.entries(DIRS)) {
        p.restore(s); p.won = false;
        const r = p.move(d);
        if (!r.moved) continue;
        if (p.lost) continue;                 // 書將軍＝死局，這條路不通
        const ns = p.snapshot();
        if (p.won) return { ok: true, len: path.length + 1, path: path + k, explored: seen.size };
        if (!seen.has(ns)) { seen.add(ns); next.push([ns, path + k]); }
      }
    }
    frontier = next; depth++;
  }
  return { ok: false, explored: seen.size };
}
let allok = true;
for (const lv of LEVELS) {
  if (lv.chapter === 'village') { console.log(`SKIP  ${lv.name} — 開放大地圖，改用 tools/village-verify.js 腳本雙線驗證`); continue; }
  const r = solve(lv);
  if (r.ok) console.log(`PASS  ${lv.name} — 最短解 ${r.len} 步（探索 ${r.explored} 狀態）：${r.path}`);
  else { console.log(`FAIL  ${lv.name} — 找不到解（探索 ${r.explored} 狀態）`); allok = false; }
}
console.log(allok ? '所有關卡可解' : '有關卡不可解');
process.exit(allok ? 0 : 1);

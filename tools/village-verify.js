// node tools/village-verify.js —— 開放大地圖「烏托邦」的腳本驗證：
// 用尋路（walkTo）＋目標動作（取物／推字入洞／砍樹／鑿牆／開門）跑完兩條出路，並檢反例（跳關不成立）。
// 大地圖動件多、超出 BFS 上限，故以此取代窮舉；座標對應 levels.js 內 chapter:'village' 的地圖。
import { Puzzle } from '../src/puzzle/game.js';
import { LEVELS } from '../src/puzzle/levels.js';

const level = LEVELS.find(l => l.chapter === 'village');
if (!level) { console.error('找不到 village 關卡'); process.exit(1); }

const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
function passable(p, x, y) {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false;
  const k = x + ',' + y;
  if (p.wall(x, y) || p.water.has(k) || p.cave.has(k) || p.fire.has(k)) return false;
  if (p.sanctum.has(k) && p.enterForbidden()) return false;
  const o = p.at(x, y);
  if (!o) return true;
  return ['name', 'clothes', 'axe', 'key', 'exit', 'wilddeep', 'shed'].includes(o.type);
}
function path(p, tx, ty) {
  const q = [[p.pos[0], p.pos[1]]], prev = { [p.pos.join(',')]: null };
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) { const out = []; let c = x + ',' + y; while (prev[c]) { out.push(prev[c].d); c = prev[c].p; } return out.reverse(); }
    for (const [k, [dx, dy]] of Object.entries(DIRS)) { const nx = x + dx, ny = y + dy, nk = nx + ',' + ny; if (!(nk in prev) && passable(p, nx, ny)) { prev[nk] = { p: x + ',' + y, d: k }; q.push([nx, ny]); } }
  }
  return null;
}
const walkTo = (p, tx, ty) => { const pa = path(p, tx, ty); if (!pa) return false; for (const k of pa) if (!p.move(DIRS[k]).moved) return false; return true; };
const act = (p, tx, ty) => { for (const [sx, sy, d] of [[tx - 1, ty, 'R'], [tx + 1, ty, 'L'], [tx, ty - 1, 'D'], [tx, ty + 1, 'U']]) if (passable(p, sx, sy)) { if (!walkTo(p, sx, sy)) continue; if (p.move(DIRS[d]).moved || p.won) return true; } return false; };
const pushInto = (p, tx, ty, dir) => { const [dx, dy] = DIRS[dir]; if (!walkTo(p, tx - dx, ty - dy)) return false; return p.move(DIRS[dir]).moved; };

const shared = p => walkTo(p, 5, 3) && pushInto(p, 6, 4, 'R') && pushInto(p, 7, 4, 'R') && pushInto(p, 8, 4, 'R')
  && act(p, 15, 3) && pushInto(p, 11, 5, 'D') && act(p, 14, 7);   // 名→聖所取斧→改寫樹→砍林

function routeB() { const p = new Puzzle(level); shared(p); pushInto(p, 13, 9, 'U'); act(p, 16, 9); walkTo(p, 1, 1); return p.won; }
function routeA() { const p = new Puzzle(level); shared(p); walkTo(p, 15, 10); walkTo(p, 9, 11); p.move(DIRS.D); p.move(DIRS.D); walkTo(p, 1, 1); return p.won; }
function negChop() { const p = new Puzzle(level); walkTo(p, 5, 3); pushInto(p, 6, 4, 'R'); pushInto(p, 7, 4, 'R'); pushInto(p, 8, 4, 'R'); return walkTo(p, 13, 9); } // 不砍樹能否進內院
function negSanctum() { const p = new Puzzle(level); pushInto(p, 6, 4, 'R'); pushInto(p, 7, 4, 'R'); pushInto(p, 8, 4, 'R'); return walkTo(p, 15, 3); } // 不領名能否取斧

const b = routeB(), a = routeA(), nc = negChop(), ns = negSanctum();
console.log(`${b ? 'PASS' : 'FAIL'}  甲路（鑰匙→大門）… route A=${a ? 'PASS' : 'FAIL'}`);
console.log(`${b ? 'PASS' : 'FAIL'}  乙路（改寫圍牆→鑿牆）route B=${b ? 'PASS' : 'FAIL'}`);
console.log(`${!nc ? 'PASS' : 'FAIL'}  反例：不砍樹進不了內院（應 true=進不去）→ 進得去?${nc}`);
console.log(`${!ns ? 'PASS' : 'FAIL'}  反例：不領名取不到斧（應 true=取不到）→ 取得到?${ns}`);
const ok = a && b && !nc && !ns;
console.log(ok ? '烏托邦：兩條出路皆可通、反例皆成立' : '烏托邦：驗證未過');
process.exit(ok ? 0 : 1);

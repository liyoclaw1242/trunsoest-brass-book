// tools/solver.js —— 巨觀動作求解器（macro-action planner）。
// 不逐格暴搜，而是以「走到某處並做一個互動」為一步：分支＝可及邊界的互動數、深度＝拉桿次數，
// 故同一套能解 7×5 小關，也能解 19×15 大地圖。每個動作都用真正的引擎執行，語意一致、無重複實作。
// 侷限：對「時間壓力」機制（追逐者／火／步數上限／活書）只試每個目標的最短路，可能漏掉需精準踩點的解；
//      但凡求得的解都是真解（sound）。目前關卡無時間壓力，為完備。
import { Puzzle } from '../src/puzzle/game.js';

const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

// 玩家可「直接走過」的格（非互動）：空地、開著的門、荒野、（可進入時的）聖所。其餘皆為互動目標或障礙。
function walkThrough(p, x, y) {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false;
  const k = x + ',' + y;
  if (p.wall(x, y) || p.water.has(k) || p.cave.has(k) || p.fire.has(k)) return false;
  if (p.sanctum.has(k) && p.enterForbidden()) return false;
  const o = p.at(x, y);
  if (!o) return true;
  if (o.type === 'wilddeep') return true;
  if (o.type === 'door' && o.state === 'open') return true;
  return false;   // 物品/出口/字塊/樹/牆/關著的門… 當作互動目標，不穿越
}
// 從玩家位置泛洪可走格；回傳 {set, prev}（prev 供還原路徑）
function flood(p) {
  const start = p.pos.join(','), set = new Set([start]), prev = { [start]: null }, q = [[p.pos[0], p.pos[1]]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
      if (!(nk in prev) && walkThrough(p, nx, ny)) { prev[nk] = { k: x + ',' + y, d }; set.add(nk); q.push([nx, ny]); }
    }
  }
  return { set, prev };
}
function pathTo(prev, tx, ty) {
  const out = []; let c = tx + ',' + ty;
  while (prev[c]) { out.push(prev[c].d); c = prev[c].k; }
  return out.reverse();
}
// 列出目前可做的巨觀動作：對可及區域的每個邊界（走到 A、朝 d 踏向目標格）。回傳 {acts, prev}（prev 供還原路徑，省一次泛洪）。
function macroActions(p) {
  const { set, prev } = flood(p);
  const acts = [];
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nk = (x + dx) + ',' + (y + dy);
      if (!set.has(nk) && !p.wall(x + dx, y + dy)) acts.push([x, y, d]);   // 邊界：目標格不可直接走過
    }
  }
  return { acts, prev };
}
// 執行一個巨觀動作：先走到 (ax,ay)，再朝 d 踏一步（互動）。prev 須為「目前狀態」的泛洪結果。
function applyMacro(p, [ax, ay, d], prev) {
  for (const step of pathTo(prev, ax, ay)) if (!p.move(DIRS[step]).moved) return { moved: false };
  return p.move(DIRS[d]);
}

/**
 * 巨觀求解。opts:{cap=200000, graph=false}
 * 回傳 { ok, steps, actions, states, capped, graph? }；graph={start, adj:Map(state->[{to,act}]), wins:Set, reach:Set}
 */
// 有時間壓力的關卡（步數上限／活書／即時對手／火／追逐者），turn 才算進狀態；否則剝掉 turn 讓「浪費回合」的局面收斂（避免無限狀態）。
function timed(level) {
  return level.deadline != null || level.livingBook || level.reactiveBook
    || level.map.some(r => r.includes('^') || r.includes('Z'));
}
export function solveMacro(level, opts = {}) {
  const cap = opts.cap ?? 200000;
  const p = new Puzzle(level);
  const isTimed = timed(level);
  const TKEYS = ['turn', 'bookIdx', 'penRule', 'penWord', 'penAnchor', 'penDir'];
  const keyOf = s => { if (isTimed) return s; const d = JSON.parse(s); for (const k of TKEYS) delete d[k]; return JSON.stringify(d); };
  const start = p.snapshot(), startK = keyOf(start);
  const full = new Map([[startK, start]]);        // key -> 可還原的完整快照
  const prevState = new Map([[startK, null]]);     // key -> {from:key, act}
  const adj = opts.graph ? new Map() : null;
  const wins = new Set();
  let frontier = [startK], depth = 0, explored = 1;
  const reconstruct = k => { const out = []; let c = k; while (prevState.get(c)) { out.push(prevState.get(c).act); c = prevState.get(c).from; } return out.reverse(); };
  while (frontier.length && depth < 400) {
    const next = [];
    for (const sk of frontier) {
      p.restore(full.get(sk)); p.won = false; p.lost = false;
      const { acts, prev } = macroActions(p);
      if (adj && !adj.has(sk)) adj.set(sk, []);
      for (const a of acts) {
        p.restore(full.get(sk)); p.won = false; p.lost = false;
        const r = applyMacro(p, a, prev);
        if (!r.moved) continue;
        const ns = p.snapshot(), nk = keyOf(ns);
        if (p.won) {
          wins.add(nk);
          if (adj) { adj.get(sk).push({ to: nk, act: a }); if (!adj.has(nk)) adj.set(nk, []); }
          if (!prevState.has(nk)) { prevState.set(nk, { from: sk, act: a }); full.set(nk, ns); }
          if (!opts.graph) return { ok: true, steps: reconstruct(nk).length, actions: reconstruct(nk), states: explored, capped: false };
          continue;
        }
        if (p.lost) continue;
        if (adj) adj.get(sk).push({ to: nk, act: a });
        if (!prevState.has(nk)) {
          prevState.set(nk, { from: sk, act: a }); full.set(nk, ns); explored++; next.push(nk);
          if (explored > cap) return { ok: wins.size > 0, steps: null, states: explored, capped: true, graph: adj ? { start: startK, adj, wins, reach: new Set(prevState.keys()) } : undefined };
        }
      }
    }
    frontier = next; depth++;
  }
  const ok = wins.size > 0;
  let best = null;
  if (ok) for (const w of wins) { const len = reconstruct(w).length; if (best == null || len < best.len) best = { len, w }; }
  return { ok, steps: ok ? best.len : null, actions: ok ? reconstruct(best.w) : null, states: explored, capped: false, graph: adj ? { start: startK, adj, wins, reach: new Set(prevState.keys()) } : undefined };
}

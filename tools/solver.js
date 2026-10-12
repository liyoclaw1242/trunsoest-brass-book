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
  p.history.length = 0;   // 求解不需 undo 歷史；清掉以免 move() 每步塞快照、跨百萬次重放累積成記憶體洩漏
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
const TKEYS = ['turn', 'bookIdx', 'penRule', 'penWord', 'penAnchor', 'penDir'];
export function solveMacro(level, opts = {}) {
  const cap = opts.cap ?? 60000;   // 省記憶體：無解的關會探索整個可達空間（多動件會爆），上限壓低；可解關通常很快就找到解
  const p = new Puzzle(level);
  if (opts.fromSnap) { p.restore(opts.fromSnap); p.won = false; p.lost = false; }
  const isTimed = timed(level);
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

// —— soft-lock 偵測（關鍵資源分析）——
// 想法：soft-lock＝不可逆地毀掉了必要資源。對每個「可被摧毀的」字塊/物件，假設它從一開始就沒了，重解一次；
// 若因此無解＝它是「關鍵資源」。地圖上若又有摧毀地形（洞穴🕳️/火🔥/河🌊，把東西推進去就永久消失），
// 這個關鍵資源就有被推進去而無法挽回的風險＝潛在 soft-lock。便宜（#可推件 次求解）、省記憶體、能分辨「備品 vs 必需」。
// 註：這是「該資源不可或缺」的充分判定；「玩家是否真能把它推進摧毀地形」是另一層（可逆推動可達性），
//     列為風險提示讓設計者確認／擋住，寧可多報不可漏報。
const PUSH_TYPES = new Set(['goat', 'speaker', 'book', 'villager', 'rock']);
// 其他物件（第 except 件除外）的位置/存滅指紋——用來把搜尋限制成「只有這一件（與玩家）在動」。
function objFP(p, except) { let s = ''; for (let i = 0; i < p.objs.length; i++) { if (i === except) continue; const o = p.objs[i]; s += o.x + ',' + o.y + ',' + (o.gone ? 1 : 0) + ',' + (o.word || '') + ';'; } return s; }
// 可達性精算：玩家「只動第 idx 件」（其餘不碰），能否把它推進某摧毀地形、且之後真的無解？能＝真 soft-lock。
function strandable(level, idx) {
  const p = new Puzzle(level);
  const isTimed = timed(level);
  const keyOf = s => { if (isTimed) return s; const d = JSON.parse(s); for (const k of TKEYS) delete d[k]; return JSON.stringify(d); };
  const baseFP = objFP(p, idx), start = p.snapshot();
  const seen = new Set([keyOf(start)]); let frontier = [start], depth = 0;
  while (frontier.length && depth < 80) {
    const next = [];
    for (const s of frontier) {
      p.restore(s); p.won = false; p.lost = false;
      const { acts, prev } = macroActions(p);
      for (const a of acts) {
        p.restore(s); p.won = false; p.lost = false;
        const r = applyMacro(p, a, prev);
        if (!r.moved || p.won) continue;
        if (objFP(p, idx) !== baseFP) continue;              // 只許該件（與玩家）動，其餘保持原狀
        const ns = p.snapshot(), nk = keyOf(ns);
        if (seen.has(nk)) continue; seen.add(nk);
        if (p.objs[idx].gone) { if (!solveMacro(level, { fromSnap: ns }).ok) return true; continue; }  // 被摧毀後真的無解
        next.push(ns);
      }
    }
    frontier = next; depth++;
  }
  return false;
}
export function analyzeSoftlock(level) {
  const base = solveMacro(level);
  if (!base.ok) return { ok: false, note: '關卡本身就無解' };
  const hasDestroyer = level.map.some(r => /[O^~]/.test(r));   // 洞穴/火/河
  if (!hasDestroyer) return { ok: true, hasDestroyer: false, traps: [] };
  const p0 = new Puzzle(level);
  const start = p0.snapshot();
  const traps = [];
  p0.objs.forEach((o, i) => {
    if (o.gone) return;
    const pushable = o.type === 'tile' ? !o.fixed : PUSH_TYPES.has(o.type);
    if (!pushable) return;
    const d = JSON.parse(start); d.objs[i][2] = 1;            // 先便宜篩：這件若不存在是否就無解（必要資源）
    if (solveMacro(level, { fromSnap: JSON.stringify(d) }).ok) return;
    if (strandable(level, i)) traps.push(o.type === 'tile' ? `字塊「${o.word}」@(${o.x},${o.y})` : `${o.type}@(${o.x},${o.y})`);  // 再精算：真能被推去摧毀而卡死
  });
  return { ok: true, hasDestroyer, traps };
}

// —— 挑戰度指標 —— 量「決策密度」而非面積。
// 沿著最短解走，每一步看有幾個「有意義」的不同後續（會改變生效法集／耗資源／得物／獲勝）；
// 純線性關卡鏈每步只有 1 個 → 0 個抉擇點。另算「互動法對」（彼此共用名詞/動詞、會組合或衝突的法）。
function lawsHash(p) { return p.laws.map(l => l.text || (l.who + '/' + l.mode + '/' + l.verb + '/' + (l.toNoun || l.target || ''))).sort().join('§'); }
function meaningSig(p) { let g = 0; for (const o of p.objs) if (o.gone) g++; return lawsHash(p) + '#' + g + '#' + p.water.size + '#' + (p.voided ? 1 : 0) + '#' + p.has.size; }
export function challengeMetrics(level) {
  const base = solveMacro(level);
  if (!base.ok) return { ok: false };
  const p = new Puzzle(level);
  let snap = p.snapshot(), D = 0, maxOpts = 0, totalOpts = 0;
  for (const act of base.actions) {
    p.restore(snap); p.won = false; p.lost = false;
    const cur = meaningSig(p);
    const { acts, prev } = macroActions(p);
    const sigs = new Set();
    for (const a of acts) {
      p.restore(snap); p.won = false; p.lost = false;
      const r = applyMacro(p, a, prev); if (!r.moved) continue;
      const s = p.won ? 'WIN' : meaningSig(p);
      if (s !== cur) sigs.add(s);
    }
    const opts = sigs.size; totalOpts += opts; if (opts > maxOpts) maxOpts = opts; if (opts >= 2) D++;
    // 依最短解前進一步
    p.restore(snap); p.won = false; p.lost = false;
    const { prev: pv } = macroActions(p); applyMacro(p, act, pv); snap = p.snapshot();
  }
  return { ok: true, L: base.actions.length, decisions: D, maxOpts, avgOpts: +(totalOpts / Math.max(1, base.actions.length)).toFixed(2) };
}

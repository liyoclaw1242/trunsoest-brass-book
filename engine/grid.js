// grid.js —— 從 scene.json 推出格子地圖：哪些格子擋路、住宅的室內與門、影響範圍。
// 純邏輯，畫面端與村民尋路都用這一份，避免兩邊對不上。

const key = (x, y) => `${x},${y}`;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 住宅佔地：x-2..x+1、y-2..y+1；室內 x-1..x、y-1..y；門洞 (x, y-2)。 */
export function houseCells(h) {
  const [x, y] = h.pos, walls = [], interior = [];
  for (let i = x - 2; i <= x + 1; i++) for (let j = y - 2; j <= y + 1; j++) {
    const inside = i >= x - 1 && i <= x && j >= y - 1 && j <= y;
    if (inside) interior.push([i, j]);
    else if (!(i === x && j === y - 2)) walls.push([i, j]);
  }
  return { walls, interior, door: [x, y - 2], front: [x, y - 3] };
}

export class Grid {
  /** @param objects  scene.json 的陣列，或 World.objects（Map）——只讀 type/pos/state */
  constructor(objects, opt = {}) {
    this.objects = objects instanceof Map ? objects : new Map(objects.map(o => [o.id, o]));
    this.roads = opt.roads || [];          // [[x0,y0,x1,y1], ...] 村道矩形；其餘是野地。沒有村道資料時全部算村道。
    this.plaza = opt.plaza || null;        // [x0,y0,x1,y1] 廣場
    this.wildDeep = opt.wildDeep || null;  // [x0,y0,x1,y1] 荒野深處（放逐結局）
    const book = [...this.objects.values()].find(o => o.type === 'book');
    this.radius = opt.radius ?? book?.radius ?? 20;
    const margin = opt.margin ?? 10;
    const c = book?.pos || [0, 0];
    this.min = [Math.max(0, Math.floor(c[0] - this.radius - margin)), Math.max(0, Math.floor(c[1] - this.radius - margin))];
    this.max = [Math.ceil(c[0] + this.radius + margin), Math.ceil(c[1] + this.radius + margin)];
    this.houses = new Map();   // houseId -> { walls, interior, door, front }
    this.cellHouse = new Map(); // "x,y" -> houseId（室內格）
    for (const o of this.objects.values()) if (o.type === 'house' || o.type === 'library') {
      const hc = houseCells(o); this.houses.set(o.id, hc);
      for (const c of hc.interior) this.cellHouse.set(key(...c), o.id);
    }
  }
  /** 影響範圍的圓心：書現在的位置（被拿在手上時用拿的人的位置，畫面端自行寫入 book.pos）。 */
  center() { const b = [...this.objects.values()].find(o => o.type === 'book'); return b?.pos || [0, 0]; }
  inRange(pos) { return dist(pos, this.center()) <= this.radius; }
  inBounds([x, y]) { return x >= this.min[0] && y >= this.min[1] && x <= this.max[0] && y <= this.max[1]; }
  houseAt(pos) { return this.cellHouse.get(key(...pos)) || null; }
  /** 'road' 村道（含住宅與其門前）或 'wild' 野地。 */
  zone([x, y]) {
    const inRect = ([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (this.wildDeep && inRect(this.wildDeep)) return 'wilddeep';
    if (this.plaza && inRect(this.plaza)) return 'plaza';
    if (!this.roads.length) return 'road';
    if (this.houseAt([x, y])) return 'road';
    for (const o of this.objects.values()) if (o.type === 'house') { const [hx, hy] = o.pos; if (x >= hx - 3 && x <= hx + 2 && y >= hy - 4 && y <= hy + 2) return 'road'; }
    return this.roads.some(inRect) ? 'road' : 'wild';
  }

  /** 這一格現在擋不擋路（不含角色）。 */
  blocked(pos) {
    const [x, y] = pos;
    if (!this.inBounds(pos)) return true;
    for (const o of this.objects.values()) {
      if (!o.pos) continue;
      switch (o.type) {
        case 'house': case 'library': {
          const hc = this.houses.get(o.id);
          if (hc.walls.some(c => c[0] === x && c[1] === y)) return true;
          break;
        }
        case 'door': if (o.pos[0] === x && o.pos[1] === y && o.state === 'closed') return true; break;
        case 'fence': if (o.pos[0] === x && o.pos[1] === y && o.state === 'intact') return true; break;
        case 'boundary': if (o.pos[0] === x && o.pos[1] === y && o.state !== 'toppled') return true; break;   // 推倒的界石不擋路（留出缺口）
        case 'lectern': case 'speaker': case 'notice': case 'lamppost':
        case 'workstation': case 'well': case 'census': case 'carved-stone':
        case 'granary': case 'shop': case 'post':
          if (o.pos[0] === x && o.pos[1] === y) return true; break;
      }
    }
    return false;
  }
  /** 從 a 走到相鄰格 b 要不要經過什麼（門、進屋）。回傳 { ok, enterHouse, fence }。 */
  step(a, b) {
    const ha = this.houseAt(a), hb = this.houseAt(b);
    const fence = [...this.objects.values()].find(o => o.type === 'fence' && o.pos && o.pos[0] === b[0] && o.pos[1] === b[1] && o.state === 'intact');
    return { ok: !this.blocked(b), enterHouse: hb && hb !== ha ? hb : null, leaveHouse: ha && ha !== hb ? ha : null, fence: fence ? fence.id : null };
  }
  neighbors([x, y]) { return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]; }

  /**
   * BFS 尋路。passable(cell, from) 可覆寫（村民不能進別人家等）。回傳路徑（不含起點）或 null。
   * opt.maxCost 限制搜尋範圍。
   */
  path(from, to, passable = null, opt = {}) {
    const ok = passable || ((c) => !this.blocked(c));
    const start = key(...from), goal = key(...to);
    if (start === goal) return [];
    const prev = new Map([[start, null]]);
    const q = [from];
    const limit = opt.maxCost ?? 4000;
    let n = 0;
    while (q.length && n++ < limit) {
      const cur = q.shift();
      for (const nb of this.neighbors(cur)) {
        const k = key(...nb);
        if (prev.has(k) || !this.inBounds(nb)) continue;
        if (k !== goal && !ok(nb, cur)) continue;
        if (k === goal && !ok(nb, cur) && !opt.goalMayBlock) continue;
        prev.set(k, cur);
        if (k === goal) {
          const out = []; let c = nb;
          while (c && key(...c) !== start) { out.push(c); c = prev.get(key(...c)); }
          return out.reverse();
        }
        q.push(nb);
      }
    }
    return null;
  }
  /** 0-1 BFS：每走進一格「代價格」+1。給佈局檢查用（例如「經過幾格廣播範圍」）。 */
  minCost(from, isGoal, costOf, passable = null) {
    const ok = passable || ((c) => !this.blocked(c));
    const best = new Map([[key(...from), 0]]), prev = new Map();
    const dq = [from];
    while (dq.length) {
      const cur = dq.shift();
      const d = best.get(key(...cur));
      if (isGoal(cur)) {
        const path = []; let c = cur;
        while (c) { path.push(c); c = prev.get(key(...c)); }
        return { cost: d, cell: cur, path: path.reverse() };
      }
      for (const nb of this.neighbors(cur)) {
        if (!this.inBounds(nb) || !ok(nb, cur)) continue;
        const nd = d + (costOf(nb) ? 1 : 0);
        const k = key(...nb);
        if (nd < (best.get(k) ?? Infinity)) { best.set(k, nd); prev.set(k, cur); if (nd === d) dq.unshift(nb); else dq.push(nb); }
      }
    }
    return null;
  }
}

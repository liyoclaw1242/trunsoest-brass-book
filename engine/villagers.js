// villagers.js —— 村民的純邏輯：巡邏、追捕、絕不違反認知到的規則、不離開影響範圍、誘導、喚醒、抓捕判定。
// 不碰 DOM／three。畫面端每幀呼叫 tick(dt)，讀 actor.pos（格子）與 actor.fpos（插值後的顯示座標）。
//
// 同化程度 level：puppet（照字面執行、不能誘導）→ half（執行規則、可誘導）→ awake（站在外鄉人這邊，不執行抓捕令）。
// 喚醒：連續 quietSec 秒聽不到廣播降一級；收到自己的信物直接降一級（design.md）。
// 抓捕（使用者決定 2）：與外鄉人同格或「走得過去的相鄰格」持續 captureSec 秒 → attempt('capture', 'outsider')。
import { dist } from './grid.js';

export const LEVELS = ['puppet', 'half', 'awake'];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const K = c => `${c[0]},${c[1]}`;

export class Villagers {
  /**
   * @param world  引擎 World（角色已加入、setup 已呼叫）
   * @param grid   engine/grid.js 的 Grid
   * @param opt    stepSec 走一格秒數、chaseStepSec 追人時、boostStepSec 加速時、boostSec 加速持續、
   *               quietSec 喚醒所需的安靜秒數、captureSec 抓捕判定秒數、giveUpSec 進不去時等多久、
   *               wanderRadius 巡邏半徑、noticeDist 違規時多遠的村民會加速
   */
  constructor(world, grid, opt = {}) {
    this.world = world; this.grid = grid;
    this.opt = { stepSec: 0.3, chaseStepSec: 0.22, boostStepSec: 0.14, boostSec: 8, quietSec: 30, captureSec: 0.5, giveUpSec: 4, wanderRadius: 3, noticeDist: 14, immuneSec: 3, ...opt };
    this.rng = opt.rng || Math.random;
    this.list = [...world.actors.values()].filter(a => a.kind === 'citizen');
    for (const a of this.list) Object.assign(a, { level: a.level || 'puppet', fpos: [...a.pos], move: null, path: [], goal: null, mode: 'wander', task: null, quiet: 0, boostUntil: 0, waitUntil: 0, captureT: 0, idle: 0, repath: 0 });
    this.outsider = world.actors.get('outsider');
    this.outsider.immuneUntil = this.outsider.immuneUntil || 0;
    this.outsider.invitedTo = this.outsider.invitedTo || null;
    // 收到自己的信物 → 降一級；外鄉人違規 → 附近村民加速
    world.on('act', ({ actor, verb, target }) => {
      if (verb === 'give' && target?.type === 'keepsake' && target.heldBy && target.owner === target.heldBy) {
        const v = world.actors.get(target.heldBy); if (v && v.kind === 'citizen') this.demote(v, 'keepsake');
      }
    });
    world.on('violation', ({ actor }) => {
      if (actor.kind !== 'outsider') return;
      for (const v of this.list) if (dist(v.pos, actor.pos) <= this.opt.noticeDist) v.boostUntil = world.t + this.opt.boostSec;
    });
  }
  emit(type, data) { this.world.emit(type, data); }

  // ---------- 同化程度 ----------
  demote(v, why) {
    const i = LEVELS.indexOf(v.level); if (i >= LEVELS.length - 1) return false;
    const from = v.level; v.level = LEVELS[i + 1]; v.quiet = 0; v.task = null; v.mode = 'wander'; v.path = [];
    this.emit('level', { actor: v, from, to: v.level, why });
    return true;
  }
  promote(v, why) {
    const i = LEVELS.indexOf(v.level); if (i <= 0) return false;
    const from = v.level; v.level = LEVELS[i - 1]; v.task = null; v.mode = 'wander'; v.path = [];
    this.emit('level', { actor: v, from, to: v.level, why });
    return true;
  }
  /** 這個村民現在會不會執行抓捕令。 */
  hunts(v) { return v.level !== 'awake' && this.world.knows(v.id, 'capture') && this.world.t >= this.outsider.immuneUntil; }
  /** 可不可以誘導。 */
  inducible(v) { return v.level !== 'puppet'; }

  // ---------- 誘導 ----------
  /**
   * 給畫面端的誘導選項。kind：
   *   invite  請他邀請我進屋（回自己家門口，邀請生效）
   *   fetch   請他去拿信物（拿最近一件地上的信物來給外鄉人；條文只禁止外鄉人拿）
   *   book    請他去搬書（把黃銅書搬回自己家；書的條文若已認知會拒絕）
   */
  induceOptions(v) {
    if (!this.inducible(v)) return [];
    const out = [];
    const house = [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id);
    if (house) out.push({ kind: 'invite', label: `請${v.id === 'outsider' ? '' : '他'}邀請我進屋` });
    if ([...this.world.objects.values()].some(o => o.type === 'keepsake' && o.pos)) out.push({ kind: 'fetch', label: '請他去拿信物' });
    const book = [...this.world.objects.values()].find(o => o.type === 'book');
    if (book && book.pos && !book.heldBy && house) out.push({ kind: 'book', label: '請他去搬書' });
    return out;
  }
  induce(v, kind) {
    if (!this.inducible(v)) { this.emit('induceFail', { actor: v, kind, reason: 'puppet' }); return false; }
    const house = [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id);
    if (kind === 'invite') { v.task = { kind, house: house.id, stage: 0 }; }
    else if (kind === 'fetch') {
      const ks = [...this.world.objects.values()].filter(o => o.type === 'keepsake' && o.pos).sort((a, b) => dist(a.pos, v.pos) - dist(b.pos, v.pos))[0];
      if (!ks) return false;
      v.task = { kind, keepsake: ks.id, stage: 0 };
    } else if (kind === 'book') {
      const book = [...this.world.objects.values()].find(o => o.type === 'book');
      const c = this.world.check(v.id, 'move', book.id, {});
      if (c.violates.length) { this.emit('refuse', { actor: v, verb: 'move', target: book, rules: c.violates }); return false; }
      const hc = this.grid.houses.get(house.id);
      v.task = { kind, book: book.id, dest: hc.interior.find(c => !this.grid.blocked(c)) || hc.front, stage: 0 };
    } else return false;
    v.mode = 'task'; v.path = []; v.goal = null;
    this.emit('induce', { actor: v, kind });
    return true;
  }

  // ---------- 行走 ----------
  /** 村民能不能走進這一格（守規則、不出範圍）。 */
  passable(v, cell, from) {
    if (!this.grid.inRange(cell)) return false;
    if (this.grid.blocked(cell)) {
      // 關著的門可以開（除非規則禁止）；完好的圍籬可以翻（除非規則禁止）
      const o = [...this.world.objects.values()].find(o => o.pos && eq(o.pos, cell) && (o.type === 'door' || o.type === 'fence'));
      if (!o) return false;
      const verb = o.type === 'door' ? 'open' : 'climb';
      const c = this.world.check(v.id, verb, o.id, {});
      return c.possible && !c.violates.length;
    }
    const h = this.grid.houseAt(cell);
    if (h && h !== this.grid.houseAt(from)) {
      const house = this.world.objects.get(h);
      if (house.owner === v.id) return true;
      const c = this.world.check(v.id, 'enter', h, { uninvited: true });
      return !c.violates.length;
    }
    return true;
  }
  findPath(v, goal) {
    return this.grid.path(v.pos, goal, (c, from) => this.passable(v, c, from), { maxCost: 6000 });
  }
  /** 走路徑的下一格；回傳 'moved' | 'wait' | 'refused' | 'done' | 'blocked'。 */
  stepAlong(v) {
    if (v.move) return 'moving';
    if (!v.path.length) return 'done';
    const next = v.path[0];
    if (!this.grid.inRange(next)) { v.path = []; this.emit('edge', { actor: v }); return 'blocked'; }
    const s = this.grid.step(v.pos, next);
    if (!s.ok) {
      const o = [...this.world.objects.values()].find(o => o.pos && eq(o.pos, next) && (o.type === 'door' || o.type === 'fence'));
      if (o && o.type === 'door' && o.state === 'closed') { const r = this.world.attempt(v.id, 'open', o.id); if (!r.done) { v.path = []; return 'refused'; } return 'wait'; }
      if (o && o.type === 'fence' && o.state === 'intact') { const r = this.world.attempt(v.id, 'climb', o.id); if (!r.done) { v.path = []; return 'refused'; } }
      else { v.path = []; return 'blocked'; }
    }
    if (s.enterHouse) {
      const house = this.world.objects.get(s.enterHouse);
      if (house.owner !== v.id) {
        const r = this.world.attempt(v.id, 'enter', house.id, { uninvited: true });
        if (!r.done) { v.path = []; v.waitUntil = this.world.t + this.opt.giveUpSec; return 'refused'; }
      }
    }
    const boosted = this.world.t < v.boostUntil;
    const sec = boosted ? this.opt.boostStepSec : v.mode === 'chase' ? this.opt.chaseStepSec : this.opt.stepSec;
    v.move = { from: [...v.pos], to: next, k: 0, sec: s.fence ? sec * 2 : sec };
    v.path.shift();
    return 'moved';
  }
  goTo(v, goal) {
    if (v.goal && eq(v.goal, goal) && v.path.length) return true;
    v.goal = [...goal];
    const p = this.findPath(v, goal);
    if (!p) { v.path = []; return false; }
    v.path = p; return true;
  }
  /** 走不到目標時，退而求其次：能走到的、離目標最近的格子（例如別人家門口）。 */
  nearestReachable(v, goal) {
    let best = null, bd = Infinity;
    const seen = new Set([K(v.pos)]), q = [v.pos]; let n = 0;
    while (q.length && n++ < 1500) {
      const c = q.shift(); const d = dist(c, goal); if (d < bd) { bd = d; best = c; }
      for (const nb of this.grid.neighbors(c)) { const k = K(nb); if (!seen.has(k) && this.passable(v, nb, c)) { seen.add(k); q.push(nb); } }
    }
    return best;
  }

  // ---------- 每幀 ----------
  tick(dt) {
    const w = this.world, me = this.outsider;
    for (const v of this.list) {
      // 喚醒計時
      if (w.inBroadcast(v.pos)) v.quiet = 0; else { v.quiet += dt; if (v.quiet >= this.opt.quietSec) { this.demote(v, 'quiet'); v.quiet = 0; } }
      // 移動插值
      if (v.move) {
        v.move.k += dt / v.move.sec;
        if (v.move.k >= 1) { v.pos = [...v.move.to]; v.fpos = [...v.pos]; v.move = null; }
        else v.fpos = [v.move.from[0] + (v.move.to[0] - v.move.from[0]) * v.move.k, v.move.from[1] + (v.move.to[1] - v.move.from[1]) * v.move.k];
      }
      if (v.carrying) { const b = w.objects.get(v.carrying); b.pos = [...v.pos]; }
      // 抓捕判定（接了誘導任務的村民忙著做事，不抓人）
      if (this.hunts(v) && !v.task && this.adjacentWalkable(v.pos, me.pos)) {
        v.captureT += dt;
        if (v.captureT >= this.opt.captureSec) {
          v.captureT = 0;
          const r = w.attempt(v.id, 'capture', 'outsider');
          if (r.done) { me.immuneUntil = w.t + this.opt.immuneSec; this.emit('captured', { actor: v }); }
        }
      } else v.captureT = 0;
      // 決定模式
      if (v.task) v.mode = 'task';
      else if (this.hunts(v) && w.t >= v.waitUntil) v.mode = 'chase';
      else v.mode = 'wander';
      if (v.mode === 'chase') this.chase(v, dt);
      else if (v.mode === 'task') this.doTask(v, dt);
      else this.wander(v, dt);
    }
  }
  adjacentWalkable(a, b) {
    if (eq(a, b)) return true;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
    if (this.grid.blocked(b) || this.grid.blocked(a)) return false;
    const ha = this.grid.houseAt(a), hb = this.grid.houseAt(b);
    return ha === hb;   // 隔著牆不算；門洞格不是室內格，所以站在門洞和站在室內也不算
  }
  chase(v, dt) {
    const me = this.outsider;
    if (v.move) return;
    if ((v.repath -= dt) <= 0 || !v.path.length || (v.goal && dist(v.goal, me.pos) > 1.5)) {
      v.repath = 0.6;
      if (!this.goTo(v, me.pos)) {
        const near = this.nearestReachable(v, me.pos);
        if (near && !eq(near, v.pos)) this.goTo(v, near);
        else { v.path = []; v.waitUntil = this.world.t + this.opt.giveUpSec; this.emit('stuck', { actor: v }); return; }
      }
    }
    const r = this.stepAlong(v);
    if (r === 'refused' || r === 'blocked') v.waitUntil = this.world.t + this.opt.giveUpSec;
  }
  wander(v, dt) {
    if (v.move) return;
    if (v.path.length) { this.stepAlong(v); return; }
    if ((v.idle -= dt) > 0) return;
    v.idle = 1.5 + this.rng() * 2.5;
    const r = this.opt.wanderRadius;
    const goal = [v.home[0] + Math.round((this.rng() * 2 - 1) * r), v.home[1] + Math.round((this.rng() * 2 - 1) * r)];
    if (!this.grid.blocked(goal) && this.grid.inRange(goal) && !this.grid.houseAt(goal)) this.goTo(v, goal);
  }
  doTask(v, dt) {
    const t = v.task, w = this.world, me = this.outsider;
    if (v.move) return;
    const walkTo = goal => { if (eq(v.pos, goal)) return true; if (!v.path.length || !eq(v.goal, goal)) { if (!this.goTo(v, goal)) { const n = this.nearestReachable(v, goal); if (!n || eq(n, v.pos)) return 'fail'; this.goTo(v, n); } } const r = this.stepAlong(v); return r === 'refused' || r === 'blocked' ? 'fail' : false; };
    const fail = why => { this.emit('taskFail', { actor: v, kind: t.kind, why }); v.task = null; };
    if (t.kind === 'invite') {
      const hc = this.grid.houses.get(t.house);
      const r = walkTo(hc.front);
      if (r === 'fail') return fail('path');
      if (r === true) { me.invitedTo = t.house; this.emit('invited', { actor: v, house: t.house }); v.task = null; }
    } else if (t.kind === 'fetch') {
      const ks = w.objects.get(t.keepsake);
      if (t.stage === 0) {
        if (!ks.pos) return fail('gone');
        const r = walkTo(ks.pos); if (r === 'fail') return fail('path');
        if (r === true) { const a = w.attempt(v.id, 'take', ks.id); if (!a.done) return fail('refused'); t.stage = 1; }
      } else {
        // 走到外鄉人旁邊交給他
        if (this.adjacentWalkable(v.pos, me.pos)) { const a = w.attempt(v.id, 'give', ks.id, { to: 'outsider' }); if (!a.done) return fail('refused'); v.task = null; return; }
        const n = this.nearestReachable(v, me.pos);
        const r = n ? walkTo(n) : 'fail';
        if (r === 'fail') return fail('path');
        if (r === true && !this.adjacentWalkable(v.pos, me.pos)) { v.goal = null; }
      }
    } else if (t.kind === 'book') {
      const book = w.objects.get(t.book);
      if (t.stage === 0) {
        if (!book.pos || book.heldBy) return fail('gone');
        // 站到書旁邊
        const spots = this.grid.neighbors(book.pos).filter(c => !this.grid.blocked(c));
        const spot = spots.sort((a, b) => dist(a, v.pos) - dist(b, v.pos))[0]; if (!spot) return fail('path');
        const r = walkTo(spot); if (r === 'fail') return fail('path');
        if (r === true) { const a = w.attempt(v.id, 'move', book.id, { to: [...v.pos] }); if (!a.done) return fail('refused'); v.carrying = book.id; t.stage = 1; }
      } else {
        const r = walkTo(t.dest); if (r === 'fail') { this.dropBook(v); return fail('path'); }
        if (r === true) { this.dropBook(v); v.task = null; this.emit('bookMoved', { actor: v, pos: book.pos }); }
      }
    }
  }
  dropBook(v) { const b = this.world.objects.get(v.carrying); if (!b) return; b.pos = [...v.pos]; v.carrying = null; this.world.emit('object', { object: b, before: b.state }); }
}

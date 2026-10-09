// villagers.js —— 村民與經濟行為（v2）。純邏輯，靠 RNG（經 session 注入）。
// 追捕：認知抓捕令、非已喚醒、未被定義涵蓋的村民會追；外鄉人有「名字」舒適時，村民只在目睹違規後才追。
// 勞動：其餘時間在工作站生產、送進圖書館（working）。喚醒＝不工作。
// 傳染：5 格內目睹外鄉人違反一條該村民也認知的規則，10 秒內沒被抓 → 朝喚醒前進 1/3 級。人偶免疫。
// 定義涵蓋：村民認知到一條「外鄉人符合」的定義類條文 → 把他當市民，不追。
// 舒適：half／awake 村民會主動提供 name/clothes/house/job。山羊不受規則約束。
import { dist } from './grid.js';

export const LEVELS = ['puppet', 'half', 'awake'];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const K = c => `${c[0]},${c[1]}`;
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class Villagers {
  constructor(world, grid, opt = {}) {
    this.world = world; this.grid = grid; this.rng = opt.rng;
    this.opt = { stepSec: 0.35, chaseStepSec: 0.22, boostStepSec: 0.15, boostSec: 8, quietSec: 30, captureSec: 0.5, giveUpSec: 4,
      wanderRadius: 3, immuneSec: 3, chaseSec: 20, sight: 6, contagionDist: 5, contagionDelay: 10, contagionStep: 1 / 3, hunt: true, ...opt };
    this.list = [...world.actors.values()].filter(a => a.kind === 'citizen');
    for (const a of this.list) Object.assign(a, { level: a.level || 'puppet', fpos: [...a.pos], move: null, path: [], goal: null, mode: 'work',
      quiet: 0, boostUntil: 0, waitUntil: 0, captureT: 0, idle: 0, repath: 0, chaseUntil: 0, lastSeen: null, dead: false, progress: 0, offered: null, carrier: !!a.carrier });
    this.outsider = world.actors.get('outsider');
    this.outsider.immuneUntil = this.outsider.immuneUntil || 0;
    this.outsider.invitedTo = this.outsider.invitedTo || null;
    this.outsider.comforts = this.outsider.comforts || new Set();
    this.pendingViolations = [];   // 傳染用：{pos, rules(keys), t}
    this.goats = [...world.objects.values()].filter(o => o.type === 'goat');
    for (const g of this.goats) { g.gidle = 0; g.fpos = [...g.pos]; g.gmove = null; }
    world.on('acted', ({ actor, verb, target, ctx }) => { if (actor.id === 'outsider') this.onOutsiderAct(verb, target, ctx); });
    world.on('captured', () => { for (const pv of this.pendingViolations) pv.capturedSince = true; });
    // 收到自己的信物／鈴鐺 → 降一級（搬運者只有鈴鐺有效）
    world.on('act', ({ verb, target }) => {
      if (verb === 'give' && (target?.type === 'keepsake' || target?.type === 'bell') && target.heldBy && target.owner === target.heldBy) {
        const v = world.actors.get(target.heldBy); if (v && v.kind === 'citizen') this.demote(v, target.type === 'bell' ? 'bell' : 'keepsake');
      }
    });
    this.match = null;   // session 注入，用來查定義涵蓋與舒適
  }
  emit(type, data) { this.world.emit(type, data); }
  rand() { return this.rng ? this.rng.next() : Math.random(); }

  // ---------- 同化程度 ----------
  demote(v, why) {
    if (v.carrier && why !== 'bell') return false;   // 搬運者是純人偶，只有山羊鈴鐺喚醒得了
    const i = LEVELS.indexOf(v.level); if (i >= LEVELS.length - 1) return false;
    const from = v.level; v.level = LEVELS[i + 1]; v.quiet = 0; v.progress = 0; v.chaseUntil = 0; v.mode = 'work'; v.path = [];
    this.emit('level', { actor: v, from, to: v.level, why });
    return true;
  }
  /** 傳染：朝喚醒前進 1/3 級，滿一級就降。 */
  nudge(v) {
    if (v.level === 'puppet' ? false : true) {} // half/awake 本就偏醒；傳染主要作用在 puppet→half 以外……
    v.progress += this.opt.contagionStep;
    if (v.progress >= 1) { v.progress = 0; this.demote(v, 'contagion'); }
    else this.emit('nudge', { actor: v, progress: v.progress });
  }

  coveredByDefinition(v) {
    if (!this.match) return false;
    return this.match.definitionsCovering().some(r => v.known.has(r.no));
  }
  hasName() { return this.outsider.comforts.has('name'); }
  mayChase(v) {
    if (this.opt.hunt === false || v.level === 'awake' || v.dead || v.sleeping) return false;
    if (!this.world.knows(v.id, 'capture')) return false;
    if (this.coveredByDefinition(v)) return false;
    return true;
  }
  hunts(v) { return v.chaseUntil > 0 && this.mayChase(v) && this.world.t < v.chaseUntil; }
  sees(v) {
    if (v.dead || v.sleeping) return false;
    const me = this.outsider;
    if (this.grid.houseAt(v.pos) !== this.grid.houseAt(me.pos)) return false;
    const disguised = me.comforts.has('clothes') || me.wearing;   // 偽裝：要到相鄰格才認得出你是外鄉人
    const range = disguised ? Math.min(this.opt.sight, 1.5) : this.opt.sight;
    return dist(v.pos, me.pos) <= range;
  }

  /** 外鄉人做了一件事：每個看得見的村民用「自己的認知」判斷他有沒有違規（公示才生效的誠實版）。 */
  onOutsiderAct(verb, target, ctx) {
    const me = this.outsider;
    for (const v of this.list) {
      if (v.dead || !this.sees(v)) continue;
      const rules = this.world.violatesFor(v.id, 'outsider', verb, target?.id || null, ctx);
      if (!rules.length) continue;
      const keys = rules.map(r => r.no);
      this.pendingViolations.push({ villager: v.id, pos: [...me.pos], keys, t: this.world.t });   // 傳染：目擊當下記下
      if (this.mayChase(v)) this.startChase(v, verb, rules);
    }
  }
  startChase(v, verb, rules) {
    const fresh = this.world.t >= v.chaseUntil;
    v.chaseUntil = this.world.t + this.opt.chaseSec; v.lastSeen = [...this.outsider.pos]; v.waitUntil = 0;
    if (fresh) { v.boostUntil = this.world.t + this.opt.boostSec; this.emit(rules && rules.length ? 'witness' : 'spotted', { actor: v, verb, rules }); }
  }

  // ---------- 行走（沿用）----------
  passable(v, cell, from) {
    if (!this.grid.inRange(cell)) return false;
    if (this.grid.blocked(cell)) {
      const blockers = [...this.world.objects.values()].filter(o => o.pos && eq(o.pos, cell) && this.grid.blocked(o.pos) && !(o.type === 'door' && o.state !== 'closed') && !(o.type === 'fence' && o.state !== 'intact'));
      const gate = blockers.find(o => o.type === 'door' || o.type === 'fence');
      if (!gate || blockers.length > 1) return false;
      const c = this.world.check(v.id, gate.type === 'door' ? 'open' : 'climb', gate.id, {});
      return c.possible && !c.violates.length;
    }
    const h = this.grid.houseAt(cell);
    if (h && h !== this.grid.houseAt(from)) { const house = this.world.objects.get(h); if (house.owner === v.id) return true; return !this.world.check(v.id, 'enter', h, { uninvited: true }).violates.length; }
    return true;
  }
  findPath(v, goal) { return this.grid.path(v.pos, goal, (c, f) => this.passable(v, c, f), { maxCost: 9000 }); }
  goTo(v, goal) { if (v.goal && eq(v.goal, goal) && v.path.length) return true; v.goal = [...goal]; const p = this.findPath(v, goal); if (!p) { v.path = []; return false; } v.path = p; return true; }
  nearestReachable(v, goal) {
    let best = null, bd = Infinity; const seen = new Set([K(v.pos)]), q = [v.pos]; let n = 0;
    while (q.length && n++ < 2500) { const c = q.shift(); const d = dist(c, goal); if (d < bd) { bd = d; best = c; } for (const nb of this.grid.neighbors(c)) { const k = K(nb); if (!seen.has(k) && this.passable(v, nb, c)) { seen.add(k); q.push(nb); } } }
    return best;
  }
  stepAlong(v) {
    if (v.move) return 'moving';
    if (!v.path.length) return 'done';
    const next = v.path[0];
    if (!this.grid.inRange(next)) { v.path = []; return 'blocked'; }
    const s = this.grid.step(v.pos, next);
    if (!s.ok) {
      const o = [...this.world.objects.values()].find(o => o.pos && eq(o.pos, next) && (o.type === 'door' || o.type === 'fence'));
      if (o && o.type === 'door' && o.state === 'closed') { const r = this.world.attempt(v.id, 'open', o.id); if (!r.done) { v.path = []; return 'refused'; } return 'wait'; }
      if (o && o.type === 'fence' && o.state === 'intact') { const r = this.world.attempt(v.id, 'climb', o.id); if (!r.done) { v.path = []; return 'refused'; } }
      else { v.path = []; return 'blocked'; }
    }
    if (s.enterHouse) { const house = this.world.objects.get(s.enterHouse); if (house.owner !== v.id) { const r = this.world.attempt(v.id, 'enter', house.id, { uninvited: true }); if (!r.done) { v.path = []; v.waitUntil = this.world.t + this.opt.giveUpSec; return 'refused'; } } }
    const boosted = this.world.t < v.boostUntil;
    const sec = boosted ? this.opt.boostStepSec : v.mode === 'chase' ? this.opt.chaseStepSec : this.opt.stepSec;
    v.move = { from: [...v.pos], to: next, k: 0, sec: s.fence ? sec * 2 : sec };
    v.path.shift();
    return 'moved';
  }
  myHouse(v) { return [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id) || null; }
  myStation(v) { return [...this.world.objects.values()].find(o => o.type === 'workstation' && o.owner === v.id) || [...this.world.objects.values()].find(o => o.type === 'workstation') || null; }

  // ---------- 誘導舒適 ----------
  comfortOffer(v) { const a = this.comfortOffers(v); return a[0] || null; }
  comfortOffers(v) {
    if (v.level === 'puppet' || v.dead || v.sleeping) return [];
    return ['name', 'clothes', 'house', 'job'].filter(c => !this.outsider.comforts.has(c));
  }

  // ---------- 每幀 ----------
  tick(dt) {
    const w = this.world, me = this.outsider;
    // 傳染：清掉過期的、對滿足條件的村民 nudge
    this.pendingViolations = this.pendingViolations.filter(pv => !pv.used && this.world.t - pv.t < this.opt.contagionDelay + 2);
    for (const v of this.list) {
      if (v.dead) continue;
      if (w.inBroadcast(v.pos)) v.quiet = 0; else { v.quiet += dt; if (v.quiet >= this.opt.quietSec) { this.demote(v, 'quiet'); v.quiet = 0; } }
      if (v.move) { v.move.k += dt / v.move.sec; if (v.move.k >= 1) { v.pos = [...v.move.to]; v.fpos = [...v.pos]; v.move = null; } else v.fpos = [v.move.from[0] + (v.move.to[0] - v.move.from[0]) * v.move.k, v.move.from[1] + (v.move.to[1] - v.move.from[1]) * v.move.k]; }
      if (v.carrying) { const b = w.objects.get(v.carrying); b.pos = [...v.pos]; }
      // 名字舒適：沒目擊違規就不主動追（追逐靠 onViolation 啟動）；沒有名字則一認知抓捕令就追
      if (!this.hasName() && this.mayChase(v) && this.sees(v) && this.world.t >= v.chaseUntil) this.startChase(v, 'capture', []);
      if (this.hunts(v) && this.sees(v)) { v.chaseUntil = Math.max(v.chaseUntil, w.t + this.opt.chaseSec); v.lastSeen = [...me.pos]; }
      // 抓捕
      if (this.hunts(v) && w.t >= me.immuneUntil && this.adjacent(v.pos, me.pos)) { v.captureT += dt; if (v.captureT >= this.opt.captureSec) { v.captureT = 0; const r = w.attempt(v.id, 'capture', 'outsider'); if (r.done) { me.immuneUntil = w.t + this.opt.immuneSec; for (const u of this.list) if (dist(u.pos, me.pos) <= this.opt.sight) u.chaseUntil = 0; this.emit('captured', { actor: v }); } } } else v.captureT = 0;
      // 傳染判定：有一筆違規在這村民 5 格內、涉及他也認知的條文、且過了 delay 外鄉人還沒被抓
      if (v.level !== 'puppet') for (const pv of this.pendingViolations) if (pv.villager === v.id && this.world.t - pv.t >= this.opt.contagionDelay && !pv.used && !pv.capturedSince) { pv.used = true; this.nudge(v); }
      // 模式
      if (this.hunts(v) && w.t >= v.waitUntil) v.mode = 'chase';
      else if (v.level === 'awake') v.mode = 'idle';
      else v.mode = 'work';
      if (v.mode === 'chase') this.chase(v, dt);
      else if (v.mode === 'work') this.work(v, dt);
      else this.wanderIdle(v, dt);
    }
    this.tickGoats(dt);
  }
  /** 山羊：不受規則約束，被牽著時不自走；否則亂走、吃相鄰公告牌的紙。 */
  tickGoats(dt) {
    for (const g of this.goats) {
      if (g.gmove) { g.gmove.k += dt / 0.4; if (g.gmove.k >= 1) { g.pos = [...g.gmove.to]; g.fpos = [...g.pos]; g.gmove = null; } else g.fpos = [g.gmove.from[0] + (g.gmove.to[0] - g.gmove.from[0]) * g.gmove.k, g.gmove.from[1] + (g.gmove.to[1] - g.gmove.from[1]) * g.gmove.k]; continue; }
      if (g.tied || g.carrying) continue;   // 被繫住／牽著／馱書時交給玩家端移動
      // 吃相鄰的公告牌
      const notice = [...this.world.objects.values()].find(o => o.type === 'notice' && o.state === 'written' && dist(o.pos, g.pos) <= 1.5);
      if (notice && this.rand() < 0.02) { notice.state = 'defaced'; this.world.emit('object', { object: notice, before: 'written' }); this.emit('goatEat', { goat: g, notice: notice.id }); continue; }
      if ((g.gidle -= dt) > 0) continue;
      g.gidle = 1 + this.rand() * 2;
      const dir = this.rng ? [[1,0],[-1,0],[0,1],[0,-1]][this.rng.int(4)] : [0,0];
      const to = [g.pos[0] + dir[0], g.pos[1] + dir[1]];
      if (this.grid.inRange(to) && !this.grid.blocked(to)) g.gmove = { from: [...g.pos], to, k: 0 };
    }
  }
  adjacent(a, b) { if (eq(a, b)) return true; if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false; if (this.grid.blocked(b) || this.grid.blocked(a)) return false; return this.grid.houseAt(a) === this.grid.houseAt(b); }
  chase(v, dt) {
    const me = this.outsider; if (v.move) return;
    const target = this.sees(v) ? me.pos : (v.lastSeen || me.pos);
    if ((v.repath -= dt) <= 0 || !v.path.length || (v.goal && dist(v.goal, target) > 1.5)) {
      v.repath = 0.6;
      if (eq(v.pos, target) && !this.sees(v)) { v.chaseUntil = 0; this.emit('lost', { actor: v }); return; }
      if (!this.goTo(v, target)) { const n = this.nearestReachable(v, target); if (n && !eq(n, v.pos)) this.goTo(v, n); else { v.waitUntil = this.world.t + this.opt.giveUpSec; return; } }
    }
    const r = this.stepAlong(v); if (r === 'refused' || r === 'blocked') v.waitUntil = this.world.t + this.opt.giveUpSec;
  }
  /** 工作循環：到工作站生產 → 把成品送進圖書館 → 回工作站。看得到東西被送進去。 */
  work(v, dt) {
    if (v.move) return;
    const st = this.myStation(v), lib = [...this.world.objects.values()].find(o => o.type === 'library');
    if (!st) { this.wanderIdle(v, dt); return; }
    if (!v.job) v.job = { phase: 'produce', timer: 0 };
    if (v.job.phase === 'produce') {
      const spot = this.grid.neighbors(st.pos).find(c => !this.grid.blocked(c)) || st.pos;
      if (!eq(v.pos, spot)) { if (this.goTo(v, spot)) this.stepAlong(v); return; }
      v.job.timer += dt; if (v.job.timer > 3) { v.job.timer = 0; v.job.phase = lib ? 'deliver' : 'produce'; v.carryingGoods = true; }
    } else {
      if (!lib) { v.job.phase = 'produce'; return; }
      const spot = this.grid.neighbors(lib.pos).find(c => !this.grid.blocked(c)) || lib.pos;
      if (!eq(v.pos, spot)) { if (this.goTo(v, spot)) this.stepAlong(v); return; }
      v.carryingGoods = false; v.job.phase = 'produce'; this.emit('delivered', { actor: v });
    }
  }
  wanderIdle(v, dt) {
    if (v.move) return; if (v.path.length) { this.stepAlong(v); return; }
    if ((v.idle -= dt) > 0) return; v.idle = 1.5 + this.rand() * 2.5;
    const rr = this.opt.wanderRadius; const goal = [v.home[0] + Math.round((this.rand() * 2 - 1) * rr), v.home[1] + Math.round((this.rand() * 2 - 1) * rr)];
    if (!this.grid.blocked(goal) && this.grid.inRange(goal) && !this.grid.houseAt(goal)) this.goTo(v, goal);
  }
}

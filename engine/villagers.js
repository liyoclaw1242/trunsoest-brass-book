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
      quiet: 0, boostUntil: 0, waitUntil: 0, captureT: 0, idle: 0, repath: 0, chaseUntil: 0, lastSeen: null, dead: false, progress: 0, offered: null, carrier: !!a.carrier,
      sight: a.role === 'sheriff' ? (opt.sheriffSight || 9) : this.opt.sight, patrol: 0, dwell: 0, carryingGoods: false });
    this.outsider = world.actors.get('outsider');
    this.outsider.immuneUntil = this.outsider.immuneUntil || 0;
    this.outsider.invitedTo = this.outsider.invitedTo || null;
    this.outsider.comforts = this.outsider.comforts || new Set();
    this.goats = [...world.objects.values()].filter(o => o.type === 'goat');
    for (const g of this.goats) { g.gidle = 0; g.fpos = [...g.pos]; g.gmove = null; }
    world.on('acted', ({ actor, verb, target, ctx }) => { if (actor.id === 'outsider') this.onOutsiderAct(verb, target, ctx); });
    this.match = null;   // session 注入，用來查定義涵蓋與舒適
  }
  emit(type, data) { this.world.emit(type, data); }
  rand() { return this.rng ? this.rng.next() : Math.random(); }

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
    const base = v.sight || this.opt.sight;   // 治安官視野較廣，是主要的追捕者
    const range = disguised ? Math.min(base, 1.5) : base;
    return dist(v.pos, me.pos) <= range;
  }

  /** 外鄉人做了一件事：每個看得見的村民用「自己的認知」判斷他有沒有違規（公示才生效的誠實版）。 */
  onOutsiderAct(verb, target, ctx) {
    const me = this.outsider;
    for (const v of this.list) {
      if (v.dead || !this.sees(v)) continue;
      const rules = this.world.violatesFor(v.id, 'outsider', verb, target?.id || null, ctx);
      if (!rules.length) continue;
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
    if (v.role && v.role !== 'merchant') return [];   // 舒適只有商人在市集提供（有職業時）；無職業的村民沿用舊行為
    return ['name', 'clothes', 'house', 'job'].filter(c => !this.outsider.comforts.has(c));
  }

  // ---------- 每幀 ----------
  tick(dt) {
    const w = this.world, me = this.outsider;
    for (const v of this.list) {
      if (v.dead) continue;
      if (v.move) { v.move.k += dt / v.move.sec; if (v.move.k >= 1) { v.pos = [...v.move.to]; v.fpos = [...v.pos]; v.move = null; } else v.fpos = [v.move.from[0] + (v.move.to[0] - v.move.from[0]) * v.move.k, v.move.from[1] + (v.move.to[1] - v.move.from[1]) * v.move.k]; }
      if (v.carrying) { const b = w.objects.get(v.carrying); b.pos = [...v.pos]; }
      if (v.cart) { const cart = w.objects.get(v.cart); if (cart) { cart.pos = [...v.pos]; cart.fpos = this.cartTrail(v); } }   // 物流車跟著物流業者
      // 名字舒適：沒目擊違規就不主動追（追逐靠 onViolation 啟動）；沒有名字則一認知抓捕令就追
      if (!this.hasName() && this.mayChase(v) && this.sees(v) && this.world.t >= v.chaseUntil) this.startChase(v, 'capture', []);
      if (this.hunts(v) && this.sees(v)) { v.chaseUntil = Math.max(v.chaseUntil, w.t + this.opt.chaseSec); v.lastSeen = [...me.pos]; }
      // 抓捕
      if (this.hunts(v) && w.t >= me.immuneUntil && this.adjacent(v.pos, me.pos)) { v.captureT += dt; if (v.captureT >= this.opt.captureSec) { v.captureT = 0; const r = w.attempt(v.id, 'capture', 'outsider'); if (r.done) { me.immuneUntil = w.t + this.opt.immuneSec; for (const u of this.list) if (dist(u.pos, me.pos) <= this.opt.sight) u.chaseUntil = 0; this.emit('captured', { actor: v }); } } } else v.captureT = 0;
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
  // ---------- 職業：各自在場上做可見的工作，拼出一個小型社會 ----------
  objById(id) { return id ? this.world.objects.get(id) : null; }
  objOwnedBy(type, ownerId) { const list = [...this.world.objects.values()]; return list.find(o => o.type === type && o.owner === ownerId) || null; }
  nearestOf(type, pos) { let best = null, bd = Infinity; for (const o of this.world.objects.values()) { if (o.type !== type || !o.pos) continue; const d = dist(o.pos, pos); if (d < bd) { bd = d; best = o; } } return best; }
  /** 站到物件旁邊的可站格（物件本身若擋路就取相鄰）。 */
  workSpot(o) { if (!this.grid.blocked(o.pos)) return o.pos; return this.grid.neighbors(o.pos).find(c => !this.grid.blocked(c)) || o.pos; }
  goWorkSpot(v, o) { const spot = this.workSpot(o); if (eq(v.pos, spot)) return true; if (this.goTo(v, spot)) this.stepAlong(v); return false; }
  /** 物流車尾隨在物流業者身後。 */
  cartTrail(v) { const f = v.fpos || v.pos; if (v.move) { const dx = v.move.to[0] - v.move.from[0], dy = v.move.to[1] - v.move.from[1]; return [f[0] - dx * 0.9, f[1] - dy * 0.9]; } return [...f]; }

  /** 工作循環：依職業分派。看得見農夫送穀、物流拉車、商人顧店、治安官巡邏、書記抄書。 */
  work(v, dt) {
    if (v.move) return;
    switch (v.role) {
      case 'farmer': return this.workFarmer(v, dt);
      case 'logistics': return this.workLogistics(v, dt);
      case 'merchant': return this.workMerchant(v, dt);
      case 'sheriff': return this.workSheriff(v, dt);
      case 'keeper': return this.workKeeper(v, dt);
      default: return this.workScribe(v, dt);   // 書記 / 無職業（相容舊場景）：生產 → 送進圖書館
    }
  }
  /** 書記：在抄寫台生產 → 送進圖書館（勞動直接流向書）。 */
  workScribe(v, dt) {
    const st = this.objOwnedBy('workstation', v.id) || this.nearestOf('workstation', v.pos);
    const lib = this.nearestOf('library', v.pos);
    if (!st) { this.wanderIdle(v, dt); return; }
    if (!v.job) v.job = { phase: 'produce', timer: 0 };
    if (v.job.phase === 'produce') {
      if (!this.goWorkSpot(v, st)) return;
      v.job.timer += dt; if (v.job.timer > 3) { v.job.timer = 0; v.job.phase = lib ? 'deliver' : 'produce'; v.carryingGoods = true; }
    } else {
      if (!lib) { v.job.phase = 'produce'; v.carryingGoods = false; return; }
      if (!this.goWorkSpot(v, lib)) return;
      v.carryingGoods = false; v.job.phase = 'produce'; this.emit('delivered', { actor: v, to: 'library' });
    }
  }
  /** 農夫：在田裡耕作 → 把收成送進穀倉。 */
  workFarmer(v, dt) {
    const field = this.objById(v.field) || this.nearestOf('field', v.pos);
    const gran = this.nearestOf('granary', v.pos);
    if (!field) { this.workScribe(v, dt); return; }
    if (!v.job) v.job = { phase: 'produce', timer: 0 };
    if (v.job.phase === 'produce') {
      if (!this.goWorkSpot(v, field)) return;
      v.job.timer += dt; if (v.job.timer > 3.5) { v.job.timer = 0; v.carryingGoods = true; v.job.phase = gran ? 'deliver' : 'produce'; }
    } else {
      if (!gran) { v.job.phase = 'produce'; v.carryingGoods = false; return; }
      if (!this.goWorkSpot(v, gran)) return;
      v.carryingGoods = false; v.job.phase = 'produce'; this.emit('delivered', { actor: v, to: 'granary' });
    }
  }
  /** 物流業者：拉著物流車在穀倉取貨 → 送到市集店鋪。 */
  workLogistics(v, dt) {
    const gran = this.nearestOf('granary', v.pos);
    const shop = this.nearestOf('shop', v.pos);
    if (!v.job) v.job = { phase: 'pickup', timer: 0 };
    if (v.job.phase === 'pickup') {
      if (!gran) { v.job.phase = 'deliver'; return; }
      if (!this.goWorkSpot(v, gran)) return;
      v.job.timer += dt; if (v.job.timer > 2) { v.job.timer = 0; v.carryingGoods = true; v.job.phase = 'deliver'; }
    } else {
      if (!shop) { v.job.phase = 'pickup'; v.carryingGoods = false; return; }
      if (!this.goWorkSpot(v, shop)) return;
      v.carryingGoods = false; v.job.phase = 'pickup'; this.emit('delivered', { actor: v, to: 'shop' });
    }
  }
  /** 商人：待在自己的店鋪迎客（舒適的提供在 comfortOffers）。 */
  workMerchant(v, dt) {
    const shop = this.objById(v.shop) || this.nearestOf('shop', v.pos);
    if (!shop) { this.wanderIdle(v, dt); return; }
    this.goWorkSpot(v, shop);
  }
  /** 穀倉管理員：顧著穀倉。 */
  workKeeper(v, dt) {
    const gran = this.nearestOf('granary', v.pos);
    if (!gran) { this.wanderIdle(v, dt); return; }
    this.goWorkSpot(v, gran);
  }
  /** 治安官：沿哨口巡邏（主要的追捕者；追逐由模式切換接管）。 */
  workSheriff(v, dt) {
    const posts = [...this.world.objects.values()].filter(o => o.type === 'post' && o.pos).sort((a, b) => a.id < b.id ? -1 : 1);
    if (!posts.length) { this.wanderIdle(v, dt); return; }
    const spot = this.workSpot(posts[v.patrol % posts.length]);
    if (!eq(v.pos, spot)) {
      if (!this.goTo(v, spot)) { v.patrol++; v.dwell = 0; return; }   // 到不了這個哨口 → 換下一個
      this.stepAlong(v);
      return;
    }
    v.dwell += dt; if (v.dwell > 1.5) { v.dwell = 0; v.patrol++; }   // 在哨口稍停，再前往下一個
  }
  wanderIdle(v, dt) {
    if (v.move) return; if (v.path.length) { this.stepAlong(v); return; }
    if ((v.idle -= dt) > 0) return; v.idle = 1.5 + this.rand() * 2.5;
    const rr = this.opt.wanderRadius; const goal = [v.home[0] + Math.round((this.rand() * 2 - 1) * rr), v.home[1] + Math.round((this.rand() * 2 - 1) * rr)];
    if (!this.grid.blocked(goal) && this.grid.inRange(goal) && !this.grid.houseAt(goal)) this.goTo(v, goal);
  }
}

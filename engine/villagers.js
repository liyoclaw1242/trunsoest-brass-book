// villagers.js —— 村民的純邏輯（原型三）：巡邏、目擊違規才追、絕不違反認知到的規則、不離開影響範圍、
// 誘導、喚醒、抓捕判定、夜間回家睡覺／人偶守夜、視線與偽裝辨識。不碰 DOM／three。
//
// 同化程度 level：puppet（照字面執行、不能誘導、夜間守夜）→ half（可誘導、夜間睡覺）→ awake（站在外鄉人這邊，不追人）。
// 追逐：村民「看見」外鄉人做出違反「該村民認知到的規則」的事（world 的 acted 事件），且他認知抓捕令、
//       又沒有被「夜間不得追捕」擋住 → 追 chaseSec 秒；看得見就延長，看不見就去最後看到的位置，到期回家。
// 偽裝：外鄉人穿著市民衣物時，只有 recognize 距離內的村民認得出他是外鄉人；只管外鄉人的條文（who: outsider）要認得出才算違規。
import { dist } from './grid.js';
import { citizenIncludesAwake } from './rules.v3.js';

export const LEVELS = ['puppet', 'half', 'awake'];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const K = c => `${c[0]},${c[1]}`;
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class Villagers {
  constructor(world, grid, opt = {}) {
    this.world = world; this.grid = grid;
    this.opt = { stepSec: 0.35, chaseStepSec: 0.22, boostStepSec: 0.15, boostSec: 8, quietSec: 30, captureSec: 0.5, giveUpSec: 4, wanderRadius: 3, immuneSec: 3, induceCooldownSec: 20,
      sightDay: 8, sightNight: 3, lampBonus: 3, recognizeDay: 2, recognizeNight: 1, chaseSec: 20, hunt: true, ...opt };
    this.rng = opt.rng || Math.random;
    this.list = [...world.actors.values()].filter(a => a.kind === 'citizen');
    for (const a of this.list) Object.assign(a, { level: a.level || 'puppet', fpos: [...a.pos], move: null, path: [], goal: null, mode: 'wander', task: null, quiet: 0, boostUntil: 0, waitUntil: 0, captureT: 0, idle: 0, repath: 0, cooldownUntil: 0, lastStuck: null, chaseUntil: 0, lastSeen: null, sleeping: false, lit: false, returning: false });
    this.outsider = world.actors.get('outsider');
    this.outsider.immuneUntil = this.outsider.immuneUntil || 0;
    this.outsider.invitedTo = this.outsider.invitedTo || null;
    this.outsider.house = this.outsider.house || null;
    // 外鄉人做了什麼 → 看見的村民判斷是不是違規（以村民自己的認知）
    world.on('acted', ({ actor, verb, target, ctx }) => { if (actor.id === 'outsider') this.witness(verb, target, ctx); });
    // 收到自己的信物 → 降一級
    world.on('act', ({ verb, target }) => {
      if (verb === 'give' && target?.type === 'keepsake' && target.heldBy && target.owner === target.heldBy) {
        const v = world.actors.get(target.heldBy); if (v && v.kind === 'citizen') this.demote(v, 'keepsake');
      }
    });
    world.on('phase', ({ phase }) => this.onPhase(phase));
  }
  emit(type, data) { this.world.emit(type, data); }

  // ---------- 同化程度 ----------
  demote(v, why) {
    const i = LEVELS.indexOf(v.level); if (i >= LEVELS.length - 1) return false;
    const from = v.level; v.level = LEVELS[i + 1]; v.quiet = 0; v.task = null; v.mode = 'wander'; v.path = []; v.chaseUntil = 0;
    this.emit('level', { actor: v, from, to: v.level, why });
    return true;
  }
  promote(v, why) {
    const i = LEVELS.indexOf(v.level); if (i <= 0) return false;
    const from = v.level; v.level = LEVELS[i - 1]; v.task = null; v.mode = 'wander'; v.path = [];
    this.emit('level', { actor: v, from, to: v.level, why });
    return true;
  }
  isCitizenForRules(v) { return v.level !== 'awake' || citizenIncludesAwake(this.world); }
  /** 這個村民現在會不會抓人（認知抓捕令、沒被夜禁擋住、不是已喚醒）。 */
  mayCapture(v) {
    if (this.opt.hunt === false || v.level === 'awake' || v.sleeping) return false;
    if (!this.world.knows(v.id, 'capture')) return false;
    if (this.world.isNight() && this.world.knows(v.id, 'no-night-capture')) return false;
    return true;
  }
  /** 正在追。 */
  hunts(v) { return this.mayCapture(v) && this.world.t < v.chaseUntil; }
  inducible(v) { return v.level !== 'puppet' && !v.sleeping && this.world.t >= v.cooldownUntil; }
  wouldRefuse(v, kind) {
    if (!this.isCitizenForRules(v) || kind === 'invite') return [];
    return this.world.check(v.id, 'induce', v.id, {}).violates;
  }
  cooldown(v) { return Math.max(0, v.cooldownUntil - this.world.t); }
  endTask(v) { v.task = null; v.cooldownUntil = this.world.t + this.opt.induceCooldownSec; v.returning = true; v.path = []; v.goal = null; }

  // ---------- 視線與辨識 ----------
  sight(v) { return (this.world.isNight() ? this.opt.sightNight : this.opt.sightDay) + (v.lit ? this.opt.lampBonus : 0); }
  /** v 看不看得到 pos（距離＋不隔牆）。targetLit：對方持燈，看得更遠。 */
  canSee(v, pos, targetLit = false) {
    if (v.sleeping) return false;
    if (dist(v.pos, pos) > this.sight(v) + (targetLit ? this.opt.lampBonus : 0)) return false;
    return this.grid.houseAt(v.pos) === this.grid.houseAt(pos);
  }
  /** 認不認得出外鄉人是外鄉人（偽裝時只有很近才認得出）。 */
  recognizes(v) {
    const me = this.outsider; if (!me.wearing) return true;
    return dist(v.pos, me.pos) <= (this.world.isNight() ? this.opt.recognizeNight : this.opt.recognizeDay);
  }
  seesOutsider(v) { return this.canSee(v, this.outsider.pos, !!this.outsider.lit); }
  /** 外鄉人做了 verb；每個看得見的村民用自己的認知判斷是不是違規，是就追。 */
  witness(verb, target, ctx) {
    const me = this.outsider;
    for (const v of this.list) {
      if (!this.seesOutsider(v)) continue;
      const rules = this.world.violatesFor(v.id, 'outsider', verb, target?.id || null, ctx).filter(r => r.who !== 'outsider' || this.recognizes(v));
      if (!rules.length) continue;
      if (!this.mayCapture(v)) { this.emit('witnessIgnored', { actor: v, verb, rules }); continue; }
      this.startChase(v, verb, rules);
    }
  }
  startChase(v, verb, rules) {
    const fresh = this.world.t >= v.chaseUntil;
    v.chaseUntil = this.world.t + this.opt.chaseSec; v.lastSeen = [...this.outsider.pos]; v.waitUntil = 0; v.returning = false;
    if (fresh) { v.boostUntil = this.world.t + this.opt.boostSec; this.emit('witness', { actor: v, verb, rules }); }
  }

  // ---------- 誘導 ----------
  induceOptions(v) {
    if (!this.inducible(v)) return [];
    const out = [];
    const house = [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id);
    if (house) out.push({ kind: 'invite', label: '請他邀請我進屋' });
    if ([...this.world.objects.values()].some(o => o.type === 'keepsake' && o.pos)) out.push({ kind: 'fetch', label: '請他去拿信物' });
    const book = [...this.world.objects.values()].find(o => o.type === 'book');
    if (book && book.pos && !book.heldBy && house) out.push({ kind: 'book', label: '請他去搬書' });
    return out;
  }
  induce(v, kind) {
    if (!this.inducible(v)) { this.emit('induceFail', { actor: v, kind, reason: v.level === 'puppet' ? 'puppet' : v.sleeping ? 'sleeping' : 'cooldown' }); return false; }
    if (this.isCitizenForRules(v) && kind !== 'invite') {
      const bound = this.world.check(v.id, 'induce', v.id, {});
      if (bound.violates.length) { this.emit('refuse', { actor: v, verb: 'induce', target: this.world.objects.get(v.id), rules: bound.violates }); v.cooldownUntil = Math.max(v.cooldownUntil, this.world.t + 3); return false; }
    }
    const house = [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id);
    if (kind === 'invite') { v.task = { kind, house: house.id, stage: 0 }; }
    else if (kind === 'fetch') {
      const taken = new Set(this.list.filter(x => x.task?.kind === 'fetch').map(x => x.task.keepsake));
      const ks = [...this.world.objects.values()].filter(o => o.type === 'keepsake' && o.pos && !taken.has(o.id)).sort((a, b) => dist(a.pos, v.pos) - dist(b.pos, v.pos))[0];
      if (!ks) { this.emit('induceFail', { actor: v, kind, reason: 'nothing' }); return false; }
      v.task = { kind, keepsake: ks.id, stage: 0 };
    } else if (kind === 'book') {
      const book = [...this.world.objects.values()].find(o => o.type === 'book');
      const c = this.world.check(v.id, 'move', book.id, {});
      if (c.violates.length) { this.emit('refuse', { actor: v, verb: 'move', target: book, rules: c.violates }); return false; }
      v.task = { kind, book: book.id, dest: [...v.home], stage: 0 };
    } else return false;
    v.mode = 'task'; v.path = []; v.goal = null; v.chaseUntil = 0;
    this.world.attempt('outsider', 'induce', v.id, {});
    this.emit('induce', { actor: v, kind });
    return true;
  }

  // ---------- 行走 ----------
  passable(v, cell, from) {
    if (!this.grid.inRange(cell)) return false;
    if (this.grid.blocked(cell)) {
      const o = [...this.world.objects.values()].find(o => o.pos && eq(o.pos, cell) && (o.type === 'door' || o.type === 'fence'));
      if (!o) return false;
      const c = this.world.check(v.id, o.type === 'door' ? 'open' : 'climb', o.id, {});
      return c.possible && !c.violates.length;
    }
    const h = this.grid.houseAt(cell);
    if (h && h !== this.grid.houseAt(from)) {
      const house = this.world.objects.get(h);
      if (house.owner === v.id) return true;
      return !this.world.check(v.id, 'enter', h, { uninvited: true }).violates.length;
    }
    return true;
  }
  findPath(v, goal) { return this.grid.path(v.pos, goal, (c, from) => this.passable(v, c, from), { maxCost: 9000 }); }
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
      if (house.owner !== v.id) { const r = this.world.attempt(v.id, 'enter', house.id, { uninvited: true }); if (!r.done) { v.path = []; v.waitUntil = this.world.t + this.opt.giveUpSec; return 'refused'; } }
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
  nearestReachable(v, goal) {
    let best = null, bd = Infinity;
    const seen = new Set([K(v.pos)]), q = [v.pos]; let n = 0;
    while (q.length && n++ < 2500) {
      const c = q.shift(); const d = dist(c, goal); if (d < bd) { bd = d; best = c; }
      for (const nb of this.grid.neighbors(c)) { const k = K(nb); if (!seen.has(k) && this.passable(v, nb, c)) { seen.add(k); q.push(nb); } }
    }
    return best;
  }
  myHouse(v) { return [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id) || null; }

  // ---------- 晝夜 ----------
  onPhase(phase) {
    for (const v of this.list) {
      if (phase === 'night') { if (v.level === 'puppet') { v.lit = true; } }
      else { v.sleeping = false; v.lit = false; v.path = []; v.goal = null; }
    }
    this.emit('villagersPhase', { phase });
  }
  /** 夜間：半同化與已喚醒的回家睡（在室內就算睡著，看不見外面）；人偶守夜。 */
  nightRoutine(v) {
    if (v.level === 'puppet') return false;
    const house = this.myHouse(v); if (!house) return false;
    if (this.grid.houseAt(v.pos) === house.id) { if (!v.sleeping) { v.sleeping = true; v.path = []; this.emit('sleep', { actor: v }); } return true; }
    if (v.move) return true;
    const hc = this.grid.houses.get(house.id);
    const dest = hc.interior.find(c => !this.grid.blocked(c));
    if (!v.path.length || !eq(v.goal, dest)) this.goTo(v, dest);
    this.stepAlong(v);
    return true;
  }

  // ---------- 每幀 ----------
  tick(dt) {
    const w = this.world, me = this.outsider, night = w.isNight();
    for (const v of this.list) {
      if (w.inBroadcast(v.pos) && !night) v.quiet = 0; else { v.quiet += dt; if (v.quiet >= this.opt.quietSec) { this.demote(v, 'quiet'); v.quiet = 0; } }
      if (v.move) {
        v.move.k += dt / v.move.sec;
        if (v.move.k >= 1) { v.pos = [...v.move.to]; v.fpos = [...v.pos]; v.move = null; }
        else v.fpos = [v.move.from[0] + (v.move.to[0] - v.move.from[0]) * v.move.k, v.move.from[1] + (v.move.to[1] - v.move.from[1]) * v.move.k];
      }
      if (v.carrying) {
        const b = w.objects.get(v.carrying); b.pos = [...v.pos];
        const c = w.check(v.id, 'move', v.carrying, {});
        if (c.violates.length) { this.dropBook(v); this.emit('refuse', { actor: v, verb: 'move', target: b, rules: c.violates }); this.emit('taskFail', { actor: v, kind: 'book', why: 'refused' }); this.endTask(v); }
      }
      if (v.returning && dist(v.pos, v.home) <= 1.5) v.returning = false;
      // 偽裝被認出：穿著衣物本身是持續的違規（對認知到那條的村民）
      if (me.wearing && !v.sleeping && this.mayCapture(v) && w.knows(v.id, 'no-disguise') && this.seesOutsider(v) && this.recognizes(v)) this.startChase(v, 'wear', [w.live('no-disguise')]);
      // 追逐中看得見就延長
      if (this.hunts(v) && this.seesOutsider(v)) { v.chaseUntil = Math.max(v.chaseUntil, w.t + this.opt.chaseSec); v.lastSeen = [...me.pos]; }
      // 抓捕判定
      if (this.hunts(v) && !v.task && !v.returning && w.t >= me.immuneUntil && this.adjacentWalkable(v.pos, me.pos)) {
        v.captureT += dt;
        if (v.captureT >= this.opt.captureSec) {
          v.captureT = 0;
          const r = w.attempt(v.id, 'capture', 'outsider');
          if (r.done) { me.immuneUntil = w.t + this.opt.immuneSec; v.chaseUntil = 0; this.emit('captured', { actor: v }); }
        }
      } else v.captureT = 0;
      // 模式
      if (v.task) v.mode = 'task';
      else if (night && v.level !== 'puppet' && !this.hunts(v)) v.mode = 'sleep';
      else if (v.returning) v.mode = 'return';
      else if (this.hunts(v) && w.t >= v.waitUntil) v.mode = 'chase';
      else v.mode = 'wander';
      if (v.mode === 'sleep') { if (!this.nightRoutine(v)) this.wander(v, dt); }
      else if (v.mode === 'return') { v.sleeping = false; if (!v.move) { if (!v.path.length && !this.goTo(v, v.home)) v.returning = false; else this.stepAlong(v); } }
      else if (v.mode === 'chase') { v.sleeping = false; this.chase(v, dt); }
      else if (v.mode === 'task') { v.sleeping = false; this.doTask(v, dt); }
      else this.wander(v, dt);
    }
  }
  adjacentWalkable(a, b) {
    if (eq(a, b)) return true;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
    if (this.grid.blocked(b) || this.grid.blocked(a)) return false;
    return this.grid.houseAt(a) === this.grid.houseAt(b);
  }
  chase(v, dt) {
    const me = this.outsider;
    if (v.move) return;
    const target = this.seesOutsider(v) ? me.pos : (v.lastSeen || me.pos);
    if ((v.repath -= dt) <= 0 || !v.path.length || (v.goal && dist(v.goal, target) > 1.5)) {
      v.repath = 0.6;
      if (eq(v.pos, target) && !this.seesOutsider(v)) { v.chaseUntil = 0; v.returning = true; this.emit('lost', { actor: v }); return; }
      if (!this.goTo(v, target)) {
        const near = this.nearestReachable(v, target);
        if (near && !eq(near, v.pos)) this.goTo(v, near);
        else {
          v.path = []; v.waitUntil = this.world.t + this.opt.giveUpSec;
          const h = this.grid.houseAt(me.pos), key = `${h || 'x'}:${v.pos}`;
          if (v.lastStuck !== key) { v.lastStuck = key; if (h) { const c = this.world.check(v.id, 'enter', h, { uninvited: true }); this.emit('blockedByRule', { actor: v, house: h, rules: c.violates }); } else this.emit('stuck', { actor: v }); }
          return;
        }
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
    const fail = why => { this.emit('taskFail', { actor: v, kind: t.kind, why }); this.endTask(v); };
    if (t.kind === 'invite') {
      const hc = this.grid.houses.get(t.house);
      const r = walkTo(hc.front);
      if (r === 'fail') return fail('path');
      if (r === true) { me.invitedTo = t.house; this.emit('invited', { actor: v, house: t.house }); this.endTask(v); }
    } else if (t.kind === 'fetch') {
      const ks = w.objects.get(t.keepsake);
      if (t.stage === 0) {
        if (!ks.pos) return fail('gone');
        const r = walkTo(ks.pos); if (r === 'fail') return fail('path');
        if (r === true) { const a = w.attempt(v.id, 'take', ks.id); if (!a.done) return fail('refused'); t.stage = 1; }
      } else {
        if (cheb(v.pos, me.pos) <= 1) { const a = w.attempt(v.id, 'give', ks.id, { to: 'outsider' }); if (!a.done) return fail('refused'); this.endTask(v); return; }
        const n = this.nearestReachable(v, me.pos);
        const r = n ? walkTo(n) : 'fail';
        if (r === 'fail') return fail('path');
        if (r === true && cheb(v.pos, me.pos) > 1) v.goal = null;
      }
    } else if (t.kind === 'book') {
      const book = w.objects.get(t.book);
      if (t.stage === 0) {
        if (!book.pos || book.heldBy) return fail('gone');
        const spots = this.grid.neighbors(book.pos).filter(c => !this.grid.blocked(c)).sort((a, b) => dist(a, v.pos) - dist(b, v.pos));
        if (!spots.length) return fail('path');
        const r = walkTo(spots[0]); if (r === 'fail') return fail('path');
        if (r === true) { const a = w.attempt(v.id, 'move', book.id, { to: [...v.pos] }); if (!a.done) return fail('refused'); v.carrying = book.id; t.stage = 1; }
      } else {
        const r = walkTo(t.dest); if (r === 'fail') { this.dropBook(v); return fail('path'); }
        if (r === true) { this.dropBook(v); this.endTask(v); this.emit('bookMoved', { actor: v, pos: book.pos }); }
      }
    }
  }
  dropBook(v) { const b = this.world.objects.get(v.carrying); if (!b) return; b.pos = [...v.pos]; v.carrying = null; this.world.emit('object', { object: b, before: b.state }); }
}

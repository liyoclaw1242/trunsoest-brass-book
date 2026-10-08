// game.js —— 串接：引擎 World + Grid + 玩家移動與互動 + 事件紀錄。不碰 three.js（那在 view.js），不碰 DOM（那在 hud.js）。
import { World, num } from '../engine/rulebook-engine.js';
import { setup } from '../engine/rules.default.js';
import { Grid, dist } from '../engine/grid.js';

export const LABEL = { enter: '進入', use: '使用', open: '開啟', take: '取走', give: '歸還', break: '破壞', repair: '修復', move: '搬動', climb: '翻越', read: '閱讀', deface: '塗毀', approach: '靠近', run: '奔跑', capture: '抓捕' };
export const TYPE = { book: '黃銅書', lectern: '書台', speaker: '廣播器', notice: '公告牌', house: '住宅', door: '門', fence: '圍籬', cart: '推車', keepsake: '信物', boundary: '界石', villager: '村民', outsider: '外鄉人' };
export const STATE = { intact: '完好', broken: '損壞', closed: '關著', open: '開著', blank: '空白', written: '有字', defaced: '被塗毀', puppet: '人偶', half: '半同化', awake: '已喚醒', writing: '書寫中' };
export const name = o => o ? `${TYPE[o.type] || o.type}${o.id.replace(/^[a-z]+_?/, '') ? ' ' + o.id.split('_').pop() : ''}` : '';

const STEP = 0.16;                 // 走一格的秒數
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class Game {
  constructor(scene, meta, opt = {}) {
    this.meta = meta;
    this.world = new World(scene, opt.world || {});
    this.grid = new Grid(this.world.objects);
    this.t = 0;
    this.log = [];
    this.listeners = [];
    const me = this.world.addActor({ id: 'outsider', kind: 'outsider', pos: [...meta.start] });
    this.player = { actor: me, cell: [...meta.start], pos: [...meta.start], from: null, to: null, k: 0, facing: [0, -1], house: null, invitedTo: null, carrying: null };
    this.villagers = [];
    for (const o of scene.filter(o => o.type === 'villager')) {
      const a = this.world.addActor({ id: o.id, kind: 'citizen', pos: [...o.pos], level: o.state, home: [...o.pos], color: o.color });
      this.villagers.push(a);
    }
    setup(this.world);
    this.hookEvents();
    this.world.outsiderArrived();
  }
  on(fn) { this.listeners.push(fn); }
  note(type, text, data = {}) {
    const e = { t: +this.t.toFixed(2), type, text, ...data };
    this.log.push(e);
    for (const fn of this.listeners) fn(e);
  }
  hookEvents() {
    const w = this.world;
    w.on('write', ({ rule }) => this.note('write', `書寫下第${num(rule.no)}條：${rule.text}`, { no: rule.no }));
    w.on('reset', ({ gone }) => this.note('reset', `—— 以上規則無效 ——（撕掉 ${gone.length} 條）`, { gone: gone.map(r => r.no) }));
    w.on('broadcastStart', ({ rule }) => this.note('broadcast', `廣播開始：第${num(rule.no)}條`, { no: rule.no }));
    w.on('broadcastEnd', ({ rule, learned }) => { if (learned.length) this.note('learn', `聽完第${num(rule.no)}條：${learned.map(id => id === 'outsider' ? '你' : name(w.objects.get(id))).join('、')}認知了`, { no: rule.no, learned }); });
    w.on('violation', ({ actor, verb, target, rules }) => this.note('violation', `${actor.id === 'outsider' ? '你' : name(w.objects.get(actor.id))}違反了第${rules.map(r => num(r.no)).join('、')}條（${LABEL[verb]}${name(target)}）`, { actor: actor.id, verb, target: target?.id, rules: rules.map(r => r.no) }));
    w.on('conflict', ({ actor, verb, forbid, permit }) => this.note('conflict', `第${num(forbid.no)}條與第${num(permit.no)}條衝突，這次不追究（${LABEL[verb]}）`, { actor: actor.id, verb }));
    w.on('refuse', ({ actor, verb, target, rules }) => this.note('refuse', `${name(w.objects.get(actor.id))}拒絕${LABEL[verb]}${name(target)}：第${rules.map(r => num(r.no)).join('、')}條`, { actor: actor.id, verb, target: target?.id }));
    w.on('object', ({ object: o, before }) => {
      const what = o.state !== before ? `變成${STATE[o.state] || o.state}` : o.heldBy ? `被${o.heldBy === 'outsider' ? '你' : name(w.objects.get(o.heldBy))}拿著` : o.pos ? `移到 (${o.pos})` : '';
      this.note('object', `${name(o)}${what}`, { id: o.id, state: o.state, pos: o.pos, heldBy: o.heldBy });
    });
    w.on('act', ({ actor, verb, target }) => this.note('act', `${actor.id === 'outsider' ? '你' : name(w.objects.get(actor.id))}${LABEL[verb]}了${name(target) || ''}`, { actor: actor.id, verb, target: target?.id }));
  }

  // ---------- 玩家移動 ----------
  get moving() { return !!this.player.to; }
  /** 試著往 dir 走一格。回傳 'ok' | 'moving' | 'blocked' | 'refused'。 */
  tryStep(dir) {
    const p = this.player;
    if (p.to) return 'moving';
    p.facing = dir;
    const next = add(p.cell, dir);
    const s = this.grid.step(p.cell, next);
    if (!s.ok) return 'blocked';
    if (s.enterHouse) {
      const h = this.world.objects.get(s.enterHouse);
      const ctx = p.invitedTo === h.id ? { invited: true } : { uninvited: true };
      const r = this.world.attempt('outsider', 'enter', h.id, ctx);
      if (!r.done) return 'refused';
    }
    this.beginMove(next);
    return 'ok';
  }
  beginMove(next) {
    const p = this.player;
    p.from = [...p.cell]; p.to = next; p.k = 0;
  }
  /** 直接把玩家放到某格（被抓送回中心、翻越圍籬落地）。 */
  place(cell) {
    const p = this.player;
    p.cell = [...cell]; p.pos = [...cell]; p.from = p.to = null; p.k = 0;
    p.actor.pos = [...cell];
    this.afterArrive();
  }
  afterArrive() {
    const p = this.player;
    const h = this.grid.houseAt(p.cell);
    if (h !== p.house) { if (p.house && p.invitedTo === p.house) p.invitedTo = null; p.house = h; }
  }
  tick(dt) {
    this.t += dt;
    const p = this.player;
    if (p.to) {
      p.k += dt / STEP;
      if (p.k >= 1) { p.cell = p.to; p.pos = [...p.to]; p.to = p.from = null; p.actor.pos = [...p.cell]; this.afterArrive(); }
      else p.pos = [p.from[0] + (p.to[0] - p.from[0]) * p.k, p.from[1] + (p.to[1] - p.from[1]) * p.k];
    }
    if (p.carrying) { const b = this.world.objects.get(p.carrying); b.pos = [...p.cell]; }
    this.world.tick(dt);
  }

  // ---------- 互動 ----------
  /** 玩家附近物件的動詞選項。第一個是 E，其餘對應數字鍵。 */
  options() {
    const p = this.player, w = this.world, g = this.grid, out = [];
    const front = add(p.cell, p.facing);
    const near = [...w.objects.values()].filter(o => o.pos && o.id !== 'outsider' && cheb(o.pos, p.cell) <= 1 && o.type !== 'house')
      .sort((a, b) => (eq(a.pos, front) ? 0 : 1) - (eq(b.pos, front) ? 0 : 1) || dist(a.pos, p.cell) - dist(b.pos, p.cell));
    // 身上的信物：可歸還給相鄰村民
    for (const id of p.actor.held) {
      const o = w.objects.get(id); if (o.type !== 'keepsake') continue;
      for (const v of this.villagers) if (cheb(v.pos, p.cell) <= 1) out.push(this.opt('give', o, { to: v.id }, `歸還${name(o)}給${name(w.objects.get(v.id))}`));
    }
    if (p.carrying) out.push({ verb: 'drop', label: '放下黃銅書', target: p.carrying, ok: true, run: () => this.dropBook() });
    for (const o of near) {
      for (const verb of o.verbs) {
        if (verb === 'give') continue;
        if (verb === 'take' && o.heldBy) continue;
        if (o.type === 'book' && verb === 'move') { if (!p.carrying) out.push(this.opt('move', o, { to: [...p.cell] }, '搬起黃銅書')); continue; }
        if (o.type === 'cart' && verb === 'move') { const d = sub(o.pos, p.cell); if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) continue; const to = add(o.pos, d); if (g.blocked(to) || this.actorAt(to)) continue; out.push(this.opt('move', o, { to }, `推動${name(o)}`)); continue; }
        if (o.type === 'cart' && verb === 'use') { const hop = this.cartHop(o); if (!hop) continue; out.push(this.opt('use', o, {}, '踩推車翻過圍籬', () => this.place(hop))); continue; }
        if (o.type === 'fence' && verb === 'climb') { const d = sub(o.pos, p.cell); if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) continue; const land = add(o.pos, d); if (g.blocked(land)) continue; out.push(this.opt('climb', o, {}, `翻越${name(o)}`, () => this.place(land))); continue; }
        out.push(this.opt(verb, o, {}));
      }
    }
    // 門口：進入住宅
    const s = g.step(p.cell, front);
    if (s.enterHouse && s.ok) { const h = w.objects.get(s.enterHouse); out.push({ verb: 'enter', label: `進入${name(h)}`, target: h.id, ok: true, run: () => this.tryStep(p.facing) }); }
    return out;
  }
  opt(verb, o, ctx, label = null, after = null) {
    const c = this.world.check('outsider', verb, o.id, ctx);
    return { verb, target: o.id, label: label || `${LABEL[verb]}${name(o)}`, ok: c.possible, reason: c.reason, violates: c.violates.map(r => r.no), run: () => {
      const r = this.world.attempt('outsider', verb, o.id, ctx);
      if (r.done && verb === 'move' && o.type === 'book') { this.player.carrying = o.id; }
      if (r.done && after) after();
      return r;
    } };
  }
  /** 推車墊腳：玩家—推車—圍籬—落地 成一直線時可用。 */
  cartHop(cart) {
    const p = this.player, d = sub(cart.pos, p.cell);
    if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) return null;
    const fcell = add(cart.pos, d), land = add(fcell, d);
    const fence = [...this.world.objects.values()].find(o => o.type === 'fence' && o.pos && eq(o.pos, fcell) && o.state === 'intact');
    if (!fence || this.grid.blocked(land)) return null;
    return land;
  }
  dropBook() {
    const p = this.player, b = this.world.objects.get(p.carrying);
    const spots = [add(p.cell, p.facing), ...this.grid.neighbors(p.cell), p.cell].filter(c => !this.grid.blocked(c) || eq(c, p.cell));
    b.pos = [...spots[0]]; p.carrying = null;
    this.world.emit('object', { object: b, before: b.state });
    return { done: true };
  }
  actorAt(cell) { return [...this.world.actors.values()].find(a => eq(a.pos, cell)) || null; }
  /** 執行第 i 個選項（0 = E）。 */
  act(i = 0) {
    const o = this.options()[i]; if (!o) return null;
    if (!o.ok) { this.note('blocked', `做不到：${o.label}（${o.reason === 'state' ? '狀態不允許' : '不支援'}）`); return { done: false, reason: o.reason }; }
    return o.run();
  }
  /** 給 HUD／試玩腳本看的狀態摘要。 */
  status() {
    const p = this.player, w = this.world;
    return { t: +this.t.toFixed(1), cell: [...p.cell], house: p.house, inBroadcast: w.inBroadcast(p.cell), inRange: this.grid.inRange(p.cell), held: [...p.actor.held], carrying: p.carrying, rules: w.active().length, max: w.opt.max, resets: w.resets };
  }
}

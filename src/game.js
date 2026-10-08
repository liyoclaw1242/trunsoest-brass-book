// game.js —— 串接：引擎 World + Grid + 玩家移動與互動 + 事件紀錄。不碰 three.js（那在 view.js），不碰 DOM（那在 hud.js）。
import { num } from '../engine/rulebook-engine.js';
import { dist } from '../engine/grid.js';
import { createSession } from '../engine/session.js';

export const LABEL = { enter: '進入', use: '使用', open: '開啟', take: '取走', give: '歸還', break: '破壞', repair: '修復', move: '搬動', climb: '翻越', read: '閱讀', deface: '塗毀', approach: '靠近', run: '奔跑', capture: '抓捕' };
export const TYPE = { book: '黃銅書', lectern: '書台', speaker: '廣播器', notice: '公告牌', house: '住宅', door: '門', fence: '圍籬', cart: '推車', keepsake: '信物', boundary: '界石', villager: '村民', outsider: '外鄉人' };
export const STATE = { intact: '完好', broken: '損壞', closed: '關著', open: '開著', blank: '空白', written: '有字', defaced: '被塗毀', puppet: '人偶', half: '半同化', awake: '已喚醒', writing: '書寫中' };
export const INDUCE = { invite: '請他邀請我進屋', fetch: '請他去拿信物', book: '請他去搬書' };
export const name = o => o ? `${TYPE[o.type] || o.type}${o.id.replace(/^[a-z]+_?/, '') ? ' ' + o.id.split('_').pop() : ''}` : '';

const STEP = 0.25;                 // 走一格的秒數（村民追捕 0.22、加速 0.15）
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class Game {
  constructor(scene, meta, opt = {}) {
    this.meta = meta;
    this.session = createSession(scene, meta, opt);
    this.world = this.session.world;
    this.grid = this.session.grid;
    this.vil = this.session.villagers;
    this.villagers = this.vil.list;
    this.t = 0;
    this.log = [];
    this.listeners = [];
    const me = this.session.outsider;
    this.player = { actor: me, cell: [...meta.start], pos: [...meta.start], from: null, to: null, k: 0, facing: [0, -1], house: null, carrying: null };
    this.match = this.session.match;
    this.opening = 0;                  // 開場聽公告的秒數（期間不能動）
    this.hookEvents();
  }
  /** 按下開始：書頒布抓捕令，玩家站著聽完（4 秒）才能動。 */
  start(opt = {}) {
    if (this.match.started) return;
    this.world.outsiderArrived();
    this.match.start();
    this.opening = opt.opening ?? this.world.opt.announceSec;
    this.note('start', '黃銅書察覺了你。廣播器開始唸公告……');
  }
  get started() { return !!this.match.started; }
  get over() { return this.match.state !== 'playing'; }
  get invitedTo() { return this.player.actor.invitedTo; }
  set invitedTo(h) { this.player.actor.invitedTo = h; }
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
    w.on('captured', ({ actor }) => { this.note('captured', `你被${name(w.objects.get(actor.id))}抓住了，送回村子中心`, { actor: actor.id }); this.onCaptured(actor); });
    w.on('level', ({ actor, from, to, why }) => this.note('level', `${name(w.objects.get(actor.id))}從${STATE[from]}變成${STATE[to]}（${why === 'quiet' ? '太久沒聽到廣播' : why === 'keepsake' ? '收到自己的信物' : why}）`, { actor: actor.id, from, to, why }));
    w.on('induce', ({ actor, kind }) => this.note('induce', `${name(w.objects.get(actor.id))}答應了：${INDUCE[kind]}`, { actor: actor.id, kind }));
    w.on('induceFail', ({ actor }) => this.note('refuse', `${name(w.objects.get(actor.id))}是人偶，聽不進去`, { actor: actor.id }));
    w.on('invited', ({ actor, house }) => this.note('invited', `${name(w.objects.get(actor.id))}邀請你進${name(w.objects.get(house))}`, { actor: actor.id, house }));
    w.on('taskFail', ({ actor, kind, why }) => this.note('refuse', `${name(w.objects.get(actor.id))}做不到：${INDUCE[kind]}（${why === 'path' ? '走不到' : why === 'refused' ? '違反規則' : why}）`, { actor: actor.id, kind, why }));
    w.on('bookMoved', ({ actor, pos }) => this.note('object', `${name(w.objects.get(actor.id))}把黃銅書搬到 (${pos})`, { actor: actor.id, pos }));
    w.on('stuck', ({ actor }) => this.note('stuck', `${name(w.objects.get(actor.id))}過不去，先放棄`, { actor: actor.id }));
    w.on('assim', ({ from, to, why }) => this.note('assim', to > from ? `同化度 ${from}→${to}（被抓）` : `同化度 ${from}→${to}（安靜處消退）`, { from, to, why }));
    w.on('idleWrite', ({ rule }) => this.note('idle', `書閒不住，自己動筆了：第${num(rule.no)}條`, { no: rule.no }));
    w.on('end', ({ state, reason, stats }) => this.note('end', state === 'won' ? '你走出了影響範圍。' : reason === 'assimilated' ? '你被同化了。' : '書活過來了。', { state, reason, stats }));
    w.on('act', ({ actor, verb, target }) => this.note('act', `${actor.id === 'outsider' ? '你' : name(w.objects.get(actor.id))}${LABEL[verb]}了${name(target) || ''}`, { actor: actor.id, verb, target: target?.id }));
  }

  // ---------- 玩家移動 ----------
  get moving() { return !!this.player.to; }
  /** 試著往 dir 走一格。回傳 'ok' | 'moving' | 'blocked' | 'refused'。 */
  tryStep(dir) {
    const p = this.player;
    if (p.to) return 'moving';
    if (!this.started || this.over || this.opening > 0) return 'frozen';
    p.facing = dir;
    const next = add(p.cell, dir);
    const s = this.grid.step(p.cell, next);
    if (!s.ok) return 'blocked';
    // 靠近黃銅書（從不相鄰走到相鄰）算一次 approach
    const book = [...this.world.objects.values()].find(o => o.type === 'book');
    if (book && book.pos && !book.heldBy && cheb(next, book.pos) <= 1 && cheb(p.cell, book.pos) > 1) this.world.attempt('outsider', 'approach', book.id, {});
    if (s.enterHouse) {
      const h = this.world.objects.get(s.enterHouse);
      const ctx = this.invitedTo === h.id ? { invited: true } : { uninvited: true };
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
  onCaptured(actor) {
    if (this.player.carrying) this.dropBook();
    this.place(this.meta.start);
    this.captures = (this.captures || 0) + 1;
  }
  afterArrive() {
    const p = this.player;
    const h = this.grid.houseAt(p.cell);
    if (h !== p.house) { if (p.house && this.invitedTo === p.house) this.invitedTo = null; p.house = h; }
  }
  tick(dt) {
    if (!this.started) return;
    if (this.opening > 0) this.opening = Math.max(0, this.opening - dt);
    this.t += dt;
    const p = this.player;
    if (p.to) {
      p.k += dt / STEP;
      if (p.k >= 1) { p.cell = p.to; p.pos = [...p.to]; p.to = p.from = null; p.actor.pos = [...p.cell]; this.afterArrive(); }
      else p.pos = [p.from[0] + (p.to[0] - p.from[0]) * p.k, p.from[1] + (p.to[1] - p.from[1]) * p.k];
    }
    if (p.carrying) { const b = this.world.objects.get(p.carrying); b.pos = [...p.cell]; }
    this.session.tick(dt);
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
    // 誘導相鄰的村民
    for (const v of this.villagers) if (cheb(v.pos, p.cell) <= 1) {
      const vo = w.objects.get(v.id);
      if (!this.vil.inducible(v)) { out.push({ verb: 'induce', target: v.id, label: `${name(vo)}是人偶，無法誘導`, ok: false, reason: 'state', violates: [], run: () => ({ done: false }) }); continue; }
      for (const o of this.vil.induceOptions(v)) out.push({ verb: 'induce', kind: o.kind, target: v.id, label: `${o.label}（${name(vo)}）`, ok: true, violates: [], run: () => ({ done: this.vil.induce(v, o.kind) }) });
    }
    for (const o of near) {
      for (const verb of o.verbs) {
        if (verb === 'give' || verb === 'approach' || verb === 'capture') continue;
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
    if (!this.started || this.over || this.opening > 0) return { done: false, reason: 'frozen' };
    const o = this.options()[i]; if (!o) return null;
    if (!o.ok) { this.note('blocked', `做不到：${o.label}（${o.reason === 'state' ? '狀態不允許' : '不支援'}）`); return { done: false, reason: o.reason }; }
    return o.run();
  }
  /** 現在的廣播：{ rule, progress, hearing }，沒在廣播回傳 null。 */
  broadcast() {
    const n = this.world.now; if (!n) return null;
    return { rule: this.world.rule(n.no), progress: 1 - n.left / this.world.opt.announceSec, hearing: n.listeners.has('outsider') };
  }
  /** 從玩家所在格到最近「聽不到廣播」的可走格要走幾步，以及那一格。 */
  quietCell() {
    const w = this.world, g = this.grid;
    if (!w.inBroadcast(this.player.cell)) return { steps: 0, cell: [...this.player.cell] };
    const r = g.minCost(this.player.cell, c => !w.inBroadcast(c), () => true, c => !g.blocked(c));
    return r ? { steps: r.cost, cell: r.cell, path: r.path } : null;
  }
  /** 受規則保護的物件 id：帶 actorId 只算該角色認知到的；不帶是客觀的（設計者視角）。 */
  protectedIds(actorId = 'outsider') {
    return [...this.world.objects.values()].filter(o => o.pos && this.world.protectedBy(o.id, actorId).length).map(o => o.id);
  }
  /** 設計者視角用：每條規則與誰認知到它。 */
  designerRules() {
    return this.world.rules.map(r => ({ no: r.no, key: r.key, text: r.text, hole: r.hole || (r.kind === 'ruling' ? '依附的條文被撕掉就成廢文。' : ''), void: r.void, dead: r.dead, mode: r.mode, verb: r.verb, who: r.who,
      knownBy: [...this.world.actors.values()].filter(a => a.known.has(r.no)).map(a => a.id) }));
  }
  /** 給 HUD／試玩腳本看的狀態摘要。 */
  status() {
    const p = this.player, w = this.world;
    return { t: +this.t.toFixed(1), state: this.match.state, reason: this.match.reason, assim: this.match.assim, assimMax: this.match.opt.loseAssim, opening: Math.ceil(this.opening * 10) / 10, stats: { ...this.match.stats }, cell: [...p.cell], house: p.house, inBroadcast: w.inBroadcast(p.cell), inRange: this.grid.inRange(p.cell), held: [...p.actor.held], carrying: p.carrying, rules: w.active().length, max: w.opt.max, resets: w.resets, invitedTo: this.invitedTo, captures: this.captures || 0,
      villagers: this.villagers.map(v => ({ id: v.id, pos: [...v.pos], level: v.level, mode: v.mode, hunting: this.vil.hunts(v), task: v.task?.kind || null, quiet: +v.quiet.toFixed(1) })) };
  }
}

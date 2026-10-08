// game.js —— 串接（原型三）：引擎 session + 玩家移動與互動 + 事件紀錄。不碰 three.js（view.js），不碰 DOM（hud.js）。
import { num } from '../engine/rulebook-engine.js';
import { dist } from '../engine/grid.js';
import { createSession } from '../engine/session.js';

export const LABEL = { induce: '誘導', enter: '進入', use: '使用', open: '開啟', take: '取走', give: '歸還', break: '破壞', repair: '修復', move: '搬動', climb: '翻越', read: '閱讀', deface: '塗毀', approach: '靠近', run: '奔跑', capture: '抓捕', leave: '離開', walk: '行走', wear: '穿上', light: '點燈', stay: '待在', drop: '放下' };
export const TYPE = { book: '黃銅書', lectern: '書台', speaker: '廣播器', notice: '公告牌', house: '住宅', door: '門', fence: '圍籬', cart: '推車', keepsake: '信物', boundary: '界石', villager: '村民', outsider: '外鄉人', lamppost: '燈柱', clothes: '衣物', lamp: '提燈', wild: '野地' };
export const STATE = { intact: '完好', broken: '損壞', closed: '關著', open: '開著', blank: '空白', written: '有字', defaced: '被塗毀', puppet: '人偶', half: '半同化', awake: '已喚醒', writing: '書寫中', unlit: '未點', lit: '亮著', worn: '穿著' };
export const INDUCE = { invite: '請他邀請我進屋', fetch: '請他去拿信物', book: '請他去搬書' };
export const name = o => o ? `${TYPE[o.type] || o.type}${o.id.includes('_') ? ' ' + o.id.split('_').pop() : ''}` : '';

const STEP = 0.25, RUN_STEP = 0.14;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class Game {
  constructor(scene, meta, opt = {}) {
    this.meta = meta;
    this.session = createSession(scene, meta, opt);
    this.world = this.session.world; this.grid = this.session.grid; this.vil = this.session.villagers; this.villagers = this.vil.list; this.match = this.session.match;
    this.t = 0; this.log = []; this.listeners = [];
    const me = this.session.outsider;
    this.player = { actor: me, cell: [...meta.start], pos: [...meta.start], from: null, to: null, k: 0, facing: [0, -1], house: null, carrying: null, running: false, walkT: 0, runT: 0 };
    me.house = null;
    this.opening = 0;
    this.hookEvents();
    this.world.on('teleported', ({ to }) => { if (this.player.carrying) this.dropBook(); this.place(to); this.note('teleport', '你走出了此地的邊界，黃銅書把你送回了中心。', { to }); });
  }
  get invitedTo() { return this.player.actor.invitedTo; }
  set invitedTo(h) { this.player.actor.invitedTo = h; }
  get started() { return !!this.match.started; }
  get over() { return this.match.state !== 'playing'; }
  start(opt = {}) {
    if (this.match.started) return;
    this.world.outsiderArrived();
    this.match.start();
    this.opening = opt.opening ?? this.world.opt.announceSec;
    this.note('start', '黃銅書察覺了你。廣播器開始唸第一條：任何存在不得離開此地。');
  }
  on(fn) { this.listeners.push(fn); }
  note(type, text, data = {}) { const e = { t: +this.t.toFixed(2), type, text, ...data }; this.log.push(e); for (const fn of this.listeners) fn(e); }
  hookEvents() {
    const w = this.world, N = id => id === 'outsider' ? '你' : name(w.objects.get(id));
    w.on('write', ({ rule }) => this.note('write', `書寫下第${num(rule.no)}條：${rule.text}`, { no: rule.no }));
    w.on('reset', ({ gone }) => this.note('reset', `—— 以上規則無效 ——（撕掉 ${gone.length} 條${gone.some(r => r.key === 'no-leave') ? '，包括「不得離開此地」' : ''}）`, { gone: gone.map(r => r.no) }));
    w.on('broadcastStart', ({ rule }) => this.note('broadcast', `廣播開始：第${num(rule.no)}條`, { no: rule.no }));
    w.on('broadcastEnd', ({ rule, learned, silenced }) => { if (silenced) this.note('silence', '夜幕落下，廣播器沉默了。'); else if (learned.length) this.note('learn', `聽完第${num(rule.no)}條：${learned.map(N).join('、')}認知了`, { no: rule.no, learned }); });
    w.on('phase', ({ phase }) => this.note('phase', phase === 'night' ? '天黑了。廣播器靜音，村民回家，守夜的人偶點起燈。' : '天亮了。廣播器開始補唸夜裡寫下的條文。', { phase }));
    w.on('violation', ({ actor, verb, target, rules }) => this.note('violation', `${N(actor.id)}違反了第${rules.map(r => num(r.no)).join('、')}條（${LABEL[verb]}${name(target)}）`, { actor: actor.id, verb, target: target?.id, rules: rules.map(r => r.no) }));
    w.on('witness', ({ actor, verb, rules }) => this.note('witness', `${N(actor.id)}看見你${LABEL[verb]}，違反第${rules.map(r => num(r.no)).join('、')}條——追你！`, { actor: actor.id, verb, rules: rules.map(r => r.no) }));
    w.on('witnessIgnored', ({ actor, verb, rules }) => this.note('witnessIgnored', `${N(actor.id)}看見你${LABEL[verb]}違規，但他不抓人`, { actor: actor.id, verb }));
    w.on('lost', ({ actor }) => this.note('lost', `${N(actor.id)}跟丟了你，回家去`, { actor: actor.id }));
    w.on('sleep', ({ actor }) => this.note('sleep', `${N(actor.id)}回家睡了`, { actor: actor.id }));
    w.on('conflict', ({ actor, verb, forbid, permit }) => this.note('conflict', `第${num(forbid.no)}條與第${num(permit.no)}條衝突，這次不追究（${LABEL[verb]}）`, { actor: actor.id, verb }));
    w.on('refuse', ({ actor, verb, target, rules }) => this.note('refuse', `${N(actor.id)}拒絕${LABEL[verb]}${name(target)}：第${rules.map(r => num(r.no)).join('、')}條`, { actor: actor.id, verb, target: target?.id }));
    w.on('object', ({ object: o, before }) => {
      const what = o.state !== before ? `變成${STATE[o.state] || o.state}` : o.heldBy ? `被${N(o.heldBy)}拿著` : o.pos ? `移到 (${o.pos})` : '';
      this.note('object', `${name(o)}${what}`, { id: o.id, state: o.state, pos: o.pos, heldBy: o.heldBy });
    });
    w.on('captured', ({ actor }) => { this.note('captured', `你被${N(actor.id)}抓住了，送回村子中心`, { actor: actor.id }); if (this.player.carrying) this.dropBook(); this.place(this.meta.start); });
    w.on('level', ({ actor, from, to, why }) => this.note('level', `${N(actor.id)}從${STATE[from]}變成${STATE[to]}（${why === 'quiet' ? '太久沒聽到廣播' : why === 'keepsake' ? '收到自己的信物' : why}）`, { actor: actor.id, from, to, why }));
    w.on('induce', ({ actor, kind }) => this.note('induce', `${N(actor.id)}答應了：${INDUCE[kind]}`, { actor: actor.id, kind }));
    w.on('induceFail', ({ actor, reason }) => this.note('refuse', reason === 'cooldown' ? `${N(actor.id)}剛幫過你，現在不想理你` : reason === 'nothing' ? '地上沒有信物可拿了' : reason === 'sleeping' ? `${N(actor.id)}睡著了` : `${N(actor.id)}是人偶，聽不進去`, { actor: actor.id, reason }));
    w.on('blockedByRule', ({ actor, house, rules }) => { const known = rules.filter(r => this.player.actor.known.has(r.no)); this.note('protected', `${N(actor.id)}在${name(w.objects.get(house))}門口停下（${known.length ? `第${known.map(r => num(r.no)).join('、')}條擋著他：${known[0].text}` : '似乎有規則擋著他'}）`, { actor: actor.id, house }); });
    w.on('invited', ({ actor, house }) => this.note('invited', `${N(actor.id)}邀請你進${name(w.objects.get(house))}`, { actor: actor.id, house }));
    w.on('taskFail', ({ actor, kind, why }) => this.note('refuse', `${N(actor.id)}做不到：${INDUCE[kind]}（${why === 'path' ? '走不到' : why === 'refused' ? '違反規則' : why}）`, { actor: actor.id, kind, why }));
    w.on('bookMoved', ({ actor, pos }) => this.note('object', `${N(actor.id)}把黃銅書搬到 (${pos})`, { actor: actor.id, pos }));
    w.on('stuck', ({ actor }) => this.note('stuck', `${N(actor.id)}過不去，先放棄`, { actor: actor.id }));
    w.on('assim', ({ from, to, why }) => this.note('assim', to > from ? `同化度 ${from}→${to}（被抓）` : `同化度 ${from}→${to}（安靜處消退）`, { from, to, why }));
    w.on('idleWrite', ({ rule }) => this.note('idle', `書閒不住，自己動筆了：第${num(rule.no)}條`, { no: rule.no }));
    w.on('end', ({ state, reason, stats }) => this.note('end', state === 'won' ? (reason === 'escaped-unheard' ? '你趁書還沒重新公告「不得離開」就走了出去。' : '你走出了此地。') : reason === 'assimilated' ? '你被同化了。' : '書活過來了。', { state, reason, stats }));
    w.on('act', ({ actor, verb, target }) => this.note('act', `${N(actor.id)}${LABEL[verb]}了${name(target) || ''}`, { actor: actor.id, verb, target: target?.id }));
  }

  // ---------- 玩家移動 ----------
  get moving() { return !!this.player.to; }
  tryStep(dir, running = false) {
    const p = this.player;
    if (p.to) return 'moving';
    if (!this.started || this.over || this.opening > 0) return 'frozen';
    p.facing = dir;
    const next = add(p.cell, dir);
    const s = this.grid.step(p.cell, next);
    if (!s.ok) return 'blocked';
    const w = this.world;
    if (s.enterHouse) {
      const h = w.objects.get(s.enterHouse);
      const r = w.attempt('outsider', 'enter', h.id, this.invitedTo === h.id ? { invited: true } : { uninvited: true });
      if (!r.done) return 'refused';
    }
    if (s.leaveHouse) w.attempt('outsider', 'leave', s.leaveHouse, {});
    if (this.grid.zone(next) === 'wild' && this.grid.zone(p.cell) !== 'wild') w.attempt('outsider', 'enter', 'wild', {});
    const book = [...w.objects.values()].find(o => o.type === 'book');
    if (book && book.pos && !book.heldBy && cheb(next, book.pos) <= 1 && cheb(p.cell, book.pos) > 1) w.attempt('outsider', 'approach', book.id, {});
    const bnear = [...w.objects.values()].find(o => o.type === 'boundary' && cheb(next, o.pos) <= 1);
    if (bnear && ![...w.objects.values()].some(o => o.type === 'boundary' && cheb(p.cell, o.pos) <= 1)) w.attempt('outsider', 'approach', bnear.id, {});
    // 行走／奔跑這種持續動作：每 2 秒算一次
    p.running = running;
    if (running) { if (this.t - p.runT > 2) { p.runT = this.t; w.attempt('outsider', 'run', null, {}); } }
    else if (this.t - p.walkT > 2) { p.walkT = this.t; w.attempt('outsider', 'walk', null, {}); }
    p.from = [...p.cell]; p.to = next; p.k = 0; p.stepSec = running ? RUN_STEP : STEP;
    return 'ok';
  }
  place(cell) {
    const p = this.player;
    p.cell = [...cell]; p.pos = [...cell]; p.from = p.to = null; p.k = 0; p.actor.pos = [...cell];
    this.afterArrive();
  }
  afterArrive() {
    const p = this.player, h = this.grid.houseAt(p.cell);
    if (h !== p.house) { if (p.house && this.invitedTo === p.house) this.invitedTo = null; p.house = h; p.actor.house = h; }
  }
  tick(dt) {
    if (!this.started) return;
    if (this.opening > 0) this.opening = Math.max(0, this.opening - dt);
    this.t += dt;
    const p = this.player;
    if (p.to) {
      p.k += dt / (p.stepSec || STEP);
      if (p.k >= 1) { p.cell = p.to; p.pos = [...p.to]; p.to = p.from = null; p.actor.pos = [...p.cell]; this.afterArrive(); }
      else p.pos = [p.from[0] + (p.to[0] - p.from[0]) * p.k, p.from[1] + (p.to[1] - p.from[1]) * p.k];
    }
    if (p.carrying) { const b = this.world.objects.get(p.carrying); b.pos = [...p.cell]; }
    this.session.tick(dt);
  }

  // ---------- 互動 ----------
  options() {
    const p = this.player, w = this.world, g = this.grid, out = [];
    const front = add(p.cell, p.facing);
    const near = [...w.objects.values()].filter(o => o.pos && o.id !== 'outsider' && cheb(o.pos, p.cell) <= 1 && o.type !== 'house' && o.type !== 'villager')
      .sort((a, b) => (eq(a.pos, front) ? 0 : 1) - (eq(b.pos, front) ? 0 : 1) || dist(a.pos, p.cell) - dist(b.pos, p.cell));
    // 身上的東西
    for (const id of p.actor.held) {
      const o = w.objects.get(id);
      if (o.type === 'keepsake') {
        const nearV = this.villagers.filter(v => cheb(v.pos, p.cell) <= 1).sort((a, b) => (a.id === o.owner ? 0 : 1) - (b.id === o.owner ? 0 : 1));
        for (const v of nearV) out.push(this.opt('give', o, { to: v.id }, v.id === o.owner ? `把${name(o)}還給${name(w.objects.get(v.id))}（他的信物）` : `把${name(o)}交給${name(w.objects.get(v.id))}（不是他的）`));
      }
      if (o.type === 'clothes') { if (p.actor.wearing !== o.id) out.push(this.opt('wear', o, {}, `穿上${name(o)}（偽裝）`)); out.push(this.opt('drop', o, { to: this.dropSpot() }, p.actor.wearing === o.id ? `脫下${name(o)}` : `放下${name(o)}`)); }
      if (o.type === 'lamp') { out.push(this.opt('light', o, {}, o.state === 'lit' ? '熄滅提燈' : '點亮提燈')); out.push(this.opt('drop', o, { to: this.dropSpot() }, '放下提燈')); }
    }
    if (p.carrying) out.push({ verb: 'drop', label: '放下黃銅書', target: p.carrying, ok: true, violates: [], run: () => this.dropBook() });
    // 誘導相鄰的村民
    for (const v of this.villagers) if (cheb(v.pos, p.cell) <= 1) {
      const vo = w.objects.get(v.id);
      if (v.sleeping) { out.push({ verb: 'induce', target: v.id, label: `${name(vo)}睡著了`, ok: false, reason: 'state', violates: [], run: () => ({ done: false }) }); continue; }
      if (v.returning) { out.push({ verb: 'induce', target: v.id, label: `${name(vo)}正在回家`, ok: false, reason: 'state', violates: [], run: () => ({ done: false }) }); continue; }
      if (!this.vil.inducible(v)) { const cd = this.vil.cooldown(v); out.push({ verb: 'induce', target: v.id, label: v.level === 'puppet' ? `${name(vo)}是人偶，無法誘導` : `${name(vo)}剛幫過你（${Math.ceil(cd)} 秒後再試）`, ok: false, reason: 'state', violates: [], run: () => ({ done: false }) }); continue; }
      for (const o of this.vil.induceOptions(v)) {
        const viol = this.vil.wouldRefuse(v, o.kind).map(r => r.no);
        out.push({ verb: 'induce', kind: o.kind, target: v.id, label: `${o.label}（${name(vo)}）${viol.length ? `（他認知第${viol.map(num).join('、')}條，會拒絕）` : ''}`, ok: !viol.length, reason: viol.length ? 'rule' : null, violates: [], run: () => ({ done: this.vil.induce(v, o.kind) }) });
      }
    }
    for (const o of near) {
      for (const verb of o.verbs) {
        if (['give', 'approach', 'capture', 'drop', 'wear', 'light', 'enter', 'leave'].includes(verb)) continue;
        if (verb === 'take' && o.heldBy) continue;
        if (o.type === 'book' && verb === 'move') { if (!p.carrying) out.push(this.opt('move', o, { to: [...p.cell] }, '搬起黃銅書')); continue; }
        if (o.type === 'cart' && verb === 'move') { const d = sub(o.pos, p.cell); if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) continue; const to = add(o.pos, d); if (g.blocked(to) || this.actorAt(to)) continue; out.push(this.opt('move', o, { to }, `推動${name(o)}`)); continue; }
        if (o.type === 'cart' && verb === 'use') { const hop = this.cartHop(o); if (!hop) continue; out.push(this.opt('use', o, {}, '踩推車翻過圍籬', () => this.place(hop))); continue; }
        if (o.type === 'fence' && verb === 'climb') { const d = sub(o.pos, p.cell); if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) continue; const land = add(o.pos, d); if (g.blocked(land)) continue; out.push(this.opt('climb', o, {}, `翻越${name(o)}`, () => this.place(land))); continue; }
        out.push(this.opt(verb, o, {}));
      }
    }
    const s = g.step(p.cell, front);
    if (s.enterHouse && s.ok) { const h = w.objects.get(s.enterHouse); out.push({ verb: 'enter', label: `進入${name(h)}`, target: h.id, ok: true, violates: [], run: () => this.tryStep(p.facing) }); }
    return out.filter(o => o.ok).concat(out.filter(o => !o.ok));
  }
  dropSpot() { const p = this.player; return [add(p.cell, p.facing), ...this.grid.neighbors(p.cell)].find(c => !this.grid.blocked(c) && this.grid.houseAt(c) === p.house) || p.cell; }
  opt(verb, o, ctx, label = null, after = null) {
    const c = this.world.check('outsider', verb, o.id, ctx);
    return { verb, target: o.id, label: label || `${LABEL[verb]}${name(o)}`, ok: c.possible, reason: c.reason, violates: c.violates.map(r => r.no), run: () => {
      const r = this.world.attempt('outsider', verb, o.id, ctx);
      if (r.done && verb === 'move' && o.type === 'book') this.player.carrying = o.id;
      if (r.done && after) after();
      return r;
    } };
  }
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
    b.pos = [...this.dropSpot()]; p.carrying = null;
    this.world.emit('object', { object: b, before: b.state });
    return { done: true };
  }
  actorAt(cell) { return [...this.world.actors.values()].find(a => eq(a.pos, cell)) || null; }
  act(i = 0) {
    if (!this.started || this.over || this.opening > 0) return { done: false, reason: 'frozen' };
    const o = this.options()[i]; if (!o) return null;
    if (!o.ok) { this.note('blocked', `做不到：${o.label}（${o.reason === 'state' ? '狀態不允許' : o.reason === 'rule' ? '他會拒絕' : '不支援'}）`); return { done: false, reason: o.reason }; }
    return o.run();
  }
  broadcast() {
    const n = this.world.now; if (!n) return null;
    return { rule: this.world.rule(n.no), progress: 1 - n.left / this.world.opt.announceSec, hearing: n.listeners.has('outsider') };
  }
  quietCell() {
    const w = this.world, g = this.grid;
    if (!w.inBroadcast(this.player.cell)) return { steps: 0, cell: [...this.player.cell] };
    const r = g.minCost(this.player.cell, c => !w.inBroadcast(c), () => true, c => !g.blocked(c));
    return r ? { steps: r.cost, cell: r.cell, path: r.path } : null;
  }
  protectedIds(actorId = 'outsider') {
    return [...this.world.objects.values()].filter(o => {
      if (!o.pos) return false;
      if (o.type === 'villager') { const v = this.world.actors.get(o.id); return v && this.vil.wouldRefuse(v, 'fetch').some(r => !actorId || this.world.actors.get(actorId).known.has(r.no)); }
      if (o.type === 'house' && actorId && this.invitedTo === o.id) return false;
      return this.world.protectedBy(o.id, actorId).length > 0;
    }).map(o => o.id);
  }
  designerRules() {
    return this.world.rules.map(r => ({ no: r.no, key: r.key, text: r.text, hole: r.hole || (r.kind === 'ruling' ? '依附的條文被撕掉就成廢文。' : ''), void: r.void, dead: r.dead, mode: r.mode, verb: r.verb, who: r.who, cond: r.cond,
      knownBy: [...this.world.actors.values()].filter(a => a.known.has(r.no)).map(a => a.id) }));
  }
  status() {
    const p = this.player, w = this.world, me = p.actor;
    const nl = w.live('no-leave');
    return { t: +this.t.toFixed(1), state: this.match.state, reason: this.match.reason, assim: this.match.assim, assimMax: this.match.opt.loseAssim, opening: Math.ceil(this.opening * 10) / 10, stats: { ...this.match.stats },
      phase: w.phase(), untilPhase: Math.ceil(w.untilPhaseChange()), cell: [...p.cell], house: p.house, zone: this.grid.zone(p.cell), inBroadcast: w.inBroadcast(p.cell), inRange: this.grid.inRange(p.cell),
      held: [...me.held], wearing: me.wearing || null, lit: !!me.lit, carrying: p.carrying, rules: w.active().length, max: w.opt.max, resets: w.resets, invitedTo: this.invitedTo,
      noLeave: nl ? (me.known.has(nl.no) ? 'binding' : 'unheard') : 'void',
      villagers: this.villagers.map(v => ({ id: v.id, pos: [...v.pos], level: v.level, mode: v.mode, hunting: this.vil.hunts(v), sees: this.vil.seesOutsider(v), sleeping: v.sleeping, lit: v.lit, task: v.task?.kind || null, cooldown: +this.vil.cooldown(v).toFixed(1) })) };
  }
}

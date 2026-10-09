// game.js —— 串接（v2）：引擎 session（活性／勞動／同化／書）+ 玩家移動與互動 + 事件紀錄。不碰 three.js／DOM。
import { num } from '../engine/rulebook-engine.js';
import { dist } from '../engine/grid.js';
import { createSession } from '../engine/session.js';
import { TIER_CN, CAT_CN } from '../engine/rules.v2.js';
import { COMFORT_CN, COMFORT_BENEFIT } from '../engine/assimilation.js';
import { ENDINGS } from '../engine/match.js';

export const LABEL = { induce: '誘導', enter: '進入', use: '使用', open: '開啟', take: '取走', give: '給', break: '破壞', repair: '修復', move: '搬動', climb: '翻越', read: '閱讀', deface: '塗毀', approach: '靠近', run: '奔跑', capture: '抓捕', leave: '離開', walk: '行走', wear: '穿上', light: '點火', stay: '停留', drop: '放下', talk: '交談', greet: '問安', listen: '聆聽', reside: '居住', accept: '領受', harm: '傷害', invite: '邀請', tie: '繫上', lead: '牽引' };
export const TYPE = { book: '黃銅書', lectern: '書台', speaker: '廣播器', notice: '公告牌', house: '住宅', door: '門', fence: '圍籬', boundary: '界石', villager: '村民', outsider: '外鄉人', lamppost: '燈柱', clothes: '衣物', lamp: '提燈', library: '圖書館', workstation: '抄寫台', goat: '山羊', rope: '繩子', census: '戶籍冊', 'carved-stone': '刻字石', well: '水井', field: '田', granary: '穀倉', shop: '店鋪', post: '哨口', cart: '物流車' };
export const ROLE_CN = { farmer: '農夫', logistics: '物流業者', merchant: '商人', sheriff: '治安官', scribe: '書記', keeper: '穀倉管理員' };
export const STATE = { intact: '完好', broken: '損壞', closed: '關著', open: '開著', written: '有字', defaced: '被塗毀', puppet: '人偶', half: '半同化', awake: '已喚醒', torn: '撕破', frayed: '磨斷', unlit: '未點', lit: '亮著', worn: '穿著', destroyed: '毀壞' };
export const name = o => o ? `${TYPE[o.type] || o.type}${o.id.includes('_') && /\d/.test(o.id) ? ' ' + o.id.split('_').pop() : ''}` : '';

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
    this.player = { actor: me, cell: [...meta.start], pos: [...meta.start], from: null, to: null, k: 0, facing: [0, -1], house: null, carrying: null, running: false, walkT: 0, runT: 0, ledGoat: null, seenBook: false };
    me.house = null; me.comforts = this.match.assim.comforts;
    this.opening = 0;
    this.hints = []; this.shownHints = new Set(); this._hintSeen = {};
    this.hookEvents();
    this.match.on(e => { if (e.type === 'teleported') { if (this.player.carrying) this.dropBook(); this.place(e.to); this.note('teleport', '你被送回了村子中心。', {}); } });
  }
  get invitedTo() { return this.player.actor.invitedTo; }
  set invitedTo(h) { this.player.actor.invitedTo = h; }
  get started() { return !!this.match.started; }
  get over() { return this.match.state !== 'playing'; }
  start(opt = {}) {
    if (this.match.started) return;
    this.match.start();
    this.opening = opt.opening ?? this.world.opt.announceSec;
    this._lastStage = this.match.activity.stage;
    this.note('start', '黃銅書察覺了你。廣播器唸起第一條公告。');
    this.pushHint('book-here', '那本書在村子中央的圖書館裡（金色標記）。走進去能看到它——逃出村子、或把它搬到荒野深處放逐，是你的出路。');
  }
  on(fn) { this.listeners.push(fn); }
  note(type, text, data = {}) { const e = { t: +this.t.toFixed(2), type, text, ...data }; this.log.push(e); for (const fn of this.listeners) fn(e); }
  hookEvents() {
    const w = this.world, N = id => id === 'outsider' ? '你' : name(w.objects.get(id));
    w.on('write', ({ rule }) => { this.note('write', `書寫下第${num(rule.no)}條：${rule.text}`, { no: rule.no, tier: rule.tier }); if (this.started && this.opening <= 0) this.pushHint('first-write', '書開始立法了。看左上的「活性」量表——它一路在漲，滿了書就活過來、你被轉化。想辦法在那之前離開。'); });
    w.on('reset', ({ gone }) => { this.note('reset', `—— 以上規則無效 ——（撕掉 ${gone.length} 條）`, { gone: gone.map(r => r.no) }); this.pushHint('first-reset', '「以上規則無效」！界石的封印短暫失效，書要重寫才會封回——這就是逃出去的窗口。'); });
    w.on('faded', ({ faded }) => this.note('fade', `勞動減少，最舊的 ${faded.length} 條褪色失效`, { faded: faded.map(r => r.no) }));
    w.on('broadcastStart', ({ rule }) => this.note('broadcast', `廣播：第${num(rule.no)}條`, { no: rule.no }));
    w.on('broadcastEnd', ({ rule, learned, silenced }) => { if (silenced) this.note('silence', '夜幕落下，廣播器沉默。'); else if (learned && learned.length) this.note('learn', `聽完第${num(rule.no)}條：${learned.map(N).join('、')}認知了`, { no: rule.no, learned }); });
    w.on('phase', ({ phase }) => this.note('phase', phase === 'night' ? '天黑了。' : '天亮了。', { phase }));
    w.on('book:writing', ({ rule, sec }) => this.note('writing', `書提起筆（${TIER_CN[rule.tier]}，約 ${sec.toFixed(0)} 秒）……`, { tier: rule.tier }));
    w.on('violation', ({ actor, verb, target, rules }) => this.note('violation', `${N(actor.id)}違反了第${rules.map(r => num(r.no)).join('、')}條（${LABEL[verb] || verb}${name(target)}）`, { actor: actor.id, verb, rules: rules.map(r => r.no) }));
    w.on('witness', ({ actor, verb, rules }) => this.note('witness', `${N(actor.id)}看見你違規——追你！`, { actor: actor.id }));
    w.on('spotted', ({ actor }) => this.note('spotted', `${N(actor.id)}發現了你——追你！`, { actor: actor.id }));
    w.on('lost', ({ actor }) => this.note('lost', `${N(actor.id)}跟丟了你`, { actor: actor.id }));
    w.on('conflict', ({ actor, verb, forbid, permit }) => this.note('conflict', `第${num(forbid.no)}條與第${num(permit.no)}條衝突，這次不追究`, {}));
    w.on('refuse', ({ actor, verb, target, rules }) => this.note('refuse', `${N(actor.id)}拒絕${LABEL[verb] || verb}${name(target)}：第${rules.map(r => num(r.no)).join('、')}條`, {}));
    w.on('object', ({ object: o, before }) => { const what = o.state !== before ? `變成${STATE[o.state] || o.state}` : o.heldBy ? `被${N(o.heldBy)}拿著` : o.pos ? '移動了' : ''; this.note('object', `${name(o)}${what}`, { id: o.id, state: o.state }); });
    w.on('delivered', () => {});
    w.on('match:captured', () => {}); w.on('captured', ({ actor }) => { this.note('captured', `你被${actor ? N(actor.id) : '村民'}抓住，送回中心（同化度 +1）。村民會冷靜 5 秒，趁機離開。`, {}); if (this.player.carrying) this.dropBook(); this.pushHint('first-capture', '被抓會讓同化度 +1 並送回中心，到 5 就輸。送回後有 5 秒村民不追，趁這空檔離開中心。別讓認知到抓捕令的村民看見你違規。'); });
    w.on('level', ({ actor, from, to, why }) => this.note('level', `${N(actor.id)}從${STATE[from]}變成${STATE[to]}（${why === 'quiet' ? '太久沒聽廣播' : why === 'keepsake' ? '收到信物' : why === 'contagion' ? '受你感染' : why}）`, { actor: actor.id, to }));
    w.on('nudge', ({ actor }) => {});
    w.on('match:assim', (e) => { if (e.to > e.from) this.note('assim', `同化度 ${e.from}→${e.to}${e.why?.startsWith('comfort') ? '（接受了' + COMFORT_CN[e.why.split(':')[1]] + '）' : e.why === 'definition' ? '（你認知到自己已被當作市民）' : ''}`, { to: e.to }); });
    this._actAcc = 0;
    w.on('match:activity', ({ delta, why, to }) => {
      const R = { patch: '書補上了你鑽的漏洞', reset: '書撐過了一次重置', capture: '你被抓回來', wake: '有村民罷工了', ruling: '書多寫了裁決' };
      if (why === 'time') { this._actAcc += delta; return; }
      this.note('activity', `活性 ${delta > 0 ? '+' : ''}${delta.toFixed(0)}（${R[why] || why}）→ ${Math.round(to)}`, { to });
    });
    w.on('book:wrote', () => {});
    w.on('match:end', ({ state, reason, stats }) => this.note('end', `結局：${ENDINGS[state] || state}`, { state, reason, stats }));
  }

  // ---------- 移動 ----------
  get moving() { return !!this.player.to; }
  tryStep(dir, running = false) {
    const p = this.player, w = this.world;
    if (p.to) return 'moving';
    if (!this.started || this.over || this.opening > 0) return 'frozen';
    p.facing = dir;
    const next = add(p.cell, dir);
    const s = this.grid.step(p.cell, next);
    if (!s.ok) return 'blocked';
    const zone = this.grid.zone(next);
    // 邊界封印：有生效的「不得越過界石／離開」條文時，走不出影響範圍（重置撕掉它才打開窗口）
    if (!this.grid.inRange(next) && this.grid.inRange(p.cell) && this.boundarySealed()) { w.attempt('outsider', 'leave', null, { zone }); this.note('sealed', '界石擋住了你——「不得越過界石」還生效著。', {}); return 'sealed'; }
    if (s.enterHouse) { const h = w.objects.get(s.enterHouse); if (h.type === 'house') { const mine = this.player.ownHouse === h.id || this.invitedTo === h.id; const r = w.attempt('outsider', 'enter', h.id, mine ? { invited: true } : { uninvited: true, zone }); if (!r.done) return 'refused'; } else w.attempt('outsider', 'enter', s.enterHouse, { zone }); }
    if (this.grid.zone(next) === 'wild' && this.grid.zone(p.cell) !== 'wild') { this._wildT = this._wildT || 0; if (this.t - this._wildT > 30) { this._wildT = this.t; w.attempt('outsider', 'enter', 'wild', { zone: 'wild' }); } }
    // 行走／奔跑（持續動作，帶入 zone）
    p.running = running;
    const moveVerb = running ? 'run' : 'walk';
    const key = running ? 'runT' : 'walkT';
    if (this.t - p[key] > 1.5) { p[key] = this.t; w.attempt('outsider', moveVerb, null, { zone }); }
    // 靠近界石／書
    const bnear = [...w.objects.values()].find(o => o.type === 'boundary' && cheb(next, o.pos) <= 1);
    if (bnear && ![...w.objects.values()].some(o => o.type === 'boundary' && cheb(p.cell, o.pos) <= 1)) {
      this._appr = this._appr || {};
      if (!this._appr[bnear.id] || this.t - this._appr[bnear.id] > 30) { this._appr[bnear.id] = this.t; w.attempt('outsider', 'approach', bnear.id, { zone }); }   // 同一塊界石 30 秒內只算一次，不讓人在界石旁 farm 逼寫
    }
    const book = [...w.objects.values()].find(o => o.type === 'book');
    if (book && book.pos && !book.heldBy && cheb(next, book.pos) <= 1 && cheb(p.cell, book.pos) > 1) w.attempt('outsider', 'approach', book.id, { zone });
    p.from = [...p.cell]; p.to = next; p.k = 0; p.stepSec = p.carrying ? 0.6 : running ? RUN_STEP : STEP;   // 搬書走得慢（放逐要付時間代價）
    return 'ok';
  }
  place(cell) { const p = this.player; p.cell = [...cell]; p.pos = [...cell]; p.from = p.to = null; p.k = 0; p.actor.pos = [...cell]; this.afterArrive(); }
  afterArrive() { const p = this.player, h = this.grid.houseAt(p.cell); if (h !== p.house) { if (p.house && this.invitedTo === p.house) this.invitedTo = null; p.house = h; p.actor.house = h; } const book = [...this.world.objects.values()].find(o => o.type === 'book'); if (book && book.pos && cheb(p.cell, book.pos) <= 1) p.seenBook = true; }
  tick(dt) {
    if (!this.started) return;
    if (this.opening > 0) this.opening = Math.max(0, this.opening - dt);
    this.t += dt;
    const p = this.player;
    if (p.to) { p.k += dt / (p.stepSec || STEP); if (p.k >= 1) { p.cell = p.to; p.pos = [...p.to]; p.to = p.from = null; p.actor.pos = [...p.cell]; this.afterArrive(); } else p.pos = [p.from[0] + (p.to[0] - p.from[0]) * p.k, p.from[1] + (p.to[1] - p.from[1]) * p.k]; }
    this.player.actor.carryingBook = !!p.carrying;
    if (p.carrying) { const b = this.world.objects.get(p.carrying); b.pos = [...p.cell]; }
    if (p.ledGoat) { const g = this.world.objects.get(p.ledGoat); if (g) g.pos = [...sub(p.cell, p.facing)]; }
    const st = this.match.activity.stage;
    if (this._lastStage && this._lastStage !== st) { if (st === 'mid') this.pushHint('stage-mid', '書進入「中期」：開始要求你照它的方式生活（義務類條文）。照做會讓你更像市民。'); if (st === 'late') this.pushHint('stage-late', '書進入「後期」：開始改寫「誰算市民」。小心別聽到剛好套在你身上的那一條定義。'); }
    this._lastStage = st;
    if (this.started && this.opening <= 0 && !this.shownHints.has('first-merchant')) { const near = this.villagers.find(v => !v.dead && cheb(v.pos, this.player.cell) <= 1 && this.vil.comfortOffers(v).length); if (near) this.pushHint('first-merchant', '市集的商人會給你好處（名字、衣物、房子、工作）。按 E 領受更舒適，但也更接近被同化、更可能符合後期的『市民』定義。'); }
    this.session.tick(dt);
    // 時間分每累積約 1 點就報一次（讓玩家把活性和勞動連起來）
    if (this._actAcc >= 1) { this._actAcc = 0; this.note('activity', `活性隨時間上升（${this.match.economy.workers()} 人在勞動）→ ${Math.round(this.match.activity.value)}`, {}); }
    // 放逐代價：外鄉人親自搬書，每 20 秒同化度 +1
    if (this.player.carrying) { this._carryT = (this._carryT || 0) + dt; if (this._carryT >= 20) { this._carryT = 0; this.match.assim.set(this.match.assim.value + 1, 'carry'); this.note('assim', '你搬著書太久，同化度 +1', {}); } } else this._carryT = 0;
  }

  // ---------- 互動 ----------
  options() {
    const p = this.player, w = this.world, g = this.grid, out = [];
    const front = add(p.cell, p.facing);
    const near = [...w.objects.values()].filter(o => o.pos && o.id !== 'outsider' && cheb(o.pos, p.cell) <= 1 && !['house', 'library', 'villager'].includes(o.type))
      .sort((a, b) => (eq(a.pos, front) ? 0 : 1) - (eq(b.pos, front) ? 0 : 1) || dist(a.pos, p.cell) - dist(b.pos, p.cell));
    // 村民：舒適提供、誘導
    for (const v of this.villagers) if (!v.dead && cheb(v.pos, p.cell) <= 1) {
      const vo = w.objects.get(v.id);
      for (const offer of this.vil.comfortOffers(v)) out.push({ verb: 'accept', target: v.id, kind: offer, label: `接受${COMFORT_CN[offer]}（${name(vo)}提供：${COMFORT_BENEFIT[offer]}）`, ok: true, violates: [], run: () => this.acceptComfort(offer, v) });
    }
    // 放棄舒適
    for (const c of this.match.assim.comforts) out.push({ verb: 'drop', target: 'comfort:' + c, label: `放棄${COMFORT_CN[c]}（之後同化度才能再降）`, ok: true, violates: [], run: () => { this.match.assim.give_up(c); this.note('drop', `你放棄了${COMFORT_CN[c]}`, {}); return { done: true }; } });
    // 手上的東西
    for (const id of p.actor.held) {
      const o = w.objects.get(id);
      if (o.type === 'clothes') { if (p.actor.wearing !== o.id) out.push(this.opt('wear', o, {}, `穿上${name(o)}`)); out.push({ verb: 'drop', target: id, label: '放下衣物', ok: true, violates: [], run: () => this.dropItem(id) }); }
      if (o.type === 'lamp') { out.push(this.opt('light', o, {}, o.state === 'lit' ? '熄滅提燈' : '點亮提燈')); out.push({ verb: 'drop', target: id, label: '放下提燈', ok: true, violates: [], run: () => this.dropItem(id) }); }
      if (o.type === 'rope') out.push({ verb: 'drop', target: id, label: '放下繩子', ok: true, violates: [], run: () => this.dropItem(id) });
    }
    if (p.carrying) out.push({ verb: 'drop', target: p.carrying, label: '放下黃銅書', ok: true, violates: [], run: () => this.dropBook() });
    if (p.ledGoat) out.push({ verb: 'drop', target: p.ledGoat, label: '放開山羊', ok: true, violates: [], run: () => { p.ledGoat = null; return { done: true }; } });
    // 場景物件
    for (const o of near) {
      for (const verb of o.verbs) {
        if (['give', 'approach', 'capture', 'drop', 'wear', 'light', 'enter', 'leave', 'accept'].includes(verb)) continue;
        if (verb === 'take' && o.heldBy) continue;
        if (o.type === 'book' && verb === 'move') { if (!p.carrying) out.push(this.opt('move', o, { to: [...p.cell] }, '搬起黃銅書')); continue; }
        if (o.type === 'fence' && verb === 'climb') { const d = sub(o.pos, p.cell); if (Math.abs(d[0]) + Math.abs(d[1]) !== 1) continue; const land = add(o.pos, d); if (g.blocked(land)) continue; out.push(this.opt('climb', o, {}, `翻越${name(o)}`, () => this.place(land))); continue; }
        if (o.type === 'goat' && verb === 'tie') { if (!p.actor.held.some(id => w.objects.get(id).type === 'rope')) continue; out.push(this.opt('tie', o, {}, '用繩子繫住山羊', () => { o.tied = true; })); continue; }
        if (o.type === 'goat' && verb === 'lead') { if (!o.tied) continue; out.push(this.opt('lead', o, {}, '牽著山羊走', () => { p.ledGoat = o.id; })); continue; }
        if (o.type === 'book' && verb === 'break') continue;   // 書的損毀另走隕石
        out.push(this.opt(verb, o, {}));
      }
      // 把書放到山羊背上（放逐用）
      if (o.type === 'goat' && p.carrying) out.push({ verb: 'load', target: o.id, label: '把黃銅書馱到山羊背上', ok: true, violates: [], run: () => { o.carrying = p.carrying; p.carrying = null; this.note('load', '黃銅書馱到了山羊背上', {}); return { done: true }; } });
    }
    const s = g.step(p.cell, front);
    if (s.enterHouse && s.ok) { const h = w.objects.get(s.enterHouse); out.push({ verb: 'enter', label: `進入${name(h)}`, target: h.id, ok: true, violates: [], run: () => this.tryStep(p.facing) }); }
    return out.filter(o => o.ok).concat(out.filter(o => !o.ok));
  }
  opt(verb, o, ctx, label = null, after = null) {
    const c = this.world.check('outsider', verb, o.id, { zone: this.grid.zone(this.player.cell), ...ctx });
    return { verb, target: o.id, label: label || `${LABEL[verb] || verb}${name(o)}`, ok: c.possible, reason: c.reason, violates: c.violates.map(r => r.no), run: () => {
      const r = this.world.attempt('outsider', verb, o.id, { zone: this.grid.zone(this.player.cell), ...ctx });
      if (r.done && verb === 'move' && o.type === 'book') this.player.carrying = o.id;
      if (r.done && verb === 'take') this.player.actor.held.includes(o.id);
      if (r.done && after) after();
      return r;
    } };
  }
  acceptComfort(item, v) {
    const benefit = this.match.assim.accept(item);
    v.chaseUntil = 0;   // 收下好處時，提供的村民不再追你（名字只該 +1，不該順便被抓）
    if (item === 'house') { const h = [...this.world.objects.values()].find(o => o.type === 'house' && o.owner === v.id); if (h) { this.player.ownHouse = h.id; this.invitedTo = h.id; h.owner = 'outsider'; } }
    if (item === 'name' && [...this.world.objects.values()].some(o => o.type === 'census' && o.state !== 'torn')) { this.match.flags.inCensus = true; this.note('census', '你的新名字被登記進了戶籍冊。', {}); }
    if (item === 'job') this.match.flags.worked = true;
    this.note('accept', `你接受了${COMFORT_CN[item]}（同化度 +1）：${benefit}`, { item });
    return { done: true };
  }
  dropItem(id) { const o = this.world.objects.get(id); this.world.attempt('outsider', 'drop', id, { to: this.dropSpot() }); return { done: true }; }
  dropSpot() { const p = this.player; return [add(p.cell, p.facing), ...this.grid.neighbors(p.cell)].find(c => !this.grid.blocked(c)) || p.cell; }
  dropBook() { const p = this.player, b = this.world.objects.get(p.carrying); b.pos = [...this.dropSpot()]; p.carrying = null; this.world.emit('object', { object: b, before: b.state }); return { done: true }; }
  actorAt(cell) { return [...this.world.actors.values()].find(a => eq(a.pos, cell)) || null; }
  act(i = 0) { if (!this.started || this.over || this.opening > 0) return { done: false, reason: 'frozen' }; const o = this.options()[i]; if (!o) return null; if (!o.ok) { this.note('blocked', `做不到：${o.label}`, {}); return { done: false, reason: o.reason }; } return o.run(); }

  boundarySealed() { const me = this.player.actor; return this.world.active().some(r => ((r.verb === 'leave' && r.mode !== 'permit') || r.key === 'c-boundary') && me.known.has(r.no)); }
  /** 一次性提示：同一 key 只顯示一次。 */
  pushHint(key, text) { if (this.shownHints.has(key)) return; this.shownHints.add(key); this.hints.push({ key, text, t: this.t }); this.note('hint', text, { key }); }
  /** 畫面端取最新未過期的提示。 */
  currentHint(life = 9) { const h = this.hints[this.hints.length - 1]; return h && this.t - h.t < life ? h : null; }
  /** 目前目標（常駐一行，依狀態更新）。 */
  objective() {
    const m = this.match;
    if (!this.started) return '';
    if (this.opening > 0) return '站著聽完書的第一條公告——先弄清楚這裡的規矩。';
    if (m.state !== 'playing') return '';
    if (!this.boundarySealed()) return '界石的封印失效了——趁現在走出影響範圍（白色虛線圈）！';
    if (!this.player.seenBook) return '先去村子中央的圖書館，找到那本黃銅書（跟著畫面上的金色標記）。走進去就看得到。';
    if (m.assim.value >= m.assim.opt.max - 1) return `同化度 ${m.assim.value}/${m.assim.opt.max}，快到頂了！躲到聽不到廣播的地方讓它退下來。`;
    return '趁書重寫規則的空檔走出影響範圍逃走，或把黃銅書搬到荒野深處放逐它。小心巡邏的治安官。';
  }
  /** 畫面標記：重要地標（書、山羊、隕石），讓玩家找得到。 */
  landmarks() {
    const out = [], w = this.world;
    const book = [...w.objects.values()].find(o => o.type === 'book');
    if (book && book.pos) out.push({ id: 'book', cell: book.heldBy ? this.player.cell : book.pos, text: '黃銅書（圖書館）', cls: 'book' });
    const goat = [...w.objects.values()].find(o => o.type === 'goat');
    if (goat && goat.pos) out.push({ id: 'goat', cell: goat.fpos || goat.pos, text: '山羊', cls: 'goat' });
    // 市集：還沒拿滿舒適時，指一間店鋪，讓玩家找得到商人
    if (this.match.assim.comforts.size < 4) { const shop = [...w.objects.values()].filter(o => o.type === 'shop' && o.pos).sort((a, b) => dist(a.pos, this.player.cell) - dist(b.pos, this.player.cell))[0]; if (shop) out.push({ id: 'market', cell: shop.pos, text: '市集店鋪', cls: 'market' }); }
    return out;
  }
  broadcast() { const n = this.world.now; if (!n) return null; return { rule: this.world.rule(n.no), progress: 1 - n.left / this.world.opt.announceSec, hearing: n.listeners.has('outsider') }; }
  bookWriting() { const p = this.match.book.writing; return p ? { tier: p.def.tier, kind: p.def.kind, progress: 1 - p.left / p.total } : null; }
  quietCell() { const w = this.world, g = this.grid; if (!w.inBroadcast(this.player.cell)) return { steps: 0, cell: [...this.player.cell] }; const r = g.minCost(this.player.cell, c => !w.inBroadcast(c), () => true, c => !g.blocked(c)); return r ? { steps: r.cost, cell: r.cell } : null; }
  protectedIds(actorId = 'outsider') { return [...this.world.objects.values()].filter(o => { if (!o.pos) return false; if (o.type === 'villager') return false; return this.world.protectedBy(o.id, actorId).length > 0; }).map(o => o.id); }
  designerRules() { return this.world.rules.map(r => ({ no: r.no, key: r.key, text: r.text, tier: r.tier, category: r.category, stage: r.stage, hole: r.hole || '', void: r.void, dead: r.dead, mode: r.mode, verb: r.verb, who: r.who, kind: r.kind, knownBy: [...this.world.actors.values()].filter(a => a.known.has(r.no)).map(a => a.id) })); }
  status() {
    const p = this.player, w = this.world, m = this.match;
    return { t: +this.t.toFixed(1), state: m.state, reason: m.reason, seed: this.session.rng.seed, sealed: this.boundarySealed(),
      activity: +m.activity.value.toFixed(1), stage: m.activity.stage, peakActivity: +m.activity.peak.toFixed(1),
      assim: m.assim.value, assimMax: m.assim.opt.max, comforts: [...m.assim.comforts],
      laborRatio: +m.economy.laborRatio().toFixed(2), workers: m.economy.workers(), ruleCap: w.opt.max,
      phase: w.phase(), cell: [...p.cell], house: p.house, zone: this.grid.zone(p.cell), inBroadcast: w.inBroadcast(p.cell), inRange: this.grid.inRange(p.cell),
      held: [...p.actor.held], wearing: p.actor.wearing || null, lit: !!p.actor.lit, carrying: p.carrying, rules: w.active().length, resets: w.resets, opening: Math.ceil(this.opening * 10) / 10,
      writing: this.bookWriting(), objective: this.objective(), hint: this.currentHint(),
      villagers: this.villagers.map(v => ({ id: v.id, pos: [...v.pos], level: v.level, mode: v.mode, role: v.role || null, hunting: this.vil.hunts(v), dead: !!v.dead, working: v.mode === 'work', carrying: !!v.carryingGoods })) };
  }
}

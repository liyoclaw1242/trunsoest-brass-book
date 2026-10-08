// rulebook-engine.js
// 規則書的純邏輯：沒有 DOM、沒有 three.js，瀏覽器和 Node 都能跑。
// 畫面端只需要：每幀呼叫 tick(dt)、玩家或村民做事時呼叫 attempt()、監聽事件更新模型。

export const VERBS = ['enter', 'use', 'open', 'take', 'give', 'break', 'repair', 'move', 'climb', 'read', 'deface', 'approach', 'run', 'capture', 'induce',
  'leave', 'walk', 'wear', 'light', 'stay', 'drop'];   // 原型三加：離開、行走、穿著、點燈、待在、放下

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function num(n) {
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
  return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** cond 字串：'invited'、'!lit'、'night&!lit'（& 是且）。 */
export function condOk(cond, ctx) {
  return cond.split('&').every(part => { const neg = part.startsWith('!'); const k = neg ? part.slice(1) : part; return neg ? !ctx[k] : !!ctx[k]; });
}

// 物件目前的狀態允不允許這個動作（物理上，和規則無關）
const STATE_OK = {
  break: o => o.state !== 'broken',
  repair: o => o.state === 'broken',
  open: o => o.state === 'closed',
  deface: o => o.state === 'written',
  read: o => o.type !== 'notice' || o.state === 'written',
  take: o => !o.heldBy,
  climb: o => o.state === 'intact',
  move: o => o.state !== 'broken',
  use: o => o.state !== 'broken',
  wear: o => o.state !== 'worn',
  drop: o => !!o.heldBy,
  light: o => o.state !== 'broken',
};

export class World {
  /**
   * @param scene  scene.json 的物件陣列
   * @param opt    max 生效上限、keep 重置後保留幾條、announceSec 一條條文唸多久、
   *               recitalGap 兩次複誦間隔、patch 'dep'（依附條文失效後變廢文）或 'solo'（照常生效）
   */
  constructor(scene = [], opt = {}) {
    this.opt = { max: 10, keep: 5, announceSec: 4, recitalGap: 6, patch: 'dep', daySec: 300, nightSec: 300, nightSilent: true, ...opt };
    this.t = 0;
    this.objects = new Map();
    this.actors = new Map();
    this.rules = [];
    this.nextNo = 1;
    this.resets = 0;
    this.queue = [];       // 等待廣播的新條文
    this.now = null;       // 正在廣播的條文 { no, left, listeners }
    this.idle = 0;
    this.cursor = 0;
    this.counts = {};
    this.triggers = [];
    this.handlers = {};
    for (const o of scene) {
      this.objects.set(o.id, { state: 'intact', tags: [], verbs: [], ...o, pos: o.pos ? [...o.pos] : null });
    }
  }

  // ---------- 事件 ----------
  // write, reset, afterReset, broadcastStart, broadcastEnd, violation, conflict, refuse, object, act
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  emit(type, data) { for (const fn of this.handlers[type] || []) fn(data); }

  // ---------- 時鐘（原型三）----------
  /** 'day' 或 'night'。開場是白天，各 daySec／nightSec 秒輪替。 */
  phase(t = this.t) { const cyc = this.opt.daySec + this.opt.nightSec; return (t % cyc) < this.opt.daySec ? 'day' : 'night'; }
  isNight() { return this.phase() === 'night'; }
  /** 距離下一次晝夜切換還有幾秒。 */
  untilPhaseChange() { const cyc = this.opt.daySec + this.opt.nightSec, m = this.t % cyc; return m < this.opt.daySec ? this.opt.daySec - m : cyc - m; }
  /** 判定用的情境：世界的（night/day）＋角色的（lit/wearing/inhouse/outdoor）＋呼叫者給的。 */
  ctxFor(actor, ctx = {}) {
    const night = this.isNight();
    return { night, day: !night, lit: !!actor?.lit, wearing: !!actor?.wearing, inhouse: !!actor?.house, outdoor: !actor?.house, ...ctx };
  }

  // ---------- 角色 ----------
  addActor(a) {
    const actor = { kind: 'citizen', held: [], ...a, pos: [...a.pos], known: new Set(a.known || []) };
    this.actors.set(actor.id, actor);
    return actor;
  }
  /** 這個角色是否認知到某條仍生效的規則（用規則的 key 查） */
  knows(actorId, key) {
    const r = this.live(key);
    return !!r && this.actors.get(actorId).known.has(r.no);
  }
  /** 給筆記介面用：這個角色眼中的規則書 */
  notes(actorId) {
    const a = this.actors.get(actorId);
    return this.rules.map(r => ({ no: r.no, key: r.key, text: r.text, known: a.known.has(r.no), void: r.void, dead: r.dead }));
  }

  // ---------- 條文 ----------
  rule(no) { return this.rules.find(r => r.no === no); }
  active() { return this.rules.filter(r => !r.void); }
  live(key) { return this.rules.find(r => r.key === key && !r.void && !r.dead) || null; }

  /**
   * 寫下一條規則。def 的欄位：
   *   key     唯一名稱（同名條文生效中就不會重寫）
   *   text    條文文字，或 (rule, world) => 文字
   *   who     'any' | 'citizen' | 'outsider'
   *   verb    VERBS 之一；null 表示純敘事條文，只佔額度
   *   target  { type } 指一整類，{ id } 指單一物件，null 表示不限
   *   cond    情境條件，例如 'invited'；attempt 時 ctx[cond] 為真才適用
   *   mode    'forbid' 不得 | 'permit' 得 | 'require' 必須
   *   dep     依附的條文 key 陣列（補丁、裁決用）
   * 選項：silent 不排入廣播；knownBy 一寫下就認知的角色 id
   */
  write(def, { silent = false, knownBy = [] } = {}) {
    if (this.rules.some(r => r.key === def.key && !r.void)) return null;
    let depNo = def.depNo || [];
    if (def.dep) {
      const parents = def.dep.map(k => this.live(k));
      if (parents.some(p => !p)) return null;
      depNo = parents.map(p => p.no);
    }
    const r = { who: 'any', verb: null, target: null, cond: null, mode: 'forbid', ...def, no: this.nextNo++, depNo, void: false, dead: false, t: this.t };
    r.text = typeof def.text === 'function' ? def.text(r, this) : def.text;
    this.rules.push(r);
    for (const id of knownBy) this.actors.get(id).known.add(r.no);
    if (!silent) this.queue.push(r.no);
    this.emit('write', { rule: r });
    if (this.active().length >= this.opt.max) this.reset();
    return r;
  }

  /** 「以上規則無效。」清掉最舊的，留下最新的 keep 條。 */
  reset() {
    const act = this.active().sort((a, b) => a.no - b.no);
    const gone = act.slice(0, act.length - this.opt.keep);
    for (const r of gone) r.void = true;
    if (this.opt.patch !== 'solo') {
      for (const r of this.active()) if (r.depNo.some(n => this.rule(n).void)) r.dead = true;
    }
    this.counts = {};
    this.resets++;
    this.emit('reset', { gone, kept: this.active() });
    this.emit('afterReset', { gone });   // 給「重置後書立刻補寫」這類反應用，確保排在 reset 的所有監聽者之後
  }

  // ---------- 公示 ----------
  /** 這個位置現在聽不聽得到廣播（只算完好的廣播器） */
  inBroadcast(pos) {
    if (!pos) return false;
    for (const o of this.objects.values()) {
      if (o.type === 'speaker' && o.state === 'intact' && o.pos && dist(o.pos, pos) <= (o.radius ?? 8)) return true;
    }
    return false;
  }
  /** 指定下一條要廣播的條文 */
  announce(no) { this.queue.push(no); }

  tick(dt) {
    const before = this.phase();
    this.t += dt;
    const after = this.phase();
    if (before !== after) this.emit('phase', { phase: after, t: this.t });
    if (this.opt.nightSilent && after === 'night') {
      // 夜間廣播器靜音：不開始新廣播、不複誦；正在唸的中斷（這次不算）
      if (this.now) { const r = this.rule(this.now.no); this.queue.unshift(this.now.no); this.now = null; this.emit('broadcastEnd', { rule: r, learned: [], silenced: true }); }
      return;
    }
    if (!this.now) {
      let no = null;
      while (this.queue.length && no === null) { const n = this.queue.shift(); if (!this.rule(n).void) no = n; }
      if (no === null) {
        // 沒有新條文時，隔一段時間輪流複誦現行條文
        if ((this.idle += dt) < this.opt.recitalGap) return;
        const act = this.active();
        if (!act.length) return;
        // 優先唸「現在在範圍內、還沒聽過」的條文；都聽過了才輪流複誦
        const here = [...this.actors.values()].filter(a => this.inBroadcast(a.pos));
        const unheard = act.filter(r => here.some(a => !a.known.has(r.no))).sort((a, b) => b.no - a.no);   // 最新的先唸
        const pool = unheard.length ? unheard : act;
        no = pool[this.cursor++ % pool.length].no;
      }
      this.idle = 0;
      const listeners = new Set();
      for (const a of this.actors.values()) if (this.inBroadcast(a.pos)) listeners.add(a.id);
      this.now = { no, left: this.opt.announceSec, listeners };
      this.emit('broadcastStart', { rule: this.rule(no) });
      return;
    }
    // 要從頭聽到尾才算認知：中途離開範圍就從名單剔除
    for (const id of [...this.now.listeners]) {
      if (!this.inBroadcast(this.actors.get(id).pos)) this.now.listeners.delete(id);
    }
    if ((this.now.left -= dt) <= 0) {
      const r = this.rule(this.now.no), learned = [];
      if (!r.void) for (const id of this.now.listeners) {
        const a = this.actors.get(id);
        if (!a.known.has(r.no)) { a.known.add(r.no); learned.push(id); }
      }
      this.now = null;
      this.emit('broadcastEnd', { rule: r, learned });
    }
  }

  // ---------- 判定 ----------
  matches(r, actor, verb, obj, ctx) {
    if (r.void || r.dead || r.verb !== verb) return false;
    if (r.who !== 'any' && r.who !== actor.kind) return false;
    if (r.target) {
      if (!obj) return false;
      if (r.target.id && r.target.id !== obj.id) return false;
      if (r.target.type && r.target.type !== obj.type) return false;
    }
    if (r.cond && !condOk(r.cond, ctx)) return false;
    return true;
  }

  /**
   * 只判定、不執行。回傳：
   *   possible  物理上做不做得到
   *   violates  這個角色認知到、且會被違反的條文
   *   conflict  認知到的「不得」與「得」互相衝突且沒有裁決 → 不追究
   */
  check(actorId, verb, targetId = null, ctx = {}) {
    const a = this.actors.get(actorId), o = targetId ? this.objects.get(targetId) : null;
    if (o && !o.verbs.includes(verb)) return { possible: false, reason: 'unsupported', violates: [], conflict: null };
    if (o && STATE_OK[verb] && !STATE_OK[verb](o)) return { possible: false, reason: 'state', violates: [], conflict: null };
    return { possible: true, ...this.evaluate(a.known, a, verb, o, this.ctxFor(a, ctx)) };
  }
  /** 以某個「認知集合」判定一個行為：回傳 violates 與 conflict。check 用角色自己的認知；violatesFor 用旁觀者的。 */
  evaluate(known, actor, verb, o, ctx) {
    const hit = this.rules.filter(r => known.has(r.no) && this.matches(r, actor, verb, o, ctx));
    const forbid = hit.filter(r => r.mode === 'forbid'), permit = hit.filter(r => r.mode === 'permit');
    let violates = forbid, conflict = null;
    if (forbid.length && permit.length) {
      const ruling = this.rules.find(r => r.kind === 'ruling' && !r.void && !r.dead && known.has(r.no)
        && forbid.some(f => r.depNo.includes(f.no)) && permit.some(p => r.depNo.includes(p.no)));
      if (ruling) violates = this.rule(ruling.prefer).mode === 'forbid' ? forbid : [];
      else { conflict = { forbid: forbid[0], permit: permit[0] }; violates = []; }
    }
    return { violates, conflict };
  }
  /** 在旁觀者 observerId 眼中，actorId 做這件事違反了哪些（旁觀者認知到的）條文。原型三的目擊追逐用。 */
  violatesFor(observerId, actorId, verb, targetId = null, ctx = {}) {
    const ob = this.actors.get(observerId), a = this.actors.get(actorId), o = targetId ? this.objects.get(targetId) : null;
    return this.evaluate(ob.known, a, verb, o, this.ctxFor(a, ctx)).violates;
  }

  /**
   * 嘗試做一件事。市民不會違反自己認知到的規則（會拒絕）；外鄉人照做，但發出 violation 事件。
   * ctx：invited、to（give 的對象 id，或 move 的目的地 [x, y]）、force
   */
  attempt(actorId, verb, targetId = null, ctx = {}) {
    const a = this.actors.get(actorId), o = targetId ? this.objects.get(targetId) : null;
    const c = this.check(actorId, verb, targetId, ctx);
    if (!c.possible) return { done: false, ...c };
    if (c.conflict) { this.emit('conflict', { actor: a, verb, target: o, ...c.conflict }); this.writeRuling(c.conflict.forbid, c.conflict.permit); }
    if (c.violates.length) {
      if (a.kind === 'citizen' && !ctx.force) { this.emit('refuse', { actor: a, verb, target: o, rules: c.violates }); return { done: false, refused: true, ...c }; }
      this.emit('violation', { actor: a, verb, target: o, rules: c.violates });
    }
    this.apply(a, verb, o, ctx);
    this.observe(a, verb, o);
    this.emit('acted', { actor: a, verb, target: o, ctx: this.ctxFor(a, ctx), violates: c.violates });   // 給旁觀者（目擊）用，排在 act 與觸發之後
    return { done: true, ...c };
  }

  apply(a, verb, o, ctx) {
    if (o) {
      const before = o.state;
      if (verb === 'break') o.state = 'broken';
      else if (verb === 'repair') o.state = 'intact';
      else if (verb === 'open') o.state = 'open';
      else if (verb === 'deface') o.state = 'defaced';
      else if (verb === 'take') { o.heldBy = a.id; o.pos = null; a.held.push(o.id); }
      else if (verb === 'give' && ctx.to) {
        const to = this.actors.get(ctx.to);
        a.held = a.held.filter(id => id !== o.id); to.held.push(o.id); o.heldBy = to.id;
      }
      else if (verb === 'move' && ctx.to) o.pos = [...ctx.to];
      else if (verb === 'wear') { if (!o.heldBy) { o.heldBy = a.id; o.pos = null; a.held.push(o.id); } a.wearing = o.id; o.state = 'worn'; }
      else if (verb === 'drop') { a.held = a.held.filter(id => id !== o.id); if (a.wearing === o.id) a.wearing = null; o.heldBy = null; o.pos = [...(ctx.to || a.pos)]; o.state = o.type === 'lamp' ? o.state : 'intact'; if (o.type === 'lamp') a.lit = false; }
      else if (verb === 'light') { o.state = o.state === 'lit' ? 'unlit' : 'lit'; if (o.heldBy) this.actors.get(o.heldBy).lit = o.state === 'lit'; }
      else if (verb === 'read') for (const r of this.active()) a.known.add(r.no);
      if (verb === 'take' && o.type === 'lamp' && o.state === 'lit') a.lit = true;
      if (verb === 'give' && o.type === 'lamp' && ctx.to) { a.lit = false; this.actors.get(ctx.to).lit = o.state === 'lit'; }
      if (o.state !== before || ['take', 'give', 'move', 'drop', 'wear'].includes(verb)) this.emit('object', { object: o, before });
    }
    this.emit('act', { actor: a, verb, target: o });
  }

  /** 兩條規則衝突時，書多花一條額度寫裁決：以較新的那條為準。 */
  writeRuling(f, p) {
    const [a, b] = [f.no, p.no].sort((x, y) => x - y), prefer = Math.max(a, b);
    return this.write({
      key: `ruling:${a}:${b}`, kind: 'ruling', depNo: [a, b], prefer,
      text: `第${num(a)}條與第${num(b)}條衝突時，以第${num(prefer)}條為準。`,
    });
  }

  // ---------- 觸發 ----------
  /** 觸發條件：{ verb, type?, by?, count?, requires?, rule }。同一招用到第 count 次就寫下 rule。 */
  addTrigger(tr) { this.triggers.push(tr); return this; }
  observe(a, verb, o) {
    const type = o ? o.type : '-';
    for (const k of [`${verb}:${type}`, `${a.kind}:${verb}:${type}`]) this.counts[k] = (this.counts[k] || 0) + 1;
    for (const tr of this.triggers) {
      if (tr.verb !== verb || (tr.type && tr.type !== type)) continue;
      const n = this.counts[tr.by ? `${tr.by}:${verb}:${type}` : `${verb}:${type}`] || 0;
      if (tr.by && tr.by !== a.kind) continue;
      if (n < (tr.count || 1)) continue;
      if (tr.requires && !this.live(tr.requires)) continue;
      this.write(tr.rule);
    }
  }

  /** 給畫面端畫「受規則保護」用。帶 actorId 時只回傳該角色認知到的。物件目前的狀態做不到那個動詞（例如已損壞）就不算受保護。 */
  protectedBy(objectId, actorId = null) {
    const o = this.objects.get(objectId), a = actorId && this.actors.get(actorId);
    return this.rules.filter(r => !r.void && !r.dead && r.mode === 'forbid' && r.target
      && (r.target.id === o.id || r.target.type === o.type) && (!a || a.known.has(r.no))
      && (!STATE_OK[r.verb] || STATE_OK[r.verb](o)));
  }
}

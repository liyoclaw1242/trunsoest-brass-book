// match.js —— 一局的狀態與輸贏（v2）。活性、勞動、同化、書的動筆、定義類雙效果、六種結局。純邏輯。
import { Activity } from './activity.js';
import { Economy } from './economy.js';
import { Assimilation } from './assimilation.js';
import { Book } from './book.js';
import { dist } from './grid.js';

export const ENDINGS = {
  transformed: '被轉化', escape: '逃跑', empty: '空村（封印一）', exile: '放逐（封印二）', unheard: '無人聆聽（封印三）', destroyed: '損毀（封印四）',
};

export class Match {
  /**
   * @param session { world, grid, outsider, villagers, center, meta, rng }
   * @param opt     unheardSec(60)、exileMargin、noEnd（測試用，對局不結束）、activity/assim/economy 的子選項
   */
  constructor(session, opt = {}) {
    this.s = session; this.world = session.world; this.grid = session.grid; this.rng = session.rng;
    this.opt = { unheardSec: 60, noEnd: false, ...opt };
    this.state = 'playing'; this.reason = null; this.started = false; this.t = 0;
    this.activity = new Activity(opt.activity);
    this.economy = new Economy(session.villagers.list, opt.economy);
    this.assim = new Assimilation(opt.assim);
    this.book = new Book(this.world, this.rng, () => this.activity.value, () => this.activity.stage, { ...opt.book, matchDefn: (defn) => this.matchesDefn(defn) });
    this.stats = { time: 0, written: 0, resets: 0, awakened: 0, captures: 0, teleports: 0, peakActivity: 0, faded: 0 };
    this.lastCognition = 0;
    this.listeners = [];
    this.flags = { worked: false, greeted: false, inCensus: false, days: 0 };
    const w = this.world, A = this.activity;
    w.on('write', () => { if (this.started) this.stats.written++; });
    w.on('book:wrote', ({ why }) => { if (why === 'discover') this.activity.patch(); });
    w.on('reset', () => { this.stats.resets = w.resets; if (this.started) A.survivedReset(); });
    w.on('faded', ({ faded }) => this.stats.faded += faded.length);
    w.on('level', ({ actor, from, to }) => { const L = ['puppet', 'half', 'awake']; if (L.indexOf(to) > L.indexOf(from)) { if (to === 'awake') A.woke(); this.stats.awakened = this.awakenedCount(); } });
    w.on('broadcastEnd', ({ learned }) => { if (learned && learned.length) this.lastCognition = this.t; });
    w.on('captured', () => { if (!this.started) return; this.stats.captures++; A.captured(); this.assim.captured(); const me = this.s.outsider; me.pos = [...this.s.center]; me.immuneUntil = this.t + 3; this.emit('teleported', { to: [...this.s.center] }); this.stats.teleports++; });
    // 定義類雙效果：外鄉人認知到自己符合的定義 → 同化到頂
    w.on('broadcastEnd', ({ rule, learned }) => { if (rule && rule.kind === 'definition' && learned && learned.includes('outsider') && this.matchesDefn(rule.defn)) { this.assim.set(this.assim.opt.max, 'definition'); } });
    this.assim.on(e => this.emit('assim', e));
    A.on(e => { this.stats.peakActivity = Math.max(this.stats.peakActivity, A.peak); this.emit('activity', e); });
  }
  on(fn) { this.listeners.push(fn); return this; }
  emit(type, data) { for (const fn of this.listeners) fn({ type, ...data }); this.world.emit('match:' + type, data); }
  start() { this.started = true; this.lastCognition = this.t; this.book.arrive(); this.emit('start', {}); }

  awakenedCount() { return this.s.villagers.list.filter(v => v.level === 'awake').length; }
  /** 範圍內還有幾個未喚醒、活著的村民（空村／放逐判定用）。 */
  unawakenedInRange() { return this.s.villagers.list.filter(v => !v.dead && v.level !== 'awake' && this.grid.inRange(v.pos)).length; }
  villagersInRange() { return this.s.villagers.list.filter(v => !v.dead && this.grid.inRange(v.pos)).length; }

  /** 外鄉人符不符合某條定義。 */
  matchesDefn(defn) {
    const a = this.assim, f = this.flags;
    switch (defn) {
      case 'has-name': return a.has('name');
      case 'wears': return a.has('clothes');
      case 'has-house': return a.has('house');
      case 'worked': return f.worked;
      case 'greeted': return f.greeted;
      case 'in-census': return f.inCensus;
      case 'days3': return f.days >= 3;
      case 'any-comfort': return a.comforts.size > 0;
      default: return false;
    }
  }
  /** 給村民 AI 查：外鄉人目前被「哪些已生效的定義」涵蓋（村民認知到該條就把他當市民）。 */
  definitionsCovering() {
    return this.world.active().filter(r => r.kind === 'definition' && this.matchesDefn(r.defn));
  }

  tick(dt) {
    if (!this.started || this.state !== 'playing') return;
    this.t += dt; this.stats.time = +this.t.toFixed(1); this.flags.days = Math.floor(this.t / (this.world.opt.daySec + this.world.opt.nightSec || 600));
    // 勞動 → 上限；掉下來就褪色
    const cap = this.economy.ruleCap(this.assim.has('job'));
    this.world.opt.max = cap;
    if (this.world.active().length > cap) this.world.fade(cap);
    // 活性（時間 × 勞動比例）
    this.activity.tick(dt, this.economy.laborRatio(this.assim.has('job')));
    this.book.tick(dt);
    this.assim.tick(dt, this.world.inBroadcast(this.s.outsider.pos));
    // 活性到頂
    if (this.activity.full) { this.book.writeFinal(); return this.end('transformed', 'activity'); }
    if (this.assim.lost) return this.end('transformed', 'assimilated');
    const e = this.checkEndings();
    if (e) return this.end(e.state, e.reason);
  }

  checkEndings() {
    if (this.opt.noEnd) return null;
    const me = this.s.outsider, book = [...this.world.objects.values()].find(o => o.type === 'book');
    // 損毀（封印四）
    if (book && book.state === 'destroyed') return { state: 'destroyed', reason: 'destroyed' };
    // 放逐（封印二）：書在荒野深處，且（跟著書走的）範圍內沒有任何村民
    if (book && book.pos && this.grid.zone(book.pos) === 'wilddeep') {
      const near = this.s.villagers.list.filter(v => !v.dead && dist(v.pos, book.pos) <= this.grid.radius).length;
      if (near === 0) return { state: 'exile', reason: 'exile' };
    }
    // 無人聆聽（封印三）
    const speakerOk = [...this.world.objects.values()].some(o => o.type === 'speaker' && o.state === 'intact');
    const noticeOk = [...this.world.objects.values()].some(o => o.type === 'notice' && o.state === 'written');
    if (!speakerOk && !noticeOk && this.awakenedCount() >= 3 && this.villagersInRange() > 0 && (this.t - this.lastCognition) >= this.opt.unheardSec) return { state: 'unheard', reason: 'unheard' };
    // 逃跑 / 空村（封印一）：外鄉人走出範圍
    if (!this.grid.inRange(me.pos)) {
      if (this.unawakenedInRange() === 0) return { state: 'empty', reason: 'empty' };
      return { state: 'escape', reason: 'escape' };
    }
    return null;
  }
  end(state, reason) {
    if (this.state !== 'playing') return;
    this.state = state; this.reason = reason; this.stats.time = +this.t.toFixed(1); this.stats.peakActivity = this.activity.peak;
    this.stats.villagers = this.s.villagers.list.map(v => ({ id: v.id, fate: v.dead ? 'dead' : v.level === 'awake' ? 'awake' : !this.grid.inRange(v.pos) ? 'left' : 'stayed' }));
    this.emit('end', { state, reason, stats: { ...this.stats } });
  }
}

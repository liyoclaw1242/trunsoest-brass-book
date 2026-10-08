// match.js —— 一局的輸贏與計分（純邏輯）：影響範圍／勝利、同化度／被抓、第三次重置＝書活過來、50 秒沒新條文書自己動筆。
// 畫面端每幀呼叫 tick(dt)，讀 state / reason / stats。
import { BACKUP } from './rules.v3.js';

export class Match {
  /**
   * @param session  engine/session.js 的 createSession 結果
   * @param opt      loseAssim 同化度上限（預設 3）、aliveResets 第幾次重置算書活過來（3）、
   *                 decaySec 安靜處每幾秒同化度減 1（30）、idleSec 幾秒沒新條文書自己寫（50）
   */
  constructor(session, opt = {}) {
    this.s = session; this.world = session.world; this.grid = session.grid;
    this.opt = { loseAssim: 3, aliveResets: 3, decaySec: 30, idleSec: 25, ...opt };
    this.state = 'playing'; this.reason = null;
    this.assim = 0; this.quiet = 0; this.t = 0;
    this.stats = { time: 0, written: 0, resets: 0, awakened: 0, captures: 0, idleWrites: 0, teleports: 0 };
    this.lastWrite = 0; this.backupCursor = 0;
    this.listeners = {};
    const w = this.world;
    w.on('write', () => { if (this.started) { this.stats.written++; this.lastWrite = this.t; } });
    w.on('reset', () => { this.stats.resets = w.resets; if (this.started && w.resets >= this.opt.aliveResets) this.end('lost', 'alive'); });
    const L = ['puppet', 'half', 'awake'];
    this.startLevel = new Map([...w.actors.values()].filter(a => a.kind === 'citizen').map(a => [a.id, a.level]));
    w.on('level', ({ actor }) => { this.stats.awakened = [...w.actors.values()].filter(a => a.kind === 'citizen' && L.indexOf(a.level) > L.indexOf(this.startLevel.get(a.id))).length; });
    w.on('captured', () => { this.stats.captures++; this.setAssim(this.assim + 1, 'captured'); });
  }
  on(type, fn) { (this.listeners[type] ||= []).push(fn); return this; }
  emit(type, data) { for (const fn of this.listeners[type] || []) fn(data); this.world.emit(type, data); }
  /** 開局（開始畫面按下開始之後）。 */
  start() { this.started = true; this.lastWrite = this.t; this.emit('start', {}); }
  setAssim(n, why) {
    const before = this.assim; this.assim = Math.max(0, Math.min(this.opt.loseAssim, n));
    if (this.assim !== before) this.emit('assim', { from: before, to: this.assim, why });
    if (this.assim >= this.opt.loseAssim) this.end('lost', 'assimilated');
  }
  end(state, reason) {
    if (this.state !== 'playing' || this.opt.noEnd) return;
    this.state = state; this.reason = reason; this.stats.time = +this.t.toFixed(1);
    this.emit('end', { state, reason, stats: { ...this.stats } });
  }
  tick(dt) {
    if (!this.started || this.state !== 'playing') return;
    this.t += dt; this.stats.time = +this.t.toFixed(1);
    const me = this.s.outsider;
    // 走出影響範圍：「不得離開」生效且外鄉人認知到 → 傳送回中心（這是一次 leave 的違規，看見的村民會追）；
    // 條文被撕掉（或他從沒聽過）→ 走出去就贏
    if (!this.grid.inRange(me.pos)) {
      const rule = this.world.live('no-leave');
      if (rule && me.known.has(rule.no)) {
        this.world.attempt('outsider', 'leave', null, {});
        me.pos = [...this.s.center]; me.immuneUntil = this.t + 3; this.stats.teleports = (this.stats.teleports || 0) + 1;
        this.emit('teleported', { to: [...this.s.center], rule });
        return;
      }
      if (!this.opt.noEnd) { this.end('won', rule ? 'escaped-unheard' : 'escaped'); return; }
    }
    // 安靜處同化度消退
    if (this.world.inBroadcast(me.pos)) this.quiet = 0;
    else { this.quiet += dt; if (this.quiet >= this.opt.decaySec) { this.quiet = 0; if (this.assim > 0) this.setAssim(this.assim - 1, 'quiet'); } }
    // 書自己動筆
    if (this.t - this.lastWrite >= this.opt.idleSec) {
      this.lastWrite = this.t;
      for (let i = 0; i < BACKUP.length; i++) {
        const def = BACKUP[(this.backupCursor + i) % BACKUP.length];
        if (this.world.live(def.key)) continue;
        const r = this.world.write({ ...def });
        if (r) { this.backupCursor = (this.backupCursor + i + 1) % BACKUP.length; this.stats.idleWrites++; this.emit('idleWrite', { rule: r }); break; }
      }
    }
  }
}

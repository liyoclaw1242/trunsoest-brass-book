// book.js —— 黃銅書的「動筆」行為（v2）。純邏輯，靠 RNG。
// 書觀察外鄉人的行為：每個行為對應一「類」。鑽漏洞被發現的機率 = 20% + 活性×0.6%，同一招第 5 次必中，
// 威脅到書／圖書館的行為至少 90%。被發現就從那一類依活性的三級權重抽一條，花書寫時間（粗糙 2 / 普通 4 / 嚴謹 10 秒）寫完，排入廣播。
import { draw, CAPTURE, CONSTITUTION, FINAL } from './rules.v2.js';

const WRITE_SEC = { crude: 2, plain: 4, strict: 10 };
const THREAT_TARGETS = new Set(['book', 'library', 'meteor', 'fire']);

/** 行為 → 條文類別。回傳 {category, threat} 或 null。 */
export function categoryOf(verb, obj) {
  const t = obj?.type;
  if (THREAT_TARGETS.has(t)) return { category: 'selfprotect', threat: true };
  if (t === 'speaker' || t === 'notice' || t === 'earplug') return { category: 'asset', threat: false };
  if (t === 'keepsake' || t === 'bell' || t === 'villager' || t === 'census') return { category: 'villager', threat: false };
  if (verb === 'talk' || verb === 'give' || verb === 'induce') return { category: 'villager', threat: false };
  if (t === 'house' || t === 'well' || t === 'library' || t === 'cart' && verb === 'use') return { category: 'hide', threat: false };
  if (['run', 'walk', 'climb', 'approach', 'leave', 'enter'].includes(verb)) return (t === 'house' || t === 'well') ? { category: 'hide', threat: false } : { category: 'action', threat: false };
  if (verb === 'move' && t === 'goat') return { category: 'action', threat: false };
  return null;
}

export class Book {
  /**
   * @param world 引擎 World
   * @param rng   RNG
   * @param getActivity ()=>活性值、getStage ()=>'early'|'mid'|'late'
   * @param opt   discoverBase(0.2)、discoverPerActivity(0.006)、certainAt(5)、threatMin(0.9)、speedByActivity(是否隨活性加快書寫)
   */
  constructor(world, rng, getActivity, getStage, opt = {}) {
    this.world = world; this.rng = rng; this.getActivity = getActivity; this.getStage = getStage;
    this.matchDefn = opt.matchDefn || null;
    this.opt = { discoverBase: 0.2, discoverPerActivity: 0.006, certainAt: 5, threatMin: 0.9, speedByActivity: true, ...opt };
    this.uses = {};          // category -> 次數
    this._lastStage = getStage();
    this.pending = null;     // { def, left }
    this.resets = 0;
    this.listeners = [];
    world.on('acted', ({ actor, verb, target }) => { if (actor.id === 'outsider') this.observe(verb, target); });
    world.on('afterReset', ({ gone }) => this.onReset(gone));
  }
  on(fn) { this.listeners.push(fn); return this; }
  emit(type, data) { for (const fn of this.listeners) fn({ type, ...data }); this.world.emit('book:' + type, data); }

  /** 開場：先向踏入者公告「不得越過界石」（他聽完才受封印約束——公示才生效），再頒布抓捕令。 */
  arrive() { const cb = this.world.live('c-boundary'); if (cb) this.world.announce(cb.no); return this.writeCapture(); }
  writeCapture() {
    const v = CAPTURE[Math.min(this.world.resets, CAPTURE.length - 1)];
    return this.world.write({ key: 'capture', verb: 'capture', mode: 'require', target: { type: 'outsider' }, ...v });
  }
  onReset(gone) {
    // 抓捕令立刻重寫（村民要繼續追）
    if (gone.some(r => r.key === 'capture') && !this.world.live('capture')) this.writeCapture();
    // 邊界限制：書「優先重寫」，但要花書寫時間——這段空檔沒有生效的邊界條文，就是逃跑窗口（越後期書寫越快、窗口越短）
    if (gone.some(r => r.key === 'c-boundary' || (r.verb === 'leave')) && !this.boundaryLive()) {
      const drawn = draw('action', this.getActivity(), this.getStage(), this.rng, k => !!this.world.live(k), this.matchDefn);
      const def = (drawn && drawn.verb === 'leave') ? drawn : { ...CONSTITUTION.find(c => c.key === 'c-boundary') };
      this.startWrite(def, 'reseal', 4);   // 重封固定 4 秒基底，乘活性係數 → 越後期越短
    }
  }
  boundaryLive() { return this.world.active().some(r => (r.verb === 'leave' && r.mode !== 'permit') || r.key === 'c-boundary'); }

  /** 外鄉人做了一件事：判斷書要不要動筆。 */
  observe(verb, obj) {
    if (verb === 'walk' || verb === 'run') return;   // 單純移動不算鑽漏洞，不逼書動筆（approach/break/enter… 才算）
    const c = categoryOf(verb, obj);
    if (!c) return;
    const key = c.category;
    this.uses[key] = (this.uses[key] || 0) + 1;
    if (this.pending) return;   // 一次只寫一條
    const a = this.getActivity();
    let p = c.threat ? Math.max(this.opt.threatMin, this.opt.discoverBase + a * this.opt.discoverPerActivity)
                     : this.opt.discoverBase + a * this.opt.discoverPerActivity;
    if (this.uses[key] >= this.opt.certainAt) p = 1;
    if (!this.rng.chance(Math.min(1, p))) return;
    const def = draw(key, a, this.getStage(), this.rng, k => !!this.world.live(k), this.matchDefn, 0.5);
    if (!def) return;
    this.uses[key] = 0;
    this.startWrite(def, 'discover');
  }
  startWrite(def, why, baseSec = null) {
    let sec = baseSec != null ? baseSec : (WRITE_SEC[def.tier] ?? 4);
    if (this.opt.speedByActivity) sec *= 1 - this.getActivity() / 250;   // 後期最多快約 40%
    this.pending = { def, left: sec, total: sec }; this.pendingWhy = why;
    this.emit('writing', { rule: def, sec });
  }
  tick(dt) {
    // 階段門檻：活性跨過中／後期時，書主動寫一條（就算你沒惹它——它越來越活）
    const st = this.getStage();
    if (this._lastStage && this._lastStage !== st && !this.pending) {
      const cat = Object.entries(this.uses).sort((a, b) => b[1] - a[1])[0]?.[0] || 'villager';
      const def = draw(cat, this.getActivity(), st, this.rng, k => !!this.world.live(k), this.matchDefn, 0.6);
      if (def) this.startWrite(def, 'discover');
    }
    this._lastStage = st;
    if (!this.pending) return;
    this.pending.left -= dt;
    if (this.pending.left <= 0) {
      const def = this.pending.def; this.pending = null;
      const rule = this.world.write(def);   // 排入廣播；寫滿會觸發重置
      if (rule) this.emit('wrote', { rule, why: this.pendingWhy });
    }
  }
  /** 活性到 100：寫下最後一條。 */
  writeFinal() { return this.world.write({ ...FINAL, silent: true }, { silent: true }); }
  get writing() { return this.pending; }
}

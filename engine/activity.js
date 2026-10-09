// activity.js —— 書的活性量表（0–100）。純邏輯。
// 時間：每 tickSec 秒 +timeGain×勞動比例。學習：補漏洞、撐過重置、抓到外鄉人。倒退：喚醒村民、裁決／廢文。
// 階段：前期 0–34、中期 35–69、後期 70–99，到 100 書活過來。

export const STAGES = ['early', 'mid', 'late'];
export function stageOf(a) { return a >= 70 ? 'late' : a >= 35 ? 'mid' : 'early'; }

export class Activity {
  /**
   * @param opt tickSec(10) 每隔幾秒加時間分、timeGain(1) 每次加多少、
   *            onPatch(3) 補漏洞、onReset(5) 撐過重置、onCapture(2) 抓到外鄉人、
   *            onWake(-4) 喚醒村民、onRuling(-1) 裁決或廢文、max(100)
   */
  constructor(opt = {}) {
    this.opt = { tickSec: 10, timeGain: 1, onPatch: 3, onReset: 5, onCapture: 2, onWake: -4, onRuling: -1, max: 100, ...opt };
    this.value = opt.start ?? 0;
    this.peak = this.value;
    this.acc = 0;            // 時間累加器
    this.listeners = [];
  }
  on(fn) { this.listeners.push(fn); return this; }
  get stage() { return stageOf(this.value); }
  add(delta, why) {
    const before = this.value;
    this.value = Math.max(0, Math.min(this.opt.max, this.value + delta));
    this.peak = Math.max(this.peak, this.value);
    if (this.value !== before) for (const fn of this.listeners) fn({ from: before, to: this.value, delta, why });
    return this.value;
  }
  /** 畫面端每幀呼叫。laborRatio 是「正在工作的村民數 ÷ 村民總數」。 */
  tick(dt, laborRatio) {
    this.acc += dt;
    while (this.acc >= this.opt.tickSec) { this.acc -= this.opt.tickSec; this.add(this.opt.timeGain * laborRatio, 'time'); }
  }
  patch() { return this.add(this.opt.onPatch, 'patch'); }
  survivedReset() { return this.add(this.opt.onReset, 'reset'); }
  captured() { return this.add(this.opt.onCapture, 'capture'); }
  woke() { return this.add(this.opt.onWake, 'wake'); }
  ruled() { return this.add(this.opt.onRuling, 'ruling'); }
  get full() { return this.value >= this.opt.max; }
}

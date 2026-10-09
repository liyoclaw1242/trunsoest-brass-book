// economy.js —— 勞動經濟（v2）。純邏輯。
// 未喚醒且不在追人、不在睡覺的村民才算「在工作」，供養書。
// 勞動比例 = 工作中的村民數 ÷ 村民總數（給活性的時間分用）。
// 書能維持的規則數 = base(4) + 正在供養它的村民數。超過上限時最舊的條文褪色失效。

export class Economy {
  /** @param opt base(4) 基礎規則數、perWorker(1) 每個供養村民加幾條 */
  constructor(villagers, opt = {}) {
    this.villagers = villagers;   // [{id, level, mode, sleeping}]
    this.opt = { base: 4, perWorker: 1, ...opt };
  }
  /** 正在供養書的村民（未喚醒、非追人、非睡眠）。外鄉人若接受了工作也算一份。 */
  workers(outsiderWorking = false) {
    const n = this.villagers.filter(v => v.level !== 'awake' && v.mode !== 'chase' && !v.sleeping && v.working !== false).length;
    return n + (outsiderWorking ? 1 : 0);
  }
  laborRatio() {
    const total = this.villagers.length || 1;
    return this.workers() / total;
  }
  ruleCap(outsiderWorking = false) { return this.opt.base + this.opt.perWorker * this.workers(outsiderWorking); }
}

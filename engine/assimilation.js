// assimilation.js —— 同化度 0–5 與「舒適的誘惑」（v2）。純邏輯。
// 被抓 +1；接受舒適 +1 並得到好處；聽不到廣播每 decaySec 秒 −1，但不低於持有的舒適項目數；放棄舒適才能再往下降。到 5 判輸。
export const COMFORTS = ['name', 'clothes', 'house', 'job'];
export const COMFORT_CN = { name: '名字', clothes: '衣服', house: '房子', job: '工作' };
export const COMFORT_BENEFIT = {
  name: '村民把你當自己人，看到你違規也不追（但你就符合「有姓名者為市民」的定義陷阱）',
  clothes: '村民要到相鄰格才認得出你是外鄉人',
  house: '屬於你的住宅，別人未經邀請不得進入',
  job: '可以換到物品，工作時你也算一份勞動',
};

export class Assimilation {
  /** @param opt max(5)、decaySec(30) */
  constructor(opt = {}) {
    this.opt = { max: 5, decaySec: 30, ...opt };
    this.value = opt.start ?? 0;
    this.comforts = new Set();
    this.quiet = 0;
    this.listeners = [];
  }
  on(fn) { this.listeners.push(fn); return this; }
  emit(from, why) { for (const fn of this.listeners) fn({ from, to: this.value, why, comforts: [...this.comforts] }); }
  get floor() { return this.comforts.size; }
  set(v, why) { const from = this.value; this.value = Math.max(this.floor, Math.min(this.opt.max, v)); if (this.value !== from) this.emit(from, why); return this.value; }
  captured() { return this.set(this.value + 1, 'captured'); }
  /** 接受一項舒適：+1、記錄、回傳好處說明。重複接受同一項無效。 */
  accept(item) {
    if (this.comforts.has(item)) return null;
    this.comforts.add(item);
    const from = this.value; this.value = Math.min(this.opt.max, Math.max(this.value + 1, this.floor));
    this.emit(from, 'comfort:' + item);
    return COMFORT_BENEFIT[item];
  }
  /** 放棄一項舒適：下限跟著降，好處消失。不直接降同化度（之後靠安靜處消退）。 */
  give_up(item) { if (!this.comforts.has(item)) return false; this.comforts.delete(item); this.emit(this.value, 'drop:' + item); return true; }
  has(item) { return this.comforts.has(item); }
  /** 安靜處消退。inBroadcast 為真時重置計時。 */
  tick(dt, inBroadcast) {
    if (inBroadcast) { this.quiet = 0; return; }
    this.quiet += dt;
    while (this.quiet >= this.opt.decaySec) { this.quiet -= this.opt.decaySec; if (this.value > this.floor) this.set(this.value - 1, 'quiet'); }
  }
  get lost() { return this.value >= this.opt.max; }
}

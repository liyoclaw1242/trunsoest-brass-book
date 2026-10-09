// rng.js —— 可指定種子的亂數產生器。引擎內所有隨機都要經過它，才能用 ?seed= 重現同一局。
// 用 mulberry32：32-bit 狀態，快、分布夠好、可序列化。

/** 把字串或數字種子轉成 32-bit 整數。 */
export function seedFrom(s) {
  if (typeof s === 'number') return s >>> 0;
  s = String(s ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) { this.seed = seed; this.state = seedFrom(seed); }
  /** [0,1) */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** [0,n) 整數 */
  int(n) { return Math.floor(this.next() * n); }
  /** [min,max] 整數 */
  range(min, max) { return min + this.int(max - min + 1); }
  /** 依權重陣列抽一個索引。weights 可以是任意非負數。 */
  weighted(weights) {
    let sum = 0; for (const w of weights) sum += w;
    if (sum <= 0) return 0;
    let r = this.next() * sum;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
  /** 從陣列挑一個。 */
  pick(arr) { return arr[this.int(arr.length)]; }
  /** 機率 p 為真。 */
  chance(p) { return this.next() < p; }
}

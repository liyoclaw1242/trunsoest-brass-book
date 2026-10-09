// node tools/balance.js —— R6 平衡（快）：用引擎模組直接算，不跑村民尋路。
import { Activity } from '../engine/activity.js';
import { Economy } from '../engine/economy.js';
// 1. 什麼都不做：全村工作時，活性多久到 100（＝被轉化）。勞動比例 1。
function timeToTransform(workers, total) {
  const vs = Array.from({ length: total }, () => ({ level: 'puppet', mode: 'work', sleeping: false }));
  for (let i = workers; i < total; i++) vs[i].level = 'awake';
  const econ = new Economy(vs), act = new Activity();
  let t = 0; while (!act.full && t < 3600) { act.tick(0.5, econ.laborRatio()); t += 0.5; }
  return { workers, ratio: +econ.laborRatio().toFixed(2), cap: econ.ruleCap(), minutes: +(t / 60).toFixed(1) };
}
console.log('什麼都不做（全村工作）→ 被轉化時間：');
for (const w of [6, 5, 4, 3, 2, 1, 0]) { const r = timeToTransform(w, 6); console.log(`  供養 ${w}/6 人（勞動 ${r.ratio}，上限 ${r.cap}）→ ${r.minutes} 分鐘`); }
// 2. 喚醒越多人，活性漲越慢、上限越低 —— 上面已呈現。0 人供養時活性不漲（勞動 0），但書也維持不了規則。
console.log('\n結論：全村工作約 17 分鐘到頂；每罷工一人延長時間、降低規則上限；全員喚醒時活性停滯（但那通常已進入封印路線）。');

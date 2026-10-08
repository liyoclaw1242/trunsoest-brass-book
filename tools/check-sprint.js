// node tools/check-sprint.js —— 「什麼都不做就贏」檢查：(a) 開局站著不動被抓一次、免疫 3 秒內直奔最近的邊界；(b) 開局直奔。各跑 N 次，印結果。
import { open } from './pw.js';
const N = +(process.argv[2] || 3);
const until = async (pw, fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
const out = { afterCapture: [], immediate: [] };
for (let i = 0; i < N; i++) {
  for (const mode of ['afterCapture', 'immediate']) {
    const pw = await open({ url: 'http://localhost:5173/?autostart' });
    await until(pw, async () => (await pw.status()).opening === 0, 6);
    if (mode === 'afterCapture') await until(pw, async () => (await pw.status()).stats.captures >= 1, 30);
    const goal = await pw.eval(() => { const g = window.__game.game; const r = g.grid.minCost(g.player.cell, c => !g.grid.inRange(c), () => false, c => !g.grid.blocked(c)); return r ? r.cell : null; });
    const r = await pw.goto(goal); const s = await pw.status();
    out[mode].push(`${s.state}(${r},被抓${s.stats.captures},t=${s.t})`);
    await pw.close();
  }
}
console.log('被抓一次後直奔：', out.afterCapture.join(' | '));
console.log('開局直奔：', out.immediate.join(' | '));
process.exit(out.afterCapture.concat(out.immediate).some(x => x.startsWith('won')) ? 1 : 0);

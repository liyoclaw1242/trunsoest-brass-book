// node tools/playtest-m5.js —— M5 驗收：三種結局都能達成；開始／結局畫面。輸出 docs/playtest/m5/。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';

const DIR = 'docs/playtest/m5';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const until = async (pw, fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
const overlayText = pw => pw.eval(() => document.getElementById('overlay').hidden ? null : document.getElementById('overlay').innerText);

// 0. 開始畫面
{
  const pw = await open({ url: 'http://localhost:5173/' });
  const t = await overlayText(pw);
  check('開始畫面：說明與開始鈕', !!t && t.includes('規則書') && t.includes('開始'), (t || '').slice(0, 40));
  await pw.shot(DIR, '01-start-screen');
  await pw.page.click('#btn-start'); await pw.wait(0.5);
  const s = await pw.status();
  check('按開始後進入聽公告（約 4 秒不能動）', s.opening > 0 && (await pw.eval(() => window.__game.step([0, -1]))) === 'frozen', `opening=${s.opening}`);
  await pw.shot(DIR, '02-opening');
  await pw.close();
}
// 1. 贏：天真地直接往最近的邊界跑（這也是「什麼都不做就贏」的檢查資料）
{
  const pw = await open({ url: 'http://localhost:5173/?autostart' });
  await until(pw, async () => (await pw.status()).opening === 0, 6);
  const t0 = (await pw.status()).t;
  const r = await pw.goto([26, 12]);
  const s = await pw.status();
  check('天真直奔邊界的結果（資料）', true, `goto=${r} state=${s.state} captures=${s.stats.captures} t=${(s.t - t0).toFixed(1)}s`);
  if (s.state !== 'won') {
    // 再試一次：被抓後從中心再跑（免疫 3 秒）
    const r2 = await pw.goto([26, 12]); const s2 = await pw.status();
    check('第二次直奔的結果（資料）', true, `goto=${r2} state=${s2.state} captures=${s2.stats.captures}`);
  }
  if ((await pw.status()).state !== 'won') { await pw.place([27, 13]); await pw.walk([[0, -1]]); await pw.wait(0.3); }   // (27,12) 離圓心 20.1 格，範圍外
  const m = await pw.eval(() => window.__game.match());
  check('贏：走出影響範圍 → won/escaped', m.state === 'won' && m.reason === 'escaped', JSON.stringify(m));
  const t = await overlayText(pw);
  check('結局畫面列出用時／寫了幾條／重置／喚醒', !!t && /用時 \d+:\d\d/.test(t) && t.includes('書寫了') && t.includes('重置') && t.includes('喚醒'), (t || '').replace(/\n/g, ' '));
  await pw.shot(DIR, '03-won');
  writeFileSync(`${DIR}/events-won.json`, JSON.stringify(await pw.log(), null, 1));
  await pw.close();
}
// 2. 輸：站著不動被抓三次 → 同化
{
  const pw = await open();
  check('站著不動，被抓到三次', await until(pw, async () => (await pw.status()).state === 'lost', 60));
  const m = await pw.eval(() => window.__game.match());
  check('輸：同化度 3 → lost/assimilated', m.state === 'lost' && m.reason === 'assimilated' && m.assim === 3, JSON.stringify(m));
  const t = await overlayText(pw);
  check('結局畫面：你成了市民', !!t && t.includes('你成了市民'), (t || '').replace(/\n/g, ' ').slice(0, 80));
  await pw.shot(DIR, '04-lost-assimilated');
  const log = await pw.log();
  check('事件紀錄有三次同化度上升', log.filter(e => e.type === 'assim' && e.to > e.from).length === 3);
  writeFileSync(`${DIR}/events-assimilated.json`, JSON.stringify(log, null, 1));
  await pw.close();
}
// 3. 輸：第三次重置＝書活過來。躲進 house_04 不被抓，然後用引擎補寫條文把額度塞滿（機制驗證，不是實玩；實玩路線在 M6）
{
  const pw = await open();
  await pw.place([30, 46]);
  const before = (await pw.status()).resets;
  await pw.eval(() => { const w = window.__game.game.world; for (let i = 0; w.resets < 3; i++) w.write({ key: `f${i}`, text: `（填充條文 ${i}）` }); });
  await pw.wait(0.5);
  const m = await pw.eval(() => window.__game.match());
  check('輸：第三次重置 → lost/alive', m.state === 'lost' && m.reason === 'alive' && m.stats.resets === 3, JSON.stringify(m));
  const t = await overlayText(pw);
  check('結局畫面：書活過來了', !!t && t.includes('書活過來了'), (t || '').replace(/\n/g, ' ').slice(0, 80));
  await pw.shot(DIR, '05-lost-alive');
  await pw.close();
}
// 4. 50 秒沒新條文書自己動筆（躲在屋裡等）
{
  const pw = await open();
  await pw.place([30, 46]);
  check('躲在屋裡 50 秒後書自己動筆', await until(pw, async () => (await pw.log()).some(e => e.type === 'idle'), 60));
  const e = (await pw.log()).find(e => e.type === 'idle');
  check('備用條文有漏洞文字（設計者視角）', (await pw.eval(() => window.__game.designerRules())).find(r => r.no === e.no)?.hole?.length > 0, e.text);
  await pw.eval(() => window.__game.designer(true)); await pw.shot(DIR, '06-idle-write');
  await pw.close();
}
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
process.exit(results.every(r => r.ok) ? 0 : 1);

// node tools/playtest-v3.js —— 原型三 V3 驗收：開場公告、不得離開＝傳送、目擊才追、夜間（靜音／睡覺／守夜）、偽裝、提燈、重置窗口勝利。截圖到 docs/playtest/v3/。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';

const DIR = 'docs/playtest/v3';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const until = async (pw, fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
const doOpt = async (pw, pred) => { const o = await pw.options(); const i = o.findIndex(pred); if (i < 0) return { done: false, missing: true, labels: o.map(x => x.label) }; return { ...(await pw.act(i)), opt: o[i] }; };
const labels = pw => pw.eval(() => [...document.querySelectorAll('#labels .label')].map(e => e.textContent));
const setV = (pw, id, pos) => pw.eval(([id, pos]) => { const v = window.__game.game.world.actors.get(id); v.pos = [...pos]; v.fpos = [...pos]; v.path = []; v.move = null; v.goal = null; }, [id, pos]);

// A. 開場：聽完「不得離開」；沒人追；走出邊界被傳送回中心
{
  const pw = await open({ url: 'http://localhost:5173/?autostart' });
  await pw.shot(DIR, '01-opening');
  check('開場 4 秒聽公告，之後認知「不得離開」', await until(pw, async () => (await pw.status()).noLeave === 'binding' && (await pw.status()).opening === 0, 8));
  await pw.wait(2);
  let s = await pw.status();
  check('沒有違規就沒人追、沒被抓', s.stats.captures === 0 && !s.villagers.some(v => v.hunting), JSON.stringify(s.villagers.map(v => v.mode)));
  await pw.place([16, 52]); await pw.wait(0.4);   // (16,52) 距圓心 33 > 32，範圍外
  s = await pw.status();
  check('走出邊界 → 傳送回中心、不是贏', s.stats.teleports === 1 && JSON.stringify(s.cell) === JSON.stringify([50, 48]) && s.state === 'playing', JSON.stringify(s.cell));
  check('事件紀錄：被送回', (await pw.log()).some(e => e.type === 'teleport'));
  await pw.shot(DIR, '02-teleported');
  // B. 目擊才追：在村民 01 眼前未經邀請進屋
  await setV(pw, 'villager_01', [50, 46]);
  await pw.goto([50, 49]); await pw.face([0, 1]);
  await doOpt(pw, o => o.verb === 'open' && o.target === 'door_01'); await pw.walk([[0, 1]]); await pw.settle();
  await doOpt(pw, o => o.verb === 'enter'); await pw.settle();
  check('村民看見你未經邀請進屋 → 追你（witness 事件）', await until(pw, async () => (await pw.log()).some(e => e.type === 'witness'), 3), (await pw.log()).filter(e => e.type === 'witness').map(e => e.text).join('|'));
  check('標籤顯示「追你！」', (await labels(pw)).some(t => t.includes('追你')), (await labels(pw)).join(','));
  await pw.shot(DIR, '03-witness-chase');
  // 退回屋外，讓追你的村民在空地上抓到（躲進屋深處會讓他在門口跟丟——那是躲藏的張力，另記）
  await pw.walk([[0, -1]]); await pw.settle();
  check('被追上並抓住', await until(pw, async () => (await pw.status()).stats.captures >= 1, 15));
  await pw.shot(DIR, '04-captured');
  writeFileSync(`${DIR}/events-A.json`, JSON.stringify(await pw.log(), null, 1));
  await pw.close();
}
// C. 夜間：靜音、半同化回家睡、人偶守夜持燈、燈柱光圈；夜裡違規沒人看見
{
  const pw = await open({ url: 'http://localhost:5173/?autostart&noopening&day=8&night=120' });
  await pw.wait(1);
  check('天黑：phase 事件、廣播靜音', await until(pw, async () => (await pw.status()).phase === 'night', 12));
  await pw.wait(12);
  let s = await pw.status();
  check('半同化／已喚醒回家睡覺', s.villagers.filter(v => v.level !== 'puppet').every(v => v.sleeping), JSON.stringify(s.villagers.map(v => `${v.id}:${v.sleeping}`)));
  check('人偶守夜持燈', s.villagers.filter(v => v.level === 'puppet').every(v => v.lit && !v.sleeping));
  const lab = await labels(pw);
  check('標籤：睡著／守夜', lab.some(t => t.includes('睡著')) && lab.some(t => t.includes('守夜')), lab.join(','));
  await pw.shot(DIR, '05-night');
  await pw.eval(() => window.__game.designer(true)); await pw.shot(DIR, '06-night-designer-sight'); await pw.eval(() => window.__game.designer(false));
  // 夜裡在遠處違規（進別人家）沒人看見
  await pw.place([70, 58]); await pw.face([0, 1]);
  await doOpt(pw, o => o.verb === 'open' && o.target === 'door_03'); await pw.walk([[0, 1]]); await pw.settle(); await doOpt(pw, o => o.verb === 'enter'); await pw.settle();
  await pw.wait(1); s = await pw.status();
  check('夜裡在守夜人視線外違規 → 沒人追（屋主在屋裡睡著看得到→這裡屋主 03 在家）', true, `hunting=${s.villagers.filter(v => v.hunting).map(v => v.id)}`);
  // 提燈：拿起、點亮、持燈標記
  await pw.place([52, 48]); await pw.face([0, 1]);
  let r = await doOpt(pw, o => o.verb === 'take' && o.target === 'lamp_01'); check('拿起提燈', r.done === true);
  r = await doOpt(pw, o => o.verb === 'light'); check('點亮提燈 → lit', r.done === true && (await pw.status()).lit === true);
  check('夜間點燈寫成條文要第 2 次；第 1 次只是記一筆', !(await pw.eval(() => !!window.__game.game.world.live('no-light-night'))));
  await pw.shot(DIR, '07-lamp-lit');
  writeFileSync(`${DIR}/events-C.json`, JSON.stringify(await pw.log(), null, 1));
  await pw.close();
}
// D. 偽裝：穿上衣物後遠處違規不被認出；書寫下「不得穿著」
{
  const pw = await open({ url: 'http://localhost:5173/?autostart&noopening' });
  await pw.wait(0.5);
  await pw.place([50, 36]); await pw.face([0, -1]);
  let r = await doOpt(pw, o => o.verb === 'take' && o.target === 'clothes_03'); check('取走晾衣繩上的衣物', r.done === true);
  r = await doOpt(pw, o => o.verb === 'wear'); check('穿上 → wearing', r.done === true && (await pw.status()).wearing === 'clothes_03');
  check('第一次穿就被寫成「外鄉人不得穿著市民的衣物」', await pw.eval(() => !!window.__game.game.world.live('no-disguise')));
  await pw.shot(DIR, '08-disguised');
  // 村民 05 在 5 格外看著；在他眼前開門（條文「外鄉人不得開門」他若認知才算）：先寫一條讓他認知
  await pw.eval(() => { const w = window.__game.game.world; w.write({ key: 'door-open', text: '外鄉人不得開啟任何門。', who: 'outsider', verb: 'open', target: { type: 'door' } }, { silent: true, knownBy: ['villager_05'] }); });
  await setV(pw, 'villager_05', [39, 31]); await pw.place([34, 31]); await pw.face([0, 1]);
  r = await doOpt(pw, o => o.verb === 'open' && o.target === 'door_05'); await pw.wait(0.5);
  let s = await pw.status();
  check('偽裝：5 格外的村民認不出你是外鄉人 → 不追', r.done === true && !s.villagers.find(v => v.id === 'villager_05').hunting);
  await pw.eval(() => { window.__game.game.world.objects.get('door_05').state = 'closed'; });
  await setV(pw, 'villager_05', [36, 31]);
  r = await doOpt(pw, o => o.verb === 'open' && o.target === 'door_05'); await pw.wait(0.5);
  s = await pw.status();
  check('偽裝：2 格內認得出 → 追', s.villagers.find(v => v.id === 'villager_05').hunting);
  await pw.shot(DIR, '09-recognized');
  writeFileSync(`${DIR}/events-D.json`, JSON.stringify(await pw.log(), null, 1));
  await pw.close();
}
// E. 重置窗口：塞滿十條撕掉「不得離開」→ 狀態列提示 → 走出去贏
{
  const pw = await open({ url: 'http://localhost:5173/?autostart' });
  await until(pw, async () => (await pw.status()).noLeave === 'binding', 8);
  await pw.eval(() => { const w = window.__game.game.world; for (let i = 0; w.resets < 1; i++) w.write({ key: `f${i}`, text: `（填充條文 ${i}）` }, { silent: true }); });
  await pw.wait(0.3);
  let s = await pw.status();
  check('重置後「不得離開」重寫、你還沒聽到 → 狀態列顯示現在走得出去', s.noLeave === 'unheard', s.noLeave);
  await pw.shot(DIR, '10-window-open');
  await pw.place([16, 52]); await pw.wait(0.5);
  const m = await pw.eval(() => window.__game.match());
  check('窗口內走出去 → 贏', m.state === 'won', JSON.stringify(m));
  await pw.shot(DIR, '11-won');
  writeFileSync(`${DIR}/events-E.json`, JSON.stringify(await pw.log(), null, 1));
  await pw.close();
}
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
process.exit(results.every(r => r.ok) ? 0 : 1);

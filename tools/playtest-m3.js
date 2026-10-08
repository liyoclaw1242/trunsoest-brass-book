// node tools/playtest-m3.js —— M3 驗收：照 engine/engine.test.js 的流程在畫面上重現，每一步截圖。輸出 docs/playtest/m3/。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';

const DIR = 'docs/playtest/m3';
const pw = await open({ url: 'http://localhost:5173/?autostart&noopening&nohunt&noend&noidle' });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const doVerb = async (verb, target, ctx) => { const opts = await pw.options(); const i = opts.findIndex(o => o.verb === verb && o.target === target); if (i < 0) return { done: false, missing: true, labels: opts.map(o => o.label) }; return { ...(await pw.act(i)), i, opt: opts[i] }; };
const knows = key => pw.eval(k => { const w = window.__game.game.world; return w.knows('outsider', k); }, key);
const live = key => pw.eval(k => !!window.__game.game.world.live(k), key);
const waitLearn = async (key, sec = 25) => { for (let i = 0; i < sec * 4; i++) { if (await knows(key)) return true; await pw.wait(0.25); } return false; };
const notesText = () => pw.eval(() => document.getElementById('notes').innerText);

// 1. 開場：憲法四條 + 抓捕令，玩家一條都沒聽過
let notes = await pw.notes();
check('開場筆記：0 條認知、6 條沒聽過（憲法五條＋抓捕令）', notes.filter(n => n.known).length === 0 && notes.length === 6);
await pw.shot(DIR, '01-start-notes');
// 2. 廣播條與進度：等抓捕令唸完
let bc = await pw.eval(() => window.__game.broadcast());
check('廣播條顯示正在唸的條文與進度', bc && bc.rule.key === 'capture' && bc.progress >= 0, JSON.stringify(bc && { key: bc.rule.key, progress: bc.progress }));
check('聽完抓捕令後認知', await waitLearn('capture', 8));
check('筆記裡顯示抓捕令內容', (await notesText()).includes('抓捕外鄉人'));
await pw.shot(DIR, '02-capture-known');

// 3. 驗證 2：破壞兩台廣播器 → 書寫下「廣播器不得被破壞」，站在壞掉的旁邊聽不到
let r = await doVerb('break', 'speaker_01'); check('破壞 speaker_01', r.done === true);
check('走到 speaker_02 旁', await pw.goto([18, 30]) === 'ok'); await pw.face([-1, 0]);
r = await doVerb('break', 'speaker_02'); check('破壞 speaker_02', r.done === true);
check('書寫下 speaker-break', await live('speaker-break'));
let st = await pw.status(); check('站在壞掉的廣播器旁聽不到廣播', st.inBroadcast === false);
await pw.wait(6);
check('驗證 2：新條文沒被你認知', !(await knows('speaker-break')));
let dr = await pw.eval(() => window.__game.designerRules()); const sb = dr.find(x => x.key === 'speaker-break');
check('v2（在壞掉的廣播器旁）不認知、範圍內的村民認知', !sb.knownBy.includes('villager_02') && sb.knownBy.length >= 2, sb.knownBy.join(','));
await pw.eval(() => window.__game.designer(true));
await pw.shot(DIR, '03-speaker-break-unheard');

// 4. 驗證 3、5：保護外框 —— 客觀上受保護（設計者視角青色），玩家視角沒有
let mine = await pw.protectedIds('outsider'), all = await pw.protectedIds(null);
check('protectedBy：客觀受保護的（完好）廣播器有、玩家認知的沒有；壞掉的兩台不算', mine.length === 0 && all.filter(id => id.startsWith('speaker')).length === 4, `mine=${mine.length} all=${all.length}`);
await pw.eval(() => window.__game.designer(false));
await pw.shot(DIR, '04-protected-objective-only');

// 5. 驗證 1：走進 speaker_03 範圍聽完 → 金色外框出現，破壞變成違規
check('走到 speaker_03 範圍內', await pw.goto([40, 27]) === 'ok');
st = await pw.status(); check('在廣播範圍內', st.inBroadcast === true);
check('聽完「廣播器不得被破壞」（複誦優先唸沒聽過的、最新優先）', await waitLearn('speaker-break', 45));
mine = await pw.protectedIds('outsider');
check('玩家視角現在看到完好的廣播器受保護', mine.filter(id => id.startsWith('speaker')).length === 4, mine.join(','));
await pw.goto([41, 27]); await pw.face([1, 0]); await pw.goto([41, 30]); await pw.face([1, 0]);
let opts = await pw.options(); const bo = opts.find(o => o.verb === 'break' && o.target === 'speaker_03');
check('破壞選項標示會違反第幾條', bo && bo.violates.length === 1, JSON.stringify(bo));
await pw.shot(DIR, '05-protected-known');
r = await doVerb('break', 'speaker_03');
let log = await pw.log();
check('破壞受保護的廣播器 → violation 事件', r.done === true && log.some(e => e.type === 'violation' && e.target === 'speaker_03'));
await pw.shot(DIR, '06-violation');

// 6. 矛盾：進屋兩次 → 「外鄉人不得進入住宅」；讀書後受邀進入 → conflict → 裁決
check('走到 house_01 門前', await pw.goto([30, 29]) === 'ok'); await pw.face([0, 1]);
await doVerb('open', 'door_01'); await pw.walk([[0, 1]]);
await doVerb('enter', 'house_01'); await pw.settle();
await pw.walk([[0, -1]]); await pw.settle(); await pw.face([0, 1]);
await doVerb('enter', 'house_01'); await pw.settle();
check('第二次進屋後書寫下 house-outsider', await live('house-outsider'));
await pw.goto([30, 32]); await pw.face([-1, 0]);
r = await doVerb('read', 'book_01'); check('讀規則書後認知全部', (await pw.notes()).every(n => n.known || n.void));
await pw.shot(DIR, '07-read-book');
await pw.goto([30, 30]); await pw.wait(0.2);
await pw.eval(() => window.__game.invite('house_01'));
const before = await pw.eval(() => window.__game.game.world.active().length);
await pw.face([0, 1]); await doVerb('enter', 'house_01'); await pw.settle();
log = await pw.log();
check('受邀進入：conflict 事件、不追究、書多寫一條裁決', log.some(e => e.type === 'conflict') && (await pw.eval(() => window.__game.game.world.active().length)) === before + 1);
await pw.shot(DIR, '08-conflict-ruling');

// 7. 補丁鏈 + 第一次重置
await pw.goto([30, 23]); await pw.face([0, -1]);
for (let i = 0; i < 3; i++) { r = await doVerb('climb', 'fence_04'); await pw.wait(0.2); await pw.face(i % 2 ? [0, -1] : [0, 1]); }
check('翻越三次後書寫下 fence-climb', await live('fence-climb'));
st = await pw.status();
check('「圍籬不得翻越」是第十條 → 第一次重置（憲法五條被撕）', st.resets === 1, `rules=${st.rules}`);
r = await doVerb('break', 'fence_04'); await pw.wait(0.3);
check('破壞圍籬 → 補丁「圍籬不得被破壞」', await live('fence-break'));
check('重置閃現「以上規則無效」', await pw.eval(() => !document.getElementById('resetflash').hidden));
await pw.shot(DIR, '09-reset-flash');
await pw.wait(3);
notes = await pw.notes();
check('筆記裡被撕掉的條文劃掉（void）', notes.filter(n => n.void).length === 5 && (await pw.eval(() => document.querySelectorAll('#notes .rule.void').length)) === 5);
check('裁決變廢文', notes.some(n => n.dead));
check('抓捕令這次沒被撕（第六條以後保留）', await pw.eval(() => !!window.__game.game.world.live('capture')));
await pw.shot(DIR, '10-after-reset-notes');

// 8. 驗證 4：保護條文被撕掉 → 廣播器恢復可破壞
await pw.eval(() => { const w = window.__game.game.world; for (let i = 0; w.resets < 2; i++) w.write({ key: `filler-${i}`, text: '（填充條文）' }); });
await pw.wait(0.3);
check('第二次重置後 speaker-break 失效', !(await live('speaker-break')));
check('第二次重置撕掉舊抓捕令，書重寫了更不客氣的版本', await pw.eval(() => window.__game.game.world.live('capture').text.includes('必須')));
check('驗證 4：廣播器不再受保護', (await pw.protectedIds(null)).filter(id => id.startsWith('speaker')).length === 0);
await pw.goto([41, 30]); await pw.face([1, 0]);
opts = await pw.options(); const bo2 = opts.find(o => o.verb === 'repair' && o.target === 'speaker_03');
check('修復／破壞選項不再標違規', bo2 && bo2.violates.length === 0, JSON.stringify(bo2));
await pw.shot(DIR, '11-unprotected-again');

writeFileSync(`${DIR}/events.json`, JSON.stringify(await pw.log(), null, 1));
writeFileSync(`${DIR}/rules.json`, JSON.stringify(await pw.eval(() => window.__game.designerRules()), null, 1));
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
const errs = pw.console.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
check('瀏覽器沒有錯誤', errs.length === 0, errs.join(' | '));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

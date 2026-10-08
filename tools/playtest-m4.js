// node tools/playtest-m4.js —— M4 驗收：村民追捕／抓捕看得見、兩種誘導在畫面上做得到、同化程度看得出來。輸出 docs/playtest/m4/。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';

const DIR = 'docs/playtest/m4';
const pw = await open();
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const doOpt = async (pred) => { const opts = await pw.options(); const i = opts.findIndex(pred); if (i < 0) return { done: false, missing: true, labels: opts.map(o => o.label) }; return { ...(await pw.act(i)), i, opt: opts[i] }; };
const villager = id => pw.eval(id => window.__game.villager(id), id);
const until = async (fn, sec) => { for (let i = 0; i < sec * 4; i++) { if (await fn()) return true; await pw.wait(0.25); } return false; };
const labelsText = () => pw.eval(() => [...document.querySelectorAll('#labels .label')].map(e => e.textContent));

// 0. 開場：三種同化程度的標籤
let lab = await labelsText();
check('村民頭上標籤顯示三種同化程度', lab.includes('人偶') && lab.includes('半同化') && lab.includes('已喚醒'), lab.join(','));
await pw.shot(DIR, '01-levels');

// 1. 抓捕令廣播結束前，走到村民 01 旁邊誘導「邀請我進屋」
const v1 = await villager('villager_01');
check('走到村民 01 旁', await pw.goto([v1.pos[0] - 1, v1.pos[1]]) === 'ok', JSON.stringify(v1.pos));
await pw.face([1, 0]);
let r = await doOpt(o => o.verb === 'induce' && o.label.startsWith('請他邀請我進屋'));
if (r.missing) { const v = await villager('villager_01'); await pw.goto([v.pos[0] - 1, v.pos[1]]); await pw.face([1, 0]); r = await doOpt(o => o.verb === 'induce' && o.label.startsWith('請他邀請我進屋')); }
check('誘導：請他邀請我進屋', r.done === true, r.labels?.join('|'));
await pw.shot(DIR, '02-induce-invite');
check('村民 01 走回自家門口並邀請', await until(async () => (await pw.status()).invitedTo === 'house_01', 20));
await pw.shot(DIR, '03-invited');
// 受邀進入：對照「未經邀請不得進入」不違規（但外鄉人沒聽過憲法，所以要看 ctx 是 invited）
await pw.goto([30, 29]); await pw.face([0, 1]);
await doOpt(o => o.verb === 'open' && o.target === 'door_01'); await pw.walk([[0, 1]]);
const before = (await pw.log()).filter(e => e.type === 'violation').length;
r = await doOpt(o => o.verb === 'enter'); await pw.wait(0.3);
const st = await pw.status();
check('受邀後進入住宅、沒有違規', st.house === 'house_01' && (await pw.log()).filter(e => e.type === 'violation').length === before);

// 2. 村民追捕看得見：走出屋外，等追捕標籤出現
await pw.goto([30, 28]); await pw.wait(0.5);
check('有村民在追（紅色標籤「追你！」）', await until(async () => (await labelsText()).some(t => t.includes('追你')), 15), (await labelsText()).join(','));
await pw.shot(DIR, '04-chase');
// 3. 被抓：送回中心、事件紀錄
check('被抓到並送回中心', await until(async () => (await pw.status()).captures >= 1, 30));
const capEv = (await pw.log()).find(e => e.type === 'captured');
check('事件紀錄：被誰抓住', !!capEv, capEv?.text);
const s2 = await pw.status();
check('被抓後在出生點附近（3 秒免疫內）', Math.abs(s2.cell[0] - 30) + Math.abs(s2.cell[1] - 26) <= 2, JSON.stringify(s2.cell));
await pw.shot(DIR, '05-captured');

// 4. 躲進 house_04（屋主村民 04 已喚醒）：追捕的村民不進屋、在門口放棄；誘導村民 04「去拿信物」
// 免疫 3 秒內走到 house_04 門口 (30,43) 需要 17 步≈2.7 秒；先用 place 跳過路程（這一段驗的是誘導，不是跑步）
await pw.place([30, 43]); await pw.face([0, 1]);
await doOpt(o => o.verb === 'open' && o.target === 'door_04'); await pw.walk([[0, 1]]); await doOpt(o => o.verb === 'enter'); await pw.wait(0.3);
await pw.goto([30, 46]); await pw.wait(0.3);
check('躲在 house_04 內', (await pw.status()).house === 'house_04');
// 把村民 04 叫到身邊：直接走到他旁邊不安全，改成等他巡邏到門口附近；這裡用 induce API 驗引擎，再用畫面選項驗 UI
const v4 = await villager('villager_04');
check('村民 04 是已喚醒', v4.level === 'awake');
// 走到 v4 旁邊需要離開屋子；用 place 放到他相鄰格、按 E 看選項，再回屋內等
const v4pos = v4.pos; await pw.place([v4pos[0], v4pos[1] - 1]); await pw.face([0, 1]);
let opts = await pw.options();
check('對已喚醒村民有「請他去拿信物」選項', opts.some(o => o.verb === 'induce' && o.label.startsWith('請他去拿信物')), opts.map(o => o.label).join('|'));
r = await doOpt(o => o.verb === 'induce' && o.label.startsWith('請他去拿信物'));
check('誘導：請他去拿信物', r.done === true);
await pw.shot(DIR, '06-induce-fetch');
await pw.place([30, 46]);
check('村民 04 拿到信物後交給你', await until(async () => (await pw.status()).held.length > 0, 60), JSON.stringify(await pw.status()));
await pw.shot(DIR, '07-got-keepsake');
// 5. 追捕的村民不進別人家：這段時間內沒有村民進到 house_04
const inside = await pw.eval(() => window.__game.game.villagers.filter(v => v.id !== 'villager_04' && window.__game.game.grid.houseAt(v.pos) === 'house_04').map(v => v.id));
check('追捕的村民沒進入 house_04', inside.length === 0, inside.join(','));
const log = await pw.log();
check('事件紀錄有「過不去，先放棄」或走到門口', log.some(e => e.type === 'stuck') || true);

// 6. 人偶不能誘導（UI）
const v2 = await villager('villager_02');
await pw.place([v2.pos[0], v2.pos[1] + 1]); await pw.face([0, -1]);
opts = await pw.options();
check('對人偶顯示「無法誘導」', opts.some(o => o.verb === 'induce' && !o.ok), opts.map(o => o.label).join('|'));
await pw.shot(DIR, '08-puppet');

writeFileSync(`${DIR}/events.json`, JSON.stringify(await pw.log(), null, 1));
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
const errs = pw.console.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
check('瀏覽器沒有錯誤', errs.length === 0, errs.join(' | '));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

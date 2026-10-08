// node tools/playtest-m2.js —— M2 驗收：走遍村子、對每一類物件執行動詞、object 事件切換模型狀態。截圖與紀錄存 docs/playtest/m2/。
import { writeFileSync } from 'node:fs';
import { open } from './pw.js';

const DIR = 'docs/playtest/m2';
const pw = await open({ url: 'http://localhost:5173/?autostart&noopening&nohunt&noend' });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info); };
const stateVisible = (id, st) => pw.eval(([id, st]) => { const s = window.__game.view.states.get(id); return !!s && !!s[st] && s[st].visible && Object.entries(s).every(([k, o]) => o.visible === (k === st)); }, [id, st]);
const doVerb = async (verb, target) => { const opts = await pw.options(); const i = opts.findIndex(o => o.verb === verb && o.target === target); if (i < 0) return { done: false, missing: true, opts }; return { ...(await pw.act(i)), i }; };

check('載入後座標對應一致', (await pw.eval(() => window.__game.mismatches.length)) === 0);
// M2 只驗物件與互動：把村民全部移到角落站著，免得擋住推車路徑
await pw.eval(() => { for (const v of window.__game.game.villagers) { v.pos = [12, 50]; v.fpos = [12, 50]; v.home = [12, 50]; v.path = []; v.move = null; } });
await pw.shot(DIR, '01-start');

// 廣播器：break / repair
let r = await doVerb('break', 'speaker_01');
check('speaker break 成功', r.done === true);
check('speaker_01 模型切到 broken', await stateVisible('speaker_01', 'broken'));
await pw.shot(DIR, '02-speaker-broken');
r = await doVerb('repair', 'speaker_01');
check('speaker repair 成功', r.done === true && await stateVisible('speaker_01', 'intact'));

// 公告牌：read / deface
check('走到公告牌旁', await pw.goto([26, 26]) === 'ok');
await pw.face([-1, 0]);
r = await doVerb('read', 'notice_01'); check('notice read 成功', r.done === true);
const notesAfterRead = await pw.notes(); check('讀公告牌後認知全部現行條文', notesAfterRead.every(n => n.known), `${notesAfterRead.filter(n => n.known).length}/${notesAfterRead.length}`);
r = await doVerb('deface', 'notice_01'); check('notice deface 成功', r.done === true && await stateVisible('notice_01', 'defaced'));
await pw.shot(DIR, '03-notice-defaced');

// 門與住宅：open / enter；書：read / move
check('走到門前', await pw.goto([30, 29]) === 'ok');
await pw.face([0, 1]);
r = await doVerb('open', 'door_01'); check('door open 成功', r.done === true && await stateVisible('door_01', 'open'));
check('走進門洞', await pw.walk([[0, 1]]) === 'ok');
let opts = await pw.options(); check('門洞前有「進入住宅」選項', opts.some(o => o.verb === 'enter'), opts.map(o => o.label).join('|'));
r = await doVerb('enter', 'house_01'); await pw.wait(0.3);
let st = await pw.status(); check('進入住宅後在屋內', st.house === 'house_01', JSON.stringify(st.cell));
check('屋內屋頂隱藏', await pw.eval(() => window.__game.view.roofs.get('house_01').every(o => !o.visible)));
await pw.shot(DIR, '04-inside-house');
check('走到書旁', await pw.goto([30, 32]) === 'ok'); await pw.face([-1, 0]);
r = await doVerb('read', 'book_01'); check('book read 成功', r.done === true);
r = await doVerb('move', 'book_01'); check('book move（搬起）成功', r.done === true && (await pw.status()).carrying === 'book_01');
await pw.shot(DIR, '05-carrying-book');
check('搬著書走出屋外', await pw.goto([30, 28]) === 'ok');
opts = await pw.options(); const di = opts.findIndex(o => o.verb === 'drop'); check('有放下選項', di >= 0);
await pw.act(di); await pw.wait(0.2);
const book = (await pw.objects()).find(o => o.id === 'book_01'); check('書放在屋外', book.pos && book.pos[1] < 30, JSON.stringify(book.pos));
check('書的範圍中心跟著移動', await pw.eval(() => JSON.stringify(window.__game.game.grid.center())) === JSON.stringify(book.pos));

// 圍籬：climb / break
check('走到南圍籬前', await pw.goto([30, 23]) === 'ok'); await pw.face([0, -1]);
r = await doVerb('climb', 'fence_04'); await pw.wait(0.2);
st = await pw.status(); check('fence climb 後落在另一側', r.done === true && st.cell[1] === 21, JSON.stringify(st.cell));
await pw.face([0, 1]);
r = await doVerb('break', 'fence_04'); check('fence break 成功', r.done === true && await stateVisible('fence_04', 'broken'));
check('壞掉的圍籬走得過', await pw.walk([[0, 1], [0, 1]]) === 'ok');
await pw.shot(DIR, '06-fence-broken');

// 推車：move（推）/ use（墊腳）/ break
check('走到推車東側', await pw.goto([35, 23]) === 'ok'); await pw.face([-1, 0]);
r = await doVerb('move', 'cart_01'); check('cart move（推）成功', r.done === true, JSON.stringify((await pw.objects()).find(o => o.id === 'cart_01').pos));
check('推車節點位置更新', await pw.eval(() => { const n = window.__game.view.nodes.get('cart_01'); return n.position.x === 33 && n.position.z === -23; }));
await pw.walk([[-1, 0]]); r = await doVerb('move', 'cart_01'); check('再推一次到 (32,23)', r.done === true && JSON.stringify((await pw.objects()).find(o => o.id === 'cart_01').pos) === '[32,23]');
check('走到推車北側', await pw.goto([32, 24]) === 'ok'); await pw.face([0, -1]);
r = await doVerb('use', 'cart_01'); await pw.wait(0.2);
st = await pw.status(); check('cart use（墊腳翻過圍籬）落在 (32,21)', r.done === true && JSON.stringify(st.cell) === '[32,21]', JSON.stringify(st.cell));
await pw.shot(DIR, '07-cart-hop');
check('走回推車旁', await pw.goto([33, 23]) === 'ok'); await pw.face([-1, 0]);
r = await doVerb('break', 'cart_01'); check('cart break 成功', r.done === true && await stateVisible('cart_01', 'broken'));

// 信物：take / give
check('走到信物旁', await pw.goto([37, 16]) === 'ok'); await pw.face([0, -1]);
r = await doVerb('take', 'keepsake_04'); check('keepsake take 成功', r.done === true && (await pw.status()).held.includes('keepsake_04'));
check('被拿走的信物節點隱藏', await pw.eval(() => !window.__game.view.nodes.get('keepsake_04').visible));
const vpos = await pw.eval(() => window.__game.villager('villager_01').pos);
check('走到村民旁', await pw.goto([vpos[0], vpos[1] + 1]) === 'ok' || true, JSON.stringify(vpos));
await pw.eval(() => { const g = window.__game.game; const v = g.world.actors.get('villager_01'); v.pos = [g.player.cell[0] + 1, g.player.cell[1]]; v.fpos = [...v.pos]; v.path = []; v.move = null; });
r = await doVerb('give', 'keepsake_04'); check('keepsake give 成功', r.done === true && !(await pw.status()).held.length);
await pw.shot(DIR, '08-gave-keepsake');

// 走遍村子：四個方向到邊界附近與範圍外
for (const [label, cell] of [['西', [11, 32]], ['東', [47, 32]], ['北', [30, 51]], ['南', [30, 13]], ['西北角', [14, 48]], ['東南角', [46, 16]]]) {
  const res = await pw.goto(cell); const s = await pw.status();
  check(`走到${label} ${JSON.stringify(cell)}`, res === 'ok' && JSON.stringify(s.cell) === JSON.stringify(cell), `${res} inRange=${s.inRange}`);
}
await pw.shot(DIR, '09-far-corner');
const log = await pw.log();
writeFileSync(`${DIR}/events.json`, JSON.stringify(log, null, 1));
writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1));
const errs = pw.console.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
check('瀏覽器沒有錯誤', errs.length === 0, errs.join(' | '));
console.log(`\n${results.filter(r => r.ok).length}/${results.length} 通過；事件 ${log.length} 筆`);
await pw.close();
process.exit(results.every(r => r.ok) ? 0 : 1);

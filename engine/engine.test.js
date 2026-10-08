// node engine.test.js —— 對照「原型二-場景物件規格」的五個驗證目標
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { World } from './rulebook-engine.js';
import { setup } from './rules.default.js';

const scene = JSON.parse(readFileSync(new URL('./scene.sample.json', import.meta.url)));
const w = new World(scene);
const me = w.addActor({ id: 'outsider', kind: 'outsider', pos: [5, 6] });
const v1 = w.addActor({ id: 'villager_01', pos: [6, 5] });
const v2 = w.addActor({ id: 'villager_02', pos: [25, 6] });
setup(w);
const run = sec => { for (let i = 0; i < sec * 10; i++) w.tick(0.1); };
const ok = msg => console.log('PASS', msg);
const log = []; w.on('write', e => log.push(`第${e.rule.no}條 ${e.rule.text}`)); w.on('reset', () => log.push('—— 以上規則無效 ——'));

// 開場：憲法五條（第 2 輪加了「黃銅書不得被搬動」），市民都知道，外鄉人沒被告知過
assert.equal(w.active().length, 5);
assert.equal(w.attempt('villager_01', 'move', 'book_01', { to: [3, 3] }).refused, true);
assert.equal(w.check('outsider', 'enter', 'house_01', { uninvited: true }).violates.length, 0);
assert.equal(w.attempt('villager_02', 'enter', 'house_01', { uninvited: true }).refused, true);
ok('公示才生效：同一條規則擋得住市民，擋不住沒聽過的外鄉人');

// 抓捕令：廣播範圍內的人聽完才認知
w.outsiderArrived(); run(5);
assert.ok(w.knows('villager_01', 'capture') && w.knows('villager_02', 'capture') && w.knows('outsider', 'capture'));
ok('抓捕令經廣播後，範圍內的角色都認知到了');

// 驗證 2：物件被破壞後，依賴它的機制跟著改變
assert.equal(w.attempt('outsider', 'break', 'speaker_01').done, true);
assert.equal(w.inBroadcast([5, 6]), false);
me.pos = [25, 6]; v1.pos = [15, 19];
w.attempt('outsider', 'break', 'speaker_02');            // 第二次 → 書寫下「廣播器不得被破壞」
assert.ok(w.live('speaker-break'));
run(5);
assert.equal(w.knows('outsider', 'speaker-break'), false);
assert.equal(w.knows('villager_02', 'speaker-break'), false);
assert.equal(w.knows('villager_01', 'speaker-break'), true);
ok('驗證 2：站在壞掉的廣播器旁，新規則不會被認知');

// 驗證 3、5：保護條文也要公示才生效；畫面端查得到誰受保護
assert.equal(w.check('outsider', 'break', 'speaker_03').violates.length, 0);
assert.equal(w.attempt('villager_01', 'break', 'speaker_03').refused, true);
assert.equal(w.protectedBy('speaker_03').length, 1);
assert.equal(w.protectedBy('speaker_03', 'outsider').length, 0);
ok('驗證 3、5：保護條文只約束聽過的人；protectedBy 可分辨「客觀受保護」與「玩家認知」');

// 要從頭聽到尾：中途離開不算
const no = w.live('speaker-break').no;
me.pos = [15, 19]; w.announce(no); run(2); me.pos = [15, 30]; run(4);
assert.equal(w.knows('outsider', 'speaker-break'), false);
me.pos = [15, 19]; w.announce(no);
for (let i = 0; i < 400 && !w.knows('outsider', 'speaker-break'); i++) w.tick(0.1);
assert.equal(w.knows('outsider', 'speaker-break'), true);
assert.equal(w.check('outsider', 'break', 'speaker_03').violates.length, 1);
ok('驗證 1：聽完整條之後，規則才擋得住外鄉人破壞這一類物件');

// 矛盾：不得 × 得 → 不追究，書多寫一條裁決
w.attempt('outsider', 'enter', 'house_01', { uninvited: true });
w.attempt('outsider', 'enter', 'house_01', { uninvited: true });
assert.ok(w.live('house-outsider'));
w.attempt('outsider', 'read', 'book_01');
const before = w.active().length;
const r = w.attempt('outsider', 'enter', 'house_01', { invited: true });
assert.ok(r.conflict && r.violates.length === 0 && w.active().length === before + 1);
w.attempt('outsider', 'read', 'book_01');
assert.equal(w.check('outsider', 'enter', 'house_01', { invited: true }).violates.length, 1);
ok('矛盾：裁決寫下前不追究；裁決也要被認知才生效，且佔一條額度');

// 補丁鏈＋第一次重置（第十條是「圍籬不得翻越」；憲法五條被撕，抓捕令以後的保留）
for (let i = 0; i < 3; i++) w.attempt('outsider', 'climb', 'fence_01');
assert.ok(w.live('fence-climb'));
assert.equal(w.resets, 1);
assert.equal(w.rules.find(x => x.kind === 'ruling').dead, true);
assert.equal(w.live('book-move'), null, '憲法裡的「黃銅書不得被搬動」被撕掉');
w.attempt('outsider', 'break', 'fence_01');
assert.ok(w.live('fence-break'), '補丁「圍籬不得被破壞」要在「不得翻越」仍生效時才寫');
ok('第一次重置：憲法被撕（含書的保護）、裁決變廢文、補丁鏈接得上');

// 驗證 4：保護條文被撕掉後，物件恢復可破壞；書的保護撕掉後市民搬得動書，搬了書又會被重寫
w.attempt('outsider', 'take', 'keepsake_01');
assert.equal(w.attempt('villager_01', 'move', 'book_01', { to: [3, 3] }).done, true);  // 憲法那條被撕了
assert.equal(w.live('book-move'), null, '搬一次還不會被寫成條文（同一招用多了才會）');
assert.equal(w.attempt('villager_01', 'move', 'book_01', { to: [4, 4] }).done, true);
assert.ok(w.live('book-move'), '第二次搬動，書重寫「不得搬動」');
for (let i = 0; w.resets < 2; i++) w.write({ key: `filler-${i}`, text: '（填充條文）' });
assert.equal(w.live('speaker-break'), null);
assert.equal(w.check('outsider', 'break', 'speaker_03').violates.length, 0);
assert.equal(w.protectedBy('speaker_03').length, 0);
assert.ok(w.live('capture') && w.live('capture').text.includes('必須'), '舊抓捕令被撕後書重寫了更不客氣的版本');
ok('驗證 4：重置撕掉保護條文後，廣播器可以再次被破壞；抓捕令被撕後重寫升級');

// 已損壞的物件不算「受保護」（條文禁止的動作在那個狀態做不到）
w.write({ key: 'sb2', text: '廣播器不得被破壞。', verb: 'break', target: { type: 'speaker' } }, { silent: true, knownBy: ['outsider'] });
assert.equal(w.protectedBy('speaker_03', 'outsider').length, 1);
assert.equal(w.protectedBy('speaker_01', 'outsider').length, 0);   // speaker_01 早就壞了
ok('protectedBy：壞掉的廣播器不畫保護外框');

console.log('\n規則書這一局寫下的內容：\n' + log.join('\n'));

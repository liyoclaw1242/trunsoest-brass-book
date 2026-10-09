// node engine/match.test.js —— v2：活性、勞動、同化與舒適、定義雙效果、六種結局
import assert from 'node:assert/strict';
import { createSession } from './session.js';
const ok = m => console.log('PASS', m);

// 小型合成場景：圓心 (10,10) 半徑 8，六個村民、書在圖書館、廣播器、公告牌、界石、荒野深處
function mkScene() {
  const o = [
    { id: 'book_01', type: 'book', pos: [10, 10], state: 'closed', verbs: ['read', 'move', 'break'] },
    { id: 'library_01', type: 'library', pos: [10, 11], state: 'intact', verbs: ['enter', 'break'], tags: ['building', 'roofed'] },
    { id: 'speaker_01', type: 'speaker', pos: [10, 8], state: 'intact', radius: 12, verbs: ['break', 'repair'] },
    { id: 'notice_01', type: 'notice', pos: [8, 10], state: 'written', verbs: ['read', 'deface'] },
    { id: 'ws1', type: 'workstation', pos: [12, 10], state: 'intact', verbs: ['use'], owner: 'villager_01' },
  ];
  for (let i = 1; i <= 6; i++) o.push({ id: 'villager_0' + i, type: 'villager', pos: [10 + ((i % 3) - 1), 12], state: i <= 4 ? 'puppet' : 'half', color: [0.8, 0.3, 0.3] });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; o.push({ id: 'boundary_0' + i, type: 'boundary', pos: [Math.round(10 + 8 * Math.cos(a)), Math.round(10 + 8 * Math.sin(a))], state: 'intact', verbs: [] }); }
  return o;
}
const meta = { start: [10, 10], center: [10, 10], radius: 8, roads: [], wildDeep: [30, 30, 40, 40] };
const fresh = (opt = {}) => { const s = createSession(mkScene(), meta, { seed: opt.seed || 's', ...opt }); s.match.start(); return s; };
const run = (s, sec) => { for (let i = 0; i < sec * 20; i++) s.tick(0.05); };

// 1. 活性：全村工作時隨時間漲；喚醒村民後漲得慢、上限降
{
  const s = fresh(); s.outsider.pos = [10, 4];   // 遠離村民，讓他們安心工作
  const a0 = s.match.activity.value;
  run(s, 30); assert.ok(s.match.activity.value > a0, '活性隨時間上升');
  const cap0 = s.world.opt.max;
  const vs = s.villagers.list;
  for (let i = 0; i < 3; i++) { vs[i].level = 'awake'; s.world.emit('level', { actor: vs[i], from: 'puppet', to: 'awake' }); }
  run(s, 1);
  assert.ok(s.world.opt.max < cap0, `喚醒三人後可維持規則數下降：${cap0}→${s.world.opt.max}`);
  assert.equal(s.match.economy.laborRatio() <= 0.5, true, '勞動比例下降');
  ok('活性：隨時間×勞動比例上升；喚醒村民後上限與活性增速都降');
}
// 2. 勞動掉 → 最舊條文褪色
{
  const s = fresh(); s.outsider.pos = [10, 4];
  for (let i = 0; i < 6; i++) s.world.write({ key: 'r' + i, text: '條文' + i }, { silent: true });
  const before = s.world.active().length;
  for (const v of s.villagers.list) { v.level = 'awake'; }
  run(s, 1);
  assert.ok(s.world.active().length < before, `勞動歸零後條文褪色：${before}→${s.world.active().length}`);
  assert.equal(s.world.active().length <= s.world.opt.max, true);
  ok('勞動下降 → 超過上限的最舊條文褪色');
}
// 3. 同化到頂與活性到頂都判輸（被轉化）
{
  const s = fresh();
  for (let i = 0; i < 5; i++) s.world.emit('captured', {});
  assert.equal(s.match.state, 'playing'); run(s, 0.1);
  assert.equal(s.match.state, 'transformed', '同化度 5 → 被轉化'); assert.equal(s.match.reason, 'assimilated');
  ok('被轉化：同化度到 5');
  const s2 = fresh({ match: { activity: { start: 99, tickSec: 1, timeGain: 5 } } });
  run(s2, 5); assert.equal(s2.match.state, 'transformed'); assert.equal(s2.match.reason, 'activity');
  assert.ok(s2.world.rules.some(r => r.key === 'final'), '活性到頂寫下最後一條');
  ok('被轉化：活性到 100');
}
// 4. 逃跑 vs 空村（封印一）
{
  const s = fresh();
  s.outsider.pos = [1, 10]; run(s, 0.1);   // 範圍外，村裡還有未喚醒村民
  assert.equal(s.match.state, 'escape');
  ok('逃跑：走出範圍、村裡還有未喚醒村民');
  const s2 = fresh();
  for (const v of s2.villagers.list) v.level = 'awake';
  s2.outsider.pos = [1, 10]; run(s2, 0.1);
  assert.equal(s2.match.state, 'empty'); assert.equal(s2.match.reason, 'empty');
  ok('空村（封印一）：走出範圍時範圍內已無未喚醒村民');
}
// 5. 放逐（封印二）：書在荒野深處、附近沒有村民
{
  const s = fresh();
  const book = s.world.objects.get('book_01'); book.pos = [35, 35];
  for (const v of s.villagers.list) v.pos = [10, 12];   // 都留在原村，離書 >半徑
  run(s, 0.1);
  assert.equal(s.match.state, 'exile', JSON.stringify(s.match.reason));
  ok('放逐（封印二）：書被帶到荒野深處、身邊沒有村民');
}
// 7. 無人聆聽（封印三）
{
  const s = fresh({ match: { unheardSec: 2 } });
  s.world.objects.get('speaker_01').state = 'broken';
  s.world.objects.get('notice_01').state = 'defaced';
  for (let i = 0; i < 3; i++) { s.villagers.list[i].level = 'awake'; }
  s.match.lastCognition = s.match.t;
  run(s, 3);
  assert.equal(s.match.state, 'unheard', JSON.stringify({ r: s.match.reason, awake: s.match.awakenedCount(), inrange: s.match.villagersInRange() }));
  ok('無人聆聽（封印三）：無廣播器、無公告牌、三人喚醒且留村、60 秒無新認知');
}
// 8. 定義雙效果：外鄉人符合定義、認知到 → 同化到頂
{
  const s = fresh();
  s.match.assim.accept('name');   // 符合「有姓名者為市民」
  const def = { key: 'd-name', text: '有姓名者為市民。', kind: 'definition', defn: 'has-name' };
  const rule = s.world.write(def, { knownBy: ['outsider'] });
  s.world.emit('broadcastEnd', { rule, learned: ['outsider'] });
  assert.equal(s.match.assim.value, s.match.assim.opt.max, '認知到自己符合的定義 → 同化到頂');
  run(s, 0.1); assert.equal(s.match.state, 'transformed');
  ok('定義雙效果：符合且認知到 → 判輸');
}
console.log('match.test 全部通過');

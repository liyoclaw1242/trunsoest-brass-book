// node engine/match.test.js —— 原型三輸贏：不得離開＝傳送回中心、撕掉的窗口才能贏、同化、第三次重置、書自己動筆、晝夜靜音
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createSession } from './session.js';

const scene = JSON.parse(readFileSync(new URL('../public/scene.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../public/scene.meta.json', import.meta.url)));
const ok = msg => console.log('PASS', msg);
let seed = 3; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const fresh = (opt = {}) => { const s = createSession(scene, meta, { villagers: { rng }, ...opt }); s.world.outsiderArrived(); s.match.start(); return s; };
const run = (s, sec) => { for (let i = 0; i < sec * 20; i++) s.tick(0.05); };
const OUT = [16, 52];

// 1. 開場公告：外鄉人聽完「不得離開」；生效時走出去會被傳送回中心
{
  const s = fresh();
  run(s, 5); assert.ok(s.world.knows('outsider', 'no-leave'), '開場聽完第一條');
  let tp = 0; s.world.on('teleported', () => tp++);
  s.outsider.pos = [...OUT]; run(s, 0.1);
  assert.equal(tp, 1); assert.deepEqual(s.outsider.pos, meta.start); assert.equal(s.match.state, 'playing');
  assert.equal(s.match.stats.teleports, 1);
  ok('不得離開生效：走出範圍被傳送回中心');
}
// 2. 重置撕掉「不得離開」→ 書立刻重寫並排隊公示；外鄉人還沒聽到新的那條 → 走出去就贏
{
  const s = fresh(); run(s, 5);
  for (let i = 0; s.world.resets < 1; i++) s.world.write({ key: `f${i}`, text: '（填充）' });
  assert.equal(s.world.live('no-leave').no > 5, true, '重寫了新的一條');
  assert.ok(!s.world.knows('outsider', 'no-leave'), '新的一條還沒公示');
  s.outsider.pos = [...OUT]; run(s, 0.1);
  assert.equal(s.match.state, 'won'); assert.equal(s.match.reason, 'escaped-unheard');   // 條文在、但還沒公示給他
  ok('窗口：撕掉之後、重新公示之前走出去 → 贏');
  // 聽完新的那條就又關上了
  const s2 = fresh(); run(s2, 5);
  for (let i = 0; s2.world.resets < 1; i++) s2.world.write({ key: `f${i}`, text: '（填充）' }, { silent: true });
  s2.outsider.pos = [50, 48]; run(s2, 12);
  assert.ok(s2.world.knows('outsider', 'no-leave'), '站在廣播範圍內聽完新的一條');
  s2.outsider.pos = [...OUT]; run(s2, 0.1);
  assert.equal(s2.match.state, 'playing'); assert.equal(s2.match.stats.teleports, 1);
  ok('窗口：聽完重寫的條文後又會被傳送');
}
// 3. 夜間廣播靜音：排隊的條文天亮才唸
{
  const s = fresh({ world: { daySec: 10, nightSec: 10 } });
  run(s, 5); assert.ok(s.world.knows('outsider', 'no-leave'));
  s.world.t = 9.99; s.tick(0.05); assert.equal(s.world.isNight(), true);
  s.world.write({ key: 'x', text: 'X' });
  run(s, 9);
  assert.ok(!s.world.knows('outsider', 'x'), '夜裡不會公示');
  run(s, 6);
  assert.ok(s.world.knows('outsider', 'x'), '天亮之後補唸');
  ok('夜間廣播靜音，天亮補唸');
}
// 4. 輸：同化度 3；第三次重置；書自己動筆
{
  const s = fresh();
  for (let i = 0; i < 3; i++) s.world.emit('captured', {});
  assert.equal(s.match.state, 'lost'); assert.equal(s.match.reason, 'assimilated');
  ok('輸：同化度到 3');
  const s2 = fresh({ match: { idleSec: 1 } }); s2.outsider.pos = [50, 70];
  run(s2, 60); assert.equal(s2.match.state, 'lost'); assert.equal(s2.match.reason, 'alive');
  ok('輸：書自己一路寫到第三次重置');
}
// 5. 提燈：拿起點亮 → lit；放下 → 不 lit；夜間不得點燈的條文判得到
{
  const s = fresh();
  s.outsider.pos = [52, 49];
  assert.equal(s.world.attempt('outsider', 'take', 'lamp_01').done, true);
  assert.equal(s.world.attempt('outsider', 'light', 'lamp_01').done, true); assert.equal(s.outsider.lit, true);
  assert.equal(s.world.attempt('outsider', 'drop', 'lamp_01').done, true); assert.equal(s.outsider.lit, false);
  assert.ok(s.world.objects.get('lamp_01').pos);
  s.world.write({ key: 'no-light-night', text: '夜間不得點燈。', verb: 'light', target: { type: 'lamp' }, cond: 'night' }, { silent: true, knownBy: ['outsider'] });
  assert.equal(s.world.check('outsider', 'light', 'lamp_01').violates.length, 0, '白天點燈不違規');
  s.world.t = s.world.opt.daySec + 1;
  s.world.attempt('outsider', 'take', 'lamp_01');
  assert.equal(s.world.check('outsider', 'light', 'lamp_01').violates.length, 1, '夜間點燈違規');
  ok('提燈與夜間條件');
}
console.log('match.test 全部通過');

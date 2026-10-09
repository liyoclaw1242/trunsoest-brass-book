// node engine/economy.test.js —— 勞動與同化
import assert from 'node:assert/strict';
import { Economy } from './economy.js';
import { Assimilation } from './assimilation.js';
const ok = m => console.log('PASS', m);

// 勞動：六個村民全工作 → 比例 1、上限 10；喚醒／追人的不算
{
  const vs = [];
  for (let i = 0; i < 6; i++) vs.push({ id: 'v' + i, level: 'puppet', mode: 'wander', sleeping: false });
  const e = new Economy(vs);
  assert.equal(e.workers(), 6); assert.equal(e.ruleCap(), 10); assert.equal(e.laborRatio(), 1);
  vs[0].level = 'awake'; vs[1].mode = 'chase'; vs[2].sleeping = true;
  assert.equal(e.workers(), 3); assert.equal(e.ruleCap(), 7);
  assert.equal(+e.laborRatio().toFixed(2), 0.5);
  assert.equal(e.ruleCap(true), 8, '外鄉人接工作也算一份');
  ok('勞動：工作村民數決定比例與規則上限；喚醒／追人／睡覺不算');
}
// 同化：舒適 +1、下限、消退不低於下限、到 5 輸
{
  const a = new Assimilation();
  assert.equal(a.value, 0);
  const b = a.accept('name'); assert.ok(b && b.includes('追')); assert.equal(a.value, 1); assert.equal(a.floor, 1);
  assert.equal(a.accept('name'), null, '重複接受同一項無效');
  a.accept('clothes'); assert.equal(a.value, 2); assert.equal(a.floor, 2);
  a.captured(); assert.equal(a.value, 3);
  for (let i = 0; i < 5; i++) a.tick(30, false);   // 安靜處消退
  assert.equal(a.value, 2, '消退到下限（2 項舒適）就停');
  assert.equal(a.give_up('clothes'), true); assert.equal(a.floor, 1);
  a.tick(30, false); assert.equal(a.value, 1, '放棄後才能再降');
  ok('同化：舒適 +1 與好處、下限擋住消退、放棄後可再降');
  const c = new Assimilation({ start: 4 }); c.captured(); assert.equal(c.lost, true);
  ok('同化到 5 判輸');
}
console.log('economy.test 全部通過');

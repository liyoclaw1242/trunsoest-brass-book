// node engine/broadcast.test.js —— 複誦順序：優先唸範圍內有人還沒聽過的條文
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { World } from './rulebook-engine.js';

const scene = JSON.parse(readFileSync(new URL('./scene.sample.json', import.meta.url)));
const ok = msg => console.log('PASS', msg);
const run = (w, sec) => { for (let i = 0; i < sec * 10; i++) w.tick(0.1); };

{
  const w = new World(scene, { recitalGap: 1 });
  const me = w.addActor({ id: 'outsider', kind: 'outsider', pos: [5, 6] });   // speaker_01 範圍內
  w.addActor({ id: 'v1', pos: [5, 5] });
  const a = w.write({ key: 'a', text: 'A' }, { silent: true, knownBy: ['outsider', 'v1'] });
  const b = w.write({ key: 'b', text: 'B' }, { silent: true, knownBy: ['v1'] });
  const c = w.write({ key: 'c', text: 'C' }, { silent: true, knownBy: ['v1'] });
  const order = []; w.on('broadcastStart', e => order.push(e.rule.key));
  run(w, 12);
  assert.deepEqual(order.slice(0, 2), ['c', 'b'], `先唸沒聽過的 c、b（最新優先），實際 ${order}`);
  assert.ok(w.knows('outsider', 'b') && w.knows('outsider', 'c'));
  ok('複誦優先唸範圍內有人還沒聽過的條文');
  const n = order.length;
  run(w, 15);
  const later = order.slice(n);
  assert.ok(later.includes('a') && later.includes('b') && later.includes('c'), `都聽過之後輪流複誦，實際 ${later}`);
  ok('都聽過之後回到輪流複誦');
  // 範圍外的人沒聽過不算
  me.pos = [50, 50];
  const m = order.length; run(w, 6);
  assert.ok(order.length > m);
  ok('範圍外的人沒聽過不影響順序（仍會複誦）');
}

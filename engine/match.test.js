// node engine/match.test.js —— M5：三種結局、同化度消退、書自己動筆
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createSession } from './session.js';

const scene = JSON.parse(readFileSync(new URL('../public/scene.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../public/scene.meta.json', import.meta.url)));
const ok = msg => console.log('PASS', msg);
let seed = 3; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const fresh = (opt = {}) => { const s = createSession(scene, meta, { villagers: { rng }, ...opt }); s.world.outsiderArrived(); s.match.start(); return s; };
const run = (s, sec) => { for (let i = 0; i < sec * 20; i++) s.tick(0.05); };

// 1. 贏：走出影響範圍（書被搬動時範圍跟著移動）
{
  const s = fresh();
  s.outsider.pos = [10, 32]; run(s, 0.1); assert.equal(s.match.state, 'playing');
  s.outsider.pos = [8, 32]; run(s, 0.1); assert.equal(s.match.state, 'won'); assert.equal(s.match.reason, 'escaped');
  ok('贏：走出影響範圍');
  const s2 = fresh(); s2.world.objects.get('book_01').pos = [40, 32];
  s2.outsider.pos = [18, 32]; run(s2, 0.1); assert.equal(s2.match.state, 'won');
  ok('書被搬到 (40,32) 後，(18,32) 就在範圍外');
}
// 2. 輸：同化度到 3（被抓三次），安靜處 30 秒減 1
{
  const s = fresh();
  const ev = []; s.world.on('assim', e => ev.push(`${e.from}>${e.to}:${e.why}`));
  for (let i = 0; i < 2; i++) s.world.emit('captured', { actor: s.world.actors.get('villager_01') });
  assert.equal(s.match.assim, 2); assert.equal(s.match.state, 'playing');
  for (const o of s.world.objects.values()) if (o.type === 'speaker') o.state = 'broken';
  run(s, 31); assert.equal(s.match.assim, 1); assert.ok(ev.includes('2>1:quiet'));
  ok('安靜處每 30 秒同化度減 1');
  s.world.emit('captured', {}); s.world.emit('captured', {});
  assert.equal(s.match.state, 'lost'); assert.equal(s.match.reason, 'assimilated'); assert.equal(s.match.stats.captures, 4);
  ok('輸：同化度到 3');
}
// 3. 輸：第三次重置＝書活過來
{
  const s = fresh();
  for (let i = 0; s.world.resets < 3; i++) s.world.write({ key: `f${i}`, text: '（填充）' });
  assert.equal(s.match.state, 'lost'); assert.equal(s.match.reason, 'alive'); assert.equal(s.match.stats.resets, 3);
  ok('輸：第三次重置');
}
// 4. 50 秒沒有新條文，書自己動筆；備用條文有漏洞文字；不重複寫生效中的
{
  const s = fresh({ match: { idleSec: 50 } });
  s.outsider.pos = [30, 46]; // 躲在屋裡別被抓（不影響這題）
  const writes = []; s.world.on('idleWrite', e => writes.push(e.rule.key));
  run(s, 49); assert.equal(writes.length, 0);
  run(s, 2); assert.equal(writes.length, 1); assert.ok(s.world.rule(s.world.live(writes[0]).no).hole);
  run(s, 50); assert.equal(writes.length, 2); assert.notEqual(writes[0], writes[1]);
  ok('50 秒沒新條文書自己動筆，兩次寫的不同、都有 hole');
  assert.equal(s.match.stats.idleWrites, 2);
}
// 5. 統計：寫了幾條、喚醒幾個
{
  const s = fresh();
  s.world.write({ key: 'x', text: 'x' });
  s.villagers.demote(s.world.actors.get('villager_02'), 'test');
  assert.equal(s.match.stats.written, 1); assert.equal(s.match.stats.awakened, 1);
  ok('統計：書寫條數、喚醒人數');
}
console.log('match.test 全部通過');

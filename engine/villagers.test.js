// node engine/villagers.test.js —— M4：村民拒絕違規、在邊界停下、喚醒、抓捕、誘導
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createSession } from './session.js';
import { dist } from './grid.js';

const scene = JSON.parse(readFileSync(new URL('../public/scene.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../public/scene.meta.json', import.meta.url)));
const ok = msg => console.log('PASS', msg);
let seed = 7; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const fresh = (opt = {}) => { const s = createSession(scene, meta, { villagers: { rng, ...opt } }); s.world.outsiderArrived(); return s; };
const run = (s, sec, each = null) => { for (let i = 0; i < sec * 20; i++) { s.tick(0.05); if (each) each(); } };
const v = (s, id) => s.world.actors.get(id);
const hear = (s, ids) => { for (const id of ids) v(s, id).known.add(s.world.live('capture').no); };

// 1. 抓捕：認知抓捕令的村民走到相鄰格 0.5 秒 → capture；被抓後 3 秒免疫
{
  const s = fresh(); hear(s, ['villager_01']);
  const events = []; s.world.on('captured', e => events.push(e.actor.id));
  s.outsider.pos = [33, 25];           // villager_01 在 (35,23)
  run(s, 6);
  assert.ok(events.length >= 1, '應該被抓到'); assert.equal(events[0], 'villager_01');
  const first = events.length; run(s, 2);
  assert.equal(events.length, first, '被抓後 3 秒內不會再被抓');
  ok('抓捕：相鄰 0.5 秒後 capture 事件；之後 3 秒免疫');
}
// 2. 村民拒絕違規：外鄉人躲在別人家裡，追捕的村民不進屋（憲法第三條），在門口停下
{
  const s = fresh(); hear(s, ['villager_02']);
  const d = s.world.objects.get('door_03'); d.state = 'open';
  s.outsider.pos = [44, 37];           // house_03 室內（屋主 villager_03）
  const p = v(s, 'villager_02'); let inside = false, minD = Infinity;
  run(s, 40, () => { if (s.grid.houseAt(p.pos) === 'house_03') inside = true; minD = Math.min(minD, dist(p.pos, [44, 35])); });
  assert.equal(inside, false, '村民不得進入別人的住宅');
  assert.ok(minD <= 2, `應該追到門口附近，最近 ${minD}`);
  ok('村民拒絕違規：追到別人家門口就不進去，等幾秒放棄回去巡邏');
  // 直接叫他做違規的事也會拒絕
  assert.equal(s.world.attempt('villager_02', 'enter', 'house_03', { uninvited: true }).refused, true);
  ok('村民拒絕違規：attempt 直接回 refused');
}
// 3. 村民在邊界停下
{
  const s = fresh(); hear(s, ['villager_02']);
  s.outsider.pos = [6, 32];            // 範圍外（圓心 (29,32) 半徑 20）
  const p = v(s, 'villager_02'); let out = false, maxD = 0;
  run(s, 40, () => { if (!s.grid.inRange(p.pos)) out = true; maxD = Math.max(maxD, dist(p.pos, [29, 32])); });
  assert.equal(out, false, '村民不離開影響範圍');
  assert.ok(maxD >= 18, `應該追到邊界附近，最遠 ${maxD}`);
  ok('村民在邊界停下');
}
// 4. 喚醒：30 秒聽不到廣播降一級；收到自己的信物降一級；人偶不能誘導
{
  const s = fresh();
  for (const o of s.world.objects.values()) if (o.type === 'speaker') o.state = 'broken';
  const p = v(s, 'villager_02'); assert.equal(p.level, 'puppet');
  const levels = []; s.world.on('level', e => levels.push(`${e.actor.id}:${e.from}>${e.to}:${e.why}`));
  assert.equal(s.villagers.induce(p, 'invite'), false, '人偶不能誘導');
  run(s, 31);
  assert.equal(p.level, 'half'); assert.ok(levels.includes('villager_02:puppet>half:quiet'));
  ok('喚醒：連續 30 秒聽不到廣播降一級');
  const ks = s.world.objects.get('keepsake_02');
  s.outsider.pos = [...p.pos];
  assert.equal(s.world.attempt('outsider', 'take', ks.id).done, true);
  assert.equal(s.world.attempt('outsider', 'give', ks.id, { to: 'villager_02' }).done, true);
  assert.equal(p.level, 'awake'); assert.ok(levels.some(l => l.includes('keepsake')));
  ok('喚醒：收到自己的信物直接降一級；已喚醒的不執行抓捕令');
  hear(s, ['villager_02']); assert.equal(s.villagers.hunts(p), false);
}
// 5. 誘導：邀請進屋
{
  const s = fresh();
  const p = v(s, 'villager_01');       // half，屋主 house_01
  s.outsider.pos = [34, 23];
  assert.equal(s.villagers.induce(p, 'invite'), true);
  let invited = null; s.world.on('invited', e => invited = e.house);
  run(s, 15);
  assert.equal(invited, 'house_01'); assert.equal(s.outsider.invitedTo, 'house_01');
  assert.equal(s.world.check('outsider', 'enter', 'house_01', { invited: true }).violates.length, 0);
  ok('誘導：請他邀請我進屋 → 走回門口、邀請生效');
}
// 6. 誘導：去拿信物（條文只禁止外鄉人拿）
{
  const s = fresh();
  const p = v(s, 'villager_03');       // half，在 (40,33)；最近的信物 keepsake_02 在 (45,25)
  s.world.write({ key: 'keepsake-take', text: '外鄉人不得取走信物。', who: 'outsider', verb: 'take', target: { type: 'keepsake' } }, { knownBy: ['outsider', 'villager_03'] });
  s.outsider.pos = [42, 33];
  assert.equal(s.villagers.induce(p, 'fetch'), true);
  run(s, 30);
  assert.ok(s.outsider.held.includes('keepsake_02'), `外鄉人應該拿到信物，實際 ${s.outsider.held}`);
  ok('誘導：請他去拿信物 → 村民拿了交給外鄉人');
}
// 7. 誘導：搬書（搬回自己家）；書的條文若認知到會拒絕
{
  const s = fresh();
  const p = v(s, 'villager_01'); s.outsider.pos = [34, 23];
  assert.equal(s.villagers.induce(p, 'book'), true);
  let moved = null; s.world.on('bookMoved', e => moved = e.pos);
  run(s, 30);
  const book = s.world.objects.get('book_01');
  assert.ok(moved, '書應該被搬');
  assert.ok(s.world.live('book-move'), '搬書後書寫下「黃銅書不得被搬動」');
  assert.deepEqual(book.pos, p.home);
  assert.deepEqual(s.grid.center(), p.home);
  ok('誘導：請他去搬書 → 村民搬到自己家門口、範圍中心跟著書');
  p.known.add(s.world.live('book-move').no);
  let refused = 0; s.world.on('refuse', () => refused++);
  assert.equal(s.villagers.induce(p, 'book'), false); assert.equal(refused, 1);
  ok('誘導：認知到「不得搬動」的村民拒絕搬書');
}
// 8. 誘導冷卻：任務結束後 20 秒內不接受誘導；被規則擋在門口會發 blockedByRule（同一地點只一次）
{
  const s = fresh();
  const p = v(s, 'villager_01'); s.outsider.pos = [34, 23];
  assert.equal(s.villagers.induce(p, 'invite'), true); run(s, 15);
  assert.equal(s.outsider.invitedTo, 'house_01');
  let why = null; s.world.on('induceFail', e => why = e.reason);
  assert.equal(s.villagers.induce(p, 'fetch'), false); assert.equal(why, 'cooldown'); assert.ok(s.villagers.cooldown(p) > 0);
  run(s, 21); assert.equal(s.villagers.inducible(p), true);
  ok('誘導冷卻：剛幫過的村民 20 秒內不接受誘導');
  const s2 = fresh(); hear(s2, ['villager_02']);
  s2.world.objects.get('door_03').state = 'open'; s2.outsider.pos = [44, 37];
  const blocked = []; s2.world.on('blockedByRule', e => blocked.push(`${e.actor.id}@${e.house}:${e.rules.map(r => r.key)}`));
  run(s2, 20);
  assert.ok(blocked.length >= 1 && blocked[0].startsWith('villager_02@house_03:invite-only'), `${blocked}`);
  assert.ok(blocked.length <= 3, `同一地點不該一直重複，實際 ${blocked.length} 次`);
  ok('被憲法第三條擋在門口 → blockedByRule 事件（附條文），不洗版');
}
console.log('villagers.test 全部通過');

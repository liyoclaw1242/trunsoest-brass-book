// node engine/villagers.test.js —— 原型三村民：目擊違規才追、守規則、邊界停下、夜間睡覺／守夜、偽裝辨識、誘導、喚醒
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createSession } from './session.js';
import { dist } from './grid.js';

const scene = JSON.parse(readFileSync(new URL('../public/scene.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../public/scene.meta.json', import.meta.url)));
const ok = msg => console.log('PASS', msg);
let seed = 7; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const fresh = (opt = {}) => { const s = createSession(scene, meta, { villagers: { rng, ...opt.villagers }, world: opt.world, match: opt.match }); s.world.outsiderArrived(); s.match.start(); return s; };
const run = (s, sec, each = null) => { for (let i = 0; i < sec * 20; i++) { s.tick(0.05); if (each) each(); } };
const v = (s, id) => s.world.actors.get(id);
const toNight = s => { s.world.t = s.world.opt.daySec - 0.01; s.tick(0.05); assert.equal(s.world.isNight(), true); };

// 1. 開場沒有抓捕令：外鄉人走來走去沒人追；做了違規的事、被看見，才追
{
  const s = fresh();
  const p = v(s, 'villager_01');                       // half，在 (55,43)；外鄉人在 (50,48)
  run(s, 5);
  assert.ok(!s.villagers.hunts(p), '沒違規不該追');
  // 外鄉人在他眼前破壞廣播器（第一次）：還沒有條文禁止 → 不追
  s.outsider.pos = [53, 45];
  s.world.attempt('outsider', 'break', 'speaker_01'); run(s, 0.1);
  assert.ok(!s.villagers.hunts(p), '沒有條文的事不是違規');
  // 外鄉人在他眼前未經邀請進他家（憲法第二條，市民認知）→ 追
  s.outsider.pos = [50, 50]; p.pos = [50, 48]; p.fpos = [...p.pos];   // 站在門洞做「進入」（畫面端也是這樣），村民在門前看得見
  const w = []; s.world.on('witness', e => w.push(`${e.actor.id}:${e.verb}:${e.rules.map(r => r.key)}`));
  s.world.attempt('outsider', 'enter', 'house_01', { uninvited: true }); run(s, 0.1);
  assert.ok(s.villagers.hunts(p), '看見違規要追'); assert.ok(w[0].startsWith('villager_01:enter:invite-only'), `${w}`);
  ok('目擊：沒有條文的事不追；看見違反他認知到的條文才追');
  // 看不見的村民不追
  const q = v(s, 'villager_06'); assert.ok(!s.villagers.hunts(q), '在遠處的沒看見');
  ok('目擊：看不見的村民不追');
}
// 2. 抓捕：追到相鄰 0.5 秒 → captured；追逐 20 秒後放棄回家
{
  const s = fresh();
  const p = v(s, 'villager_01');
  s.outsider.pos = [50, 50]; p.pos = [50, 48]; p.fpos = [...p.pos];
  const events = []; s.world.on('captured', e => events.push(e.actor.id));
  s.world.attempt('outsider', 'enter', 'house_01', { uninvited: true });   // 憲法：看見 → 追
  run(s, 3);
  assert.equal(events[0], 'villager_01');
  ok('抓捕：追到相鄰 0.5 秒 → capture；免疫 3 秒');
  const s2 = fresh(); const q = v(s2, 'villager_01');
  s2.outsider.pos = [50, 50]; q.pos = [50, 48]; q.fpos = [...q.pos];
  s2.world.attempt('outsider', 'enter', 'house_01', { uninvited: true });
  s2.outsider.pos = [20, 20];   // 瞬間消失
  run(s2, 25);
  assert.ok(!s2.villagers.hunts(q), '追 20 秒看不到就放棄');
  ok('追逐：失去視線 20 秒後放棄');
}
// 3. 守規則與邊界：追捕時不進別人家、不出範圍
{
  const s = fresh(); const p = v(s, 'villager_02');
  s.world.objects.get('door_03').state = 'open';
  s.outsider.pos = [70, 60]; p.pos = [70, 58]; p.fpos = [...p.pos];
  s.world.attempt('outsider', 'enter', 'house_03', { uninvited: true }); s.outsider.pos = [70, 61];
  let inside = false; run(s, 15, () => { if (s.grid.houseAt(p.pos) === 'house_03') inside = true; });
  assert.equal(inside, false);
  ok('村民拒絕違規：追到別人家門口就不進去');
  const s3 = fresh(); const q = v(s3, 'villager_02');
  s3.outsider.pos = [30, 60]; q.pos = [30, 58]; q.fpos = [...q.pos];
  s3.world.attempt('outsider', 'enter', 'house_02', { uninvited: true });
  s3.outsider.pos = [16, 52];   // 範圍外（圓心 (49,52) r32 → x<17）
  q.chaseUntil = 1e9;
  let out = false; run(s3, 20, () => { if (!s3.grid.inRange(q.pos)) out = true; });
  assert.equal(out, false);
  ok('村民在邊界停下');
}
// 4. 夜間：半同化回家睡覺、人偶守夜持燈；視線縮短；夜間不得追捕（備用條文）認知到就不追
{
  const s = fresh();
  const half = v(s, 'villager_01'), puppet = v(s, 'villager_02');
  toNight(s);
  run(s, 20);
  assert.equal(half.sleeping, true); assert.equal(s.grid.houseAt(half.pos), 'house_01');
  assert.equal(puppet.sleeping, false); assert.equal(puppet.lit, true);
  ok('夜間：半同化回家睡覺；人偶守夜持燈');
  assert.equal(s.villagers.sight(half), 3); assert.equal(s.villagers.sight(puppet), 6);
  s.outsider.pos = [puppet.pos[0] + 5, puppet.pos[1]];
  assert.equal(s.villagers.canSee(puppet, s.outsider.pos), true);
  s.outsider.pos = [puppet.pos[0] + 7, puppet.pos[1]];
  assert.equal(s.villagers.canSee(puppet, s.outsider.pos), false);
  s.outsider.lit = true; assert.equal(s.villagers.seesOutsider(puppet), true); s.outsider.lit = false;
  ok('夜間視線 3 格，持燈各加 3');
  // 夜間不得追捕
  s.world.write({ key: 'no-night-capture', text: '市民不得在夜間追捕。', who: 'citizen', verb: 'capture', target: { type: 'outsider' }, cond: 'night' }, { silent: true, knownBy: ['villager_02'] });
  assert.equal(s.villagers.mayCapture(puppet), false);
  ok('認知到「夜間不得追捕」的村民夜裡不追');
  // 天亮：醒來
  s.world.t = s.world.opt.daySec + s.world.opt.nightSec - 0.01; s.tick(0.05);
  assert.equal(half.sleeping, false); assert.equal(puppet.lit, false);
  ok('天亮：醒來、熄燈');
}
// 5. 偽裝：穿上衣物後，只管外鄉人的條文要在 2 格內才認得出；任何存在的條文照樣算
{
  const s = fresh(); const p = v(s, 'villager_05');
  s.world.write({ key: 'door-open', text: '外鄉人不得開啟任何門。', who: 'outsider', verb: 'open', target: { type: 'door' } }, { silent: true, knownBy: ['villager_05'] });
  s.outsider.pos = [34, 31]; p.pos = [39, 31]; p.fpos = [...p.pos];   // 門前，村民在 5 格外的路上，看得見
  const c = s.world.objects.get('clothes_03'); s.outsider.pos = [50, 35];
  assert.equal(s.world.attempt('outsider', 'take', c.id).done, true);
  assert.equal(s.world.attempt('outsider', 'wear', c.id).done, true); assert.equal(s.outsider.wearing, 'clothes_03');
  assert.ok(s.world.live('no-disguise'), '第一次穿就被寫成條文');
  s.outsider.pos = [34, 31];
  s.world.attempt('outsider', 'open', 'door_05'); run(s, 0.1);
  assert.ok(!s.villagers.hunts(p), '5 格外認不出外鄉人 → 不追');
  s.world.objects.get('door_05').state = 'closed';
  p.pos = [36, 31]; p.fpos = [...p.pos];   // 2 格
  s.world.attempt('outsider', 'open', 'door_05'); run(s, 0.1);
  assert.ok(s.villagers.hunts(p), '2 格內認得出 → 追');
  ok('偽裝：穿著市民衣物，只管外鄉人的條文要靠近才認得出');
  // 認知到「不得穿著」的村民，認出你就追
  const s2 = fresh(); const q = v(s2, 'villager_05');
  s2.world.write({ key: 'no-disguise', text: '外鄉人不得穿著市民的衣物。', who: 'outsider', verb: 'wear', target: { type: 'clothes' } }, { silent: true, knownBy: ['villager_05'] });
  s2.outsider.pos = [50, 35]; s2.world.attempt('outsider', 'take', 'clothes_03'); s2.world.attempt('outsider', 'wear', 'clothes_03');
  s2.outsider.pos = [34, 31]; q.pos = [39, 31]; q.fpos = [...q.pos]; run(s2, 1);
  assert.ok(!s2.villagers.hunts(q)); q.pos = [35, 31]; q.fpos = [...q.pos]; run(s2, 0.2);
  assert.ok(s2.villagers.hunts(q));
  ok('偽裝：被認出來本身就是「穿著衣物」的持續違規');
}
// 6. 誘導與喚醒（沿用原型二）
{
  const s = fresh(); const p = v(s, 'villager_01');
  s.outsider.pos = [54, 43];
  assert.equal(s.villagers.induce(p, 'invite'), true);
  let invited = null; s.world.on('invited', e => invited = e.house);
  run(s, 15); assert.equal(invited, 'house_01');
  ok('誘導：邀請進屋');
  const s2 = fresh();
  for (const o of s2.world.objects.values()) if (o.type === 'speaker') o.state = 'broken';
  const q = v(s2, 'villager_02'); run(s2, 31); assert.equal(q.level, 'half');
  s2.outsider.pos = [...q.pos];
  s2.world.attempt('outsider', 'take', 'keepsake_02'); s2.world.attempt('outsider', 'give', 'keepsake_02', { to: 'villager_02' });
  assert.equal(q.level, 'awake');
  ok('喚醒：30 秒安靜降一級；收到自己的信物降一級');
}
console.log('villagers.test 全部通過');

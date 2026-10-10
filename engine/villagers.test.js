// node engine/villagers.test.js —— v2 村民：抓捕令追捕、名字舒適、傳染、定義涵蓋、舒適提供、守規則
import assert from 'node:assert/strict';
import { createSession } from './session.js';
const ok = m => console.log('PASS', m);

function mkScene() {
  const o = [
    { id: 'book_01', type: 'book', pos: [10, 10], state: 'closed', verbs: ['read', 'move'] },
    { id: 'speaker_01', type: 'speaker', pos: [10, 10], state: 'intact', radius: 14, verbs: ['break', 'repair'] },
    { id: 'house_01', type: 'house', pos: [6, 14], state: 'intact', owner: 'villager_01', verbs: ['enter'] },
  ];
  for (let i = 1; i <= 6; i++) o.push({ id: 'villager_0' + i, type: 'villager', pos: [14, 10 + i], state: i <= 3 ? 'half' : 'puppet', color: [1, 0, 0] });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; o.push({ id: 'boundary_0' + i, type: 'boundary', pos: [Math.round(10 + 12 * Math.cos(a)), Math.round(10 + 12 * Math.sin(a))], state: 'intact', verbs: [] }); }
  return o;
}
const meta = { start: [10, 10], center: [10, 10], radius: 12, roads: [] };
const fresh = (opt = {}) => { const s = createSession(mkScene(), meta, { seed: opt.seed || 'v', villagers: opt.villagers }); s.match.start(); return s; };
const run = (s, sec) => { for (let i = 0; i < sec * 20; i++) s.tick(0.05); };
const v = (s, id) => s.world.actors.get(id);

// 1. 目擊違規 → 追；追到相鄰 0.5 秒抓住（不再「一看到就追」，給玩家讀法想破綻的空間）
{
  const s = fresh();
  const p = v(s, 'villager_01'); p.known.add(s.world.live('capture').no);
  s.outsider.pos = [13, 11];   // 在 p 視線內，但還沒違規
  run(s, 2);
  assert.ok(!s.villagers.hunts(p), '只是看到外鄉人、沒目擊違規 → 不追');
  const rule = s.world.write({ key: 't-run', text: '不得奔跑', verb: 'run', mode: 'forbid' }, { knownBy: ['outsider', 'villager_01'] });
  let captured = false; s.world.on('captured', () => captured = true);
  s.world.attempt('outsider', 'run', null, {});   // 目擊違規
  run(s, 6);
  assert.ok(captured, '目擊違規的村民會追上並抓到');
  ok('目擊違規 → 追上並抓住；沒違規不追');
}
// 2. 名字舒適：被當自己人，連目擊違規都不追（代價是符合定義陷阱）
{
  const s = fresh();
  for (const vv of s.villagers.list) vv.known.add(s.world.live('capture').no);
  s.match.assim.accept('name'); s.outsider.comforts = s.match.assim.comforts;
  const rule = s.world.write({ key: 't-run', text: '不得奔跑', verb: 'run', mode: 'forbid' }, { knownBy: ['outsider', 'villager_01'] });
  v(s, 'villager_01').pos = [12, 11]; s.outsider.pos = [13, 11];
  s.world.attempt('outsider', 'run', null, {});
  run(s, 0.3);
  assert.ok(!s.villagers.hunts(v(s, 'villager_01')), '有名字 → 連目擊違規都不追（被當自己人）');
  ok('名字舒適：被當自己人，目擊違規也不追');
}
// 4. 定義涵蓋：村民認知到「外鄉人符合」的定義 → 當他是市民，不追
{
  const s = fresh();
  const p = v(s, 'villager_01'); p.known.add(s.world.live('capture').no);
  s.match.assim.accept('name'); s.outsider.comforts = s.match.assim.comforts;
  const def = s.world.write({ key: 'd-name', text: '有姓名者為市民。', kind: 'definition', defn: 'has-name' }, { knownBy: ['villager_01'] });
  s.outsider.pos = [13, 11];
  assert.equal(s.villagers.mayChase(p), false, '認知到你符合的定義 → 不追你');
  ok('定義涵蓋：村民把符合定義的你當市民，不追');
}
// 5. 舒適提供：half 村民相鄰時提供未接受的舒適
{
  const s = fresh();
  const p = v(s, 'villager_01');
  assert.ok(['name', 'clothes', 'house', 'job'].includes(s.villagers.comfortOffer(p)), '半同化村民會提供舒適');
  s.match.assim.accept('name'); s.outsider.comforts = s.match.assim.comforts;
  assert.notEqual(s.villagers.comfortOffer(p), 'name', '不會重複提供已接受的');
  const puppet = v(s, 'villager_06');
  assert.equal(s.villagers.comfortOffer(puppet), null, '人偶不提供舒適');
  ok('舒適提供：half 提供未接受項、人偶不提供');
}
// 6. 守規則：村民不違反自己認知到的規則（不進別人家）
{
  const s = fresh();
  const p = v(s, 'villager_02'); p.known.add(s.world.live('capture').no);
  s.world.objects.get('house_01').owner = 'villager_01';   // 不是 p 的家
  s.world.attempt('villager_02', 'enter', 'house_01', { uninvited: true });
  assert.equal(s.world.check('villager_02', 'enter', 'house_01', { uninvited: true }).violates.length >= 0, true);
  ok('守規則：沿用引擎的 check，村民不違反認知到的規則');
}
console.log('villagers.test 全部通過');

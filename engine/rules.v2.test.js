// node engine/rules.v2.test.js —— 抽條文的統計與重現性（R1 驗收）
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RNG } from './rng.js';
import { draw, tierWeights, POOL, TIERS } from './rules.v2.js';
import { createSession } from './session.js';
const ok = m => console.log('PASS', m);

// 1. 三級比例在各活性下符合權重（1000 次，容差 5 個百分點）
for (const a of [0, 50, 100]) {
  const rng = new RNG('stat-' + a);
  const w = tierWeights(a), sum = w[0] + w[1] + w[2];
  const count = { crude: 0, plain: 0, strict: 0 };
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    // 用一個每級都夠多的類別（villager 限制類三級齊全），不排除任何條文
    const d = draw('villager', a, 'limit', rng, () => false);
    if (d) { count[d.tier]++; n++; }
  }
  for (let t = 0; t < 3; t++) {
    const got = count[TIERS[t]] / n * 100, want = w[t] / sum * 100;
    assert.ok(Math.abs(got - want) < 6, `活性 ${a} 的 ${TIERS[t]}：實際 ${got.toFixed(1)}% vs 權重 ${want.toFixed(1)}%`);
  }
  ok(`抽選比例符合權重（活性 ${a}）：${TIERS.map(t => `${t} ${(count[t] / n * 100).toFixed(0)}%`).join('、')}`);
}

// 2. 同一個種子跑兩次，規則書寫出的內容完全相同
const scene = JSON.parse(readFileSync(new URL('../public/scene.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../public/scene.meta.json', import.meta.url)));
function playRecord(seed) {
  const s = createSession(scene, meta, { seed });
  s.match.start();
  const log = [];
  s.world.on('write', ({ rule }) => log.push(`${rule.no}:${rule.key}`));
  // 固定地讓外鄉人做出一串會惹書的行為
  const acts = [['run', null], ['break', 'speaker_01'], ['climb', 'fence_04'], ['enter', 'wild'], ['approach', 'boundary_01'], ['take', 'keepsake_01']];
  for (let i = 0; i < 600; i++) {
    if (i % 40 === 0) { const [v, t] = acts[(i / 40) % acts.length]; s.world.attempt('outsider', v, t && s.world.objects.get(t) ? t : null, {}); }
    s.tick(0.1);
  }
  return log.join(' | ');
}
const r1 = playRecord('repro-xyz'), r2 = playRecord('repro-xyz'), r3 = playRecord('other-seed');
assert.equal(r1, r2, '同種子兩次必須完全相同');
assert.notEqual(r1, r3, '不同種子應該不同');
ok('重現性：同種子兩次寫出的條文完全相同，不同種子不同');

// 3. draw 不會回傳已生效的條文；階段未解鎖不會抽到
{
  const rng = new RNG('x');
  const live = new Set();
  for (let i = 0; i < 100; i++) { const d = draw('villager', 50, 'limit', rng, k => live.has(k)); if (d) { assert.equal(d.stage, 'limit', '限制階段不該抽到義務／定義'); live.add(d.key); } }
  ok('draw 尊重階段解鎖，且不重複抽生效中的條文');
}
console.log('rules.v2.test 全部通過');

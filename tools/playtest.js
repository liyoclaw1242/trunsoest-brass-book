// node tools/playtest.js [--route keepsake|deaf|all] [--out docs/playtest/m6] [--seed N]
// 自動操作外鄉人跑完一局，輸出事件紀錄、規則書紀錄、關鍵時刻的截圖。
// 路線：
//   keepsake 「躲屋裡、誘導拿信物、把信物還給主人喚醒大家」
//   deaf     「砸廣播器裝聾：新條文我永遠聽不到，村民 30 秒沒廣播就醒」
import { writeFileSync, mkdirSync } from 'node:fs';
import { open } from './pw.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROUTE = arg('--route', 'all'), OUT = arg('--out', 'docs/playtest/m6');
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

async function runRoute(route) {
  const dir = `${OUT}/${route}`; mkdirSync(dir, { recursive: true });
  const pw = await open({ url: 'http://localhost:5173/?autostart' });
  const marks = []; let shotNo = 0;
  const shot = async (name) => { const f = await pw.shot(dir, `${String(++shotNo).padStart(2, '0')}-${name}`); marks.push({ t: (await pw.status()).t, name, file: f }); return f; };
  const st = () => pw.status();
  const opts = () => pw.options();
  const act = async pred => { const o = await opts(); const i = o.findIndex(pred); if (i < 0) return null; return pw.act(i); };
  const over = async () => (await st()).state !== 'playing';
  const log = (...a) => console.log(`[${route}]`, ...a);
  // 一邊等一邊處理「有人到身邊」：可誘導的就誘導（kind），手上有誰的信物就還給誰
  const tend = async (sec, { induceKind = 'fetch', onTick = null, stop = null } = {}) => {
    const end = Date.now() + sec * 1000;
    while (Date.now() < end) {
      const s = await st(); if (s.state !== 'playing') return 'over';
      const o = await opts();
      const give = o.find(x => x.verb === 'give' && s.villagers.some(v => cheb(v.pos, s.cell) <= 1 && x.label.includes(x.target.replace('keepsake_', '')) && x.label.endsWith(`村民 ${x.target.split('_')[1]}`)));
      if (give) { await pw.act(o.indexOf(give)); log(`t=${s.t} 歸還：${give.label}`); await shot('give'); continue; }
      const ind = o.find(x => x.verb === 'induce' && x.ok && x.label.startsWith(induceKind === 'fetch' ? '請他去拿信物' : induceKind === 'book' ? '請他去搬書' : '請他邀請'));
      if (ind) { const v = s.villagers.find(v => v.id === ind.target); if (v && v.hunting && !v.task) { await pw.act(o.indexOf(ind)); log(`t=${s.t} 誘導：${ind.label}`); await shot('induce'); continue; } }
      if (onTick && await onTick(s)) return 'tick';
      if (stop && await stop(s)) return 'stop';
      await pw.wait(0.1);
    }
    return 'timeout';
  };
  const dash = async (cell, label) => { log(`t=${(await st()).t} 衝向 ${label} ${JSON.stringify(cell)}`); const r = await pw.goto(cell); const s = await st(); log(`  → ${r}，在 ${JSON.stringify(s.cell)}，被抓 ${s.stats.captures} 次，同化度 ${s.assim}`); return r; };
  const breakIt = async id => { const r = await act(o => o.verb === 'break' && o.target === id); log(`t=${(await st()).t} 破壞 ${id}：${r ? (r.done ? '成功' : '失敗') : '不在旁邊'}`); return !!r?.done; };
  const noHunters = s => !s.villagers.some(v => v.hunting && v.mode === 'chase') && !s.villagers.some(v => v.level !== 'awake' && !v.task);
  const walkOut = async () => {
    // 走到離現在位置最近的範圍外格子
    const goal = await pw.eval(() => { const g = window.__game.game; const r = g.grid.minCost(g.player.cell, c => !g.grid.inRange(c), () => false, c => !g.grid.blocked(c)); return r ? r.cell : null; });
    if (!goal) return 'nogoal';
    await shot('walk-out');
    return dash(goal, '範圍外');
  };
  const enterHome = async () => {
    // 回到 house_01 內
    const s = await st(); if (s.house === 'house_01') return true;
    await pw.goto([30, 29]); await pw.face([0, 1]);
    const d = await pw.eval(() => window.__game.game.world.objects.get('door_01').state);
    if (d === 'closed') await act(o => o.verb === 'open' && o.target === 'door_01');
    await pw.walk([[0, 1]]); await pw.settle(); await act(o => o.verb === 'enter'); await pw.settle();
    await pw.goto([30, 32]); await pw.settle();
    return (await st()).house === 'house_01';
  };

  // ---- 共同開場：聽完公告、砸掉眼前的廣播器、進屋 ----
  await shot('start');
  while ((await st()).opening > 0) await pw.wait(0.2);
  await breakIt('speaker_01');
  await enterHome(); await shot('hide-in-house');
  log(`t=${(await st()).t} 進屋，在 ${JSON.stringify((await st()).cell)}`);

  if (route === 'keepsake') {
    // 在屋裡等：誰到門口就請他去拿信物；拿到就還給主人（主人到門口時）。四個人都醒了就走出去。
    const r = await tend(240, { induceKind: 'fetch', stop: s => noHunters(s) });
    log(`等待結束：${r}`, JSON.stringify((await st()).villagers.map(v => `${v.id}:${v.level}${v.hunting ? '!' : ''}`)));
    await shot('after-awakening');
    if (!(await over())) await walkOut();
  } else if (route === 'deaf') {
    // 砸廣播器：先請來的人去跑腿，再趁空檔衝出去砸 s6、s2、s3，中間被抓就從中心再來；全砸完回屋裡等村民醒
    const targets = [['speaker_06', [30, 18], [0, -1]], ['speaker_02', [18, 30], [-1, 0]], ['speaker_03', [41, 30], [1, 0]]];
    for (const [id, cell, face] of targets) {
      for (let tryN = 0; tryN < 3 && !(await over()); tryN++) {
        const state = await pw.eval(id => window.__game.game.world.objects.get(id).state, id);
        if (state === 'broken') break;
        await tend(4, { induceKind: 'fetch', stop: s => s.villagers.every(v => !v.hunting || v.task || cheb(v.pos, s.cell) > 6) });
        await dash(cell, id); await pw.face(face);
        if (await breakIt(id)) { await shot(`broke-${id}`); break; }
        const s = await st(); if (s.stats.captures) await pw.wait(0.2);
      }
    }
    await enterHome(); await shot('back-in-house');
    const r = await tend(150, { induceKind: 'fetch', stop: s => noHunters(s) });
    log(`等待結束：${r}`, JSON.stringify((await st()).villagers.map(v => `${v.id}:${v.level}${v.hunting ? '!' : ''}`)));
    await shot('after-awakening');
    if (!(await over())) await walkOut();
  }
  await pw.wait(0.5);
  const final = await st(), m = await pw.eval(() => window.__game.match());
  await shot('end');
  const events = await pw.log(), rules = await pw.eval(() => window.__game.designerRules());
  writeFileSync(`${dir}/events.json`, JSON.stringify(events, null, 1));
  writeFileSync(`${dir}/rules.json`, JSON.stringify(rules, null, 1));
  writeFileSync(`${dir}/events.txt`, events.map(e => `[${e.t.toFixed(1)}s] ${e.type}\t${e.text}`).join('\n'));
  writeFileSync(`${dir}/rulebook.txt`, rules.map(r => `第${r.no}條${r.void ? '（已撕掉）' : r.dead ? '（廢文）' : ''}\t${r.text}\t認知：${r.knownBy.join(',') || '無'}${r.hole ? `\t漏洞：${r.hole}` : ''}`).join('\n'));
  writeFileSync(`${dir}/summary.json`, JSON.stringify({ route, state: m.state, reason: m.reason, stats: m.stats, assim: m.assim, villagers: final.villagers, marks }, null, 1));
  log(`結果：${m.state}/${m.reason}  ${JSON.stringify(m.stats)}`);
  await pw.close();
  return m;
}

const routes = ROUTE === 'all' ? ['keepsake', 'deaf'] : [ROUTE];
const results = {};
for (const r of routes) results[r] = await runRoute(r);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, `${v.state}/${v.reason} ${v.stats.time}s`]))));
process.exit(Object.values(results).every(r => r.state === 'won') ? 0 : 1);

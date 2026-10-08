// node tools/playtest.js [--route keepsake|deaf|all] [--out docs/playtest/m6] [--seed N]
// 自動操作外鄉人跑完一局，輸出事件紀錄、規則書紀錄、關鍵時刻的截圖。
// 路線：
//   keepsake 「躲屋裡、誘導拿信物、把信物還給主人喚醒大家」
//   book     「誘導村民搬書：請書台屋主把書搬回他家，範圍圓心一移，藏身處就在範圍外」
//   deaf     「砸廣播器裝聾：新條文我永遠聽不到，村民 30 秒沒廣播就醒」（第 1 輪加了誘導冷卻後，這條目前衝不出去，保留當資料）
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
  const tend = async (sec, { induceKind = 'fetch', onTick = null, stop = null, only = null, noGive = false } = {}) => {
    const end = Date.now() + sec * 1000;
    while (Date.now() < end) {
      const s = await st(); if (s.state !== 'playing') return 'over';
      const o = await opts();
      const give = noGive ? null : o.find(x => x.verb === 'give' && x.label.includes('他的信物'));
      if (give) { await pw.act(o.indexOf(give)); log(`t=${s.t} 歸還：${give.label}`); await shot('give'); continue; }
      const prefix = { fetch: '請他去拿信物', book: '請他去搬書', invite: '請他邀請' };
      const order = induceKind === 'book' ? ['book', 'invite'] : [induceKind, 'invite', 'book', 'fetch'];
      const ind = order.map(k => o.find(x => x.verb === 'induce' && x.ok && x.label.startsWith(prefix[k]) && (!only || k !== induceKind || x.target === only))).find(Boolean);
      if (ind) {
        const v = s.villagers.find(v => v.id === ind.target);
        // 已喚醒的村民不追人但很好用（條文的漏洞）；其他人只在他正要抓我、又沒在忙時才支開
        if (v && !v.task && (v.hunting || (v.level === 'awake' && induceKind === 'fetch' && ind.label.startsWith('請他去拿信物')))) {
          const r = await pw.act(o.indexOf(ind));
          if (r && r.done) { log(`t=${s.t} 誘導：${ind.label}`); await shot('induce'); } else { log(`t=${s.t} 誘導被拒：${ind.label}`); await pw.wait(1); }
          continue;
        }
      }
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
  const HOME = { house: 'house_04', door: 'door_04', front: [30, 43], inside: [30, 45] };   // 屋主村民 04 已喚醒，不會進來抓人
  const enterHome = async () => {
    // 回到藏身的住宅內（被抓就從中心再試，最多 4 次）
    for (let i = 0; i < 4; i++) {
      const s = await st(); if (s.state !== 'playing') return false; if (s.house === HOME.house) { await pw.goto(HOME.inside); await pw.settle(); return true; }
      await pw.goto(HOME.front); await pw.face([0, 1]);
      const d = await pw.eval(id => window.__game.game.world.objects.get(id).state, HOME.door);
      if (d === 'closed') await act(o => o.verb === 'open' && o.target === HOME.door);
      await pw.walk([[0, 1]]); await pw.settle(); await act(o => o.verb === 'enter'); await pw.settle();
    }
    return (await st()).house === HOME.house;
  };

  // ---- 共同開場：聽完公告、砸掉眼前的廣播器、進屋 ----
  await shot('start');
  while ((await st()).opening > 0) await pw.wait(0.2);
  await breakIt('speaker_01');
  // 立刻躲進書台屋避開 8 秒加速（門就在眼前）；站在門洞斜對角，屋主一到門口就隔著門把他支開；等追捕者離門口遠一點再轉移到已喚醒村民 04 的家
  {
    await pw.goto([30, 29]); await pw.face([0, 1]);
    if ((await pw.eval(() => window.__game.game.world.objects.get('door_01').state)) === 'closed') await act(o => o.verb === 'open' && o.target === 'door_01');
    await pw.walk([[0, 1]]); await pw.settle(); await act(o => o.verb === 'enter'); await pw.settle(); await pw.goto([29, 31]); await pw.settle();
    await shot('first-shelter');
    await tend(16, { induceKind: 'fetch', stop: s => s.t >= 13 && s.villagers.every(v => !v.hunting || v.task || cheb(v.pos, [30, 30]) >= 5) });
  }
  await enterHome(); await shot('hide-in-house');
  log(`t=${(await st()).t} 進屋，在 ${JSON.stringify((await st()).cell)}`);

  if (route === 'keepsake') {
    // 在屋裡等：誰到門口就請他去拿信物；拿到就還給主人（主人到門口時）。沒有人在追（醒了或正在跑腿）就走出去。
    const r = await tend(300, { induceKind: 'fetch', stop: s => noHunters(s) });
    log(`等待結束：${r}`, JSON.stringify((await st()).villagers.map(v => `${v.id}:${v.level}${v.hunting ? '!' : ''}`)));
    await shot('after-awakening');
    if (!(await over())) await walkOut();
  } else if (route === 'book') {
    // 憲法裡有「黃銅書不得被搬動」，屋主會拒絕；等第一次重置撕掉它。期間其他人到門口就用「邀請」支開（邀請不算跑腿）。
    // 重置後住宅不再安全，被抓就被抓（送回中心、3 秒免疫），屋主一到身邊就請他搬書。書一搬走，看我在不在範圍外。
    // 第一次重置前躲在屋裡；重置一到（住宅不再安全）就走到廣場，讓屋主來找我，被抓就當作回到中心
    let r = await tend(200, { induceKind: 'book', only: 'villager_01', noGive: true, stop: s => !s.inRange || s.state !== 'playing' || s.resets >= 1 });
    if (r === 'stop' && !(await over()) && (await st()).inRange) {
      await pw.goto([30, 27]);
      const book0 = JSON.stringify((await pw.objects()).find(o => o.id === 'book_01').pos);
      r = await tend(120, { induceKind: 'book', only: 'villager_01', noGive: true, stop: async s => !s.inRange || s.state !== 'playing' || JSON.stringify((await pw.objects()).find(o => o.id === 'book_01').pos) !== book0 });
    }
    log(`等待結束：${r}`, JSON.stringify((await st()).villagers.map(v => `${v.id}:${v.level}${v.hunting ? '!' : ''}${v.task ? '(' + v.task + ')' : ''}`)));
    await shot('after-book-moved');
    if (!(await over())) await walkOut();
  } else if (route === 'deaf') {
    // 砸廣播器：先請來的人去跑腿，再趁空檔衝出去砸 s6、s2、s3，中間被抓就從中心再來；全砸完回屋裡等村民醒
    // 廣播器的位置從 scene.json 讀，站到它南邊一格、面向北
    const spk = await pw.eval(() => Object.fromEntries(window.__game.scene.filter(o => o.type === 'speaker').map(o => [o.id, o.pos])));
    // 只砸蓋住藏身處門口的兩台：門口一安靜，在門口等我的追捕者 30 秒就醒
    const targets = ['speaker_04', 'speaker_05'].map(id => [id, [spk[id][0], spk[id][1] - 1], [0, 1]]);
    // 先等剛聽到抓捕令的加速（8 秒）過去
    await tend(9, { induceKind: 'fetch' });
    for (const [id, cell, face] of targets) {
      for (let tryN = 0; tryN < 3 && !(await over()); tryN++) {
        const state = await pw.eval(id => window.__game.game.world.objects.get(id).state, id);
        if (state === 'broken') break;
        // 追捕者都在跑腿／回家／離我 8 格以上才衝；最多等 20 秒
        await tend(20, { induceKind: 'invite', stop: s => s.villagers.every(v => !v.hunting || v.task || v.mode === 'return' || cheb(v.pos, s.cell) >= 8) });
        const capBefore = (await st()).stats.captures;
        await dash(cell, id); await pw.face(face);
        if (await breakIt(id)) { await shot(`broke-${id}`); break; }
        if ((await st()).stats.captures > capBefore) { await enterHome(); }   // 被抓了：先回屋裡喘口氣
      }
    }
    await enterHome(); await shot('back-in-house');
    const r = await tend(150, { induceKind: 'invite', stop: s => noHunters(s) });
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

const routes = ROUTE === 'all' ? ['keepsake', 'book', 'deaf'] : [ROUTE];
const results = {};
for (const r of routes) results[r] = await runRoute(r);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, `${v.state}/${v.reason} ${v.stats.time}s`]))));
process.exit(['keepsake', 'book'].every(k => !results[k] || results[k].state === 'won') ? 0 : 1);

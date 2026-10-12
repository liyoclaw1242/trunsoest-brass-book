// node tools/analyze.js [關卡名片段] —— 地圖分析核心。對每關報告：
//   可解？最短巨觀步數、探索狀態數；規則必要性（逐條移除靜態法重解）；靜態 lint。
//   用 tools/solver.js 的巨觀求解器，小關與大地圖都跑得動（village 約 1 秒）。
// 規則必要性判讀：移除後「無解」＝必要；「更快」＝確實擋了你、有用；「步數不變」＝可能冗餘/安全網/等價繞法，建議人工確認。
import { solveMacro, analyzeSoftlock, challengeMetrics } from './solver.js';
import { LEVELS } from '../src/puzzle/levels.js';
// 兩條法是否「互動」：共用主詞/動詞，或一條的定義目標正是另一條管的主詞（會組合或衝突）。
function lawsInteract(a, b) {
  if (a.who && a.who === b.who) return true;
  if (a.verb && a.verb === b.verb) return true;
  if (a.toNoun && (a.toNoun === b.who)) return true;
  if (b.toNoun && (b.toNoun === a.who)) return true;
  return false;
}

const SUBJ = new Set(['外鄉人', '市民', '任何人', '山羊', '物', '樹木', '生物', '圍牆']);
const MODAL = new Set(['不得', '得', '即']);
const VERB = new Set(['離開', '進入', '搬書', '推', '吃', '砍伐', '持有', '兩格', '破壞']);

function lint(lv) {
  const warns = [];
  const ws = new Set(lv.map.map(r => r.length));
  if (ws.size !== 1) warns.push('地圖寬度不一致 ' + [...ws].join('/'));
  if (!lv.map.some(r => r.includes('@'))) warns.push('沒有起點 @');
  if (lv.goal === 'leave' && !lv.map.some(r => r.includes('E'))) warns.push('leave 關卻無出口 E');
  for (const t of (lv.tiles || [])) if (!SUBJ.has(t.word) && !MODAL.has(t.word) && !VERB.has(t.word)) warns.push('未知字塊「' + t.word + '」');
  return warns;
}
function analyze(lv) {
  const warns = lint(lv);
  const base = solveMacro(lv);
  const lines = [`【${lv.name}】${base.ok ? 'PASS 可解' : 'FAIL 找不到解'}  最短 ${base.steps} 巨觀步  探索 ${base.states} 狀態${base.capped ? '（CAPPED，不完備）' : ''}`];
  const loadBearing = [];
  if (base.ok && (lv.laws || []).length) {
    for (let i = 0; i < lv.laws.length; i++) {
      const law = lv.laws[i]; if (law.note) continue;
      const clone = JSON.parse(JSON.stringify(lv)); clone.laws.splice(i, 1);
      const r = solveMacro(clone, { cap: 40000 });
      const tag = r.capped ? '必要（移除後求解超出上限、找不到解——極可能必要）'
        : !r.ok ? '必要（移除即無解）'
        : r.steps < base.steps ? `有用（移除後 ${r.steps} 步、變簡單——它確實擋了你）`
        : `⚠ 步數不變（可能冗餘／安全網／等價繞法，建議人工確認）`;
      if (!r.ok || r.steps < base.steps) loadBearing.push(law);
      lines.push(`  · 法「${law.text || JSON.stringify(law)}」：${tag}`);
    }
  }
  // 挑戰度：沿多個軸量，別只看「密度」。密度（規則分支）看不見「空間／推箱路線」與「有多容易把自己玩死」，
  // 這正是「分析器放行、玩起來卻簡單」的盲點。故一併報：
  //   解長（巨觀步）、探索狀態（求解搜尋空間≈「要想多久才找得到路」）、密度與互動法對（規則分支）、soft-lock 陷阱數（乙案下＝必須有遠見）。
  if (base.ok) {
    const cm = challengeMetrics(lv);
    const sl = analyzeSoftlock(lv);
    const traps = (sl.traps && sl.traps.length) || 0;
    let pairs = 0;
    for (let i = 0; i < loadBearing.length; i++) for (let j = i + 1; j < loadBearing.length; j++) if (lawsInteract(loadBearing[i], loadBearing[j])) pairs++;
    // 偏淺：各軸皆低才算——規則不互動、密度近線性、解又短、搜尋空間小、且沒有能把自己玩死的陷阱。
    const shallow = cm.avgOpts < 1.6 && pairs === 0 && cm.L <= 6 && base.states < 1200 && traps === 0;
    lines.push(`  · 挑戰度：解長 ${cm.L} 步、探索 ${base.states} 狀態、密度 ${cm.avgOpts}（1≈線性）、最深 ${cm.maxOpts}、互動法對 ${pairs}、soft-lock 陷阱 ${traps}${shallow ? '　⚠ 偏淺（規則不互動、解短、搜尋空間小、無自困風險）' : ''}`);
    if (traps)
      lines.push(`  · ⚠ soft-lock：可把 ${sl.traps.join('、')} 推進洞穴/火/河而卡死（經可達性精算確認）——乙案下為刻意張力，須在執行面可見且易撤銷`);
    else lines.push('  · soft-lock：無（' + (sl.hasDestroyer ? '雖有摧毀地形，但沒有可被推去卡死的必要資源' : '場上無摧毀地形') + '）');
  }
  if (warns.length) lines.push('  · ⚠ lint：' + warns.join('；'));
  return { ok: base.ok, text: lines.join('\n') };
}

const filter = process.argv[2];
let allok = true;
for (const lv of LEVELS) {
  if (filter && !lv.name.includes(filter)) continue;
  const r = analyze(lv);
  console.log(r.text);
  if (!r.ok) allok = false;
}
process.exit(allok ? 0 : 1);

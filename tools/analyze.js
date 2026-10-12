// node tools/analyze.js [關卡名片段] —— 地圖分析核心。對每關報告：
//   可解？最短巨觀步數、探索狀態數；規則必要性（逐條移除靜態法重解）；靜態 lint。
//   用 tools/solver.js 的巨觀求解器，小關與大地圖都跑得動（village 約 1 秒）。
// 規則必要性判讀：移除後「無解」＝必要；「更快」＝確實擋了你、有用；「步數不變」＝可能冗餘/安全網/等價繞法，建議人工確認。
import { solveMacro, analyzeSoftlock } from './solver.js';
import { LEVELS } from '../src/puzzle/levels.js';

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
  if (base.ok && (lv.laws || []).length) {
    for (let i = 0; i < lv.laws.length; i++) {
      const law = lv.laws[i]; if (law.note) continue;
      const clone = JSON.parse(JSON.stringify(lv)); clone.laws.splice(i, 1);
      const r = solveMacro(clone);
      const tag = !r.ok ? '必要（移除即無解）'
        : r.steps < base.steps ? `有用（移除後 ${r.steps} 步、變簡單——它確實擋了你）`
        : `⚠ 步數不變（可能冗餘／安全網／等價繞法，建議人工確認）`;
      lines.push(`  · 法「${law.text || JSON.stringify(law)}」：${tag}`);
    }
  }
  if (base.ok) {
    const sl = analyzeSoftlock(lv);
    if (sl.traps && sl.traps.length)
      lines.push(`  · ⚠ soft-lock：可把 ${sl.traps.join('、')} 推進洞穴/火/河而卡死（經可達性精算確認）——建議擋住或給備品`);
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

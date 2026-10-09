// node tools/validate-rules.js —— 條文池機械檢查（v2）：key 不重複、動詞在 VERBS、target 指得到已知類型／區／標籤、
// 每條有 hole（定義類與純敘事除外）、每一限制類三個等級都有、定義類有 defn。掛進 npm test。
import { VERBS } from '../engine/rulebook-engine.js';
import { POOL, CONSTITUTION, CAPTURE, TIERS } from '../engine/rules.v2.js';

// v2 的物件類型目錄（R2 的 scene 會實際產生這些；抽象目標如 name/fire 無實體但條文指得到）
const TYPES = new Set(['book', 'lectern', 'speaker', 'notice', 'house', 'door', 'fence', 'cart', 'keepsake', 'boundary', 'villager', 'outsider',
  'lamppost', 'clothes', 'lamp', 'library', 'workstation', 'goat', 'rope', 'meteor', 'census', 'bell', 'carved-stone', 'well', 'fire', 'earplug', 'name']);
const ZONES = new Set(['plaza', 'road', 'wild']);
const TAGS = new Set(['building', 'roofed']);

const errors = [], warn = [];
const all = [...POOL];
const keys = new Set();
for (const d of all) {
  if (keys.has(d.key)) errors.push(`key 重複：${d.key}`); keys.add(d.key);
  if (d.kind === 'definition') { if (!d.defn) errors.push(`${d.key}: 定義類缺 defn`); continue; }
  if (d.kind === 'lore') continue;
  if (!d.verb && d.mode !== 'require') warn.push(`${d.key}: 沒有 verb（純敘事？）`);
  if (d.verb && !VERBS.includes(d.verb)) errors.push(`${d.key}: 動詞 ${d.verb} 不在 VERBS`);
  if (d.target) {
    if (d.target.type && !TYPES.has(d.target.type)) errors.push(`${d.key}: target.type ${d.target.type} 不是已知類型`);
    if (d.target.zone && !ZONES.has(d.target.zone)) errors.push(`${d.key}: target.zone ${d.target.zone} 不是已知區`);
    if (d.target.tag && !TAGS.has(d.target.tag)) errors.push(`${d.key}: target.tag ${d.target.tag} 不是已知標籤`);
  }
  if (!d.hole) errors.push(`${d.key}: 缺 hole`);
  if (!['crude', 'plain', 'strict'].includes(d.tier)) errors.push(`${d.key}: tier 不合法 ${d.tier}`);
  if (d.text && [...d.text].length > 30) warn.push(`${d.key}: 條文偏長（${[...d.text].length} 字）`);
}
// 每一限制類三個等級都有
const cats = ['action', 'hide', 'asset', 'selfprotect', 'villager'];
for (const c of cats) for (const t of TIERS) {
  if (!POOL.some(d => d.category === c && d.stage === 'limit' && d.tier === t)) errors.push(`限制類 ${c} 缺 ${t} 等級`);
}
// 義務與定義也要有候選
if (!POOL.some(d => d.stage === 'obligation')) errors.push('沒有義務類條文');
if (!POOL.some(d => d.stage === 'definition')) errors.push('沒有定義類條文');
// 每項舒適至少一條定義類
for (const [defn, label] of [['has-name', '名字'], ['wears', '衣服'], ['has-house', '房子'], ['worked', '工作']]) {
  if (!POOL.some(d => d.kind === 'definition' && (d.defn === defn || d.defn === 'any-comfort'))) errors.push(`舒適「${label}」沒有對應的定義類條文`);
}

for (const w of warn) console.log('WARN', w);
for (const e of errors) console.log('FAIL', e);
console.log(errors.length ? `條文驗證失敗：${errors.length} 項` : `條文驗證通過：${all.length} 條候選、${CONSTITUTION.length} 條憲法、${CAPTURE.length} 級抓捕令`);
process.exit(errors.length ? 1 : 0);

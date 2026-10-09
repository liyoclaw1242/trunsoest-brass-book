// node tools/validate-scene.js [public/scene.json] —— 檢查 scene.json 的欄位、id、動詞、owner/parent，
// 並與 village.glb 的節點對照：每個 id 都有同名節點、每個 __col 的佔地和 engine/grid.js 的算法一致。
import { readFileSync, existsSync } from 'node:fs';
import { VERBS } from '../engine/rulebook-engine.js';
import { Grid, houseCells } from '../engine/grid.js';

const file = process.argv[2] || 'public/scene.json';
const scene = JSON.parse(readFileSync(file, 'utf8'));
const errors = [], warn = [];
const ids = new Set();
const TYPES = ['book', 'lectern', 'speaker', 'notice', 'house', 'door', 'fence', 'boundary', 'villager', 'outsider', 'lamppost', 'clothes', 'lamp', 'wild', 'library', 'workstation', 'goat', 'rope', 'census', 'carved-stone', 'well', 'field', 'granary', 'shop', 'post', 'cart'];
const ZONE = new Set(['wild']);
for (const o of scene) {
  for (const k of ['id', 'type', 'state', 'verbs']) if (!(k in o)) errors.push(`${o.id || '?'}: 缺 ${k}`);
  if (ids.has(o.id)) errors.push(`id 重複：${o.id}`); ids.add(o.id);
  if (!TYPES.includes(o.type)) errors.push(`${o.id}: 不認得的 type ${o.type}`);
  for (const v of o.verbs || []) if (!VERBS.includes(v)) errors.push(`${o.id}: 動詞 ${v} 不在 VERBS`);
  if (!ZONE.has(o.type) && (!Array.isArray(o.pos) || o.pos.length !== 2 || !o.pos.every(Number.isInteger))) errors.push(`${o.id}: pos 要是整數格子座標`);
}
for (const o of scene) {
  if (o.owner && !ids.has(o.owner)) errors.push(`${o.id}: owner ${o.owner} 不存在`);
  if (o.parent && !ids.has(o.parent)) errors.push(`${o.id}: parent ${o.parent} 不存在`);
  if (o.type === 'door') {
    const h = scene.find(x => x.id === o.parent);
    if (h && (h.pos[0] !== o.pos[0] || h.pos[1] - 2 !== o.pos[1])) errors.push(`${o.id}: 不在 ${o.parent} 的門洞 (${h.pos[0]}, ${h.pos[1] - 2})`);
  }
}
// 重疊檢查：會擋路的物件不該兩個疊在同一格（門與住宅例外——門本來就在住宅門洞）
const BLOCKERS = new Set(['lectern', 'speaker', 'notice', 'boundary', 'lamppost', 'fence', 'workstation', 'well', 'census', 'carved-stone', 'granary', 'shop', 'post']);
const atCell = new Map();
for (const o of scene) { if (!o.pos || !BLOCKERS.has(o.type)) continue; const k = o.pos.join(','); (atCell.get(k) || atCell.set(k, []).get(k)).push(o.id); }
for (const [k, ids] of atCell) if (ids.length > 1) errors.push(`格子 (${k}) 有多個擋路物件重疊：${ids.join('、')}`);
for (const o of scene) { if (o.type !== 'door' || !o.pos) continue; const k = o.pos.join(','); if (atCell.has(k)) errors.push(`門 ${o.id} 和擋路物件 ${atCell.get(k).join('、')} 同格`); }
const count = t => scene.filter(o => o.type === t).length;
const expect = { book: [1, 1], lectern: [1, 1], speaker: [4, 10], notice: [2, 4], house: [4, 8], fence: [6, 30], boundary: [8, 20], villager: [6, 12], outsider: [1, 1] };
for (const [t, [lo, hi]] of Object.entries(expect)) { const n = count(t); if (n < lo || n > hi) errors.push(`${t} 數量 ${n}，規格是 ${lo}–${hi}`); }
if (count('door') !== count('house')) errors.push('門的數量要等於住宅數量');
for (const h of scene.filter(o => o.type === 'house')) if (!h.owner) errors.push(`${h.id}: 住宅要有 owner`);

// 與 glb 對照
const glbPath = file.replace(/scene\.json$/, 'village.glb');
if (existsSync(glbPath)) {
  const buf = readFileSync(glbPath);
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const names = new Set(json.nodes.map(n => n.name));
  for (const o of scene) {
    if (ZONE.has(o.type)) continue;
    if (!names.has(o.id)) errors.push(`${o.id}: glb 沒有同名節點`);
    if (o.type !== 'villager' && o.type !== 'outsider' && o.type !== 'book' && o.type !== 'lectern' && !names.has(`${o.id}__${o.state}`)) errors.push(`${o.id}: glb 沒有 ${o.id}__${o.state}`);
  }
  // __col 佔地 vs grid.js
  const byName = new Map(json.nodes.map(n => [n.name, n]));
  const parentOf = new Map();
  for (const n of json.nodes) for (const c of n.children || []) parentOf.set(json.nodes[c].name, n);
  const grid = new Grid(scene);
  const colCells = new Set();
  for (const n of json.nodes) {
    if (!/__col/.test(n.name)) continue;
    const p = parentOf.get(n.name), [px, , pz] = p.translation || [0, 0, 0];
    const [tx, , tz] = n.translation || [0, 0, 0], [sx, , sz] = n.scale || [1, 1, 1];
    // glTF Y-up：Blender (x, y, z) → glTF (x, z, -y)，所以格子 y = -gltfZ
    const x0 = px + tx - sx / 2, x1 = px + tx + sx / 2, y0 = -(pz + tz) - sz / 2, y1 = -(pz + tz) + sz / 2;
    for (let x = Math.round(x0 + 0.5); x <= Math.round(x1 - 0.5); x++) for (let y = Math.round(y0 + 0.5); y <= Math.round(y1 - 0.5); y++) colCells.add(`${x},${y}`);
  }
  let mismatch = 0;
  for (let x = grid.min[0]; x <= grid.max[0]; x++) for (let y = grid.min[1]; y <= grid.max[1]; y++) {
    const g = grid.blocked([x, y]), c = colCells.has(`${x},${y}`);
    if (g !== c) { mismatch++; if (mismatch <= 8) warn.push(`(${x},${y}) grid.js ${g ? '擋' : '不擋'}、__col ${c ? '擋' : '不擋'}`); }
  }
  if (mismatch) errors.push(`__col 與 grid.js 有 ${mismatch} 格不一致`);
  else console.log(`__col 佔地與 engine/grid.js 一致（${colCells.size} 格）`);
} else warn.push(`找不到 ${glbPath}，略過 glb 對照`);

for (const w of warn) console.log('WARN', w);
for (const e of errors) console.log('FAIL', e);
console.log(errors.length ? `驗證失敗：${errors.length} 項` : `驗證通過：${scene.length} 個物件`);
process.exit(errors.length ? 1 : 0);

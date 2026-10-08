// main.js —— 啟動：讀 scene.json、建 Game、載 glb、主迴圈。把 window.__game 露出來給試玩腳本用。
import { Game, name, STATE, INDUCE } from './game.js';
import { View, toWorld } from './view.js';
import { Hud } from './hud.js';
import { Input } from './input.js';

const [scene, meta] = await Promise.all([fetch('/scene.json').then(r => r.json()), fetch('/scene.meta.json').then(r => r.json())]);
const game = new Game(scene, meta);
const view = await new View(document.getElementById('gl')).load('/village.glb');
const hud = new Hud(game);
const input = new Input();

// 用 scene.json 的位置對照 glb 節點位置，確認座標對應（M0 風險 6）
const mismatches = [];
for (const o of scene) {
  const n = view.nodes.get(o.id); if (!n) { mismatches.push(`${o.id}: 無節點`); continue; }
  const w = toWorld(o.pos);
  if (n.position.distanceTo(w) > 0.01) mismatches.push(`${o.id}: glb (${n.position.x.toFixed(1)}, ${n.position.z.toFixed(1)}) vs scene (${w.x}, ${w.z})`);
}
console.log(mismatches.length ? ['座標對應不一致', ...mismatches].join('\n') : `座標對應一致：${scene.length} 個物件`);

// 初始狀態
for (const o of game.world.objects.values()) view.setState(o.id, o.state);
for (const v of game.villagers) view.setState(v.id, v.level);
view.setState('outsider', 'intact');

game.world.on('level', ({ actor, to }) => view.setState(actor.id, to));
game.on(e => { if (e.type === 'captured') hud.toast(e.text, '', 3); else if (e.type === 'level') hud.toast(e.text, 'info', 3); });
game.world.on('object', ({ object: o }) => {
  view.setState(o.id, o.state);
  if (o.heldBy) view.setVisible(o.id, false); else if (o.pos) { view.setVisible(o.id, true); view.setPos(o.id, o.pos, o.type === 'book' && game.player.carrying === o.id ? 1.4 : 0); }
});
game.on(e => { if (e.type === 'violation') hud.toast(e.text, '', 2.5); else if (e.type === 'refuse' || e.type === 'conflict') hud.toast(e.text, 'info', 2.5); else if (e.type === 'blocked') hud.toast(e.text, 'info', 1.5); });

function drawMarkers() {
  const p = game.player, w = game.world;
  view.clearMarkers();
  // 影響範圍
  view.circle(game.grid.center(), game.grid.radius, 0xffffff, 0.5, 0.06, true);
  // 完好廣播器的範圍圈；玩家在裡面的那圈填色
  for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') {
    const inside = Math.hypot(o.pos[0] - p.cell[0], o.pos[1] - p.cell[1]) <= (o.radius ?? 8);
    view.circle(o.pos, o.radius ?? 8, inside ? 0xff5544 : 0xcc8877, inside ? 0.9 : 0.45);
    if (inside) view.disc(o.pos, o.radius ?? 8, 0xff5544, 0.08);
  }
  // 最近的安靜格
  const q = game.quietCell(); if (q && q.steps) view.cellBox(q.cell, 0x88ddff, 0.5);
  // 受規則保護：玩家認知到的畫金色；設計者視角再畫客觀的（青色）
  const mine = new Set(game.protectedIds('outsider'));
  for (const id of mine) view.outline(id, 0xffcc33);
  if (hud.designer) for (const id of game.protectedIds(null)) if (!mine.has(id)) view.outline(id, 0x33ddff, 1.3, 2.4);
  // 村民：追你的畫紅色菱形，可誘導的畫綠色小點
  for (const v of game.villagers) {
    if (game.vil.hunts(v) && v.mode === 'chase') view.tag(v.fpos, 0xff2222, 2.6, 0.3);
    else if (v.task) view.tag(v.fpos, 0x44aaff, 2.6, 0.22);
  }
  // 廣播中的廣播器頭上標記
  const bc = game.broadcast();
  if (bc) for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') view.tag(o.pos, 0xff4444, 3.4, 0.25);
}

let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; frames++;
  for (const code of input.take()) {
    if (code === 'KeyE') game.act(0);
    else if (code === 'Tab') hud.toggleDesigner();
    else if (code === 'KeyN') hud.el.notes.classList.toggle('collapsed');
    else if (/^Digit[2-9]$/.test(code)) game.act(+code.slice(5) - 1);
  }
  const d = input.dir(); if (d) game.tryStep(d);
  game.tick(dt);
  const p = game.player;
  view.setPos('outsider', p.pos);
  if (p.carrying) view.setPos(p.carrying, p.pos, 1.4);
  for (const v of game.villagers) { view.setPos(v.id, v.fpos); if (v.carrying) view.setPos(v.carrying, v.fpos, 1.4); }
  for (const h of view.roofs.keys()) view.setRoof(h, p.house !== h);
  drawMarkers();
  view.lookAtCell(p.pos, frames === 1);
  hud.update(dt);
  hud.labels(game.villagers.map(v => ({ id: v.id, xy: view.project(v.fpos, 2.3), text: `${STATE[v.level]}${game.vil.hunts(v) && v.mode === 'chase' ? '・追你！' : v.task ? '・' + INDUCE[v.task.kind].slice(1) : ''}`, cls: v.level + (game.vil.hunts(v) && v.mode === 'chase' ? ' chase' : '') })));
  view.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__game = {
  game, view, hud, input, scene, meta, mismatches,
  status: () => game.status(),
  options: () => game.options().map(o => ({ verb: o.verb, target: o.target, label: o.label, ok: o.ok, violates: o.violates })),
  act: i => game.act(i),
  step: dir => game.tryStep(dir),
  place: cell => game.place(cell),
  face: dir => { game.player.facing = dir; },
  log: () => game.log,
  notes: () => game.world.notes('outsider'),
  rules: () => game.world.rules.map(r => ({ no: r.no, key: r.key, text: r.text, void: r.void, dead: r.dead, hole: r.hole })),
  objects: () => [...game.world.objects.values()].map(o => ({ id: o.id, type: o.type, state: o.state, pos: o.pos, heldBy: o.heldBy })),
  frames: () => frames,
  broadcast: () => game.broadcast(),
  quiet: () => game.quietCell(),
  protectedIds: a => game.protectedIds(a),
  designer: on => { if (hud.designer !== on) hud.toggleDesigner(); },
  invite: h => { game.invitedTo = h; },
  induce: (id, kind) => game.vil.induce(game.world.actors.get(id), kind),
  villager: id => { const v = game.world.actors.get(id); return { pos: v.pos, level: v.level, mode: v.mode, task: v.task }; },
  designerRules: () => game.designerRules(),
};

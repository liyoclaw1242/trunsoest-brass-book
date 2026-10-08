// main.js —— 啟動：讀 scene.json、建 Game、載 glb、主迴圈。把 window.__game 露出來給試玩腳本用。
import { Game, name } from './game.js';
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

game.world.on('object', ({ object: o }) => {
  view.setState(o.id, o.state);
  if (o.heldBy) view.setVisible(o.id, false); else if (o.pos) { view.setVisible(o.id, true); view.setPos(o.id, o.pos, o.type === 'book' && game.player.carrying === o.id ? 1.4 : 0); }
});
game.on(e => { if (e.type === 'violation') hud.toast(e.text, '', 2.5); else if (e.type === 'refuse' || e.type === 'conflict') hud.toast(e.text, 'info', 2.5); else if (e.type === 'blocked') hud.toast(e.text, 'info', 1.5); });

let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; frames++;
  for (const code of input.take()) {
    if (code === 'KeyE') game.act(0);
    else if (/^Digit[2-9]$/.test(code)) game.act(+code.slice(5) - 1);
  }
  const d = input.dir(); if (d) game.tryStep(d);
  game.tick(dt);
  const p = game.player;
  view.setPos('outsider', p.pos);
  if (p.carrying) view.setPos(p.carrying, p.pos, 1.4);
  for (const h of view.roofs.keys()) view.setRoof(h, p.house !== h);
  view.lookAtCell(p.pos, frames === 1);
  hud.update(dt);
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
};

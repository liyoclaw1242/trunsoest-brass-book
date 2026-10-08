// main.js —— 啟動（原型三）：讀 scene.json、建 Game、載 glb、主迴圈、晝夜光照、標記。window.__game 給試玩腳本。
import * as THREE from 'three';
import { Game, name, STATE, INDUCE } from './game.js';
import { View, toWorld } from './view.js';
import { Hud } from './hud.js';
import { Input } from './input.js';

const [scene, meta] = await Promise.all([fetch('/scene.json').then(r => r.json()), fetch('/scene.meta.json').then(r => r.json())]);
const params = new URLSearchParams(location.search);
const worldOpt = {};
if (params.has('day')) worldOpt.daySec = +params.get('day');
if (params.has('night')) worldOpt.nightSec = +params.get('night');
const game = new Game(scene, meta, { villagers: { hunt: !params.has('nohunt') }, world: worldOpt, match: { noEnd: params.has('noend'), ...(params.has('noidle') ? { idleSec: 1e9 } : {}) } });
const view = await new View(document.getElementById('gl')).load('/village.glb');
const hud = new Hud(game);
const input = new Input();

const mismatches = [];
for (const o of scene) {
  if (!o.pos) continue;
  const n = view.nodes.get(o.id); if (!n) { mismatches.push(`${o.id}: 無節點`); continue; }
  const w = toWorld(o.pos);
  if (n.position.distanceTo(w) > 0.01) mismatches.push(`${o.id}: glb (${n.position.x.toFixed(1)}, ${n.position.z.toFixed(1)}) vs scene (${w.x}, ${w.z})`);
}
console.log(mismatches.length ? ['座標對應不一致', ...mismatches].join('\n') : `座標對應一致：${scene.filter(o => o.pos).length} 個物件`);

view.roads(meta.roads || []);
for (const o of game.world.objects.values()) if (o.pos) view.setState(o.id, o.state);
for (const v of game.villagers) view.setState(v.id, v.level);
view.setState('outsider', 'intact');

game.world.on('object', ({ object: o }) => {
  view.setState(o.id, o.state);
  if (o.heldBy) view.setVisible(o.id, o.type === 'lamp'); else if (o.pos) { view.setVisible(o.id, true); view.setPos(o.id, o.pos, o.type === 'book' && game.player.carrying === o.id ? 1.4 : 0); }
});
game.world.on('level', ({ actor, to }) => view.setState(actor.id, to));
game.on(e => {
  if (['violation', 'captured', 'teleport'].includes(e.type)) hud.toast(e.text, '', 3);
  else if (['witness'].includes(e.type)) hud.toast(e.text, 'warn', 3);
  else if (['refuse', 'conflict', 'level', 'protected', 'phase', 'invited', 'lost'].includes(e.type)) hud.toast(e.text, 'info', 2.5);
  else if (e.type === 'blocked') hud.toast(e.text, 'info', 1.5);
  else if (e.type === 'assim') hud.toast(e.text, e.text.includes('被抓') ? '' : 'info', 2.5);
  else if (e.type === 'idle') hud.toast(e.text, 'info', 3);
});
function startGame() { game.start({ opening: params.has('noopening') ? 0 : undefined }); }
if (params.has('autostart')) startGame(); else hud.showStart(startGame);
game.world.on('end', ({ state, reason, stats }) => hud.showEnd(state, reason, stats));

function drawMarkers() {
  const p = game.player, w = game.world, night = w.isNight();
  view.clearMarkers();
  const nl = game.status().noLeave;
  view.circle(game.grid.center(), game.grid.radius, nl === 'binding' ? 0xffffff : 0x66ff88, nl === 'binding' ? 0.5 : 0.95, 0.06, nl === 'binding');
  if (!night) for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') {
    const inside = Math.hypot(o.pos[0] - p.cell[0], o.pos[1] - p.cell[1]) <= (o.radius ?? 8);
    view.circle(o.pos, o.radius ?? 8, inside ? 0xff5544 : 0xcc8877, inside ? 0.7 : 0.3);
  }
  if (night) {
    for (const o of w.objects.values()) if (o.type === 'lamppost' && o.state === 'intact') view.disc(o.pos, o.radius ?? 4, 0xffcc66, 0.22, 0.04);
    for (const v of game.villagers) if (v.lit) view.disc(v.fpos, 3, 0xffcc66, 0.18, 0.04);
    if (p.actor.lit) view.disc(p.pos, 3, 0xffee99, 0.2, 0.04);
  }
  const mine = new Set(game.protectedIds('outsider'));
  for (const id of mine) view.outline(id, 0xffcc33);
  if (hud.designer) {
    for (const id of game.protectedIds(null)) if (!mine.has(id)) view.outline(id, 0x33ddff, 1.3, 2.4);
    for (const v of game.villagers) if (!v.sleeping) view.circle(v.fpos, game.vil.sight(v), game.vil.seesOutsider(v) ? 0xff4444 : 0x88aaff, 0.5, 0.05, true);
  }
  for (const v of game.villagers) {
    if (game.vil.hunts(v)) view.tag(v.fpos, 0xff2222, 2.6, 0.3);
    else if (v.task) view.tag(v.fpos, 0x44aaff, 2.6, 0.22);
    else if (game.vil.seesOutsider(v) && !v.sleeping) view.tag(v.fpos, 0xffee44, 2.6, 0.18);
  }
  const bc = game.broadcast();
  if (bc) for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') view.tag(o.pos, 0xff4444, 3.4, 0.25);
}

let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; frames++;   // rAF 的時間戳可能比 performance.now() 早，dt 不能是負的
  for (const code of input.take()) {
    if (code === 'KeyE') game.act(0);
    else if (/^Digit[2-9]$/.test(code)) game.act(+code.slice(5) - 1);
    else if (code === 'Tab') hud.toggleDesigner();
    else if (code === 'KeyN') hud.el.notes.classList.toggle('collapsed');
  }
  const d = input.dir(); if (d) game.tryStep(d, input.running());
  game.tick(dt);
  const p = game.player;
  view.setPos('outsider', p.pos);
  if (p.carrying) view.setPos(p.carrying, p.pos, 1.4);
  for (const id of p.actor.held) { const o = game.world.objects.get(id); if (o.type === 'lamp') view.setPos(id, p.pos, 1.0); }
  for (const v of game.villagers) { view.setPos(v.id, v.fpos); if (v.carrying) view.setPos(v.carrying, v.fpos, 1.4); }
  for (const h of view.roofs.keys()) view.setRoof(h, p.house !== h);
  view.setDaylight(game.world.isNight() ? 0 : 1, dt);
  drawMarkers();
  view.lookAtCell(p.pos, frames === 1);
  hud.update(dt);
  hud.labels(game.villagers.map(v => ({ id: v.id, xy: view.project(v.fpos, 2.3), text: `${STATE[v.level]}${game.vil.hunts(v) ? '・追你！' : v.task ? '・' + INDUCE[v.task.kind].slice(1) : v.sleeping ? '・睡著' : v.lit ? '・守夜' : v.returning ? '・回家中' : game.vil.seesOutsider(v) ? '・看著你' : ''}`, cls: v.level + (game.vil.hunts(v) ? ' chase' : '') })));
  view.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__game = {
  game, view, hud, input, scene, meta, mismatches,
  status: () => game.status(),
  options: () => game.options().map(o => ({ verb: o.verb, target: o.target, label: o.label, ok: o.ok, violates: o.violates })),
  act: i => game.act(i),
  step: (dir, run = false) => game.tryStep(dir, run),
  place: cell => game.place(cell),
  face: dir => { game.player.facing = dir; },
  log: () => game.log,
  notes: () => game.world.notes('outsider'),
  rules: () => game.world.rules.map(r => ({ no: r.no, key: r.key, text: r.text, void: r.void, dead: r.dead, hole: r.hole })),
  objects: () => [...game.world.objects.values()].filter(o => o.type !== 'wild').map(o => ({ id: o.id, type: o.type, state: o.state, pos: o.pos, heldBy: o.heldBy })),
  frames: () => frames,
  start: () => startGame(),
  match: () => ({ state: game.match.state, reason: game.match.reason, assim: game.match.assim, stats: { ...game.match.stats } }),
  broadcast: () => game.broadcast(),
  quiet: () => game.quietCell(),
  protectedIds: a => game.protectedIds(a),
  designer: on => { if (hud.designer !== on) hud.toggleDesigner(); },
  invite: h => { game.invitedTo = h; },
  designerRules: () => game.designerRules(),
  induce: (id, kind) => game.vil.induce(game.world.actors.get(id), kind),
  villager: id => { const v = game.world.actors.get(id); return { pos: v.pos, level: v.level, mode: v.mode, task: v.task, sleeping: v.sleeping, lit: v.lit }; },
  setTime: t => { game.world.t = t; },
};

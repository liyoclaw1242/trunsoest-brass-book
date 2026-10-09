// main.js —— 啟動（v2）：讀 scene、建 Game（種子）、載 glb、主迴圈、晝夜、標記。window.__game 給試玩腳本。
import * as THREE from 'three';
import { Game, name, STATE } from './game.js';
import { View, toWorld } from './view.js';
import { Hud } from './hud.js';
import { Input } from './input.js';

const [scene, meta] = await Promise.all([fetch('/scene.json').then(r => r.json()), fetch('/scene.meta.json').then(r => r.json())]);
const params = new URLSearchParams(location.search);
const urlSeed = params.get('seed') || String(Math.floor(Math.random() * 1e6));
const worldOpt = {}; if (params.has('day')) worldOpt.daySec = +params.get('day'); if (params.has('night')) worldOpt.nightSec = +params.get('night');
function mkGame(seed) { return new Game(scene, meta, { seed, villagers: { hunt: !params.has('nohunt') }, world: worldOpt, match: { noEnd: params.has('noend'), ...(params.has('noidle') ? { book: { } } : {}) } }); }
let game = mkGame(urlSeed);
const view = await new View(document.getElementById('gl')).load('/village.glb');
const hud = new Hud(game);
const input = new Input();

const mismatches = [];
for (const o of scene) { if (!o.pos) continue; const n = view.nodes.get(o.id); if (!n) { mismatches.push(o.id); continue; } if (n.position.distanceTo(toWorld(o.pos)) > 0.01) mismatches.push(o.id); }
console.log(mismatches.length ? '座標對應不一致 ' + mismatches.join(',') : `座標對應一致：${scene.filter(o => o.pos).length} 個物件`);
view.roads(meta.roads || []);

function wire(g) {
  for (const o of g.world.objects.values()) if (o.pos) view.setState(o.id, o.state);
  for (const v of g.villagers) view.setState(v.id, v.level);
  view.setState('outsider', 'intact');
  g.world.on('object', ({ object: o }) => { view.setState(o.id, o.state); if (o.heldBy) view.setVisible(o.id, o.type === 'lamp'); else if (o.pos) { view.setVisible(o.id, true); view.setPos(o.id, o.pos, o.type === 'book' && g.player.carrying === o.id ? 1.4 : 0); } });
  g.world.on('level', ({ actor, to }) => view.setState(actor.id, to));
  g.world.on('spotted', ({ actor }) => hud.toast(`${actor.id === 'outsider' ? '' : '村民'}發現了你——追你！`, 'warn', 2.5));
  g.on(e => {
    if (['violation', 'captured', 'teleport', 'destroy', 'end'].includes(e.type)) hud.toast(e.text, '', 3);
    else if (e.type === 'witness') hud.toast(e.text, 'warn', 3);
    else if (['refuse', 'conflict', 'level', 'phase', 'accept', 'assim', 'fade', 'writing'].includes(e.type)) hud.toast(e.text, 'info', 2.5);
  });
  g.world.on('match:end', ({ state, reason, stats }) => hud.showEnd(state, reason, stats));
}
wire(game);
function startGame(seed) { if (seed && seed !== String(game.session.rng.seed)) { game = mkGame(seed); window.__game.game = game; wire(game); } game.start({ opening: params.has('noopening') ? 0 : undefined }); }
if (params.has('autostart')) startGame(urlSeed); else hud.showStart(startGame, urlSeed);

function drawMarkers() {
  const p = game.player, w = game.world, night = w.isNight();
  view.clearMarkers();
  view.circle(game.grid.center(), game.grid.radius, 0xffffff, 0.5, 0.06, true);
  if (!night) for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') { const inside = Math.hypot(o.pos[0] - p.cell[0], o.pos[1] - p.cell[1]) <= (o.radius ?? 8); view.circle(o.pos, o.radius ?? 8, inside ? 0xff5544 : 0xcc8877, inside ? 0.6 : 0.25); }
  if (night) for (const o of w.objects.values()) if (o.type === 'lamppost' && o.state === 'intact') view.disc(o.pos, o.radius ?? 4, 0xffcc66, 0.2, 0.04);
  for (const id of new Set(game.protectedIds('outsider'))) view.outline(id, 0xffcc33);
  const bc = game.broadcast();
  if (bc) for (const o of w.objects.values()) if (o.type === 'speaker' && o.state === 'intact') view.tag(o.pos, 0xff4444, 3.4, 0.25);
  for (const v of game.villagers) { if (v.dead) continue; if (game.vil.hunts(v)) view.tag(v.fpos, 0xff2222, 2.6, 0.3); else if (v.mode === 'work' && v.carryingGoods) view.tag(v.fpos, 0xffdd55, 2.6, 0.22); }
}

let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; frames++;
  for (const code of input.take()) { if (code === 'KeyE') game.act(0); else if (/^Digit[1-9]$/.test(code)) game.act(+code.slice(5) - 1); else if (code === 'Tab') hud.toggleDesigner(); else if (code === 'KeyN') hud.el.notes.classList.toggle('collapsed'); }
  const d = input.dir(); if (d) game.tryStep(d, input.running());
  game.tick(dt);
  const p = game.player;
  view.setPos('outsider', p.pos);
  if (p.carrying) view.setPos(p.carrying, p.pos, 1.4);
  for (const id of p.actor.held) { const o = game.world.objects.get(id); if (o.type === 'lamp') view.setPos(id, p.pos, 1.0); }
  for (const v of game.villagers) { if (v.dead) { view.setVisible(v.id, false); continue; } view.setPos(v.id, v.fpos); }
  for (const h of view.roofs.keys()) view.setRoof(h, p.house !== h);
  view.setDaylight(game.world.isNight() ? 0 : 1, dt);
  drawMarkers();
  view.lookAtCell(p.pos, frames === 1);
  hud.update(dt);
  hud.labels(game.villagers.filter(v => !v.dead).map(v => ({ id: v.id, xy: view.project(v.fpos, 2.3), text: `${STATE[v.level]}${game.vil.hunts(v) ? '・追你！' : v.mode === 'work' ? '・工作' : ''}`, cls: v.level + (game.vil.hunts(v) ? ' chase' : '') })));
  { const W = view.canvas.clientWidth || innerWidth, H = view.canvas.clientHeight || innerHeight, m = 54;
    hud.marks(game.landmarks().map(L => { const [sx, sy] = view.project(L.cell, 1.6); const on = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
      const angle = on ? 0 : Math.atan2(sy - H / 2, sx - W / 2);
      const x = on ? sx : Math.max(m, Math.min(W - m, sx)), y = on ? sy : Math.max(m, Math.min(H - m, sy));
      const dist = Math.round(Math.hypot(L.cell[0] - game.player.cell[0], L.cell[1] - game.player.cell[1]));
      return { id: L.id, text: L.text, cls: L.cls, x, y, on, angle, dist }; })); }
  view.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__game = {
  game, view, hud, input, scene, meta, mismatches,
  status: () => game.status(), options: () => game.options().map(o => ({ verb: o.verb, target: o.target, kind: o.kind, label: o.label, ok: o.ok, violates: o.violates })),
  act: i => game.act(i), step: (dir, run = false) => game.tryStep(dir, run), place: c => game.place(c), face: d => { game.player.facing = d; },
  log: () => game.log, notes: () => game.world.notes('outsider'), rules: () => game.designerRules(),
  objects: () => [...game.world.objects.values()].filter(o => o.type !== 'wild').map(o => ({ id: o.id, type: o.type, state: o.state, pos: o.pos, heldBy: o.heldBy })),
  frames: () => frames, start: s => startGame(s), designer: on => { if (hud.designer !== on) hud.toggleDesigner(); },
  match: () => ({ state: game.match.state, reason: game.match.reason, activity: game.match.activity.value, assim: game.match.assim.value, stats: { ...game.match.stats } }),
  villager: id => { const v = game.world.actors.get(id); return { pos: v.pos, level: v.level, mode: v.mode, dead: !!v.dead }; },
  setActivity: a => { game.match.activity.value = a; }, setTime: t => { game.world.t = t; },
  wake: id => { const v = game.world.actors.get(id); game.vil.demote(v, 'test'); game.vil.demote(v, 'test'); },
};

// session.js —— 從 scene.json 建一局：World + Grid + 角色 + 村民模組。畫面端與測試共用。
import { World } from './rulebook-engine.js';
import { setup } from './rules.default.js';
import { Grid } from './grid.js';
import { Villagers } from './villagers.js';

export function createSession(scene, meta, opt = {}) {
  const world = new World(scene, opt.world || {});
  const grid = new Grid(world.objects);
  const outsider = world.addActor({ id: 'outsider', kind: 'outsider', pos: [...meta.start] });
  for (const o of scene.filter(o => o.type === 'villager')) {
    world.addActor({ id: o.id, kind: 'citizen', pos: [...o.pos], level: o.state, home: [...o.pos], color: o.color });
  }
  setup(world);
  const villagers = new Villagers(world, grid, opt.villagers || {});
  return { world, grid, outsider, villagers, tick(dt) { world.tick(dt); villagers.tick(dt); } };
}

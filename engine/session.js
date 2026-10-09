// session.js —— 從 scene.json 建一局（v2）：種子亂數 + World + Grid + 村民 + Match（活性／勞動／同化／書）。
import { World } from './rulebook-engine.js';
import { Grid } from './grid.js';
import { Villagers } from './villagers.js';
import { Match } from './match.js';
import { RNG } from './rng.js';
import { CONSTITUTION } from './rules.v2.js';

export function createSession(scene, meta, opt = {}) {
  const rng = new RNG(opt.seed ?? meta.seed ?? 1);
  const world = new World(scene, opt.world || {});
  const grid = new Grid(world.objects, { roads: meta.roads || [], plaza: meta.plaza || null, wildDeep: meta.wildDeep || null, radius: meta.radius });
  const outsider = world.addActor({ id: 'outsider', kind: 'outsider', pos: [...meta.start] });
  for (const o of scene.filter(o => o.type === 'villager')) {
    world.addActor({ id: o.id, kind: 'citizen', pos: [...o.pos], level: o.state, home: [...o.pos], color: o.color, carrier: !!o.carrier });
  }
  // 憲法：市民皆認知，外鄉人沒被告知過
  const citizens = [...world.actors.values()].filter(a => a.kind === 'citizen').map(a => a.id);
  for (const def of CONSTITUTION) world.write(def, { silent: true, knownBy: citizens });

  const villagers = new Villagers(world, grid, { rng, ...(opt.villagers || {}) });
  const session = { world, grid, outsider, villagers, rng, center: [...meta.start], meta,
    tick(dt) { world.tick(dt); villagers.tick(dt); session.match.tick(dt); } };
  session.match = new Match(session, opt.match || {});
  villagers.match = session.match;
  world.opt.max = session.match.economy.ruleCap();
  return session;
}

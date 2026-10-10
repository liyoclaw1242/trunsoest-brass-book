// game.js —— 回合制「鑽規則漏洞」解謎引擎（Baba 式）。純邏輯、可被 node 直接驅動以驗證可解。
// 格子移動、推動（山羊／廣播器／書）、拾取（名牌／衣物）、讀公告、山羊吃公告／馱書、狀態（市民／已聽）、離開判定、undo／reset。

const WALKABLE = new Set(['exit', 'name', 'clothes', 'notice', 'wilddeep', 'shed']);
const PUSHABLE = new Set(['goat', 'speaker', 'book', 'villager']);
const DEF_OF = { name: 'name', clothes: 'clothes' };

export class Puzzle {
  constructor(level) {
    this.level = level;
    this.w = level.map[0].length; this.h = level.map.length;
    this.walls = new Set(); this.objs = []; let n = 0;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = level.map[y][x];
      if (ch === '#') { this.walls.add(x + ',' + y); continue; }
      if (ch === '@') { this.startPos = [x, y]; continue; }
      const t = { E: 'exit', N: 'name', C: 'clothes', K: 'notice', S: 'speaker', G: 'goat', B: 'book', V: 'villager', x: 'wilddeep', H: 'shed' }[ch];
      if (t) this.objs.push({ id: 'o' + (n++), type: t, x, y, ox: x, oy: y, gone: false, carries: null });
    }
    this.laws = level.laws.map((l, i) => ({ ...l, id: 'L' + i }));
    // 把廣播器連到它所播的法與半徑
    const spLaw = this.laws.find(l => l.src === 'speaker');
    for (const o of this.objs) if (o.type === 'speaker') { o.law = spLaw ? spLaw.id : null; o.radius = level.speakerRadius ?? 1; }
    this.goal = level.goal;
    this.reset();
  }

  reset() {
    this.pos = [...this.startPos];
    this.has = new Set(this.level.has || []);
    this.heard = new Set();
    for (const o of this.objs) { o.x = o.ox; o.y = o.oy; o.gone = false; o.carries = null; }
    this.history = [];
    this.won = false; this.msg = '';
    this.refreshHeard();
  }

  // ---------- 查詢 ----------
  wall(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h || this.walls.has(x + ',' + y); }
  at(x, y, kinds = null) { return this.objs.find(o => !o.gone && o.x === x && o.y === y && (!kinds || kinds.has(o.type))); }
  law(id) { return this.laws.find(l => l.id === id); }
  isCitizen() { return this.laws.some(l => l.def && this.has.has(l.def)); }

  /** 站在還在廣播的廣播器範圍內 → 聽到它的法。 */
  refreshHeard() {
    for (const s of this.objs) {
      if (s.gone || s.type !== 'speaker' || !s.law) continue;
      if (Math.max(Math.abs(s.x - this.pos[0]), Math.abs(s.y - this.pos[1])) <= (s.radius ?? 1)) this.heard.add(s.law);
    }
  }

  /** 一條法此刻生效嗎：廣播／公告要聽到／讀到才算；「寫在公告上」的法，公告被毀就失效。 */
  active(l) { return (!l.src || this.heard.has(l.id)) && (!l.onNotice || this.objs.some(o => o.type === 'notice' && !o.gone)); }
  applies(l) { const c = this.isCitizen(); return !l.who || l.who === 'any' || (l.who === 'citizen' && c) || (l.who === 'outsider' && !c); }

  /** 以目前身分與「聽到」狀態，能不能離開。 */
  leaveAllowed() {
    const applies = l => this.applies(l);
    const active = l => this.active(l);
    const rel = this.laws.filter(l => l.verb === 'leave' && applies(l) && active(l));
    const forbid = rel.some(l => l.mode === 'forbid');
    const permit = rel.some(l => l.mode === 'permit');
    return !forbid || permit;
  }

  /** 領受某物（名字／衣物）是否被法條禁止。 */
  takeForbidden(type) {
    return this.laws.some(l => (l.verb === 'accept' || l.verb === 'take') && l.mode === 'forbid' && (l.target ? l.target === type : true) && this.applies(l) && this.active(l));
  }
  /** 你自己搬動／牽引某物是否被法條禁止（換成別的對象代勞則不受此限）。 */
  moveForbidden(obj) {
    return this.laws.some(l => (l.verb === 'move' || l.verb === 'lead') && l.mode === 'forbid' && (l.target ? l.target === obj.type : true) && this.applies(l) && this.active(l));
  }

  // ---------- 行動 ----------
  snapshot() {
    return JSON.stringify({ pos: this.pos, has: [...this.has], heard: [...this.heard],
      objs: this.objs.map(o => [o.x, o.y, o.gone ? 1 : 0, o.carries || '']) });
  }
  restore(s) {
    const d = JSON.parse(s);
    this.pos = d.pos; this.has = new Set(d.has); this.heard = new Set(d.heard);
    d.objs.forEach((v, i) => { const o = this.objs[i]; o.x = v[0]; o.y = v[1]; o.gone = !!v[2]; o.carries = v[3] || null; });
    this.won = false; this.msg = '';
  }
  undo() { if (this.history.length) { this.restore(this.history.pop()); return true; } return false; }

  /** dir: [dx,dy]。回傳 { moved, win, msg }。 */
  move(dir) {
    if (this.won) return { moved: false };
    const before = this.snapshot();
    const r = this._apply(dir);
    if (r.moved) { this.history.push(before); this.refreshHeard(); if (this.checkWin()) { this.won = true; r.win = true; } }
    this.msg = r.msg || '';
    return r;
  }

  _apply([dx, dy]) {
    const [px, py] = this.pos, tx = px + dx, ty = py + dy;
    if (this.wall(tx, ty)) return { moved: false, msg: '牆擋著路。' };
    const o = this.at(tx, ty);
    if (!o) { this.pos = [tx, ty]; return { moved: true }; }

    if (o.type === 'exit') {
      if (this.leaveAllowed()) { this.pos = [tx, ty]; return { moved: true, msg: '你走出去了。' }; }
      const citizen = this.isCitizen();
      return { moved: false, msg: citizen ? '這道門不讓你走。' : '你是外鄉人，不得離開。那道門只讓市民過。' };
    }
    if (o.type === 'wilddeep') { this.pos = [tx, ty]; return { moved: true }; }
    if (o.type === 'name') { if (this.takeForbidden('name')) return { moved: false, msg: '你被禁止領受名字。' }; this.has.add('name'); o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: '你領了一個本村的名字。' }; }
    if (o.type === 'clothes') { if (this.takeForbidden('clothes')) return { moved: false, msg: '你被禁止穿上本村的衣服。' }; this.has.add('clothes'); o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: '你換上了本村的衣服。' }; }
    if (o.type === 'shed') { this.has.clear(); this.pos = [tx, ty]; return { moved: true, msg: '你脫下了本村的身分，又成了外鄉人。' }; }
    if (o.type === 'notice') { if (o.law) this.heard.add(o.law); else for (const l of this.laws) if (l.src === 'notice') this.heard.add(l.id); this.pos = [tx, ty]; return { moved: true, msg: '你讀了公告——它現在綁得住你了。' }; }

    if (PUSHABLE.has(o.type)) {
      if (this.moveForbidden(o)) return { moved: false, msg: o.type === 'book' ? '外鄉人不得搬動黃銅書。' : o.type === 'goat' ? '外鄉人不得牽引牲口。' : '法條禁止你搬動它。' };
      const bx = tx + dx, by = ty + dy;
      if (this.wall(bx, by)) return { moved: false, msg: '推不動，後面是牆。' };
      const beyond = this.at(bx, by);
      // 山羊被推到公告上 → 吃掉公告
      if (o.type === 'goat' && beyond && beyond.type === 'notice') { beyond.gone = true; o.x = bx; o.y = by; this.pos = [tx, ty]; return { moved: true, msg: '山羊把公告吃了——那條法沒人讀得到了。' }; }
      // 山羊被推到書上 → 馱起書
      if (o.type === 'goat' && beyond && beyond.type === 'book') { beyond.gone = true; o.carries = 'book'; o.x = bx; o.y = by; this.pos = [tx, ty]; return { moved: true, msg: '山羊馱起了黃銅書。' }; }
      // 後面若是實心物（另一個可推物）才擋；地貼類（出口、荒野）可以推上去
      if (beyond && !WALKABLE.has(beyond.type)) return { moved: false, msg: '推不動，後面有東西。' };
      o.x = bx; o.y = by; this.pos = [tx, ty];
      return { moved: true };
    }
    return { moved: false, msg: '過不去。' };
  }

  checkWin() {
    if (this.goal === 'leave') return this.pos[0] === this.at0('exit')?.x && this.pos[1] === this.at0('exit')?.y && this.leaveAllowed();
    if (this.goal === 'bookOut') {
      const goat = this.objs.find(o => o.type === 'goat');
      const onWild = (x, y) => this.level.map[y] && this.level.map[y][x] === 'x';
      if (goat && goat.carries === 'book' && onWild(goat.x, goat.y)) return true;
      const book = this.objs.find(o => o.type === 'book' && !o.gone);
      if (book && onWild(book.x, book.y)) return true;
      return false;
    }
    return false;
  }
  at0(type) { return this.objs.find(o => o.type === type); }

  status() {
    return { pos: [...this.pos], w: this.w, h: this.h, won: this.won, msg: this.msg,
      citizen: this.isCitizen(), has: [...this.has], heard: [...this.heard], leaveAllowed: this.leaveAllowed(),
      walls: [...this.walls], objs: this.objs.filter(o => !o.gone).map(o => ({ type: o.type, x: o.x, y: o.y, carries: o.carries })),
      goal: this.goal };
  }
}

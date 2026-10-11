// game.js —— 回合制「鑽規則漏洞」解謎引擎（Baba 式）。純邏輯、可被 node 直接驅動以驗證可解。
// 格子移動、推動（山羊／廣播器／書）、拾取（名牌／衣物）、讀公告、山羊吃公告／馱書、狀態（市民／已聽）、離開判定、undo／reset。

const WALKABLE = new Set(['exit', 'name', 'clothes', 'notice', 'wilddeep', 'shed', 'axe']);
const PUSHABLE = new Set(['goat', 'speaker', 'book', 'villager', 'tile']);

// Baba 式字塊：法條由可推動的字塊排成一句「主詞 情態 動詞」而生效；玩家推字塊就能改規則。
const SUBJ = { '外鄉人': 'outsider', '市民': 'citizen', '任何人': 'any', '山羊': 'goat', '物': 'item', '樹木': 'tree', '生物': 'creature' };
const MODAL = { '不得': 'forbid', '得': 'permit' };
const VERB = { '離開': 'leave', '進入': 'enter', '搬書': 'move', '推': 'push', '吃': 'eat', '砍伐': 'chop', '持有': 'hold', '兩格': 'double' };
const TILE_KIND = w => (w in SUBJ ? 'subject' : w in MODAL ? 'modal' : w in VERB ? 'verb' : 'word');

export class Puzzle {
  constructor(level) {
    this.level = level;
    this.w = level.map[0].length; this.h = level.map.length;
    this.walls = new Set(); this.objs = []; let n = 0;
    // 地形：河（過不去）、木地板（會燒）、洞穴（把推進來的東西吞掉）、火（會沿木地板蔓延）
    this.water = new Set(); this.cave = new Set(); this.wood = new Set(); this.fire = new Set();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = level.map[y][x], key = x + ',' + y;
      if (ch === '#') { this.walls.add(key); continue; }
      if (ch === '@') { this.startPos = [x, y]; continue; }
      if (ch === '~') { this.water.add(key); continue; }   // 河
      if (ch === '=') { this.wood.add(key); continue; }     // 木地板（房子）
      if (ch === 'O') { this.cave.add(key); continue; }     // 洞穴
      if (ch === '^') { this.fire.add(key); continue; }     // 火堆
      const t = { E: 'exit', N: 'name', C: 'clothes', K: 'notice', S: 'speaker', G: 'goat', B: 'book', V: 'villager', x: 'wilddeep', H: 'shed', D: 'door', T: 'tree', X: 'axe', Z: 'chaser' }[ch];
      if (t) this.objs.push({ id: 'o' + (n++), type: t, x, y, ox: x, oy: y, gone: false, carries: null, state: t === 'door' ? 'closed' : null, ostate: t === 'door' ? 'closed' : null });
    }
    this.wood0 = new Set(this.wood); this.fire0 = new Set(this.fire);   // 供 reset 還原動態地形
    // 可推動的字塊（Baba 式：玩家自己排規則）
    for (const t of (level.tiles || [])) this.objs.push({ id: 'o' + (n++), type: 'tile', word: t.word, kind: TILE_KIND(t.word), fixed: !!t.fixed, x: t.x, y: t.y, ox: t.x, oy: t.y, gone: false, carries: null, state: null, ostate: null });
    // 活書：大型關裡書不停立法——預先造好「還沒寫下」的字塊（隱藏），每隔幾步揭露一組
    this.livingBook = level.livingBook || null;
    if (this.livingBook) this.livingBook.writes.forEach((grp, g) => grp.forEach(t =>
      this.objs.push({ id: 'o' + (n++), type: 'tile', word: t.word, kind: TILE_KIND(t.word), fixed: !!t.fixed, x: t.x, y: t.y, ox: t.x, oy: t.y, gone: true, pending: true, group: g, carries: null, state: null, ostate: null })));
    // 即時對手：書每步在你身旁挑「貼牆、推不動」的位置刻一個字（agenda 是它想寫的法）。位置臨場決定，故用一池隱藏備用字塊。
    this.reactiveBook = level.reactiveBook || null;
    if (this.reactiveBook) {
      const total = (this.reactiveBook.agenda || []).reduce((s, r) => s + r.length, 0);
      for (let i = 0; i < total; i++) this.objs.push({ id: 'o' + (n++), type: 'tile', word: '', kind: 'word', fixed: false, reactive: true, x: 0, y: 0, ox: 0, oy: 0, gone: true, carries: null, state: null, ostate: null });
    }
    for (const o of this.objs) o.ogone = o.gone;
    // 固定法條（給教學關）；大型關的法多由字塊即時解析而來
    this.staticLaws = (level.laws || []).map((l, i) => ({ ...l, id: 'L' + i }));
    const spLaw = this.staticLaws.find(l => l.src === 'speaker');
    for (const o of this.objs) if (o.type === 'speaker') { o.law = spLaw ? spLaw.id : null; o.radius = level.speakerRadius ?? 1; }
    this.goal = level.goal;
    this.reset();
  }

  reset() {
    this.pos = [...this.startPos];
    this.has = new Set(this.level.has || []);
    this.heard = new Set();
    this.turn = 0; this.bookIdx = 0; this.voided = false; this.didReset = false; this.lost = false; this.penRule = 0; this.penWord = 0; this.penAnchor = null; this.penDir = null;
    for (const o of this.objs) { o.x = o.ox; o.y = o.oy; o.gone = o.ogone; o.carries = null; o.state = o.ostate; if (o.reactive) { o.word = ''; o.kind = 'word'; } }
    this.wood = new Set(this.wood0); this.fire = new Set(this.fire0);
    this.history = [];
    this.won = false; this.msg = '';
    this.refreshHeard();
    this.refreshRules();
  }

  /** 從字塊即時解析出的法，接上固定法，組成當前有效法條集。書寫過「以上規則無效」後全空。 */
  refreshRules() { this.laws = this.voided ? [] : this.staticLaws.concat(this.parseTiles()); }

  /** 規則互相矛盾 → 書寫下「以上規則無效」：全場規則文字消失、法條全作廢。 */
  triggerReset() {
    this.voided = true; this.didReset = true;
    for (const o of this.objs) if (o.type === 'tile') o.gone = true;         // 全場規則文字消失
    if (this.livingBook) this.bookIdx = this.livingBook.writes.length;        // 書被自己打垮，不再續寫
    this.refreshRules();
    this.msg = '書自相矛盾，只好寫下「以上規則無效」——全場規則作廢！';
  }

  /** 掃描字塊：相鄰成「主詞→情態→動詞」（橫或直）即成一條法。玩家推動字塊就改了規則。 */
  parseTiles() {
    const out = []; let n = 0;
    const tileAt = (x, y) => this.objs.find(o => o.type === 'tile' && !o.gone && o.x === x && o.y === y);
    const mk = (a, b, c) => (a && a.word in SUBJ && b && b.word in MODAL && c && c.word in VERB)
      ? { who: SUBJ[a.word], mode: MODAL[b.word], verb: VERB[c.word], id: 'T' + (n++), fromTiles: true,
          text: `${a.word}${b.word}${c.word}` } : null;
    for (const t of this.objs) {
      if (t.type !== 'tile' || t.gone || !(t.word in SUBJ)) continue;
      let r = mk(t, tileAt(t.x + 1, t.y), tileAt(t.x + 2, t.y)); if (r) out.push(r);
      r = mk(t, tileAt(t.x, t.y + 1), tileAt(t.x, t.y + 2)); if (r) out.push(r);
    }
    return out;
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
  /** 此法套不套得到你：who（身分）＋ cond（持有某項舒適才適用，如「著衣者」）。 */
  applies(l) { const c = this.isCitizen(); const who = !l.who || l.who === 'any' || (l.who === 'citizen' && c) || (l.who === 'outsider' && !c); return who && (!l.cond || this.has.has(l.cond)); }

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
  /** 物件對應的「主詞」身分（供「物不得推」「山羊不得吃」這類管物件的法用）。 */
  objWho(o) { return o.type === 'goat' ? ['goat', 'item'] : ['item']; }
  playerWho() { return [this.isCitizen() ? 'citizen' : 'outsider', 'any']; }
  /** 推動某物是否被「推」(push) 類法條禁止（可針對推的人，也可針對被推的物，如「物不得推」）。搬書／牽羊之類仍走 moveForbidden。 */
  pushForbidden(o) {
    const whos = new Set([...this.playerWho(), ...this.objWho(o)]);
    return this.laws.some(l => l.mode === 'forbid' && l.verb === 'push' && this.active(l) && (l.target ? l.target === o.type : true) && (!l.who || l.who === 'any' || whos.has(l.who)));
  }
  /** 山羊吃東西是否被法條禁止（如「山羊不得吃」）。 */
  eatForbidden() {
    return this.laws.some(l => l.mode === 'forbid' && l.verb === 'eat' && this.active(l) && (!l.who || l.who === 'any' || l.who === 'goat' || l.who === 'item'));
  }
  /** 砍伐樹木是否被法條禁止（如「樹木不得砍伐」）。 */
  chopForbidden() {
    return this.laws.some(l => l.mode === 'forbid' && l.verb === 'chop' && this.active(l) && (l.target ? l.target === 'tree' : true));
  }
  /** 身上持有裝備是否被法條禁止（如「任何人不得持有裝備」「身上不得有裝備」）。 */
  equipForbidden() {
    return this.laws.some(l => l.mode === 'forbid' && l.verb === 'hold' && this.active(l) && (l.target ? (l.target === 'equipment' || l.target === 'axe') : true));
  }
  /** 「身上不得有裝備」生效時，書強行卸下你的斧頭（放回你腳下，可再撿）。 */
  dropEquip() {
    if (this.has.has('axe') && this.equipForbidden()) {
      this.has.delete('axe');
      const ax = this.objs.find(o => o.type === 'axe');
      if (ax) { ax.gone = false; ax.x = this.pos[0]; ax.y = this.pos[1]; }
      this.msg = '「身上不得有裝備」——書強行卸下了你的斧頭。';
    }
  }
  /** 「兩格」是可被規則賦予／剝奪的屬性：對某主詞 permit=得走兩格、forbid=不得走兩格。 */
  doubleRule(whoList, mode) {
    return this.laws.some(l => l.verb === 'double' && l.mode === mode && this.active(l) && (!l.who || l.who === 'any' || whoList.includes(l.who)));
  }
  /** 玩家這一步能走幾格：基礎 1；有「（你的身分）得兩格」且未被「不得兩格」壓制 → 2。 */
  playerDouble() { const who = this.playerWho(); return this.doubleRule(who, 'permit') && !this.doubleRule(who, 'forbid'); }
  /** 追逐者這一步走幾格：基礎 2（兇）；被「生物不得兩格」之類壓制 → 1。 */
  chaserSteps() { return this.doubleRule(['creature', 'any'], 'forbid') ? 1 : 2; }
  /** 追逐者不能進入的格（牆、河、洞穴、火、以及任何非自己的物件／字塊；玩家所在格不算擋，踩上＝抓到）。 */
  chaserBlocked(x, y) {
    const k = x + ',' + y;
    if (this.wall(x, y) || this.water.has(k) || this.cave.has(k) || this.fire.has(k)) return true;
    return this.objs.some(o => !o.gone && o.type !== 'chaser' && o.x === x && o.y === y);
  }
  /** 追逐者朝玩家走一格（貪婪：先走距離大的軸，平手先橫）。回傳新座標，走不動則原地。 */
  chaserStepTo(c) {
    const pdx = this.pos[0] - c.x, pdy = this.pos[1] - c.y;
    const sx = Math.sign(pdx), sy = Math.sign(pdy);
    const tries = Math.abs(pdx) >= Math.abs(pdy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
    for (const [dx, dy] of tries) {
      if (dx === 0 && dy === 0) continue;
      const nx = c.x + dx, ny = c.y + dy;
      if (nx === this.pos[0] && ny === this.pos[1]) return [nx, ny];   // 撲到玩家身上
      if (!this.chaserBlocked(nx, ny)) return [nx, ny];
    }
    return [c.x, c.y];
  }
  /** 追逐者移動（每回合走 chaserSteps() 格）；撲到玩家＝你被抓住，判負。 */
  moveChaser() {
    const c = this.objs.find(o => o.type === 'chaser' && !o.gone);
    if (!c) return;
    const steps = this.chaserSteps();
    for (let s = 0; s < steps; s++) {
      const [nx, ny] = this.chaserStepTo(c);
      if (nx === c.x && ny === c.y) break;
      if (nx === this.pos[0] && ny === this.pos[1]) { c.x = nx; c.y = ny; this.lost = true; this.msg = '追逐者撲上來抓住了你！'; return; }
      c.x = nx; c.y = ny;
    }
  }
  /** 火沿木地板蔓延：每回合把相鄰的木地板燒成火，燒到的字塊／物件一併燒毀。 */
  spreadFire() {
    if (!this.fire.size) return;
    const add = [];
    for (const key of this.fire) {
      const [fx, fy] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (fx + dx) + ',' + (fy + dy);
        if (this.wood.has(nk) && !this.fire.has(nk)) add.push(nk);
      }
    }
    for (const nk of add) {
      this.wood.delete(nk); this.fire.add(nk);
      const [x, y] = nk.split(',').map(Number);
      for (const o of this.objs) if (!o.gone && o.x === x && o.y === y && o.type !== 'exit') o.gone = true;
    }
  }

  // ---------- 行動 ----------
  snapshot() {
    return JSON.stringify({ pos: this.pos, has: [...this.has], heard: [...this.heard], turn: this.turn, bookIdx: this.bookIdx, penRule: this.penRule, penWord: this.penWord, penAnchor: this.penAnchor, penDir: this.penDir, voided: this.voided ? 1 : 0, didReset: this.didReset ? 1 : 0, lost: this.lost ? 1 : 0,
      wood: [...this.wood].sort(), fire: [...this.fire].sort(),
      objs: this.objs.map(o => [o.x, o.y, o.gone ? 1 : 0, o.carries || '', o.state || '', o.word || '']) });
  }
  restore(s) {
    const d = JSON.parse(s);
    this.pos = d.pos; this.has = new Set(d.has); this.heard = new Set(d.heard); this.turn = d.turn || 0; this.bookIdx = d.bookIdx || 0;
    this.penRule = d.penRule || 0; this.penWord = d.penWord || 0; this.penAnchor = d.penAnchor || null; this.penDir = d.penDir || null; this.voided = !!d.voided; this.didReset = !!d.didReset; this.lost = !!d.lost;
    this.wood = new Set(d.wood || []); this.fire = new Set(d.fire || []);
    d.objs.forEach((v, i) => { const o = this.objs[i]; o.x = v[0]; o.y = v[1]; o.gone = !!v[2]; o.carries = v[3] || null; o.state = v[4] || null; if (o.type === 'tile') { o.word = v[5] || o.word; o.kind = TILE_KIND(o.word); } });
    this.won = false; this.msg = '';
    this.refreshHeard(); this.refreshRules();
  }
  undo() { if (this.history.length) { this.restore(this.history.pop()); return true; } return false; }

  /** dir: [dx,dy]。回傳 { moved, win, msg }。 */
  move(dir) {
    if (this.won || this.lost) return { moved: false };
    const before = this.snapshot();
    const dbl = this.playerDouble();
    const r = this._apply(dir);
    if (r.moved) {
      if (dbl) { const r2 = this._apply(dir); if (r2.moved && r2.msg) r.msg = r2.msg; }   // 「得兩格」：同一步再走一格
      this.history.push(before); this.turn++;
      this.bookWrite(); this.reactiveWrite(); this.spreadFire();
      this.refreshHeard(); this.refreshRules();         // 先讓玩家這步造成的規則變動生效（追逐者才會即時被「不得兩格」減速）
      this.moveChaser();
      this.openGates(); this.dropEquip();
      if (!this.voided && this.hasContradiction()) this.triggerReset();
      if (this.checkWin()) { this.won = true; r.win = true; }
      else if (this.lost) { r.lost = true; r.msg = this.msg; }   // 被追逐者抓到
      else if (this.fire.has(this.pos[0] + ',' + this.pos[1])) {
        this.lost = true; r.lost = true; r.msg = '火追上來把你吞了——你沒能及時離開這片木地板。';
      }
      else if (this.level.deadline != null && this.turn >= this.level.deadline) {
        // 將軍：書搶在你之前把規則填滿、寫下必殺令——你困死在這裡。
        this.lost = true; r.lost = true;
        r.msg = this.level.killer || '書搶先一步把規則填滿了全場、寫下對你的必殺令——你被將死，困在這裡了。';
      }
    }
    this.msg = r.msg || '';
    return r;
  }

  _apply([dx, dy]) {
    const [px, py] = this.pos, tx = px + dx, ty = py + dy, tkey = tx + ',' + ty;
    if (this.wall(tx, ty)) return { moved: false, msg: '牆擋著路。' };
    if (this.water.has(tkey)) return { moved: false, msg: '是河，過不去。' };
    if (this.cave.has(tkey)) return { moved: false, msg: '是洞穴，掉下去可不行。' };
    if (this.fire.has(tkey)) return { moved: false, msg: '火擋著，過不去。' };
    const o = this.at(tx, ty);
    if (!o) { this.pos = [tx, ty]; return { moved: true }; }

    if (o.type === 'tree') {
      if (!this.has.has('axe')) return { moved: false, msg: '一棵樹擋著路——徒手砍不動，得有把斧頭。' };
      if (this.chopForbidden()) return { moved: false, msg: '「樹木不得砍伐」——你舉著斧頭，卻下不了手。先改掉那條法。' };
      o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: '你一斧把樹放倒了。' };
    }
    if (o.type === 'axe') {
      if (this.equipForbidden()) return { moved: false, msg: '「身上不得有裝備」——你撿不起這把斧頭。' };
      this.has.add('axe'); o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: '你撿起一把斧頭，裝備上了。' };
    }

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
    if (o.type === 'door') { if (o.state === 'open') { this.pos = [tx, ty]; return { moved: true }; } return { moved: false, msg: '門鎖著——外鄉人開不了，得有市民去開。' }; }

    if (PUSHABLE.has(o.type)) {
      if (o.type === 'tile' && o.fixed) return { moved: false, msg: '這個字塊像是刻死的，推不動。' };
      if (this.moveForbidden(o)) return { moved: false, msg: o.type === 'book' ? '外鄉人不得搬動黃銅書。' : o.type === 'goat' ? '外鄉人不得牽引牲口。' : '法條禁止你搬動它。' };
      if (o.type !== 'tile' && this.pushForbidden(o)) return { moved: false, msg: '法條禁止推動' + (o.type === 'goat' ? '牲口' : '物品') + '。（先改掉那條法）' };
      const bx = tx + dx, by = ty + dy, bkey = bx + ',' + by;
      if (this.wall(bx, by)) return { moved: false, msg: '推不動，後面是牆。' };
      if (this.water.has(bkey)) return { moved: false, msg: '推不動，後面是河。' };
      if (this.cave.has(bkey)) { o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: o.type === 'tile' ? '字塊被推下洞穴，永遠消失了。' : '它被推下了洞穴。' }; }
      if (this.fire.has(bkey)) { o.gone = true; this.pos = [tx, ty]; return { moved: true, msg: o.type === 'tile' ? '字塊被推進火裡，燒成了灰。' : '它被推進火裡燒了。' }; }
      const beyond = this.at(bx, by);
      // 山羊被推到公告上 → 吃掉公告
      if (o.type === 'goat' && beyond && beyond.type === 'notice') { if (this.eatForbidden()) return { moved: false, msg: '法條禁止山羊吃紙。（先改掉那條法）' }; beyond.gone = true; o.x = bx; o.y = by; this.pos = [tx, ty]; return { moved: true, msg: '山羊把公告吃了——那條法沒人讀得到了。' }; }
      // 山羊被推到書上 → 馱起書
      if (o.type === 'goat' && beyond && beyond.type === 'book') { beyond.gone = true; o.carries = 'book'; o.x = bx; o.y = by; this.pos = [tx, ty]; return { moved: true, msg: '山羊馱起了黃銅書。' }; }
      // 後面若是實心物才擋；地貼類（出口、荒野）與開著的門可以推上去
      if (beyond && !WALKABLE.has(beyond.type) && !(beyond.type === 'door' && beyond.state === 'open')) return { moved: false, msg: '推不動，後面有東西。' };
      o.x = bx; o.y = by; this.pos = [tx, ty];
      return { moved: true };
    }
    return { moved: false, msg: '過不去。' };
  }

  /** 活書：每隔 everyN 步，揭露下一組「書寫下」的字塊（規則隨時間增加）。 */
  bookWrite() {
    if (!this.livingBook || this.bookIdx >= this.livingBook.writes.length) return;
    if (this.turn % this.livingBook.everyN !== 0) return;
    for (const o of this.objs) if (o.pending && o.group === this.bookIdx) o.gone = false;
    this.bookIdx++;
    this.msg = '書又寫下了一條新規則……';
  }
  /** 即時對手（性格 C：重新封印＋堵路）：把 agenda 的法排成一條「嵌進牆角壁龕、靠近你」的線，一步刻一字。 */
  reactiveWrite() {
    if (!this.reactiveBook) return;
    if (this.turn % (this.reactiveBook.everyN || 1) !== 0) return;
    const ag = this.reactiveBook.agenda || [];
    if (this.penRule >= ag.length) return;
    if (this.penWord === 0) { const line = this.chooseLine(ag[this.penRule].length); if (!line) return; this.penAnchor = line.anchor; this.penDir = line.dir; }
    const x = this.penAnchor[0] + this.penWord * this.penDir[0], y = this.penAnchor[1] + this.penWord * this.penDir[1];
    if (this.wall(x, y) || this.at(x, y)) return;   // 你擋住了它要寫的格，它這步寫不成（你防住了）
    const slot = this.objs.find(o => o.reactive && o.gone);
    if (!slot) return;
    slot.word = ag[this.penRule][this.penWord]; slot.kind = TILE_KIND(slot.word);
    slot.x = x; slot.y = y; slot.gone = false;
    this.penWord++; if (this.penWord >= ag[this.penRule].length) { this.penWord = 0; this.penRule++; this.penAnchor = null; }
    this.msg = '書盯著你，在牆邊又刻下一個字……';
  }
  /** 挑一條 len 格的直線（橫或直），三格全空，最嵌牆（最難被你推散）、又最靠近你（堵路）。回傳 {anchor,dir}。 */
  chooseLine(len) {
    let best = null, bestScore = -1e9;
    const dirs = [[1, 0], [0, 1]];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) for (const [dx, dy] of dirs) {
      const cells = []; let ok = true;
      for (let k = 0; k < len; k++) { const cx = x + k * dx, cy = y + k * dy; if (this.wall(cx, cy) || this.at(cx, cy)) { ok = false; break; } cells.push([cx, cy]); }
      if (!ok) continue;
      let hug = 0; for (const [cx, cy] of cells) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.wall(cx + ax, cy + ay)) hug++;
      const mid = cells[Math.floor(len / 2)], d = Math.abs(mid[0] - this.pos[0]) + Math.abs(mid[1] - this.pos[1]);
      const score = hug * 10 - d;   // 牆面為主、靠近你為輔
      if (score > bestScore) { bestScore = score; best = { anchor: [x, y], dir: [dx, dy] }; }
    }
    return best;
  }
  /** 市民（村民）走到門旁，門就開了（外鄉人自己開不了）。 */
  openGates() {
    for (const d of this.objs) {
      if (d.gone || d.type !== 'door' || d.state === 'open') continue;
      if (this.objs.some(v => v.type === 'villager' && !v.gone && Math.abs(v.x - d.x) + Math.abs(v.y - d.y) === 1)) { d.state = 'open'; this.msg = '市民替你把門開了。'; }
    }
  }
  /** 兩條法同主詞同動詞、一禁一准 → 書自相矛盾，只好寫「以上規則無效」。 */
  hasContradiction() {
    const r = this.laws.filter(l => l.verb && l.mode);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
      if (r[i].verb === r[j].verb && r[i].who === r[j].who && r[i].mode !== r[j].mode) return true;
    return false;
  }

  checkWin() {
    if (this.goal === 'reset') return this.didReset;
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
    return { pos: [...this.pos], w: this.w, h: this.h, won: this.won, lost: this.lost, msg: this.msg,
      citizen: this.isCitizen(), has: [...this.has], heard: [...this.heard], leaveAllowed: this.leaveAllowed(),
      walls: [...this.walls], water: [...this.water], wood: [...this.wood], cave: [...this.cave], fire: [...this.fire],
      objs: this.objs.filter(o => !o.gone).map(o => ({ type: o.type, x: o.x, y: o.y, carries: o.carries })),
      goal: this.goal,
      deadline: this.level.deadline ?? null, turnsLeft: this.level.deadline != null ? Math.max(0, this.level.deadline - this.turn) : null,
      double: this.playerDouble(), chaserSpeed: this.objs.some(o => o.type === 'chaser' && !o.gone) ? this.chaserSteps() : null,
      book: this.livingBook ? { remaining: this.livingBook.writes.length - this.bookIdx, nextIn: this.bookIdx < this.livingBook.writes.length ? (this.livingBook.everyN - (this.turn % this.livingBook.everyN)) : null } : null };
  }
}

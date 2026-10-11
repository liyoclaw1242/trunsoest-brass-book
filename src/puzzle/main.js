// main.js —— 解謎原型的畫面與輸入（DOM 格子、法條面板、復原／重來、關卡選擇、進度存檔、過關）。
import { Puzzle } from './game.js';
import { LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
const GLYPH = { exit: '🚪', name: '📛', clothes: '👕', notice: '🪧', speaker: '📣', goat: '🐐', book: '📖', wilddeep: '🌲', villager: '👷', shed: '🧺', door: '🚧' };
const KEY = 'rb_puzzle_v2';

let idx = 0, puz = new Puzzle(LEVELS[0]);
let solved = new Array(LEVELS.length).fill(false);
try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Array.isArray(d.solved)) d.solved.forEach((v, i) => { if (i < solved.length) solved[i] = !!v; }); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ solved })); } catch {} };

// —— 音效（Web Audio，無外部檔）——
let actx, muted = false;
try { muted = localStorage.getItem('rb_puzzle_mute') === '1'; } catch {}
function beep(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.start(t); o.stop(t + dur); } catch {}
}
function sfx(kind) {
  if (muted) return;
  if (kind === 'move') beep(200, 0.05, 'square', 0.04);
  else if (kind === 'good') beep(540, 0.1, 'triangle', 0.12);
  else if (kind === 'deny') beep(110, 0.13, 'sawtooth', 0.08);
  else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.13, i * 0.09));
}
function doMove(dir) {
  const r = puz.move(dir); render();
  if (r.win) sfx('win');
  else if (!r.moved) { sfx('deny'); const g = tokenEls.get('player')?.querySelector('.g'); if (g) { g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); } }
  else sfx(/領|換上|吃了|馱|脫下|開了|繞|讀/.test(r.msg || '') ? 'good' : 'move');
}

function earshot() {
  const set = new Set();
  for (const o of puz.objs) {
    if (o.gone || o.type !== 'speaker') continue;
    const r = o.radius ?? 1;
    for (let y = o.y - r; y <= o.y + r; y++) for (let x = o.x - r; x <= o.x + r; x++) set.add(x + ',' + y);
  }
  return set;
}

function renderDots() {
  $('dots').innerHTML = LEVELS.map((l, i) => `<div class="dot ${i === idx ? 'cur' : ''} ${solved[i] ? 'done' : ''}" data-i="${i}" title="${l.name}">${solved[i] ? '✓' : i + 1}</div>`).join('');
}

let cellEls = new Map(), tokenEls = new Map();

// 建一次格子背景與一組持久的 token（之後只移動 token，產生滑動動畫）
function buildBoard() {
  const s = puz.status(), g = $('grid');
  g.style.gridTemplateColumns = `repeat(${s.w}, auto)`;
  cellEls = new Map();
  let html = '';
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) html += `<div class="cell" data-k="${x},${y}"></div>`;
  g.innerHTML = html;
  for (const c of g.children) cellEls.set(c.dataset.k, c);
  const tk = $('tokens'); tk.innerHTML = ''; tokenEls = new Map();
  const mk = (id, glyph) => { const e = document.createElement('div'); e.className = 'token'; e.innerHTML = `<span class="g">${glyph}</span>`; tk.appendChild(e); tokenEls.set(id, e); return e; };
  for (const o of puz.objs) if (GLYPH[o.type]) mk(o.id, GLYPH[o.type]);
  mk('player', '🧍');
  tk.classList.add('notrans');
  updateBoard();
  void tk.offsetHeight;
  tk.classList.remove('notrans');
}

function setPos(el, x, y) { const c = cellEls.get(x + ',' + y); if (c) { el.style.width = c.offsetWidth + 'px'; el.style.height = c.offsetHeight + 'px'; el.style.transform = `translate(${c.offsetLeft}px,${c.offsetTop}px)`; } }

function updateBoard() {
  const s = puz.status();
  const ear = earshot();
  for (const [k, c] of cellEls) {
    const [x, y] = k.split(',').map(Number), isWall = puz.wall(x, y), o = puz.at(x, y);
    const canGlow = s.leaveAllowed && puz.laws.some(l => l.verb === 'leave');
    c.className = 'cell' + ((x + y) % 2 ? ' alt' : '') + (isWall ? ' wall' : '') + (!isWall && ear.has(k) ? ' earshot' : '') + (o && o.type === 'exit' ? ' exit' + (canGlow ? ' open' : '') : '');
  }
  for (const o of puz.objs) {
    const e = tokenEls.get(o.id); if (!e) continue;
    const hidden = o.gone || (o.type === 'door' && o.state === 'open');
    e.style.display = hidden ? 'none' : '';
    if (hidden) continue;
    setPos(e, o.x, o.y);
    e.querySelector('.g').textContent = GLYPH[o.type];
    let b = e.querySelector('.badge');
    if (o.carries === 'book') { if (!b) { b = document.createElement('span'); b.className = 'badge'; e.appendChild(b); } b.textContent = '📖'; }
    else if (b) b.remove();
  }
  const p = tokenEls.get('player'); p.querySelector('.g').textContent = s.citizen ? '🧑‍🌾' : '🧍'; setPos(p, s.pos[0], s.pos[1]);
}

function render() {
  const s = puz.status();
  renderDots();
  $('levelsel').textContent = `第 ${idx + 1} / ${LEVELS.length} 關　·　步數 ${puz.history.length}`;
  $('lvname').textContent = puz.level.name;
  $('teach').textContent = puz.level.teach || '';
  updateBoard();
  $('laws').innerHTML = puz.laws.map(l => {
    const c = l.note ? 'law note' : l.def ? 'law def' : 'law';
    const tag = l.src === 'speaker' ? '（廣播器喊的：聽到才綁你）' : l.src === 'notice' ? '（寫在公告上：讀了才綁你）' : l.onNotice ? '（載於公告牌：牌子沒了便失效）' : '';
    return `<div class="${c}">${l.text}<span style="color:var(--faint)">${tag}</span></div>`;
  }).join('');
  $('status').innerHTML = `你現在是 <span class="pill ${s.citizen ? 'cit' : 'out'}">${s.citizen ? '市　民' : '外鄉人'}</span>　`
    + (puz.goal === 'leave' ? (s.leaveAllowed ? '<span style="color:var(--good)">此刻可離開</span>' : '<span style="color:var(--bad)">此刻不得離開</span>') : '目標：把書弄進荒野 🌲');
  $('heard').textContent = s.heard.length ? '已被這些法綁住：' + s.heard.map(id => puz.law(id)?.text || id).join('；') : '';
  const m = $('msg'); m.textContent = s.msg || ''; m.className = /不得|推不動|牆|過不去|禁止/.test(s.msg) ? 'bad' : /出去|吃了|馱|領|換上|繞|脫下/.test(s.msg) ? 'good' : '';
  if (s.won) win();
}

function win() {
  if (!solved[idx]) { solved[idx] = true; save(); renderDots(); }
  const last = idx + 1 >= LEVELS.length;
  const allDone = solved.every(Boolean);
  $('win-h').textContent = last && allDone ? '全部過關' : '出去了';
  $('win-text').textContent = puz.level.hintWin || '你出去了。';
  $('b-wnext').textContent = last ? (allDone ? '🎉 再玩一次（第一關）' : '回到未解的關') : '下一關 →';
  $('win').style.display = 'flex';
}
const hideWin = () => $('win').style.display = 'none';

function load(i) { idx = (i + LEVELS.length) % LEVELS.length; puz = new Puzzle(LEVELS[idx]); hideWin(); buildBoard(); render(); }
function nextLevel() {
  if (idx + 1 < LEVELS.length) return load(idx + 1);
  const unsolved = solved.findIndex(v => !v);
  load(unsolved < 0 ? 0 : unsolved);
}

const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
addEventListener('keydown', e => {
  if ($('intro').style.display !== 'none') return;
  if ($('win').style.display === 'flex') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextLevel(); } return; }
  if (DIRS[e.key]) { e.preventDefault(); doMove(DIRS[e.key]); }
  else if (/^[zZuU]$/.test(e.key)) { puz.undo(); render(); }
  else if (/^[rR]$/.test(e.key)) { puz.reset(); render(); }
});

$('dots').onclick = e => { const d = e.target.closest('.dot'); if (d) load(+d.dataset.i); };
const DMAP = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
$('dpad').onclick = e => { const b = e.target.closest('button'); if (b && !puz.won) doMove(DMAP[b.dataset.d]); };
$('b-mute').onclick = () => { muted = !muted; try { localStorage.setItem('rb_puzzle_mute', muted ? '1' : '0'); } catch {} $('b-mute').textContent = muted ? '🔇' : '🔊'; if (!muted) sfx('good'); };
$('b-mute').textContent = muted ? '🔇' : '🔊';
$('b-undo').onclick = () => { puz.undo(); render(); };
$('b-reset').onclick = () => { puz.reset(); render(); };
$('b-prev').onclick = () => load(idx - 1);
$('b-next').onclick = () => load(idx + 1);
$('b-wnext').onclick = nextLevel;
$('b-begin').onclick = () => { $('intro').style.display = 'none'; const resume = solved.findIndex(v => !v); load(resume < 0 ? 0 : resume); };

buildBoard(); render();

// main.js —— 解謎原型的畫面與輸入（DOM 格子、法條面板、復原／重來、關卡選擇、進度存檔、過關）。
import { Puzzle } from './game.js';
import { LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
const GLYPH = { exit: '🚪', name: '📛', clothes: '👕', notice: '🪧', speaker: '📣', goat: '🐐', book: '📖', wilddeep: '🌲', villager: '🧑‍🌾', shed: '🧺' };
const KEY = 'rb_puzzle_v1';

let idx = 0, puz = new Puzzle(LEVELS[0]);
let solved = new Array(LEVELS.length).fill(false);
try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Array.isArray(d.solved)) d.solved.forEach((v, i) => { if (i < solved.length) solved[i] = !!v; }); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ solved })); } catch {} };

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

function render() {
  const s = puz.status();
  renderDots();
  $('levelsel').textContent = `第 ${idx + 1} / ${LEVELS.length} 關`;
  $('lvname').textContent = puz.level.name;
  $('teach').textContent = puz.level.teach || '';
  const g = $('grid');
  g.style.gridTemplateColumns = `repeat(${s.w}, auto)`;
  const ear = earshot();
  let html = '';
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const key = x + ',' + y, isWall = puz.wall(x, y), objHere = puz.at(x, y);
    const cls = ['cell'];
    if ((x + y) % 2) cls.push('alt');
    if (isWall) cls.push('wall');
    if (!isWall && ear.has(key)) cls.push('earshot');
    if (objHere && objHere.type === 'exit') cls.push('exit');
    let glyph = '';
    if (s.pos[0] === x && s.pos[1] === y) glyph = s.citizen ? '🧑‍🌾' : '🧍';
    else if (objHere) glyph = GLYPH[objHere.type] || '';
    html += `<div class="${cls.join(' ')}">${glyph ? `<span class="tok">${glyph}</span>` : ''}</div>`;
  }
  g.innerHTML = html;
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

function load(i) { idx = (i + LEVELS.length) % LEVELS.length; puz = new Puzzle(LEVELS[idx]); hideWin(); render(); }
function nextLevel() {
  if (idx + 1 < LEVELS.length) return load(idx + 1);
  const unsolved = solved.findIndex(v => !v);
  load(unsolved < 0 ? 0 : unsolved);
}

const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
addEventListener('keydown', e => {
  if ($('intro').style.display !== 'none') return;
  if ($('win').style.display === 'flex') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextLevel(); } return; }
  if (DIRS[e.key]) { e.preventDefault(); puz.move(DIRS[e.key]); render(); }
  else if (/^[zZuU]$/.test(e.key)) { puz.undo(); render(); }
  else if (/^[rR]$/.test(e.key)) { puz.reset(); render(); }
});

$('dots').onclick = e => { const d = e.target.closest('.dot'); if (d) load(+d.dataset.i); };
$('b-undo').onclick = () => { puz.undo(); render(); };
$('b-reset').onclick = () => { puz.reset(); render(); };
$('b-prev').onclick = () => load(idx - 1);
$('b-next').onclick = () => load(idx + 1);
$('b-wnext').onclick = nextLevel;
$('b-begin').onclick = () => { $('intro').style.display = 'none'; const resume = solved.findIndex(v => !v); load(resume < 0 ? 0 : resume); };

render();

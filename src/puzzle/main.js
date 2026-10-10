// main.js —— 解謎原型的畫面與輸入（DOM 格子、法條面板、復原／重來、過關）。
import { Puzzle } from './game.js';
import { LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
const GLYPH = { exit: '🚪', name: '📛', clothes: '👕', notice: '🪧', speaker: '📣', goat: '🐐', book: '📖', wilddeep: '🌲', villager: '🧑‍🌾' };

let idx = 0, puz = new Puzzle(LEVELS[0]);

function earshot() {
  const set = new Set();
  for (const o of puz.objs) {
    if (o.gone || o.type !== 'speaker') continue;
    const r = o.radius ?? 1;
    for (let y = o.y - r; y <= o.y + r; y++) for (let x = o.x - r; x <= o.x + r; x++) set.add(x + ',' + y);
  }
  return set;
}

function render() {
  const s = puz.status();
  $('levelsel').textContent = `第 ${idx + 1} / ${LEVELS.length} 關`;
  $('lvname').textContent = puz.level.name;
  $('teach').textContent = puz.level.teach || '';
  // grid
  const g = $('grid');
  g.style.gridTemplateColumns = `repeat(${s.w}, auto)`;
  const ear = earshot();
  let html = '';
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const key = x + ',' + y;
    const isWall = puz.wall(x, y);
    const objHere = puz.at(x, y);
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
  // laws
  $('laws').innerHTML = puz.laws.map(l => {
    const c = l.note ? 'law note' : l.def ? 'law def' : 'law';
    const tag = l.src === 'speaker' ? '（廣播器喊的：聽到才綁你）' : l.src === 'notice' ? '（寫在公告上：讀了才綁你）' : '';
    return `<div class="${c}">${l.text}<span style="color:var(--faint)">${tag}</span></div>`;
  }).join('');
  // status
  $('status').innerHTML = `你現在是 <span class="pill ${s.citizen ? 'cit' : 'out'}">${s.citizen ? '市　民' : '外鄉人'}</span>　`
    + (puz.goal === 'leave' ? (s.leaveAllowed ? '<span style="color:var(--good)">此刻可離開</span>' : '<span style="color:var(--bad)">此刻不得離開</span>') : '目標：把書弄出荒野');
  $('heard').textContent = s.heard.length ? '已被這些法綁住：' + s.heard.map(id => puz.law(id)?.text || id).join('；') : '';
  const m = $('msg'); m.textContent = s.msg || ''; m.className = /不得|推不動|牆|過不去/.test(s.msg) ? 'bad' : /出去|吃了|馱|領|換上|繞/.test(s.msg) ? 'good' : '';
  if (s.won) showWin();
}

function showWin() {
  $('win-text').textContent = puz.level.hintWin || '你出去了。';
  $('b-wnext').textContent = idx + 1 < LEVELS.length ? '下一關 →' : '🎉 全部過關！再玩一次';
  $('win').style.display = 'flex';
}
function hideWin() { $('win').style.display = 'none'; }

function load(i) { idx = (i + LEVELS.length) % LEVELS.length; puz = new Puzzle(LEVELS[idx]); hideWin(); render(); }

const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
addEventListener('keydown', e => {
  if ($('win').style.display === 'flex') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextLevel(); } return; }
  if (DIRS[e.key]) { e.preventDefault(); puz.move(DIRS[e.key]); render(); }
  else if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') { puz.undo(); render(); }
  else if (e.key === 'r' || e.key === 'R') { puz.reset(); render(); }
});

function nextLevel() { load(idx + 1 < LEVELS.length ? idx + 1 : 0); }
$('b-undo').onclick = () => { puz.undo(); render(); };
$('b-reset').onclick = () => { puz.reset(); render(); };
$('b-prev').onclick = () => load(idx - 1);
$('b-next').onclick = () => load(idx + 1);
$('b-wnext').onclick = nextLevel;

render();

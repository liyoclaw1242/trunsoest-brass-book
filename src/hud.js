// hud.js —— DOM 介面（v2）：兩個時鐘（活性＋階段、同化度）、勞動與規則上限、書寫中、舒適項目、事件、筆記、設計者視角、開始／結局。
import { num } from '../engine/rulebook-engine.js';
import { TIER_CN, CAT_CN, STAGE_CN } from '../engine/rules.v2.js';
import { COMFORT_CN } from '../engine/assimilation.js';
import { ENDINGS } from '../engine/match.js';

const $ = id => document.getElementById(id);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const STAGE = { early: '前期', mid: '中期', late: '後期' };
export class Hud {
  constructor(game) {
    this.game = game;
    this.el = { status: $('status'), prompt: $('prompt'), log: $('log'), notes: $('notes'), broadcast: $('broadcast'), designer: $('designer'), toast: $('toast'), overlay: $('overlay') };
    this.lines = []; this.toastTimer = 0; this.designer = false; this.flash = 0; this.lastGone = [];
    game.on(e => { if (!['broadcast', 'object', 'learn'].includes(e.type)) this.push(e); });
    game.world.on('reset', ({ gone }) => { this.flash = 3; this.lastGone = gone.map(r => r.no); });
    for (const id of ['meters', 'writing', 'resetflash']) { const d = document.createElement('div'); d.id = id; d.hidden = (id !== 'meters'); $('hud').appendChild(d); this.el[id] = d; }
    this.el.resetflash.innerHTML = '<h1>以上規則無效</h1><div class="small"></div>';
  }
  push(e) { this.lines.push(e); if (this.lines.length > 9) this.lines.shift(); this.el.log.innerHTML = this.lines.map(l => `<div class="${l.type}">[${l.t.toFixed(0)}s] ${l.text}</div>`).join(''); }
  toast(text, cls = '', sec = 2.5) { const t = this.el.toast; t.textContent = text; t.className = cls; t.hidden = false; this.toastTimer = sec; }
  labels(items) {
    let box = $('labels'); if (!box) { box = document.createElement('div'); box.id = 'labels'; $('hud').appendChild(box); }
    const have = new Map([...box.children].map(c => [c.dataset.id, c]));
    for (const it of items) { let el = have.get(it.id); if (!el) { el = document.createElement('div'); el.dataset.id = it.id; box.appendChild(el); } else have.delete(it.id); el.className = 'label ' + it.cls; el.textContent = it.text; el.style.transform = `translate(${Math.round(it.xy[0])}px, ${Math.round(it.xy[1])}px) translate(-50%, -100%)`; }
    for (const el of have.values()) el.remove();
  }
  showStart(onStart, seed) {
    const o = this.el.overlay; o.hidden = false; o.className = 'start';
    o.innerHTML = `<h1>規則書</h1><div class="small">你誤入一個烏托邦。這裡有一本靠村民勞動過活的活規則書，它不斷寫下新律法，要把你也變成村民。<br>
    兩個時鐘在走：<b>同化度</b>你管得了（被抓、接受好處會漲，躲到聽不到廣播處會退）；<b>活性</b>停不下來（時間與村民的勞動餵養它，滿了書就活過來）。<br>
    喚醒村民＝讓他們罷工，書會變弱、漲得慢。出路：逃出影響範圍，或封印這本書。<br>
    書寫得多嚴是抽的——前期多半粗糙、留著漏洞；越到後期越嚴謹。<br><br>
    WASD／方向鍵移動　Shift 奔跑　E 互動（數字鍵選其他）　N 筆記　Tab 設計者視角<br>
    <label style="display:block;margin-top:10px">種子：<input id="seed-in" value="${seed}" style="width:140px"></label></div><button id="btn-start">開始</button>`;
    o.querySelector('#btn-start').onclick = () => { const sv = o.querySelector('#seed-in').value.trim(); o.hidden = true; onStart(sv); };
  }
  showEnd(state, reason, st) {
    const o = this.el.overlay; o.hidden = false; o.className = (state === 'transformed') ? 'lost' : 'won';
    const fates = (st.villagers || []).map(v => `${v.id.replace('villager_', '村民')}：${{ stayed: '留下', left: '離開', awake: '喚醒', dead: '死亡' }[v.fate]}`).join('　');
    o.innerHTML = `<h1>${ENDINGS[state] || state}</h1><div class="small">種子 ${this.game.session.rng.seed}　用時 ${mmss(st.time)}　書寫了 ${st.written} 條　重置 ${st.resets} 次　活性最高 ${Math.round(st.peakActivity)}　被抓 ${st.captures} 次</div><div class="small" style="margin-top:12px">${fates}</div><button onclick="location.reload()">再玩一次</button>`;
  }
  toggleDesigner() { this.designer = !this.designer; this.el.designer.hidden = !this.designer; }
  renderMeters(s) {
    const actColor = s.stage === 'late' ? '#f55' : s.stage === 'mid' ? '#fb4' : '#6c6';
    this.el.meters.innerHTML =
      `<div class="meter"><span>活性 ${Math.round(s.activity)} · ${STAGE[s.stage]}</span><div class="bar"><i style="width:${s.activity}%;background:${actColor}"></i>` +
      `<u style="left:35%"></u><u style="left:70%"></u></div></div>` +
      `<div class="meter"><span>同化度 ${s.assim}／${s.assimMax}</span><div class="bar assim"><i style="width:${s.assim / s.assimMax * 100}%"></i></div></div>` +
      `<div class="sub">勞動 ${s.workers} 人供養 · 規則上限 ${s.ruleCap}（現 ${s.rules}）${s.comforts.length ? ' · 舒適：' + s.comforts.map(c => COMFORT_CN[c]).join('、') : ''}</div>`;
  }
  renderNotes() {
    const g = this.game, notes = g.world.notes('outsider'), bc = g.broadcast();
    const known = notes.filter(n => n.known);
    const unknown = notes.filter(n => !n.known && !n.void);
    const line = n => `<div class="rule${n.void ? ' void' : n.dead ? ' dead' : ''}${bc && bc.rule.no === n.no ? ' now' : ''}">第${num(n.no)}條　${n.text}</div>`;
    this.el.notes.innerHTML = `<h3>你的筆記　生效 ${g.world.active().length}／${g.world.opt.max} 條　重置 ${g.world.resets} 次</h3>` +
      (known.length ? known.map(line).join('') : '<div class="rule unknown">（你還沒聽過任何條文）</div>') +
      (unknown.length ? `<div class="rule unknown">另有 ${unknown.length} 條你沒聽過</div>` : '') + `<div class="rule unknown" style="border:0">N 收合　Tab 設計者視角</div>`;
  }
  renderBroadcast() {
    const g = this.game, bc = g.broadcast(), el = this.el.broadcast, night = g.world.isNight(), inB = g.world.inBroadcast(g.player.cell), q = g.quietCell();
    el.hidden = false; el.className = inB && !night ? '' : 'out';
    const where = night ? '夜間廣播器靜音' : inB ? `你在廣播範圍內${q && q.steps ? `，離開約 ${q.steps} 格` : ''}` : '你聽不到廣播';
    if (bc) { const known = g.player.actor.known.has(bc.rule.no); el.innerHTML = `<div>${inB ? `正在唸：第${num(bc.rule.no)}條　${bc.rule.text}` : `廣播中（你聽不到）：第${num(bc.rule.no)}條${known ? '' : '　？？？'}`}</div><div class="bar"><i style="width:${Math.round(bc.progress * 100)}%"></i></div><div style="font-size:12px;color:#caa">${where}</div>`; }
    else el.innerHTML = `<div style="color:#999">廣播器沉默</div><div style="font-size:12px;color:#caa">${where}</div>`;
  }
  renderWriting() {
    const w = this.game.bookWriting();
    this.el.writing.hidden = !w;
    if (w) this.el.writing.innerHTML = `<div>黃銅書提筆中（${w.kind === 'definition' ? '定義' : TIER_CN[w.tier] || '條文'}）</div><div class="bar"><i style="width:${Math.round(w.progress * 100)}%"></i></div>`;
  }
  renderDesigner() {
    if (!this.designer) return;
    const g = this.game, rules = g.designerRules(), s = g.status();
    const short = id => id === 'outsider' ? '外' : id.replace('villager_0', 'v');
    this.el.designer.innerHTML = `<h3>設計者視角　種子 ${s.seed}　活性 ${Math.round(s.activity)}（${STAGE[s.stage]}）　權重 粗/普/嚴 ${g.match.book ? tierStr(s.activity) : ''}</h3>` +
      rules.map(r => `<div class="rule${r.void ? ' void' : ''}${r.dead ? ' dead' : ''}">第${num(r.no)}條 ${r.text} <span style="color:#8ab">[${r.tier ? TIER_CN[r.tier] : '—'}/${r.category ? CAT_CN[r.category] : r.kind || '固定'}${r.stage ? '/' + STAGE_CN[r.stage] : ''}]</span> 認知：${r.knownBy.map(short).join(',') || '無'}${r.hole ? `<div class="hole">漏洞：${r.hole}</div>` : ''}</div>`).join('') +
      `<div style="margin-top:6px">村民：${s.villagers.map(v => `${short(v.id)} ${v.level}${v.hunting ? '追' : v.working ? '工' : ''}${v.dead ? '†' : ''}`).join('　')}　勞動比例 ${s.laborRatio}</div>`;
  }
  update(dt) {
    const g = this.game, s = g.status();
    this.renderMeters(s);
    this.el.status.textContent = `${mmss(s.t)}　${s.phase === 'night' ? '夜' : '日'}　(${s.cell[0]},${s.cell[1]})　${s.house ? s.house : s.zone === 'wild' ? '野地' : s.zone === 'wilddeep' ? '荒野深處' : s.zone === 'plaza' ? '廣場' : '村道'}　${s.inRange ? '範圍內' : '範圍外'}${s.wearing ? '　偽裝中' : ''}${s.carrying ? '　搬著書' : ''}${s.opening > 0 ? `　（聽公告 ${s.opening.toFixed(0)}s）` : ''}`;
    const opts = g.options();
    this.el.prompt.innerHTML = opts.slice(0, 9).map((o, i) => `<span class="${o.ok ? '' : 'blocked'}${o.violates?.length ? ' violates' : ''}"><b>${i === 0 ? 'E' : i + 1}</b>${o.label}${o.violates?.length ? `（違反第${o.violates.map(num).join('、')}條）` : ''}</span>`).join('');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.hidden = true; }
    this.renderNotes(); this.renderBroadcast(); this.renderWriting(); this.renderDesigner();
    if (this.flash > 0) { this.flash -= dt; this.el.resetflash.hidden = false; this.el.resetflash.querySelector('.small').textContent = `撕掉第${this.lastGone.map(num).join('、')}條`; if (this.flash <= 0) this.el.resetflash.hidden = true; }
  }
}
function tierStr(a) { const pts = [[0, [70, 25, 5]], [50, [35, 45, 20]], [100, [10, 35, 55]]]; a = Math.max(0, Math.min(100, a)); for (let i = 0; i < pts.length - 1; i++) { const [x0, w0] = pts[i], [x1, w1] = pts[i + 1]; if (a <= x1) { const t = (a - x0) / (x1 - x0); return w0.map((v, k) => Math.round(v + (w1[k] - v) * t)).join('/'); } } return '10/35/55'; }

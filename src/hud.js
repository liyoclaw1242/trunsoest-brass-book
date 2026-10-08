// hud.js —— DOM 介面（原型三）：狀態列（含時鐘）、互動提示、事件紀錄、筆記、廣播條、設計者面板、重置閃現、開始／結局、村民標籤。
import { num } from '../engine/rulebook-engine.js';

const $ = id => document.getElementById(id);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export class Hud {
  constructor(game) {
    this.game = game;
    this.el = { status: $('status'), prompt: $('prompt'), log: $('log'), notes: $('notes'), broadcast: $('broadcast'), designer: $('designer'), toast: $('toast'), overlay: $('overlay') };
    this.lines = []; this.toastTimer = 0; this.designer = false; this.flash = 0; this.lastGone = []; this.lastGoneNote = '';
    game.on(e => { if (!['broadcast', 'act'].includes(e.type)) this.push(e); });
    game.world.on('reset', ({ gone }) => {
      this.flash = 4; const known = game.player.actor.known;
      this.lastGone = gone.map(r => `<div class="${known.has(r.no) ? '' : 'unknown'}">第${num(r.no)}條　${r.text}${known.has(r.no) ? '' : '　（你沒聽過這條）'}</div>`);
      this.lastGoneNote = `撕掉 ${gone.length} 條，其中 ${gone.filter(r => !known.has(r.no)).length} 條你從沒聽過${gone.some(r => r.key === 'no-leave') ? '。「不得離開此地」被撕掉了——書會重寫，但要重新公示' : ''}`;
    });
    const f = document.createElement('div'); f.id = 'resetflash'; f.hidden = true; f.innerHTML = '<h1>以上規則無效</h1><div class="small"></div><div class="list"></div>'; $('hud').appendChild(f);
    this.el.flash = f;
  }
  push(e) { this.lines.push(e); if (this.lines.length > 9) this.lines.shift(); this.el.log.innerHTML = this.lines.map(l => `<div class="${l.type}">[${l.t.toFixed(0)}s] ${l.text}</div>`).join(''); }
  toast(text, cls = '', sec = 2) { const t = this.el.toast; t.textContent = text; t.className = cls; t.hidden = false; this.toastTimer = sec; }
  labels(items) {
    let box = $('labels');
    if (!box) { box = document.createElement('div'); box.id = 'labels'; $('hud').appendChild(box); }
    const have = new Map([...box.children].map(c => [c.dataset.id, c]));
    for (const it of items) {
      let el = have.get(it.id);
      if (!el) { el = document.createElement('div'); el.dataset.id = it.id; box.appendChild(el); } else have.delete(it.id);
      el.className = 'label ' + it.cls; el.textContent = it.text;
      el.style.transform = `translate(${Math.round(it.xy[0])}px, ${Math.round(it.xy[1])}px) translate(-50%, -100%)`;
    }
    for (const el of have.values()) el.remove();
  }
  showStart(onStart) {
    const o = this.el.overlay; o.hidden = false; o.className = 'start';
    o.innerHTML = `<h1>規則書</h1><div class="small">你誤入了一個烏托邦。這裡有一本會自己寫律法的黃銅書，它針對你的行為不斷寫下新規則。<br>
    第一條就是：<b>任何存在不得離開此地</b>——走出邊界會被送回中心。<br>
    規則要被公示、而且聽完整條，才管得到人。村民只在<b>看見</b>你違規時才會追你。<br>
    書寫滿十條會撕掉最舊的一半——「不得離開」也會被撕掉，書重寫並重新公示之前，就是你的出口。<br>
    白天夜晚各五分鐘輪替：夜裡廣播器靜音、村民回家、守夜的人偶提燈巡邏。穿上市民的衣物可以混過去，但那也是違規。<br><br>
    WASD／方向鍵移動　Shift 奔跑　E 互動（數字鍵選其他動作）　N 收合筆記　Tab 設計者視角</div><button id="btn-start">開始</button>`;
    o.querySelector('#btn-start').onclick = () => { o.hidden = true; onStart(); };
  }
  showEnd(state, reason, st) {
    const o = this.el.overlay; o.hidden = false; o.className = state;
    const title = state === 'won' ? '你離開了' : reason === 'assimilated' ? '你成了市民' : '書活過來了';
    const sub = state === 'won' ? (reason === 'escaped-unheard' ? '書重寫了「不得離開」，但還沒來得及公告給你。' : '「不得離開」被撕掉的那一刻，你走了出去。') : reason === 'assimilated' ? '同化度到了 3。你再也不想離開這裡。' : '第三次重置。書已經不需要你了。';
    o.innerHTML = `<h1>${title}</h1><div class="small">${sub}</div><div class="small" style="margin-top:16px">用時 ${mmss(st.time)}　書寫了 ${st.written} 條（其中 ${st.idleWrites} 條是它閒著寫的）　重置 ${st.resets} 次　喚醒了 ${st.awakened} 個村民　被抓 ${st.captures} 次　被送回 ${st.teleports || 0} 次</div><button onclick="location.reload()">再玩一次</button>`;
  }
  toggleDesigner() { this.designer = !this.designer; this.el.designer.hidden = !this.designer; }
  renderNotes() {
    const g = this.game, notes = g.world.notes('outsider'), bc = g.broadcast();
    const known = notes.filter(n => n.known), unknown = notes.filter(n => !n.known && !n.void);
    const line = n => `<div class="rule${n.void ? ' void' : n.dead ? ' dead' : ''}${bc && bc.rule.no === n.no ? ' now' : ''}">第${num(n.no)}條　${n.text}</div>`;
    this.el.notes.innerHTML = `<h3>你的筆記　生效 ${g.world.active().length}／${g.world.opt.max} 條　重置 ${g.world.resets} 次</h3>` +
      (known.length ? known.map(line).join('') : '<div class="rule unknown">（你還沒聽過任何條文）</div>') +
      (unknown.length ? `<div class="rule unknown">另有 ${unknown.length} 條你沒聽過</div>` : '') +
      `<div class="rule unknown" style="border:0">N 收合筆記　Tab 設計者視角</div>`;
  }
  renderBroadcast() {
    const g = this.game, bc = g.broadcast(), el = this.el.broadcast, q = g.quietCell(), night = g.world.isNight();
    const inB = g.world.inBroadcast(g.player.cell);
    el.hidden = false; el.className = inB && !night ? '' : 'out';
    const where = night ? '夜間廣播器靜音' : inB ? `你在廣播範圍內${q && q.steps ? `，離開範圍約 ${q.steps} 格` : ''}` : '你聽不到廣播';
    if (bc) {
      const known = g.player.actor.known.has(bc.rule.no);
      const text = inB ? `正在唸：第${num(bc.rule.no)}條　${bc.rule.text}${bc.hearing ? '' : '（你中途才進來，這次不算）'}` : `廣播中（你聽不到）：第${num(bc.rule.no)}條${known ? '' : '　？？？'}`;
      el.innerHTML = `<div>${text}</div><div class="bar"><i style="width:${Math.round(bc.progress * 100)}%"></i></div><div style="font-size:12px;color:#caa">${where}</div>`;
    } else el.innerHTML = `<div style="color:#999">${night ? '廣播器沉默（夜間）' + (g.world.queue.length ? `，${g.world.queue.length} 條等天亮` : '') : '廣播器沉默中'}</div><div style="font-size:12px;color:#caa">${where}</div>`;
  }
  renderDesigner() {
    if (!this.designer) return;
    const g = this.game, rules = g.designerRules(), bc = g.broadcast();
    const short = id => id === 'outsider' ? '外' : id.replace('villager_0', 'v');
    this.el.designer.innerHTML = `<h3>設計者視角　t=${g.t.toFixed(0)}s　${g.world.phase() === 'night' ? '夜' : '日'}　觸發計數：${Object.entries(g.world.counts).map(([k, v]) => `${k}=${v}`).join(' ') || '無'}</h3>` +
      rules.map(r => `<div class="rule${r.void ? ' void' : ''}${r.dead ? ' dead' : ''}">第${num(r.no)}條 ${r.text} <span style="color:#8ab">[${r.who}/${r.verb || '敘事'}/${r.mode}${r.cond ? '/' + r.cond : ''}]</span> 認知：${r.knownBy.map(short).join(',') || '無'}${r.hole ? `<div class="hole">漏洞：${r.hole}</div>` : ''}</div>`).join('') +
      `<div style="margin-top:6px">廣播：${bc ? `第${num(bc.rule.no)}條 ${Math.round(bc.progress * 100)}%，聽眾 ${[...g.world.now.listeners].map(short).join(',') || '無'}` : '無'}；佇列 ${g.world.queue.length}</div>` +
      `<div>村民：${g.villagers.map(v => `${short(v.id)}@(${v.pos}) ${v.level}${v.sleeping ? ' 睡' : ''}${v.lit ? ' 燈' : ''}${g.vil.hunts(v) ? ' 追' : ''}${g.vil.seesOutsider(v) ? ' 見' : ''}`).join('　')}</div>`;
  }
  update(dt) {
    const g = this.game, s = g.status();
    const nl = s.noLeave === 'binding' ? '「不得離開」生效' : s.noLeave === 'unheard' ? '「不得離開」重寫了、你還沒聽到——現在走得出去' : '「不得離開」被撕掉了——現在走得出去';
    this.el.status.textContent = `${mmss(s.t)}  ${s.phase === 'night' ? '夜晚' : '白天'}（還有 ${mmss(s.untilPhase)}）  位置 (${s.cell[0]}, ${s.cell[1]})${s.house ? `  在${s.house}內` : s.zone === 'wild' ? '  野地' : '  村道'}\n${s.phase === 'night' ? '廣播靜音' : s.inBroadcast ? '聽得到廣播' : '聽不到廣播'}  ${s.inRange ? '影響範圍內' : '影響範圍外'}  ${nl}\n生效 ${s.rules}/${s.max} 條  重置 ${s.resets}/3 次  同化度 ${'■'.repeat(s.assim)}${'□'.repeat(s.assimMax - s.assim)}${s.held.length ? `\n身上：${s.held.join('、')}${s.wearing ? '（穿著市民衣物）' : ''}${s.lit ? '（提燈亮著）' : ''}` : ''}${s.carrying ? '\n搬著黃銅書' : ''}${s.opening > 0 ? `\n（聽公告中 ${s.opening.toFixed(0)} 秒）` : ''}`;
    const opts = g.options();
    this.el.prompt.innerHTML = opts.slice(0, 9).map((o, i) => `<span class="${o.ok ? '' : 'blocked'}${o.violates?.length ? ' violates' : ''}"><b>${i === 0 ? 'E' : i + 1}</b>${o.label}${o.violates?.length ? `（違反第${o.violates.map(num).join('、')}條）` : ''}</span>`).join('');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.hidden = true; }
    this.renderNotes(); this.renderBroadcast(); this.renderDesigner();
    if (this.flash > 0) { this.flash -= dt; this.el.flash.hidden = false; this.el.flash.querySelector('.small').textContent = this.lastGoneNote; this.el.flash.querySelector('.list').innerHTML = this.lastGone.join(''); if (this.flash <= 0) this.el.flash.hidden = true; }
  }
}

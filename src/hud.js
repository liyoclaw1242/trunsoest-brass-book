// hud.js —— DOM 介面：狀態列、互動提示、事件紀錄、筆記面板（M3 擴充）。
import { num } from '../engine/rulebook-engine.js';

const $ = id => document.getElementById(id);
export class Hud {
  constructor(game) {
    this.game = game;
    this.el = { status: $('status'), prompt: $('prompt'), log: $('log'), notes: $('notes'), broadcast: $('broadcast'), designer: $('designer'), toast: $('toast'), overlay: $('overlay') };
    this.lines = [];
    game.on(e => { if (e.type !== 'broadcast' && e.type !== 'act') this.push(e); });
    this.toastTimer = 0;
    this.designer = false;
    this.flash = 0;
    this.lastGone = [];
    game.world.on('reset', ({ gone }) => { this.flash = 2.5; this.lastGone = gone.map(r => r.no); });
    const f = document.createElement('div'); f.id = 'resetflash'; f.hidden = true; f.innerHTML = '<h1>以上規則無效</h1><div class="small"></div>'; document.getElementById('hud').appendChild(f);
    this.el.flash = f;
  }
  toggleDesigner() { this.designer = !this.designer; this.el.designer.hidden = !this.designer; }
  renderNotes() {
    const g = this.game, notes = g.world.notes('outsider'), bc = g.broadcast();
    const known = notes.filter(n => n.known), unknown = notes.filter(n => !n.known && !n.void);
    const live = n => !n.void && !n.dead;
    const line = n => `<div class="rule${n.void ? ' void' : n.dead ? ' dead' : ''}${bc && bc.rule.no === n.no ? ' now' : ''}">第${num(n.no)}條　${n.text}</div>`;
    this.el.notes.innerHTML = `<h3>你的筆記　生效 ${g.world.active().length}／${g.world.opt.max} 條　重置 ${g.world.resets} 次</h3>` +
      (known.length ? known.map(line).join('') : '<div class="rule unknown">（你還沒聽過任何條文）</div>') +
      (unknown.length ? `<div class="rule unknown">另有 ${unknown.length} 條你沒聽過</div>` : '') +
      `<div class="rule unknown" style="border:0">N 收合筆記　Tab 設計者視角</div>`;
  }
  renderBroadcast() {
    const g = this.game, bc = g.broadcast(), el = this.el.broadcast, q = g.quietCell();
    const inB = g.world.inBroadcast(g.player.cell);
    el.hidden = false;
    el.className = inB ? '' : 'out';
    const where = inB ? `你在廣播範圍內${q && q.steps ? `，離開範圍約 ${q.steps} 格` : ''}` : '你聽不到廣播';
    if (bc) {
      const known = g.player.actor.known.has(bc.rule.no);
      const text = inB ? `正在唸：第${num(bc.rule.no)}條　${bc.rule.text}${bc.hearing ? '' : '（你中途才進來，這次不算）'}` : `廣播中（你聽不到）：第${num(bc.rule.no)}條${known ? '' : '　？？？'}`;
      el.innerHTML = `<div>${text}</div><div class="bar"><i style="width:${Math.round(bc.progress * 100)}%"></i></div><div style="font-size:12px;color:#caa">${where}</div>`;
    } else el.innerHTML = `<div style="color:#999">廣播器沉默中</div><div style="font-size:12px;color:#caa">${where}</div>`;
  }
  renderDesigner() {
    if (!this.designer) return;
    const g = this.game, rules = g.designerRules(), bc = g.broadcast();
    const act = [...g.world.actors.values()];
    const short = id => id === 'outsider' ? '外' : id.replace('villager_0', 'v');
    this.el.designer.innerHTML = `<h3>設計者視角　t=${g.t.toFixed(0)}s　觸發計數：${Object.entries(g.world.counts).map(([k, v]) => `${k}=${v}`).join(' ') || '無'}</h3>` +
      rules.map(r => `<div class="rule${r.void ? ' void' : ''}${r.dead ? ' dead' : ''}">第${num(r.no)}條 ${r.text} <span style="color:#8ab">[${r.who}/${r.verb || '敘事'}/${r.mode}]</span> 認知：${r.knownBy.map(short).join(',') || '無'}${r.hole ? `<div class="hole">漏洞：${r.hole}</div>` : ''}</div>`).join('') +
      `<div style="margin-top:6px">廣播：${bc ? `第${num(bc.rule.no)}條 ${Math.round(bc.progress * 100)}%，聽眾 ${[...g.world.now.listeners].map(short).join(',') || '無'}` : '無'}；佇列 ${g.world.queue.length}</div>` +
      `<div>角色：${act.map(a => `${short(a.id)}@(${a.pos})${a.level ? ' ' + a.level : ''}${a.level && a.chasing ? ' 追' : ''}`).join('　')}</div>`;
  }
  push(e) { this.lines.push(e); if (this.lines.length > 9) this.lines.shift(); this.el.log.innerHTML = this.lines.map(l => `<div class="${l.type}">[${l.t.toFixed(0)}s] ${l.text}</div>`).join(''); }
  toast(text, cls = '', sec = 2) { const t = this.el.toast; t.textContent = text; t.className = cls; t.hidden = false; this.toastTimer = sec; }
  update(dt) {
    const g = this.game, s = g.status();
    this.el.status.textContent = `位置 (${s.cell[0]}, ${s.cell[1]})${s.house ? `  在${s.house}內` : ''}\n${s.inBroadcast ? '聽得到廣播' : '聽不到廣播'}  ${s.inRange ? '影響範圍內' : '影響範圍外'}\n生效 ${s.rules}/${s.max} 條  重置 ${s.resets} 次${s.held.length ? `\n身上：${s.held.join('、')}` : ''}${s.carrying ? '\n搬著黃銅書' : ''}`;
    const opts = g.options();
    this.el.prompt.innerHTML = opts.slice(0, 9).map((o, i) => `<span class="${o.ok ? '' : 'blocked'}${o.violates?.length ? ' violates' : ''}"><b>${i === 0 ? 'E' : i + 1}</b>${o.label}${o.violates?.length ? `（違反第${o.violates.map(num).join('、')}條）` : ''}</span>`).join('');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.hidden = true; }
    this.renderNotes(); this.renderBroadcast(); this.renderDesigner();
    if (this.flash > 0) { this.flash -= dt; this.el.flash.hidden = false; this.el.flash.querySelector('.small').textContent = `撕掉第${this.lastGone.map(num).join('、')}條`; if (this.flash <= 0) this.el.flash.hidden = true; }
  }
}

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
  }
  push(e) { this.lines.push(e); if (this.lines.length > 9) this.lines.shift(); this.el.log.innerHTML = this.lines.map(l => `<div class="${l.type}">[${l.t.toFixed(0)}s] ${l.text}</div>`).join(''); }
  toast(text, cls = '', sec = 2) { const t = this.el.toast; t.textContent = text; t.className = cls; t.hidden = false; this.toastTimer = sec; }
  update(dt) {
    const g = this.game, s = g.status();
    this.el.status.textContent = `位置 (${s.cell[0]}, ${s.cell[1]})${s.house ? `  在${s.house}內` : ''}\n${s.inBroadcast ? '聽得到廣播' : '聽不到廣播'}  ${s.inRange ? '影響範圍內' : '影響範圍外'}\n生效 ${s.rules}/${s.max} 條  重置 ${s.resets} 次${s.held.length ? `\n身上：${s.held.join('、')}` : ''}${s.carrying ? '\n搬著黃銅書' : ''}`;
    const opts = g.options();
    this.el.prompt.innerHTML = opts.slice(0, 9).map((o, i) => `<span class="${o.ok ? '' : 'blocked'}${o.violates?.length ? ' violates' : ''}"><b>${i === 0 ? 'E' : i + 1}</b>${o.label}${o.violates?.length ? `（違反第${o.violates.map(num).join('、')}條）` : ''}</span>`).join('');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.hidden = true; }
  }
}

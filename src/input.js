// input.js —— 鍵盤：WASD／方向鍵移動、Shift 奔跑、E 互動、數字鍵選動詞、Tab 設計者視角、N 筆記。
export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = [];
    target.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.push(e.code);
      if (['Tab', 'Space'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
    });
    target.addEventListener('keyup', e => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }
  dir() {
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) return [0, 1];
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) return [0, -1];
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) return [-1, 0];
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) return [1, 0];
    return null;
  }
  running() { return this.down.has('ShiftLeft') || this.down.has('ShiftRight'); }
  take() { const p = this.pressed; this.pressed = []; return p; }
  press(code) { this.pressed.push(code); }
  hold(code, on = true) { if (on) this.down.add(code); else this.down.delete(code); }
}

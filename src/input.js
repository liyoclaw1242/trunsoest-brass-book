// input.js —— 鍵盤：WASD／方向鍵移動、E 互動、數字鍵選動詞、Tab 設計者視角、N 筆記。
export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = [];           // 這一幀新按下的鍵
    target.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.push(e.code);
      if (['Tab', 'Space'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
    });
    target.addEventListener('keyup', e => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }
  /** 目前按住的方向，[dx, dy]（格子座標，y 向北為正）或 null。 */
  dir() {
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) return [0, 1];
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) return [0, -1];
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) return [-1, 0];
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) return [1, 0];
    return null;
  }
  /** 取出這一幀新按下的鍵並清空。 */
  take() { const p = this.pressed; this.pressed = []; return p; }
  /** 給自動試玩用：模擬按鍵。 */
  press(code) { this.pressed.push(code); }
  hold(code, on = true) { if (on) this.down.add(code); else this.down.delete(code); }
}

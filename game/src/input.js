// input.js — Status keyboard + pemetaan aksi. Satu sumber kebenaran input;
// autopilot memanggil API yang sama (simulate) sehingga jalur kodenya identik.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-trigger: dikonsumsi sekali per frame
    this.onFirstGesture = null;
    this._bound = false;
  }

  attach() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  // Dipanggil autopilot / tombol layar: menekan tombol seolah dari keyboard.
  simulate(code) { this.pressed.add(code); this.keys.add(code); }
  release(code) { this.keys.delete(code); }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }

  // Vektor gerak dari WASD / panah, dinormalisasi.
  moveVector() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z };
  }

  get sneak() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
}

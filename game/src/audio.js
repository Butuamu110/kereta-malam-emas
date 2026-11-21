// audio.js — Suara synth WebAudio sendiri, tanpa file eksternal.
// Langkah, ambil peti, sting alarm, koin, deru terowongan, ambient kereta.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
    this.stepTimer = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this._startAmbient();
    } catch (e) { /* audio opsional — game tetap jalan tanpa suara */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _startAmbient() {
    // Deru kereta: noise cokelat pelan + dengung rendah, loop.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 2.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320;
    const g = this.ctx.createGain(); g.gain.value = 0.10;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 55;
    const og = this.ctx.createGain(); og.gain.value = 0.05;
    osc.connect(og); og.connect(this.master);
    osc.start();
    this.ambientNodes = { noiseGain: g };
  }

  // Deru terowongan: naikkan noise saat gelap.
  setTunnel(on) {
    if (this.ambientNodes) {
      this.ambientNodes.noiseGain.gain.setTargetAtTime(on ? 0.22 : 0.10, this.ctx.currentTime, 0.4);
    }
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  step(sneaking) {
    if (!this.ctx) return;
    // Langkah: ketukan pendek, lebih pelan saat menyelinap.
    this._blip(90, 0.07, 'triangle', sneaking ? 0.05 : 0.12, 60);
  }

  pickup() { this._blip(523, 0.12, 'sine', 0.25); setTimeout(() => this._blip(784, 0.18, 'sine', 0.25), 90); setTimeout(() => this._blip(1046, 0.22, 'sine', 0.22), 180); }
  coin() { this._blip(1567, 0.1, 'square', 0.10, 1200); }
  door() { this._blip(180, 0.25, 'sawtooth', 0.08, 320); }
  alert() { this._blip(440, 0.3, 'sawtooth', 0.22, 880); setTimeout(() => this._blip(440, 0.3, 'sawtooth', 0.22, 880), 160); }
  caught() { this._blip(220, 0.6, 'sawtooth', 0.25, 55); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.25, 'sine', 0.22), i * 130)); }
}

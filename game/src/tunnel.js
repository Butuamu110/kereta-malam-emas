// tunnel.js — Mekanik khas: kereta bergoyang + terowongan berkala.
// Siklus 22 detik: 17 detik terang, 5 detik gelap total. Saat gelap semua cone
// padam dan meter deteksi membeku (tidak naik) — jendela bergerak bebas.
// Goyangan: kamera sway halus + barang (koper) bergeser pelan; visual saja.
import { TUNNEL } from './config.js';

export class Tunnel {
  constructor() {
    this.t = 0;          // waktu game sejak mulai (detik)
    this.dark = false;   // sedang di terowongan?
    this.darkT = 0;      // sudah berapa lama gelap
    this.justEntered = false;
    this.justExited = false;
  }

  update(dt) {
    this.justEntered = false;
    this.justExited = false;
    this.t += dt;
    const phase = this.t % TUNNEL.period;
    const nowDark = phase >= TUNNEL.period - TUNNEL.dark;
    if (nowDark && !this.dark) { this.justEntered = true; this.darkT = 0; }
    if (!nowDark && this.dark) this.justExited = true;
    this.dark = nowDark;
    if (this.dark) this.darkT += dt;
  }

  // Detik sampai terowongan berikutnya (untuk HUD).
  secondsToTunnel() {
    const phase = this.t % TUNNEL.period;
    if (this.dark) return 0;
    return TUNNEL.period - TUNNEL.dark - phase;
  }

  // Goyangan kereta: offset kamera (x lateral, roll) sebagai fungsi waktu.
  sway() {
    return {
      lateral: Math.sin(this.t * 0.45) * 0.28,
      roll: Math.sin(this.t * 0.6) * 0.014,
      bob: Math.sin(this.t * 1.7) * 0.05,
    };
  }

  // Kegelapan 0..1 untuk overlay layar (naik cepat di awal terowongan).
  darkness() {
    if (!this.dark) return 0;
    return Math.min(1, this.darkT * 2.5);
  }
}

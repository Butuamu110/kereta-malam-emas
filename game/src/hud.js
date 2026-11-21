// hud.js — HUD DOM + minimap kanvas 2D.
// Elemen statis tinggal di index.html; modul ini hanya memperbarui isinya.
import { fmtTime } from './config.js';

const STATE_LABEL = {
  patrol: 'patroli', suspicious: 'curiga ?', alert: 'MENGEJAR !',
  search: 'mencari ?', investigate: 'memeriksa ?',
};
const STATE_CLASS = { patrol: 'st-patrol', suspicious: 'st-susp', alert: 'st-alert', search: 'st-susp', investigate: 'st-susp' };

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['hud-items', 'hud-time', 'hud-coins', 'hud-detect', 'hud-detect-label',
      'hud-guards', 'hud-banner', 'hud-tunnel', 'hud-prompt', 'hud-controls',
      'title-screen', 'win-screen', 'lose-screen', 'win-stats', 'win-grade',
      'lose-stats', 'minimap', 'tunnel-overlay', 'btn-start', 'btn-again', 'btn-retry']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el['minimap'].getContext('2d');
    this.bannerTimer = 0;
    this.bannerText = '';
  }

  showBanner(text, seconds = 3) {
    this.bannerText = text;
    this.bannerTimer = seconds;
    this.el['hud-banner'].textContent = text;
    this.el['hud-banner'].style.display = 'block';
  }

  update(dt, game) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.el['hud-banner'].style.display = 'none';
        this.bannerText = '';
      }
    }
    const taken = game.level.chests.filter((c) => c.taken).length;
    const names = game.level.chests.map((c) => (c.taken ? '✓ ' + c.name : '○ ' + c.name)).join(' · ');
    this.el['hud-items'].textContent = `◆ ${taken}/3 Peti — ${names}`;
    this.el['hud-time'].textContent = fmtTime(game.time);
    this.el['hud-coins'].textContent = `◉ Koin: ${game.coinsLeft}`;
    const pct = Math.round(game.meter * 100);
    this.el['hud-detect'].style.width = pct + '%';
    this.el['hud-detect'].style.background = game.meter >= 1 ? '#ff2a2a' : game.meter >= 0.35 ? '#ff8c1a' : '#39ff88';
    this.el['hud-detect-label'].textContent = game.meter >= 1 ? 'TERLIHAT!' : game.meter >= 0.35 ? 'CURIGA…' : game.meter > 0.05 ? 'terdengar…' : 'tersembunyi';
    this.el['hud-detect-label'].style.color = game.meter >= 1 ? '#ff6b6b' : game.meter >= 0.35 ? '#ffb347' : '#cfe8d8';
    this.el['hud-guards'].innerHTML = game.guardManager.statusList().map((g) =>
      `<span class="${STATE_CLASS[g.state]}">${g.name} ${g.state === 'patrol' ? '○' : g.state === 'alert' ? '!' : '?'}</span>`).join(' · ');
    this.el['hud-tunnel'].textContent = game.tunnel.dark
      ? '◉ TEROWONGAN — gelap! Cone padam, bergerak bebas!'
      : `Terowongan dalam ${Math.ceil(game.tunnel.secondsToTunnel())} dtk`;
    this.el['hud-tunnel'].style.color = game.tunnel.dark ? '#8fd0ff' : '#cfe8d8';
    this.el['hud-prompt'].textContent = game.prompt || '';
    this.el['hud-prompt'].style.display = game.prompt ? 'block' : 'none';
    // Overlay kegelapan terowongan.
    this.el['tunnel-overlay'].style.opacity = String(game.tunnel.darkness() * 0.62);
    this._drawMinimap(game);
  }

  _drawMinimap(game) {
    const ctx = this.mm, W = 200, H = 130;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,16,38,0.92)';
    ctx.fillRect(0, 0, W, H);
    const sx = (x) => ((x + 16) / 32) * (W - 8) + 4;
    const sz = (z) => ((z + 5) / 10) * (H - 8) + 4;
    // Lantai + sekat.
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(sx(-16), sz(-5), sx(16) - sx(-16), sz(5) - sz(-5));
    ctx.fillStyle = '#7a1020';
    ctx.fillRect(sx(-16), sz(-1.5), sx(16) - sx(-16), sz(1.5) - sz(-1.5));
    ctx.fillStyle = '#c9a227';
    for (const dx of [-5.5, 5.5]) {
      ctx.fillRect(sx(dx) - 1, sz(-5), 2, sz(-1.1) - sz(-5));
      ctx.fillRect(sx(dx) - 1, sz(1.1), 2, sz(5) - sz(1.1));
    }
    // Cover.
    ctx.fillStyle = '#9e1b32';
    for (const c of game.level.covers) {
      ctx.fillRect(sx(c.x0), sz(c.z0), sx(c.x1) - sx(c.x0), sz(c.z1) - sz(c.z0));
    }
    // Peti (emas = belum, abu = sudah).
    for (const c of game.level.chests) {
      ctx.fillStyle = c.taken ? '#5a5a5a' : '#ffd34d';
      ctx.beginPath(); ctx.arc(sx(c.x), sz(c.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // EXIT hijau.
    ctx.fillStyle = '#2eff8f';
    ctx.fillRect(sx(15.2), sz(-1) - 2, 5, 5);
    // Cone penjaga (segitiga arah hadap).
    for (const g of game.guardManager.guards) {
      const col = g.state === 'alert' ? '#ff2a2a' : g.state === 'patrol' ? '#ffd34d' : '#ff8c1a';
      ctx.fillStyle = col;
      const gx = sx(g.pos.x), gz = sz(g.pos.z);
      const a = Math.atan2(Math.sin(g.facing) * (H / 10), Math.cos(g.facing) * (W / 32));
      ctx.beginPath();
      ctx.moveTo(gx, gz);
      ctx.arc(gx, gz, 9, a - 0.56, a + 0.56);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(gx, gz, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Pemain: titik hijau + cincin putih.
    ctx.fillStyle = '#39ff88';
    ctx.beginPath(); ctx.arc(sx(game.player.pos.x), sz(game.player.pos.z), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx(game.player.pos.x), sz(game.player.pos.z), 5.5, 0, Math.PI * 2); ctx.stroke();
  }

  showTitle() {
    document.body.classList.add('screen-on');
    this.el['title-screen'].style.display = 'flex';
    this.el['win-screen'].style.display = 'none';
    this.el['lose-screen'].style.display = 'none';
  }
  showWin(grade, timeSec, spotted, coinsLeft) {
    document.body.classList.add('screen-on');
    this.el['title-screen'].style.display = 'none';
    this.el['lose-screen'].style.display = 'none';
    this.el['win-screen'].style.display = 'flex';
    this.el['win-grade'].textContent = 'GRADE ' + grade;
    this.el['win-stats'].textContent =
      `Waktu ${fmtTime(timeSec)} · Ketahuan ${spotted}x · Peti 3/3 · Koin tersisa ${coinsLeft || 0}`;
  }
  showLose(reason, timeSec, taken) {
    document.body.classList.add('screen-on');
    this.el['title-screen'].style.display = 'none';
    this.el['win-screen'].style.display = 'none';
    this.el['lose-screen'].style.display = 'flex';
    this.el['lose-stats'].textContent = `${reason} — Waktu ${fmtTime(timeSec)} · Peti ${taken}/3`;
  }
  hideScreens() {
    document.body.classList.remove('screen-on');
    this.el['title-screen'].style.display = 'none';
    this.el['win-screen'].style.display = 'none';
    this.el['lose-screen'].style.display = 'none';
  }
}

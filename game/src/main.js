// main.js — Game: state machine (title/play/win/lose), loop utama,
// meter deteksi, interaksi E/Q, terowongan, kamera goyang, mode ?shot=.
import * as THREE from 'three';
import { buildLevel } from './level.js';
import { World } from './world.js';
import { Player } from './player.js';
import { GuardManager } from './guards.js';
import { Tunnel } from './tunnel.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { DETECTION, GUARD_DEFS, PLAYER, COINS_START, gradeFor } from './config.js';
import { runShotMode } from './shots.js';

export class Game {
  constructor() {
    this.state = 'title'; // title | play | win | lose
    this.time = 0;
    this.meter = 0;
    this.spotted = 0;
    this.coinsLeft = COINS_START;
    this.grade = null;
    this.prompt = '';
    this.alarmed = false; // satu episode alarm = +1 ketahuan
    this.pageErrors = [];
    this.shotMode = null;
    this.autopilot = null;

    window.addEventListener('error', (e) => this.pageErrors.push(String(e.message || e.error)));

    this.input = new Input();
    this.input.attach();
    this.input.onFirstGesture = () => this.audio.init();
    this.audio = new AudioEngine();
    this.tunnel = new Tunnel();

    // Renderer + scene + kamera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);

    this.level = buildLevel();
    this.world = new World(this.scene, this.level);
    this.player = new Player(this.scene);
    this.guardManager = new GuardManager(GUARD_DEFS, this.scene);
    this.hud = new Hud();

    this._bindButtons();
    this.hud.showTitle();
    this._applyTitleCamera();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _bindButtons() {
    this.hud.el['btn-start'].addEventListener('click', () => { this.audio.init(); this.startGame(); });
    this.hud.el['btn-again'].addEventListener('click', () => this.startGame());
    this.hud.el['btn-retry'].addEventListener('click', () => this.startGame());
  }

  setState(s) { this.state = s; }

  startGame() {
    // Reset penuh ke state segar (tanpa rebuild mesh).
    this.level = buildLevel();
    this.world.level = this.level;
    for (const chest of this.level.chests) { /* mesh dipulihkan di bawah */ }
    for (const [id, c] of this.world.chestMeshes) { c.group.visible = true; c.light.intensity = 6; }
    for (const d of this.level.doors) this.world.setDoorOpen(d, false);
    this.player.pos = { x: -15, z: 0 };
    this.player.facing = 0;
    this.player._syncMesh();
    for (const c of this.player.coins) this.scene.remove(c.mesh);
    this.player.coins = [];
    // Hapus grup penjaga lama dari scene sebelum membuat yang baru.
    for (const g of this.guardManager.guards) this.scene.remove(g.group);
    this.guardManager = new GuardManager(GUARD_DEFS, this.scene);
    this.time = 0; this.meter = 0; this.spotted = 0;
    this.coinsLeft = COINS_START; this.grade = null; this.prompt = '';
    this.alarmed = false;
    this.tunnel = new Tunnel();
    this.state = 'play';
    this.hud.hideScreens();
    this.hud.showBanner('Curi 3 peti emas, lalu kabur lewat pintu EXIT di kabin masinis!', 4);
  }

  nearestHidingSpot(x, z) {
    let best = this.level.hidingSpots[0], bd = Infinity;
    for (const s of this.level.hidingSpots) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Satu langkah simulasi (dt detik). Dipakai loop rAF & autopilot.
  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt;
    this.tunnel.update(dt);
    if (this.tunnel.justEntered) { this.audio.setTunnel(true); this.hud.showBanner('◉ TEROWONGAN — gelap total! Cone padam, bergerak bebas!', 3); }
    if (this.tunnel.justExited) { this.audio.setTunnel(false); this.hud.showBanner('Kereta keluar terowongan — lampu menyala lagi!', 2); }

    // --- Gerak pemain.
    const mv = this.input.moveVector();
    const stepped = this.player.move(mv.x, mv.z, dt, this.level, this.input.sneak);
    if (stepped) this.audio.step(this.input.sneak);

    // --- Pintu: hitung mundur lalu tutup lagi.
    for (const d of this.level.doors) {
      if (d.open) {
        d.timer -= dt;
        if (d.timer <= 0) { d.open = false; this.world.setDoorOpen(d, false); }
      }
    }

    // --- Interaksi E: ambil peti / buka pintu.
    if (this.input.wasPressed('KeyE')) this._interact();

    // --- Q: lempar koin pengalih.
    if (this.input.wasPressed('KeyQ') && this.coinsLeft > 0) {
      this.coinsLeft--;
      const pt = this.player.throwCoin(this.scene);
      const lured = this.guardManager.lure(pt.x, pt.z);
      this.audio.coin();
      this.hud.showBanner(lured ? `${lured.name} mendatangi bunyi koin!` : 'Koin dilempar — tidak ada yang mendengar.', 2);
    }

    // --- M: mute.
    if (this.input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.showBanner(muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)', 1.5);
    }

    // --- Penjaga + deteksi.
    const seers = this.guardManager.update(dt, this.level, this.player.pos, this.tunnel.dark);
    this._updateDetection(dt, seers);

    // --- Tertangkap? Hanya penjaga yang sedang MENGEJAR (!) yang menangkap
    // saat menyentuh pemain — penjaga patroli/curiga hanya menoleh dulu.
    for (const g of this.guardManager.guards) {
      if (g.state === 'alert' &&
        Math.hypot(g.pos.x - this.player.pos.x, g.pos.z - this.player.pos.z) < DETECTION.catchRadius) {
        return this._lose('Tertangkap ' + g.name);
      }
    }

    // --- Prompt kontekstual.
    const nearChest = this.level.chests.find((c) => !c.taken &&
      Math.hypot(c.x - this.player.pos.x, c.z - this.player.pos.z) < PLAYER.pickupRadius + 0.4);
    const nearDoor = this.level.doors.find((d) => !d.open &&
      Math.hypot(d.x - this.player.pos.x, d.z - this.player.pos.z) < 2.2);
    if (nearChest) this.prompt = `Tekan E — ambil ${nearChest.name}`;
    else if (nearDoor) this.prompt = 'Tekan E — buka pintu gerbong';
    else if (this.level.chests.every((c) => c.taken)) this.prompt = 'Semua peti didapat! Lari ke pintu EXIT hijau di ujung kereta!';
    else this.prompt = '';

    // --- Menang: semua peti + capai EXIT.
    if (this.level.chests.every((c) => c.taken) && this.player.pos.x >= PLAYER.exitX) {
      return this._win();
    }

    // --- Dunia: kegelapan terowongan + goyangan.
    this.world.setTunnelDark(this.tunnel.dark, this.tunnel.darkness());
    this._updateCamera(dt);
    this.hud.update(dt, this);
    this.input.endFrame();
  }

  _interact() {
    // Peti dulu (lebih dekat diprioritaskan).
    let best = null, bd = Infinity;
    for (const c of this.level.chests) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - this.player.pos.x, c.z - this.player.pos.z);
      if (d < PLAYER.pickupRadius && d < bd) { bd = d; best = c; }
    }
    if (best) {
      best.taken = true;
      this.world.setChestTaken(best.id);
      this.audio.pickup();
      const n = this.level.chests.filter((c) => c.taken).length;
      this.hud.showBanner(`${best.name} didapat! (${n}/3)`, 2.5);
      return;
    }
    for (const d of this.level.doors) {
      if (!d.open && Math.hypot(d.x - this.player.pos.x, d.z - this.player.pos.z) < 2.2) {
        d.open = true; d.timer = 6;
        this.world.setDoorOpen(d, true);
        this.audio.door();
        this.hud.showBanner('Pintu gerbong terbuka!', 1.5);
        return;
      }
    }
  }

  _updateDetection(dt, seers) {
    if (this.tunnel.dark) {
      // Terowongan: meter membeku lalu turun pelan (kesempatan pulih).
      this.meter = Math.max(0, this.meter - DETECTION.fall * 0.5 * dt);
      return;
    }
    if (seers.length > 0) {
      // Naik: makin dekat makin cepat; menyelinap memperlambat.
      let rate = 0;
      for (const g of seers) {
        const d = Math.hypot(g.pos.x - this.player.pos.x, g.pos.z - this.player.pos.z);
        rate = Math.max(rate, d < 3 ? DETECTION.riseNear : DETECTION.riseFar);
      }
      if (this.input.sneak) rate *= DETECTION.sneakFactor;
      this.meter = Math.min(1, this.meter + rate * dt);
      // Curiga: penjaga patroli yang melihat menoleh ("?").
      if (this.meter >= DETECTION.suspiciousAt) {
        for (const g of seers) {
          if (g.state === 'patrol') { g.state = 'suspicious'; g.stateT = 0; }
        }
      }
      if (this.meter >= DETECTION.alertAt && !this.alarmed) {
        this.alarmed = true;
        this.spotted++;
        this.guardManager.alarmAll(this.player.pos.x, this.player.pos.z);
        this.audio.alert();
        this.hud.showBanner('TERLIHAT! Alarm berbunyi — semua penjaga mengejarmu!', 3);
      }
    } else {
      this.meter = Math.max(0, this.meter - DETECTION.fall * dt);
      if (this.meter < 0.5) this.alarmed = false; // episode selesai, bisa ketahuan lagi
    }
  }

  _win() {
    this.state = 'win';
    this.grade = gradeFor(this.time, this.spotted);
    this.audio.win();
    this.hud.showWin(this.grade, this.time, this.spotted, this.coinsLeft);
  }

  _lose(reason) {
    this.state = 'lose';
    this.audio.caught();
    const taken = this.level.chests.filter((c) => c.taken).length;
    this.hud.showLose(reason, this.time, taken);
  }

  _applyTitleCamera() {
    this.camera.position.set(0, 20, 13);
    this.camera.lookAt(0, 0, 0);
  }

  _updateCamera(dt) {
    const sway = this.tunnel.sway();
    const p = this.player.pos;
    const tx = p.x + sway.lateral;
    const tz = p.z - 0.5;
    // Kamera oblique top-down DEKAT mengikuti pemain — kereta memenuhi frame
    // (tinggi 12 / offset z 6: sudut ~63°, dasar frame jatuh di lantai kereta).
    this.camera.position.set(tx, 12 + sway.bob, p.z + 6);
    this.camera.lookAt(tx, 0, tz);
    this.camera.rotation.z += sway.roll * 0.4;
  }

  render() {
    if (this.state === 'title') this._applyTitleCamera();
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    let last = performance.now();
    const tick = (now) => {
      // Mode ?shot=: beku — render terus tanpa update agar frame WebGL segar.
      if (this.frozen) { this.render(); requestAnimationFrame(tick); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.state === 'title') {
        // Title: kereta hidup — terowongan & goyangan tetap berjalan.
        this.tunnel.update(dt);
        this.world.setTunnelDark(this.tunnel.dark, this.tunnel.darkness());
        this.render();
        this.input.endFrame();
      } else if (this.state === 'play') {
        this.update(dt);
        this.render();
      } else {
        // Win/lose: render diam + HUD tetap diperbarui.
        this.render();
        this.input.endFrame();
      }
      // Restart dari layar akhir.
      if ((this.state === 'win' || this.state === 'lose') &&
        (this.input.wasPressed('KeyR') || this.input.wasPressed('Enter'))) {
        this.startGame();
      }
      if (this.state === 'title' && this.input.wasPressed('Enter')) {
        this.audio.init(); this.startGame();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ---- Bootstrap.
const game = new Game();
window.__game = game;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Mode screenshot: simulasi sinkron deterministik, lalu render TERUS via
  // rAF (tanpa update) agar compositor headless menangkap frame WebGL segar.
  const info = runShotMode(game, shot);
  window.__shotInfo = info;
  console.log('[shot]', JSON.stringify(info));
  if (game.pageErrors.length > 0) {
    document.title = 'SHOT-ERRORS: ' + game.pageErrors.join(' | ');
  }
  game.frozen = true;
  game.loop();
} else {
  game.loop();
}

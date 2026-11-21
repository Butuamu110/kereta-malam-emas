// shots.js — Mode screenshot deterministik (?shot=start|play|climax|end).
// Autopilot memainkan ATURAN ASLI dari state segar: gerak, E ambil peti,
// E buka pintu, sembunyi bila meter naik, lari ke EXIT. Tanpa override
// grade/waktu/statistik — layar akhir adalah hasil permainan sungguhan.
import { NAV_NODES } from './config.js';
import { hasLineOfSight, solidBoxes } from './level.js';

// Node yang WAJIB dikunjungi (peti + EXIT) — tidak boleh dilewati anti-macet.
const MUST_VISIT = new Set([2, 8, 13, 15]);
const CHEST_NODE = { 2: 'mahkota', 8: 'koin', 13: 'permata' };

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.nodeIdx = 0;
    this.hideTarget = null;
    this.detour = null;
    this.detourT = 0;
  }

  reset() {
    this.nodeIdx = 0;
    this.hideTarget = null;
    this.waitUntil = 0;
    this.stuckT = 0;
    this.detour = null;
    this.detourT = 0;
    this.lastPos = { x: this.game.player.pos.x, z: this.game.player.pos.z };
  }

  // Satu langkah autopilot: isi input sintetis, lalu game.update() biasa.
  step(dt) {
    const g = this.game;
    const input = g.input;
    const p = g.player.pos;
    input.keys.clear();
    input.pressed.clear();

    // 1) Ambil peti / buka pintu bila dekat (tombol E yang sama dengan pemain).
    const nearChest = g.level.chests.find((c) => !c.taken &&
      Math.hypot(c.x - p.x, c.z - p.z) < 1.35);
    const nearDoor = g.level.doors.find((d) => !d.open &&
      Math.hypot(d.x - p.x, d.z - p.z) < 2.0);
    if (nearChest || nearDoor) input.simulate('KeyE');

    // 2) Bahaya? Lari ke titik sembunyi AMAN terdekat (tak terlihat penjaga
    // mana pun) sampai meter reda dan semua penjaga kembali patroli.
    const danger = g.meter > 0.2 || g.guardManager.anyNonPatrol();
    if (danger && !g.tunnel.dark) {
      if (!this.hideTarget || !this._spotSafe(this.hideTarget)) {
        this.hideTarget = this._nearestSafeSpot(p.x, p.z);
      }
      if (this.hideTarget) this._moveTo(this.hideTarget.x, this.hideTarget.z, dt, input);
      // Tanpa titik aman: diam di tempat — lebih aman daripada lari buta.
      if (g.meter < 0.05 && !g.guardManager.anyNonPatrol()) this.hideTarget = null;
      return;
    }
    this.hideTarget = null;

    // 3) Ikuti node navigasi menuju peti berikutnya / EXIT.
    let target = NAV_NODES[this.nodeIdx];
    if (!target) {
      // Pengaman: node habis tapi game belum menang — terus dorong ke EXIT.
      this._moveTo(15.5, 0, dt, input);
      return;
    }
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.45) {
      this.nodeIdx++;
      target = NAV_NODES[this.nodeIdx];
      if (!target) return;
    }
    // Node peti yang petinya sudah diambil: lewati (tidak perlu injak tepat).
    const chestId = CHEST_NODE[this.nodeIdx];
    if (chestId) {
      const chest = this.game.level.chests.find((c) => c.id === chestId);
      if (chest && chest.taken) {
        this.nodeIdx++;
        target = NAV_NODES[this.nodeIdx];
        if (!target) return;
      }
    }
    // Look-ahead: JANGAN masuki node (atau titik tengah jalurnya) yang sedang
    // berada di dalam cone penjaga. Tunggu di tempat sampai penjaga berlalu
    // atau terowongan datang — lebih baik menunggu daripada tertangkap.
    if (!g.tunnel.dark && !this._nodeSafe(target)) return;
    this._moveTo(target.x, target.z, dt, input);
  }

  // Bergerak ke titik tujuan dengan detour anti-macet: bila 1,2 detik tidak
  // bergerak padahal berusaha jalan, ambil jalan memutar tegak lurus.
  _moveTo(tx, tz, dt, input) {
    const p = this.game.player.pos;
    if (this.detour) {
      this.detourT += dt;
      this._goTo(this.detour.x, this.detour.z, dt, input);
      if (Math.hypot(this.detour.x - p.x, this.detour.z - p.z) < 0.35 || this.detourT > 3) {
        this.detour = null; this.detourT = 0;
      }
    } else {
      this._goTo(tx, tz, dt, input);
    }
    if (Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) < 0.02) {
      this.stuckT += dt;
      if (this.stuckT > 1.2 && !this.detour) {
        this.detour = this._pickDetour(p, { x: tx, z: tz });
        this.detourT = 0;
        this.stuckT = 0;
      }
    } else { this.stuckT = 0; }
    this.lastPos = { x: p.x, z: p.z };
  }

  // Titik memutar: 2 unit tegak lurus arah jalan, sisi yang ruangnya bebas
  // DAN tidak terlihat penjaga. Kembalikan null bila tak ada sisi aman.
  _pickDetour(p, target) {
    const dx = target.x - p.x, dz = target.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const px = -dz / d, pz = dx / d; // tegak lurus
    const boxes = solidBoxes(this.game.level);
    const free = (x, z) => {
      if (x < -15.3 || x > 15.5 || z < -4.4 || z > 4.4) return false;
      for (const b of boxes) {
        if (x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6) return false;
      }
      return !this._seenByGuard(x, z);
    };
    if (free(p.x + px * 2.0, p.z + pz * 2.0)) return { x: p.x + px * 2.0, z: p.z + pz * 2.0 };
    if (free(p.x - px * 2.0, p.z - pz * 2.0)) return { x: p.x - px * 2.0, z: p.z - pz * 2.0 };
    return null; // tidak ada jalan memutar aman — diam dan tunggu
  }

  // Apakah titik ini sedang terlihat oleh penjaga mana pun?
  _seenByGuard(x, z) {
    for (const gu of this.game.guardManager.guards) {
      const d = Math.hypot(gu.pos.x - x, gu.pos.z - z);
      if (d < 1.2) return true; // terlalu dekat = ketahuan
      if (d > gu.coneRange()) continue;
      if (gu.state === 'alert' || gu.state === 'search' || gu.state === 'investigate') {
        if (d < gu.coneRange() + 2) return true;
      }
      const ang = Math.atan2(z - gu.pos.z, x - gu.pos.x);
      let diff = ang - gu.facing;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) > gu.coneHalf()) continue;
      if (hasLineOfSight(this.game.level, gu.pos.x, gu.pos.z, x, z)) return true;
    }
    return false;
  }

  _spotSafe(spot) { return !this._seenByGuard(spot.x, spot.z); }

  _nearestSafeSpot(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.game.level.hidingSpots) {
      if (!this._spotSafe(s)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Node aman bila node + seluruh segmen pemain->node tak terlihat penjaga
  // (dicek di 5 titik sampel — penjaga bergerak, jadi jangan mulai menyeberang
  // bila jalurnya sedang disapu cone).
  _nodeSafe(target) {
    const p = this.game.player.pos;
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const x = p.x + (target.x - p.x) * t;
      const z = p.z + (target.z - p.z) * t;
      if (this._seenByGuard(x, z)) return false;
    }
    return true;
  }

  _goTo(tx, tz, dt, input) {
    const p = this.game.player.pos;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return;
    // Hindari penjaga yang sedang mengejar: lari menjauhinya dulu.
    const chaser = this.game.guardManager.guards.find((gu) => gu.state === 'alert');
    let mx = dx / d, mz = dz / d;
    if (chaser) {
      const cx = p.x - chaser.pos.x, cz = p.z - chaser.pos.z;
      const cd = Math.hypot(cx, cz) || 1;
      if (cd < 3.5) { mx = cx / cd; mz = cz / cd; }
    }
    if (mx < -0.3) input.keys.add('KeyA');
    if (mx > 0.3) input.keys.add('KeyD');
    if (mz < -0.3) input.keys.add('KeyW');
    if (mz > 0.3) input.keys.add('KeyS');
  }
}

// Menjalankan mode ?shot= : simulasi langkah tetap 1/60 tanpa render tiap
// langkah, lalu satu render akhir. Mengembalikan info hasil untuk log.
export function runShotMode(game, shot) {
  const DT = 1 / 60;
  const ap = new Autopilot(game);
  game.autopilot = ap;
  game.shotMode = shot;

  if (shot === 'start') {
    game.setState('title');
    game.render();
    document.title = 'shot-start-ready';
    window.__shotDone = true;
    return { shot, result: 'title' };
  }

  game.startGame();
  ap.reset();
  let steps = 0;
  const maxSteps = 60 * 240; // maks 4 menit waktu game
  let targetSteps = 0;
  if (shot === 'play') targetSteps = 60 * 12;      // 12 detik permainan
  else if (shot === 'climax') targetSteps = 60 * 22; // 22 detik: 3/3 peti,
  // masinis ALERT (cone merah) saat pemain mendekati EXIT — momen tergenting.
  const trace = [];
  const wantTrace = new URLSearchParams(window.location.search).has('trace');

  while (steps < maxSteps) {
    ap.step(DT);
    game.update(DT);
    steps++;
    if (wantTrace && steps % 120 === 0) {
      trace.push({
        t: +(steps / 60).toFixed(0),
        x: +game.player.pos.x.toFixed(1), z: +game.player.pos.z.toFixed(1),
        node: ap.nodeIdx, meter: +game.meter.toFixed(2), spot: game.spotted,
        taken: game.level.chests.filter((c) => c.taken).length,
        st: game.guardManager.guards.map((gu) => gu.state[0]).join(''),
        hide: ap.hideTarget ? 'H' : '-',
      });
    }
    if (game.state === 'win' || game.state === 'lose') break;
    if (shot !== 'end' && steps >= targetSteps) break;
  }
  if (wantTrace) {
    const pre = document.createElement('pre');
    pre.id = 'trace';
    pre.textContent = JSON.stringify(trace);
    document.body.appendChild(pre);
  }
  game.render();
  document.title = 'shot-' + shot + '-ready';
  window.__shotDone = true;
  return {
    shot, steps, state: game.state,
    time: game.time, spotted: game.spotted,
    taken: game.level.chests.filter((c) => c.taken).length,
    grade: game.grade,
  };
}

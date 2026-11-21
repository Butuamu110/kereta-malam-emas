// guards.js — Penjaga: kondektur patroli, anjing K-9, masinis pemindai.
// State: patrol → suspicious (?) → alert/chase (!) → search → patrol.
// Cone visi = mesh kipas transparan bervolume; warna kuning/oranye/merah.
// Penjaga TIDAK PERNAH menembus dinding: waypoint hanya di ruang terbuka +
// tabrakan lingkaran-vs-AABB di setiap langkah.
import * as THREE from 'three';
import { DETECTION, GUARD_SPEED, PALETTE, COIN_LURE_RADIUS } from './config.js';
import { collideCircle, hasLineOfSight, solidBoxes } from './level.js';

const CONE_COLORS = { patrol: 0xffd34d, suspicious: 0xff8c1a, alert: 0xff2a2a, search: 0xff8c1a, investigate: 0xff8c1a };

export class Guard {
  constructor(def, scene) {
    this.name = def.name;
    this.kind = def.kind; // conductor | dog | driver
    this.pts = def.pts || null;
    this.speed = def.speed || GUARD_SPEED.patrol;
    this.scan = !!def.scan;
    this.pos = def.pos ? { x: def.pos[0], z: def.pos[1] } : { x: def.pts[0][0], z: def.pts[0][1] };
    this.targetIdx = 1;
    this.facing = def.scan ? Math.PI : 0; // masinis menghadap lorong (-x)
    this.state = 'patrol';
    this.stateT = 0;
    this.lastKnown = null;
    this.searchT = 0;
    this.scanPhase = 0;
    this.pauseT = 0;
    this.group = new THREE.Group();
    this.cone = null;
    this.mark = null; // sprite "?" / "!" di atas kepala
    this._buildMesh(scene);
  }

  _buildMesh(scene) {
    const g = this.group;
    if (this.kind === 'dog') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }));
      body.position.y = 0.35; body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.32),
        new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 }));
      head.position.set(0.55, 0.5, 0); head.castShadow = true;
      g.add(head);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6),
        new THREE.MeshStandardMaterial({ color: 0x1d1d1d }));
      ear.position.set(0.5, 0.72, 0.12); g.add(ear);
    } else if (this.kind === 'driver') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.8 }));
      body.position.y = 0.85; body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 }));
      head.position.y = 1.6; head.castShadow = true;
      g.add(head);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }));
      cap.position.y = 1.8; g.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22),
        new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.7 }));
      brim.position.set(0.28, 1.76, 0); g.add(brim);
    } else {
      // Kondektur: seragam navy + topi kuningan.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.05, 10),
        new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.8 }));
      body.position.y = 0.82; body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 }));
      head.position.y = 1.55; head.castShadow = true;
      g.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }));
      hat.position.y = 1.76; g.add(hat);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.7, roughness: 0.3 }));
      band.position.y = 1.7; g.add(band);
    }
    // Cincin kecil di bawah penjaga (jejak posisi, senada pemain).
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    g.add(ring);

    // Cone visi: kipas datar (ShapeGeometry) dengan titik di penjaga.
    const range = this.coneRange();
    const half = this.coneHalf();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    const segs = 18;
    for (let i = 0; i <= segs; i++) {
      const a = -half + (2 * half * i) / segs;
      shape.lineTo(Math.cos(a) * range, Math.sin(a) * range);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    // Setelah rotateX, sumbu shape Y menjadi -Z; putar agar 0 derajat = +X.
    this.cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: CONE_COLORS.patrol, transparent: true, opacity: 0.26,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    this.cone.position.y = 0.06;
    g.add(this.cone);

    // Tanda "?" / "!" (sprite kanvas) di atas kepala.
    this.mark = this._makeMark();
    this.mark.position.y = 2.15;
    this.mark.visible = false;
    g.add(this.mark);

    g.position.set(this.pos.x, 0, this.pos.z);
    scene.add(g);
  }

  _makeMark() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000';
    ctx.strokeText('!', 32, 34); ctx.fillStyle = '#ff2a2a';
    ctx.fillText('!', 32, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(0.7, 0.7, 1);
    spr.userData.canvas = canvas; spr.userData.ctx = ctx;
    return spr;
  }

  _setMark(ch) {
    if (!ch) { this.mark.visible = false; return; }
    const { canvas, ctx } = this.mark.userData;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000';
    ctx.strokeText(ch, 32, 34);
    ctx.fillStyle = ch === '!' ? '#ff2a2a' : '#ff8c1a';
    ctx.fillText(ch, 32, 34);
    this.mark.material.map.needsUpdate = true;
    this.mark.visible = true;
  }

  coneRange() {
    if (this.kind === 'dog') return DETECTION.dogRange;
    if (this.kind === 'driver') return DETECTION.driverRange;
    return DETECTION.range;
  }
  coneHalf() {
    return this.kind === 'driver' ? DETECTION.driverHalfAngle : DETECTION.halfAngle;
  }

  // Apakah penjaga melihat pemain sekarang (cone + LOS + jarak; gelap = tidak).
  seesPlayer(level, playerPos, tunnelDark) {
    if (tunnelDark) return false;
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.coneRange()) return false;
    if (dist < 0.6) return true; // menabrak penjaga = terlihat
    const ang = Math.atan2(dz, dx);
    let diff = ang - this.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > this.coneHalf()) return false;
    return hasLineOfSight(level, this.pos.x, this.pos.z, playerPos.x, playerPos.z);
  }

  // Perintah pengalih: datangi titik koin.
  investigate(x, z) {
    if (this.state === 'alert') return;
    this.state = 'investigate';
    this.lastKnown = { x, z };
    this.stateT = 0;
  }

  alarmTo(x, z) {
    this.state = 'alert';
    this.lastKnown = { x, z };
    this.stateT = 0;
  }

  update(dt, level, playerPos, sees, tunnelDark) {
    this.stateT += dt;
    const boxes = solidBoxes(level);
    const chaseSpeed = this.kind === 'dog' ? GUARD_SPEED.dogChase : GUARD_SPEED.chase;
    const patrolSpeed = this.speed;

    const moveToward = (tx, tz, speed) => {
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) return true;
      const step = Math.min(d, speed * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.facing = Math.atan2(dz, dx);
      collideCircle(this.pos, 0.45, boxes);
      return d - step < 0.08;
    };

    if (this.kind === 'driver') {
      // Masinis: diam, memindai lorong bolak-balik (±55° dari arah -x).
      this.scanPhase += dt * 0.55;
      this.facing = Math.PI + Math.sin(this.scanPhase) * 0.96;
      if (sees && this.state !== 'alert') {
        this.state = 'alert'; this.stateT = 0;
        this.lastKnown = { x: playerPos.x, z: playerPos.z };
      } else if (this.state === 'alert') {
        if (sees) { this.lastKnown = { x: playerPos.x, z: playerPos.z }; this.stateT = 0; }
        else if (this.stateT > 3) { this.state = 'search'; this.stateT = 0; }
      } else if (this.state === 'search' && this.stateT > 3) {
        this.state = 'patrol'; this.stateT = 0;
      }
    } else if (this.state === 'alert') {
      const arrived = moveToward(this.lastKnown.x, this.lastKnown.z, chaseSpeed);
      if (sees) { this.lastKnown = { x: playerPos.x, z: playerPos.z }; this.stateT = 0; }
      else if (arrived || this.stateT > 4) { this.state = 'search'; this.stateT = 0; this.searchT = 0; }
    } else if (this.state === 'investigate') {
      const arrived = moveToward(this.lastKnown.x, this.lastKnown.z, patrolSpeed * 1.2);
      if (arrived || this.stateT > 6) { this.state = 'search'; this.stateT = 0; }
    } else if (this.state === 'search') {
      // Berputar di tempat mencari, lalu kembali patroli.
      this.facing += dt * 1.4;
      if (sees) { this.state = 'alert'; this.stateT = 0; this.lastKnown = { x: playerPos.x, z: playerPos.z }; }
      else if (this.stateT > 3.5) { this.state = 'patrol'; this.stateT = 0; }
    } else if (this.state === 'suspicious') {
      // Berhenti, menoleh ke pemain; bila terus terlihat -> alert.
      if (sees) {
        const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
        this.facing = Math.atan2(dz, dx);
      }
      if (this.stateT > 1.1) { this.state = 'patrol'; this.stateT = 0; }
    } else {
      // Patroli bolak-balik antar waypoint (ruang terbuka — aman dari dinding).
      if (this.pauseT > 0) { this.pauseT -= dt; }
      else {
        const target = this.pts[this.targetIdx];
        const arrived = moveToward(target[0], target[1], patrolSpeed);
        if (arrived) {
          this.targetIdx = (this.targetIdx + 1) % this.pts.length;
          this.pauseT = 0.4;
        }
      }
    }

    // Visual: posisi, rotasi cone, warna cone, tanda ? / !.
    this.group.position.set(this.pos.x, 0, this.pos.z);
    const coneVisible = !tunnelDark;
    this.cone.visible = coneVisible;
    if (coneVisible) {
      this.cone.rotation.y = -this.facing;
      const col = CONE_COLORS[this.state] || CONE_COLORS.patrol;
      this.cone.material.color.setHex(col);
      this.cone.material.opacity = this.state === 'alert' ? 0.42 : 0.26;
    }
    this._setMark(this.state === 'alert' ? '!' : this.state === 'suspicious' || this.state === 'search' ? '?' : null);
    // Anjing menghadap arah gerak (kepala di +X lokal).
    this.group.rotation.y = this.kind === 'dog' ? -this.facing : 0;
  }
}

export class GuardManager {
  constructor(defs, scene) {
    this.guards = defs.map((d) => new Guard(d, scene));
  }

  // Satu langkah deteksi untuk semua penjaga; kembalikan penjaga yang melihat.
  update(dt, level, playerPos, tunnelDark) {
    const seers = [];
    for (const g of this.guards) {
      const sees = g.seesPlayer(level, playerPos, tunnelDark);
      if (sees) seers.push(g);
      g.update(dt, level, playerPos, sees, tunnelDark);
    }
    return seers;
  }

  alarmAll(x, z) {
    for (const g of this.guards) g.alarmTo(x, z);
  }

  lure(x, z) {
    let best = null, bestD = COIN_LURE_RADIUS;
    for (const g of this.guards) {
      const d = Math.hypot(g.pos.x - x, g.pos.z - z);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (best) best.investigate(x, z);
    return best;
  }

  anyAlert() { return this.guards.some((g) => g.state === 'alert'); }
  anyNonPatrol() { return this.guards.some((g) => g.state !== 'patrol'); }

  statusList() {
    return this.guards.map((g) => ({
      name: g.name,
      state: g.state,
      short: g.name.split(' ').slice(-1)[0],
    }));
  }
}

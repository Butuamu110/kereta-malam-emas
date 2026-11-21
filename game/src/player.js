// player.js — Pencuri: gerak WASD/panah, menyelinap (Shift), interaksi (E),
// lempar koin pengalih (Q). Mesh: outfit teal terang + cincin hijau + panah emas.
import * as THREE from 'three';
import { PLAYER, PALETTE, COIN_THROW_DIST } from './config.js';
import { collideCircle, solidBoxes } from './level.js';

export class Player {
  constructor(scene) {
    this.pos = { x: -15, z: 0 };
    this.facing = 0; // radian, 0 = +X (ke arah kabin)
    this.moving = false;
    this.sneaking = false;
    this.stepAcc = 0;
    this.group = new THREE.Group();
    this._buildMesh(scene);
    this.coins = []; // koin yang dilempar & masih di lantai {x,z,mesh}
  }

  _buildMesh(scene) {
    const g = this.group;
    // Tubuh: mantel teal terang — harus langsung terlihat di antara marun/kuningan.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.player, roughness: 0.6 }));
    body.position.y = 0.78; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 }));
    head.position.y = 1.45; head.castShadow = true;
    g.add(head);
    // Topi pencuri + syal emas.
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x14202e, roughness: 0.6 }));
    hat.position.y = 1.64; g.add(hat);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.6, roughness: 0.35 }));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.22; g.add(scarf);
    // Cincin hijau terang di bawah kaki — penanda posisi pemain.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 28),
      new THREE.MeshBasicMaterial({ color: PALETTE.playerRing, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(ring);
    // Panah emas kecil di atas kepala.
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    arrow.rotation.x = Math.PI; arrow.position.y = 2.05;
    g.add(arrow);
    this.arrow = arrow;
    g.position.set(this.pos.x, 0, this.pos.z);
    scene.add(g);
  }

  // Gerak satu langkah; kembalikan true bila benar-benar bergerak.
  move(dx, dz, dt, level, sneak) {
    const speed = sneak ? PLAYER.sneak : PLAYER.walk;
    const len = Math.hypot(dx, dz);
    this.moving = len > 0.01;
    this.sneaking = sneak && this.moving;
    if (!this.moving) return false;
    const nx = dx / len, nz = dz / len;
    const boxes = solidBoxes(level);
    // Gerak per-sumbu (X lalu Z) agar pemain MELUNCUR di sepanjang dinding
    // saat bergerak diagonal — bukan tersangkut di sudut kotak.
    this.pos.x += nx * speed * dt;
    collideCircle(this.pos, PLAYER.radius, boxes);
    this.pos.z += nz * speed * dt;
    collideCircle(this.pos, PLAYER.radius, boxes);
    // Jepit di dalam kereta.
    this.pos.x = Math.max(-15.5, Math.min(15.6, this.pos.x));
    this.pos.z = Math.max(-4.5, Math.min(4.5, this.pos.z));
    this.facing = Math.atan2(nz, nx);
    // Suara langkah tiap 0.45 detik jalan / 0.7 detik menyelinap.
    this.stepAcc += dt;
    const interval = sneak ? 0.7 : 0.42;
    let stepped = false;
    if (this.stepAcc >= interval) { this.stepAcc = 0; stepped = true; }
    this._syncMesh();
    return stepped;
  }

  _syncMesh() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    // Panah berdenyut pelan agar mata langsung menemukan pemain.
    const s = 1 + Math.sin(performance.now() / 300) * 0.12;
    this.arrow.scale.set(s, s, s);
  }

  // Koin dilempar ke arah hadap; kembalikan titik jatuhnya.
  throwCoin(scene) {
    const tx = this.pos.x + Math.cos(this.facing) * COIN_THROW_DIST;
    const tz = this.pos.z + Math.sin(this.facing) * COIN_THROW_DIST;
    const cx = Math.max(-15.5, Math.min(15.6, tx));
    const cz = Math.max(-4.5, Math.min(4.5, tz));
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.85, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.5 }));
    mesh.position.set(cx, 0.05, cz);
    scene.add(mesh);
    this.coins.push({ x: cx, z: cz, mesh });
    return { x: cx, z: cz };
  }
}

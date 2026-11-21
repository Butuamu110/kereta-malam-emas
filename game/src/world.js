// world.js — Membangun adegan 3D kereta (Three.js): lantai, karpet, dinding,
// kursi, koper, gerobak, tirai, peti emas, pintu gerbong, pintu EXIT, lampu.
import * as THREE from 'three';
import { WORLD, PALETTE, DIVIDERS, DOOR_HALF } from './config.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.08, ...opts });
}

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class World {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.doorMeshes = new Map();   // door.x -> grup pintu geser
    this.chestMeshes = new Map();  // chest.id -> {group, light}
    this.lamps = [];
    this.chestLights = [];
    this.ambient = null;
    this.dirLight = null;
    this.build();
  }

  build() {
    const s = this.scene;
    const W = WORLD;

    // --- Lantai kayu gelap + karpet merah marun di lorong tengah.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX + 1, W.maxZ - W.minZ + 1), mat(PALETTE.floor, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    s.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX, 3.0), mat(PALETTE.carpet, { roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.02; carpet.receiveShadow = true;
    s.add(carpet);
    // List kuningan di tepi karpet.
    for (const z of [-1.55, 1.55]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX, 0.08), mat(PALETTE.brass, { metalness: 0.7, roughness: 0.35 }));
      strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.03, z);
      s.add(strip);
    }

    // --- Dinding luar + sekat gerbong (mesh mengikuti AABB level).
    for (const b of this.level.walls) {
      const w = b.x1 - b.x0, d = b.z1 - b.z0;
      const wall = box(w, 2.6, d, PALETTE.wall, (b.x0 + b.x1) / 2, 1.3, (b.z0 + b.z1) / 2);
      s.add(wall);
      // Trim kuningan di atas dinding.
      const trim = box(w, 0.08, d + 0.04, PALETTE.brassDark, (b.x0 + b.x1) / 2, 2.62, (b.z0 + b.z1) / 2, { metalness: 0.6, roughness: 0.4 });
      s.add(trim);
    }
    // Jendela: panel biru malam di dinding luar (visual, di atas dinding).
    for (let x = -14; x <= 14; x += 4) {
      for (const z of [W.minZ - 0.18, W.maxZ + 0.18]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1),
          new THREE.MeshStandardMaterial({ color: PALETTE.night, emissive: 0x16224d, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4 }));
        win.position.set(x, 1.6, z);
        if (z < 0) win.rotation.y = 0; else win.rotation.y = Math.PI;
        s.add(win);
        const frame = box(2.4, 0.08, 0.06, PALETTE.brassDark, x, 2.2, z < 0 ? W.minZ - 0.16 : W.maxZ + 0.16, { metalness: 0.6 });
        s.add(frame);
      }
    }

    // --- Cover: kursi, koper, gerobak, tirai (mesh mengikuti AABB level).
    for (const c of this.level.covers) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      const w = c.x1 - c.x0, d = c.z1 - c.z0;
      if (c.kind === 'seat') {
        const g = new THREE.Group();
        g.add(box(w, 0.45, d, PALETTE.velvet, 0, 0.28, 0));
        g.add(box(w, 0.55, 0.18, PALETTE.velvet, 0, 0.75, cz < 0 ? -d / 2 + 0.09 : d / 2 - 0.09));
        g.add(box(w, 0.1, d, PALETTE.brassDark, 0, 0.55, 0, { metalness: 0.6, roughness: 0.4 }));
        g.position.set(cx, 0, cz);
        s.add(g);
      } else if (c.kind === 'luggage') {
        const g = new THREE.Group();
        g.add(box(w * 0.8, 0.5, d * 0.8, 0x6b4a2a, 0, 0.25, 0));
        g.add(box(w * 0.6, 0.4, d * 0.6, 0x7d5a33, 0, 0.7, 0));
        g.add(box(w * 0.84, 0.06, d * 0.84, PALETTE.brass, 0, 0.52, 0, { metalness: 0.7, roughness: 0.3 }));
        g.position.set(cx, 0, cz);
        s.add(g);
      } else if (c.kind === 'cart') {
        const g = new THREE.Group();
        g.add(box(w, 0.9, d, 0x8a8f96, 0, 0.55, 0, { metalness: 0.5, roughness: 0.4 }));
        g.add(box(w * 0.9, 0.12, d * 0.9, PALETTE.brass, 0, 1.05, 0, { metalness: 0.7, roughness: 0.3 }));
        g.add(box(w * 0.7, 0.25, d * 0.7, 0xd8d3c8, 0, 1.2, 0));
        g.position.set(cx, 0, cz);
        s.add(g);
      } else if (c.kind === 'curtain') {
        const g = new THREE.Group();
        const cur = box(w + 0.25, 2.2, d, PALETTE.maroon, 0, 1.1, 0, { roughness: 1 });
        g.add(cur);
        g.add(box(w + 0.3, 0.08, d + 0.05, PALETTE.brass, 0, 2.2, 0, { metalness: 0.7 }));
        g.position.set(cx, 0, cz);
        s.add(g);
      }
    }

    // --- Pintu antar-gerbong: panel geser kuningan (bergeser ke samping saat dibuka).
    for (const door of this.level.doors) {
      const g = new THREE.Group();
      const panel = box(0.18, 2.3, DOOR_HALF * 2, PALETTE.brass, 0, 1.15, 0, { metalness: 0.65, roughness: 0.35 });
      g.add(panel);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshStandardMaterial({ color: PALETTE.night, emissive: 0x1a2a55, emissiveIntensity: 0.7 }));
      win.rotation.y = Math.PI / 2; win.position.set(0.11, 1.6, 0);
      g.add(win);
      g.position.set(door.x, 0, door.z);
      s.add(g);
      this.doorMeshes.set(door.x, g);
    }

    // --- Peti emas: kotak emas + tutup + kilau cahaya.
    for (const chest of this.level.chests) {
      const g = new THREE.Group();
      g.add(box(0.9, 0.55, 0.65, PALETTE.gold, 0, 0.28, 0, { metalness: 0.8, roughness: 0.25 }));
      g.add(box(0.95, 0.18, 0.7, 0xffdf80, 0, 0.62, 0, { metalness: 0.85, roughness: 0.2 }));
      g.add(box(0.12, 0.6, 0.68, PALETTE.brassDark, 0, 0.35, 0, { metalness: 0.7 }));
      const light = new THREE.PointLight(0xffd34d, 6, 4.5, 1.8);
      light.position.set(0, 1.1, 0);
      g.add(light);
      this.chestLights.push(light);
      g.position.set(chest.x, 0, chest.z);
      s.add(g);
      this.chestMeshes.set(chest.id, { group: g, light });
    }

    // --- Pintu EXIT di ujung gerbong C: bingkai hijau + panah keluar.
    const exit = this.level.exit;
    const eg = new THREE.Group();
    eg.add(box(0.25, 2.5, 2.4, PALETTE.exitGreen, 0, 1.25, 0, { emissive: 0x0d5c2e, emissiveIntensity: 0.6 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x062b16, emissive: 0x2eff8f, emissiveIntensity: 0.9 }));
    sign.rotation.y = -Math.PI / 2; sign.position.set(-0.16, 2.1, 0);
    eg.add(sign);
    eg.position.set(WORLD.maxX - 0.1, 0, exit.z);
    s.add(eg);
    // Karpet hijau menuju EXIT.
    const exitCarpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2),
      mat(0x0d5c2e, { roughness: 1 }));
    exitCarpet.rotation.x = -Math.PI / 2; exitCarpet.position.set(14.6, 0.04, 0);
    s.add(exitCarpet);

    // --- Lampu gantung kuningan tiap gerbong + kabin masinis.
    for (const lx of [-11, 0, 11]) {
      const lamp = new THREE.Group();
      lamp.add(box(0.1, 0.5, 0.1, PALETTE.brassDark, 0, 2.5, 0));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 2.2 }));
      bulb.position.y = 2.2;
      lamp.add(bulb);
      lamp.position.set(lx, 0, 0);
      s.add(lamp);
      this.lamps.push(lamp);
    }
    // Konsol masinis di kabin.
    const console_ = box(1.2, 1.0, 3.2, 0x2b2f38, 15.2, 0.5, -2.5, { metalness: 0.4, roughness: 0.5 });
    s.add(console_);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x061018, emissive: 0x2dd4bf, emissiveIntensity: 0.8 }));
    screen.rotation.y = -Math.PI / 2; screen.rotation.x = -0.4;
    screen.position.set(14.55, 1.2, -2.5);
    s.add(screen);

    // --- Pencahayaan: ambient + hemisphere + directional (bayangan) + 3 point.
    this.ambient = new THREE.AmbientLight(0xffe6b8, 0.55);
    s.add(this.ambient);
    s.add(new THREE.HemisphereLight(0x8fa3ff, 0x3a2418, 0.5));
    const dir = new THREE.DirectionalLight(0xffe0a0, 1.6);
    dir.position.set(6, 18, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 1024);
    dir.shadow.camera.left = -20; dir.shadow.camera.right = 20;
    dir.shadow.camera.top = 10; dir.shadow.camera.bottom = -10;
    dir.shadow.camera.far = 50;
    s.add(dir);
    this.dirLight = dir;
    for (const lx of [-11, 0, 11]) {
      const p = new THREE.PointLight(0xffc94d, 22, 13, 1.6);
      p.position.set(lx, 2.4, 0);
      s.add(p);
    }
    // Asap biru malam: kabut tipis di luar jendela (jauh agar tak menelan kereta).
    s.fog = new THREE.Fog(0x0b1026, 42, 75);
    s.background = new THREE.Color(0x0b1026);
  }

  // Pintu: geser panel ke samping (z +1.2) saat terbuka.
  setDoorOpen(door, open) {
    const g = this.doorMeshes.get(door.x);
    if (g) g.position.z = open ? 1.35 : 0;
  }

  setChestTaken(id) {
    const c = this.chestMeshes.get(id);
    if (c) { c.group.visible = false; c.light.intensity = 0; }
  }

  // Terowongan: redupkan semua cahaya; kembalikan saat terang.
  setTunnelDark(dark, amount) {
    const a = 1 - amount * 0.85;
    if (this.ambient) this.ambient.intensity = 0.55 * a;
    if (this.dirLight) this.dirLight.intensity = 1.6 * a;
    for (const l of this.chestLights) l.intensity = dark ? 0.5 : 6;
    for (const lamp of this.lamps) lamp.visible = true;
  }
}

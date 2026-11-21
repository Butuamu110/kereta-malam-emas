// level.js — Data level kereta + geometri tabrakan & line-of-sight.
// Semua halangan adalah AABB {x0,z0,x1,z1}; LOS & gerak memakai fungsi yang sama
// sehingga penjaga, pemain, dan cone visi sepakat soal apa yang menghalangi.
import { WORLD, DIVIDERS, DOOR_HALF, CHEST_DEFS, EXIT, HIDING_SPOTS, NAV_NODES } from './config.js';

export function buildLevel() {
  const walls = [];
  const t = WORLD.wallT;
  // Dinding luar.
  walls.push({ x0: WORLD.minX - t, z0: WORLD.minZ - t, x1: WORLD.maxX + t, z1: WORLD.minZ, kind: 'wall' });
  walls.push({ x0: WORLD.minX - t, z0: WORLD.maxZ, x1: WORLD.maxX + t, z1: WORLD.maxZ + t, kind: 'wall' });
  walls.push({ x0: WORLD.minX - t, z0: WORLD.minZ, x1: WORLD.minX, z1: WORLD.maxZ, kind: 'wall' });
  walls.push({ x0: WORLD.maxX, z0: WORLD.minZ, x1: WORLD.maxX + t, z1: WORLD.maxZ, kind: 'wall' });
  // Sekat antar-gerbong: dua segmen, menyisakan celah pintu z -1.1..1.1.
  for (const dx of DIVIDERS) {
    walls.push({ x0: dx - 0.2, z0: WORLD.minZ, x1: dx + 0.2, z1: -DOOR_HALF, kind: 'wall' });
    walls.push({ x0: dx - 0.2, z0: DOOR_HALF, x1: dx + 0.2, z1: WORLD.maxZ, kind: 'wall' });
  }

  // Cover: deret kursi (velvet merah), tumpukan koper, gerobak makan, tirai.
  // Lorong tengah z -1.4..1.4 selalu bebas; jalur samping z ±2.2..±3.0 bebas.
  const covers = [
    // Gerbong A
    { x0: -14.7, z0: -4.2, x1: -11.3, z1: -3.0, kind: 'seat' },
    { x0: -10.7, z0: -4.2, x1: -7.3, z1: -3.0, kind: 'seat' },
    { x0: -14.7, z0: 3.0, x1: -11.3, z1: 4.2, kind: 'seat' },
    { x0: -10.7, z0: 3.0, x1: -7.3, z1: 4.2, kind: 'seat' },
    { x0: -15.1, z0: 1.6, x1: -13.9, z1: 2.8, kind: 'luggage' },
    { x0: -8.3, z0: 2.7, x1: -6.7, z1: 3.7, kind: 'cart' },
    // Tirai: panel di ujung deret kursi, SEJAJAR dengan baris kursi (tidak
    // pernah menutup lorong) — menghalangi pandangan, bukan jalan.
    { x0: -11.3, z0: -4.2, x1: -11.1, z1: -3.0, kind: 'curtain' },
    { x0: -11.3, z0: 3.0, x1: -11.1, z1: 4.2, kind: 'curtain' },
    // Gerbong B
    { x0: -4.7, z0: -4.2, x1: -1.3, z1: -3.0, kind: 'seat' },
    { x0: -0.7, z0: -4.2, x1: 2.7, z1: -3.0, kind: 'seat' },
    { x0: -4.7, z0: 3.0, x1: -1.3, z1: 4.2, kind: 'seat' },
    { x0: -0.7, z0: 3.0, x1: 2.7, z1: 4.2, kind: 'seat' },
    { x0: 2.8, z0: -3.2, x1: 4.2, z1: -2.0, kind: 'luggage' },
    { x0: -4.9, z0: 2.0, x1: -3.5, z1: 3.2, kind: 'luggage' },
    { x0: 3.7, z0: 2.7, x1: 5.3, z1: 3.7, kind: 'cart' },
    { x0: -1.3, z0: -4.2, x1: -1.1, z1: -3.0, kind: 'curtain' },
    { x0: -1.3, z0: 3.0, x1: -1.1, z1: 4.2, kind: 'curtain' },
    // Gerbong C
    { x0: 6.3, z0: -4.2, x1: 9.7, z1: -3.0, kind: 'seat' },
    { x0: 6.3, z0: 3.0, x1: 9.7, z1: 4.2, kind: 'seat' },
    { x0: 10.7, z0: -4.2, x1: 13.3, z1: -3.0, kind: 'seat' },
    { x0: 10.3, z0: 2.0, x1: 11.7, z1: 3.2, kind: 'luggage' },
    { x0: 13.9, z0: -4.2, x1: 15.1, z1: -3.0, kind: 'luggage' },
    { x0: 9.7, z0: -4.2, x1: 9.9, z1: -3.0, kind: 'curtain' },
    { x0: 9.7, z0: 3.0, x1: 9.9, z1: 4.2, kind: 'curtain' },
  ];

  const doors = DIVIDERS.map((x) => ({ x, z: 0, open: false, timer: 0 }));

  return {
    walls, covers, doors,
    chests: CHEST_DEFS.map((c) => ({ ...c, taken: false })),
    exit: { ...EXIT },
    hidingSpots: HIDING_SPOTS.map((s) => ({ ...s })),
    navNodes: NAV_NODES.map((n) => ({ ...n })),
  };
}

// Semua AABB yang menghalangi gerak saat ini (pintu tertutup ikut).
export function solidBoxes(level) {
  const boxes = [...level.walls, ...level.covers];
  for (const d of level.doors) {
    if (!d.open) boxes.push({ x0: d.x - 0.2, z0: -DOOR_HALF, x1: d.x + 0.2, z1: DOOR_HALF, kind: 'door' });
  }
  return boxes;
}

// Semua AABB yang menghalangi pandangan (dinding + cover + pintu tertutup).
export function sightBoxes(level) { return solidBoxes(level); }

// Tabrakan lingkaran vs AABB: geser posisi keluar dari kotak (sumbu terdekat).
export function collideCircle(pos, radius, boxes) {
  for (const b of boxes) {
    const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
    const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Pusat di dalam kotak: dorong keluar lewat sisi terdekat.
      const left = pos.x - b.x0, right = b.x1 - pos.x;
      const top = pos.z - b.z0, bottom = b.z1 - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x0 - radius;
      else if (m === right) pos.x = b.x1 + radius;
      else if (m === top) pos.z = b.z0 - radius;
      else pos.z = b.z1 + radius;
    }
  }
}

// Uji segmen (x0,z0)->(x1,z1) memotong AABB — algoritma slab 2D.
export function segmentHitsBox(x0, z0, x1, z1, b) {
  const dx = x1 - x0, dz = z1 - z0;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < b.x0 || x0 > b.x1) return false; }
  else {
    let t1 = (b.x0 - x0) / dx, t2 = (b.x1 - x0) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) { if (z0 < b.z0 || z0 > b.z1) return false; }
  else {
    let t1 = (b.z0 - z0) / dz, t2 = (b.z1 - z0) / dz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Apakah ada halangan antara dua titik (ujung segmen boleh menempel di kotak).
export function hasLineOfSight(level, ax, az, bx, bz) {
  for (const b of sightBoxes(level)) {
    if (segmentHitsBox(ax, az, bx, bz, b)) return false;
  }
  return true;
}

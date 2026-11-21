// config.js — Konstanta & palet KERETA MALAM: Gerbong Emas.
// Satu-satunya tempat angka tuning tinggal; semua modul lain mengimpor dari sini.
export const WORLD = {
  minX: -16, maxX: 16,   // panjang kereta (sumbu X)
  minZ: -5, maxZ: 5,     // lebar kereta (sumbu Z)
  wallT: 0.4,            // tebal dinding luar
};

// Batas gerbong: A [-16,-5.5] · B [-5.5,5.5] · C [5.5,16]. Pintu di z -1.1..1.1.
export const DIVIDERS = [-5.5, 5.5];
export const DOOR_HALF = 1.1;
export const DOOR_OPEN_SECONDS = 6;

export const PLAYER = {
  radius: 0.45,
  walk: 3.6,        // unit/detik
  sneak: 1.9,       // Shift = menyelinap (deteksi naik lebih lambat)
  pickupRadius: 1.35,
  exitX: 15.35,     // capai x ini dengan 3 peti = WIN
};

export const DETECTION = {
  range: 6,            // jangkauan cone kondektur
  dogRange: 4.5,       // anjing: pendek tapi cepat
  driverRange: 7,      // masinis: cone lebar
  halfAngle: 0.56,     // ~32 derajat
  driverHalfAngle: 0.79, // ~45 derajat
  riseNear: 0.5,       // meter/detik saat pemain dekat (< 3 unit)
  riseFar: 0.28,       // meter/detik saat pemain jauh
  sneakFactor: 0.45,   // pengali saat menyelinap
  fall: 0.42,          // meter/detik saat tersembunyi
  suspiciousAt: 0.45,  // ambang "?" — penjaga menoleh
  alertAt: 1.0,        // ambang alarm — semua penjaga mengejar
  catchRadius: 0.85,   // penjaga sedekat ini = tertangkap
};

export const GUARD_SPEED = {
  patrol: 1.5,
  chase: 2.7,
  dogPatrol: 2.2,
  dogChase: 3.1,
  search: 1.8,
};

export const TUNNEL = {
  period: 22,   // detik per siklus
  dark: 5,      // detik kegelapan total per siklus
};

// Palet: kuningan + merah marun + asap biru malam.
export const PALETTE = {
  brass: 0xc9a227,
  brassDark: 0x8a6d1f,
  maroon: 0x6e1423,
  maroonDark: 0x4a0d18,
  velvet: 0x9e1b32,
  wood: 0x5a3a22,
  woodDark: 0x3d2716,
  floor: 0x2e2118,
  carpet: 0x7a1020,
  wall: 0x3a2a1a,
  wallTrim: 0xc9a227,
  night: 0x0b1026,   // langit malam di luar jendela
  smokeBlue: 0x2b3a5e,
  player: 0x2dd4bf,  // teal terang — pemain harus langsung terlihat
  playerRing: 0x39ff88,
  gold: 0xffd34d,
  exitGreen: 0x2eff8f,
};

export const CHEST_DEFS = [
  { id: 'mahkota', name: 'Peti Mahkota', x: -13.5, z: -2.2 },
  { id: 'koin',    name: 'Peti Koin',    x: 0,     z: 2.2 },
  { id: 'permata', name: 'Peti Permata', x: 13.8,  z: 2.6 },
];

export const EXIT = { x: 15.4, z: 0 };

// Titik sembunyi: di balik deret kursi, LOS dari lorong terhalang kursi.
export const HIDING_SPOTS = [
  { x: -13, z: 4.5 }, { x: -9, z: -4.5 },
  { x: -3, z: 4.5 },  { x: 1, z: -4.5 },
  { x: 8, z: 4.5 },   { x: 12, z: -4.5 },
  { x: 14.5, z: 4.5 }, { x: -15, z: -4.5 },
];

// Jalur autopilot: lorong tengah + cabang ke tiap peti + pintu EXIT.
export const NAV_NODES = [
  { x: -15, z: 0 }, { x: -13.5, z: 0 }, { x: -13.5, z: -2.2 },
  { x: -13.5, z: 0 }, { x: -6.8, z: 0 }, { x: -5.5, z: 0 },
  { x: -4, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 2.2 },
  { x: 0, z: 0 }, { x: 5.5, z: 0 }, { x: 7, z: 0 },
  { x: 13.8, z: 0 }, { x: 13.8, z: 2.6 }, { x: 13.8, z: 0 },
  { x: 15.6, z: 0 }, // EXIT: node DI LUAR garis menang (x>=15.35) agar autopilot
                     // tidak berhenti sebelum garis — kemenangan terpicu di jalan.
];

export const GUARD_DEFS = [
  { name: 'Kondektur Budi', kind: 'conductor', pts: [[-14, 0], [-8, 0]], speed: 1.5 },
  { name: 'Kondektur Sari', kind: 'conductor', pts: [[-4, 0], [4, 0]], speed: 1.5 },
  { name: 'Kondektur Andi', kind: 'conductor', pts: [[8, 0], [14, 0]], speed: 1.5 },
  { name: 'Kondektur Dewi', kind: 'conductor', pts: [[-4, -2.4], [4, -2.4]], speed: 1.6 },
  { name: 'Anjing K-9 Rex', kind: 'dog', pts: [[-4, 2.4], [4, 2.4]], speed: 2.2 },
  // Masinis: diam di kabin, memindai (scan) bolak-balik menghadap lorong.
  { name: 'Masinis Bram', kind: 'driver', pos: [14.6, -1.2], scan: true },
];

export const COINS_START = 3;      // koin pengalih (Q), sekali lempar satu
export const COIN_THROW_DIST = 4.5;
export const COIN_LURE_RADIUS = 7; // penjaga dalam radius ini mendatangi koin

export function gradeFor(timeSec, spotted) {
  if (timeSec <= 100 && spotted === 0) return 'S';
  if (timeSec <= 140 && spotted <= 1) return 'A';
  if (timeSec <= 200) return 'B';
  return 'C';
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

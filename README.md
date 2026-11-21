[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Butuamu110/kereta-malam-emas/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Butuamu110/kereta-malam-emas/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# KERETA MALAM — Curi 3 Peti Emas Gerbong demi Gerbong

Game stealth 3D (Three.js) di atas kereta malam yang melaju. Kau pencuri yang
menyusup ke kereta: curi **Peti Mahkota** (gerbong A), **Peti Koin** (gerbong B),
dan **Peti Permata** (gerbong C), lalu kabur lewat **pintu EXIT hijau** di kabin
masinis — tanpa terlihat kondektur, anjing K-9, atau masinis yang memeriksa tiket.

## Mekanik khas

- **Kereta bergoyang** — kamera sway halus dan barang bergeser pelan; kereta
  terasa hidup dan melaju.
- **Terowongan berkala** — tiap ~20 detik kereta masuk terowongan: kegelapan
  total beberapa detik, semua cone visi padam. Itulah jendelamu bergerak bebas.
- **Pintu antar-gerbong** — tekan **E** untuk menggeser pintu kuningan (terbuka
  6 detik).

## Sistem stealth

Patroli → curiga (?) → kejar (!) → mencari → patroli. Meter deteksi naik saat
kau di dalam cone visi penjaga (kuning = patroli, oranye = curiga, merah =
mengejar) dan turun saat kau bersembunyi di balik kursi, koper, tirai, atau
gerobak makan. Lempar **koin (Q)** untuk memancing penjaga menjauh. Menyusup
(Shift) memperlambat naiknya meter. Menang = 3 peti + sampai EXIT; kalah =
tertangkap penjaga yang sedang mengejar.

## Kontrol

| Tombol | Aksi |
|---|---|
| WASD / panah | Gerak |
| Shift | Menyelinap (lambat, sulit terdeteksi) |
| E | Ambil peti / buka pintu gerbong |
| Q | Lempar koin pengalih (3 koin) |
| M | Suara hidup/mati |
| R / Enter | Main lagi dari layar akhir |

## Cara jalan

Buka `game/index.html` lewat server HTTP statis (modul ES tidak jalan dari
`file://`), misal:

```sh
python3 -m http.server 8000
# buka http://localhost:8000/game/index.html
```

Mode screenshot deterministik (autopilot memainkan aturan asli):

- `?shot=start` — layar judul
- `?shot=play` — 12 detik permainan
- `?shot=climax` — 30 detik permainan
- `?shot=end` — autopilot sampai menang/kalah

## Struktur source

`game/src/` satu-tugas-satu-file: `config` (tuning + palet), `level` (data
level + tabrakan + line-of-sight), `world` (adegan 3D kereta), `guards`
(kondektur + anjing + masinis + cone visi), `player`, `tunnel` (goyangan +
terowongan), `audio` (synth WebAudio), `input`, `hud` (HUD + minimap),
`shots` (autopilot + mode screenshot), `main` (state machine + loop).
`game/vendor/three.min.js` adalah Three.js 0.160.0 (vendored, offline).

## Hand-in

`main.ts` menyalin `game/` + `screenshots/` ke `MAKEFUN_OUTPUT_DIR`
(default `/output`) dan menulis `dossier.json` via `vendor/makefun-game.ts`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Lisensi

MIT — lihat `LICENSE`.

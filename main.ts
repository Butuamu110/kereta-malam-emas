// main.ts — Driver hand-in KERETA MALAM (best-stealth-game-20261121-1759).
//
// Menyalin game/ + screenshots/ dari repo ini ke MAKEFUN_OUTPUT_DIR
// (default /output), lalu menulis dossier.json via vendor/makefun-game.ts.
//
// ATURAN KERAS: hanya membersihkan isi DALAM folder output (game/,
// screenshots/, dossier.json). Tidak pernah menghapus atau menulis apa pun
// di luar folder output — pola yang sama seperti semua entry armada.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Bersihkan HANYA subfolder output.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  const p = join(outDir, name);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

// Salin game + screenshot apa adanya (byte-identik dengan repo).
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// Dossier kanonis dari isi output — harus sama dengan yang ditulis scorer.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);

console.log(`KERETA MALAM: dossier ditulis ke ${join(outDir, 'dossier.json')}`);

// Corta el render continuo en 6 inmersiones + 5 conectores para scroll-world, más versiones móviles y pósters.
// Uso (desde la raíz del repo): node videos/vuelo-chile/cortar.mjs videos/vuelo-chile/renders/vuelo.mp4
// Las uniones calzan porque conector i empieza en el mismo cuadro donde termina la inmersión i.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const DIVE = 4.5, CONN = 2.5; // mismos valores que index.html
const IDS = ['norte-grande', 'norte-chico', 'santiago', 'centro-sur', 'sur', 'austral'];
const src = process.argv[2];
if (!src) { console.error('Falta la ruta del render continuo'); process.exit(1); }
const out = 'public/vuelo';
mkdirSync(out, { recursive: true });

const ff = (...a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' });
function clip(t0, t1, nombre) {
  const corte = ['-i', src, '-ss', t0.toFixed(4), '-to', t1.toFixed(4), '-an'];
  ff(...corte, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-g', '8', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${nombre}.mp4`);
  ff(...corte, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-g', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${nombre}-m.mp4`);
}
IDS.forEach((id, i) => {
  const t0 = i * (DIVE + CONN), t1 = t0 + DIVE;
  clip(t0, t1, id);
  ff('-ss', t0.toFixed(4), '-i', src, '-frames:v', '1', '-q:v', '3', `${out}/${id}.jpg`);
  if (i < IDS.length - 1) clip(t1, t1 + CONN, `conector-${i + 1}`);
  console.log('listo', id);
});

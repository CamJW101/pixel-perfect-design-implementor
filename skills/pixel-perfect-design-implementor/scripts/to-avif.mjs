// Convert Figma PNG exports to AVIF for public/. Quality 85 + 4:4:4 chroma
// avoids banding on dark gradients and color fringing on colored glows;
// alpha is preserved.
//
//   node to-avif.mjs <outDir> <in1.png> [in2.png ...]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const [outDir, ...inputs] = process.argv.slice(2);
if (!outDir || inputs.length === 0) {
  console.error('usage: node to-avif.mjs <outDir> <in1.png> [in2.png ...]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

for (const input of inputs) {
  const out = join(outDir, basename(input).replace(/\.png$/i, '.avif'));
  await sharp(input).avif({ quality: 85, effort: 6, chromaSubsampling: '4:4:4' }).toFile(out);
  console.log('avif', out);
}

// Difference heatmap: per-pixel |design - live| amplified x3 into a PNG.
// Identical pixels are black; misplaced graphics show as solid shapes;
// faint glyph outlines are the text-antialiasing floor (stop optimizing).
//
//   node diffimg.mjs <designPng> <livePng> <designOff> <liveOff> <height> <out.png> [width]
//
// Offsets and width behave as in diffcheck.mjs (width defaults to the
// narrower image). Use 0 0 when the images are already aligned.
import sharp from 'sharp';

const [designPath, livePath, designOffArg, liveOffArg, heightArg, outPath, widthArg] = process.argv.slice(2);
if (!outPath) {
  console.error('usage: node diffimg.mjs <designPng> <livePng> <designOff> <liveOff> <height> <out.png> [width]');
  process.exit(1);
}
const designOff = Number(designOffArg);
const liveOff = Number(liveOffArg);
const height = Number(heightArg);

const [dm, lm] = await Promise.all([sharp(designPath).metadata(), sharp(livePath).metadata()]);
const width = Number(widthArg ?? Math.min(dm.width, lm.width));

const load = (p, top) =>
  sharp(p).extract({ left: 0, top, width, height }).removeAlpha().raw().toBuffer();
const design = await load(designPath, designOff);
const live = await load(livePath, liveOff);

const out = Buffer.alloc(design.length);
for (let i = 0; i < design.length; i++) {
  out[i] = Math.min(255, Math.abs(design[i] - live[i]) * 3);
}
await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(outPath);
console.log('wrote', outPath);

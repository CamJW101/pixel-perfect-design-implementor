// Recover true RGBA from two alpha-flattened Figma exports of the SAME art
// on two known solid backings (see references/figma-mcp.md, Trap 1):
//   W = A*C + (1-A)*w   (export on backing w, usually white 255)
//   G = A*C + (1-A)*g   (export on backing g, e.g. the #1E1E1E canvas = 30)
// => A = 1 - mean(W-G)/(w-g),  C = (G - (1-A)*g)/A     (exact, per pixel)
//
//   node unblend.mjs <grayPng> <whitePng> <out.(png|avif)> [grayLevel=30] [whiteLevel=255]
//
// The two exports must be the same pixel size (same node bounds, same scale).
// Sample the backing level first (corner pixel of the gray export).
import sharp from 'sharp';

const [grayPath, whitePath, outPath, gArg, wArg] = process.argv.slice(2);
const GB = Number(gArg ?? 30);
const WB = Number(wArg ?? 255);

const g = await sharp(grayPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = await sharp(whitePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (g.info.width !== w.info.width || g.info.height !== w.info.height) {
  throw new Error(`size mismatch: ${g.info.width}x${g.info.height} vs ${w.info.width}x${w.info.height}`);
}

const n = g.info.width * g.info.height;
const out = Buffer.alloc(n * 4);
for (let i = 0; i < n; i++) {
  const o = i * 4;
  const d = (w.data[o] - g.data[o]) + (w.data[o + 1] - g.data[o + 1]) + (w.data[o + 2] - g.data[o + 2]);
  let a = 1 - d / (3 * (WB - GB));
  a = Math.max(0, Math.min(1, a));
  if (a < 0.004) {
    out[o + 3] = 0;
    continue;
  }
  for (let c = 0; c < 3; c++) {
    out[o + c] = Math.max(0, Math.min(255, Math.round((g.data[o + c] - (1 - a) * GB) / a)));
  }
  out[o + 3] = Math.round(a * 255);
}

const img = sharp(out, { raw: { width: g.info.width, height: g.info.height, channels: 4 } });
if (outPath.endsWith('.avif')) {
  await img.avif({ quality: 85, effort: 6, chromaSubsampling: '4:4:4' }).toFile(outPath);
} else {
  await img.png().toFile(outPath);
}
console.log('unblended ->', outPath);

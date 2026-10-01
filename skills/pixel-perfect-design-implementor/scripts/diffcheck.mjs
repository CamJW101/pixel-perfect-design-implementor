// Rank layout mismatches: mean absolute RGB difference per 20px horizontal
// band between a reference render of the design and a live screenshot,
// worst first.
//
//   node diffcheck.mjs <designPng> <livePng> <designOff> <liveOff> <height> [width]
//
// The offsets align the two images vertically: designOff = y where comparable
// content starts in the design render, liveOff = y where it starts in the
// screenshot (they differ when your real site header replaces the chrome band
// the design reserves). Use 0 0 when the images are already aligned.
// width defaults to the narrower of the two images.
//
// Reading results: solid-graphics errors score 40+; a page whose worst bands
// are ~30-50 on text rows with overall mean ~5-8 is at the antialiasing floor.
// Inspect with diffimg.mjs before chasing further.
import sharp from 'sharp';

const [designPath, livePath, designOffArg, liveOffArg, heightArg, widthArg] = process.argv.slice(2);
if (!livePath || heightArg === undefined) {
  console.error('usage: node diffcheck.mjs <designPng> <livePng> <designOff> <liveOff> <height> [width]');
  process.exit(1);
}
const designOff = Number(designOffArg);
const liveOff = Number(liveOffArg);
const height = Number(heightArg);
const offset = designOff - liveOff;

const [dm, lm] = await Promise.all([sharp(designPath).metadata(), sharp(livePath).metadata()]);
const width = Number(widthArg ?? Math.min(dm.width, lm.width));

// removeAlpha matters: design exports are often RGBA, screenshots RGB. Without
// it the raw buffers misalign and every number is garbage.
const load = (p, top) =>
  sharp(p).extract({ left: 0, top, width, height }).removeAlpha().raw().toBuffer();
const design = await load(designPath, designOff);
const live = await load(livePath, liveOff);

const rowBytes = width * 3;
const bands = [];
for (let band = 0; band < Math.floor(height / 20); band++) {
  let sum = 0;
  for (let y = band * 20; y < band * 20 + 20; y++) {
    for (let i = y * rowBytes; i < (y + 1) * rowBytes; i++) {
      sum += Math.abs(design[i] - live[i]);
    }
  }
  bands.push({ y: band * 20, diff: sum / (20 * rowBytes) });
}
const total = bands.reduce((a, b) => a + b.diff, 0) / bands.length;
bands.sort((a, b) => b.diff - a.diff);
console.log('worst 20 bands (liveY / designY / meanAbsDiff):');
for (const b of bands.slice(0, 20)) {
  console.log(`${b.y}\t${b.y + offset}\t${b.diff.toFixed(2)}`);
}
console.log('overall mean:', total.toFixed(3));

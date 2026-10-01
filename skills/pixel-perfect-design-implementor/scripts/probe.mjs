// Measure a raster design when no structured spec exists (PNG mockup,
// screenshot, flattened export). Reads exact numbers off pixels.
//
//   node probe.mjs pixel   <img> <x> <y> [<x> <y> ...]          colors at points (hex)
//   node probe.mjs bbox    <img> <left> <top> <w> <h> [tol=12]  bounding box of content in a
//                                                                region, vs the region's corner
//                                                                pixel as background
//   node probe.mjs palette <img> <left> <top> <w> <h> [n=6]    most common colors in a region
//   node probe.mjs rows    <img> <left> <top> <w> <h> [tol=12]  runs of content rows (text lines,
//                                                                stacked items): y ranges + heights
//
// All coordinates are image pixels. bbox/rows output is in absolute image
// coordinates, so you can copy it straight into your layout.
import sharp from 'sharp';

const [mode, imgPath, ...rest] = process.argv.slice(2);
if (!mode || !imgPath) {
  console.error('usage: node probe.mjs <pixel|bbox|palette|rows> <img> ...');
  process.exit(1);
}
const { data, info } = await sharp(imgPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const at = (x, y) => {
  const i = (y * W + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const num = (i, d) => (rest[i] === undefined ? d : Number(rest[i]));
const region = () => {
  const [l, t, w, h] = [num(0), num(1), num(2), num(3)];
  if ([l, t, w, h].some(Number.isNaN)) throw new Error('need <left> <top> <w> <h>');
  return { l, t, w: Math.min(w, W - l), h: Math.min(h, H - t) };
};
const differs = (a, b, tol) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) > tol;

if (mode === 'pixel') {
  for (let i = 0; i + 1 < rest.length; i += 2) {
    const x = Number(rest[i]);
    const y = Number(rest[i + 1]);
    console.log(`(${x},${y})\t${hex(at(x, y))}`);
  }
} else if (mode === 'bbox' || mode === 'rows') {
  const { l, t, w, h } = region();
  const tol = num(4, 12);
  const bg = at(l, t);
  const rowHas = new Array(h).fill(false);
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (differs(at(l + x, t + y), bg, tol)) {
        rowHas[y] = true;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  console.log(`background ${hex(bg)} (corner pixel), tolerance ${tol}`);
  if (maxX < 0) {
    console.log('no content found');
  } else if (mode === 'bbox') {
    console.log(`bbox x=${l + minX} y=${t + minY} w=${maxX - minX + 1} h=${maxY - minY + 1}`);
  } else {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      if (y < h && rowHas[y] && start < 0) start = y;
      if ((y === h || !rowHas[y]) && start >= 0) {
        console.log(`rows y=${t + start}..${t + y - 1} h=${y - start}`);
        start = -1;
      }
    }
  }
} else if (mode === 'palette') {
  const { l, t, w, h } = region();
  const n = num(4, 6);
  const counts = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = hex(at(l + x, t + y));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const total = w * h;
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .forEach(([k, c]) => console.log(`${k}\t${((c / total) * 100).toFixed(1)}%`));
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(1);
}

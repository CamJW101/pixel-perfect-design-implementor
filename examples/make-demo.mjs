// Generates a synthetic "design" and a "live page" with deliberate mistakes,
// then runs the skill's diff tooling so you can see what the output looks like.
//
//   node examples/make-demo.mjs
//
// Writes docs/demo/{design,live,heatmap}.png and prints the diffcheck ranking.
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'demo');
const scripts = join(root, 'skills', 'pixel-perfect-design-implementor', 'scripts');
mkdirSync(out, { recursive: true });

const W = 800;
const H = 600;

// opts let the "live" page differ from the design in the three classic ways:
// a shifted element, a wrong corner radius, and a line-height / wrap error.
const page = ({ cardY, radius, lineGap, wrap }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0f172a"/>
  <rect x="0" y="0" width="${W}" height="64" fill="#1e293b"/>
  <circle cx="40" cy="32" r="14" fill="#38bdf8"/>
  <text x="400" y="190" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif"
        font-size="40" font-weight="700" fill="#f8fafc">Rebuilt right.</text>
  ${wrap
    ? `<text x="400" y="${230}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#94a3b8">
         <tspan x="400" dy="0">Every measurement comes from the design,</tspan>
         <tspan x="400" dy="${lineGap}">proven with a pixel diff.</tspan></text>`
    : `<text x="400" y="230" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#94a3b8">
         <tspan x="400" dy="0">Every measurement comes from</tspan>
         <tspan x="400" dy="${lineGap}">the design, proven with a pixel diff.</tspan></text>`}
  <rect x="140" y="${cardY}" width="520" height="190" rx="${radius}" fill="#1e293b" stroke="#334155" stroke-width="2"/>
  <rect x="170" y="${cardY + 30}" width="120" height="14" rx="7" fill="#38bdf8"/>
  <rect x="170" y="${cardY + 62}" width="460" height="10" rx="5" fill="#475569"/>
  <rect x="170" y="${cardY + 84}" width="380" height="10" rx="5" fill="#475569"/>
  <rect x="170" y="${cardY + 128}" width="150" height="40" rx="${radius}" fill="#38bdf8"/>
</svg>`;

const render = async (svg, file) => sharp(Buffer.from(svg)).png().toFile(join(out, file));
await render(page({ cardY: 300, radius: 20, lineGap: 26, wrap: true }), 'design.png');
await render(page({ cardY: 306, radius: 6, lineGap: 31, wrap: false }), 'live.png');

const run = (script, ...args) =>
  execFileSync('node', [join(scripts, script), ...args], { encoding: 'utf8' });

console.log(run('diffcheck.mjs', join(out, 'design.png'), join(out, 'live.png'), '0', '0', String(H)));
console.log(run('diffimg.mjs', join(out, 'design.png'), join(out, 'live.png'), '0', '0', String(H), join(out, 'heatmap.png')));

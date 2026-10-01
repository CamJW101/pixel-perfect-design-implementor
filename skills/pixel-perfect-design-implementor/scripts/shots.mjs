// Full-page screenshots at exact CSS-pixel widths, for diffing against Figma
// frame renders. Waits for webfonts, optionally hides overlays.
//
//   node shots.mjs <outDir> [--wait=3000] [--hide="<css selector>"] "<name>=<url>@<width>" ...
// e.g.
//   node shots.mjs ./shots --hide="#cookie-banner, .dev-toolbar" "home-desktop=http://localhost:3000/@1440"
//
// --wait   ms to sleep after fonts settle (image decode, lazy content). Default 3000.
//          Prefer this over waiting for network-idle, which never fires on pages
//          with open sockets (analytics, realtime DBs).
// --hide   CSS selector(s) to remove before capture (dev overlays, cookie banners).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const wait = Number(flag('wait', 3000));
const hide = flag('hide', '');
const [outDir, ...specs] = args.filter((a) => !a.startsWith('--'));

if (!outDir || specs.length === 0) {
  console.error('usage: node shots.mjs <outDir> [--wait=ms] [--hide=selector] "<name>=<url>@<width>" ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const spec of specs) {
  const m = spec.match(/^(.+?)=(.+)@(\d+)$/);
  if (!m) throw new Error(`bad spec: ${spec}`);
  const [, name, url, width] = m;
  const ctx = await browser.newContext({
    viewport: { width: Number(width), height: 900 },
    deviceScaleFactor: 1, // 1 CSS px = 1 image px, same space as the Figma render
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);
  if (hide) {
    await page.evaluate((sel) => document.querySelectorAll(sel).forEach((el) => el.remove()), hide);
  }
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log('shot', name);
  await ctx.close();
}
await browser.close();
console.log('DONE');

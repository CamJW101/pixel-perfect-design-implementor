# Getting the five inputs from any design source

The skill needs: **(1) reference render, (2) geometry, (3) typography,
(4) colors/radii/effects, (5) assets.** This page says where each comes from
per source. Figma-specific traps are in `figma.md`.

General rule: export the reference render at **1x of the intended CSS width**.
If a tool only exports at 2x, either downscale with sharp (lanczos) or
screenshot your page at `deviceScaleFactor: 2` and diff at 2x; just keep both
sides at the same scale and state it.

## Structured sources (tier A)

| Source | Reference render | Geometry / style spec | Assets |
|---|---|---|---|
| **Figma** | MCP `get_screenshot` (maxDimension = frame height) or REST `GET /v1/images/:key?ids=…&format=png&scale=1` | MCP `get_design_context` or REST `GET /v1/files/:key/nodes?ids=…` (`absoluteBoundingBox`, `style`, `fills`, `effects`) | MCP `download_assets`, REST image exports; SVG for vectors, `rawImages` for image fills |
| **Penpot** | Export board as PNG (right panel → Export) | Inspect tab, or open API / `.penpot` file (JSON); shapes carry x/y/width/height/fills/typography | Export SVG/PNG per shape |
| **Sketch** | `sketchtool export artboards --formats=png --scales=1` | `sketchtool dump file.sketch` (JSON: frame, style, attributedString) | `sketchtool export layers --formats=svg` |
| **Adobe XD** | Export artboards as PNG (1x) | Share → Design spec (web) gives measurements; plugins dump JSON | Mark for export; SVG for vectors |
| **Framer / Webflow / any site builder** | Screenshot the published page at the frame width | Treat the published page as an existing site (below); computed styles are the spec | Download from the published asset URLs |
| **HTML/CSS prototype** | Playwright screenshot at the frame width | The DOM itself: see "Existing site as the design" | Copy files directly |
| **Storybook / component library** | Playwright screenshot of the story iframe | `getComputedStyle` per element | Copy files directly |

## Exports plus a spec sheet (tier B)

A designer hands over PNG/SVG/PDF exports and a spec doc (spacing table,
type scale, color tokens). Use the render for diffing, the spec doc for tokens,
and `probe.mjs` to confirm the numbers against the render. Where doc and
render disagree, the render wins; report the discrepancy.

PDF design: rasterize each page to PNG at the intended width
(`pdftoppm -r <dpi> -png`, choosing dpi so width = frame width), then treat as
pixels-only below. Text in a PDF is often selectable, so copy and font names
can be extracted exactly (`pdftotext -layout`, `pdffonts`).

## Pixels only (tier C): PNG mockup or screenshot

Everything is measured. Workflow:

1. **Confirm the intended CSS width** of the image (ask if unclear). A 2880px
   image is probably a 1440 design at 2x.
2. **Layout**: `node scripts/probe.mjs rows <img> <l> <t> <w> <h>` lists text
   lines / stacked items with exact y ranges and heights;
   `bbox` gives each element's x, y, w, h. Walk the page section by section.
3. **Colors**: `probe.mjs pixel <img> x y …` on flat areas (avoid antialiased
   edges); `palette` over a region for gradients and brand colors.
4. **Type size**: cap-height or x-height from `rows`/`bbox` divided by the
   font's known ratio gives the size; line pitch (cap-top to cap-top) gives
   the line-height. Then confirm by overlaying.
5. **Font identity**: ask the user for the fonts. If they cannot supply them,
   pick the closest available face, say so, and expect text bands to stay
   above the antialiasing floor; do not claim pixel-identical text.
6. **Assets**: crop from the mockup only if nothing better exists, and say so;
   cropped art carries the mockup's backing color and compression.
7. **Radii / strokes**: zoom (`sharp` extract + resize, nearest-neighbour) on
   corners; count the pixels to the first fully-covered row.

Accuracy expectations: layout and colors converge to the same floor as tier
A; text is only as good as the font match.

## Existing site as the design

When the "design" is a live URL (clone, migration, redesign-in-place):

1. Screenshot it with `scripts/shots.mjs` at the target widths. That is the
   reference render.
2. Pull the spec from the DOM instead of measuring pixels:

   ```js
   // in Playwright page.evaluate: boxes + computed type for visible text blocks
   [...document.querySelectorAll('h1,h2,h3,p,a,button,li,img')].map((el) => {
     const r = el.getBoundingClientRect();
     const s = getComputedStyle(el);
     return { tag: el.tagName, text: el.textContent?.trim().slice(0, 60),
       x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height,
       font: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
       lh: s.lineHeight, ls: s.letterSpacing, color: s.color, bg: s.backgroundColor };
   });
   ```

3. Download the font files it loads (Network panel / `document.fonts`) and
   the image assets. Respect the site's license and copyright: only
   reproduce assets you have the right to use.

## When information is missing

Ask, in this order of priority: intended frame width(s); font files or kit;
original assets (logos, photos); copy as text (not only as pixels); which
frame is mobile vs desktop; what should happen where the design is silent
(header, footer, hover, empty states). If the user cannot supply them, proceed
with the closest reasonable choice and list it under deviations.

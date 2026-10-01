---
name: pixel-perfect-design-implementor
description: Implement a design in a web app so the rendered page is pixel-identical to it, and prove it numerically. The design can come from anywhere (Figma, Sketch, Penpot, Adobe XD, Framer, an HTML prototype, a PNG/PDF mockup, or a screenshot of an existing site) as long as it supplies a reference render plus enough measurements. Use whenever the user shares a design to implement, asks for a page or component to "match the design exactly", mentions "pixel perfect", asks to compare a live page against a design, or reports fidelity feedback such as wrong spacing, wrong line wraps, gray boxes around exported images, or wrong border radii. Covers a proportional-canvas layout system, font calibration, and a Playwright + sharp pixel-diff and difference-heatmap verification loop with bundled scripts.
---

# Pixel-Perfect Design Implementor

Turn a design into a page that is provably identical to it. The loop that
works: gather ground truth → build on a proportional canvas using the
designer's own assets → screenshot at exactly the design's size → numerically
diff against the reference render → look at the difference heatmap → fix the
worst band → repeat until only text antialiasing remains.

Default stance: the design is the spec. Match it exactly, scale elements
proportionally, take no creative liberties. Deviations are allowed only where
the design genuinely lacks something (site chrome, hover states, responsive
behavior it never shows) and must be flagged in the summary, never silent.

Scripts live in this skill's `scripts/`. They need `sharp` and
`@playwright/test` (`npm i -D sharp @playwright/test`, then
`npx playwright install chromium`). Run them with the project's Node.

## 0. Check the design source has enough information

This skill is tool-agnostic. Before building, confirm you have these five
things, from any source (`references/design-sources.md` says how to get each
from Figma, Sketch, Penpot, XD, Framer, HTML prototypes, PNG/PDF mockups, and
live sites):

| Need | Why | Minimum acceptable |
|---|---|---|
| **Reference render** at a known width | The numeric diff runs against it; wraps are read off it | One PNG of each frame at 1x (or 2x with the scale stated) |
| **Geometry** | Every element's x, y, width, height | Structured spec, or measured off the render with `scripts/probe.mjs` |
| **Typography** | Family, weight, size, line-height, tracking, color | Spec sheet, or identified from the render + the font files |
| **Colors / radii / strokes / effects** | Exact values | Spec, or sampled with `probe.mjs pixel` / `palette` |
| **Assets** | Logos, photos, icons, art with real transparency | Vector (SVG) or original uploads; flattened PNG exports only as a last resort |

If an item is missing and cannot be measured (for example the webfont files,
or the frame's intended width), **ask the user**. Do not guess silently. If
you proceed on an assumption, record it for the final summary.

Source tiers: **A** structured (Figma, Penpot, Sketch, XD, Framer, HTML
prototype) gives exact numbers; **B** exports plus a spec sheet; **C** pixels
only (PNG mockup, screenshot) means measuring everything with `probe.mjs`.
Higher tiers converge faster; lower tiers still work, but say which tier you
were on when you report results.

## 1. Collect ground truth

1. **Reference render per frame**, at 1x CSS px (e.g. 1440 desktop, 430
   mobile). Lossless PNG. This is what every diff runs against.
2. **Spec**: read geometry, text, colors, and font faces from the source's
   structured output when it exists. Treat generated code (Tailwind, CSS
   export) as a measurement sheet, not as code to paste.
3. **Assets**: prefer vector exports and original uploads. Convert committed
   rasters to AVIF with `scripts/to-avif.mjs`. **Check every export's corners
   for a baked opaque backing before using it** (flattened transparency is the
   source of "gray box around the image" feedback); recovery options are in
   `references/figma.md` (Trap 1) and apply to any tool that flattens exports.
4. **Fonts**: obtain the exact font files or webfont kit the design used. A
   similarly named local copy can run several percent off in width.

Tool-specific quirks live in `references/`: `figma.md` for the Figma MCP;
`design-sources.md` for everything else.

## 2. Build on a proportional canvas

Fixed-size frames become fixed-coordinate canvases that scale with the
viewport: pixel-perfect at frame width, proportional everywhere else. See
`references/canvas.md` for the helper pattern. In short:

- Wrap each layout in `container-type: inline-size` and set
  `--u: calc(100cqw / <frameWidth>)` on the canvas. Express every design
  measurement as `calc(var(--u) * N)`.
- Render the desktop layout above your breakpoint and the mobile layout
  below it. If your real site header differs from the chrome band the design
  reserves, content shifts by one per-frame delta; record it, because it is
  the diff offset.
- Icons and small vectors: place exported SVGs at their exact boxes. Strokes
  can bleed past the geometric box and exported SVGs include that margin;
  position by the exported box, not the shape.

## 3. Typography: calibrate, don't trust defaults

Browser text will not land on a design tool's pixels by default. Three
systematic errors must be measured and corrected per font family (procedure
in `references/calibration.md`):

- **line-height**: "Auto" leading in design tools uses different font metrics
  than the browser's `normal`. Pin an explicit unitless line-height read off
  the reference.
- **first-baseline offset**: the browser may place the first baseline
  consistently higher or lower, proportional to font size. Fix with an
  em-based `translateY`.
- **advance width / tracking**: the loaded font cut can run slightly wide or
  narrow vs the design's layout. Fix with a small em-based `letter-spacing`
  per style (upright and italic often differ).

**Force every line break** exactly where the reference breaks it (read them
off the full-res render) and set `white-space: pre`. Text boxes in designs
fill to within a few px, so natural wrapping flips on sub-percent metric
noise; hardcoded breaks are the only way wraps survive every viewport and
rasterizer. Keep hard trailing spaces on centered explicit paragraphs
(design tools count them in centering); drop them on soft-wrapped lines. Copy
text verbatim: curly quotes, double spaces and all.

## 4. Verify numerically: screenshots are not proof

Run the app's dev server, then loop:

```bash
# 1. Capture at exactly the frame's CSS width, fonts settled:
node scripts/shots.mjs <outDir> --hide=".dev-overlay" \
  "page-desktop=http://localhost:3000/some-page@1440"

# 2. Rank mismatches: mean abs RGB per 20px band, worst first.
#    <designOff>/<liveOff> align design to page (e.g. 107 64 for a frame whose
#    content starts at y107 vs the real header ending at y64; 0 0 if aligned):
node scripts/diffcheck.mjs <designPng> <shotPng> <designOff> <liveOff> <height> [width]

# 3. DIFFERENCE HEATMAP: per-pixel |design - live| amplified x3
#    (solid black = identical):
node scripts/diffimg.mjs <designPng> <shotPng> <designOff> <liveOff> <height> <out.png> [width]
```

**Always generate and look at the heatmap** (step 3), not just the band
numbers. The numbers say where; the heatmap says what. Reading it:

- Solid shapes or repeated structure (ghost doubling) = a layout/graphics
  error: wrong offset, size, line pitch, or a missing asset. Fix these.
- Faint glyph outlines only = the text-antialiasing floor. Overall means of
  roughly 5–8 with only outlines is the practical floor for HTML text; stop.
- A single text block that stays bright = wrong face or weight, not
  positioning. Check what actually painted, not just `document.fonts.check`.

Fix the worst band, re-shoot, re-diff. Also crop-compare tricky regions
(rounded-card corners, gradient seams, fine art) at 1:1, and sample exact
pixels with `scripts/probe.mjs pixel` when judging colors; downscaled
side-by-sides mislead.

Capture a few off-frame widths (e.g. 1920/1024/768/390) to prove the
proportional scaling, and run the project's typecheck, lint and production
build before calling it done.

## 5. Deliverables

- Side-by-side proof: crop matching sections from the reference render and
  the live shot (same crop, offset-adjusted). Never present the live page
  alone as "matching".
- Include the heatmaps and the overall diff means. If a review deck is asked
  for, build it from the paired crops + heatmaps + means.
- State every flagged deviation (site chrome, CTA wiring, anything the design
  lacks) and every assumption made in place of missing source information,
  plus the source tier.
- Commit assets and code together. Normalise line endings if you edited across
  Windows/Linux mounts.

## Reference files

- `references/design-sources.md`: how to get the five required inputs from
  Figma, Sketch, Penpot, Adobe XD, Framer, HTML prototypes, PNG/PDF mockups,
  and live websites.
- `references/figma.md`: Figma MCP quirks, the flattened-export trap and the
  two-backing un-blend recovery, asset-format table, blend-mode traps.
- `references/calibration.md`: why browser text misses design-tool pixels and
  the measurement procedure for line-height / baseline / tracking.
- `references/canvas.md`: the proportional-canvas CSS/helper pattern.

## Script reference

| Script | Purpose |
|---|---|
| `shots.mjs` | Full-page screenshots at exact CSS widths, fonts settled |
| `diffcheck.mjs` | Rank mismatches by 20px band, worst first |
| `diffimg.mjs` | Difference heatmap PNG (x3 amplified) |
| `probe.mjs` | Measure raster designs: pixel colors, content bbox, text rows, palette |
| `to-avif.mjs` | PNG → AVIF (q85, 4:4:4, alpha kept) |
| `unblend.mjs` | Recover true alpha from two exports on different backings |

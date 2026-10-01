# Figma MCP: pulling exact specs and usable assets

Lessons from implementing multi-frame landing pages from Figma. Use the
Figma MCP server (`whoami` should return your account; if it demands auth,
reconnect the Figma connector).

## Reading the file

- Node IDs come from the URL: `?node-id=30-162` → `30:162`.
- `get_metadata` on a whole page, and on *some individual frames*, can fail
  with `Failed to parse SSE message … EOF while parsing a string` at a
  deterministic byte. It is content-dependent transport breakage, not your
  parameters. `get_design_context` and `get_screenshot` on the same node
  usually work; use them instead of retrying.
- Metadata x/y can be wrong for flipped/rotated groups (it may print the
  bottom edge as `y`). The design-context `top/left/inset` values are
  authoritative.
- `get_design_context` output is React+Tailwind. Use it as a measurement
  sheet: absolute boxes, font faces per span, exact strings (keep double
  spaces and curly quotes), color hexes. Don't paste it as code.
- Ground-truth render: `get_screenshot` with `maxDimension` set to the
  frame's height returns a lossless 1:1 PNG (e.g. 1440×3538). Every pixel
  diff runs against this, and exact line wraps are read off it.
- Designers often keep duplicate fragment sets per page variant; hash or
  eyeball before assuming they differ. Section labels in the file are loose
  text nodes whose x-position groups the fragments around them.

## Getting assets you can actually ship

| Want | Use | Notes |
|---|---|---|
| Raster art (heroes, gradients, glows) | `download_assets` with `defaultScale: 2` | Export of the node incl. effects; convert to AVIF via `scripts/to-avif.mjs` |
| Icons / vector art | the design-context asset URL or `svgAssets` | Served as SVG: crisp at any scale; keep as `.svg` |
| Logos / photos (image fills) | `rawImages` from `download_assets` | Original uploads, highest res, alpha preserved |

Asset URLs expire (about 7 days). Download immediately and commit the bytes.

### Trap 1: exports FLATTEN transparency

`download_assets` exports composite the node onto an opaque backing: white,
or the containing frame's fill (a standalone fragment on the designer's dark
canvas bakes that gray). On the page this shows as a sharp gray/white box
outside rounded corners: the classic "exported from Figma wrong" feedback.
`rawImages` and SVG exports are NOT affected.

Recoveries, in order of preference:

1. **Draw it in CSS** when the shape is simple (a rounded rect is
   `border-radius`) and overlay only the irreducible art (its vector export).
2. **Use the SVG export** for vector art; it is transparent by nature.
3. **Un-blend two exports of the same art on different known backings**
   (e.g. the fragment export on a gray canvas and a group export on white):
   per pixel, `A = 1 − (W−G)/(255−g)`, `C = (G − (1−A)·g)/A`. Exact, not
   approximate. `scripts/unblend.mjs` implements it (pass the backing gray
   level as an argument).

Always verify with sharp before shipping an export: sample corner pixels;
`[.., .., .., 255]` in a region that should be empty means it is baked.

### Trap 2: overlay exports lose blend-mode compositing

A gradient overlay that darkens against black on the canvas can export as a
bright pastel wash when rendered in isolation (its blend modes flatten
against nothing). Only fragments the designer flattened *with their
backdrop* render true. Before "fixing" a suspicious export, compare against
the full-frame render; the frame render is the only arbiter.

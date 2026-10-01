# Font calibration: making browser text land on the design's pixels

Positions, images, and colors land exactly with a proportional canvas; text
does not, because the design tool's text engine and the browser disagree in three
independent, *systematic* ways. Left uncorrected they compound into wrong
line pitch, wrong wraps, and vertical drift: the ghost-doubling you see in a
diff heatmap.

Measure these per font family. Do not reuse numbers from another font.

## The three errors

1. **Auto line-height.** A design tool's "Auto" leading uses the font's typographic
   metrics; the browser's `normal` may use hhea/win metrics. The ratio can
   differ by 10–20%, so every multi-line block gets the wrong pitch.
   Fix: pin an explicit unitless `line-height` equal to the frame's value.

2. **First-baseline position.** With the same line box, the browser can place
   the first baseline higher or lower than the design (different ascent source).
   The offset is usually proportional to font size, so an em-based fix scales
   with a proportional canvas.
   Fix: `transform: translateY(<offset>em)` on every text block.

3. **Advance widths.** The webfont cut can run slightly wide or narrow vs the
   file's layout, and italics often differ from uprights. A locally installed
   look-alike can be several percent off.
   Fix: `letter-spacing: <delta>em` per style; set italic spans explicitly
   when nested inside upright blocks.

Put all three in one text helper (e.g. `txt()` in your theme file) so every
block gets them.

## Consequence: wraps must be forced

Designers set text boxes so lines fill them to within a few pixels. With
sub-percent width noise, *natural* wrapping is a coin flip per line, and a
wrong wrap is the most visible fidelity bug there is. So:

- Read each block's exact line breaks off the full-res frame render.
- Hardcode them (`<br />`) and set `white-space: pre` so nothing re-wraps
  (`pre` also preserves intentional double spaces).
- Centered lines: keep a hard trailing space when the design paragraph has
  one (design tools include it in centering, shifting the line about half a space
  left); drop trailing spaces at *soft* wrap points (design tools hang those).
- Left-aligned lines don't care about trailing spaces.

## Measurement procedure (do this for every new font family)

1. Build the page with `line-height: normal`, no offsets, at frame width.
2. **Line-height**: measure line pitch in the frame render (cap-top to
   cap-top across two lines of a known block, divided by font size). Compare
   with a probe div's `getBoundingClientRect().height / fontSize` in the
   browser. Pin the frame's value.
3. **Baseline**: screenshot, then scan glyph-top rows programmatically
   (sharp: first row with >N dark/light pixels in the block's box) in both
   images at 2–3 font sizes. Offset ÷ font-size is your `translateY` em value;
   confirm it is proportional across sizes before applying globally.
4. **Tracking**: measure a long line's rendered width in both (rightmost
   glyph column − leftmost). `(live/design − 1)` ≈ the letter-spacing to
   subtract, in em. Measure upright and italic separately. For deltas under
   ~0.3%, skip the correction and just force wraps.
5. Re-run the diff loop; text bands should drop to faint-outline level
   (means ~5–8 in the heatmap). If one block stays bad, its face or weight
   is probably wrong; check what actually painted, not just `fonts.check`.

## Verifying which font file shipped

`document.fonts.check` tells you a face loaded, not which one painted.
Measure candidate fonts with a hidden probe div (`font-family` forced per
candidate, `getBoundingClientRect().width`) and compare against the frame's
rendered line widths.

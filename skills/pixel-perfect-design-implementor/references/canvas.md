# Proportional canvas pattern

Goal: coordinates copied from the design stay valid at any viewport width. At the
frame width the page is pixel-identical; elsewhere everything scales together.

## CSS core

```css
.canvas {
  container-type: inline-size;       /* makes 100cqw = canvas width */
  --u: calc(100cqw / 1440);          /* 1 design px at this scale; use 430 for a mobile frame */
  position: relative;
  width: 100%;
  height: calc(var(--u) * 3538);     /* frame height */
}
.box { position: absolute; left: calc(var(--u) * 120); top: calc(var(--u) * 340);
       width: calc(var(--u) * 600); }
```

Show the desktop canvas above your breakpoint (~900px) and the mobile canvas
below it.

## Helper pattern (React/TS example)

Keep the arithmetic in tiny helpers so components read like the design file:

```ts
export const u = (n: number) => `calc(var(--u) * ${n})`;
export const pos = (x: number, y: number, w?: number, h?: number) => ({
  position: 'absolute' as const,
  left: u(x), top: u(y),
  ...(w !== undefined && { width: u(w) }),
  ...(h !== undefined && { height: u(h) }),
});
// Text: apply the three calibrated corrections (see calibration.md)
export const txt = (sizePx: number) => ({
  fontSize: u(sizePx),
  lineHeight: 1.2,                    // measured per font
  transform: 'translateY(-0.12em)',   // measured per font
  letterSpacing: '-0.006em',          // measured per font, per style
  whiteSpace: 'pre' as const,
});
```

The numbers in `txt` are placeholders; measure your own font
(`calibration.md`).

## Notes

- Strokes and effects can extend past a node's geometric box. Exported SVGs
  include that margin, so place the SVG by its exported box.
- One section per file keeps components small; keep per-variant copy in data
  files, not JSX.
- Record the vertical offset between the frame's content start and your real
  page's content start; the diff scripts need it (`figOff` / `mineOff`).

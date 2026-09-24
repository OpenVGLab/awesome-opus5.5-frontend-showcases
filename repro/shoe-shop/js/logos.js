// Brand marks, drawn in a 100×100 box. Used both as inline SVG in the UI and painted
// onto the procedural shoe textures (Path2D accepts the same path data).
export const LOGOS = {
  velox: [{ d: 'M8 18H34L62 50L34 82H8L36 50Z M42 18H68L96 50L68 82H42L70 50Z' }],
  kaze: [{ d: 'M6 64C24 30 58 22 94 30C66 34 42 46 30 66Z M20 82C40 60 66 52 94 54C70 60 52 68 42 84Z' }],
  nordvik: [{ d: 'M4 86L36 28L50 52L62 36L96 86Z' }, { d: 'M36 28L45 44L39 41L34 47L29 41Z', knock: true }],
  courtline: [{ d: 'M50 10A40 40 0 1 1 49.9 10Z M10 50H90 M36 14C54 36 54 64 36 86', stroke: 9 }],
  luma: [{ d: 'M70 10A40 40 0 0 0 70 90A50 50 0 0 1 70 10Z' }],
  pebble: [{ d: 'M50 14C78 14 94 32 92 54C90 78 70 88 48 86C24 84 8 70 10 48C12 26 26 14 50 14Z M30 46a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z M56 46a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z', evenodd: true }],
  drift: [{ d: 'M4 58C18 40 30 40 42 52C54 64 66 64 78 50C84 43 90 40 96 40V54C88 54 84 60 78 66C64 80 50 78 40 66C30 54 20 54 4 72Z' }],
  orbit: [{ d: 'M8 60C8 40 92 22 92 42C92 62 8 80 8 60Z', stroke: 7 }, { d: 'M38 50a12 12 0 1 0 24 0a12 12 0 1 0-24 0Z' }],
};

export function logoSVG(id, color = 'currentColor', size = 28) {
  const parts = LOGOS[id] || LOGOS.orbit;
  const body = parts.map((p) => {
    if (p.stroke) return `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${p.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (p.knock) return `<path d="${p.d}" fill="#fff" opacity=".85"/>`;
    return `<path d="${p.d}" fill="${color}"${p.evenodd ? ' fill-rule="evenodd"' : ''}/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

// Paint a logo on a 2D canvas context whose current transform maps the 100×100 box
// to the desired place. `color` fills; knock-out parts use `knockColor`.
export function paintLogo(ctx, id, color, knockColor) {
  const parts = LOGOS[id] || LOGOS.orbit;
  for (const p of parts) {
    const path = new Path2D(p.d);
    if (p.stroke) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = p.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(path);
      ctx.restore();
    } else if (p.knock) {
      if (knockColor) { ctx.fillStyle = knockColor; ctx.fill(path); }
    } else {
      ctx.fillStyle = color;
      ctx.fill(path, p.evenodd ? 'evenodd' : 'nonzero');
    }
  }
}

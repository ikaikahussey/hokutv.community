import { toHex, type RGB } from "./color";

/**
 * Suggest a brand color from an uploaded logo's pixels. The browser decodes the
 * image to RGBA via a canvas and passes the buffer here; this function is pure
 * and unit-testable. It ignores near-transparent and near-grayscale pixels
 * (logos are often dark text on transparency) and returns the average of the
 * most-saturated remaining pixels.
 */
export function suggestColorFromPixels(
  rgba: Uint8ClampedArray | number[],
  { sampleStep = 4 } = {}
): string | null {
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4 * sampleStep) {
    const alpha = rgba[i + 3];
    if (alpha < 128) continue; // transparent
    const cr = rgba[i];
    const cg = rgba[i + 1];
    const cb = rgba[i + 2];
    const max = Math.max(cr, cg, cb);
    const min = Math.min(cr, cg, cb);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < 0.2) continue; // near-grayscale (black/white text)
    r += cr;
    g += cg;
    b += cb;
    count++;
  }

  if (count === 0) return null;
  const avg: RGB = { r: r / count, g: g / count, b: b / count };
  return toHex(avg);
}

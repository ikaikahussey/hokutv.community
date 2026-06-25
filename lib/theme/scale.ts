import { BLACK, WHITE, mix, parseHex, toHex, type RGB } from "./color";

/**
 * Generate a full 50–950 tint/shade scale from a single primary color
 * (treated as the 500). Lighter steps mix toward white, darker toward black —
 * so an owner picks ONE color and the whole palette is derived (build-prompt §4).
 */
export type Scale = Record<
  50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950,
  string
>;

// Mix ratios toward white (tints) and black (shades) per step.
const TINTS: Array<[number, number]> = [
  [50, 0.92],
  [100, 0.82],
  [200, 0.64],
  [300, 0.44],
  [400, 0.22],
];
const SHADES: Array<[number, number]> = [
  [600, 0.12],
  [700, 0.26],
  [800, 0.42],
  [900, 0.56],
  [950, 0.72],
];

export function generateScale(primaryHex: string): Scale {
  const primary: RGB = parseHex(primaryHex);
  const out = {} as Scale;
  for (const [step, t] of TINTS) {
    out[step as keyof Scale] = toHex(mix(primary, WHITE, t));
  }
  out[500] = toHex(primary);
  for (const [step, t] of SHADES) {
    out[step as keyof Scale] = toHex(mix(primary, BLACK, t));
  }
  return out;
}

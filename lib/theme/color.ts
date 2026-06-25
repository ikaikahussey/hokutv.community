/**
 * Minimal, dependency-free color math for the theming layer.
 * sRGB hex in/out, channel mixing, and WCAG relative luminance / contrast.
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): RGB {
  const m = hex.trim().replace(/^#/, "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toHex({ r, g, b }: RGB): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => clamp(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Linear interpolate `color` toward `target` by t in [0,1], per channel. */
export function mix(color: RGB, target: RGB, t: number): RGB {
  return {
    r: color.r + (target.r - color.r) * t,
    g: color.g + (target.g - color.g) * t,
    b: color.b + (target.b - color.b) * t,
  };
}

export const WHITE: RGB = { r: 255, g: 255, b: 255 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isLight(rgb: RGB): boolean {
  return relativeLuminance(rgb) > 0.5;
}

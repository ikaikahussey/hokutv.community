import {
  BLACK,
  WHITE,
  contrastRatio,
  mix,
  parseHex,
  toHex,
  type RGB,
} from "./color";

/** Near-black "ink" used as the dark foreground option. */
export const INK: RGB = parseHex("#0b1220");

/** WCAG AA threshold for normal text. */
export const AA = 4.5;
/** WCAG AA threshold for large text / UI. */
export const AA_LARGE = 3;

/** The white/ink option with the higher contrast against `bg`. */
export function pickForeground(bg: RGB): RGB {
  return contrastRatio(WHITE, bg) >= contrastRatio(INK, bg) ? WHITE : INK;
}

export interface AccessiblePair {
  background: string;
  foreground: string;
  ratio: number;
  /** True if the background was adjusted to reach the target. */
  corrected: boolean;
}

/**
 * Return a background/foreground pair that meets `min` contrast.
 *
 * - `prefer: "auto"` — pick the better of white/ink. For AA (4.5) this is always
 *   achievable for any color, so contrast is *enforced* by construction.
 * - `prefer: "light"` — keep white text (brand wants it); if the background is
 *   too pale, *auto-correct* by darkening it until white text passes.
 * - `prefer: "dark"` — keep ink text; lighten the background until it passes.
 */
export function ensureAccessible(
  bgHex: string,
  { min = AA, prefer = "auto" as "auto" | "light" | "dark" } = {}
): AccessiblePair {
  let bg = parseHex(bgHex);

  if (prefer === "auto") {
    // Prefer the nicer ink/white pick; if it misses the target (possible on
    // mid-grays because ink isn't pure black), fall back to pure black/white,
    // which always clears AA (≥4.58:1) for any color.
    const nice = pickForeground(bg);
    const niceRatio = contrastRatio(nice, bg);
    if (niceRatio >= min) {
      return {
        background: toHex(bg),
        foreground: toHex(nice),
        ratio: niceRatio,
        corrected: false,
      };
    }
    const pure = contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg) ? WHITE : BLACK;
    return {
      background: toHex(bg),
      foreground: toHex(pure),
      ratio: contrastRatio(pure, bg),
      corrected: false,
    };
  }

  const fg = prefer === "light" ? WHITE : INK;
  const toward = prefer === "light" ? BLACK : WHITE; // darken vs lighten
  let corrected = false;
  for (let i = 0; i < 24; i++) {
    const ratio = contrastRatio(fg, bg);
    if (ratio >= min) {
      return { background: toHex(bg), foreground: toHex(fg), ratio, corrected };
    }
    bg = mix(bg, toward, 0.08);
    corrected = true;
  }
  return {
    background: toHex(bg),
    foreground: toHex(fg),
    ratio: contrastRatio(fg, bg),
    corrected: true,
  };
}

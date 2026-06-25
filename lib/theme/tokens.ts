import { generateScale } from "./scale";
import { ensureAccessible } from "./contrast";

/**
 * Brand tokens — the constrained theming surface (build-prompt §4). An owner
 * provides at most: one primary color, an optional accent, a font pairing from
 * a curated list, and a layout. Everything else (the full scale, accessible
 * foregrounds) is derived. Output is a flat map of CSS custom properties that
 * the tenant layout sets per-tenant; components only ever reference these.
 */
export interface FontPairing {
  id: string;
  label: string;
  heading: string;
  body: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "modern",
    label: "Modern",
    heading: '"Inter", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "classic",
    label: "Classic",
    heading: '"Playfair Display", Georgia, serif',
    body: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "friendly",
    label: "Friendly",
    heading: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    body: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
  },
];

export const LAYOUTS = ["starter", "classic", "bold"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export interface ThemeInput {
  primary: string;
  accent?: string;
  fontPairing: string;
  layout: LayoutId;
  logoUrl?: string;
}

export const DEFAULT_THEME_INPUT: ThemeInput = {
  primary: "#2f83f5",
  fontPairing: "modern",
  layout: "starter",
};

/** Deterministic pleasant-ish color from a seed string (demo tenants). */
export function colorFromSeed(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // Fixed S/L for a usable mid-tone primary.
  return hslToHex(hue, 65, 45);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function buildThemeVars(input: ThemeInput): Record<string, string> {
  const scale = generateScale(input.primary);
  // CTA buttons use brand-600; guarantee its text passes WCAG AA.
  const brandFg = ensureAccessible(scale[600], { prefer: "auto" }).foreground;

  const accentHex = input.accent ?? "#f59e0b";
  const accentFg = ensureAccessible(accentHex, { prefer: "auto" }).foreground;

  const pairing =
    FONT_PAIRINGS.find((p) => p.id === input.fontPairing) ?? FONT_PAIRINGS[0];

  return {
    "--brand-50": scale[50],
    "--brand-100": scale[100],
    "--brand-200": scale[200],
    "--brand-300": scale[300],
    "--brand-400": scale[400],
    "--brand-500": scale[500],
    "--brand-600": scale[600],
    "--brand-700": scale[700],
    "--brand-800": scale[800],
    "--brand-900": scale[900],
    "--brand-950": scale[950],
    "--brand-foreground": brandFg,
    "--accent-500": accentHex,
    "--accent-foreground": accentFg,
    "--font-heading": pairing.heading,
    "--font-body": pairing.body,
  };
}

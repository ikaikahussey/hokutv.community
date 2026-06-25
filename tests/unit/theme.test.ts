import { describe, it, expect } from "vitest";
import {
  parseHex,
  toHex,
  contrastRatio,
  relativeLuminance,
  WHITE,
  BLACK,
} from "@/lib/theme/color";
import { generateScale } from "@/lib/theme/scale";
import { ensureAccessible, AA, pickForeground } from "@/lib/theme/contrast";
import { buildThemeVars, DEFAULT_THEME_INPUT, colorFromSeed } from "@/lib/theme/tokens";
import { suggestColorFromPixels } from "@/lib/theme/logo";

describe("color math", () => {
  it("round-trips hex", () => {
    expect(toHex(parseHex("#2f83f5"))).toBe("#2f83f5");
    expect(toHex(parseHex("#abc"))).toBe("#aabbcc");
  });
  it("white/black contrast is 21:1", () => {
    expect(Math.round(contrastRatio(WHITE, BLACK))).toBe(21);
  });
  it("rejects bad hex", () => {
    expect(() => parseHex("nope")).toThrow();
  });
});

describe("generateScale", () => {
  const scale = generateScale("#2f83f5");
  it("keeps the primary at 500", () => {
    expect(scale[500]).toBe("#2f83f5");
  });
  it("tints get lighter, shades get darker", () => {
    expect(relativeLuminance(parseHex(scale[50]))).toBeGreaterThan(
      relativeLuminance(parseHex(scale[500]))
    );
    expect(relativeLuminance(parseHex(scale[950]))).toBeLessThan(
      relativeLuminance(parseHex(scale[500]))
    );
  });
});

describe("WCAG contrast (enforced or auto-corrected)", () => {
  it("auto picks an AA-passing foreground for any color", () => {
    for (const hex of ["#2f83f5", "#ffffff", "#000000", "#7a7a7a", "#fff7cc"]) {
      const { foreground, background, ratio } = ensureAccessible(hex);
      expect(ratio).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(parseHex(foreground), parseHex(background))).toBeGreaterThanOrEqual(AA);
    }
  });

  it("auto-corrects a too-pale background when white text is required", () => {
    const pale = "#fff7cc";
    // White on pale yellow fails AA — must be darkened.
    expect(contrastRatio(WHITE, parseHex(pale))).toBeLessThan(AA);
    const res = ensureAccessible(pale, { prefer: "light" });
    expect(res.corrected).toBe(true);
    expect(res.foreground).toBe("#ffffff");
    expect(res.ratio).toBeGreaterThanOrEqual(AA);
  });

  it("prefers white text on a saturated dark brand color", () => {
    expect(toHex(pickForeground(parseHex("#1751b4")))).toBe("#ffffff");
  });
});

describe("buildThemeVars", () => {
  it("derives the full token set and an AA-safe CTA foreground", () => {
    const vars = buildThemeVars({ ...DEFAULT_THEME_INPUT, primary: "#2f83f5" });
    expect(vars["--brand-500"]).toBe("#2f83f5");
    expect(vars["--brand-foreground"]).toBeTruthy();
    expect(vars["--font-heading"]).toContain("Inter");
    // The CTA (brand-600 bg + brand-foreground text) must pass AA.
    expect(
      contrastRatio(parseHex(vars["--brand-foreground"]), parseHex(vars["--brand-600"]))
    ).toBeGreaterThanOrEqual(AA);
  });

  it("a deliberately pale primary still yields an AA-safe CTA", () => {
    const vars = buildThemeVars({ ...DEFAULT_THEME_INPUT, primary: "#fff7cc" });
    expect(
      contrastRatio(parseHex(vars["--brand-foreground"]), parseHex(vars["--brand-600"]))
    ).toBeGreaterThanOrEqual(AA);
  });

  it("colorFromSeed is deterministic and valid", () => {
    expect(colorFromSeed("acme")).toBe(colorFromSeed("acme"));
    expect(() => parseHex(colorFromSeed("globex"))).not.toThrow();
  });
});

describe("suggestColorFromPixels", () => {
  it("ignores transparent + grayscale and averages saturated pixels", () => {
    const px = new Uint8ClampedArray([
      0, 0, 0, 0, // transparent
      128, 128, 128, 255, // gray (skip)
      200, 10, 10, 255, // red
      180, 20, 20, 255, // red
    ]);
    const hex = suggestColorFromPixels(px, { sampleStep: 1 });
    expect(hex).toBeTruthy();
    const { r, g, b } = parseHex(hex!);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("returns null when there is no saturated color", () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255, 120, 120, 120, 255]);
    expect(suggestColorFromPixels(px, { sampleStep: 1 })).toBeNull();
  });
});

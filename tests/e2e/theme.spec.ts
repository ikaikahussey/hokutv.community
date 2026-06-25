import { test, expect } from "@playwright/test";

/**
 * Theming gate: changing the primary color re-skins the preview via tokens
 * (live update), and the result stays WCAG AA. We read computed colors in the
 * browser so this asserts the real rendered outcome, not just state.
 */
function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: number[], b: number[]): number {
  const la = luminance(a[0], a[1], a[2]);
  const lb = luminance(b[0], b[1], b[2]);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
const rgb = (s: string): number[] =>
  (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

test.describe("theming UI", () => {
  test("changing the primary re-skins the preview and stays AA", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-host": "app.hoku.com" });
    await page.goto("/theme");

    const cta = page.getByTestId("preview-cta");
    const bgBefore = await cta.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );

    // Change the primary color → tokens recompute → preview re-skins.
    await page.getByTestId("primary-input").fill("#aa0000");
    // Allow React to flush the recompute.
    await expect
      .poll(async () =>
        cta.evaluate((el) => getComputedStyle(el).backgroundColor)
      )
      .not.toBe(bgBefore);

    const bgAfter = await cta.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const fg = await cta.evaluate((el) => getComputedStyle(el).color);

    // Re-skinned to a red brand-600 derived from #aa0000.
    const [r, g, b] = rgb(bgAfter);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);

    // CTA text vs background passes WCAG AA.
    expect(contrast(rgb(fg), [r, g, b])).toBeGreaterThanOrEqual(4.5);
  });
});

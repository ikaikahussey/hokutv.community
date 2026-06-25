import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderBlocks } from "@/lib/cms/blocks";
import type { Block } from "@/lib/cms/types";

/** The tenant site's rendered HTML must reflect the block JSON (the gate). */
describe("renderBlocks", () => {
  const blocks: Block[] = [
    { id: "h", type: "hero", heading: "Kalihi Coffee", subheading: "Fresh daily" },
    {
      id: "s",
      type: "services",
      heading: "Menu",
      items: [{ name: "Espresso", description: "Double shot" }, { name: "Latte" }],
    },
    {
      id: "hrs",
      type: "hours",
      rows: [{ day: "Mon", hours: "7–3" }],
    },
    { id: "c", type: "contact", phone: "808-555-0100", email: "hi@kalihi.coffee" },
  ];

  it("renders block content into HTML", () => {
    const html = renderToStaticMarkup(renderBlocks(blocks));
    expect(html).toContain("Kalihi Coffee");
    expect(html).toContain("Fresh daily");
    expect(html).toContain("Espresso");
    expect(html).toContain("Double shot");
    expect(html).toContain("Latte");
    expect(html).toContain("Mon");
    expect(html).toContain("808-555-0100");
    expect(html).toContain("hi@kalihi.coffee");
  });

  it("uses brand tokens, never hardcoded hex colors", () => {
    const html = renderToStaticMarkup(renderBlocks(blocks));
    // No inline hex colors in the rendered markup — colors come from tokens.
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(html).toMatch(/brand-/); // token-driven classes present
  });

  it("preserves block order", () => {
    const html = renderToStaticMarkup(renderBlocks(blocks));
    expect(html.indexOf("Kalihi Coffee")).toBeLessThan(html.indexOf("Espresso"));
    expect(html.indexOf("Espresso")).toBeLessThan(html.indexOf("808-555-0100"));
  });
});

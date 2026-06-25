import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/utils/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Kalihi Coffee Co.")).toBe("kalihi-coffee-co");
  });

  it("strips leading/trailing separators", () => {
    expect(slugify("  --Hello World!!  ")).toBe("hello-world");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(slugify("A & B   ///  C")).toBe("a-b-c");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Olé")).toBe("cafe-ole");
  });

  it("truncates to the max length without a trailing dash", () => {
    const long = "a".repeat(30) + " " + "b".repeat(30);
    const out = slugify(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("-")).toBe(false);
  });
});

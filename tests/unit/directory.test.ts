import { describe, it, expect } from "vitest";
import {
  filterDirectory,
  groupByCategory,
  buildDirectory,
  type DirectoryItem,
} from "@/lib/directory/queries";

const items: DirectoryItem[] = [
  { subdomain: "kalihi-coffee", category: "coffee", is_published: true, is_listed: true },
  { subdomain: "hidden-cafe", category: "coffee", is_published: true, is_listed: false },
  { subdomain: "draft", category: "coffee", is_published: false, is_listed: true },
  { subdomain: "surf-co", category: "surf", is_published: true, is_listed: true },
];

describe("directory filtering", () => {
  it("shows only published AND listed tenants", () => {
    const subs = filterDirectory(items).map((t) => t.subdomain);
    expect(subs).toContain("kalihi-coffee");
    expect(subs).toContain("surf-co");
    expect(subs).not.toContain("hidden-cafe"); // unlisted
    expect(subs).not.toContain("draft"); // unpublished
  });

  it("unlisting removes a tenant", () => {
    const before = filterDirectory(items).length;
    const after = filterDirectory(
      items.map((t) =>
        t.subdomain === "surf-co" ? { ...t, is_listed: false } : t
      )
    ).length;
    expect(after).toBe(before - 1);
  });

  it("filters by category", () => {
    const subs = filterDirectory(items, { category: "surf" }).map((t) => t.subdomain);
    expect(subs).toEqual(["surf-co"]);
  });

  it("searches by subdomain or category", () => {
    expect(filterDirectory(items, { search: "kalihi" }).map((t) => t.subdomain)).toEqual([
      "kalihi-coffee",
    ]);
    expect(filterDirectory(items, { search: "surf" }).map((t) => t.subdomain)).toEqual([
      "surf-co",
    ]);
  });
});

describe("grouping + pagination", () => {
  it("groups by category, sorted", () => {
    const groups = groupByCategory(filterDirectory(items));
    expect(groups.map((g) => g.category)).toEqual(["coffee", "surf"]);
  });

  it("paginates and reports totals + categories", () => {
    const many: DirectoryItem[] = Array.from({ length: 30 }, (_, i) => ({
      subdomain: `biz-${String(i).padStart(2, "0")}`,
      category: "coffee",
      is_published: true,
      is_listed: true,
    }));
    const p1 = buildDirectory(many, { page: 1, pageSize: 24 });
    expect(p1.total).toBe(30);
    expect(p1.groups[0].items).toHaveLength(24);
    expect(p1.categories).toEqual(["coffee"]);
    const p2 = buildDirectory(many, { page: 2, pageSize: 24 });
    expect(p2.groups[0].items).toHaveLength(6);
  });
});

import { describe, it, expect } from "vitest";
import {
  emptyDoc,
  addBlock,
  addBlockOfType,
  updateBlock,
  removeBlock,
  reorder,
  moveBlock,
  publish,
  unpublish,
  isPublic,
} from "@/lib/cms/page-ops";
import type { Page } from "@/lib/cms/types";

describe("page-ops: create → edit → reorder → publish", () => {
  it("creates blocks (with generated or explicit ids)", () => {
    let doc = emptyDoc();
    doc = addBlock(doc, { type: "hero", heading: "Acme", id: "h1" });
    doc = addBlockOfType(doc, "contact", "c1");
    expect(doc.blocks.map((b) => b.id)).toEqual(["h1", "c1"]);
    expect(doc.blocks[0].type).toBe("hero");
    expect(doc.blocks[1].type).toBe("contact");
  });

  it("generates an id when none is supplied", () => {
    const doc = addBlock(emptyDoc(), { type: "hero", heading: "X" });
    expect(doc.blocks[0].id).toBeTruthy();
  });

  it("edits a block immutably", () => {
    const doc = addBlock(emptyDoc(), { type: "hero", heading: "Old", id: "h1" });
    const next = updateBlock(doc, "h1", { heading: "New" } as Partial<typeof doc.blocks[0]>);
    expect((next.blocks[0] as { heading: string }).heading).toBe("New");
    expect((doc.blocks[0] as { heading: string }).heading).toBe("Old"); // original unchanged
  });

  it("reorders by index and by direction", () => {
    let doc = emptyDoc();
    doc = addBlock(doc, { type: "hero", heading: "A", id: "a" });
    doc = addBlock(doc, { type: "contact", id: "b" });
    doc = addBlockOfType(doc, "hours", "c");

    expect(reorder(doc, 0, 2).blocks.map((b) => b.id)).toEqual(["b", "c", "a"]);
    expect(moveBlock(doc, "c", -1).blocks.map((b) => b.id)).toEqual(["a", "c", "b"]);
    expect(moveBlock(doc, "a", -1).blocks.map((b) => b.id)).toEqual(["a", "b", "c"]); // clamp
  });

  it("removes a block", () => {
    let doc = addBlock(emptyDoc(), { type: "hero", heading: "A", id: "a" });
    doc = addBlockOfType(doc, "contact", "b");
    expect(removeBlock(doc, "a").blocks.map((x) => x.id)).toEqual(["b"]);
  });

  it("publishes and unpublishes", () => {
    const page: Page = {
      id: "p1",
      tenant_id: "t1",
      slug: "home",
      title: "Home",
      status: "draft",
      body_json: emptyDoc(),
    };
    expect(isPublic(page)).toBe(false);
    const live = publish(page);
    expect(live.status).toBe("published");
    expect(isPublic(live)).toBe(true);
    expect(unpublish(live).status).toBe("draft");
  });
});

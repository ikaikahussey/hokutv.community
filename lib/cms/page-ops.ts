import type { Block, BlockType, Page, PageDoc } from "./types";

/**
 * Pure page-editing operations. The editor UI and its persistence action are
 * thin wrappers over these, so create → edit → reorder → publish is fully
 * unit-testable without a database or a browser.
 *
 * Every function returns a NEW doc/page (immutable) so React state + optimistic
 * UI stay predictable.
 */

function newId(): string {
  // crypto.randomUUID is available in Node 19+ and the browser.
  return globalThis.crypto?.randomUUID?.() ?? `b_${Math.random().toString(36).slice(2)}`;
}

export const BLOCK_DEFAULTS: { [K in BlockType]: () => Omit<Extract<Block, { type: K }>, "id"> } = {
  hero: () => ({ type: "hero", heading: "Your business name", subheading: "" }),
  services: () => ({ type: "services", heading: "Services", items: [] }),
  hours: () => ({ type: "hours", heading: "Hours", rows: [] }),
  gallery: () => ({ type: "gallery", heading: "Gallery", images: [] }),
  contact: () => ({ type: "contact", heading: "Contact" }),
  map: () => ({ type: "map", heading: "Find us", query: "" }),
};

export function emptyDoc(): PageDoc {
  return { blocks: [] };
}

/** Append a block. If `block.id` is absent, one is generated. */
export function addBlock(doc: PageDoc, block: Omit<Block, "id"> & { id?: string }): PageDoc {
  const withId = { ...block, id: block.id ?? newId() } as Block;
  return { ...doc, blocks: [...doc.blocks, withId] };
}

/** Create a default block of a given type and append it. */
export function addBlockOfType(doc: PageDoc, type: BlockType, id?: string): PageDoc {
  return addBlock(doc, { ...BLOCK_DEFAULTS[type](), id } as Omit<Block, "id"> & { id?: string });
}

/** Shallow-merge a patch into the block with the given id. */
export function updateBlock(doc: PageDoc, id: string, patch: Partial<Block>): PageDoc {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
  };
}

export function removeBlock(doc: PageDoc, id: string): PageDoc {
  return { ...doc, blocks: doc.blocks.filter((b) => b.id !== id) };
}

/** Move the block at `from` to `to`, clamping indices. */
export function reorder(doc: PageDoc, from: number, to: number): PageDoc {
  const blocks = [...doc.blocks];
  if (from < 0 || from >= blocks.length) return doc;
  const clampedTo = Math.max(0, Math.min(to, blocks.length - 1));
  const [moved] = blocks.splice(from, 1);
  blocks.splice(clampedTo, 0, moved);
  return { ...doc, blocks };
}

/** Move a block up (-1) or down (+1) by id. */
export function moveBlock(doc: PageDoc, id: string, dir: -1 | 1): PageDoc {
  const idx = doc.blocks.findIndex((b) => b.id === id);
  if (idx === -1) return doc;
  return reorder(doc, idx, idx + dir);
}

export function publish(page: Page): Page {
  return { ...page, status: "published" };
}

export function unpublish(page: Page): Page {
  return { ...page, status: "draft" };
}

export function isPublic(page: Pick<Page, "status">): boolean {
  return page.status === "published";
}

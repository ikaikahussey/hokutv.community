"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addBlockOfType,
  emptyDoc,
  moveBlock,
  removeBlock,
  updateBlock,
} from "@/lib/cms/page-ops";
import { renderBlocks, BLOCK_LABELS } from "@/lib/cms/blocks";
import type { BlockType, PageDoc, PageStatus } from "@/lib/cms/types";
import { savePage, type SaveResult } from "./actions";

const ADDABLE: BlockType[] = ["hero", "services", "hours", "contact"];

export default function EditorPage() {
  const [doc, setDoc] = useState<PageDoc>(emptyDoc());
  const [title, setTitle] = useState("Home");
  const [status, setStatus] = useState<PageStatus>("draft");
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<SaveResult | null>(null);

  const heroId = useMemo(
    () => doc.blocks.find((b) => b.type === "hero")?.id,
    [doc]
  );
  const heroHeading = useMemo(() => {
    const hero = doc.blocks.find((b) => b.type === "hero");
    return hero && hero.type === "hero" ? hero.heading : "";
  }, [doc]);

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-2">
      {/* Editor pane */}
      <section aria-label="editor" className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold text-ink">Page editor</h1>

        <div className="flex items-center gap-2">
          <span
            data-testid="status"
            className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
          >
            {status}
          </span>
          <button
            type="button"
            onClick={() =>
              setStatus((s) => (s === "published" ? "draft" : "published"))
            }
            className="rounded-md border border-brand-200 px-3 py-1 text-sm text-brand-700 hover:bg-brand-50"
          >
            {status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ADDABLE.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDoc((d) => addBlockOfType(d, t))}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-700"
            >
              Add {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>

        {heroId ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink/70">Hero heading</span>
            <input
              data-testid="hero-heading"
              value={heroHeading}
              onChange={(e) =>
                setDoc((d) => updateBlock(d, heroId, { heading: e.target.value }))
              }
              className="rounded-md border border-brand-200 px-3 py-2"
            />
          </label>
        ) : null}

        <ol className="flex flex-col gap-2" data-testid="block-list">
          {doc.blocks.map((b, i) => (
            <li
              key={b.id}
              data-testid={`row-${i}`}
              className="flex items-center justify-between rounded-md border border-brand-100 px-3 py-2"
            >
              <span className="font-medium text-ink">{BLOCK_LABELS[b.type]}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => setDoc((d) => moveBlock(d, b.id, -1))}
                  className="rounded border border-brand-200 px-2"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => setDoc((d) => moveBlock(d, b.id, 1))}
                  className="rounded border border-brand-200 px-2"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setDoc((d) => removeBlock(d, b.id))}
                  className="rounded border border-brand-200 px-2 text-red-600"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            startSave(async () => {
              const res = await savePage({ slug: "home", title, status, body_json: doc });
              setSaveMsg(res);
            })
          }
          className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saveMsg ? (
          <p role="status" className="text-sm text-ink/70">
            {saveMsg.message}
          </p>
        ) : null}
        <input type="hidden" value={title} onChange={() => {}} />
      </section>

      {/* Live preview pane — reuses the exact tenant renderer */}
      <section
        aria-label="preview"
        data-testid="preview"
        className="overflow-hidden rounded-lg border border-brand-100"
      >
        {doc.blocks.length ? (
          renderBlocks(doc.blocks)
        ) : (
          <p className="p-6 text-ink/50">Add a block to see your site.</p>
        )}
      </section>
    </main>
  );
}

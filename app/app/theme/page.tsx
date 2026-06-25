"use client";

import { type CSSProperties, useMemo, useState, useTransition } from "react";
import {
  buildThemeVars,
  DEFAULT_THEME_INPUT,
  FONT_PAIRINGS,
  LAYOUTS,
  type LayoutId,
  type ThemeInput,
} from "@/lib/theme/tokens";
import { suggestColorFromPixels } from "@/lib/theme/logo";
import { saveTheme, type SaveThemeResult } from "./actions";

export default function ThemePage() {
  const [input, setInput] = useState<ThemeInput>(DEFAULT_THEME_INPUT);
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<SaveThemeResult | null>(null);

  const vars = useMemo(() => buildThemeVars(input), [input]);
  const set = (patch: Partial<ThemeInput>) => setInput((p) => ({ ...p, ...patch }));

  async function onLogo(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const suggested = suggestColorFromPixels(data);
      if (suggested) set({ primary: suggested, logoUrl: undefined });
    } catch {
      /* ignore — keep current color */
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-2">
      <section aria-label="theme controls" className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold text-ink">Brand theme</h1>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink/70">Primary color</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              aria-label="primary color swatch"
              value={input.primary}
              onChange={(e) => set({ primary: e.target.value })}
            />
            <input
              data-testid="primary-input"
              aria-label="primary color hex"
              value={input.primary}
              onChange={(e) => set({ primary: e.target.value })}
              className="w-32 rounded-md border border-brand-200 px-2 py-1 font-mono"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink/70">Font pairing</span>
          <select
            data-testid="font-select"
            value={input.fontPairing}
            onChange={(e) => set({ fontPairing: e.target.value })}
            className="rounded-md border border-brand-200 px-2 py-1"
          >
            {FONT_PAIRINGS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink/70">Layout</span>
          <select
            value={input.layout}
            onChange={(e) => set({ layout: e.target.value as LayoutId })}
            className="rounded-md border border-brand-200 px-2 py-1"
          >
            {LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink/70">Logo (suggests a color)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLogo(f);
            }}
          />
        </label>

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            startSave(async () => setMsg(await saveTheme(input)))
          }
          className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save theme"}
        </button>
        {msg ? (
          <p role="status" className="text-sm text-ink/70">
            {msg.message}
          </p>
        ) : null}
      </section>

      {/* Live preview — token-driven, re-skins on every input change */}
      <section
        aria-label="preview"
        style={vars as CSSProperties}
        className="overflow-hidden rounded-lg border border-brand-100 font-body"
      >
        <header className="bg-brand-600 px-6 py-10 text-center text-brand-foreground">
          <h2 className="font-heading text-2xl font-bold">Your business</h2>
          <p className="opacity-90">Looks great on every device.</p>
        </header>
        <div className="space-y-3 p-6">
          <button
            type="button"
            data-testid="preview-cta"
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-brand-foreground"
          >
            Book now
          </button>
          <div className="rounded-md bg-brand-50 p-3 text-brand-800">
            A tinted surface using the same brand scale.
          </div>
        </div>
      </section>
    </main>
  );
}

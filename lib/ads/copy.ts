/**
 * Ad-copy suggestions (build-prompt §2/§8 — "Optional Anthropic-API copy
 * suggestions"). The generator is dependency-injected so the wizard works
 * offline with a deterministic local fallback and the Anthropic path is
 * unit-testable without a live key or network.
 */
export interface CopyContext {
  businessName: string;
  category?: string;
  offer?: string;
}

export interface CopySuggestion {
  headlines: string[];
  ctas: string[];
}

export type CopyGenerator = (ctx: CopyContext) => Promise<CopySuggestion>;

/** Deterministic, no-network suggestions — the default and offline fallback. */
export function localCopySuggestions(ctx: CopyContext): CopySuggestion {
  const name = ctx.businessName.trim() || "Your business";
  const cat = ctx.category?.trim();
  const headlines = [
    cat ? `${name} — ${cat} done right` : `Discover ${name}`,
    ctx.offer ? `${ctx.offer} at ${name}` : `${name}, just around the corner`,
    `Locals love ${name}`,
  ];
  const ctas = ["Visit us", "Book now", cat ? `See our ${cat}` : "Learn more"];
  return { headlines, ctas };
}

/** Strict shape guard for model output (which is untrusted text). */
export function parseSuggestion(value: unknown): CopySuggestion | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const strs = (x: unknown): string[] | null =>
    Array.isArray(x) && x.every((s) => typeof s === "string" && s.trim())
      ? (x as string[]).map((s) => s.trim())
      : null;
  const headlines = strs(v.headlines);
  const ctas = strs(v.ctas);
  if (!headlines || !ctas) return null;
  return { headlines: headlines.slice(0, 5), ctas: ctas.slice(0, 5) };
}

export interface AnthropicOptions {
  apiKey: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  model?: string;
}

/**
 * Build an Anthropic Messages-API-backed generator. Returns short JSON the
 * model is instructed to emit; on any malformed/empty response the caller's
 * `suggestCopy` wrapper falls back to local suggestions.
 */
export function anthropicCopyGenerator(opts: AnthropicOptions): CopyGenerator {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const model = opts.model ?? "claude-haiku-4-5-20251001";
  return async (ctx) => {
    const prompt =
      `Write ad copy for a local business ad. Business: ${ctx.businessName}.` +
      (ctx.category ? ` Category: ${ctx.category}.` : "") +
      (ctx.offer ? ` Offer: ${ctx.offer}.` : "") +
      ` Respond with ONLY JSON of the form {"headlines": string[3], "ctas": string[3]}.` +
      ` Headlines under 40 characters, CTAs under 20 characters.`;
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.map((c) => c.text ?? "").join("") ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? parseSuggestion(JSON.parse(match[0])) : null;
    if (!parsed) throw new Error("anthropic: unparseable copy");
    return parsed;
  };
}

/**
 * Get copy suggestions, preferring an injected generator (Anthropic) and
 * degrading to deterministic local copy on any error. Never throws.
 */
export async function suggestCopy(
  ctx: CopyContext,
  gen?: CopyGenerator
): Promise<CopySuggestion> {
  if (!gen) return localCopySuggestions(ctx);
  try {
    return await gen(ctx);
  } catch {
    return localCopySuggestions(ctx);
  }
}

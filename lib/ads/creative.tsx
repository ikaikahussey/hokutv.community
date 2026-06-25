import type { CSSProperties, JSX } from "react";

/**
 * Token-driven ad creatives (build-prompt §8). Inputs are limited to
 * headline/offer/CTA/URL; logo/colors/font come from the tenant's brand tokens.
 * Variants are token-driven renders (not baked images) so they re-skin with the
 * brand and never hardcode color.
 */
export interface CreativeInput {
  headline: string;
  offer?: string;
  cta: string;
  url: string;
}

export type AdLayout = "banner" | "card" | "text";

export interface CreativeVariant {
  variant: string;
  layout: AdLayout;
  headline: string;
  offer?: string;
  cta: string;
  url: string;
  brand: Record<string, string>;
}

const LAYOUTS: AdLayout[] = ["banner", "card", "text"];

export function generateVariants(
  input: CreativeInput,
  brandVars: Record<string, string>
): CreativeVariant[] {
  return LAYOUTS.map((layout, i) => ({
    variant: String.fromCharCode(97 + i), // a, b, c
    layout,
    headline: input.headline,
    offer: input.offer,
    cta: input.cta,
    url: input.url,
    brand: brandVars,
  }));
}

/** Render a variant on-brand. All color comes from the brand tokens. */
export function renderAd(v: CreativeVariant): JSX.Element {
  return (
    <a
      href={v.url}
      style={v.brand as CSSProperties}
      className="block rounded-lg bg-brand-600 p-4 font-body text-brand-foreground no-underline"
    >
      <p className="font-heading text-lg font-bold">{v.headline}</p>
      {v.offer ? <p className="text-sm opacity-90">{v.offer}</p> : null}
      <span className="mt-2 inline-block rounded bg-brand-foreground px-3 py-1 text-sm font-medium text-brand-700">
        {v.cta}
      </span>
    </a>
  );
}

import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/utils/slug";
import { buildThemeVars, colorFromSeed, DEFAULT_THEME_INPUT } from "@/lib/theme/tokens";
import type { AcqRepo, Business, ProvisionalSite } from "./types";

/**
 * Privacy guardrail (acquisition-module.md §5.1): a provisional tenant is
 * ALWAYS noindex/unlisted/unpublished until a verified claim.
 */
export const PROVISIONAL_TENANT_FLAGS = {
  status: "provisional" as const,
  is_published: false,
  is_listed: false,
};

/** Block content seeded only from verified Places fields — no invented facts. */
export function starterPage(b: Business) {
  return {
    blocks: [
      { id: "hero", type: "hero", heading: b.name, subheading: "Unofficial preview — claim to take control" },
      { id: "contact", type: "contact", phone: b.phone ?? undefined, address: `${b.address.line1}, ${b.address.city}` },
      { id: "hours", type: "hours", heading: "Hours", rows: [], note: "Add your hours when you claim this site" },
    ],
  };
}

/** Supabase (service-role) implementation of the acquisition repo. */
export function createAcqRepo(config: { provisionalHost: string }): AcqRepo {
  const db = createSupabaseServiceClient();
  return {
    async isSuppressed(b) {
      const { data } = await db
        .from("acq_suppression")
        .select("id")
        .or(`place_id.eq.${b.placeId},zip.eq.${b.address.zip}`)
        .limit(1);
      return Boolean(data && data.length);
    },
    async isSeen(placeId) {
      const { data } = await db
        .from("acq_prospects")
        .select("id")
        .eq("place_id", placeId)
        .limit(1);
      return Boolean(data && data.length);
    },
    async createProvisionalSite(b): Promise<ProvisionalSite> {
      const claimToken = crypto.randomBytes(16).toString("hex");
      const subdomain = slugify(b.name);
      const theme = { ...DEFAULT_THEME_INPUT, primary: b.primaryColor ?? colorFromSeed(b.name) };
      const { data: tenant, error } = await db
        .from("tenants")
        .insert({ subdomain, category: b.category, theme, ...PROVISIONAL_TENANT_FLAGS })
        .select()
        .single();
      if (error) throw error;
      const tenantId = (tenant as { id: string }).id;
      await db.from("pages").insert({
        tenant_id: tenantId,
        slug: "home",
        title: b.name,
        status: "provisional",
        body_json: starterPage(b),
      });
      // Build theme vars eagerly so the preview render is on-brand.
      buildThemeVars(theme);
      return {
        tenantId,
        subdomain,
        previewUrl: `https://${config.provisionalHost}/p/${tenantId}`,
        claimToken,
      };
    },
    async recordProspect(input) {
      await db.from("acq_prospects").insert({
        place_id: input.placeId,
        tenant_id: input.tenantId,
        business_name: input.businessName,
        mail_address: input.mailAddress,
        claim_token: input.claimToken,
        status: "site_generated",
      });
    },
    async markPostcardSent(claimToken, postcardId) {
      await db
        .from("acq_prospects")
        .update({ status: "postcard_sent", postcard_id: postcardId })
        .eq("claim_token", claimToken);
    },
  };
}

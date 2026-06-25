/**
 * Tenant subsite root (*.hokusites.com / custom domains). Reached via the host
 * rewrite "/" → "/s/<subdomain>". Server-renders the tenant's published home
 * page from block JSON, scoped under the tenant's derived brand tokens. An
 * unpublished or missing page 404s publicly (RLS hides it at the data layer).
 */
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { renderBlocks } from "@/lib/cms/blocks";
import { getPublishedSite } from "@/lib/cms/queries";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const site = await getPublishedSite(subdomain);
  if (!site) notFound();

  // Per-tenant brand tokens scoped to this subtree — re-skins every block
  // without a rebuild (build-prompt §4).
  return (
    <div style={site.themeVars as CSSProperties} className="font-body">
      <main>{renderBlocks(site.page.body_json.blocks)}</main>
    </div>
  );
}

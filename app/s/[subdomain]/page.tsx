/**
 * Tenant subsite root (*.hokusites.com / custom domains). Reached via the host
 * rewrite "/" → "/s/<subdomain>". Server-renders the tenant's published home
 * page from block JSON under their brand theme. An unpublished or missing page
 * 404s publicly — enforced by RLS at the data layer (anon can't read it).
 */
import { notFound } from "next/navigation";
import { renderBlocks } from "@/lib/cms/blocks";
import { getPublishedHomePage } from "@/lib/cms/queries";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const page = await getPublishedHomePage(subdomain);
  if (!page) notFound();

  return <main>{renderBlocks(page.body_json.blocks)}</main>;
}

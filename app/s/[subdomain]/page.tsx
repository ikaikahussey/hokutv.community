/**
 * Tenant subsite root (*.hokusites.com and, later, custom domains). Reached via
 * the host rewrite "/" → "/s/<subdomain>". In later phases this server-renders
 * the tenant's published CMS blocks under their brand theme; for now it proves
 * the routing resolves the right tenant and 404s unknown ones.
 */
import { notFound } from "next/navigation";

// Phase 1 stand-in for the tenant lookup that Phase 2's `tenants` table provides.
// Until the DB exists, treat any non-empty subdomain as "resolvable" so routing
// is testable; Phase 2 replaces this with a real query that 404s missing tenants.
function tenantExists(subdomain: string): boolean {
  return subdomain.length > 0 && /^[a-z0-9-]+$/.test(subdomain);
}

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  if (!tenantExists(subdomain)) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-heading text-3xl font-bold text-brand-700">
        {subdomain}
      </h1>
      <p className="text-ink/70">
        Tenant subsite for <code>{subdomain}</code>.hokusites.com — content
        renders here once the CMS lands (Phase 3).
      </p>
    </main>
  );
}

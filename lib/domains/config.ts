/**
 * Domain configuration — the load-bearing security boundary from build-prompt §3.
 *
 * Two registrable domains, intentionally NOT collapsed:
 *   hoku.com         → marketing + directory (apex)
 *   app.hoku.com     → auth, admin, CMS, ad-buying (control plane)
 *   ads.hoku.com     → ad serving (isolated, unauthenticated)
 *   *.hokusites.com  → tenant subsites (separate eTLD+1)
 *   {custom domains} → paid tenants (resolved by DB lookup; see Phase 5)
 *
 * Values come from env so local dev can emulate with `*.localhost` /
 * `hokusites.localhost` (see README). Defaults are the production hosts.
 */
export interface DomainConfig {
  /** Apex marketing/directory domain, e.g. "hoku.com". */
  appBaseDomain: string;
  /** Tenant subsite eTLD+1, e.g. "hokusites.com". */
  tenantBaseDomain: string;
  /** Fully-qualified ad-serving host, e.g. "ads.hoku.com". */
  adsHost: string;
}

export function getDomainConfig(
  env: Record<string, string | undefined> = process.env
): DomainConfig {
  // On Vercel with no custom domains yet (demo deploy), fall back to the
  // project's production *.vercel.app host so the apex (marketing + directory)
  // resolves out of the box instead of 404-ing as an unknown/custom host. A
  // real deployment sets APP_BASE_DOMAIN explicitly, so this never applies there.
  const apexFallback = env.VERCEL_PROJECT_PRODUCTION_URL ?? "hoku.com";
  return {
    appBaseDomain: env.APP_BASE_DOMAIN ?? apexFallback,
    tenantBaseDomain: env.TENANT_BASE_DOMAIN ?? "hokusites.com",
    adsHost: env.ADS_HOST ?? "ads.hoku.com",
  };
}

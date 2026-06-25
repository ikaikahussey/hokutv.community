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
  return {
    appBaseDomain: env.APP_BASE_DOMAIN ?? "hoku.com",
    tenantBaseDomain: env.TENANT_BASE_DOMAIN ?? "hokusites.com",
    adsHost: env.ADS_HOST ?? "ads.hoku.com",
  };
}

import type { DomainConfig } from "./config";

/**
 * Which trust zone a request host belongs to. Middleware uses this to rewrite
 * into a collision-free internal segment and to enforce the cookie boundary.
 */
export type Zone = "apex" | "app" | "ads" | "tenant" | "custom" | "unknown";

export interface HostResolution {
  zone: Zone;
  /** Normalized host (lowercased, no port, no trailing dot). */
  host: string;
  /** Present for `tenant` — the subdomain label(s) left of the tenant base. */
  subdomain?: string;
  /**
   * Internal path prefix to rewrite into. "" for apex (marketing serves "/"),
   * "/app", "/ads", or "/s/<subdomain>" for tenants. Never user-visible.
   */
  rewriteBase: string;
}

/**
 * Internal rewrite targets. External requests must never reach these directly
 * on the apex (marketing) domain — middleware 404s them so internal segments
 * don't leak into the public, indexable surface.
 */
export const RESERVED_PREFIXES = ["/app", "/ads", "/s"] as const;

function normalizeHost(raw: string): string {
  return raw
    .split(",")[0] // x-forwarded-host can be a list
    .trim()
    .split(":")[0] // strip port
    .toLowerCase()
    .replace(/\.$/, ""); // strip FQDN trailing dot
}

/**
 * Map a request host to its trust zone. Pure and synchronous so it is fully
 * unit-testable and safe to run in the edge middleware.
 *
 * Custom domains (paid tenants) are resolved by DB lookup in Phase 5; until
 * then any host that doesn't match a known pattern is `unknown` (→ 404).
 */
export function resolveHost(rawHost: string, cfg: DomainConfig): HostResolution {
  const host = normalizeHost(rawHost ?? "");

  if (!host) return { zone: "unknown", host, rewriteBase: "" };

  // Local-dev convenience: the default `localhost` (no /etc/hosts emulation)
  // behaves as the apex so `npm run dev` works out of the box.
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return { zone: "apex", host, rewriteBase: "" };
  }

  const { appBaseDomain, tenantBaseDomain, adsHost } = cfg;

  if (host === appBaseDomain || host === `www.${appBaseDomain}`) {
    return { zone: "apex", host, rewriteBase: "" };
  }
  if (host === `app.${appBaseDomain}`) {
    return { zone: "app", host, rewriteBase: "/app" };
  }
  if (host === adsHost) {
    return { zone: "ads", host, rewriteBase: "/ads" };
  }

  // Tenant subsites live on a different registrable domain.
  const tenantSuffix = `.${tenantBaseDomain}`;
  if (host.endsWith(tenantSuffix)) {
    const subdomain = host.slice(0, -tenantSuffix.length);
    if (subdomain && !subdomain.includes(" ")) {
      return { zone: "tenant", host, subdomain, rewriteBase: `/s/${subdomain}` };
    }
  }

  // A paid tenant's custom domain: any external FQDN that isn't one of our own
  // domains. Routed to the tenant lookup by hostname (resolved against
  // tenants.custom_domain); 404s if no tenant claims it.
  if (
    host.includes(".") &&
    host !== appBaseDomain &&
    host !== tenantBaseDomain &&
    !host.endsWith(`.${appBaseDomain}`)
  ) {
    return { zone: "custom", host, subdomain: host, rewriteBase: `/s/${host}` };
  }

  return { zone: "unknown", host, rewriteBase: "" };
}

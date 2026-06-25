import { NextRequest, NextResponse } from "next/server";
import { getDomainConfig } from "@/lib/domains/config";
import { resolveHost, RESERVED_PREFIXES } from "@/lib/domains/resolve-host";
import { applySecurityHeaders } from "@/lib/security/headers";

/**
 * Host-based router (build-prompt §3, Phase 1).
 *
 * Reads the request host (`x-forwarded-host` from the proxy, falling back to
 * `host`), resolves its trust zone, and rewrites to a collision-free internal
 * segment. The marketing route group serves the apex at "/"; app/ads/tenant
 * content lives behind internal `/app`, `/ads`, `/s/<sub>` prefixes that are
 * only reachable via this rewrite — never directly.
 */
export function middleware(req: NextRequest): NextResponse {
  const cfg = getDomainConfig();
  const rawHost =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const resolution = resolveHost(rawHost, cfg);
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Unknown host → 404 (custom domains become tenants via DB lookup in Phase 5).
  if (resolution.zone === "unknown") {
    return applySecurityHeaders(new NextResponse("Unknown host", { status: 404 }));
  }

  if (resolution.zone === "apex") {
    // Don't let internal rewrite segments leak onto the public marketing domain.
    if (
      RESERVED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
    ) {
      return applySecurityHeaders(new NextResponse("Not found", { status: 404 }));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // app / ads / tenant: rewrite "/<path>" → "<rewriteBase><path>".
  url.pathname = `${resolution.rewriteBase}${path === "/" ? "" : path}` || "/";
  const res = applySecurityHeaders(NextResponse.rewrite(url));
  // Surface the resolved tenant to server components without re-parsing host.
  if (resolution.subdomain) {
    res.headers.set("x-hoku-tenant", resolution.subdomain);
  }
  res.headers.set("x-hoku-zone", resolution.zone);
  // Public tenant content is cacheable at the edge.
  if (resolution.zone === "tenant" || resolution.zone === "custom") {
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  }
  return res;
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

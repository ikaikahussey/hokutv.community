/**
 * Baseline security headers applied to every response in middleware (Phase 9).
 * Kept conservative so they don't break Next's inline styles/scripts; a strict
 * CSP would need nonce plumbing and is left as a follow-up.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export function applySecurityHeaders<T extends { headers: Headers }>(res: T): T {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

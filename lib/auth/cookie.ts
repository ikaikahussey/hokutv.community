/**
 * Auth cookie scoping — build-prompt §3 "Hard rules".
 *
 * The session cookie is scoped **host-only to app.hoku.com** — we NEVER set a
 * `Domain` attribute, so the browser will not attach it to `*.hokusites.com`
 * (a different registrable domain) or to other `hoku.com` subdomains. This is
 * the default boundary that protects the control plane from semi-untrusted
 * tenant content.
 */
export interface AuthCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  // `domain` is intentionally absent — host-only scoping is the whole point.
}

export const AUTH_COOKIE_NAME = "hoku-session";

export function authCookieOptions(
  env: NodeJS.ProcessEnv = process.env
): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: (env.NODE_ENV ?? "development") === "production",
    path: "/",
  };
}

/**
 * Guard used in tests (and as documentation): a Set-Cookie string for the auth
 * cookie must not carry a `Domain=` attribute.
 */
export function isHostOnlySetCookie(setCookie: string): boolean {
  return !/;\s*domain=/i.test(setCookie);
}

import { describe, it, expect } from "vitest";
import {
  authCookieOptions,
  isHostOnlySetCookie,
  AUTH_COOKIE_NAME,
} from "@/lib/auth/cookie";

describe("auth cookie scoping (host-only boundary)", () => {
  it("never sets a Domain attribute (host-only)", () => {
    const opts = authCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(opts).not.toHaveProperty("domain");
    expect(opts.path).toBe("/");
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
  });

  it("is secure only in production", () => {
    expect(
      authCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv).secure
    ).toBe(true);
    expect(
      authCookieOptions({ NODE_ENV: "development" } as NodeJS.ProcessEnv).secure
    ).toBe(false);
  });

  it("isHostOnlySetCookie rejects domain-wide cookies", () => {
    expect(
      isHostOnlySetCookie(`${AUTH_COOKIE_NAME}=abc; Path=/; HttpOnly`)
    ).toBe(true);
    expect(
      isHostOnlySetCookie(`${AUTH_COOKIE_NAME}=abc; Domain=.hoku.com; Path=/`)
    ).toBe(false);
  });
});

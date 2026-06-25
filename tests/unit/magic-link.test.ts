import { describe, it, expect, vi } from "vitest";
import {
  requestMagicLink,
  completeAuth,
  magicLinkRedirectUrl,
  type OtpClient,
} from "@/lib/auth/magic-link";

function fakeClient(overrides?: Partial<OtpClient["auth"]>): {
  client: OtpClient;
  signInWithOtp: ReturnType<typeof vi.fn>;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
} {
  const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
  const client: OtpClient = {
    auth: { signInWithOtp, exchangeCodeForSession, ...overrides },
  };
  return { client, signInWithOtp, exchangeCodeForSession };
}

describe("magicLinkRedirectUrl", () => {
  it("targets the control-plane callback in production", () => {
    expect(magicLinkRedirectUrl({ APP_BASE_DOMAIN: "hoku.com" })).toBe(
      "https://app.hoku.com/auth/callback"
    );
  });

  it("uses http for localhost emulation", () => {
    expect(
      magicLinkRedirectUrl({ APP_BASE_DOMAIN: "hoku.localhost" })
    ).toBe("http://app.hoku.localhost/auth/callback");
  });

  it("honors an explicit APP_ORIGIN override (dev port)", () => {
    expect(
      magicLinkRedirectUrl({
        APP_ORIGIN: "http://app.hoku.localhost:3000/",
      })
    ).toBe("http://app.hoku.localhost:3000/auth/callback");
  });
});

describe("requestMagicLink", () => {
  it("normalizes the email and forwards the redirect", async () => {
    const { client, signInWithOtp } = fakeClient();
    const res = await requestMagicLink(
      client,
      "  Owner@Business.COM ",
      "https://app.hoku.com/auth/callback"
    );
    expect(res.email).toBe("owner@business.com");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "owner@business.com",
      options: { emailRedirectTo: "https://app.hoku.com/auth/callback" },
    });
  });

  it("rejects an invalid email before calling Supabase", async () => {
    const { client, signInWithOtp } = fakeClient();
    await expect(
      requestMagicLink(client, "not-an-email", "https://app.hoku.com/auth/callback")
    ).rejects.toThrow();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("surfaces a Supabase error", async () => {
    const { client } = fakeClient({
      signInWithOtp: vi.fn().mockResolvedValue({ error: { message: "rate limited" } }),
    });
    await expect(
      requestMagicLink(client, "a@b.com", "https://app.hoku.com/auth/callback")
    ).rejects.toThrow("rate limited");
  });
});

describe("completeAuth", () => {
  it("exchanges the code for a session", async () => {
    const { client, exchangeCodeForSession } = fakeClient();
    await completeAuth(client, "the-code");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("the-code");
  });

  it("throws on a missing code", async () => {
    const { client, exchangeCodeForSession } = fakeClient();
    await expect(completeAuth(client, "")).rejects.toThrow(/missing/i);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("surfaces an exchange error", async () => {
    const { client } = fakeClient({
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ error: { message: "expired" } }),
    });
    await expect(completeAuth(client, "x")).rejects.toThrow("expired");
  });
});

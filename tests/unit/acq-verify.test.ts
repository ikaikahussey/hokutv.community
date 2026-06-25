import { describe, it, expect } from "vitest";
import { generateCode, codesMatch, verifySecondFactor } from "@/lib/acq/verify";

describe("acquisition second-factor verification", () => {
  it("generates a deterministic six-digit code from an injected RNG", () => {
    expect(generateCode(() => 0)).toBe("000000");
    expect(generateCode(() => 0.123456)).toHaveLength(6);
  });
  it("constant-time compare matches equal codes and rejects others", () => {
    expect(codesMatch("123456", "123456")).toBe(true);
    expect(codesMatch("123456", "123455")).toBe(false);
    expect(codesMatch("123456", "12345")).toBe(false); // length mismatch
  });
  it("verifies a correct OTP and reports the channel used", () => {
    expect(verifySecondFactor({ channel: "email", expected: "424242", provided: "424242" })).toEqual({
      verified: true,
      via: "email",
    });
  });
  it("a wrong or empty code is unverified with no channel", () => {
    expect(verifySecondFactor({ channel: "phone", expected: "424242", provided: "000000" })).toEqual({
      verified: false,
      via: null,
    });
    expect(verifySecondFactor({ channel: "phone", expected: "424242", provided: "  " }).verified).toBe(false);
  });
});

import crypto from "node:crypto";
import type { VerificationResult } from "./claim";

/**
 * Second-factor verification for a claim (acquisition-module.md §5.5). A claim
 * requires the postcard token AND a verified business email or phone OTP before
 * any transfer. This is the minimal, counsel-review-pending implementation: it
 * proves possession of a one-time code over the chosen channel.
 */
export type Channel = "email" | "phone";

/** Six-digit OTP. RNG injectable so tests are deterministic. */
export function generateCode(rng: () => number = Math.random): string {
  return String(Math.floor(rng() * 1_000_000)).padStart(6, "0");
}

/** Constant-time equality so a wrong code can't be timed out digit by digit. */
export function codesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export interface SecondFactorInput {
  channel: Channel;
  expected: string;
  provided: string;
}

export function verifySecondFactor(input: SecondFactorInput): VerificationResult {
  const provided = input.provided.trim();
  const ok = provided.length > 0 && codesMatch(input.expected, provided);
  return { verified: ok, via: ok ? input.channel : null };
}

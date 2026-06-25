import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/security/rate-limit";

describe("RateLimiter (fixed window)", () => {
  it("allows up to the limit then trips", () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.hit("k", 0).allowed).toBe(true);
    expect(rl.hit("k", 10).allowed).toBe(true);
    expect(rl.hit("k", 20).allowed).toBe(true);
    const tripped = rl.hit("k", 30);
    expect(tripped.allowed).toBe(false);
    expect(tripped.remaining).toBe(0);
  });

  it("resets after the window", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.hit("k", 0).allowed).toBe(true);
    expect(rl.hit("k", 500).allowed).toBe(false);
    expect(rl.hit("k", 1000).allowed).toBe(true); // new window
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.hit("a", 0).allowed).toBe(true);
    expect(rl.hit("b", 0).allowed).toBe(true);
    expect(rl.hit("a", 0).allowed).toBe(false);
  });

  it("reports remaining quota", () => {
    const rl = new RateLimiter(5, 1000);
    expect(rl.hit("k", 0).remaining).toBe(4);
    expect(rl.hit("k", 0).remaining).toBe(3);
  });
});

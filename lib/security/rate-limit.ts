/**
 * Fixed-window rate limiter (Phase 9) for the high-volume, unauthenticated ad
 * serving endpoint. In-memory per process — fine for a single edge instance and
 * fully deterministic/testable; swap for a shared store (Upstash/Redis) when
 * running multi-instance.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms when the window resets
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Record a hit for `key` at time `now` (ms) and report whether it's allowed. */
  hit(key: string, now: number): RateLimitResult {
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, limit: this.limit, resetAt };
    }
    existing.count += 1;
    const allowed = existing.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - existing.count),
      limit: this.limit,
      resetAt: existing.resetAt,
    };
  }
}

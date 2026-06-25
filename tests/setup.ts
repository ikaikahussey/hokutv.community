/**
 * Global Vitest setup. Keep this lean; per-suite mocks live with their tests.
 *
 * External services (Supabase, Stripe, Lob, Google Places, Playwright/Chromium)
 * are never hit in unit tests — they are injected and mocked. Docker is not
 * available in CI here, so there is no live Supabase stack; integration tests
 * exercise the same logic against in-memory fakes.
 */
import { beforeEach, vi } from "vitest";

// Deterministic, non-secret env defaults so modules that read env at import time
// don't throw during tests. Real values are provided via `.env` in dev/CI.
process.env.APP_BASE_DOMAIN ??= "hoku.com";
process.env.TENANT_BASE_DOMAIN ??= "hokusites.com";
process.env.ADS_HOST ??= "ads.hoku.com";

beforeEach(() => {
  vi.clearAllMocks();
});

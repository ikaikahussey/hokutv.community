import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright is pinned to 1.56.1 to match the Chromium build pre-installed at
 * $PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers). We point `executablePath` at it
 * so no browser download is attempted.
 *
 * E2E asserts the host-routing behaviour from Phase 1+. Multi-host is emulated
 * by sending an explicit `Host` header (extraHTTPHeaders) per spec §3.
 */
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: { executablePath: chromiumPath },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: undefined },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

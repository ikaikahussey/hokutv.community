import type { NextConfig } from "next";

const APP_BASE = process.env.APP_BASE_DOMAIN ?? "hoku.com";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tenant media + Places photos are loaded from Supabase storage / external hosts.
  // Tighten this allowlist as real hosts are wired in.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  experimental: {
    // The control plane is reached via a host rewrite, so a Server Action POST
    // arrives with `x-forwarded-host: app.<base>` while the dev/proxy origin is
    // localhost. Next's CSRF check needs those forwarded hosts allow-listed or
    // it rejects the action ("Invalid Server Actions request"). E2E emulates the
    // host with the same header, so the app host must be listed here too.
    serverActions: {
      allowedOrigins: [`app.${APP_BASE}`, "localhost:3000"],
    },
  },
};

export default nextConfig;

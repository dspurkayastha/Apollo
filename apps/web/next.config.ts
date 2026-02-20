import type { NextConfig } from "next";

// Validate env vars at build time — fails fast on missing required vars
import "./lib/env";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ugkqdopvsmtzsqvnnmck.supabase.co",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

// Wrap with Sentry only when the SDK is available and configured
let exportedConfig: NextConfig = nextConfig;

try {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const { withSentryConfig } = require("@sentry/nextjs");
    exportedConfig = withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      disableLogger: true,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      tunnelRoute: "/monitoring",
    });
  }
} catch {
  // @sentry/nextjs not available — skip Sentry integration
}

export default exportedConfig;

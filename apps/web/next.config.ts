import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
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

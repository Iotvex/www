import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  output: "standalone",
  // Yandex probes HEAD /v1.0/ (with trailing slash)
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // If Dialogs Endpoint is ".../v1.0", platform calls ".../v1.0/v1.0/...".
    return [
      { source: "/v1.0/v1.0", destination: "/v1.0" },
      { source: "/v1.0/v1.0/:path*", destination: "/v1.0/:path*" },
    ]
  },
}

export default withNextIntl(nextConfig)

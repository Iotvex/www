import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  // Docker/self-host uses standalone; Vercel must not.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
}

export default withNextIntl(nextConfig)

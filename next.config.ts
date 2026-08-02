import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Optimiertes Paket für Azure Static Web Apps (schnellerer Warm-up, <250 MB)
  output: "standalone",
  transpilePackages: ["@imgly/background-removal"],
  experimental: {
    /** STL-Uploads bis 50 MB (Druckanfragen-API); Standard ist 10 MB. */
    proxyClientMaxBodySize: "50mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "**.blob.core.windows.net",
      },
    ],
  },
  // Keine restriktiven Cross-Origin-/Service-Worker-Header — In-App-WebViews
  // (Instagram) und Incognito brauchen ungehinderte Full-Page-Navigation.
}

export default nextConfig

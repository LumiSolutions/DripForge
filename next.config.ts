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
    // Moderne Formate zuerst — Browser wählt AVIF/WebP via srcset.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "**.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Keine restriktiven Cross-Origin-/Service-Worker-Header — In-App-WebViews
  // (Instagram) und Incognito brauchen ungehinderte Full-Page-Navigation.
}

export default nextConfig

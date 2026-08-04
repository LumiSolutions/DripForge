import type { Metadata, Viewport } from "next"
import {
  Caveat,
  Geist,
  Geist_Mono,
  Great_Vibes,
  Inter,
  JetBrains_Mono,
  Montserrat,
  Playfair_Display,
} from "next/font/google"
import "./globals.css"
import { ParticleBackground } from "@/components/dripforge/particle-background"
import { GlobalShopFooter } from "@/components/dripforge/global-shop-footer"
import { AnnouncementBanner } from "@/components/dripforge/announcement-banner"
import {
  SiteConfigPreviewBanner,
  SiteConfigPreviewProvider,
} from "@/components/dripforge/site-config-preview-banner"
import { SiteTextsProvider } from "@/components/dripforge/site-texts-provider"
import { CompanySettingsProvider } from "@/components/dripforge/company-settings-provider"
import { StorefrontFloatingActions } from "@/components/dripforge/storefront-floating-actions"
import { LaunchGateShell } from "@/components/dripforge/launch-gate-shell"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const laserGreatVibes = Great_Vibes({
  variable: "--laser-font-great-vibes",
  subsets: ["latin"],
  weight: "400",
})

const laserInter = Inter({
  variable: "--laser-font-inter",
  subsets: ["latin"],
})

const laserPlayfair = Playfair_Display({
  variable: "--laser-font-playfair",
  subsets: ["latin"],
})

const laserMontserrat = Montserrat({
  variable: "--laser-font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
})

const laserJetBrains = JetBrains_Mono({
  variable: "--laser-font-jetbrains",
  subsets: ["latin"],
})

const laserCaveat = Caveat({
  variable: "--laser-font-caveat",
  subsets: ["latin"],
})

/** Standard-Favicon (existiert unter public/), falls kein Marken-Icon gesetzt ist. */
const DEFAULT_BRAND_ICON = "/icon.svg"

/**
 * Favicon / Apple-Touch-Icon dynamisch aus den Admin-Einstellungen (Slot 1:
 * kleine Icon-Marke). So werden <link rel="icon"> und <link rel="apple-touch-icon">
 * beim Upload automatisch aktualisiert.
 */
export async function generateMetadata(): Promise<Metadata> {
  let iconUrl = DEFAULT_BRAND_ICON
  try {
    const { getSettings } = await import("@/lib/admin/db")
    const settings = await getSettings()
    if (settings.brandIconUrl && settings.brandIconUrl.trim()) {
      iconUrl = settings.brandIconUrl.trim()
    }
  } catch {
    /* Fallback auf Standard-Icon */
  }

  return {
    title: "DripForge | 3D-Druck & Lasergravur",
    description:
      "Schweizer Präzision für 3D-Druck und Lasergravur – von der Idee bis zum fertigen Produkt.",
    icons: {
      icon: [{ url: iconUrl }],
      shortcut: [{ url: iconUrl }],
      apple: [{ url: iconUrl }],
    },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="de-CH"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${laserGreatVibes.variable} ${laserInter.variable} ${laserPlayfair.variable} ${laserMontserrat.variable} ${laserJetBrains.variable} ${laserCaveat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ParticleBackground />
        <div className="relative z-20 flex min-h-full flex-1 flex-col overflow-x-clip">
          <SiteConfigPreviewProvider>
            <SiteTextsProvider>
              <CompanySettingsProvider>
                <AnnouncementBanner />
                <SiteConfigPreviewBanner />
                <LaunchGateShell>{children}</LaunchGateShell>
                <GlobalShopFooter />
                <StorefrontFloatingActions />
              </CompanySettingsProvider>
            </SiteTextsProvider>
          </SiteConfigPreviewProvider>
        </div>
      </body>
    </html>
  )
}

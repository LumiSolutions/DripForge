import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Öffentliche Marken-Assets (Icon/Favicon + Haupt-Logo) für die Storefront. */
export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(
      {
        brandIconUrl: settings.brandIconUrl ?? null,
        brandLogoUrl: settings.brandLogoUrl ?? null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    )
  } catch {
    return NextResponse.json({ brandIconUrl: null, brandLogoUrl: null })
  }
}

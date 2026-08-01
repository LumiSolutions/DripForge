import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import {
  DEFAULT_WISHLIST_ICON,
  normalizeWishlistIcon,
  normalizeWishlistIconCustomUrl,
} from "@/lib/dripforge/wishlist-icon-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({
      wishlistIcon: normalizeWishlistIcon(settings.wishlistIcon),
      wishlistIconCustomUrl: normalizeWishlistIconCustomUrl(
        settings.wishlistIconCustomUrl
      ),
    })
  } catch {
    return NextResponse.json({
      wishlistIcon: DEFAULT_WISHLIST_ICON,
      wishlistIconCustomUrl: null,
    })
  }
}

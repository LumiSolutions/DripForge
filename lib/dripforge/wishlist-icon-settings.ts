export const WISHLIST_ICON_PRESETS = [
  "star",
  "heart",
  "bookmark",
  "fire",
  "custom",
] as const

export type WishlistIconPreset = (typeof WISHLIST_ICON_PRESETS)[number]

export const DEFAULT_WISHLIST_ICON: WishlistIconPreset = "star"

export const WISHLIST_ICON_LABELS: Record<WishlistIconPreset, string> = {
  star: "Stern (★)",
  heart: "Herz (♥)",
  bookmark: "Lesezeichen (🔖)",
  fire: "Feuer (🔥)",
  custom: "Custom-SVG",
}

export const WISHLIST_ICON_GLYPHS: Record<
  Exclude<WishlistIconPreset, "custom">,
  string
> = {
  star: "★",
  heart: "♥",
  bookmark: "🔖",
  fire: "🔥",
}

export function normalizeWishlistIcon(
  value: unknown
): WishlistIconPreset {
  if (
    typeof value === "string" &&
    WISHLIST_ICON_PRESETS.includes(value as WishlistIconPreset)
  ) {
    return value as WishlistIconPreset
  }
  return DEFAULT_WISHLIST_ICON
}

export function normalizeWishlistIconCustomUrl(
  value: unknown
): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/")
  ) {
    return trimmed
  }
  return null
}

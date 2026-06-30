export const TAWK_PROPERTY_ID =
  process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID?.trim() || "6a43f45c113c4b1d489fcf7e"

export const TAWK_WIDGET_ID =
  process.env.NEXT_PUBLIC_TAWK_WIDGET_ID?.trim() || "1jscn52fl"

export function getTawkEmbedSrc(): string {
  return `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`
}

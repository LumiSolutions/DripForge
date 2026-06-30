import type { TawkAttachment } from "@/lib/tawk/tawk-types"

function readFileFromAttachment(item: unknown): TawkAttachment | null {
  if (!item || typeof item !== "object") return null
  const record = item as Record<string, unknown>
  const content = record.content as Record<string, unknown> | undefined
  const file = content?.file as Record<string, unknown> | undefined

  const url =
    (typeof file?.url === "string" && file.url) ||
    (typeof record.url === "string" && record.url) ||
    null

  if (!url) return null

  return {
    url,
    name: typeof file?.name === "string" ? file.name : undefined,
    mimeType: typeof file?.mimeType === "string" ? file.mimeType : undefined,
    extension: typeof file?.extension === "string" ? file.extension : undefined,
    size:
      typeof file?.size === "string"
        ? file.size
        : typeof file?.size === "number"
          ? String(file.size)
          : undefined,
  }
}

export function parseTawkAttachments(raw: unknown): TawkAttachment[] {
  if (!raw || typeof raw !== "object") return []
  const record = raw as Record<string, unknown>

  if (Array.isArray(record.attachments)) {
    return record.attachments
      .map(readFileFromAttachment)
      .filter((item): item is TawkAttachment => item != null)
  }

  if (Array.isArray(record.attchs)) {
    return record.attchs
      .map(readFileFromAttachment)
      .filter((item): item is TawkAttachment => item != null)
  }

  const single = readFileFromAttachment(raw)
  return single ? [single] : []
}

export function isImageAttachment(attachment: TawkAttachment): boolean {
  if (attachment.mimeType?.startsWith("image/")) return true
  if (attachment.extension && /^jpe?g|png|gif|webp|bmp|svg$/i.test(attachment.extension)) {
    return true
  }
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(attachment.url)
}

export function attachmentKey(attachments: TawkAttachment[]): string {
  return attachments.map((item) => item.url).join("|")
}

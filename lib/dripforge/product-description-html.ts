/**
 * Sicheres HTML für Produktbeschreibungen (Admin Rich-Text → Storefront).
 * Erlaubt: p, br, strong/b, em/i, u, span.df-highlight, span[style font-family]
 */

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "SPAN",
  "DIV",
])

/** DripForge-Verlauf wie «Einzigartiges» */
export const DF_HIGHLIGHT_CLASS = "df-text-highlight"

export function plainTextToDescriptionHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("")
}

/** Erkennt, ob der String bereits HTML enthält. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function sanitizeProductDescriptionHtml(input: string): string {
  if (typeof input !== "string") return ""
  const trimmed = input.trim()
  if (!trimmed) return ""

  // Server-safe: kein DOM — strip gefährliche Tags/Attrs per Regex + allowlist
  if (typeof document === "undefined") {
    return sanitizeProductDescriptionHtmlServer(trimmed)
  }

  const template = document.createElement("template")
  template.innerHTML = trimmed
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child)
        continue
      }
      const el = child as HTMLElement
      const tag = el.tagName.toUpperCase()
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: behalte Textinhalt
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el)
        }
        el.parentNode?.removeChild(el)
        continue
      }
      // Attribute bereinigen
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        if (name === "class" && el.classList.contains(DF_HIGHLIGHT_CLASS)) {
          el.className = DF_HIGHLIGHT_CLASS
          continue
        }
        if (
          name === "style" &&
          tag === "SPAN" &&
          /^font-family\s*:\s*[^;]+;?$/i.test(attr.value.trim())
        ) {
          continue
        }
        el.removeAttribute(attr.name)
      }
      if (tag === "SPAN" && !el.classList.contains(DF_HIGHLIGHT_CLASS)) {
        const style = el.getAttribute("style")
        if (!style) {
          while (el.firstChild) {
            el.parentNode?.insertBefore(el.firstChild, el)
          }
          el.parentNode?.removeChild(el)
          continue
        }
      }
      walk(el)
    }
  }
  walk(template.content)
  return template.innerHTML
}

function sanitizeProductDescriptionHtmlServer(html: string): string {
  // Grobe Server-Sanitisierung: Scripts/Event-Handler entfernen
  let out = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
  // Nicht-erlaubte Tags entpacken
  out = out.replace(
    /<\/?(?!p|br|strong|b|em|i|u|span|div\b)[a-z][^>]*>/gi,
    ""
  )
  return out
}

export function descriptionToDisplayHtml(raw: string | null | undefined): string {
  if (!raw?.trim()) return ""
  const value = raw.trim()
  if (looksLikeHtml(value)) {
    return sanitizeProductDescriptionHtml(value)
  }
  return plainTextToDescriptionHtml(value)
}

/** Entfernt HTML für Karten-/Grid-Vorschauen — nur sichtbarer Klartext. */
export function stripHtmlTags(raw: string | null | undefined): string {
  if (!raw?.trim()) return ""
  let text = raw
  if (typeof document !== "undefined") {
    const template = document.createElement("template")
    template.innerHTML = looksLikeHtml(raw) ? raw : plainTextToDescriptionHtml(raw)
    text = template.content.textContent ?? ""
  } else {
    text = raw
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
  }
  return text.replace(/\s+/g, " ").trim()
}

export function productDescriptionPreview(
  raw: string | null | undefined,
  maxChars = 100
): string {
  const plain = stripHtmlTags(raw)
  if (plain.length <= maxChars) return plain
  return `${plain.slice(0, maxChars).trimEnd()}…`
}

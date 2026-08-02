/**
 * Sicheres HTML für Produktbeschreibungen (Admin Rich-Text → Storefront).
 * Erlaubt: p, br, strong/b, em/i, u, span.df-text-highlight, span[style font-family]
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

function cleanElementAttributes(el: HTMLElement): void {
  const tag = el.tagName.toUpperCase()
  const keepHighlight = el.classList.contains(DF_HIGHLIGHT_CLASS)
  const fontFamily = el.getAttribute("style")?.match(
    /font-family\s*:\s*[^;]+/i
  )?.[0]

  // Alle Attribute entfernen, dann nur Erlaubtes zurücksetzen
  for (const attr of Array.from(el.attributes)) {
    el.removeAttribute(attr.name)
  }

  if (keepHighlight) {
    el.className = DF_HIGHLIGHT_CLASS
  } else if (tag === "SPAN" && fontFamily) {
    el.setAttribute("style", `${fontFamily};`)
  }
}

export function sanitizeProductDescriptionHtml(input: string): string {
  if (typeof input !== "string") return ""
  const trimmed = input.trim()
  if (!trimmed) return ""

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
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el)
        }
        el.parentNode?.removeChild(el)
        continue
      }

      cleanElementAttributes(el)

      if (
        tag === "SPAN" &&
        !el.classList.contains(DF_HIGHLIGHT_CLASS) &&
        !el.getAttribute("style")
      ) {
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el)
        }
        el.parentNode?.removeChild(el)
        continue
      }

      walk(el)
    }
  }
  walk(template.content)
  return template.innerHTML
}

function sanitizeProductDescriptionHtmlServer(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    // data-* und Klassenjunk (z. B. ChatGPT-Paste) entfernen
    .replace(/\sdata-[\w-]+="[^"]*"/gi, "")
    .replace(/\sdata-[\w-]+='[^']*'/gi, "")
    .replace(/\sclass="(?![^"]*\bdf-text-highlight\b)[^"]*"/gi, "")
    .replace(/\sclass='(?![^']*\bdf-text-highlight\b)[^']*'/gi, "")
  out = out.replace(
    /<\/?(?!p|br|strong|b|em|i|u|span|div\b)[a-z][^>]*>/gi,
    ""
  )
  // class nur behalten wenn Highlight
  out = out.replace(
    /\sclass="([^"]*)"/gi,
    (_m, cls: string) =>
      cls.includes(DF_HIGHLIGHT_CLASS) ? ` class="${DF_HIGHLIGHT_CLASS}"` : ""
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

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripTagsOnce(raw: string): string {
  if (typeof document !== "undefined") {
    const template = document.createElement("template")
    template.innerHTML = raw
    return template.content.textContent ?? ""
  }
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
}

/** Entfernt HTML für Karten-/Grid-Vorschauen — nur sichtbarer Klartext. */
export function stripHtmlTags(raw: string | null | undefined): string {
  if (!raw?.trim()) return ""
  // Bis zu 2x: zuerst Tags, dann Entity-decodiertes HTML (Doppelkodierung).
  let text = stripTagsOnce(raw)
  text = decodeBasicEntities(text)
  if (looksLikeHtml(text)) {
    text = stripTagsOnce(text)
    text = decodeBasicEntities(text)
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

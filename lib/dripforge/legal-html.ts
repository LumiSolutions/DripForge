/**
 * Sicheres HTML für Rechtstexte (CMS Rich-Text → Storefront). Erlaubt zusätzlich
 * Überschriften und Listen (H1–H3, UL/OL/LI) sowie Links — im Gegensatz zur
 * Produktbeschreibung.
 */

import {
  DF_HIGHLIGHT_CLASS,
  looksLikeHtml,
  plainTextToDescriptionHtml,
} from "@/lib/dripforge/product-description-html"

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
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "A",
  "BLOCKQUOTE",
])

function safeHref(href: string | null): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (/^javascript:/i.test(trimmed)) return null
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed
  return null
}

function cleanLegalAttributes(el: HTMLElement): void {
  const tag = el.tagName.toUpperCase()
  const keepHighlight = el.classList.contains(DF_HIGHLIGHT_CLASS)
  const fontFamily = el
    .getAttribute("style")
    ?.match(/font-family\s*:\s*[^;]+/i)?.[0]
  const href = tag === "A" ? safeHref(el.getAttribute("href")) : null

  for (const attr of Array.from(el.attributes)) {
    el.removeAttribute(attr.name)
  }

  if (keepHighlight) {
    el.className = DF_HIGHLIGHT_CLASS
  } else if (tag === "SPAN" && fontFamily) {
    el.setAttribute("style", `${fontFamily};`)
  }
  if (tag === "A" && href) {
    el.setAttribute("href", href)
    if (/^https?:/i.test(href)) {
      el.setAttribute("target", "_blank")
      el.setAttribute("rel", "noopener noreferrer")
    }
  }
}

function sanitizeLegalHtmlServer(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\sdata-[\w-]+="[^"]*"/gi, "")
    .replace(/\sdata-[\w-]+='[^']*'/gi, "")
  // Nur erlaubte Tags behalten (öffnend/schliessend).
  out = out.replace(
    /<\/?(?!p|br|strong|b|em|i|u|span|div|h1|h2|h3|ul|ol|li|a|blockquote\b)[a-z][^>]*>/gi,
    ""
  )
  // class nur behalten wenn Highlight.
  out = out.replace(/\sclass="([^"]*)"/gi, (_m, cls: string) =>
    cls.includes(DF_HIGHLIGHT_CLASS) ? ` class="${DF_HIGHLIGHT_CLASS}"` : ""
  )
  return out
}

export function sanitizeLegalHtml(input: string): string {
  if (typeof input !== "string") return ""
  const trimmed = input.trim()
  if (!trimmed) return ""

  if (typeof document === "undefined") {
    return sanitizeLegalHtmlServer(trimmed)
  }

  const template = document.createElement("template")
  template.innerHTML = trimmed
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
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
      cleanLegalAttributes(el)
      walk(el)
    }
  }
  walk(template.content)
  return template.innerHTML
}

/** Wandelt gespeicherten Wert (HTML oder Klartext) in sicheres Anzeige-HTML. */
export function legalToDisplayHtml(raw: string | null | undefined): string {
  if (!raw?.trim()) return ""
  const value = raw.trim()
  if (looksLikeHtml(value)) return sanitizeLegalHtml(value)
  return plainTextToDescriptionHtml(value)
}

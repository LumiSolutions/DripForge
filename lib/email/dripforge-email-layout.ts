import type { DocumentFooterLines } from "@/lib/documents/document-template-types"
import { DRIPFORGE_LOGO_URL } from "@/lib/invoices/invoice-format"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line.trim()))
      return `<p style="margin:0 0 14px;line-height:1.6;color:#374151;">${lines.join("<br/>")}</p>`
    })
    .join("")
}

export function renderDripForgeEmailHtml(options: {
  title: string
  bodyHtml: string
  footerLines: DocumentFooterLines
  logoUrl?: string
}): string {
  const logoUrl = options.logoUrl || DRIPFORGE_LOGO_URL
  const footer = options.footerLines

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 28px 12px;text-align:center;background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);">
              <img src="${escapeHtml(logoUrl)}" alt="DripForge" width="120" style="display:inline-block;max-width:120px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(options.title)}</h1>
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #e5e7eb;text-align:center;background:#fafafa;">
              ${footer.line1 ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#4b5563;">${escapeHtml(footer.line1)}</p>` : ""}
              ${footer.line2 ? `<p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">${escapeHtml(footer.line2)}</p>` : ""}
              ${footer.line3 ? `<p style="margin:0;font-size:11px;color:#9ca3af;">${escapeHtml(footer.line3)}</p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderOrderItemsTableHtml(
  items: { name: string; quantity: number; price: number }[]
): string {
  if (items.length === 0) return ""

  const rows = items
    .map((item) => {
      const lineTotal = item.price * item.quantity
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;font-weight:600;">CHF ${lineTotal.toFixed(2)}</td>
      </tr>`
    })
    .join("")

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 8px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:separate;">
    <thead>
      <tr style="background:#1e293b;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;">Artikel</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;">Menge</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

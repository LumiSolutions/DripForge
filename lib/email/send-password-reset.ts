import {
  isSmtpConfigured,
  resolveSmtpFrom,
  sendSmtpMail,
} from "@/lib/email/smtp"

type SendPasswordResetOptions = {
  to: string
  resetUrl: string
  accountLabel: string
}

export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions
): Promise<boolean> {
  const subject = "DripForge — Passwort zurücksetzen"
  const text = [
    "Guten Tag,",
    "",
    `Sie haben eine Anfrage zum Zurücksetzen Ihres ${options.accountLabel}-Passworts gestellt.`,
    "",
    "Öffnen Sie den folgenden Link innerhalb von 1 Stunde:",
    options.resetUrl,
    "",
    "Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.",
    "",
    "Freundliche Grüsse",
    "DripForge",
  ].join("\n")

  if (!isSmtpConfigured()) {
    console.info("Passwort-Reset: SMTP nicht konfiguriert — Link für lokale Tests:")
    console.info(`  Empfänger: ${options.to}`)
    console.info(`  Reset-Link: ${options.resetUrl}`)
    return true
  }

  const from = resolveSmtpFrom("DripForge", process.env.SMTP_USER?.trim() || "shop@dripforge.ch")

  const sent = await sendSmtpMail({
    from,
    to: options.to,
    subject,
    text,
    html: text
      .split("\n")
      .map((line) => (line ? `<p style="margin:0 0 8px;">${line}</p>` : "<br/>"))
      .join(""),
  })

  if (!sent) {
    throw new Error(`Passwort-Reset: E-Mail-Versand fehlgeschlagen (${options.to}).`)
  }

  console.info(`Passwort-Reset: E-Mail gesendet an ${options.to}.`)
  return true
}

import nodemailer from "nodemailer"
import type Mail from "nodemailer/lib/mailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"

export type SmtpRuntimeConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  )
}

function parseSecureFlag(port: number): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase()
  if (raw === "true" || raw === "1" || raw === "yes") return true
  if (raw === "false" || raw === "0" || raw === "no") return false
  // Hostpoint: 465 = SSL, 587 = STARTTLS
  return port === 465
}

export function getSmtpRuntimeConfig(): SmtpRuntimeConfig | null {
  if (!isSmtpConfigured()) return null

  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT ?? 465)
  const user = process.env.SMTP_USER!.trim()
  const pass = process.env.SMTP_PASS!.trim()
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    `"DripForge" <${user}>`

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure: parseSecureFlag(Number.isFinite(port) && port > 0 ? port : 465),
    user,
    pass,
    from,
  }
}

export function buildSmtpTransporter() {
  const config = getSmtpRuntimeConfig()
  if (!config) {
    throw new Error("SMTP ist nicht konfiguriert (SMTP_HOST/USER/PASS fehlen).")
  }

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  }

  // Port 587: explizit STARTTLS erzwingen (Hostpoint)
  if (!config.secure && config.port === 587) {
    options.requireTLS = true
  }

  return nodemailer.createTransport(options)
}

export function resolveSmtpFrom(fallbackName: string, fallbackEmail: string): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    `"${fallbackName}" <${fallbackEmail}>`
  )
}

export type SendSmtpMailOptions = {
  from: string
  to: string
  subject: string
  text: string
  html: string
  attachments?: Mail.Attachment[]
}

export async function sendSmtpMail(options: SendSmtpMailOptions): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.info("E-Mail: SMTP nicht konfiguriert — Versand übersprungen.", {
      to: options.to,
      subject: options.subject,
    })
    return false
  }

  try {
    const transporter = buildSmtpTransporter()
    const info = await transporter.sendMail(options)
    console.info("E-Mail: SMTP-Versand erfolgreich.", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
    })
    return true
  } catch (error) {
    console.error(
      "E-Mail: SMTP-Versand fehlgeschlagen — Request wird trotzdem fortgesetzt.",
      { to: options.to, subject: options.subject, error }
    )
    return false
  }
}

/** Verbindungstest für CLI / Diagnose (wirft bei Fehler). */
export async function verifySmtpConnection(): Promise<{
  ok: true
  config: Omit<SmtpRuntimeConfig, "pass">
}> {
  const config = getSmtpRuntimeConfig()
  if (!config) {
    throw new Error(
      "SMTP nicht konfiguriert. Bitte SMTP_HOST, SMTP_USER und SMTP_PASS setzen."
    )
  }

  const transporter = buildSmtpTransporter()
  await transporter.verify()
  return {
    ok: true,
    config: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from: config.from,
    },
  }
}

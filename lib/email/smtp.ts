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

/** Entfernt versehentliche Anführungszeichen aus Azure-/ENV-Werten. */
function stripEnvQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
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

  const host = stripEnvQuotes(process.env.SMTP_HOST!)
  const port = Number(stripEnvQuotes(process.env.SMTP_PORT ?? "465"))
  const user = stripEnvQuotes(process.env.SMTP_USER!)
  const pass = stripEnvQuotes(process.env.SMTP_PASS!)
  const from =
    stripEnvQuotes(process.env.EMAIL_FROM ?? "") ||
    stripEnvQuotes(process.env.SMTP_FROM ?? "") ||
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

  console.info("E-Mail: SMTP-Transporter wird erstellt.", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    passConfigured: Boolean(config.pass),
    passLength: config.pass.length,
  })

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  }

  // Port 587: explizit STARTTLS erzwingen (Hostpoint)
  if (!config.secure && config.port === 587) {
    options.requireTLS = true
  }

  return nodemailer.createTransport(options)
}

export function resolveSmtpFrom(fallbackName: string, fallbackEmail: string): string {
  return (
    stripEnvQuotes(process.env.EMAIL_FROM ?? "") ||
    stripEnvQuotes(process.env.SMTP_FROM ?? "") ||
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

function formatSmtpError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error }
  }
  const anyErr = error as Error & {
    code?: string
    response?: string
    responseCode?: number
    command?: string
  }
  return {
    name: anyErr.name,
    message: anyErr.message,
    code: anyErr.code,
    response: anyErr.response,
    responseCode: anyErr.responseCode,
    command: anyErr.command,
    stack: anyErr.stack,
  }
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
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
    return true
  } catch (error) {
    console.error(
      "E-Mail: SMTP-Versand fehlgeschlagen — Request wird trotzdem fortgesetzt.",
      {
        to: options.to,
        subject: options.subject,
        from: options.from,
        ...formatSmtpError(error),
      }
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

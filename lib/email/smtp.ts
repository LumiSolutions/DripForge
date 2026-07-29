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
  // HOST/USER können Defaults sein — PASS ist Pflicht
  return Boolean(process.env.SMTP_PASS?.trim())
}

/**
 * Hostpoint-Standard: Port 587 + STARTTLS (secure: false).
 * Nur bei explizitem SMTP_SECURE=true (typisch Port 465) wird SSL erzwungen.
 */
function parseSecureFlag(): boolean {
  return process.env.SMTP_SECURE === "true"
}

export function getSmtpRuntimeConfig(): SmtpRuntimeConfig | null {
  if (!isSmtpConfigured()) return null

  const user =
    stripEnvQuotes(process.env.SMTP_USER ?? "") || "shop@dripforge.ch"
  const pass = stripEnvQuotes(process.env.SMTP_PASS!)
  const host =
    stripEnvQuotes(process.env.SMTP_HOST ?? "") || "mail.hostpoint.ch"
  const port = Number(stripEnvQuotes(process.env.SMTP_PORT ?? "")) || 587
  const secure = parseSecureFlag()
  const from =
    stripEnvQuotes(process.env.EMAIL_FROM ?? "") ||
    stripEnvQuotes(process.env.SMTP_FROM ?? "") ||
    `DripForge <${user}>`

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  }
}

function logSmtpConfig(config: SmtpRuntimeConfig, phase: string) {
  console.log(`[SMTP] ${phase}`, {
    host: config.host,
    port: config.port,
    secure: config.secure,
    starttls: !config.secure && config.port === 587,
    user: config.user,
    from: config.from,
    passConfigured: Boolean(config.pass),
    passLength: config.pass.length,
    passEndsWithDollar: config.pass.endsWith("$"),
  })
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null =
  null
let cachedConfigKey: string | null = null

export function buildSmtpTransporter() {
  const config = getSmtpRuntimeConfig()
  if (!config) {
    throw new Error("SMTP ist nicht konfiguriert (SMTP_PASS fehlt).")
  }

  const configKey = `${config.host}|${config.port}|${config.secure}|${config.user}|${config.pass.length}`
  if (cachedTransporter && cachedConfigKey === configKey) {
    console.log("[SMTP] Wiederverwende bestehenden Transporter.")
    return cachedTransporter
  }

  logSmtpConfig(config, "Transporter wird erstellt (Hostpoint 587/STARTTLS)")

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    // Port 587: secure false → STARTTLS; Port 465: SMTP_SECURE=true
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Timeouts: Requests hängen im Fehlerfall nicht endlos
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: {
      // Für Port 587 (STARTTLS) und Azure/Hostpoint Zertifikate
      rejectUnauthorized: false,
      servername: config.host,
      minVersion: "TLSv1.2",
    },
  }

  if (!config.secure) {
    options.requireTLS = true
    console.log("[SMTP] STARTTLS aktiv (secure=false, requireTLS=true).")
  }

  cachedTransporter = nodemailer.createTransport(options)
  cachedConfigKey = configKey
  return cachedTransporter
}

export function resolveSmtpFrom(fallbackName: string, fallbackEmail: string): string {
  return (
    stripEnvQuotes(process.env.EMAIL_FROM ?? "") ||
    stripEnvQuotes(process.env.SMTP_FROM ?? "") ||
    `${fallbackName} <${fallbackEmail}>`
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
    return { error: String(error) }
  }
  const anyErr = error as Error & {
    code?: string
    response?: string
    responseCode?: number
    command?: string
    errno?: number
    syscall?: string
    address?: string
    port?: number
  }
  return {
    name: anyErr.name,
    message: anyErr.message,
    code: anyErr.code,
    response: anyErr.response,
    responseCode: anyErr.responseCode,
    command: anyErr.command,
    errno: anyErr.errno,
    syscall: anyErr.syscall,
    address: anyErr.address,
    port: anyErr.port,
    stack: anyErr.stack,
  }
}

export async function sendSmtpMail(options: SendSmtpMailOptions): Promise<boolean> {
  const startedAt = Date.now()
  console.log("[SMTP] sendSmtpMail gestartet", {
    to: options.to,
    from: options.from,
    subject: options.subject,
    hasHtml: Boolean(options.html),
    hasText: Boolean(options.text),
    attachmentCount: options.attachments?.length ?? 0,
    configured: isSmtpConfigured(),
  })

  if (!isSmtpConfigured()) {
    console.error(
      "[SMTP] ABBRUCH: SMTP_PASS fehlt in der Umgebung — Versand übersprungen.",
      { to: options.to, subject: options.subject }
    )
    return false
  }

  const config = getSmtpRuntimeConfig()
  if (config) logSmtpConfig(config, "Vor dem Versand")

  try {
    console.log("[SMTP] buildSmtpTransporter()…")
    const transporter = buildSmtpTransporter()

    console.log("[SMTP] transporter.verify()…")
    try {
      await transporter.verify()
      console.log(`[SMTP] verify OK (${Date.now() - startedAt}ms)`)
    } catch (verifyError) {
      console.error("[SMTP] verify FEHLGESCHLAGEN — sende trotzdem (Fallback).", {
        ...formatSmtpError(verifyError),
        elapsedMs: Date.now() - startedAt,
      })
    }

    console.log("[SMTP] transporter.sendMail()…")
    const info = await transporter.sendMail(options)
    console.log("[SMTP] Versand ERFOLGREICH", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      response: info.response,
      envelope: info.envelope,
      elapsedMs: Date.now() - startedAt,
    })
    return true
  } catch (error) {
    console.error("[SMTP] Versand FEHLGESCHLAGEN — Checkout wird nicht abgebrochen.", {
      to: options.to,
      subject: options.subject,
      from: options.from,
      elapsedMs: Date.now() - startedAt,
      ...formatSmtpError(error),
    })
    cachedTransporter = null
    cachedConfigKey = null
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
      "SMTP nicht konfiguriert. Bitte SMTP_PASS setzen (Default: mail.hostpoint.ch:587 STARTTLS)."
    )
  }

  logSmtpConfig(config, "verifySmtpConnection")
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

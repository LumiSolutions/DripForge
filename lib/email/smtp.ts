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

/** Hostpoint-taugliche Absender-Mailbox (Fallback). */
const DEFAULT_HOSTPOINT_FROM_EMAIL = "shop@dripforge.ch"
/** Hostpoint Submission-Server (nicht mail.hostpoint.ch — der ist nur für IMAP/POP). */
const DEFAULT_SMTP_HOST = "asmtp.mail.hostpoint.ch"

/**
 * Trim + entferne versehentliche Anführungszeichen aus Azure-/ENV-Werten
 * (z. B. "shop@…" oder 'passwort' / Newlines aus Portal-Copy/Paste).
 */
function cleanEnv(value: string | undefined): string {
  const trimmed = (value || "").trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * Alte/falsche Hostpoint-Hosts auf den Submission-Server umbiegen.
 * mail.hostpoint.ch ist Empfang — Versand darüber scheitert oft still.
 */
function normalizeSmtpHost(host: string): string {
  const normalized = host.toLowerCase().replace(/\.$/, "")
  if (
    !normalized ||
    normalized === "mail.hostpoint.ch" ||
    normalized === "smtp.hostpoint.ch" ||
    normalized === "smtp.mail.hostpoint.ch"
  ) {
    if (host && normalized !== DEFAULT_SMTP_HOST) {
      console.warn(
        `[SMTP] Host "${host}" → ${DEFAULT_SMTP_HOST} (Hostpoint Submission)`
      )
    }
    return DEFAULT_SMTP_HOST
  }
  return host
}

function extractEmailAddress(value: string): string | null {
  const angle = value.match(/<([^>]+)>/)
  const candidate = (angle?.[1] || value).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null
  return candidate.toLowerCase()
}

function isPlaceholderValue(value: string): boolean {
  return /change[_-]?me|your_secret|placeholder|example\.com|noreply@localhost/i.test(
    value
  )
}

/**
 * From MUSS eine gültige Hostpoint-Adresse sein (z. B. shop@dripforge.ch).
 * Platzhalter / ungültige EMAIL_FROM-Werte werden verworfen.
 */
function resolveFromHeader(user: string, fromEnv: string): string {
  const envEmail = extractEmailAddress(fromEnv)
  if (envEmail && !isPlaceholderValue(envEmail) && !isPlaceholderValue(fromEnv)) {
    const nameMatch = fromEnv.match(/^(.+?)\s*<[^>]+>$/)
    const name = nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "") || "DripForge"
    return `${name} <${envEmail}>`
  }

  const userEmail = extractEmailAddress(user)
  if (userEmail && !isPlaceholderValue(userEmail)) {
    return `DripForge <${userEmail}>`
  }

  return `DripForge <${DEFAULT_HOSTPOINT_FROM_EMAIL}>`
}

/**
 * SMTP: Hostpoint asmtp.mail.hostpoint.ch (Default),
 * Credentials nur aus ENV (SMTP_USER / SMTP_PASS).
 * Port 465 → secure:true | Port 587 → STARTTLS (secure:false).
 */
function resolveSmtpSettings(): SmtpRuntimeConfig {
  const user = cleanEnv(process.env.SMTP_USER)
  const pass = cleanEnv(process.env.SMTP_PASS)
  const host = normalizeSmtpHost(cleanEnv(process.env.SMTP_HOST) || DEFAULT_SMTP_HOST)
  const portRaw = cleanEnv(process.env.SMTP_PORT)
  const port = portRaw ? Number(portRaw) : 465
  const secureEnv = cleanEnv(process.env.SMTP_SECURE).toLowerCase()
  const resolvedPort = Number.isFinite(port) ? port : 465
  // 465 → SSL (secure:true) | 587 → STARTTLS (secure:false, requireTLS)
  const secure =
    secureEnv === "false" || secureEnv === "0"
      ? false
      : secureEnv === "true" || secureEnv === "1"
        ? true
        : resolvedPort === 465
  const fromEnv = cleanEnv(process.env.EMAIL_FROM)
  const from = resolveFromHeader(user, fromEnv)

  return {
    host,
    port: resolvedPort,
    secure,
    user,
    pass,
    from,
  }
}

export function isSmtpConfigured(): boolean {
  // HOST hat Hostpoint-Default — USER + PASS sind Pflicht
  const user = cleanEnv(process.env.SMTP_USER)
  const pass = cleanEnv(process.env.SMTP_PASS)
  if (!user || !pass) return false
  if (isPlaceholderValue(user) || isPlaceholderValue(pass)) return false
  return true
}

/**
 * Sichere Diagnose-Infos (ohne Klartext-Passwort) — für /api/test-email.
 */
export function getSmtpDiagnostics(): {
  configuredUser: string
  userLength: number
  passLength: number
  host: string
  port: number
  secure: boolean
  from: string
  passConfigured: boolean
} {
  const config = resolveSmtpSettings()
  return {
    configuredUser: config.user,
    userLength: config.user.length,
    passLength: config.pass.length,
    host: config.host,
    port: config.port,
    secure: config.secure,
    from: config.from,
    passConfigured: Boolean(config.pass),
  }
}

export function getSmtpRuntimeConfig(): SmtpRuntimeConfig | null {
  if (!isSmtpConfigured()) return null
  return resolveSmtpSettings()
}

function logSmtpConfig(config: SmtpRuntimeConfig, phase: string) {
  console.log(`[SMTP] ${phase}`, {
    host: config.host,
    port: config.port,
    secure: config.secure,
    starttls: !config.secure && config.port === 587,
    ssl: config.secure && config.port === 465,
    user: config.user,
    from: config.from,
    userLength: config.user.length,
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
    throw new Error("SMTP ist nicht konfiguriert (SMTP_USER / SMTP_PASS fehlt).")
  }

  const configKey = `${config.host}|${config.port}|${config.secure}|${config.user}|${config.pass.length}|${config.from}`
  if (cachedTransporter && cachedConfigKey === configKey) {
    console.log("[SMTP] Wiederverwende bestehenden Transporter.")
    return cachedTransporter
  }

  logSmtpConfig(config, "Transporter wird erstellt")

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    // Port 587: STARTTLS erzwingen
    ...(config.port === 587 && !config.secure ? { requireTLS: true } : {}),
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: {
      // Hostpoint manchmal mit Zwischenzertifikaten — Versand priorisieren
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    logger: false,
    debug: false,
  }

  console.log("[SMTP] createTransport Optionen", {
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: Boolean(
      (options as SMTPTransport.Options & { requireTLS?: boolean }).requireTLS
    ),
    authUser: config.user,
  })

  cachedTransporter = nodemailer.createTransport(options)
  cachedConfigKey = configKey
  return cachedTransporter
}

/**
 * From-Header immer an Hostpoint-Mailbox koppeln.
 * Abweichende From-Adressen → Hostpoint blockiert / 535.
 */
export function resolveSmtpFrom(
  _fallbackName?: string,
  _fallbackEmail?: string
): string {
  const config = getSmtpRuntimeConfig()
  if (config?.from) return config.from
  const user = cleanEnv(process.env.SMTP_USER)
  const fromEnv = cleanEnv(process.env.EMAIL_FROM)
  return resolveFromHeader(user, fromEnv)
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

  if (!isSmtpConfigured()) {
    console.error(
      "[SMTP] ABBRUCH: SMTP_USER/SMTP_PASS fehlt oder ist Platzhalter — Versand übersprungen.",
      { to: options.to, subject: options.subject }
    )
    return false
  }

  const config = getSmtpRuntimeConfig()
  if (!config) return false

  // From IMMER an Hostpoint-konforme Config koppeln (nie freier Client-From)
  const mailOptions: SendSmtpMailOptions = {
    ...options,
    from: config.from,
  }

  console.log("[SMTP] sendSmtpMail gestartet", {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
    hasHtml: Boolean(mailOptions.html),
    hasText: Boolean(mailOptions.text),
    attachmentCount: mailOptions.attachments?.length ?? 0,
    configured: true,
  })

  logSmtpConfig(config, "Vor dem Versand")

  try {
    console.log("[SMTP] buildSmtpTransporter()…")
    const transporter = buildSmtpTransporter()

    console.log("[SMTP] transporter.verify() (SMTP-Handshake)…")
    try {
      await transporter.verify()
      console.log(`[SMTP] verify OK — Handshake erfolgreich (${Date.now() - startedAt}ms)`)
    } catch (verifyError) {
      console.error("SMTP Mail Error:", verifyError)
      console.error("[SMTP] verify FEHLGESCHLAGEN — sende trotzdem (Fallback).", {
        ...formatSmtpError(verifyError),
        elapsedMs: Date.now() - startedAt,
      })
    }

    console.log("[SMTP] transporter.sendMail() Aufruf…", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    })
    const info = await transporter.sendMail(mailOptions)
    console.log("[SMTP] transporter.sendMail() ERFOLGREICH", {
      to: mailOptions.to,
      subject: mailOptions.subject,
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
    console.error("SMTP Mail Error:", error)
    console.error("[SMTP] transporter.sendMail() FEHLGESCHLAGEN", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from,
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
      "SMTP nicht konfiguriert. Bitte SMTP_HOST, SMTP_USER und SMTP_PASS setzen."
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

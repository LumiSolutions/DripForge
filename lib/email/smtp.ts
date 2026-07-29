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

const SMTP_TIMEOUT_MS = 15_000

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

function isSmtpConnectionError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code || "")
      : ""
  const message =
    error instanceof Error ? error.message : String(error ?? "")
  return (
    /ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(
      code
    ) ||
    /ETIMEDOUT|ECONNREFUSED|ESOCKET|timeout|timed out|connect/i.test(message)
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
 * SMTP: Hostpoint asmtp.mail.hostpoint.ch (Default).
 * - Port 465 + secure:true (SSL)
 * - Port 587 + secure:false + requireTLS (STARTTLS) — oft besser auf Azure SWA
 * ENV: SMTP_PORT, SMTP_SECURE, SMTP_PREFER_STARTTLS=true
 */
function resolveSmtpSettings(overrides?: {
  port?: number
  secure?: boolean
}): SmtpRuntimeConfig {
  const user = cleanEnv(process.env.SMTP_USER)
  const pass = cleanEnv(process.env.SMTP_PASS)
  const host = normalizeSmtpHost(
    cleanEnv(process.env.SMTP_HOST) || DEFAULT_SMTP_HOST
  )
  const preferStartTls =
    cleanEnv(process.env.SMTP_PREFER_STARTTLS).toLowerCase() === "true"

  const portRaw = cleanEnv(process.env.SMTP_PORT)
  let resolvedPort =
    overrides?.port ??
    (portRaw ? Number(portRaw) : preferStartTls ? 587 : 465)
  if (!Number.isFinite(resolvedPort) || resolvedPort <= 0) {
    resolvedPort = preferStartTls ? 587 : 465
  }

  const secureEnv = cleanEnv(process.env.SMTP_SECURE).toLowerCase()
  let secure: boolean
  if (overrides?.secure !== undefined) {
    secure = overrides.secure
  } else if (resolvedPort === 465) {
    secure = true
  } else if (resolvedPort === 587) {
    secure = false
  } else if (secureEnv === "false" || secureEnv === "0") {
    secure = false
  } else if (secureEnv === "true" || secureEnv === "1") {
    secure = true
  } else {
    secure = resolvedPort === 465
  }

  const fromEnv = cleanEnv(process.env.EMAIL_FROM)
  const from = resolveFromHeader(user || DEFAULT_HOSTPOINT_FROM_EMAIL, fromEnv)

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
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })
}

function buildTransporterForConfig(config: SmtpRuntimeConfig) {
  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.port === 587 && !config.secure ? { requireTLS: true } : {}),
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    tls: {
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
    connectionTimeout: SMTP_TIMEOUT_MS,
  })

  return nodemailer.createTransport(options)
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
  cachedTransporter = buildTransporterForConfig(config)
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

async function sendWithConfig(
  config: SmtpRuntimeConfig,
  mailOptions: SendSmtpMailOptions,
  startedAt: number
): Promise<boolean> {
  logSmtpConfig(config, "Vor dem Versand")
  const transporter = buildTransporterForConfig(config)

  if (cleanEnv(process.env.SMTP_VERIFY_BEFORE_SEND) === "true") {
    try {
      await transporter.verify()
      console.log(
        `[SMTP] verify OK (${Date.now() - startedAt}ms) port=${config.port}`
      )
    } catch (verifyError) {
      console.error("SMTP Connection Failed:", formatSmtpError(verifyError))
      // weiter versuchen
    }
  }

  console.log("[SMTP] transporter.sendMail() Aufruf…", {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
    port: config.port,
    secure: config.secure,
  })

  const info = await transporter.sendMail(mailOptions)
  console.log("[SMTP] transporter.sendMail() ERFOLGREICH", {
    to: mailOptions.to,
    subject: mailOptions.subject,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    port: config.port,
    elapsedMs: Date.now() - startedAt,
  })
  return true
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

  const primary = resolveSmtpSettings()
  const mailOptions: SendSmtpMailOptions = {
    ...options,
    from: primary.from || "DripForge <shop@dripforge.ch>",
  }

  console.log("[SMTP] sendSmtpMail gestartet", {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
    hasHtml: Boolean(mailOptions.html),
    hasText: Boolean(mailOptions.text),
    attachmentCount: mailOptions.attachments?.length ?? 0,
    primaryPort: primary.port,
    primarySecure: primary.secure,
  })

  try {
    const ok = await sendWithConfig(primary, mailOptions, startedAt)
    // Cache primary transporter for reuse
    cachedTransporter = buildTransporterForConfig(primary)
    cachedConfigKey = `${primary.host}|${primary.port}|${primary.secure}|${primary.user}|${primary.pass.length}|${primary.from}`
    return ok
  } catch (error) {
    const details = formatSmtpError(error)
    if (isSmtpConnectionError(error)) {
      console.error(
        "SMTP Connection Failed:",
        details.code,
        details.message
      )
    } else {
      console.error("SMTP Mail Error:", error)
    }
    console.error("[SMTP] transporter.sendMail() FEHLGESCHLAGEN", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })

    cachedTransporter = null
    cachedConfigKey = null

    // Azure blockiert oft Port 465 — Fallback auf 587 STARTTLS
    const alreadyOn587 = primary.port === 587 && !primary.secure
    const allowFallback =
      cleanEnv(process.env.SMTP_DISABLE_587_FALLBACK).toLowerCase() !== "true"

    if (allowFallback && !alreadyOn587 && isSmtpConnectionError(error)) {
      const fallback = resolveSmtpSettings({ port: 587, secure: false })
      console.warn(
        "[SMTP] Retry mit Port 587 STARTTLS (Azure-Fallback)…",
        { host: fallback.host, port: fallback.port, secure: fallback.secure }
      )
      try {
        const ok = await sendWithConfig(fallback, mailOptions, startedAt)
        cachedTransporter = buildTransporterForConfig(fallback)
        cachedConfigKey = `${fallback.host}|${fallback.port}|${fallback.secure}|${fallback.user}|${fallback.pass.length}|${fallback.from}`
        return ok
      } catch (fallbackError) {
        const fb = formatSmtpError(fallbackError)
        console.error("SMTP Connection Failed:", fb.code, fb.message)
        console.error("CRITICAL_SMTP_ERROR:", fallbackError)
        console.error("[SMTP] 587-Fallback ebenfalls fehlgeschlagen", {
          to: mailOptions.to,
          ...fb,
          elapsedMs: Date.now() - startedAt,
        })
        return false
      }
    }

    console.error("CRITICAL_SMTP_ERROR:", error)
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

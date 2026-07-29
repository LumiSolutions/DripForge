import { NextResponse } from "next/server"
import {
  buildSmtpTransporter,
  getSmtpDiagnostics,
  getSmtpRuntimeConfig,
  isSmtpConfigured,
} from "@/lib/email/smtp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TEST_TO = "shop@dripforge.ch"

/** Diagnose ohne Klartext-Passwort: host, port, secure, Längen. */
function diagnosticPayload() {
  const d = getSmtpDiagnostics()
  return {
    host: d.host,
    port: d.port,
    secure: d.secure,
    configuredUser: d.configuredUser,
    userLength: d.userLength,
    passLength: d.passLength,
  }
}

/**
 * Diagnose-Endpoint für Hostpoint SMTP (Port 465 / SSL).
 * GET /api/test-email  und  POST /api/test-email
 * Sendet eine Test-E-Mail an shop@dripforge.ch.
 */
async function handleTestEmail() {
  const diagnostics = diagnosticPayload()

  try {
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP_PASS fehlt in der Umgebung.",
          stack: undefined,
          ...diagnostics,
        },
        { status: 500 }
      )
    }

    const config = getSmtpRuntimeConfig()
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP-Konfiguration konnte nicht geladen werden.",
          stack: undefined,
          ...diagnostics,
        },
        { status: 500 }
      )
    }

    console.log("[test-email] Sende Test-Mail (465/SSL)…", {
      ...diagnostics,
      from: config.from,
      to: TEST_TO,
    })

    const transporter = buildSmtpTransporter()
    // from MUSS dem SMTP-User entsprechen (Hostpoint 535 vermeiden)
    const info = await transporter.sendMail({
      from: config.from,
      to: TEST_TO,
      subject: "DripForge SMTP-Test",
      text: [
        "SMTP-Test erfolgreich.",
        "",
        `Host: ${config.host}`,
        `Port: ${config.port}`,
        `Secure: ${config.secure}`,
        `From: ${config.from}`,
        `Zeit: ${new Date().toISOString()}`,
      ].join("\n"),
      html: `<p><strong>SMTP-Test erfolgreich.</strong></p><p>Host: ${config.host}:${config.port} (secure=${config.secure})</p><p>From: ${config.from}</p><p>Zeit: ${new Date().toISOString()}</p>`,
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      ...diagnostics,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("[test-email] Versand fehlgeschlagen:", {
      message: err.message,
      stack: err.stack,
      ...diagnostics,
    })
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: err.stack,
        ...diagnostics,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return handleTestEmail()
}

export async function POST() {
  return handleTestEmail()
}

import { NextResponse } from "next/server"
import {
  buildSmtpTransporter,
  getSmtpRuntimeConfig,
  isSmtpConfigured,
} from "@/lib/email/smtp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TEST_TO = "shop@dripforge.ch"

/**
 * Diagnose-Endpoint für Hostpoint SMTP.
 * GET /api/test-email  und  POST /api/test-email
 * Sendet eine Test-E-Mail an shop@dripforge.ch.
 */
async function handleTestEmail() {
  try {
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP_PASS fehlt in der Umgebung.",
          stack: undefined,
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
        },
        { status: 500 }
      )
    }

    console.log("[test-email] Sende Test-Mail…", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from: config.from,
      to: TEST_TO,
    })

    const transporter = buildSmtpTransporter()
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
        `Zeit: ${new Date().toISOString()}`,
      ].join("\n"),
      html: `<p><strong>SMTP-Test erfolgreich.</strong></p><p>Host: ${config.host}:${config.port} (secure=${config.secure})</p><p>Zeit: ${new Date().toISOString()}</p>`,
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("[test-email] Versand fehlgeschlagen:", {
      message: err.message,
      stack: err.stack,
    })
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: err.stack,
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

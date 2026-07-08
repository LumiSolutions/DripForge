import nodemailer from "nodemailer"
import type Mail from "nodemailer/lib/mailer"

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  )
}

export function buildSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export function resolveSmtpFrom(fallbackName: string, fallbackEmail: string): string {
  return (
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

  const transporter = buildSmtpTransporter()
  try {
    await transporter.sendMail(options)
    return true
  } catch (error) {
    console.error(
      "E-Mail: SMTP-Versand fehlgeschlagen — Request wird trotzdem fortgesetzt.",
      { to: options.to, subject: options.subject, error }
    )
    return false
  }
}

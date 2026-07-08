"use client"

import { useState, type FormEvent } from "react"
import {
  MessageSquare,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { isValidKontaktEmail } from "@/lib/admin/kontaktanfrage-types"

export function PageKontakt({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  const [inquiryType, setInquiryType] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    if (!name.trim()) {
      setSubmitError("Bitte geben Sie Ihren Namen an.")
      return
    }
    if (!email.trim() || !isValidKontaktEmail(email)) {
      setSubmitError("Bitte geben Sie eine gueltige E-Mail-Adresse an.")
      return
    }
    if (!inquiryType) {
      setSubmitError("Bitte waehlen Sie einen Anfrage-Typ.")
      return
    }
    if (!subject.trim()) {
      setSubmitError("Bitte geben Sie einen Betreff an.")
      return
    }
    if (!message.trim()) {
      setSubmitError("Bitte geben Sie eine Nachricht ein.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          inquiryType,
          subject: subject.trim(),
          message: message.trim(),
        }),
      })
      const data = (await res.json()) as { error?: string; message?: string }

      if (!res.ok) {
        throw new Error(data.error ?? "Nachricht konnte nicht gesendet werden.")
      }

      setSubmitSuccess(
        data.message ??
          "Vielen Dank — Ihre Nachricht wurde uebermittelt. Wir melden uns so schnell wie moeglich."
      )
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
            <MessageSquare className="mr-1 h-3 w-3" />
            Kontakt aufnehmen
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="text-foreground">Kontaktieren Sie </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">DripForge</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Haben Sie ein individuelles Projekt im Sinn? Fragen zu unseren Services? 
            Wir freuen uns von Ihnen zu hören.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <h2 className="mb-6 text-xl font-bold">Nachricht Senden</h2>
                <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="name"
                        placeholder="Ihr Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting || Boolean(submitSuccess)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail <span className="text-red-500">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="ihre@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting || Boolean(submitSuccess)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Firma (optional)</Label>
                      <Input
                        id="company"
                        placeholder="Ihre Firma"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        disabled={isSubmitting || Boolean(submitSuccess)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Anfrage-Typ <span className="text-red-500">*</span></Label>
                      <Select
                        value={inquiryType}
                        onValueChange={setInquiryType}
                        disabled={isSubmitting || Boolean(submitSuccess)}
                      >
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Typ auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3d">3D-Druck Anfrage</SelectItem>
                          <SelectItem value="laser">Lasergravur Anfrage</SelectItem>
                          <SelectItem value="general">Allgemeine Frage</SelectItem>
                          <SelectItem value="quote">Offerte anfordern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Betreff <span className="text-red-500">*</span></Label>
                    <Input
                      id="subject"
                      placeholder="Kurzer Betreff Ihrer Anfrage"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={isSubmitting || Boolean(submitSuccess)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Nachricht <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="message"
                      placeholder="Erzählen Sie uns von Ihrem Projekt oder Ihrer Frage..."
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={isSubmitting || Boolean(submitSuccess)}
                      required
                    />
                  </div>

                  {submitError ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                      {submitError}
                    </p>
                  ) : null}

                  {submitSuccess ? (
                    <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      {submitSuccess}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isSubmitting || Boolean(submitSuccess)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird gesendet…
                      </>
                    ) : (
                      <>
                        Nachricht Senden
                        <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Kontaktinformationen</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">drip-forge@outlook.com</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                      <MapPin className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Standort</p>
                      <p className="font-medium">Schweiz</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Schnelle Hilfe</h3>
                <p className="mb-4 text-sm text-muted-foreground">Suchen Sie nach etwas Bestimmtem?</p>
                <ul className="space-y-2">
                  {[
                    { label: "Mehr über 3D-Druck erfahren", view: "3d-druck" },
                    { label: "Mehr über Lasergravur erfahren", view: "laser" },
                    { label: "3D-Modell hochladen", view: "shop" },
                    { label: "Shop durchstöbern", view: "shop" },
                  ].map((link) => (
                    <li key={link.label}>
                      <button 
                        onClick={() => setCurrentView(link.view)}
                        className="text-sm text-primary hover:underline"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-bold">Antwortzeit</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Wir antworten in der Regel innerhalb von 24 Stunden an Werktagen. 
                      Für dringende Anfragen rufen Sie uns bitte direkt an.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// FAQ Page

"use client"

import { useMemo, useState, type FormEvent } from "react"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  createEmptyContactField,
  type CmsContactField,
  type CmsContactFieldType,
} from "@/lib/admin/cms-page-content"
import { isValidKontaktEmail } from "@/lib/admin/kontaktanfrage-types"
import {
  KONTAKT_INQUIRY_LABELS,
  type KontaktInquiryType,
} from "@/lib/admin/kontaktanfrage-types"

function mapInquiryValue(label: string): KontaktInquiryType {
  const normalized = label.trim().toLowerCase()
  for (const [key, value] of Object.entries(KONTAKT_INQUIRY_LABELS)) {
    if (value.toLowerCase() === normalized) return key as KontaktInquiryType
  }
  if (normalized.includes("3d")) return "3d"
  if (normalized.includes("laser")) return "laser"
  if (normalized.includes("offerte") || normalized.includes("quote")) return "quote"
  return "general"
}

const FIELD_TYPES: Array<{ id: CmsContactFieldType; label: string }> = [
  { id: "text", label: "Text" },
  { id: "email", label: "E-Mail" },
  { id: "textarea", label: "Mehrzeilig" },
  { id: "select", label: "Dropdown" },
  { id: "file", label: "Datei-Upload" },
]

const POLISHED_CONTROL =
  "border-border/60 bg-secondary/40 shadow-none transition-[border-color,box-shadow,background-color] hover:bg-secondary/55 focus-visible:border-primary focus-visible:ring-primary/30"

type DynamicContactFormProps = {
  /** `polished` = dunklere Inputs, Primary-Focus, Vollbreiten-Button (Über-uns). */
  variant?: "default" | "polished"
}

export function DynamicContactForm({
  variant = "default",
}: DynamicContactFormProps = {}) {
  const polished = variant === "polished"
  const { canInlineEdit, contactFormFields, saveContactFormFields } =
    useSiteTexts()
  const [values, setValues] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const fields = useMemo(
    () => [...contactFormFields].sort((a, b) => a.sortOrder - b.sortOrder),
    [contactFormFields]
  )

  const persist = async (next: CmsContactField[]) => {
    setSaving(true)
    try {
      await saveContactFormFields(next)
    } finally {
      setSaving(false)
    }
  }

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    const byKey = (key: string) => values[key]?.trim() ?? ""

    for (const field of fields) {
      if (field.type === "file") continue
      const value = byKey(field.key)
      if (field.required && !value) {
        setSubmitError(`Bitte füllen Sie «${field.label}» aus.`)
        return
      }
      if (field.type === "email" && value && !isValidKontaktEmail(value)) {
        setSubmitError("Bitte geben Sie eine gültige E-Mail-Adresse an.")
        return
      }
    }

    const name = byKey("name") || byKey("fullname")
    const email = byKey("email") || byKey("Email")
    const company = byKey("company") || byKey("firma")
    const subject = byKey("subject") || byKey("betreff")
    const message = byKey("message") || byKey("nachricht")
    const inquiryRaw =
      byKey("inquiryType") || byKey("anfrage") || byKey("type")
    const inquiryType = inquiryRaw
      ? mapInquiryValue(inquiryRaw)
      : "general"

    if (!name || !email || !subject || !message) {
      setSubmitError(
        "Name, E-Mail, Betreff und Nachricht werden für den Versand benötigt."
      )
      return
    }

    const known = new Set([
      "name",
      "email",
      "company",
      "subject",
      "message",
      "inquiryType",
      "Name",
      "Email",
      "firma",
      "betreff",
      "nachricht",
      "anfrage",
      "type",
    ])
    const extraFields: Record<string, string> = {}
    for (const field of fields) {
      if (known.has(field.key)) continue
      if (field.type === "file") {
        if (files[field.key]) extraFields[field.key] = files[field.key]
        continue
      }
      const value = byKey(field.key)
      if (value) extraFields[field.label || field.key] = value
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          inquiryType,
          subject,
          message,
          extraFields,
        }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error ?? "Nachricht konnte nicht gesendet werden.")
      setSubmitSuccess(
        data.message ??
          "Vielen Dank — Ihre Nachricht wurde übermittelt. Wir melden uns so schnell wie möglich."
      )
      setValues({})
      setFiles({})
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canInlineEdit && (
        <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Kontaktformular-Felder bearbeiten (Text, Dropdown, Datei-Upload).
            </p>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() =>
                void persist([...fields, createEmptyContactField(fields.length)])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Feld hinzufügen
            </Button>
          </div>
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li
                key={field.id}
                className="grid gap-2 rounded-md border border-border/50 bg-background/80 p-2 md:grid-cols-[1fr_120px_auto]"
              >
                <Input
                  value={field.label}
                  onChange={(e) =>
                    void persist(
                      fields.map((item) =>
                        item.id === field.id
                          ? { ...item, label: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Label"
                />
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    void persist(
                      fields.map((item) =>
                        item.id === field.id
                          ? { ...item, type: value as CmsContactFieldType }
                          : item
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <label className="mr-2 inline-flex items-center gap-1 text-[11px]">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) =>
                        void persist(
                          fields.map((item) =>
                            item.id === field.id
                              ? { ...item, required: checked }
                              : item
                          )
                        )
                      }
                    />
                    Pflicht
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...fields]
                      const tmp = next[index]!
                      next[index] = next[index - 1]!
                      next[index - 1] = tmp
                      void persist(next.map((item, i) => ({ ...item, sortOrder: i })))
                    }}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={index === fields.length - 1}
                    onClick={() => {
                      const next = [...fields]
                      const tmp = next[index]!
                      next[index] = next[index + 1]!
                      next[index + 1] = tmp
                      void persist(next.map((item, i) => ({ ...item, sortOrder: i })))
                    }}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-600"
                    onClick={() => {
                      if (fields.length <= 2) {
                        window.alert("Mindestens zwei Felder behalten.")
                        return
                      }
                      void persist(
                        fields
                          .filter((item) => item.id !== field.id)
                          .map((item, i) => ({ ...item, sortOrder: i }))
                      )
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {field.type === "select" ? (
                  <Input
                    className="md:col-span-3"
                    value={field.options.join(", ")}
                    onChange={(e) =>
                      void persist(
                        fields.map((item) =>
                          item.id === field.id
                            ? {
                                ...item,
                                options: e.target.value
                                  .split(",")
                                  .map((entry) => entry.trim())
                                  .filter(Boolean),
                              }
                            : item
                        )
                      )
                    }
                    placeholder="Optionen kommagetrennt"
                  />
                ) : (
                  <Input
                    className="md:col-span-3"
                    value={field.placeholder}
                    onChange={(e) =>
                      void persist(
                        fields.map((item) =>
                          item.id === field.id
                            ? { ...item, placeholder: e.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Platzhalter"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-6 md:grid-cols-2">
          {fields.map((field) => {
            const fullWidth =
              field.type === "textarea" ||
              field.type === "file" ||
              field.key === "subject" ||
              field.key === "message"
            return (
              <div
                key={field.id}
                className={fullWidth ? "space-y-2 md:col-span-2" : "space-y-2"}
              >
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required ? (
                    <span className="text-red-500"> *</span>
                  ) : null}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.id}
                    rows={5}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    required={field.required}
                    className={polished ? POLISHED_CONTROL : undefined}
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={values[field.key] ?? ""}
                    onValueChange={(value) => setValue(field.key, value)}
                    disabled={isSubmitting || Boolean(submitSuccess)}
                  >
                    <SelectTrigger
                      id={field.id}
                      className={polished ? POLISHED_CONTROL : undefined}
                    >
                      <SelectValue placeholder={field.placeholder || "Auswählen"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "file" ? (
                  <Input
                    id={field.id}
                    type="file"
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    className={polished ? POLISHED_CONTROL : undefined}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setFiles((prev) => ({
                            ...prev,
                            [field.key]: reader.result as string,
                          }))
                        }
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                ) : (
                  <Input
                    id={field.id}
                    type={field.type === "email" ? "email" : "text"}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    required={field.required}
                    className={polished ? POLISHED_CONTROL : undefined}
                  />
                )}
              </div>
            )
          })}
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

        <div className={polished ? "flex justify-end" : undefined}>
          <Button
            type="submit"
            className={
              polished
                ? "w-full bg-primary text-primary-foreground shadow-sm transition-[transform,background-color,box-shadow] hover:bg-primary/90 hover:shadow-md active:scale-[0.99] sm:w-auto sm:min-w-[11rem]"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }
            disabled={isSubmitting || Boolean(submitSuccess)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet…
              </>
            ) : (
              <>
                Nachricht senden
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

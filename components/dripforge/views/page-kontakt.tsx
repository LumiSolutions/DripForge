"use client"

import {
  MessageSquare,
  Mail,
  MapPin,
  Phone,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { DynamicContactForm } from "@/components/dripforge/dynamic-contact-form"

export function PageKontakt({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  const {
    company: companySettings,
    mailtoHref,
    telHref,
  } = useCompanySettings()

  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center md:mb-12">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
            <MessageSquare className="mr-1 h-3 w-3" />
            <SiteText k="page_kontakt_hero_badge" />
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <SiteTextPhrase
              parts={[
                { key: "page_kontakt_hero_title_prefix", className: "text-foreground" },
                {
                  key: "page_kontakt_hero_title_highlight",
                  className:
                    "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                },
              ]}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            <SiteText k="page_kontakt_hero_subtitle" />
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <h2 className="mb-6 text-xl font-bold">
                  <SiteText k="page_kontakt_form_title" />
                </h2>
                <DynamicContactForm />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">
                  <SiteText k="page_kontakt_sidebar_info_title" />
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <a href={mailtoHref} className="font-medium hover:text-primary">
                        {companySettings.kontaktEmail}
                      </a>
                    </div>
                  </li>
                  {companySettings.telefonnummer ? (
                    <li className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Telefon</p>
                        <a href={telHref ?? undefined} className="font-medium hover:text-primary">
                          {companySettings.telefonnummer}
                        </a>
                      </div>
                    </li>
                  ) : null}
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                      <MapPin className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Standort</p>
                      <p className="whitespace-pre-line font-medium">
                        {companySettings.firmenname}
                        {companySettings.firmenAdresse
                          ? `\n${companySettings.firmenAdresse}`
                          : ""}
                      </p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">
                  <SiteText k="page_kontakt_sidebar_help_title" />
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Suchen Sie nach etwas Bestimmtem?
                </p>
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
                    <h4 className="font-bold">
                      <SiteText k="page_kontakt_sidebar_response_title" />
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <SiteText k="page_kontakt_sidebar_response_body" />
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

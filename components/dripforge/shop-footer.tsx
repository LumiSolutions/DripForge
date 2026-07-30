"use client"

import Link from "next/link"
import { Mail, MapPin, Phone, Printer, Zap } from "lucide-react"
import {
  isShopNavVisible,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { shopViewHref } from "@/lib/dripforge/shop-routes"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteImage } from "@/components/dripforge/editable-site-image"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import { useEffect, useState } from "react"

export function ShopFooter() {
  const { company, mailtoHref, telHref } = useCompanySettings()
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    normalizeServiceVisibility(null)
  )

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServices(normalizeServiceVisibility(data))
      })
      .catch(() => {
        console.warn("Footer: Service-Sichtbarkeit konnte nicht geladen werden.")
      })
  }, [])

  return (
    <footer className="border-t border-border bg-card/50 py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <SiteImage
                imageKey="brand_logo"
                width={28}
                height={28}
                imageClassName="rounded"
                className="shrink-0"
              />
              <span className="font-bold">
                <span className="text-primary">Drip</span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                  Forge
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              <SiteText k="footer_tagline" />
            </p>
            <div className="mt-4 flex gap-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-semibold text-foreground"><SiteText k="footer_services_heading" /></h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {services.druck3d && (
                <li>
                  <Link href={shopViewHref("3d-druck")} className="hover:text-primary">
                    3D-Druck
                  </Link>
                </li>
              )}
              {(services.lasergravur ||
                services.laserschnitt ||
                services.markierungAetzung) && (
                <li>
                  <Link href={shopViewHref("laser")} className="hover:text-primary">
                    Lasergravur
                  </Link>
                </li>
              )}
              {isShopNavVisible(services) && (
                <li>
                  <Link href={shopViewHref("shop")} className="hover:text-primary">
                    Shop
                  </Link>
                </li>
              )}
              {services.druck3d && (
                <li>
                  <Link
                    href={shopViewHref("individual-3d")}
                    className="hover:text-primary"
                  >
                    Individueller 3D-Druck
                  </Link>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold text-foreground"><SiteText k="footer_company_heading" /></h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/kontakt" className="hover:text-primary">
                  Kontakt
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href={shopViewHref("impressum")} className="hover:text-primary">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/agb" className="hover:text-primary">
                  AGB
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold text-foreground"><SiteText k="footer_contact_heading" /></h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a href={mailtoHref} className="hover:text-primary">
                  {company.kontaktEmail}
                </a>
              </li>
              {company.telefonnummer ? (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  {telHref ? (
                    <a href={telHref} className="hover:text-primary">
                      {company.telefonnummer}
                    </a>
                  ) : (
                    <span>{company.telefonnummer}</span>
                  )}
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="whitespace-pre-line">
                  {company.firmenname}
                  {company.firmenAdresse ? `\n${company.firmenAdresse}` : ""}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 {company.firmenname || "DripForge"}. <SiteText k="footer_copyright_suffix" />
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/datenschutz" className="hover:text-primary">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:text-primary">
              AGB
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

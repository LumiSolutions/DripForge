"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Mail, MapPin, Printer, Zap } from "lucide-react"
import type { CompanySettings } from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/admin/types"
import {
  filterNavItems,
  isShopNavVisible,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { shopViewHref } from "@/lib/dripforge/shop-routes"

export function ShopFooter() {
  const [companyFooter, setCompanyFooter] = useState<CompanySettings>(
    DEFAULT_COMPANY_SETTINGS
  )
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    normalizeServiceVisibility(null)
  )

  useEffect(() => {
    void fetch("/api/settings/company")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.firmenname) {
          setCompanyFooter({ ...DEFAULT_COMPANY_SETTINGS, ...data })
        }
      })
      .catch(() => {
        console.warn("Footer: Firmendaten konnten nicht geladen werden.")
      })

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
    <footer className="border-t border-border bg-card/50 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
                alt="DripForge"
                width={28}
                height={28}
                className="rounded"
              />
              <span className="font-bold">
                <span className="text-primary">Drip</span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                  Forge
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Verwandeln Sie Ihre Ideen in Realität mit präzisem 3D-Druck und
              Lasergravur-Services.
            </p>
            <div className="mt-4 flex gap-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h4 className="mb-4 font-semibold text-foreground">Services</h4>
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
            <h4 className="mb-4 font-semibold text-foreground">Unternehmen</h4>
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
            <h4 className="mb-4 font-semibold text-foreground">Kontakt</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                drip-forge@outlook.com
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span className="whitespace-pre-line">
                  {companyFooter.firmenname}
                  {companyFooter.firmenAdresse
                    ? `\n${companyFooter.firmenAdresse}`
                    : ""}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 {companyFooter.firmenname || "DripForge"}. Alle Rechte vorbehalten.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/datenschutz" className="hover:text-primary">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:text-primary">
              AGB
            </Link>
            <Link href="/admin" className="hover:text-primary">
              Admin-Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

import { permanentRedirect } from "next/navigation"

/**
 * Eigenständige Kontaktseite entfernt.
 * Permanenter Redirect zum Kontaktbereich auf «Über uns».
 * (Middleware sendet zusätzlich HTTP 301 für /kontakt und /contact.)
 */
export default function KontaktRedirectPage() {
  permanentRedirect("/ueber-uns#kontakt")
}

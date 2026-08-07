import { permanentRedirect } from "next/navigation"

/**
 * Die eigenständige Kontaktseite entfällt.
 * Permanente Weiterleitung (308) zum Kontaktbereich auf «Über uns».
 */
export default function KontaktRedirectPage() {
  permanentRedirect("/ueber-uns#kontakt")
}

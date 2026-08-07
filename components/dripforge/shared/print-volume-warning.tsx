"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { MAX_PRINT_DIMENSION_MM } from "@/lib/dripforge/print-limits"

export function PrintVolumeWarning() {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border-2 border-red-500/80 bg-red-50 p-4 text-red-950 shadow-md dark:border-red-500 dark:bg-red-950/40 dark:text-red-100"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            <span className="font-bold">Modell zu gross!</span> Dieses Objekt
            überschreitet unseren maximalen Druckbereich von{" "}
            {MAX_PRINT_DIMENSION_MM} x {MAX_PRINT_DIMENSION_MM} x{" "}
            {MAX_PRINT_DIMENSION_MM} mm.
          </p>
          <div>
            <p className="font-bold">Was du tun kannst:</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>
                Bitte nutze das Eingabefeld oder den Slider oben, um das Modell
                so weit zu <strong>verkleinern</strong>, bis alle Achsen unter{" "}
                {MAX_PRINT_DIMENSION_MM} mm liegen.
              </li>
              <li>
                Möchtest du das Modell unbedingt in dieser Übergrösse drucken
                lassen? Kein Problem! Kontaktiere uns für eine
                Spezialanfertigung (z. B. ein Druck in mehreren Einzelteilen)
                direkt über unser{" "}
                <Link
                  href="/ueber-uns#kontakt"
                  className="font-semibold text-red-800 underline underline-offset-2 hover:text-red-600 dark:text-red-200 dark:hover:text-red-100"
                >
                  Kontaktformular
                </Link>
                .
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

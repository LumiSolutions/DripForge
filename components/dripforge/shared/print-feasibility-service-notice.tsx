"use client"

import { MessageCircleHeart, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type PrintFeasibilityServiceNoticeProps = {
  className?: string
  /** Kompakte Variante unter dem Upload; ausführlicher bei der Anfrage. */
  variant?: "upload" | "inquiry"
}

/**
 * Transparente Hinweise zu manueller Machbarkeitsprüfung und Sonderlösungen.
 */
export function PrintFeasibilityServiceNotice({
  className,
  variant = "upload",
}: PrintFeasibilityServiceNoticeProps) {
  const compact = variant === "upload"

  return (
    <aside
      className={cn(
        "rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3.5 text-sm text-foreground",
        className
      )}
      aria-label="Hinweise zur Machbarkeitsprüfung"
    >
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
            aria-hidden
          />
          <p className={cn("leading-relaxed", compact && "text-[13px]")}>
            <span className="font-semibold">Manuelle Machbarkeitsprüfung: </span>
            Jedes Modell wird vor dem Produktionsstart von unseren Experten
            geprüft.
          </p>
        </div>

        <div className="flex gap-2.5">
          <MessageCircleHeart
            className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
            aria-hidden
          />
          <p className={cn("leading-relaxed", compact && "text-[13px]")}>
            <span className="font-semibold">
              Sonderlösungen &amp; Modell-Optimierung:{" "}
            </span>
            {compact ? (
              <>
                Bei komplexen oder fehlerhaften Geometrien stornieren wir nicht
                direkt — wir kontaktieren dich persönlich und bieten eine
                kostenlose Vereinfachung oder Anpassung gegen eine kleine
                Aufwandspauschale an.
              </>
            ) : (
              <>
                Sollte dein Modell zu komplex sein oder fehlerhafte Geometrien
                aufweisen, stornieren wir nicht direkt — wir kontaktieren dich
                persönlich! Wir bieten dir gerne eine kostenlose
                Überarbeitung/Vereinfachung oder eine Anpassung gegen eine kleine
                Aufwandspauschale an.
              </>
            )}
          </p>
        </div>
      </div>
    </aside>
  )
}

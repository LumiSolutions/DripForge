"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import Image from "next/image"
import { StaffAuthFlow } from "@/components/admin/staff-auth-flow"
import { SupportMissionLink } from "@/components/dripforge/support-nav-link"
import { useSupportPageSettings } from "@/hooks/use-support-page-active"
import {
  buildPublicCountdownConfig,
  getCountdownForTarget,
  shouldUseUnoptimizedCountdownHero,
  type PublicCountdownConfig,
} from "@/lib/dripforge/countdown-settings"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import { cn } from "@/lib/utils"

function EmberField({ variant }: { variant: PublicCountdownConfig["template"] }) {
  const embers = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 17) % 92)}%`,
        bottom: `${-2 + ((i * 11) % 18)}%`,
        size: 2 + (i % 4),
        delay: `${(i * 0.35) % 6}s`,
        duration: `${3.5 + (i % 5) * 0.7}s`,
        hue:
          variant === "shop_update"
            ? i % 3 === 0
              ? "rgba(56,189,248,0.95)"
              : "rgba(129,140,248,0.9)"
            : i % 3 === 0
              ? "rgba(56,189,248,0.9)"
              : "rgba(249,115,22,0.95)",
      })),
    [variant]
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {embers.map((e) => (
        <span
          key={e.id}
          className="cs-ember absolute rounded-full"
          style={
            {
              left: e.left,
              bottom: e.bottom,
              width: e.size,
              height: e.size,
              background: e.hue,
              boxShadow: `0 0 ${e.size * 3}px ${e.hue}`,
              "--ember-delay": e.delay,
              "--ember-duration": e.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center px-1 sm:px-2">
      <span className="cs-countdown-digit text-4xl font-black tabular-nums tracking-tight sm:text-5xl md:text-6xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-[10px]">
        {label}
      </span>
    </div>
  )
}

function CountdownSeparator() {
  return (
    <span
      className="cs-countdown-digit mb-5 self-start text-3xl font-black sm:text-4xl md:text-5xl"
      aria-hidden
    >
      :
    </span>
  )
}

export function ComingSoonPage({
  onAccessGranted,
}: {
  onAccessGranted?: () => void
}) {
  const { showSupportOnCountdownPage: supportPageVisible } = useSupportPageSettings()
  const { company } = useCompanySettings()
  const [countdownConfig, setCountdownConfig] = useState<PublicCountdownConfig>(
    buildPublicCountdownConfig(null)
  )
  const [countdown, setCountdown] = useState(() =>
    getCountdownForTarget(buildPublicCountdownConfig(null).targetAt)
  )
  const [testerOpen, setTesterOpen] = useState(false)
  const [testerFeedback, setTesterFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    document.documentElement.classList.add("dark")

    void (async () => {
      try {
        const res = await fetch("/api/settings/launch", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { countdown?: PublicCountdownConfig }
        if (data.countdown) {
          setCountdownConfig(data.countdown)
          setCountdown(getCountdownForTarget(data.countdown.targetAt))
        }
      } catch {
        /* Fallback bleibt aktiv */
      }
    })()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getCountdownForTarget(countdownConfig.targetAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdownConfig.targetAt])

  const isUpdate = countdownConfig.template === "shop_update"

  const launchDateLabel = new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(countdownConfig.targetAt))

  return (
    <div
      className={cn(
        "relative isolate flex min-h-screen flex-col items-center justify-between overflow-x-hidden bg-[#0a0a0c] py-10 text-zinc-100 sm:py-12",
        countdownConfig.templateClass
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="cs-noise absolute inset-0 opacity-80" />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(24,24,27,0.2),rgba(10,10,12,1)_55%)]"
          aria-hidden
        />
        <div
          className={cn(
            "cs-glow-orange pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full",
            isUpdate ? "bg-indigo-600/25" : "bg-orange-600/30"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "cs-glow-blue pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full",
            isUpdate ? "bg-cyan-400/30" : "bg-cyan-500/20"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-[38%] h-px bg-gradient-to-r from-transparent to-transparent",
            isUpdate ? "via-cyan-400/45" : "via-orange-500/40"
          )}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent"
        />
      </div>
      <EmberField variant={countdownConfig.template} />

      <header className="sticky top-0 z-20 w-full border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <span className="truncate text-sm font-bold tracking-tight">
            <span className={isUpdate ? "text-cyan-400" : "text-orange-500"}>Drip</span>
            <span className="bg-gradient-to-r from-orange-500 to-cyan-400 bg-clip-text text-transparent">
              Forge
            </span>
          </span>
          {supportPageVisible && (
            <SupportMissionLink active={false} variant="countdown" display="all" />
          )}
        </div>
      </header>

      <main className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="flex w-full max-w-2xl shrink-0 flex-col items-center gap-6 sm:max-w-3xl">
          <div
            className={cn(
              "w-full rounded-lg ring-1 ring-white/5",
              isUpdate
                ? "shadow-[0_0_80px_rgba(34,211,238,0.18),0_24px_48px_rgba(0,0,0,0.6)]"
                : "shadow-[0_0_80px_rgba(249,115,22,0.15),0_24px_48px_rgba(0,0,0,0.6)]"
            )}
          >
            <Image
              src={countdownConfig.heroImageUrl}
              alt="DripForge — Coming Soon"
              width={1200}
              height={1200}
              unoptimized={shouldUseUnoptimizedCountdownHero(countdownConfig.heroImageUrl)}
              className="aspect-square h-auto w-full object-contain"
              priority
            />
          </div>

          <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.45em] sm:text-xs",
                isUpdate ? "text-cyan-300/90" : "cs-metallic-gold"
              )}
            >
              {countdownConfig.label}
            </p>

            <div
              className={cn(
                "w-full rounded-lg border bg-black/40 px-3 py-3 sm:px-5 sm:py-4",
                isUpdate
                  ? "border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.14)]"
                  : "border-orange-500/15 shadow-[0_0_40px_rgba(249,115,22,0.12)]"
              )}
            >
              <div className="flex items-end justify-center gap-0.5 sm:gap-1">
                <CountdownUnit value={countdown.days} label="Tage" />
                <CountdownSeparator />
                <CountdownUnit value={countdown.hours} label="Std." />
                <CountdownSeparator />
                <CountdownUnit value={countdown.minutes} label="Min." />
                <CountdownSeparator />
                <CountdownUnit value={countdown.seconds} label="Sek." />
              </div>
            </div>

            <p
              className={cn(
                "text-lg font-bold tracking-wider sm:text-xl md:text-2xl",
                isUpdate ? "text-cyan-200/90" : "cs-metallic-gold"
              )}
            >
              {launchDateLabel}
            </p>
          </div>
        </div>

        <section className="flex max-w-xl shrink-0 flex-col items-center space-y-4 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            {countdownConfig.teaser}
          </p>
          <h1 className="text-lg font-bold leading-snug text-zinc-200 sm:text-xl">
            {countdownConfig.title}
          </h1>

          {countdown.isPast && (
            <p className={cn("text-sm", isUpdate ? "text-cyan-300" : "text-orange-300")}>
              {countdownConfig.pastMessage}
            </p>
          )}
        </section>
      </main>

      <footer className="relative z-30 mt-6 flex w-full max-w-xl flex-col items-center space-y-4 px-4 pb-2 text-center sm:mt-8">
        <p className="text-[10px] text-zinc-700">
          © 2026 {company.firmenname}
          {company.firmenAdresse
            ? ` · ${company.firmenAdresse.split("\n").map((l) => l.trim()).filter(Boolean).join(", ")}`
            : ""}
        </p>

        {testerFeedback && (
          <p
            role="status"
            className={cn(
              "w-full max-w-xs rounded-lg px-3 py-2 text-xs font-medium",
              testerFeedback.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            )}
          >
            {testerFeedback.message}
          </p>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 leading-loose">
          <button
            type="button"
            onClick={() => {
              setTesterOpen((open) => !open)
              setTesterFeedback(null)
            }}
            className="touch-manipulation text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Tester-Zugang
          </button>
        </div>

        {testerOpen && (
          <div className="pointer-events-auto relative z-30 mx-auto w-full max-w-xs text-left">
            <StaffAuthFlow
              role="tester"
              intent="preview"
              title="Vorschau-Zugang"
              passwordPlaceholder="Tester-Passwort"
              submitLabel="Anmelden"
              compact
              showBackLink={false}
              onSuccess={() => {
                setTesterOpen(false)
                setTesterFeedback({
                  type: "success",
                  message: "Erfolgreich als Tester angemeldet! Vorschau wird geladen…",
                })
                window.setTimeout(() => {
                  if (onAccessGranted) {
                    onAccessGranted()
                  } else {
                    window.location.reload()
                  }
                }, 900)
              }}
            />
          </div>
        )}
      </footer>
    </div>
  )
}

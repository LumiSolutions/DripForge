"use client"

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getLaunchCountdown } from "@/lib/dripforge/launch-config"
import { cn } from "@/lib/utils"

function EmberField() {
  const embers = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 17) % 92)}%`,
        bottom: `${-2 + ((i * 11) % 18)}%`,
        size: 2 + (i % 4),
        delay: `${(i * 0.35) % 6}s`,
        duration: `${3.5 + (i % 5) * 0.7}s`,
        hue: i % 3 === 0 ? "rgba(56,189,248,0.9)" : "rgba(249,115,22,0.95)",
      })),
    []
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
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

export function ComingSoonPage({ onAccessGranted }: { onAccessGranted: () => void }) {
  const [countdown, setCountdown] = useState(getLaunchCountdown())
  const [testerOpen, setTesterOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [testerError, setTesterError] = useState<string | null>(null)
  const [testerLoading, setTesterLoading] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getLaunchCountdown())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleTesterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTesterError(null)
    setTesterLoading(true)
    try {
      const res = await fetch("/api/preview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Zugang verweigert")
      setPassword("")
      setTesterOpen(false)
      onAccessGranted()
    } catch (err) {
      setTesterError(
        err instanceof Error ? err.message : "Zugang konnte nicht freigeschaltet werden."
      )
    } finally {
      setTesterLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0c] text-zinc-100">
      {/* Hintergrund: Textur, Glows, Funken */}
      <div className="cs-noise pointer-events-none absolute inset-0 opacity-80" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(24,24,27,0.2),rgba(10,10,12,1)_55%)]"
        aria-hidden
      />
      <div
        className="cs-glow-orange pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-orange-600/30"
        aria-hidden
      />
      <div
        className="cs-glow-blue pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-cyan-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-[38%] h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent"
        aria-hidden
      />
      <EmberField />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        {/* Hero-Poster mit Countdown-Overlay */}
        <div className="relative w-full max-w-2xl sm:max-w-3xl">
          <div className="relative overflow-hidden rounded-lg shadow-[0_0_80px_rgba(249,115,22,0.15),0_24px_48px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
            <Image
              src="/images/launch-hero.png"
              alt="DripForge — Custom 3D Prints & Laser Engraving"
              width={1200}
              height={1200}
              className="h-auto w-full"
              priority
            />

            {/* Verdeckt «WEBSITE OPENING» + statisches Datum im Poster */}
            <div
              className="absolute inset-x-[5%] top-[54%] bottom-[9%] flex flex-col items-center justify-end pb-[2%] sm:inset-x-[6%] sm:top-[55%] sm:bottom-[8%] sm:pb-[2.5%]"
              aria-hidden={false}
            >
              <div
                className="absolute inset-0 rounded-sm bg-gradient-to-b from-[#0b0b0d]/40 via-[#09090b]/97 to-[#070709]/99 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent to-[#09090b]"
                aria-hidden
              />

              <div className="relative z-10 flex w-full flex-col items-center px-2 sm:px-4">
                <p className="cs-metallic-gold mb-3 text-[10px] font-semibold uppercase tracking-[0.45em] sm:mb-4 sm:text-xs">
                  Countdown zum Launch
                </p>

                <div className="rounded-lg border border-orange-500/15 bg-black/40 px-2 py-2 shadow-[0_0_40px_rgba(249,115,22,0.12)] sm:px-4 sm:py-3">
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

                <p className="cs-metallic-gold mt-4 text-lg font-bold tracking-wider sm:mt-5 sm:text-xl md:text-2xl">
                  01.08.2026
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Schweizer Text unter dem Poster */}
        <div className="mt-8 max-w-xl text-center sm:mt-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 sm:text-xs">
            Hier entsteht DripForge
          </p>
          <h1 className="mt-3 text-lg font-bold leading-snug text-zinc-200 sm:text-xl">
            Präziser 3D-Druck &amp; Lasergravur aus der Schweiz
          </h1>

          {countdown.isPast && (
            <p className="mt-4 text-sm text-orange-300">
              Der Launch-Termin ist erreicht — die Freischaltung erfolgt in Kürze.
            </p>
          )}
        </div>

        <p className="cs-metallic-silver mt-8 text-sm font-medium tracking-[0.35em] sm:text-base">
          DRIPFORGE.CH
        </p>
      </main>

      <footer className="relative z-10 px-4 py-5 text-center">
        <p className="text-[10px] text-zinc-700">© 2026 DripForge · Pfäffikon ZH</p>
        <button
          type="button"
          onClick={() => setTesterOpen((v) => !v)}
          className="mt-2 text-[10px] text-zinc-500 transition-colors hover:text-zinc-400"
        >
          Tester-Zugang
        </button>

        {testerOpen && (
          <form
            onSubmit={(e) => void handleTesterSubmit(e)}
            className="mx-auto mt-3 max-w-xs rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 text-left shadow-2xl ring-1 ring-orange-500/10"
          >
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
              <Lock className="h-3.5 w-3.5 text-orange-500" />
              Vorschau-Zugang
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tester-Passwort"
              className="border-zinc-800 bg-black/60 text-white"
              autoComplete="current-password"
            />
            {testerError && (
              <p className="mt-2 text-xs text-red-400">{testerError}</p>
            )}
            <Button
              type="submit"
              disabled={testerLoading || !password.trim()}
              className={cn("mt-3 w-full bg-orange-500 hover:bg-orange-600")}
            >
              {testerLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Shop öffnen"
              )}
            </Button>
          </form>
        )}

        <Link
          href="/admin"
          className="mt-3 inline-block text-[10px] text-zinc-800 hover:text-zinc-600"
        >
          Admin
        </Link>
      </footer>
    </div>
  )
}

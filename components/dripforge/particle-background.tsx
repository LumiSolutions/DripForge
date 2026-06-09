"use client"

import { useEffect, useState, type CSSProperties } from "react"

type Spark = {
  id: number
  left: string
  bottom: string
  size: number
  delay: string
  duration: string
  color: string
}

function buildSparks(): Spark[] {
  return Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: `${4 + ((i * 17) % 92)}%`,
    bottom: `${-2 + ((i * 11) % 18)}%`,
    size: 2 + (i % 3),
    delay: `${(i * 0.35) % 6}s`,
    duration: `${3.5 + (i % 5) * 0.7}s`,
    color:
      i % 4 === 0
        ? "rgba(255,255,255,0.7)"
        : i % 3 === 0
          ? "rgba(56,189,248,0.55)"
          : "rgba(249,115,22,0.9)",
  }))
}

/**
 * Eigenstaendiger Partikel-Layer — beruehrt kein Seitenlayout.
 * fixed inset-0, hinter interaktivem Content (Layout-Wrapper z-20).
 */
export function ParticleBackground() {
  const [sparks, setSparks] = useState<Spark[]>([])

  useEffect(() => {
    setSparks(buildSparks())
  }, [])

  if (sparks.length === 0) return null

  return (
    <div
      id="particles-js"
      className="pointer-events-none fixed inset-0 z-10 h-full w-full min-h-screen overflow-hidden"
      aria-hidden
    >
      {sparks.map((s) => (
        <span
          key={s.id}
          className="cs-ember absolute rounded-full"
          style={
            {
              left: s.left,
              bottom: s.bottom,
              width: s.size,
              height: s.size,
              background: s.color,
              boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
              "--ember-delay": s.delay,
              "--ember-duration": s.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

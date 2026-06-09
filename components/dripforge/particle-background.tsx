"use client"

import { useMemo, type CSSProperties } from "react"

const PARTICLE_COUNT = 40

type Particle = {
  id: number
  left: string
  bottom: string
  size: number
  delay: string
  duration: string
  color: string
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const variant = i % 5
    const color =
      variant === 0
        ? "rgba(255,255,255,0.75)"
        : variant === 1
          ? "rgba(56,189,248,0.55)"
          : "rgba(249,115,22,0.9)"

    return {
      id: i,
      left: `${3 + ((i * 19) % 94)}%`,
      bottom: `${-4 + ((i * 13) % 22)}%`,
      size: 1.5 + (i % 3),
      delay: `${(i * 0.42) % 7}s`,
      duration: `${3.8 + (i % 6) * 0.65}s`,
      color,
    }
  })
}

export function ParticleBackground() {
  const particles = useMemo(() => buildParticles(), [])

  return (
    <div
      className="particle-field pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle-ember absolute rounded-full"
          style={
            {
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              "--particle-delay": p.delay,
              "--particle-duration": p.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

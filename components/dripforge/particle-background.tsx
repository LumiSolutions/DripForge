"use client"

import { useEffect, useState, type CSSProperties } from "react"

const PARTICLE_COUNT = 42

const COLORS = [
  "rgba(249, 115, 22, 0.95)", /* orange */
  "rgba(245, 158, 11, 0.9)", /* amber */
  "rgba(255, 255, 255, 0.8)", /* white */
  "rgba(251, 191, 36, 0.75)", /* gold */
  "rgba(56, 189, 248, 0.45)", /* subtle cyan accent */
] as const

type Particle = {
  id: number
  left: number
  size: number
  delay: number
  duration: number
  rise: number
  drift: number
  peakOpacity: number
  color: string
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
    id,
    left: Math.random() * 96 + 2,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 8,
    duration: 4 + Math.random() * 5.5,
    rise: 80 + Math.random() * 140,
    drift: (Math.random() - 0.5) * 48,
    peakOpacity: 0.55 + Math.random() * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
  }))
}

export function ParticleBackground() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    setParticles(buildParticles())
  }, [])

  if (particles.length === 0) return null

  return (
    <div
      className="particle-field pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle-ember absolute bottom-0 rounded-full"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${Math.max(2, p.size * 2.5)}px ${p.color}`,
              "--particle-delay": `${p.delay}s`,
              "--particle-duration": `${p.duration}s`,
              "--particle-rise": `${-p.rise}px`,
              "--particle-drift-x": `${p.drift}px`,
              "--particle-peak-opacity": p.peakOpacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

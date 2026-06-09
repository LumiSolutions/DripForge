"use client"

import { useEffect, useState, type CSSProperties } from "react"

type ParticleConfig = {
  count: number
  size: { min: number; max: number }
  opacity: { min: number; max: number }
  rise: { min: number; max: number }
  duration: { min: number; max: number }
  colors: string[]
}

const DEFAULT_CONFIG: ParticleConfig = {
  count: 50,
  size: { min: 2, max: 4.5 },
  opacity: { min: 0.75, max: 1 },
  rise: { min: 120, max: 280 },
  duration: { min: 4, max: 9 },
  colors: [
    "rgba(249, 115, 22, 1)",
    "rgba(245, 158, 11, 0.95)",
    "rgba(255, 255, 255, 0.95)",
    "rgba(251, 191, 36, 0.9)",
    "rgba(56, 189, 248, 0.6)",
  ],
}

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

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function buildParticles(config: ParticleConfig): Particle[] {
  return Array.from({ length: config.count }, (_, id) => ({
    id,
    left: Math.random() * 96 + 2,
    size: rand(config.size.min, config.size.max),
    delay: Math.random() * 8,
    duration: rand(config.duration.min, config.duration.max),
    rise: rand(config.rise.min, config.rise.max),
    drift: (Math.random() - 0.5) * 56,
    peakOpacity: rand(config.opacity.min, config.opacity.max),
    color: config.colors[Math.floor(Math.random() * config.colors.length)]!,
  }))
}

export function ParticleBackground() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    void fetch("/particles.json")
      .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
      .then((config: ParticleConfig) => {
        const merged: ParticleConfig = {
          ...DEFAULT_CONFIG,
          ...config,
          size: { ...DEFAULT_CONFIG.size, ...config.size },
          opacity: { ...DEFAULT_CONFIG.opacity, ...config.opacity },
          rise: { ...DEFAULT_CONFIG.rise, ...config.rise },
          duration: { ...DEFAULT_CONFIG.duration, ...config.duration },
          colors: config.colors?.length ? config.colors : DEFAULT_CONFIG.colors,
        }
        setParticles(buildParticles(merged))
      })
      .catch(() => {
        setParticles(buildParticles(DEFAULT_CONFIG))
      })
  }, [])

  if (particles.length === 0) return null

  return (
    <div id="particles-js" className="particle-field" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle-ember"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${Math.max(3, p.size * 3.5)}px ${p.color}`,
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

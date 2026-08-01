"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const THANKS_TEXT = "Vielen Dank für deine Bestellung!"

/**
 * Canvas-Animation: ein «Druckkopf» schreibt den Dankestext Buchstabe für Buchstabe.
 */
export function OrderThanksAnimation({
  className,
  active = true,
}: {
  className?: string
  active?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let charIndex = 0
    let lastTs = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = canvas.clientWidth || 320
    const cssH = 88
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const draw = (ts: number) => {
      if (!lastTs) lastTs = ts
      if (ts - lastTs > 55 && charIndex < THANKS_TEXT.length) {
        charIndex += 1
        lastTs = ts
      }

      ctx.clearRect(0, 0, cssW, cssH)
      // Paper / bed
      const grad = ctx.createLinearGradient(0, 0, cssW, cssH)
      grad.addColorStop(0, "rgba(249,115,22,0.08)")
      grad.addColorStop(1, "rgba(6,182,212,0.08)")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, cssW, cssH)

      ctx.font =
        "600 15px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
      ctx.textBaseline = "middle"
      const visible = THANKS_TEXT.slice(0, charIndex)
      const metrics = ctx.measureText(visible)
      const textX = 16
      const textY = cssH / 2

      ctx.fillStyle = "rgba(24,24,27,0.92)"
      ctx.fillText(visible, textX, textY)

      // Print head / laser
      const headX = textX + metrics.width + 4
      const headY = textY
      ctx.save()
      ctx.translate(headX, headY - 18)
      ctx.fillStyle = "#f97316"
      ctx.fillRect(-10, 0, 20, 10)
      ctx.fillStyle = "#06b6d4"
      ctx.beginPath()
      ctx.moveTo(0, 10)
      ctx.lineTo(-4, 22)
      ctx.lineTo(4, 22)
      ctx.closePath()
      ctx.fill()
      // beam
      ctx.strokeStyle = "rgba(249,115,22,0.55)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, 22)
      ctx.lineTo(0, 34)
      ctx.stroke()
      ctx.restore()

      if (charIndex < THANKS_TEXT.length) {
        raf = requestAnimationFrame(draw)
      } else {
        setDone(true)
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-border/50", className)}>
      <canvas
        ref={canvasRef}
        className="h-[88px] w-full dark:invert-[0.04]"
        aria-label={THANKS_TEXT}
      />
      <p className="sr-only">{done ? THANKS_TEXT : "Danke-Animation läuft"}</p>
    </div>
  )
}

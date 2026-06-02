"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function ProcessStepItem({ step, index }: { step: { number: number; title: string; description: string }, index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.4, rootMargin: "0px 0px -80px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "reveal relative flex flex-col items-center gap-8 md:flex-row",
        index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse",
        visible && "visible"
      )}
    >
      <div className={cn("flex-1", index % 2 === 0 ? "md:text-right" : "md:text-left")}>
        <Card className="inline-block border-border/50 bg-card/50 transition-colors hover:border-primary/40">
          <CardContent className="p-6">
            <h3 className="mb-2 font-bold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </CardContent>
        </Card>
      </div>
      <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30">
        {step.number}
      </div>
      <div className="hidden flex-1 md:block" />
    </div>
  )
}

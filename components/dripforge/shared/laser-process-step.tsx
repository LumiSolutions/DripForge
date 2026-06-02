"use client"

import { useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function LaserProcessStep({ 
  item, 
  index 
}: { 
  item: { icon: LucideIcon; step: string; title: string; desc: string; color: string; bg: string; border: string }
  index: number 
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.3, rootMargin: "0px 0px -60px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const Icon = item.icon

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 150}ms` }}
      className={cn("reveal flex flex-col items-center text-center", visible && "visible")}
    >
      {/* Circle with icon */}
      <div className={cn("relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-background transition-transform duration-500", item.border, visible && "scale-100", !visible && "scale-75")}>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", item.bg)}>
          <Icon className={cn("h-6 w-6", item.color)} />
        </div>
        <span className={cn("absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-background", item.bg.replace("/20", ""))}>
          {item.step}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
    </div>
  )
}
"use client"

import { useLayoutEffect, useRef, useState } from "react"

/**
 * Misst, wie viele Navigations-Items in die verfügbare Breite passen.
 * Überschüssige Items gehören in ein «Mehr»-Dropdown.
 */
export function useNavOverflow(itemCount: number, moreButtonWidth = 96) {
  const containerRef = useRef<HTMLElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(itemCount)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure || itemCount <= 0) {
      setVisibleCount(itemCount)
      return
    }

    const compute = () => {
      const available = container.clientWidth
      const children = Array.from(measure.children) as HTMLElement[]
      if (children.length === 0) {
        setVisibleCount(itemCount)
        return
      }

      const widths = children.map((child) => child.getBoundingClientRect().width)
      const gap = 2
      let used = 0
      let count = itemCount

      for (let i = 0; i < widths.length; i += 1) {
        const next = used + widths[i] + (i > 0 ? gap : 0)
        const remaining = widths.length - (i + 1)
        const needMore = remaining > 0
        const withMore = next + (needMore ? gap + moreButtonWidth : 0)
        if (withMore > available + 0.5) {
          count = Math.max(1, i)
          // Falls selbst 1 Item + Mehr nicht passt, zeige 1 Item und Mehr.
          if (count === 0) count = 1
          break
        }
        used = next
        count = i + 1
      }

      setVisibleCount(Math.min(itemCount, count))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(container)
    window.addEventListener("resize", compute)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", compute)
    }
  }, [itemCount, moreButtonWidth])

  return { containerRef, measureRef, visibleCount }
}

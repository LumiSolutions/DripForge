"use client"

import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function IndividualProcessBar({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < activeStep
        const active = i === activeStep
        return (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-500",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs transition-colors duration-300 sm:block",
                  done || active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mb-5 h-px flex-1 transition-all duration-700",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
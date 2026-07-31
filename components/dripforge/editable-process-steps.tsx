"use client"

import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Layers,
  Package,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Upload,
  Zap,
  Circle,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProcessStepItem } from "@/components/dripforge/shared/process-step-item"
import { LaserProcessStep } from "@/components/dripforge/shared/laser-process-step"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  createEmptyProcessStep,
  type CmsProcessStep,
} from "@/lib/admin/cms-page-content"
import { cn } from "@/lib/utils"

const ICON_OPTIONS: Array<{ id: string; Icon: LucideIcon }> = [
  { id: "Upload", Icon: Upload },
  { id: "Layers", Icon: Layers },
  { id: "Printer", Icon: Printer },
  { id: "Sparkles", Icon: Sparkles },
  { id: "Package", Icon: Package },
  { id: "Image", Icon: ImageIcon },
  { id: "Zap", Icon: Zap },
  { id: "Circle", Icon: Circle },
]

function resolveIcon(name: string): LucideIcon {
  return ICON_OPTIONS.find((o) => o.id === name)?.Icon ?? Circle
}

const ICON_STYLE = {
  color: "text-cyan-400",
  bg: "bg-cyan-500/20",
  border: "border-cyan-500/30",
} as const

type Variant = "3d" | "laser"

export function EditableProcessSteps({ variant }: { variant: Variant }) {
  const {
    canInlineEdit,
    processSteps3d,
    processStepsLaser,
    saveProcessSteps3d,
    saveProcessStepsLaser,
  } = useSiteTexts()
  const steps = variant === "3d" ? processSteps3d : processStepsLaser
  const save = variant === "3d" ? saveProcessSteps3d : saveProcessStepsLaser
  const [saving, setSaving] = useState(false)

  const persist = async (next: CmsProcessStep[]) => {
    setSaving(true)
    try {
      await save(next)
    } finally {
      setSaving(false)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    const tmp = next[index]!
    next[index] = next[target]!
    next[target] = tmp
    await persist(next.map((item, i) => ({ ...item, sortOrder: i })))
  }

  const update = async (id: string, patch: Partial<CmsProcessStep>) => {
    await persist(
      steps.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const add = async () => {
    await persist([...steps, createEmptyProcessStep(steps.length)])
  }

  const remove = async (id: string) => {
    if (steps.length <= 1) {
      window.alert("Mindestens ein Schritt muss bleiben.")
      return
    }
    if (!window.confirm("Schritt löschen?")) return
    await persist(
      steps
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index }))
    )
  }

  const laserItems = useMemo(
    () =>
      steps.map((step, index) => ({
        icon: resolveIcon(step.icon),
        step: String(index + 1).padStart(2, "0"),
        title: step.title,
        desc: step.description,
        ...ICON_STYLE,
      })),
    [steps]
  )

  return (
    <div className="space-y-6">
      {canInlineEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Ablauf-Schritte bearbeiten, neu anordnen, hinzufügen oder entfernen.
          </p>
          <Button type="button" size="sm" disabled={saving} onClick={() => void add()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Schritt hinzufügen
          </Button>
        </div>
      )}

      {canInlineEdit ? (
        <ul className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="rounded-xl border border-border/60 bg-card/60 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  #{index + 1}
                </span>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Icon
                  </Label>
                  <Select
                    value={step.icon}
                    onValueChange={(value) => void update(step.id, { icon: value })}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(({ id, Icon }) => (
                        <SelectItem key={id} value={id}>
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {id}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={index === 0 || saving}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={index === steps.length - 1 || saving}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-600"
                    disabled={saving}
                    onClick={() => void remove(step.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                value={step.title}
                onChange={(e) => void update(step.id, { title: e.target.value })}
                className="mb-2 font-semibold"
                placeholder="Titel"
              />
              <Textarea
                value={step.description}
                onChange={(e) =>
                  void update(step.id, { description: e.target.value })
                }
                rows={3}
                placeholder="Beschreibung"
              />
            </li>
          ))}
        </ul>
      ) : variant === "3d" ? (
        <div className="relative">
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block" />
          <div className="space-y-12">
            {steps.map((step, i) => (
              <ProcessStepItem
                key={step.id}
                step={{
                  number: i + 1,
                  title: step.title,
                  description: step.description,
                }}
                index={i}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-0 right-0 top-10 hidden h-px bg-border md:block" />
          <div
            className={cn(
              "grid gap-8",
              steps.length <= 2
                ? "md:grid-cols-2"
                : steps.length === 3
                  ? "md:grid-cols-3"
                  : "md:grid-cols-4"
            )}
          >
            {laserItems.map((item, index) => (
              <LaserProcessStep key={steps[index]?.id ?? index} item={item} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

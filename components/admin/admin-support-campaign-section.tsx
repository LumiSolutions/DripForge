"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  createSupportFeatureItem,
  createSupportMilestoneConfig,
  type SupportFeatureItem,
  type SupportMilestoneConfig,
  type SupportMilestoneStatus,
} from "@/lib/dripforge/support-page-settings"

const STATUS_OPTIONS: { value: SupportMilestoneStatus; label: string }[] = [
  { value: "geplant", label: "Geplant" },
  { value: "in_arbeit", label: "In Arbeit" },
  { value: "erreicht", label: "Erreicht" },
  { value: "archiviert", label: "Archiviert" },
]

const EDITABLE_STATUSES: SupportMilestoneStatus[] = [
  "geplant",
  "in_arbeit",
  "erreicht",
]

function statusLabel(status: SupportMilestoneStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

function statusBadgeClass(status: SupportMilestoneStatus): string {
  switch (status) {
    case "erreicht":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
    case "in_arbeit":
      return "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300"
    case "archiviert":
      return adminUi.badgeInactive
    default:
      return adminUi.badgeOutline
  }
}

type MilestoneDraft = {
  id: string | null
  title: string
  description: string
  goalChf: string
  status: SupportMilestoneStatus
}

type FeatureDraft = {
  id: string | null
  title: string
  description: string
}

export function AdminSupportCampaignSection({
  milestones,
  features,
  onMilestonesChange,
  onFeaturesChange,
}: {
  milestones: SupportMilestoneConfig[]
  features: SupportFeatureItem[]
  onMilestonesChange: (next: SupportMilestoneConfig[]) => void
  onFeaturesChange: (next: SupportFeatureItem[]) => void
}) {
  const [showArchivedMilestones, setShowArchivedMilestones] = useState(false)
  const [showArchivedFeatures, setShowArchivedFeatures] = useState(false)
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft | null>(
    null
  )
  const [featureDraft, setFeatureDraft] = useState<FeatureDraft | null>(null)

  const sortedMilestones = useMemo(
    () =>
      [...milestones].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
      ),
    [milestones]
  )

  const visibleMilestones = useMemo(
    () =>
      showArchivedMilestones
        ? sortedMilestones
        : sortedMilestones.filter((m) => m.status !== "archiviert"),
    [showArchivedMilestones, sortedMilestones]
  )

  const sortedFeatures = useMemo(
    () =>
      [...features].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
      ),
    [features]
  )

  const visibleFeatures = useMemo(
    () =>
      showArchivedFeatures
        ? sortedFeatures
        : sortedFeatures.filter((f) => !f.archived),
    [showArchivedFeatures, sortedFeatures]
  )

  const openNewMilestone = () => {
    setMilestoneDraft({
      id: null,
      title: "",
      description: "",
      goalChf: "500",
      status: "geplant",
    })
  }

  const openEditMilestone = (item: SupportMilestoneConfig) => {
    setMilestoneDraft({
      id: item.id,
      title: item.title,
      description: item.description,
      goalChf: String(item.goalChf),
      status: item.status === "archiviert" ? "geplant" : item.status,
    })
  }

  const saveMilestoneDraft = () => {
    if (!milestoneDraft) return
    const title = milestoneDraft.title.trim() || "Meilenstein"
    const description = milestoneDraft.description.trim()
    const goalChf = Number(milestoneDraft.goalChf.replace(",", "."))
    const status =
      milestoneDraft.status === "archiviert"
        ? "geplant"
        : EDITABLE_STATUSES.includes(milestoneDraft.status)
          ? milestoneDraft.status
          : "geplant"

    if (milestoneDraft.id) {
      onMilestonesChange(
        milestones.map((m) =>
          m.id === milestoneDraft.id
            ? {
                ...m,
                title,
                description,
                goalChf: Number.isFinite(goalChf) && goalChf > 0 ? goalChf : m.goalChf,
                status: m.status === "archiviert" ? m.status : status,
              }
            : m
        )
      )
    } else {
      const nextOrder =
        milestones.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1
      onMilestonesChange([
        ...milestones,
        createSupportMilestoneConfig({
          title,
          description,
          goalChf: Number.isFinite(goalChf) && goalChf > 0 ? goalChf : 500,
          status,
          sortOrder: nextOrder,
        }),
      ])
    }
    setMilestoneDraft(null)
  }

  const setMilestoneStatus = (
    id: string,
    status: SupportMilestoneStatus
  ) => {
    onMilestonesChange(
      milestones.map((m) => (m.id === id ? { ...m, status } : m))
    )
  }

  const archiveMilestone = (id: string) => {
    setMilestoneStatus(id, "archiviert")
  }

  const restoreMilestone = (id: string) => {
    setMilestoneStatus(id, "geplant")
  }

  const openNewFeature = () => {
    setFeatureDraft({ id: null, title: "", description: "" })
  }

  const openEditFeature = (item: SupportFeatureItem) => {
    setFeatureDraft({
      id: item.id,
      title: item.title,
      description: item.description,
    })
  }

  const saveFeatureDraft = () => {
    if (!featureDraft) return
    const title = featureDraft.title.trim() || "Feature"
    const description = featureDraft.description.trim()

    if (featureDraft.id) {
      onFeaturesChange(
        features.map((f) =>
          f.id === featureDraft.id ? { ...f, title, description } : f
        )
      )
    } else {
      const nextOrder =
        features.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1
      onFeaturesChange([
        ...features,
        createSupportFeatureItem({
          title,
          description,
          sortOrder: nextOrder,
        }),
      ])
    }
    setFeatureDraft(null)
  }

  const moveFeature = (id: string, direction: -1 | 1) => {
    const ordered = [...sortedFeatures]
    const index = ordered.findIndex((f) => f.id === id)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return
    const a = ordered[index]
    const b = ordered[swapIndex]
    ordered[index] = b
    ordered[swapIndex] = a
    onFeaturesChange(
      ordered.map((item, sortOrder) => ({ ...item, sortOrder }))
    )
  }

  const setFeatureArchived = (id: string, archived: boolean) => {
    onFeaturesChange(
      features.map((f) => (f.id === id ? { ...f, archived } : f))
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Meilensteine / Ziele
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Titel, Beschreibung, Zielbetrag und Status für die öffentliche
              Support-Seite.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={showArchivedMilestones}
                onCheckedChange={setShowArchivedMilestones}
              />
              <span className={adminUi.muted}>Archivierte anzeigen</span>
            </label>
            <Button
              type="button"
              size="sm"
              className={cn("h-8", adminUi.primaryBtn)}
              onClick={openNewMilestone}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Meilenstein
            </Button>
          </div>
        </div>

        {visibleMilestones.length === 0 ? (
          <p className={cn("rounded-xl border border-dashed px-4 py-6 text-sm", adminUi.empty)}>
            Keine Meilensteine. Füge einen neuen hinzu oder zeige Archivierte.
          </p>
        ) : (
          <div className="grid gap-3">
            {visibleMilestones.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                  adminUi.listItem,
                  item.status === "archiviert" && "opacity-70"
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("font-medium", adminUi.heading)}>
                      {item.title}
                    </p>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(item.status)}
                    >
                      {statusLabel(item.status)}
                    </Badge>
                    <span className={cn("text-xs", adminUi.muted)}>
                      CHF {item.goalChf.toLocaleString("de-CH")}
                    </span>
                  </div>
                  {item.description ? (
                    <p className={cn("text-sm", adminUi.muted)}>
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.status !== "archiviert" ? (
                    <Select
                      value={item.status}
                      onValueChange={(value) =>
                        setMilestoneStatus(
                          item.id,
                          value as SupportMilestoneStatus
                        )
                      }
                    >
                      <SelectTrigger
                        className={cn("h-8 w-[130px] text-xs", adminUi.select)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDITABLE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("h-8", adminUi.outlineBtn)}
                    onClick={() => openEditMilestone(item)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Bearbeiten
                  </Button>
                  {item.status === "archiviert" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-8", adminUi.outlineBtn)}
                      onClick={() => restoreMilestone(item.id)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Wiederherstellen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-8", adminUi.outlineBtn)}
                      onClick={() => archiveMilestone(item.id)}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Archivieren
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Unterstützte Produkte / Features
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Liste der Features und Produkte, die dank Support entstanden oder
              ausgebaut wurden.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={showArchivedFeatures}
                onCheckedChange={setShowArchivedFeatures}
              />
              <span className={adminUi.muted}>Archivierte anzeigen</span>
            </label>
            <Button
              type="button"
              size="sm"
              className={cn("h-8", adminUi.primaryBtn)}
              onClick={openNewFeature}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Feature
            </Button>
          </div>
        </div>

        {visibleFeatures.length === 0 ? (
          <p className={cn("rounded-xl border border-dashed px-4 py-6 text-sm", adminUi.empty)}>
            Noch keine Features. Füge Einträge hinzu, die auf der Support-Seite
            erscheinen sollen.
          </p>
        ) : (
          <div className="grid gap-3">
            {visibleFeatures.map((item) => {
              const orderedIndex = sortedFeatures.findIndex(
                (f) => f.id === item.id
              )
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                    adminUi.listItem,
                    item.archived && "opacity-70"
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-medium", adminUi.heading)}>
                        {item.title}
                      </p>
                      {item.archived ? (
                        <Badge
                          variant="outline"
                          className={adminUi.badgeInactive}
                        >
                          Archiviert
                        </Badge>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className={cn("text-sm", adminUi.muted)}>
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!item.archived ? (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={cn("h-8 w-8", adminUi.outlineBtn)}
                          disabled={orderedIndex <= 0}
                          onClick={() => moveFeature(item.id, -1)}
                          aria-label="Nach oben"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={cn("h-8 w-8", adminUi.outlineBtn)}
                          disabled={orderedIndex >= sortedFeatures.length - 1}
                          onClick={() => moveFeature(item.id, 1)}
                          aria-label="Nach unten"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-8", adminUi.outlineBtn)}
                      onClick={() => openEditFeature(item)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Bearbeiten
                    </Button>
                    {item.archived ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("h-8", adminUi.outlineBtn)}
                        onClick={() => setFeatureArchived(item.id, false)}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Wiederherstellen
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("h-8", adminUi.outlineBtn)}
                        onClick={() => setFeatureArchived(item.id, true)}
                      >
                        <Archive className="mr-1 h-3.5 w-3.5" />
                        Archivieren
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(milestoneDraft)}
        onOpenChange={(open) => !open && setMilestoneDraft(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {milestoneDraft?.id ? "Meilenstein bearbeiten" : "Meilenstein hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          {milestoneDraft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="milestone-title">Titel</Label>
                <Input
                  id="milestone-title"
                  className={adminUi.input}
                  value={milestoneDraft.title}
                  onChange={(e) =>
                    setMilestoneDraft({
                      ...milestoneDraft,
                      title: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestone-description">Beschreibung</Label>
                <Textarea
                  id="milestone-description"
                  className={adminUi.input}
                  rows={3}
                  value={milestoneDraft.description}
                  onChange={(e) =>
                    setMilestoneDraft({
                      ...milestoneDraft,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="milestone-goal">Ziel (CHF)</Label>
                  <Input
                    id="milestone-goal"
                    type="number"
                    min={1}
                    step={1}
                    className={adminUi.input}
                    value={milestoneDraft.goalChf}
                    onChange={(e) =>
                      setMilestoneDraft({
                        ...milestoneDraft,
                        goalChf: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={milestoneDraft.status}
                    onValueChange={(value) =>
                      setMilestoneDraft({
                        ...milestoneDraft,
                        status: value as SupportMilestoneStatus,
                      })
                    }
                  >
                    <SelectTrigger className={adminUi.select}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITABLE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={() => setMilestoneDraft(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={adminUi.primaryBtn}
              onClick={saveMilestoneDraft}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(featureDraft)}
        onOpenChange={(open) => !open && setFeatureDraft(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {featureDraft?.id ? "Feature bearbeiten" : "Feature hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          {featureDraft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="feature-title">Titel</Label>
                <Input
                  id="feature-title"
                  className={adminUi.input}
                  value={featureDraft.title}
                  onChange={(e) =>
                    setFeatureDraft({
                      ...featureDraft,
                      title: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feature-description">Beschreibung</Label>
                <Textarea
                  id="feature-description"
                  className={adminUi.input}
                  rows={3}
                  value={featureDraft.description}
                  onChange={(e) =>
                    setFeatureDraft({
                      ...featureDraft,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={() => setFeatureDraft(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={adminUi.primaryBtn}
              onClick={saveFeatureDraft}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

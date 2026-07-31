"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CMS_NAV_ICON_OPTIONS,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminCmsPagesNavPanelProps = {
  pages: CmsPageEntry[]
  navItems: CmsNavItem[]
  onPagesChange: (pages: CmsPageEntry[]) => void
  onNavItemsChange: (items: CmsNavItem[]) => void
  disabled?: boolean
}

function reorder<T extends { sortOrder: number }>(
  list: T[],
  index: number,
  direction: -1 | 1
): T[] {
  const target = index + direction
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const tmp = next[index]
  next[index] = next[target]
  next[target] = tmp
  return next.map((item, i) => ({ ...item, sortOrder: i }))
}

export function AdminCmsPagesNavPanel({
  pages,
  navItems,
  onPagesChange,
  onNavItemsChange,
  disabled,
}: AdminCmsPagesNavPanelProps) {
  const addPage = () => {
    const id = `custom-${Date.now()}`
    onPagesChange([
      ...pages,
      {
        id,
        title: "Neue Seite",
        path: `/${id}`,
        enabled: true,
        sortOrder: pages.length,
        system: false,
      },
    ])
  }

  const addNav = () => {
    const id = `nav-${Date.now()}`
    onNavItemsChange([
      ...navItems,
      {
        id,
        label: "Neuer Link",
        href: "/",
        enabled: true,
        sortOrder: navItems.length,
        icon: "Home",
      },
    ])
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className={cn("text-sm font-semibold", adminUi.heading)}>Seiten</h3>
            <p className={cn("text-xs", adminUi.muted)}>
              Sichtbare Seiten für den In-Context-Editor und die Staging-Navigation.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addPage} disabled={disabled}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Seite
          </Button>
        </div>

        <ul className="space-y-2">
          {pages.map((page, index) => (
            <li
              key={page.id}
              className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Titel</Label>
                <Input
                  value={page.title}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...pages]
                    next[index] = { ...page, title: e.target.value }
                    onPagesChange(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pfad</Label>
                <Input
                  value={page.path}
                  disabled={disabled || page.system}
                  onChange={(e) => {
                    const next = [...pages]
                    next[index] = { ...page, path: e.target.value }
                    onPagesChange(next)
                  }}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={page.enabled}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...pages]
                    next[index] = { ...page, enabled: e.target.checked }
                    onPagesChange(next)
                  }}
                />
                Aktiv
              </label>
              <div className="flex items-end gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  onClick={() => onPagesChange(reorder(pages, index, -1))}
                  aria-label="Nach oben"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === pages.length - 1}
                  onClick={() => onPagesChange(reorder(pages, index, 1))}
                  aria-label="Nach unten"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || page.system}
                  onClick={() =>
                    onPagesChange(
                      pages
                        .filter((p) => p.id !== page.id)
                        .map((p, i) => ({ ...p, sortOrder: i }))
                    )
                  }
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className={cn("text-sm font-semibold", adminUi.heading)}>
              Hauptnavigation
            </h3>
            <p className={cn("text-xs", adminUi.muted)}>
              Labels, Reihenfolge und Icons der Shop-Header-Navigation.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addNav} disabled={disabled}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nav-Eintrag
          </Button>
        </div>

        <ul className="space-y-2">
          {navItems.map((item, index) => (
            <li
              key={item.id}
              className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={item.label}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...navItems]
                    next[index] = { ...item, label: e.target.value }
                    onNavItemsChange(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={item.href}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...navItems]
                    next[index] = { ...item, href: e.target.value }
                    onNavItemsChange(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Icon</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={item.icon ?? "Home"}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...navItems]
                    next[index] = { ...item, icon: e.target.value }
                    onNavItemsChange(next)
                  }}
                >
                  {CMS_NAV_ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-end gap-2 pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...navItems]
                    next[index] = { ...item, enabled: e.target.checked }
                    onNavItemsChange(next)
                  }}
                />
                Aktiv
              </label>
              <div className="flex items-end gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  onClick={() => onNavItemsChange(reorder(navItems, index, -1))}
                  aria-label="Nach oben"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === navItems.length - 1}
                  onClick={() => onNavItemsChange(reorder(navItems, index, 1))}
                  aria-label="Nach unten"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    onNavItemsChange(
                      navItems
                        .filter((n) => n.id !== item.id)
                        .map((n, i) => ({ ...n, sortOrder: i }))
                    )
                  }
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

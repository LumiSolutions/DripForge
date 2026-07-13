"use client"

import { useMemo, useState } from "react"
import { Loader2, MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account, AccountKind } from "@/lib/accounting/account-types"
import { buildChartTreeItems, groupAccountsForSelect } from "@/lib/accounting/chart-tree"
import { resolveTaxRateFromCode } from "@/lib/accounting/tax-code-utils"
import type { TaxCode } from "@/lib/accounting/tax-code-types"
import { TaxCodeSelectField } from "@/components/admin/tax-code-select-field"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

const BOOKABLE_KINDS: AccountKind[] = ["Aktiv", "Passiv", "Aufwand", "Ertrag", "Komplett"]

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; account: Account }
  | null

type AdminAccountingChartPanelProps = {
  accounts: Account[]
  taxCodes: TaxCode[]
  loading: boolean
  saving: boolean
  error: string | null
  onRefresh: () => void
  onSave: (payload: {
    number: string
    name: string
    group: string | null
    type: AccountKind
    vatBookable: boolean
    defaultVatRate: number
    defaultTaxCode: string | null
    originalNumber?: string
  }) => Promise<void>
  onDelete: (number: string) => Promise<void>
  onCopy: (account: Account) => void
  onDeactivate: (account: Account) => Promise<void>
}

const LEVEL_PADDING: Record<1 | 2 | 3 | 4, string> = {
  1: "pl-0",
  2: "pl-4",
  3: "pl-8",
  4: "pl-12",
}

const LEVEL_WEIGHT: Record<1 | 2 | 3 | 4, string> = {
  1: "font-bold",
  2: "font-semibold",
  3: "font-medium",
  4: "font-normal",
}

export function AdminAccountingChartPanel({
  accounts,
  taxCodes,
  loading,
  saving,
  error,
  onRefresh,
  onSave,
  onDelete,
  onCopy,
  onDeactivate,
}: AdminAccountingChartPanelProps) {
  const [editor, setEditor] = useState<EditorState>(null)
  const [number, setNumber] = useState("")
  const [name, setName] = useState("")
  const [group, setGroup] = useState("")
  const [type, setType] = useState<AccountKind>("Aktiv")
  const [vatBookable, setVatBookable] = useState(false)
  const [defaultTaxCode, setDefaultTaxCode] = useState("")

  const treeItems = useMemo(() => buildChartTreeItems(accounts), [accounts])
  const groupOptions = useMemo(() => groupAccountsForSelect(accounts), [accounts])

  const openCreate = () => {
    setEditor({ mode: "create" })
    setNumber("")
    setName("")
    setGroup("")
    setType("Aktiv")
    setVatBookable(false)
    setDefaultTaxCode("UN81")
  }

  const openEdit = (account: Account) => {
    setEditor({ mode: "edit", account })
    setNumber(account.number)
    setName(account.name)
    setGroup(account.group ?? "")
    setType(account.type === "Gruppe" ? "Gruppe" : account.type)
    setVatBookable(account.vatBookable ?? false)
    setDefaultTaxCode(account.defaultTaxCode ?? "UN81")
  }

  const closeEditor = () => setEditor(null)

  const handleSave = async () => {
    await onSave({
      number: number.trim(),
      name: name.trim(),
      group: group.trim() || null,
      type,
      vatBookable,
      defaultVatRate: resolveTaxRateFromCode(defaultTaxCode, taxCodes),
      defaultTaxCode: defaultTaxCode.trim() || null,
      originalNumber: editor?.mode === "edit" ? editor.account.number : undefined,
    })
    closeEditor()
  }

  return (
    <section className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-lg font-semibold", adminUi.heading)}>Kontenplan</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Hierarchische KMU-Struktur ({accounts.length} Konten)
          </p>
        </div>
        <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Konto hinzufügen
        </Button>
      </div>

      {editor && (
        <div className={cn("space-y-4 rounded-xl border p-4", adminUi.cardMuted)}>
          <h3 className={cn("text-base font-semibold", adminUi.heading)}>
            {editor.mode === "create" ? "Neues Konto" : "Konto bearbeiten"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kontonummer *</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className={adminUi.input}
                disabled={editor.mode === "edit"}
              />
            </div>
            <div className="space-y-2">
              <Label>Kontoname *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={adminUi.input} />
            </div>
            <div className="space-y-2">
              <Label>Zugewiesene Kontengruppe</Label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
              >
                <option value="">— Keine —</option>
                {groupOptions.map((option) => (
                  <option key={option.number} value={option.number}>
                    {option.number} {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Kontoart</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountKind)}
                className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
              >
                {[...BOOKABLE_KINDS, "Gruppe" as AccountKind].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vatBookable}
                onChange={(e) => setVatBookable(e.target.checked)}
              />
              MWST kann gebucht werden
            </label>
            <div className="space-y-2">
              <Label>Standard MWST-Code</Label>
              <TaxCodeSelectField
                value={defaultTaxCode}
                taxCodes={taxCodes}
                onChange={setDefaultTaxCode}
                placeholder="— Kein Standardcode —"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Speichern
            </Button>
            <Button type="button" variant="outline" className={adminUi.outlineBtn} onClick={closeEditor}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {error && <p className={adminUi.error}>{error}</p>}

      {loading ? (
        <p className={cn("flex items-center text-sm", adminUi.muted)}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Kontenplan wird geladen…
        </p>
      ) : (
        <div className="max-h-[68vh] overflow-y-auto rounded-lg border">
          {treeItems.map(({ account, level }) => {
            const isGroup = account.type === "Gruppe"
            return (
              <div
                key={account.number}
                className={cn(
                  "flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0",
                  account.isActive === false && "opacity-50",
                  adminUi.tableRow
                )}
              >
                <div className={cn(LEVEL_PADDING[level], LEVEL_WEIGHT[level], "min-w-0 flex-1")}>
                  <span className="font-mono text-xs text-zinc-500">{account.number}</span>{" "}
                  <span>{account.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className={adminUi.footerBtn}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isGroup ? (
                      <>
                        <DropdownMenuItem onClick={() => openEdit(account)}>
                          Gruppe bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => void onDelete(account.number)}
                        >
                          Gruppe löschen
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => openEdit(account)}>
                          Konto bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopy(account)}>
                          Konto kopieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void onDeactivate(account)}>
                          Konto deaktivieren
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => void onDelete(account.number)}
                        >
                          Konto löschen
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" className={adminUi.outlineBtn} onClick={onRefresh}>
          Aktualisieren
        </Button>
      </div>
    </section>
  )
}

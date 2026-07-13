"use client"

import { useEffect, useMemo, useState } from "react"
import type { Account } from "@/lib/accounting/account-types"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"

type AccountPickerFieldProps = {
  value: string
  onChange: (accountNumber: string) => void
  accounts: Account[]
  placeholder?: string
  disabled?: boolean
}

export function AccountPickerField({
  value,
  onChange,
  accounts,
  placeholder = "Kontonummer oder Name suchen…",
  disabled = false,
}: AccountPickerFieldProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const selected = useMemo(
    () => accounts.find((account) => account.number === value) ?? null,
    [accounts, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts.slice(0, 12)
    return accounts
      .filter(
        (account) =>
          account.number.toLowerCase().includes(q) ||
          account.name.toLowerCase().includes(q)
      )
      .slice(0, 12)
  }, [accounts, query])

  return (
    <div className="relative">
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150)
        }}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          const exact = accounts.find(
            (account) =>
              account.number === next.trim() ||
              `${account.number} ${account.name}`.toLowerCase() ===
                next.trim().toLowerCase()
          )
          if (exact) onChange(exact.number)
        }}
        className={adminUi.input}
      />
      {selected && (
        <p className={cn("mt-1 text-xs", adminUi.muted)}>{selected.name}</p>
      )}
      {open && filtered.length > 0 && (
        <ul
          className={cn(
            "absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg",
            adminUi.card
          )}
        >
          {filtered.map((account) => (
            <li key={account.number}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left text-sm transition-colors hover:bg-orange-500/10",
                  value === account.number && adminUi.listItemActive
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(account.number)
                  setQuery(account.number)
                  setOpen(false)
                }}
              >
                <span className="font-mono text-xs">{account.number}</span>
                <span className={adminUi.bodyText}>{account.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

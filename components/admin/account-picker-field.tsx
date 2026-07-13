"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import type { Account } from "@/lib/accounting/account-types"
import { normalizeAccountNumber } from "@/lib/accounting/account-types"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"

type AccountPickerFieldProps = {
  value: string
  onChange: (accountNumber: string) => void
  accounts: Account[]
  placeholder?: string
  disabled?: boolean
  /** Nur buchbare Konten (keine Gruppen). */
  bookableOnly?: boolean
  className?: string
}

function resolveAccountFromQuery(
  query: string,
  selectableAccounts: Account[]
): Account | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  const normalized = normalizeAccountNumber(trimmed)
  const exactNumber = selectableAccounts.find(
    (account) => normalizeAccountNumber(account.number) === normalized
  )
  if (exactNumber) return exactNumber

  const lower = trimmed.toLowerCase()
  const exactLabel = selectableAccounts.find(
    (account) =>
      `${account.number} ${account.name}`.toLowerCase() === lower ||
      account.name.toLowerCase() === lower
  )
  if (exactLabel) return exactLabel

  const prefixMatch = selectableAccounts.find((account) =>
    account.number.startsWith(normalized)
  )
  if (prefixMatch && normalized.length >= 3) return prefixMatch

  return null
}

export function AccountPickerField({
  value,
  onChange,
  accounts,
  placeholder = "Kontonummer oder Name suchen…",
  disabled = false,
  bookableOnly = false,
  className,
}: AccountPickerFieldProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectableAccounts = useMemo(
    () =>
      bookableOnly
        ? accounts.filter(
            (account) => account.type !== "Gruppe" && account.isActive !== false
          )
        : accounts.filter((account) => account.isActive !== false),
    [accounts, bookableOnly]
  )

  const normalizedValue = normalizeAccountNumber(value)

  useEffect(() => {
    if (!normalizedValue) {
      setQuery("")
      return
    }
    const selected = selectableAccounts.find(
      (account) => normalizeAccountNumber(account.number) === normalizedValue
    )
    setQuery(selected ? normalizeAccountNumber(selected.number) : normalizedValue)
  }, [normalizedValue, selectableAccounts])

  const selected = useMemo(
    () =>
      selectableAccounts.find(
        (account) => normalizeAccountNumber(account.number) === normalizedValue
      ) ?? null,
    [selectableAccounts, normalizedValue]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return selectableAccounts.slice(0, 16)
    return selectableAccounts
      .filter(
        (account) =>
          account.number.toLowerCase().includes(q) ||
          account.name.toLowerCase().includes(q)
      )
      .slice(0, 16)
  }, [selectableAccounts, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, filtered.length])

  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-account-index="${highlightIndex}"]`
    )
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, open])

  const commitAccount = (account: Account) => {
    const number = normalizeAccountNumber(account.number)
    onChange(number)
    setQuery(number)
    setOpen(false)
    setHighlightIndex(0)
  }

  const updateDropdownPosition = () => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updateDropdownPosition()
    const onReposition = () => updateDropdownPosition()
    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [open, query, filtered.length])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        updateDropdownPosition()
        return
      }
      if (filtered.length === 0) return
      setHighlightIndex((current) =>
        current < filtered.length - 1 ? current + 1 : 0
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        updateDropdownPosition()
        return
      }
      if (filtered.length === 0) return
      setHighlightIndex((current) =>
        current > 0 ? current - 1 : filtered.length - 1
      )
      return
    }

    if (event.key === "Enter") {
      if (!open || filtered.length === 0) return
      event.preventDefault()
      const account = filtered[highlightIndex] ?? filtered[0]
      if (account) commitAccount(account)
      return
    }

    if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const dropdown =
    open && filtered.length > 0 && dropdownStyle
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            className={cn(
              "fixed z-[100] max-h-64 overflow-y-auto rounded-lg border shadow-xl",
              adminUi.card
            )}
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
            }}
          >
            {filtered.map((account, index) => {
              const number = normalizeAccountNumber(account.number)
              const isHighlighted = index === highlightIndex
              return (
                <li key={number} role="option" aria-selected={isHighlighted}>
                  <button
                    type="button"
                    data-account-index={index}
                    className={cn(
                      "flex w-full flex-col px-3 py-2 text-left text-sm transition-colors",
                      isHighlighted
                        ? "bg-orange-500/15"
                        : "hover:bg-orange-500/10",
                      normalizedValue === number && adminUi.listItemActive
                    )}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      commitAccount(account)
                    }}
                  >
                    <span className="font-mono text-xs">{number}</span>
                    <span className={adminUi.bodyText}>{account.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Input
        ref={inputRef}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true)
          updateDropdownPosition()
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const resolved = resolveAccountFromQuery(query, selectableAccounts)
            if (resolved) {
              commitAccount(resolved)
            } else if (normalizedValue) {
              setQuery(normalizedValue)
            }
            setOpen(false)
          }, 120)
        }}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setOpen(true)
          const resolved = resolveAccountFromQuery(next, selectableAccounts)
          if (resolved && normalizeAccountNumber(resolved.number) === next.trim()) {
            onChange(normalizeAccountNumber(resolved.number))
          }
        }}
        className={adminUi.input}
      />
      {selected && (
        <p className={cn("mt-1 line-clamp-2 text-xs leading-snug", adminUi.muted)}>
          {selected.name}
        </p>
      )}
      {dropdown}
    </div>
  )
}

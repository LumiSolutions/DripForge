"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type { CustomerListItem } from "@/lib/admin/customers"
import type { BelegAddress } from "@/lib/documents/beleg-types"

type CustomerPickerProps = {
  onSelect: (customer: CustomerListItem) => void
  className?: string
}

export function customerListItemToBelegAddress(
  customer: CustomerListItem
): BelegAddress {
  return {
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    email: customer.email || "",
    street: customer.street || "",
    zip: customer.zip || "",
    city: customer.city || "",
    country: customer.country || "CH",
  }
}

export function BelegCustomerPicker({ onSelect, className }: CustomerPickerProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/customers", {
          credentials: "include",
          cache: "no-store",
        })
        const data = await res.json()
        if (!cancelled && Array.isArray(data.customers)) {
          setCustomers(
            data.customers.filter(
              (c: CustomerListItem) => c.status !== "gelöscht"
            )
          )
        }
      } catch {
        if (!cancelled) setCustomers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, 12)
    return customers
      .filter((c) => {
        const hay = [
          c.name,
          c.email,
          c.kundennummer,
          c.city,
          c.street,
          c.zip,
        ]
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 12)
  }, [customers, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open || !rootRef.current) {
      setDropdownStyle(null)
      return
    }
    const rect = rootRef.current.getBoundingClientRect()
    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const pick = (customer: CustomerListItem) => {
    onSelect(customer)
    setQuery(`${customer.name} · ${customer.email}`)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-2", className)}>
      <Label>Bestehenden Kunden wählen</Label>
      <Input
        ref={inputRef}
        value={query}
        placeholder={
          loading
            ? "Kunden werden geladen…"
            : "Name, E-Mail oder Kundennummer suchen…"
        }
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            const item = filtered[highlightIndex]
            if (item) pick(item)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        autoComplete="off"
      />
      {open && dropdownStyle && typeof document !== "undefined"
        ? createPortal(
            <ul
              className={cn(
                "z-[80] max-h-64 overflow-auto rounded-md border shadow-lg",
                adminUi.panel
              )}
              style={{
                position: "fixed",
                top: dropdownStyle.top,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
              }}
            >
              {filtered.length === 0 ? (
                <li className={cn("px-3 py-2 text-sm", adminUi.muted)}>
                  {loading ? "Laden…" : "Keine Kunden gefunden"}
                </li>
              ) : (
                filtered.map((customer, index) => (
                  <li key={customer.kundennummer}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60",
                        index === highlightIndex && "bg-muted/60"
                      )}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pick(customer)
                      }}
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className={cn("text-xs", adminUi.muted)}>
                        {customer.email}
                        {customer.city ? ` · ${customer.city}` : ""}
                        {` · ${customer.kundennummer}`}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body
          )
        : null}
      <p className={cn("text-xs", adminUi.muted)}>
        Auswahl füllt die Adressfelder. Beim Speichern wird der Kunde
        automatisch angelegt oder aktualisiert.
      </p>
    </div>
  )
}

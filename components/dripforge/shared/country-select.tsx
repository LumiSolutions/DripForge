"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY_LABEL,
  normalizeCountryLabel,
} from "@/lib/dripforge/countries"
import { cn } from "@/lib/utils"

type CountrySelectProps = {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
}

export function CountrySelect({
  id,
  label = "Land",
  value,
  onChange,
  error,
  disabled,
  className,
  triggerClassName,
}: CountrySelectProps) {
  const normalized = normalizeCountryLabel(value)
  const known = COUNTRY_OPTIONS.some((o) => o.label === normalized)
  const selectValue = known ? normalized : DEFAULT_COUNTRY_LABEL

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn(
            error && "border-red-500 focus:ring-red-500",
            triggerClassName
          )}
          aria-invalid={Boolean(error)}
        >
          <SelectValue placeholder="Land wählen" />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((option) => (
            <SelectItem key={option.code} value={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}

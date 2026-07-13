"use client"

import { formatTaxCodeOptionLabel } from "@/lib/accounting/tax-code-utils"
import type { TaxCode } from "@/lib/accounting/tax-code-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type TaxCodeSelectFieldProps = {
  value: string
  taxCodes: TaxCode[]
  onChange: (code: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function TaxCodeSelectField({
  value,
  taxCodes,
  onChange,
  placeholder = "Steuercode wählen…",
  className,
  disabled,
}: TaxCodeSelectFieldProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-10 w-full rounded-md border px-2 text-xs sm:text-sm", adminUi.select, className)}
    >
      <option value="">{placeholder}</option>
      {taxCodes.map((taxCode) => (
        <option key={taxCode.code} value={taxCode.code}>
          {formatTaxCodeOptionLabel(taxCode)}
        </option>
      ))}
    </select>
  )
}

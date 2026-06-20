import type { CartItem } from "@/lib/dripforge/types"

export type CustomerCart = {
  id: string
  customerEmail: string
  items: CartItem[]
  updatedAt: string
}

export type PublicCustomerAccount = {
  email: string
  firstName: string
  lastName: string
  street?: string
  zip?: string
  city?: string
  phone?: string
  kundennummer?: string
  loyaltyPoints?: number
  loyaltyBalanceChf?: number
  createdAt?: string
}

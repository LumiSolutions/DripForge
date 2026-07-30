"use client"

import { useEffect } from "react"
import { ShopHeader } from "@/components/dripforge/shop-header"
import { useCart } from "@/components/dripforge/cart-provider"

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { cart } = useCart()

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const theme = savedTheme ?? (prefersDark ? "dark" : "light")
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <ShopHeader mode="link" cartCount={cart.length} />

      <main className="overflow-x-clip">{children}</main>
    </div>
  )
}

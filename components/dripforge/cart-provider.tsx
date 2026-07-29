"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { CartItem } from "@/lib/dripforge/types"
import {
  clearClientCart,
  readClientCart,
  writeClientCart,
} from "@/lib/dripforge/cart-storage"

type CartContextValue = {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  addToCart: (item: CartItem) => void
  applyMergedCart: (items: CartItem[]) => void
  /** Warenkorb lokal + optional am Konto leeren (Stripe-/Checkout-Erfolg). */
  clearCart: () => Promise<void>
  syncCartToAccount: (items?: CartItem[]) => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

async function putAccountCart(items: CartItem[]): Promise<void> {
  try {
    const meRes = await fetch("/api/konto/me", { cache: "no-store" })
    if (!meRes.ok) return
    await fetch("/api/konto/cart", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
  } catch {
    console.warn("Warenkorb: Server-Sync fehlgeschlagen.")
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const syncTimerRef = useRef<number | null>(null)
  const cartRef = useRef<CartItem[]>([])

  useEffect(() => {
    const initial = readClientCart()
    cartRef.current = initial
    setCart(initial)
    setHydrated(true)
  }, [])

  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  useEffect(() => {
    if (!hydrated) return
    writeClientCart(cart)
  }, [cart, hydrated])

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => [...prev, item])
  }, [])

  const applyMergedCart = useCallback((items: CartItem[]) => {
    setCart(items)
  }, [])

  /** Stabil — kein Dependency auf `cart`, sonst Re-Render-Loops. */
  const syncCartToAccount = useCallback(async (items?: CartItem[]) => {
    await putAccountCart(items ?? cartRef.current)
  }, [])

  /** Stabil — darf in useEffect([]) ohne Loop aufgerufen werden. */
  const clearCart = useCallback(async () => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    clearClientCart()
    cartRef.current = []
    setCart([])
    await putAccountCart([])
  }, [])

  useEffect(() => {
    if (!hydrated || cart.length === 0) return

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = window.setTimeout(() => {
      void syncCartToAccount(cart)
    }, 1200)

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current)
      }
    }
  }, [cart, hydrated, syncCartToAccount])

  const value = useMemo(
    () => ({
      cart,
      setCart,
      addToCart,
      applyMergedCart,
      clearCart,
      syncCartToAccount,
    }),
    [cart, addToCart, applyMergedCart, clearCart, syncCartToAccount]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error("useCart muss innerhalb von CartProvider verwendet werden.")
  }
  return ctx
}

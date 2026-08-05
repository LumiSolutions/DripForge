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
import { applyQuantityDiscountsToCartItems } from "@/lib/dripforge/quantity-discount-tiers"
import {
  persistItemPreviews,
  restoreCartItemPreviews,
} from "@/lib/dripforge/cart-preview-persist"

type CartContextValue = {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  /** Komprimiert Previews + IndexedDB, dann in den Warenkorb. */
  addToCart: (item: CartItem) => Promise<void>
  applyMergedCart: (items: CartItem[]) => void
  /** Warenkorb lokal + optional am Konto leeren (Stripe-/Checkout-Erfolg). */
  clearCart: () => Promise<void>
  syncCartToAccount: (items?: CartItem[]) => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

async function putAccountCart(items: CartItem[]): Promise<void> {
  try {
    const meRes = await fetch("/api/konto/me", {
      cache: "no-store",
      credentials: "include",
    })
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
    const initial = applyQuantityDiscountsToCartItems(readClientCart())
    cartRef.current = initial
    setCart(initial)
    setHydrated(true)
    // IndexedDB-Previews nach F5 wiederherstellen
    void restoreCartItemPreviews(initial).then((restored) => {
      if (restored === initial) return
      const withDiscounts = applyQuantityDiscountsToCartItems(restored)
      cartRef.current = withDiscounts
      setCart(withDiscounts)
      writeClientCart(withDiscounts)
    })
  }, [])

  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  useEffect(() => {
    if (!hydrated) return
    writeClientCart(cart)
  }, [cart, hydrated])

  const setCartWithDiscounts = useCallback(
    (updater: React.SetStateAction<CartItem[]>) => {
      setCart((prev) => {
        const base = Array.isArray(prev) ? prev : cartRef.current
        const next =
          typeof updater === "function"
            ? (updater as (p: CartItem[]) => CartItem[])(base)
            : updater
        const applied = applyQuantityDiscountsToCartItems(next)
        cartRef.current = applied
        return applied
      })
    },
    []
  )

  const addToCart = useCallback(async (item: CartItem) => {
    // IDB zuerst, dann komprimierte Data-URLs — erst danach localStorage.
    let compact = item
    try {
      compact = await persistItemPreviews(item)
    } catch {
      console.warn("Warenkorb: Preview-Persistenz fehlgeschlagen.")
    }
    setCart((prev) => {
      const base = Array.isArray(prev) ? prev : cartRef.current
      const next = applyQuantityDiscountsToCartItems([...base, compact])
      cartRef.current = next
      writeClientCart(next)
      return next
    })
  }, [])

  const applyMergedCart = useCallback((items: CartItem[]) => {
    const next = applyQuantityDiscountsToCartItems(items)
    cartRef.current = next
    writeClientCart(next)
    setCart(next)
    void restoreCartItemPreviews(next).then((restored) => {
      if (restored === next) return
      const applied = applyQuantityDiscountsToCartItems(restored)
      cartRef.current = applied
      setCart(applied)
      writeClientCart(applied)
    })
  }, [])

  const syncCartToAccount = useCallback(async (items?: CartItem[]) => {
    await putAccountCart(items ?? cartRef.current)
  }, [])

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
      setCart: setCartWithDiscounts,
      addToCart,
      applyMergedCart,
      clearCart,
      syncCartToAccount,
    }),
    [
      cart,
      setCartWithDiscounts,
      addToCart,
      applyMergedCart,
      clearCart,
      syncCartToAccount,
    ]
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

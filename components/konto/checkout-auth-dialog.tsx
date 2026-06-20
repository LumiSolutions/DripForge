"use client"

import { FormEvent, useState } from "react"
import { Loader2, LogIn, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PublicCustomerAccount } from "@/lib/konto/cart-types"
import type { CartItem } from "@/lib/dripforge/types"

type AuthSuccessPayload = {
  account: PublicCustomerAccount
  cart: CartItem[]
}

type CheckoutAuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestCart: CartItem[]
  onAuthSuccess: (payload: AuthSuccessPayload) => void
}

export function CheckoutAuthDialog({
  open,
  onOpenChange,
  guestCart,
  onAuthSuccess,
}: CheckoutAuthDialogProps) {
  const [tab, setTab] = useState<"login" | "register">("login")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")

  const resetForm = () => {
    setError(null)
    setLoginEmail("")
    setLoginPassword("")
    setFirstName("")
    setLastName("")
    setRegisterEmail("")
    setRegisterPassword("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/konto/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          guestCart,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        account?: PublicCustomerAccount
        cart?: CartItem[]
      }
      if (!res.ok || !data.account) {
        throw new Error(data.error ?? "Login fehlgeschlagen")
      }

      onAuthSuccess({
        account: data.account,
        cart: Array.isArray(data.cart) ? data.cart : guestCart,
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/konto/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName,
          lastName,
          email: registerEmail,
          password: registerPassword,
          guestCart,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        account?: PublicCustomerAccount
        cart?: CartItem[]
      }
      if (!res.ok || !data.account) {
        throw new Error(data.error ?? "Registrierung fehlgeschlagen")
      }

      onAuthSuccess({
        account: data.account,
        cart: Array.isArray(data.cart) ? data.cart : guestCart,
      })
      handleOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registrierung fehlgeschlagen"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Konto für den Checkout</DialogTitle>
          <DialogDescription>
            Melde dich an oder registriere dich — dein Warenkorb bleibt erhalten
            und wird mit deinem Konto zusammengeführt.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as "login" | "register")
            setError(null)
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              Anmelden
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Registrieren
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-login-email">E-Mail</Label>
                <Input
                  id="checkout-login-email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-login-password">Passwort</Label>
                <PasswordInput
                  id="checkout-login-password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              {error && tab === "login" && (
                <p className="text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Anmelden &amp; fortfahren
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              onSubmit={(e) => void handleRegister(e)}
              className="space-y-4 pt-2"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkout-reg-first">Vorname</Label>
                  <Input
                    id="checkout-reg-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkout-reg-last">Nachname</Label>
                  <Input
                    id="checkout-reg-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-reg-email">E-Mail</Label>
                <Input
                  id="checkout-reg-email"
                  type="email"
                  autoComplete="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-reg-password">
                  Passwort (min. 8 Zeichen)
                </Label>
                <PasswordInput
                  id="checkout-reg-password"
                  autoComplete="new-password"
                  minLength={8}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
              </div>
              {error && tab === "register" && (
                <p className="text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Registrieren &amp; fortfahren
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

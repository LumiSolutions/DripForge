"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Coins,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Palette,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRewardPointsEnabled } from "@/hooks/use-reward-points-enabled"

const NAV = [
  { href: "/konto", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/konto/bestellungen", label: "Bestellungen", icon: Package, exact: false },
  { href: "/konto/punkte", label: "Treuepunkte", icon: Coins, exact: false, rewardPoints: true },
  { href: "/konto/profil", label: "Profil & Adressen", icon: MapPin, exact: false },
  { href: "/konto/designs", label: "Meine Designs", icon: Palette, exact: false },
]

export function KontoShell({
  children,
  accountName,
  authMode = false,
}: {
  children: React.ReactNode
  accountName?: string
  /** Login/Registrierung: kein Seitenmenue, kein Abmelden */
  authMode?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const rewardPointsEnabled = useRewardPointsEnabled()

  const navItems = NAV.filter(
    (item) => !item.rewardPoints || rewardPointsEnabled !== false
  )

  const handleLogout = async () => {
    await fetch("/api/konto/logout", { method: "POST" })
    router.push("/konto/login")
    router.refresh()
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4",
        !authMode && "md:flex-row md:gap-10"
      )}
    >
      {!authMode && (
        <nav className="flex shrink-0 flex-row gap-2 md:w-52 md:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}

      <div className="min-w-0 flex-1 space-y-6">
        {!authMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              {accountName && (
                <p className="text-sm text-muted-foreground">
                  Angemeldet als{" "}
                  <span className="font-medium text-foreground">{accountName}</span>
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Abmelden
            </Button>
          </div>
        )}
        <main className={cn("min-w-0", authMode && "mx-auto w-full max-w-lg")}>
          {children}
        </main>
      </div>
    </div>
  )
}

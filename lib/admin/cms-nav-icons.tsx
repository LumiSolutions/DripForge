import type { LucideIcon } from "lucide-react"
import {
  Box,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  Layers,
  MessageSquare,
  Printer,
  Settings,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  ShoppingBag,
  Printer,
  Zap,
  MessageSquare,
  HelpCircle,
  Sparkles,
  HeartHandshake,
  Box,
  Layers,
  Settings,
  Info,
}

export function resolveCmsNavIcon(name?: string | null): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name]
  return Home
}

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const src = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8")
const lines = src.split(/\r?\n/)

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n")
}

function write(rel, content) {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, "utf8")
}

write(
  "lib/dripforge/types.ts",
  `export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  type: "3d" | "laser"
  customDetails?: {
    fileName?: string
    filament?: string
    color?: string
    dimensions?: string
    scale?: string
    material?: string
    size?: string
    hasImage?: boolean
    hasText?: boolean
  }
}

export type FilamentColor = {
  id: string
  name: string
  hex: string
  inStock: boolean
  image: string | null
  printedExample?: string | null
}

export type FilamentMaterial = {
  id: string
  name: string
  colors: FilamentColor[]
}

export type ViewId =
  | "home"
  | "3d-druck"
  | "laser"
  | "shop"
  | "kontakt"
  | "faq"
  | "impressum"
  | "agb"
  | "individual-3d"
  | "individual-laser"
  | "warenkorb"
`
)

write(
  "components/dripforge/shared/individual-process-bar.tsx",
  `"use client"

import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

${slice(76, 119).replace(/^function /, "export function ")}`
)

const filamentBody = slice(125, 291)
  .replace(/^type FilamentColor[\s\S]*?^type FilamentMaterial[\s\S]*?\n\n/m, "")
  .replace(/^function /, "export function ")

write(
  "components/dripforge/shared/filament-color-picker.tsx",
  `"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { FilamentMaterial } from "@/lib/dripforge/types"

${filamentBody}`
)

write(
  "components/dripforge/shared/process-step-item.tsx",
  `"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

${slice(293, 332).replace(/^function /, "export function ")}`
)

write(
  "components/dripforge/shared/laser-process-step.tsx",
  `"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"
import { cn } from "@/lib/utils"

${slice(334, 376).replace(/^function /, "export function ")}`
)

write(
  "lib/dripforge/data.ts",
  `import {
  Home,
  MessageSquare,
  Printer,
  ShoppingBag,
  Zap,
} from "lucide-react"

${slice(379, 536)
  .replace(/^const navItems/, "export const navItems")
  .replace(/^\/\/ Products data\nconst products/, "export const products")
  .replace(/^const materials3D/, "export const materials3D")
  .replace(/^const laserMaterials/, "export const laserMaterials")
  .replace(/^const processSteps/, "export const processSteps")}`
)

const viewFiles = [
  ["home-page.tsx", 962, 1182, "HomePage"],
  ["page-3d-druck.tsx", 1183, 1418, "Page3DDruck"],
  ["page-laser.tsx", 1419, 1713, "PageLaser"],
  ["page-shop.tsx", 1714, 1885, "PageShop"],
  ["page-kontakt.tsx", 1886, 2038, "PageKontakt"],
  ["page-faq.tsx", 2039, 2125, "PageFAQ"],
  ["page-impressum.tsx", 2126, 2163, "PageImpressum"],
  ["page-agb.tsx", 2164, 2205, "PageAGB"],
  ["page-individual-3d.tsx", 2206, 2539, "PageIndividual3D"],
  ["page-individual-laser.tsx", 2540, 2895, "PageIndividualLaser"],
  ["page-warenkorb.tsx", 2896, 3075, "PageWarenkorb"],
]

const sharedImports = lines.slice(2, 53).join("\n")

for (const [file, start, end, name] of viewFiles) {
  let body = slice(start, end).replace(/^function (\w+)/, "export function $1")
  write(
    `components/dripforge/views/${file}`,
    `"use client"\n\n${sharedImports}\nimport { FilamentColorPicker } from "@/components/dripforge/shared/filament-color-picker"\nimport { ProcessStepItem } from "@/components/dripforge/shared/process-step-item"\nimport { LaserProcessStep } from "@/components/dripforge/shared/laser-process-step"\nimport { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"\nimport { materials3D, laserMaterials, processSteps, products } from "@/lib/dripforge/data"\nimport type { CartItem } from "@/lib/dripforge/types"\n\n${body}\n`
  )
}

const appBody = slice(538, 959)
  .replace(/^export default function DripForgePlatform/, "export default function DripForgeApp")

write(
  "components/dripforge/dripforge-app.tsx",
  `"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import {
  Home,
  Printer,
  Zap,
  ShoppingBag,
  MessageSquare,
  Menu,
  X,
  Mail,
  MapPin,
  Send,
  Sparkles,
  ArrowRight,
  MessageCircle,
  User,
  Bot,
  Box,
  Search,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CartItem } from "@/lib/dripforge/types"
import { navItems, products } from "@/lib/dripforge/data"
import { HomePage } from "@/components/dripforge/views/home-page"
import { Page3DDruck } from "@/components/dripforge/views/page-3d-druck"
import { PageLaser } from "@/components/dripforge/views/page-laser"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { PageKontakt } from "@/components/dripforge/views/page-kontakt"
import { PageFAQ } from "@/components/dripforge/views/page-faq"
import { PageImpressum } from "@/components/dripforge/views/page-impressum"
import { PageAGB } from "@/components/dripforge/views/page-agb"
import { PageIndividual3D } from "@/components/dripforge/views/page-individual-3d"
import { PageIndividualLaser } from "@/components/dripforge/views/page-individual-laser"
import { PageWarenkorb } from "@/components/dripforge/views/page-warenkorb"

${appBody}
`
)

write("app/page.tsx", `export { default } from "@/components/dripforge/dripforge-app"\n`)

console.log("Split complete.")

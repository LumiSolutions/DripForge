export type InventoryUnit = "Stück" | "kg"

export type StoredInventoryMaterial = {
  id: string
  name: string
  /** Aktueller Bestand */
  bestand: number
  /** Meldebestand */
  mindestbestand: number
  einheit: InventoryUnit
  lieferant: string
  updatedAt: string
}

export const DEFAULT_INVENTORY_MATERIALS: Omit<
  StoredInventoryMaterial,
  "updatedAt"
>[] = [
  {
    id: "holz-rohlinge",
    name: "Holz-Rohlinge",
    bestand: 24,
    mindestbestand: 10,
    einheit: "Stück",
    lieferant: "",
  },
  {
    id: "handyhalter-basis",
    name: "Handyhalter-Basis",
    bestand: 15,
    mindestbestand: 5,
    einheit: "Stück",
    lieferant: "",
  },
  {
    id: "filament-schwarz",
    name: "Filament Schwarz",
    bestand: 2.5,
    mindestbestand: 1,
    einheit: "kg",
    lieferant: "",
  },
]

export function isLowStock(material: StoredInventoryMaterial): boolean {
  return material.bestand < material.mindestbestand
}

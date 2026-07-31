/** Auswahl «Eigenes Produkt einsenden» im Laser-Konfigurator (kein Shop-Material). */
export const CUSTOMER_INBOUND_MATERIAL_ID = "customer-inbound" as const
/** Freie Materialbeschreibung («Anderes»). */
export const OTHER_MATERIAL_ID = "other" as const

export type IndividualLaserMaterialSelection =
  | import("@/lib/dripforge/types").LaserMaterialId
  | typeof CUSTOMER_INBOUND_MATERIAL_ID
  | typeof OTHER_MATERIAL_ID

export const CUSTOMER_INBOUND_MATERIAL_LABEL =
  "Eigenes Produkt einsenden (zur Bearbeitung)"

export const OTHER_MATERIAL_LABEL = "Anderes Material"

export function isCustomerInboundMaterial(
  materialId: IndividualLaserMaterialSelection
): boolean {
  return materialId === CUSTOMER_INBOUND_MATERIAL_ID
}

export function isOtherMaterial(
  materialId: IndividualLaserMaterialSelection
): boolean {
  return materialId === OTHER_MATERIAL_ID
}

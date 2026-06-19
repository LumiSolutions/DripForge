/** Auswahl «Eigenes Produkt einsenden» im Laser-Konfigurator (kein Shop-Material). */
export const CUSTOMER_INBOUND_MATERIAL_ID = "customer-inbound" as const

export type IndividualLaserMaterialSelection =
  | import("@/lib/dripforge/types").LaserMaterialId
  | typeof CUSTOMER_INBOUND_MATERIAL_ID

export const CUSTOMER_INBOUND_MATERIAL_LABEL =
  "Eigenes Produkt einsenden (zur Bearbeitung)"

export function isCustomerInboundMaterial(
  materialId: IndividualLaserMaterialSelection
): boolean {
  return materialId === CUSTOMER_INBOUND_MATERIAL_ID
}

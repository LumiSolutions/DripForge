import { getCouponsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  normalizeCouponCode,
  type StoredCoupon,
} from "@/lib/admin/coupon-types"

type CosmosDoc<T> = T & { id: string }

export async function cosmosGetCoupons(): Promise<StoredCoupon[]> {
  const container = await getCouponsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredCoupon>>("SELECT * FROM c ORDER BY c.createdAt DESC")
    .fetchAll()

  return resources.map((doc) => ({
    id: doc.id,
    code: doc.code,
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    expiresAt: doc.expiresAt ?? null,
    maxRedemptions: doc.maxRedemptions ?? null,
    redemptionCount: doc.redemptionCount ?? 0,
    aktiv: doc.aktiv !== false,
    archiviert: doc.archiviert === true,
    archivedAt: doc.archivedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }))
}

export async function cosmosGetCouponByCode(
  code: string
): Promise<StoredCoupon | null> {
  const id = normalizeCouponCode(code)
  if (!id) return null

  const container = await getCouponsContainer()
  try {
    const { resource: doc } = await container
      .item(id, id)
      .read<CosmosDoc<StoredCoupon>>()
    if (!doc) return null
    return {
      id: doc.id,
      code: doc.code,
      discountType: doc.discountType,
      discountValue: doc.discountValue,
      expiresAt: doc.expiresAt ?? null,
      maxRedemptions: doc.maxRedemptions ?? null,
      redemptionCount: doc.redemptionCount ?? 0,
      aktiv: doc.aktiv !== false,
      archiviert: doc.archiviert === true,
      archivedAt: doc.archivedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  } catch (error) {
    const errCode = (error as { code?: number }).code
    if (errCode === 404) return null
    logCosmosError(`cosmosGetCouponByCode:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertCoupon(coupon: StoredCoupon): Promise<StoredCoupon> {
  const container = await getCouponsContainer()
  await container.items.upsert({ ...coupon, id: coupon.id })
  return coupon
}

export async function cosmosIncrementCouponRedemption(
  code: string
): Promise<StoredCoupon | null> {
  const coupon = await cosmosGetCouponByCode(code)
  if (!coupon) return null
  const next: StoredCoupon = {
    ...coupon,
    redemptionCount: coupon.redemptionCount + 1,
    updatedAt: new Date().toISOString(),
  }
  await cosmosUpsertCoupon(next)
  return next
}

export async function cosmosDeleteCoupon(id: string): Promise<boolean> {
  const container = await getCouponsContainer()
  try {
    await container.item(id, id).delete()
    return true
  } catch (error) {
    const errCode = (error as { code?: number }).code
    if (errCode === 404) return false
    throw error
  }
}

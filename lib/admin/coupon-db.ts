import { promises as fs } from "fs"
import path from "path"
import {
  cosmosDeleteCoupon,
  cosmosGetCouponByCode,
  cosmosGetCoupons,
  cosmosIncrementCouponRedemption,
  cosmosUpsertCoupon,
} from "@/lib/admin/cosmos-coupons"
import {
  normalizeCouponCode,
  type CouponDiscountType,
  type StoredCoupon,
} from "@/lib/admin/coupon-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const COUPONS_FILE = "coupons.json"

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readCouponsFile(): Promise<StoredCoupon[]> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, COUPONS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as StoredCoupon[]
  } catch {
    return []
  }
}

async function writeCouponsFile(coupons: StoredCoupon[]): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, COUPONS_FILE)
  await fs.writeFile(filePath, JSON.stringify(coupons, null, 2), "utf-8")
}

export async function getCoupons(): Promise<StoredCoupon[]> {
  try {
    return await withCosmosFallback("getCoupons", cosmosGetCoupons, readCouponsFile)
  } catch (error) {
    logCosmosError("getCoupons:total-failure", error)
    return readCouponsFile().catch(() => [])
  }
}

export async function getCouponByCode(code: string): Promise<StoredCoupon | null> {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null

  return withCosmosFallback(
    "getCouponByCode",
    () => cosmosGetCouponByCode(normalized),
    async () => {
      const coupons = await readCouponsFile()
      return coupons.find((c) => c.code === normalized) ?? null
    }
  )
}

export async function upsertCoupon(coupon: StoredCoupon): Promise<StoredCoupon> {
  const next: StoredCoupon = {
    ...coupon,
    id: normalizeCouponCode(coupon.code),
    code: normalizeCouponCode(coupon.code),
    discountValue: Math.max(0, Number(coupon.discountValue) || 0),
    redemptionCount: Math.max(0, Number(coupon.redemptionCount) || 0),
    maxRedemptions:
      coupon.maxRedemptions == null
        ? null
        : Math.max(0, Number(coupon.maxRedemptions) || 0),
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "upsertCoupon",
    async () => {
      await cosmosUpsertCoupon(next)
    },
    async () => {
      const coupons = await readCouponsFile()
      const index = coupons.findIndex((c) => c.id === next.id)
      if (index >= 0) coupons[index] = next
      else coupons.unshift(next)
      await writeCouponsFile(coupons)
    }
  )
  return next
}

export async function incrementCouponRedemption(
  code: string
): Promise<StoredCoupon | null> {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null

  return withCosmosFallback(
    "incrementCouponRedemption",
    () => cosmosIncrementCouponRedemption(normalized),
    async () => {
      const coupons = await readCouponsFile()
      const index = coupons.findIndex((c) => c.code === normalized)
      if (index === -1) return null
      const next = {
        ...coupons[index],
        redemptionCount: coupons[index].redemptionCount + 1,
        updatedAt: new Date().toISOString(),
      }
      coupons[index] = next
      await writeCouponsFile(coupons)
      return next
    }
  )
}

export async function deleteCoupon(id: string): Promise<boolean> {
  const normalized = normalizeCouponCode(id)
  return Boolean(
    await withCosmosFallback(
      "deleteCoupon",
      async () => cosmosDeleteCoupon(normalized),
      async () => {
        const coupons = await readCouponsFile()
        const filtered = coupons.filter((c) => c.id !== normalized)
        if (filtered.length === coupons.length) return false
        await writeCouponsFile(filtered)
        return true
      }
    )
  )
}

export function createCouponInput(input: {
  code: string
  discountType: CouponDiscountType
  discountValue: number
  expiresAt?: string | null
  maxRedemptions?: number | null
  aktiv?: boolean
}): StoredCoupon {
  const code = normalizeCouponCode(input.code)
  const now = new Date().toISOString()

  return {
    id: code,
    code,
    discountType: input.discountType === "fixed" ? "fixed" : "percent",
    discountValue: Math.max(0, Number(input.discountValue) || 0),
    expiresAt: input.expiresAt?.trim() ? input.expiresAt.trim() : null,
    maxRedemptions:
      input.maxRedemptions == null || input.maxRedemptions === undefined
        ? null
        : Math.max(0, Number(input.maxRedemptions) || 0),
    redemptionCount: 0,
    aktiv: input.aktiv !== false,
    createdAt: now,
    updatedAt: now,
  }
}

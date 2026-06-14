import type { Product } from "@/lib/dripforge/types"
import { isProductOnSale } from "@/lib/dripforge/shop-filters"

export type ShopTagFilterState = {
  selectedTagIds: string[]
  saleOnly: boolean
}

export function filterProductsByShopTags(
  products: Product[],
  { selectedTagIds, saleOnly }: ShopTagFilterState
): Product[] {
  let list = products.filter((product) => product.istAktiv !== false)

  if (saleOnly) {
    list = list.filter(isProductOnSale)
  }

  if (selectedTagIds.length === 0) {
    return list
  }

  return list.filter((product) => {
    const productTags = product.tags ?? []
    return selectedTagIds.every((tagId) => productTags.includes(tagId))
  })
}

export { isProductOnSale } from "@/lib/dripforge/shop-filters"

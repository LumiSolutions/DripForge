import type { ProductTag } from "@/lib/admin/product-tags"
import type { Product } from "@/lib/dripforge/types"
import {
  filterProductsByShopFilter,
  type ShopFilterId,
} from "@/lib/dripforge/shop-filters"

export type ShopCombinedFilterState = {
  categoryFilter: ShopFilterId
  selectedTagIds: string[]
}

export function filterProductsByShopTags(
  products: Product[],
  { categoryFilter, selectedTagIds }: ShopCombinedFilterState
): Product[] {
  const safeProducts = products ?? []
  const safeTagIds = selectedTagIds ?? []
  let list = filterProductsByShopFilter(safeProducts, categoryFilter)

  if (safeTagIds.length === 0) {
    return list
  }

  return list.filter((product) => {
    const productTags = product?.tags ?? []
    return safeTagIds.every((tagId) => productTags.includes(tagId))
  })
}

/** Tags that appear on at least one product within the current category scope. */
export function getTagsForCategoryScope(
  products: Product[],
  allTags: ProductTag[],
  categoryFilter: ShopFilterId
): ProductTag[] {
  const scopedProducts = filterProductsByShopFilter(products ?? [], categoryFilter)
  const tagIdsInScope = new Set<string>()

  for (const product of scopedProducts) {
    for (const tagId of product.tags ?? []) {
      tagIdsInScope.add(tagId)
    }
  }

  return (allTags ?? []).filter((tag) => tag?.id && tagIdsInScope.has(tag.id))
}

export { isProductOnSale } from "@/lib/dripforge/shop-filters"

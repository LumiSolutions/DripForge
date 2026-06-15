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
  let list = filterProductsByShopFilter(products, categoryFilter)

  if (selectedTagIds.length === 0) {
    return list
  }

  return list.filter((product) => {
    const productTags = product.tags ?? []
    return selectedTagIds.every((tagId) => productTags.includes(tagId))
  })
}

/** Tags that appear on at least one product within the current category scope. */
export function getTagsForCategoryScope(
  products: Product[],
  allTags: ProductTag[],
  categoryFilter: ShopFilterId
): ProductTag[] {
  const scopedProducts = filterProductsByShopFilter(products, categoryFilter)
  const tagIdsInScope = new Set<string>()

  for (const product of scopedProducts) {
    for (const tagId of product.tags ?? []) {
      tagIdsInScope.add(tagId)
    }
  }

  return allTags.filter((tag) => tagIdsInScope.has(tag.id))
}

export { isProductOnSale } from "@/lib/dripforge/shop-filters"

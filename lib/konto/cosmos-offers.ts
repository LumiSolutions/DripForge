import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  CUSTOMER_OFFER_DOC_TYPE,
  normalizeCustomerOffer,
  type CustomerOffer,
} from "@/lib/konto/customer-offer-types"

export async function cosmosUpsertCustomerOffer(
  offer: CustomerOffer
): Promise<CustomerOffer> {
  const container = await getSettingsContainer()
  await container.items.upsert({ ...offer, id: offer.id })
  return offer
}

export async function cosmosGetCustomerOfferById(
  id: string
): Promise<CustomerOffer | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(id, id).read<CustomerOffer>()
    if (!resource || resource.docType !== CUSTOMER_OFFER_DOC_TYPE) return null
    return normalizeCustomerOffer(resource)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetCustomerOfferById:${id}`, error)
    throw error
  }
}

export async function cosmosListOffersByEmail(
  email: string
): Promise<CustomerOffer[]> {
  const container = await getSettingsContainer()
  try {
    const { resources } = await container.items
      .query<CustomerOffer>({
        query:
          "SELECT * FROM c WHERE c.docType = @docType AND c.customerEmail = @email ORDER BY c.updatedAt DESC",
        parameters: [
          { name: "@docType", value: CUSTOMER_OFFER_DOC_TYPE },
          { name: "@email", value: email },
        ],
      })
      .fetchAll()
    return (resources ?? [])
      .map((entry) => normalizeCustomerOffer(entry))
      .filter((entry): entry is CustomerOffer => Boolean(entry))
  } catch (error) {
    logCosmosError("cosmosListOffersByEmail", error)
    throw error
  }
}

export async function cosmosListAllCustomerOffers(): Promise<CustomerOffer[]> {
  const container = await getSettingsContainer()
  try {
    const { resources } = await container.items
      .query<CustomerOffer>({
        query:
          "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.updatedAt DESC",
        parameters: [{ name: "@docType", value: CUSTOMER_OFFER_DOC_TYPE }],
      })
      .fetchAll()
    return (resources ?? [])
      .map((entry) => normalizeCustomerOffer(entry))
      .filter((entry): entry is CustomerOffer => Boolean(entry))
  } catch (error) {
    logCosmosError("cosmosListAllCustomerOffers", error)
    throw error
  }
}

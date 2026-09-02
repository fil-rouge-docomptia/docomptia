import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { InvoicePage, InvoiceSortField, SortDirection } from '@/types/invoice'
import type {
  SupplierDetails,
  SupplierLegalIdentifierReplacement,
  SupplierListQuery,
  SupplierPage,
  SupplierUpdate,
} from '@/types/supplier'

export async function listSuppliers(
  query: SupplierListQuery,
  signal?: AbortSignal,
): Promise<SupplierPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  })

  if (query.query) {
    searchParams.set('query', query.query)
  }

  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/suppliers?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<SupplierPage>
}

export async function getSupplierDetails(
  supplierId: number,
  signal?: AbortSignal,
): Promise<SupplierDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/suppliers/${supplierId}`,
    { signal },
  )

  return response.json() as Promise<SupplierDetails>
}

export async function updateSupplier(
  supplierId: number,
  update: SupplierUpdate,
): Promise<SupplierDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/suppliers/${supplierId}`,
    {
      body: JSON.stringify(update),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )

  return response.json() as Promise<SupplierDetails>
}

export async function replaceSupplierLegalIdentifier(
  supplierId: number,
  identifierId: number,
  replacement: SupplierLegalIdentifierReplacement,
): Promise<SupplierDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/suppliers/${supplierId}/legal-identifiers/${identifierId}`,
    {
      body: JSON.stringify(replacement),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )

  return response.json() as Promise<SupplierDetails>
}

export async function listSupplierInvoices(
  supplierId: number,
  query: {
    direction: SortDirection
    page: number
    size: number
    sortBy: InvoiceSortField
  },
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const searchParams = new URLSearchParams({
    direction: query.direction,
    page: String(query.page),
    size: String(query.size),
    sortBy: query.sortBy,
    supplier: String(supplierId),
  })
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<InvoicePage>
}

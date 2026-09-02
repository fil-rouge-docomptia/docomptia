import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { SupplierListQuery, SupplierPage } from '@/types/supplier'

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

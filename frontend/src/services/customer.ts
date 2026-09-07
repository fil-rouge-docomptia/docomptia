import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { Customer, CustomerPage } from '@/types/customer'

export async function listCustomers(
  query: { page: number; size: number },
  signal?: AbortSignal,
): Promise<CustomerPage> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) })
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/customers?${params}`, { signal })
  return response.json() as Promise<CustomerPage>
}

export async function getCustomer(customerId: number, signal?: AbortSignal): Promise<Customer> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/customers/${customerId}`, { signal })
  return response.json() as Promise<Customer>
}

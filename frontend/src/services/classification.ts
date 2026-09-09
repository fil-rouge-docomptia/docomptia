import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { Classification, ClassificationInput, ClassificationListQuery, ClassificationPage } from '@/types/classification'

const endpoint = `${apiBaseUrl}/v1/classifications`

export async function listClassifications(query: ClassificationListQuery, signal?: AbortSignal): Promise<ClassificationPage> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) })
  if (query.type) params.set('type', query.type)
  const response = await authenticatedFetch(`${endpoint}?${params}`, { signal })
  return response.json() as Promise<ClassificationPage>
}

export async function getClassification(id: number, signal?: AbortSignal): Promise<Classification> {
  const response = await authenticatedFetch(`${endpoint}/${id}`, { signal })
  return response.json() as Promise<Classification>
}

export async function createClassification(input: ClassificationInput, signal?: AbortSignal): Promise<Classification> {
  const response = await authenticatedFetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  return response.json() as Promise<Classification>
}

export async function updateClassification(id: number, input: Partial<Omit<ClassificationInput, 'type'>>, signal?: AbortSignal): Promise<Classification> {
  const response = await authenticatedFetch(`${endpoint}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  return response.json() as Promise<Classification>
}

export async function deactivateClassification(id: number, signal?: AbortSignal): Promise<Classification> {
  const response = await authenticatedFetch(`${endpoint}/${id}/deactivate`, { method: 'POST', signal })
  return response.json() as Promise<Classification>
}

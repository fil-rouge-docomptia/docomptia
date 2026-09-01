import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { DashboardPeriodQuery, DashboardSummary } from '@/types/dashboard'

export async function getDashboardSummary(
  period: DashboardPeriodQuery,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const searchParams = new URLSearchParams(period)
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/dashboard/summary?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<DashboardSummary>
}

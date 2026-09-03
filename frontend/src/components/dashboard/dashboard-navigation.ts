import type { DashboardPeriodQuery } from '@/types/dashboard'

export function getDashboardInvoiceListHref(
  status: string,
  period: DashboardPeriodQuery,
) {
  const searchParams = new URLSearchParams({
    status,
    startDate: period.startDate,
    endDate: period.endDate,
  })

  return `/invoices?${searchParams.toString()}`
}

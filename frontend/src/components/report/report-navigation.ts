import type { DashboardPeriodQuery } from '@/types/dashboard'

export function getReportInvoiceListHref(
  period: DashboardPeriodQuery,
  statuses: string[] = [],
) {
  const searchParams = new URLSearchParams({
    startDate: period.startDate,
    endDate: period.endDate,
  })

  statuses.forEach((status) => searchParams.append('status', status))

  return `/invoices?${searchParams.toString()}`
}

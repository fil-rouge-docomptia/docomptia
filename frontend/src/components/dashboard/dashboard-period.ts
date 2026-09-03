import type { DashboardPeriodQuery } from '@/types/dashboard'

export const dashboardPeriodOptions = [
  { label: 'Last 12 months', value: 'last-12-months' },
  { label: 'Current month', value: 'current-month' },
  { label: 'Previous month', value: 'previous-month' },
  { label: 'Last 30 days', value: 'last-30-days' },
  { label: 'Last 90 days', value: 'last-90-days' },
  { label: 'Current year', value: 'current-year' },
] as const

export type DashboardPeriodPreset = typeof dashboardPeriodOptions[number]['value']

export const defaultDashboardPeriodPreset: DashboardPeriodPreset = 'last-30-days'

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDashboardPeriodPreset(value: string | null): DashboardPeriodPreset {
  return dashboardPeriodOptions.some((option) => option.value === value)
    ? value as DashboardPeriodPreset
    : defaultDashboardPeriodPreset
}

export function getDashboardPeriod(
  preset: DashboardPeriodPreset,
  now = new Date(),
): DashboardPeriodQuery {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let startDate = new Date(today)
  let endDate = new Date(today)

  switch (preset) {
    case 'last-12-months':
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1)
      break
    case 'current-month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'previous-month':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      endDate = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'last-90-days':
      startDate.setDate(startDate.getDate() - 89)
      break
    case 'current-year':
      startDate = new Date(today.getFullYear(), 0, 1)
      break
    case 'last-30-days':
      startDate.setDate(startDate.getDate() - 29)
      break
  }

  return {
    endDate: toIsoDate(endDate),
    startDate: toIsoDate(startDate),
  }
}

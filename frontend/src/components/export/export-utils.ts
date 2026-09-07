import type { ExportCandidate, ExportTotals } from '@/types/export'

export const exportStatusLabels = { PREPARATION: 'Preparation', GENERE: 'Generated', ARCHIVE: 'Archived' }

export function formatExportAmount(amount: number | null, currency: string | null) {
  if (amount === null) return 'Not available'
  const value = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${value} ${currency || '(currency unspecified)'}`
}

export function formatExportDate(value: string | null) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function exportPeriod(start: string | null, end: string | null) {
  if (!start && !end) return 'All dates'
  return `${start ? formatExportDate(start) : 'Any start date'} – ${end ? formatExportDate(end) : 'Any end date'}`
}

export function validExportDate(value: string) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function exportPeriodError(start: string, end: string) {
  if (!validExportDate(start) || !validExportDate(end)) return 'Enter valid dates.'
  return start && end && start > end ? 'The start date must be on or before the end date.' : null
}

export function selectedExportTotals(invoices: ExportCandidate[]): ExportTotals[] {
  const totals = new Map<string | null, ExportTotals>()
  for (const invoice of invoices) {
    const total = totals.get(invoice.currencyCode) ?? { currencyCode: invoice.currencyCode, totalDebit: 0, totalCredit: 0, invoiceAmount: 0 }
    for (const field of ['totalDebit', 'totalCredit', 'invoiceAmount'] as const) {
      total[field] += Math.round((invoice[field] ?? 0) * 100)
    }
    totals.set(invoice.currencyCode, total)
  }
  return [...totals.values()].map((total) => ({ ...total, totalDebit: total.totalDebit / 100, totalCredit: total.totalCredit / 100, invoiceAmount: total.invoiceAmount / 100 }))
}

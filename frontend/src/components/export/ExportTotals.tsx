import { formatExportAmount } from '@/components/export/export-utils'
import type { ExportTotals as Totals } from '@/types/export'

export function ExportTotals({ totals }: { totals: Totals[] }) {
  return <div aria-label="Selection totals" className="space-y-3">
    {totals.length === 0 ? <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">Select eligible invoices to see totals.</p> : totals.map((total) => (
      <dl className="grid gap-3 sm:grid-cols-3" key={total.currencyCode ?? 'unspecified'}>
        {([['Total debit', 'totalDebit'], ['Total credit', 'totalCredit'], ['Total invoice amount', 'invoiceAmount']] as const).map(([label, field]) => (
          <div className="min-w-0 rounded-lg border border-border p-3" key={field}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium tabular-nums">{formatExportAmount(total[field], total.currencyCode)}</dd>
          </div>
        ))}
      </dl>
    ))}
  </div>
}

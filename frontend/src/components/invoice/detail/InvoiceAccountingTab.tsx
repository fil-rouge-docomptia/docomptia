import { CheckCircle2, FileSpreadsheet, Scale } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { InvoiceDetails } from '@/types/invoice'

import { formatInvoiceDate, formatInvoiceMoney } from './invoice-detail-utils'

export function InvoiceAccountingTab({ invoice }: { invoice: InvoiceDetails }) {
  const entry = invoice.accountingEntry

  if (!entry) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <FileSpreadsheet aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-foreground">No accounting entry yet</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Accounting data will appear here once an entry has been generated for this invoice.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <section className="rounded-lg border border-border bg-background p-4 shadow-elevation-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Accounting entry</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{entry.entryNumber}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{entry.label}</p>
          </div>
          <Badge
            className={
              entry.balanced
                ? 'gap-1 border-success/20 bg-success-muted text-success'
                : 'gap-1 border-warning/20 bg-warning-muted text-warning-muted-foreground'
            }
            variant="outline"
          >
            {entry.balanced ? <CheckCircle2 aria-hidden="true" className="size-3" /> : <Scale aria-hidden="true" className="size-3" />}
            {entry.balanced ? 'Balanced' : 'Unbalanced'}
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Entry date</dt>
            <dd className="mt-1 font-medium text-foreground">{formatInvoiceDate(entry.entryDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium text-foreground">{entry.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total debit</dt>
            <dd className="mt-1 font-medium text-foreground">
              {formatInvoiceMoney(entry.totalDebit, invoice.currencyCode)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total credit</dt>
            <dd className="mt-1 font-medium text-foreground">
              {formatInvoiceMoney(entry.totalCredit, invoice.currencyCode)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Entry lines</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Account</th>
                <th className="px-3 py-2.5 font-medium">Label</th>
                <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                <th className="px-3 py-2.5 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr className="border-t border-border" key={line.accountingEntryLineId}>
                  <td className="px-3 py-3 font-medium text-foreground">{line.accountNumber}</td>
                  <td className="px-3 py-3 text-muted-foreground">{line.lineLabel || line.accountLabel}</td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {formatInvoiceMoney(line.debitAmount, invoice.currencyCode)}
                  </td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {formatInvoiceMoney(line.creditAmount, invoice.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

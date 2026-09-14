import {
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AccountingEntryLines } from '@/components/accounting/AccountingEntryLines'
import { getInvoiceDetails } from '@/services/invoice'
import type {
  AccountingEntry,
  InvoiceDetails,
} from '@/types/invoice'

import { GenerateAccountingEntry } from './GenerateAccountingEntry'
import { formatInvoiceDate, formatInvoiceMoney } from './invoice-detail-utils'
import { isInvoiceReadOnlyStatus } from './invoice-lifecycle'

type AccountingBalanceSummaryProps = {
  currencyCode: string | null
  entry: AccountingEntry
}

function AccountingBalanceSummary({
  currencyCode,
  entry,
}: AccountingBalanceSummaryProps) {
  return (
    <section
      aria-label="Accounting balance summary"
      className="w-full max-w-md rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-1.5">
        {entry.balanced ? (
          <CheckCircle2 aria-hidden="true" className="size-3.5 text-success" />
        ) : (
          <TriangleAlert aria-hidden="true" className="size-3.5 text-destructive" />
        )}
        <Badge
          className={entry.balanced
            ? 'border-success/20 bg-success-muted text-success'
            : undefined}
          variant={entry.balanced ? 'outline' : 'destructive'}
        >
          {entry.balanced ? 'Balanced' : 'Needs attention'}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Debit</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {formatInvoiceMoney(entry.totalDebit, currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Credit</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {formatInvoiceMoney(entry.totalCredit, currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Difference</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {formatInvoiceMoney(entry.balanceDifference, currencyCode)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

type InvoiceAccountingTabProps = {
  invoice: InvoiceDetails
  onInvoiceUpdated: (invoice: InvoiceDetails) => void
}

export function InvoiceAccountingTab({
  invoice,
  onInvoiceUpdated,
}: InvoiceAccountingTabProps) {
  const entry = invoice.accountingEntry

  if (!entry) {
    return <GenerateAccountingEntry invoice={invoice} onInvoiceUpdated={onInvoiceUpdated} />
  }

  const canEdit = entry.status === 'GENERATED'
    && !isInvoiceReadOnlyStatus(invoice.status)


  return (
    <div className="min-w-0 space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Accounting entry
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {entry.balanced
              ? 'The journal entry is balanced and ready for review.'
              : 'Review the entry lines before continuing.'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{entry.entryNumber}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatInvoiceDate(entry.entryDate)}
          </p>
        </div>
      </header>

      {isInvoiceReadOnlyStatus(invoice.status) ? (
        <Alert>
          <AlertTitle>Accounting entry is read-only</AlertTitle>
          <AlertDescription>
            Exported, paid and archived invoices cannot be corrected directly.
          </AlertDescription>
        </Alert>
      ) : null}

      {entry.diagnostics?.length ? <Alert><AlertTitle>Entry checks</AlertTitle><AlertDescription><ul>{entry.diagnostics.map((item, index) => <li key={`${item.code}:${index}`}>{item.message}</li>)}</ul></AlertDescription></Alert> : null}
      <AccountingEntryLines
        entry={entry} currency={invoice.currencyCode} canEdit={canEdit} diagnostics={entry.diagnostics ?? []}
        onReload={async () => onInvoiceUpdated(await getInvoiceDetails(invoice.invoiceId))}
        onSaved={async (updatedEntry) => {
          const refreshed = await getInvoiceDetails(invoice.invoiceId)
          onInvoiceUpdated({ ...refreshed, accountingEntry: updatedEntry })
        }}
      />
      <AccountingBalanceSummary currencyCode={invoice.currencyCode} entry={entry} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { entryTypeLabels } from '@/components/accounting/accounting-utils'
import { AccountingLoadError } from '@/components/accounting/AccountingLoadError'
import { EntryBalanceBadge } from '@/components/accounting/AccountingEntryTable'
import { formatInvoiceDate, formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingEntryLines } from './AccountingEntryLines'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getAccountingEntry } from '@/services/accounting'
import { ApiError } from '@/services/api'
import type { AccountingEntryRecord } from '@/types/accounting'

function EntryContent({ record, onReload }: { record: AccountingEntryRecord; onReload: () => Promise<void> }) {
  const { entry, currencyCode } = record
  const totals = [
    ['Debit', entry.totalDebit],
    ['Credit', entry.totalCredit],
    ['Difference', entry.balanceDifference],
  ] as const

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">{entry.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatInvoiceDate(entry.entryDate)} · {entryTypeLabels[entry.status] ?? entry.status}
          </p>
        </div>
        <EntryBalanceBadge balanced={entry.balanced} />
      </div>
      {entry.reversedAccountingEntryId ? (
        <p className="text-sm text-muted-foreground">Reverses entry #{entry.reversedAccountingEntryId}.</p>
      ) : null}
      <dl aria-label="Entry totals" className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 min-[420px]:grid-cols-3">
        {totals.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium tabular-nums">{formatInvoiceMoney(value, currencyCode)}</dd>
          </div>
        ))}
      </dl>
      {record.diagnostics?.length ? <Alert><AlertTitle>Entry checks</AlertTitle><AlertDescription><ul>{record.diagnostics.map((item, index) => <li key={`${item.code}:${index}`}>{item.message}</li>)}</ul></AlertDescription></Alert> : null}
      <AccountingEntryLines entry={entry} currency={currencyCode} diagnostics={record.diagnostics}
        canEdit={record.invoiceStatus !== 'ARCHIVEE' && record.exportStatus === 'NOT_EXPORTED' && !record.exportBatchId
          && (entry.status === 'CORRECTIVE' || entry.status === 'GENERATED' && !['EXPORTEE', 'PAYEE'].includes(record.invoiceStatus))}
        onSaved={onReload} onReload={onReload} />
      <Button asChild variant="outline">
        <Link to={`/invoices/${record.invoiceId}`}>Open invoice {record.invoiceNumber}</Link>
      </Button>
    </>
  )
}

export function AccountingEntryDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    record: AccountingEntryRecord | null
    error: unknown
    retry: number
  } | null>(null)
  const current = result?.retry === retry ? result : null
  const validId = Number.isSafeInteger(Number(id)) && Number(id) > 0
  const error = validId ? current?.error : new ApiError(404)
  const record = current?.record

  useEffect(() => {
    if (!validId) return
    const controller = new AbortController()
    getAccountingEntry(Number(id), controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) setResult({ record, error: null, retry })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ record: null, error, retry })
      })
    return () => controller.abort()
  }, [id, retry, validId])

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          const trigger = document.getElementById(`entry-${id}`)
          if (trigger) {
            event.preventDefault()
            trigger.focus()
          }
        }}
      >
        <SheetHeader className="pr-6 text-left">
          <SheetTitle>{record?.entry.entryNumber ?? 'Accounting entry'}</SheetTitle>
          <SheetDescription>Review the entry lines and the associated invoice.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 min-w-0 space-y-6">
          {error ? (
            <AccountingLoadError detail error={error} onRetry={() => setRetry((value) => value + 1)} />
          ) : !record ? (
            <div aria-label="Loading accounting entry" role="status">
              <span className="sr-only">Loading accounting entry</span>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : <EntryContent record={record} onReload={async () => { const updated = await getAccountingEntry(Number(id)); setResult({ record: updated, error: null, retry }) }} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

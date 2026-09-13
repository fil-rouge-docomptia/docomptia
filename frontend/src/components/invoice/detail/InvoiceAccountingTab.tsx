import { useState } from 'react'
import {
  CheckCircle2,
  Pencil,
  TriangleAlert,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  AccountingEntry,
  AccountingEntryLine,
  InvoiceDetails,
} from '@/types/invoice'

import { GenerateAccountingEntry } from './GenerateAccountingEntry'
import { AccountingEntryLineEditor } from './AccountingEntryLineEditor'
import { formatInvoiceDate, formatInvoiceMoney } from './invoice-detail-utils'
import { isInvoiceReadOnlyStatus } from './invoice-lifecycle'

type AccountingBalanceSummaryProps = {
  currencyCode: string | null
  entry: AccountingEntry
}

function getInvoiceStatusAfterCorrection(
  currentStatus: string,
  entry: AccountingEntry,
) {
  if (entry.balanced && currentStatus === 'VALIDEE') {
    return 'EXPORTABLE'
  }

  if (!entry.balanced && currentStatus === 'EXPORTABLE') {
    return 'VALIDEE'
  }

  return currentStatus
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

type AccountingEntryLinesProps = {
  canEdit: boolean
  editingLineId: number | null
  invoice: InvoiceDetails
  onCancelEdit: () => void
  onEditLine: (line: AccountingEntryLine) => void
  onEntryUpdated: (entry: AccountingEntry) => void
}

function AccountingEntryLines({
  canEdit,
  editingLineId,
  invoice,
  onCancelEdit,
  onEditLine,
  onEntryUpdated,
}: AccountingEntryLinesProps) {
  const entry = invoice.accountingEntry

  if (!entry) {
    return null
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card">
      <div className="w-full min-w-0 max-w-full overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Account</th>
              <th className="px-3 py-3 font-medium">Label</th>
              <th className="px-3 py-3 text-right font-medium">Debit</th>
              <th className="px-3 py-3 text-right font-medium">Credit</th>
              {canEdit ? (
                <th aria-label="Actions" className="px-3 py-3 text-right font-medium" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => {
              const editing = editingLineId === line.accountingEntryLineId

              if (editing) {
                return (
                  <AccountingEntryLineEditor
                    entryId={entry.accountingEntryId}
                    key={line.accountingEntryLineId}
                    line={line}
                    onCancel={onCancelEdit}
                    onEntryUpdated={onEntryUpdated}
                  />
                )
              }

              return (
                <tr className="border-t border-border" key={line.accountingEntryLineId}>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {line.accountNumber}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {line.lineLabel || line.accountLabel}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatInvoiceMoney(line.debitAmount, invoice.currencyCode)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatInvoiceMoney(line.creditAmount, invoice.currencyCode)}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-3 text-right">
                      <Button
                        aria-label={`Edit accounting line ${line.lineNumber}`}
                        disabled={editingLineId !== null}
                        onClick={() => onEditLine(line)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" />
                        Edit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {entry.lines.length === 0 ? (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No entry lines are available.
        </p>
      ) : null}

      <div className="border-t border-border p-4">
        <AccountingBalanceSummary currencyCode={invoice.currencyCode} entry={entry} />
      </div>
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
  const [editingLineId, setEditingLineId] = useState<number | null>(null)

  if (!entry) {
    return <GenerateAccountingEntry invoice={invoice} onInvoiceUpdated={onInvoiceUpdated} />
  }

  const canEdit = entry.status === 'GENERATED'
    && !isInvoiceReadOnlyStatus(invoice.status)

  const handleEditLine = (line: AccountingEntryLine) => {
    setEditingLineId(line.accountingEntryLineId)
  }

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

      <AccountingEntryLines
        canEdit={canEdit}
        editingLineId={editingLineId}
        invoice={invoice}
        onCancelEdit={() => setEditingLineId(null)}
        onEditLine={handleEditLine}
        onEntryUpdated={(updatedEntry) => {
          setEditingLineId(null)
          onInvoiceUpdated({
            ...invoice,
            accountingEntry: updatedEntry,
            status: getInvoiceStatusAfterCorrection(invoice.status, updatedEntry),
          })
        }}
      />
    </div>
  )
}

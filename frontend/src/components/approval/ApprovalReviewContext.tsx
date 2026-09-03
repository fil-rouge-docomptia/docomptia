import { CheckCircle2, FileSpreadsheet, Scale } from 'lucide-react'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getConfidencePercent,
} from '@/components/invoice/detail/invoice-detail-utils'
import { Badge } from '@/components/ui/badge'
import type { InvoiceDetails } from '@/types/invoice'

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatConfidence(invoice: InvoiceDetails) {
  const confidence = getConfidencePercent(
    invoice.ocrAnalysis
      ? {
          confidenceScore: invoice.ocrAnalysis.confidenceScore,
          fieldName: 'overall',
          normalizedValue: '',
          rawValue: '',
        }
      : undefined,
  )

  return confidence === null ? 'Not available' : `${confidence}%`
}

export function ApprovalReviewContext({ invoice }: { invoice: InvoiceDetails }) {
  const entry = invoice.accountingEntry

  return (
    <div className="divide-y divide-border">
      <section className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Invoice summary</h2>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        <dl className="mt-4 divide-y divide-border">
          <SummaryItem
            label="Supplier"
            value={invoice.supplier?.currentLegalName ?? invoice.supplierName ?? 'Not available'}
          />
          <SummaryItem
            label="Invoice"
            value={invoice.invoiceNumber ?? `Invoice ${invoice.invoiceId}`}
          />
          <SummaryItem label="Invoice date" value={formatInvoiceDate(invoice.invoiceDate)} />
          <SummaryItem label="Due date" value={formatInvoiceDate(invoice.dueDate)} />
          <SummaryItem label="PO / Reference" value={invoice.commandReference ?? 'Not available'} />
          <SummaryItem
            label="Total"
            value={formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode)}
          />
          <SummaryItem label="OCR confidence" value={formatConfidence(invoice)} />
        </dl>
      </section>

      <section className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Accounting context</h2>
          {entry ? (
            <Badge
              className={entry.balanced
                ? 'gap-1 border-success/20 bg-success-muted text-success'
                : 'gap-1 border-warning/20 bg-warning-muted text-warning-muted-foreground'}
              variant="outline"
            >
              {entry.balanced ? (
                <CheckCircle2 aria-hidden="true" className="size-3" />
              ) : (
                <Scale aria-hidden="true" className="size-3" />
              )}
              {entry.balanced ? 'Balanced' : 'Unbalanced'}
            </Badge>
          ) : null}
        </div>

        {entry ? (
          <dl className="mt-4 divide-y divide-border">
            <SummaryItem label="Entry" value={entry.entryNumber} />
            <SummaryItem label="Entry date" value={formatInvoiceDate(entry.entryDate)} />
            <SummaryItem label="Status" value={entry.status} />
            <SummaryItem label="Entry lines" value={String(entry.lines.length)} />
            <SummaryItem
              label="Total debit"
              value={formatInvoiceMoney(entry.totalDebit, invoice.currencyCode)}
            />
            <SummaryItem
              label="Total credit"
              value={formatInvoiceMoney(entry.totalCredit, invoice.currencyCode)}
            />
          </dl>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center">
            <FileSpreadsheet
              aria-hidden="true"
              className="mx-auto size-5 text-muted-foreground"
            />
            <p className="mt-2 text-sm font-medium text-foreground">No accounting entry yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The invoice can still be reviewed using its extracted data.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

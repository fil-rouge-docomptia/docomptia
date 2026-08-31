import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileText,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { InvoiceDetails } from '@/types/invoice'

import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getInvoiceFileName,
} from './invoice-detail-utils'

type InvoiceDocumentPanelProps = {
  invoice: InvoiceDetails
}

function DisabledViewerButton({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Button aria-label={label} disabled size="icon" type="button" variant="ghost">
      {children}
    </Button>
  )
}

export function InvoiceDocumentPanel({ invoice }: InvoiceDocumentPanelProps) {
  const fileName = getInvoiceFileName(invoice.filePath, invoice.invoiceNumber)

  return (
    <section aria-label="Original invoice document" className="flex min-h-[42rem] min-w-0 flex-col bg-card xl:h-[49rem]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-destructive/10 text-destructive">
            <FileText aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">Original invoice</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <DisabledViewerButton label="Download original invoice">
            <Download aria-hidden="true" />
          </DisabledViewerButton>
          <DisabledViewerButton label="Open document full screen">
            <Maximize2 aria-hidden="true" />
          </DisabledViewerButton>
        </div>
      </div>

      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-border px-2 sm:px-4">
        <div className="flex items-center">
          <DisabledViewerButton label="Zoom out">
            <Minus aria-hidden="true" />
          </DisabledViewerButton>
          <span className="w-12 text-center text-xs font-medium text-muted-foreground">100%</span>
          <DisabledViewerButton label="Zoom in">
            <Plus aria-hidden="true" />
          </DisabledViewerButton>
          <DisabledViewerButton label="Fit to width">
            <Expand aria-hidden="true" />
          </DisabledViewerButton>
          <DisabledViewerButton label="Rotate document">
            <RotateCw aria-hidden="true" />
          </DisabledViewerButton>
        </div>
        <div className="hidden items-center sm:flex">
          <DisabledViewerButton label="Previous page">
            <ChevronLeft aria-hidden="true" />
          </DisabledViewerButton>
          <span className="px-2 text-xs font-medium text-muted-foreground">1 / 1</span>
          <DisabledViewerButton label="Next page">
            <ChevronRight aria-hidden="true" />
          </DisabledViewerButton>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden bg-muted/70 p-5 sm:p-8">
        <article className="flex min-h-[32rem] w-full max-w-[25rem] flex-col bg-card p-7 shadow-elevation-3 sm:p-10">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Invoice</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {invoice.supplierName ?? 'Unknown supplier'}
              </h2>
            </div>
            <FileText aria-hidden="true" className="size-8 text-muted-foreground/40" />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Invoice number</dt>
              <dd className="mt-1 font-medium text-foreground">
                {invoice.invoiceNumber ?? 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issue date</dt>
              <dd className="mt-1 font-medium text-foreground">
                {formatInvoiceDate(invoice.invoiceDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="mt-1 font-medium text-foreground">
                {invoice.commandReference ?? 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="mt-1 font-medium text-foreground">
                {formatInvoiceDate(invoice.dueDate)}
              </dd>
            </div>
          </dl>

          <div className="mt-8 space-y-3 border-y border-border py-6">
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-4/5 rounded bg-muted" />
            <div className="h-2 w-11/12 rounded bg-muted" />
            <div className="h-2 w-3/5 rounded bg-muted" />
          </div>

          <dl className="mt-auto space-y-3 pt-8 text-sm">
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Subtotal</dt>
              <dd>{formatInvoiceMoney(invoice.totalHt, invoice.currencyCode)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>Tax</dt>
              <dd>{formatInvoiceMoney(invoice.totalTva, invoice.currencyCode)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold text-foreground">
              <dt>Total</dt>
              <dd>{formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode)}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  )
}

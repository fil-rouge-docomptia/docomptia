import { AlertCircle, Inbox } from 'lucide-react'

import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { InvoiceTable } from '@/components/invoice/InvoiceTable'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  InvoicePage,
  InvoiceSortField,
  SortDirection,
} from '@/types/invoice'

const PAGE_SIZE = 8

type InboxInvoiceListProps = {
  error: boolean
  hasActiveFilters: boolean
  invoicePage: InvoicePage | null
  onClearFilters: () => void
  onOpenUpload: () => void
  onPageChange: (page: number) => void
  onRetry: () => void
  onSortChange: (sortBy: InvoiceSortField) => void
  direction: SortDirection
  sortBy: InvoiceSortField
}

function InboxTableSkeleton() {
  return (
    <section
      aria-label="Loading inbox invoices"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="h-10 bg-muted/70" />
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div
          className="grid h-12 grid-cols-6 items-center gap-4 border-b border-border px-4 last:border-b-0"
          key={index}
        >
          {Array.from({ length: 6 }, (__, cellIndex) => (
            <Skeleton className="h-4 w-full max-w-28" key={cellIndex} />
          ))}
        </div>
      ))}
    </section>
  )
}

export function InboxInvoiceList({
  direction,
  error,
  hasActiveFilters,
  invoicePage,
  onClearFilters,
  onOpenUpload,
  onPageChange,
  onRetry,
  onSortChange,
  sortBy,
}: InboxInvoiceListProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Unable to load inbox invoices</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Check your connection, then try again.</p>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!invoicePage) {
    return <InboxTableSkeleton />
  }

  if (invoicePage.content.length === 0) {
    return (
      <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Inbox aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-base font-semibold text-foreground">
          {hasActiveFilters ? 'No matching inbox invoices' : 'Inbox is empty'}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasActiveFilters
            ? 'Try another status, invoice number or supplier.'
            : 'Upload a supplier invoice to start OCR processing.'}
        </p>
        {hasActiveFilters ? (
          <Button className="mt-5" onClick={onClearFilters} type="button" variant="outline">
            Clear filters
          </Button>
        ) : (
          <Button className="mt-5" onClick={onOpenUpload} type="button">
            Upload invoices
          </Button>
        )}
      </section>
    )
  }

  return (
    <section
      aria-label="Inbox invoice list"
      className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1"
    >
      <InvoiceTable
        direction={direction}
        invoices={invoicePage.content}
        onSortChange={onSortChange}
        sortBy={sortBy}
      />
      <InvoicePagination
        currentPage={invoicePage.number + 1}
        onPageChange={onPageChange}
        pageSize={invoicePage.size}
        totalElements={invoicePage.totalElements}
        totalPages={invoicePage.totalPages}
      />
    </section>
  )
}

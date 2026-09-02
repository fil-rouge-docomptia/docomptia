import { useEffect, useState } from 'react'
import { AlertCircle, FileText } from 'lucide-react'

import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { InvoiceTable } from '@/components/invoice/InvoiceTable'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listSupplierInvoices } from '@/services/supplier'
import type { InvoicePage, InvoiceSortField, SortDirection } from '@/types/invoice'
import type { SupplierDetails } from '@/types/supplier'

const PAGE_SIZE = 6

type SupplierInvoicesTabProps = {
  supplier: SupplierDetails
}

export function SupplierInvoicesTab({ supplier }: SupplierInvoicesTabProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<InvoiceSortField>('invoiceDate')
  const [direction, setDirection] = useState<SortDirection>('DESC')
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<{
    error: boolean
    invoicePage: InvoicePage | null
    requestKey: string
  }>({ error: false, invoicePage: null, requestKey: '' })
  const requestKey = `${supplier.supplierId}:${currentPage}:${sortBy}:${direction}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = currentRequest && requestState.error
  const invoicePage = currentRequest ? requestState.invoicePage : null

  useEffect(() => {
    const controller = new AbortController()

    listSupplierInvoices(
      supplier.supplierId,
      { direction, page: currentPage - 1, size: PAGE_SIZE, sortBy },
      controller.signal,
    )
      .then((response) => {
        setRequestState({ error: false, invoicePage: response, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, invoicePage: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [currentPage, direction, requestKey, sortBy, supplier.supplierId])

  const handleSortChange = (field: InvoiceSortField) => {
    setCurrentPage(1)
    setDirection(sortBy === field && direction === 'DESC' ? 'ASC' : 'DESC')
    setSortBy(field)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Supplier invoices</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Invoices linked to the current supplier identity.
        </p>
      </div>

      <Badge className="font-normal" variant="outline">
        Supplier: {supplier.legalName}
      </Badge>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load supplier invoices</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <p>The supplier profile remains available.</p>
            <Button onClick={() => setRetryCount((count) => count + 1)} size="sm" type="button" variant="outline">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !invoicePage ? (
        <div aria-label="Loading supplier invoices" className="space-y-3 rounded-lg border p-4">
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : invoicePage.content.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <FileText aria-hidden="true" className="size-7 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">No supplier invoices</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No invoice is currently linked to this legal identity.
          </p>
        </div>
      ) : (
        <section aria-label="Supplier invoices" className="overflow-hidden rounded-lg border bg-card shadow-elevation-1">
          <InvoiceTable
            direction={direction}
            invoices={invoicePage.content}
            onSortChange={handleSortChange}
            sortBy={sortBy}
          />
          <InvoicePagination
            currentPage={invoicePage.number + 1}
            onPageChange={setCurrentPage}
            pageSize={invoicePage.size}
            totalElements={invoicePage.totalElements}
            totalPages={invoicePage.totalPages}
          />
        </section>
      )}
    </div>
  )
}

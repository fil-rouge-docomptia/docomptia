import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, FileText, Upload } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { InvoiceFilters } from '@/components/invoice/InvoiceFilters'
import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { InvoiceTable } from '@/components/invoice/InvoiceTable'
import { invoiceStatusLabels } from '@/components/invoice/invoice-status'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listInvoices } from '@/services/invoice'
import type {
  InvoiceFilterUpdates,
  InvoiceListFilters,
  InvoicePage,
  InvoiceSortField,
  SortDirection,
} from '@/types/invoice'

const PAGE_SIZE = 8
const sortableFields: InvoiceSortField[] = ['createdAt', 'invoiceDate', 'totalTtc', 'status']
const filterParamKeys: (keyof InvoiceListFilters)[] = [
  'client',
  'dueDate',
  'endDate',
  'invoiceDate',
  'invoiceNumber',
  'maxAmount',
  'minAmount',
  'startDate',
  'status',
  'supplier',
]

type InvoiceRequestState = {
  error: boolean
  invoicePage: InvoicePage | null
  requestKey: string
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function parseSortField(value: string | null): InvoiceSortField {
  return sortableFields.includes(value as InvoiceSortField)
    ? value as InvoiceSortField
    : 'createdAt'
}

function parseDirection(value: string | null): SortDirection {
  return value?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
}

function parseFilters(searchParams: URLSearchParams): InvoiceListFilters {
  const filters: InvoiceListFilters = {}
  const readValue = (key: Exclude<keyof InvoiceListFilters, 'status'>) => {
    const value = searchParams.get(key)?.trim()
    if (value) {
      filters[key] = value
    }
  }

  filterParamKeys
    .filter((key): key is Exclude<keyof InvoiceListFilters, 'status'> => key !== 'status')
    .forEach(readValue)

  const statuses = searchParams
    .getAll('status')
    .flatMap((value) => value.split(','))
    .map((status) => status.trim().toUpperCase())
    .filter((status, index, values) => (
      Boolean(invoiceStatusLabels[status]) && values.indexOf(status) === index
    ))

  if (statuses.length) {
    filters.status = statuses
  }

  return filters
}

function InvoiceTableSkeleton() {
  return (
    <div aria-label="Loading invoices" className="overflow-hidden rounded-lg border border-border">
      <div className="h-10 bg-muted/70" />
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div
          className="grid h-12 grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] items-center gap-4 border-b border-border px-4 last:border-b-0"
          key={index}
        >
          {Array.from({ length: 6 }, (__, cellIndex) => (
            <Skeleton className="h-4 w-full max-w-28" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestState, setRequestState] = useState<InvoiceRequestState>({
    error: false,
    invoicePage: null,
    requestKey: '',
  })
  const [retryCount, setRetryCount] = useState(0)
  const currentPage = parsePage(searchParams.get('page'))
  const sortBy = parseSortField(searchParams.get('sortBy'))
  const direction = parseDirection(searchParams.get('direction'))
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const requestKey = `${currentPage}:${sortBy}:${direction}:${JSON.stringify(filters)}:${retryCount}`
  const isCurrentRequest = requestState.requestKey === requestKey
  const error = isCurrentRequest && requestState.error
  const invoicePage = isCurrentRequest ? requestState.invoicePage : null
  const hasActiveFilters = Object.keys(filters).length > 0

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction,
        ...filters,
        page: currentPage - 1,
        size: PAGE_SIZE,
        sortBy,
      },
      controller.signal,
    )
      .then((nextInvoicePage) => {
        setRequestState({
          error: false,
          invoicePage: nextInvoicePage,
          requestKey,
        })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({
            error: true,
            invoicePage: null,
            requestKey,
          })
        }
      })

    return () => controller.abort()
  }, [currentPage, direction, filters, requestKey, sortBy])

  const updateSearchParams = useCallback(
    (updates: Record<string, string>) => {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        Object.entries(updates).forEach(([key, value]) => nextParams.set(key, value))
        return nextParams
      })
    },
    [setSearchParams],
  )

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: String(page) })
  }

  const handleSortChange = (field: InvoiceSortField) => {
    const nextDirection = sortBy === field && direction === 'DESC' ? 'ASC' : 'DESC'
    updateSearchParams({ direction: nextDirection, page: '1', sortBy: field })
  }

  const handleFilterChange = (updates: InvoiceFilterUpdates) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      Object.entries(updates).forEach(([key, value]) => {
        nextParams.delete(key)

        if (Array.isArray(value)) {
          value.forEach((item) => nextParams.append(key, item))
        } else if (value) {
          nextParams.set(key, value)
        }
      })

      nextParams.set('page', '1')
      return nextParams
    })
  }

  const handleFilterReset = () => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      filterParamKeys.forEach((key) => nextParams.delete(key))
      nextParams.set('page', '1')
      return nextParams
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button disabled title="Export will be available once accounting export is integrated" variant="outline">
              Export
            </Button>
            <Button asChild>
              <Link to="/inbox?upload=1">
                <Upload aria-hidden="true" />
                Upload invoices
              </Link>
            </Button>
          </>
        }
        description="Manage validation, approval, accounting and export status."
        title="Invoices"
      />

      <InvoiceFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load invoices</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Check your connection, then try again.</p>
            <Button onClick={() => setRetryCount((count) => count + 1)} size="sm" type="button" variant="outline">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !invoicePage ? (
        <InvoiceTableSkeleton />
      ) : invoicePage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FileText aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            {hasActiveFilters ? 'No matching invoices' : 'No invoices yet'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'Try adjusting or clearing the current filters.'
              : 'Upload a supplier invoice to start its validation workflow.'}
          </p>
          {hasActiveFilters ? (
            <Button className="mt-5" onClick={handleFilterReset} type="button" variant="outline">
              Clear filters
            </Button>
          ) : (
            <Button asChild className="mt-5">
              <Link to="/inbox?upload=1">
                <Upload aria-hidden="true" />
                Upload invoices
              </Link>
            </Button>
          )}
        </section>
      ) : (
        <section aria-label="Invoice list" className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
          <InvoiceTable
            direction={direction}
            invoices={invoicePage.content}
            onSortChange={handleSortChange}
            sortBy={sortBy}
          />
          <InvoicePagination
            currentPage={invoicePage.number + 1}
            onPageChange={handlePageChange}
            pageSize={invoicePage.size}
            totalElements={invoicePage.totalElements}
            totalPages={invoicePage.totalPages}
          />
        </section>
      )}
    </div>
  )
}

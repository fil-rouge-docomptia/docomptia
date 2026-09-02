import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  DocumentFilters,
  type DocumentView,
} from '@/components/document/DocumentFilters'
import { DocumentGrid } from '@/components/document/DocumentGrid'
import { DocumentTable } from '@/components/document/DocumentTable'
import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { invoiceStatusLabels } from '@/components/invoice/invoice-status'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listInvoices } from '@/services/invoice'
import type {
  InvoiceFilterUpdates,
  InvoiceListFilters,
  InvoicePage,
} from '@/types/invoice'

const pageSizes: Record<DocumentView, number> = {
  grid: 6,
  table: 8,
}
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

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function parseView(value: string | null): DocumentView {
  return value === 'grid' ? 'grid' : 'table'
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

function DocumentsSkeleton() {
  return (
    <div aria-label="Loading documents" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-full max-w-80" />
        <Skeleton className="hidden h-9 w-60 sm:block" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton className="h-12 w-full" key={index} />
      ))}
    </div>
  )
}

type DocumentEmptyStateProps = {
  filtered: boolean
  onClear: () => void
}

function DocumentEmptyState({ filtered, onClear }: DocumentEmptyStateProps) {
  return (
    <div className="flex justify-center pt-9">
      <section className="flex min-h-[236px] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-10 text-center">
        <Badge variant="secondary">{filtered ? 'No results' : 'No documents'}</Badge>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-[-0.25px] text-foreground">
            {filtered ? 'No documents found' : 'No documents yet'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered
              ? 'Try adjusting your search or filters.'
              : 'Processed and archived documents will appear here.'}
          </p>
        </div>
        {filtered ? (
          <Button onClick={onClear} type="button">Clear filters</Button>
        ) : (
          <Button asChild>
            <Link to="/inbox?upload=1">Go to inbox</Link>
          </Button>
        )}
      </section>
    </div>
  )
}

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestState, setRequestState] = useState<{
    error: boolean
    page: InvoicePage | null
    requestKey: string
  }>({ error: false, page: null, requestKey: '' })
  const [retryCount, setRetryCount] = useState(0)
  const view = parseView(searchParams.get('view'))
  const currentPage = parsePage(searchParams.get('page'))
  const pageSize = pageSizes[view]
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const requestKey = `${view}:${currentPage}:${JSON.stringify(filters)}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = currentRequest && requestState.error
  const documentPage = currentRequest ? requestState.page : null
  const hasActiveFilters = Object.keys(filters).length > 0

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction: 'DESC',
        ...filters,
        page: currentPage - 1,
        size: pageSize,
        sortBy: 'createdAt',
      },
      controller.signal,
    )
      .then((nextPage) => {
        setRequestState({ error: false, page: nextPage, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, page: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [currentPage, filters, pageSize, requestKey])

  const updateSearchParams = (updates: Record<string, string | null>) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          nextParams.delete(key)
        } else {
          nextParams.set(key, value)
        }
      })
      return nextParams
    })
  }

  const handleViewChange = (nextView: DocumentView) => {
    updateSearchParams({ page: '1', view: nextView === 'table' ? null : nextView })
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
        description="Search and access processed and archived documents."
        title="Documents"
      />

      {!documentPage && !error ? (
        <DocumentsSkeleton />
      ) : (
        <>
          <DocumentFilters
            filters={filters}
            onChange={handleFilterChange}
            onViewChange={handleViewChange}
            view={view}
          />

          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to load documents</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>Check your connection, then try again.</p>
                <Button
                  onClick={() => setRetryCount((count) => count + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : documentPage?.content.length === 0 ? (
            <DocumentEmptyState filtered={hasActiveFilters} onClear={handleFilterReset} />
          ) : documentPage ? (
            <section aria-label="Documents" className="space-y-4">
              {view === 'table' ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
                  <DocumentTable documents={documentPage.content} />
                </div>
              ) : (
                <DocumentGrid documents={documentPage.content} />
              )}
              <InvoicePagination
                currentPage={documentPage.number + 1}
                itemLabel="documents"
                onPageChange={(page) => updateSearchParams({ page: String(page) })}
                pageSize={documentPage.size}
                totalElements={documentPage.totalElements}
                totalPages={documentPage.totalPages}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

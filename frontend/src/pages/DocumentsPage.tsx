import { useEffect, useState } from 'react'
import { AlertCircle, FileText, Grid2X2, List } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { DocumentGrid } from '@/components/document/DocumentGrid'
import { DocumentTable } from '@/components/document/DocumentTable'
import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listInvoices } from '@/services/invoice'
import type { InvoicePage } from '@/types/invoice'

type DocumentView = 'grid' | 'table'

const pageSizes: Record<DocumentView, number> = {
  grid: 6,
  table: 8,
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function parseView(value: string | null): DocumentView {
  return value === 'grid' ? 'grid' : 'table'
}

function DocumentsSkeleton({ view }: { view: DocumentView }) {
  if (view === 'grid') {
    return (
      <div aria-label="Loading documents" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: pageSizes.grid }, (_, index) => (
          <Skeleton className="h-72" key={index} />
        ))}
      </div>
    )
  }

  return (
    <div aria-label="Loading documents" className="overflow-hidden rounded-lg border border-border">
      <div className="h-10 bg-muted/70" />
      {Array.from({ length: pageSizes.table }, (_, index) => (
        <Skeleton className="h-14 w-full rounded-none border-b last:border-b-0" key={index} />
      ))}
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
  const requestKey = `${view}:${currentPage}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = currentRequest && requestState.error
  const documentPage = currentRequest ? requestState.page : null

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction: 'DESC',
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
  }, [currentPage, pageSize, requestKey, view])

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

  return (
    <div className="space-y-6">
      <PageHeader
        description="Search and access processed and archived documents."
        title="Documents"
      />

      <section aria-label="Document display controls" className="flex justify-end">
        <div aria-label="Document view" className="grid grid-cols-2" role="group">
          <Button
            aria-pressed={view === 'table'}
            className="rounded-r-none"
            onClick={() => handleViewChange('table')}
            size="sm"
            type="button"
            variant={view === 'table' ? 'secondary' : 'outline'}
          >
            <List aria-hidden="true" />
            Table
          </Button>
          <Button
            aria-pressed={view === 'grid'}
            className="rounded-l-none"
            onClick={() => handleViewChange('grid')}
            size="sm"
            type="button"
            variant={view === 'grid' ? 'secondary' : 'outline'}
          >
            <Grid2X2 aria-hidden="true" />
            Preview grid
          </Button>
        </div>
      </section>

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
      ) : !documentPage ? (
        <DocumentsSkeleton view={view} />
      ) : documentPage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FileText aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-foreground">No documents yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Processed supplier invoices will appear in this document library.
          </p>
          <Button asChild className="mt-5">
            <Link to="/inbox?upload=1">Upload an invoice</Link>
          </Button>
        </section>
      ) : (
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
      )}
    </div>
  )
}

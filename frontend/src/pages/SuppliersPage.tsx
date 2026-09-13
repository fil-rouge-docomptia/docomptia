import { useEffect, useState } from 'react'
import { AlertCircle, Building2, Plus, Search, Upload } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierCreateDialog } from '@/components/supplier/SupplierCreateDialog'
import { canManageSupplier } from '@/components/supplier/detail/supplier-detail-utils'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { SupplierTable } from '@/components/supplier/SupplierTable'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listSuppliers } from '@/services/supplier'
import type { SupplierPage } from '@/types/supplier'

const PAGE_SIZE = 8

type SupplierRequestState = {
  error: boolean
  requestKey: string
  supplierPage: SupplierPage | null
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function SupplierTableSkeleton() {
  return (
    <div aria-label="Loading suppliers" className="overflow-hidden rounded-lg border border-border">
      <div className="h-10 bg-muted/70" />
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div
          className="grid h-14 grid-cols-[1.25fr_1fr_1fr_1.5fr_0.5fr_0.6fr] items-center gap-4 border-b border-border px-4 last:border-b-0"
          key={index}
        >
          {Array.from({ length: 6 }, (__, cellIndex) => (
            <Skeleton className="h-4 w-full max-w-32" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function SuppliersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestState, setRequestState] = useState<SupplierRequestState>({
    error: false,
    requestKey: '',
    supplierPage: null,
  })
  const [retryCount, setRetryCount] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const currentPage = parsePage(searchParams.get('page'))
  const query = searchParams.get('query')?.trim() ?? ''
  const requestKey = `${currentPage}:${query}:${retryCount}`
  const isCurrentRequest = requestState.requestKey === requestKey
  const error = isCurrentRequest && requestState.error
  const supplierPage = isCurrentRequest ? requestState.supplierPage : null

  useEffect(() => {
    const controller = new AbortController()

    listSuppliers(
      {
        page: currentPage - 1,
        query: query || undefined,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((nextSupplierPage) => {
        setRequestState({
          error: false,
          requestKey,
          supplierPage: nextSupplierPage,
        })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({
            error: true,
            requestKey,
            supplierPage: null,
          })
        }
      })

    return () => controller.abort()
  }, [currentPage, query, requestKey])

  const handleSearchChange = (value: string) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      if (value) {
        nextParams.set('query', value)
      } else {
        nextParams.delete('query')
      }

      nextParams.set('page', '1')
      return nextParams
    })
  }

  const handlePageChange = (page: number) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set('page', String(page))
      return nextParams
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button disabled title="Supplier import is not available yet" variant="outline">
              <Upload aria-hidden="true" />
              Import suppliers
            </Button>
            {canManageSupplier(user?.role.code) ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" />
                Add supplier
              </Button>
            ) : null}
          </>
        }
        description="Manage suppliers and their legal identification details."
        title="Suppliers"
      />

      <div className="relative w-full sm:max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search suppliers"
          className="h-9 border-input pl-9 text-sm"
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search suppliers, SIRET, VAT…"
          type="search"
          value={searchParams.get('query') ?? ''}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load suppliers</AlertTitle>
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
      ) : !supplierPage ? (
        <SupplierTableSkeleton />
      ) : supplierPage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Building2 aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            {query ? 'No matching suppliers' : 'No suppliers yet'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {query
              ? 'Try searching by another legal name, SIRET or VAT number.'
              : 'Suppliers identified from your invoices will appear here.'}
          </p>
          {query ? (
            <Button
              className="mt-5"
              onClick={() => handleSearchChange('')}
              type="button"
              variant="outline"
            >
              Clear search
            </Button>
          ) : null}
        </section>
      ) : (
        <section
          aria-label="Supplier list"
          className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1"
        >
          <SupplierTable suppliers={supplierPage.content} />
          <SupplierPagination
            currentPage={supplierPage.number + 1}
            onPageChange={handlePageChange}
            pageSize={supplierPage.size}
            totalElements={supplierPage.totalElements}
            totalPages={supplierPage.totalPages}
          />
        </section>
      )}

      <SupplierCreateDialog
        onCreated={(supplier) => navigate(`/suppliers/${supplier.supplierId}`)}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { ClientLoadError } from '@/components/client/ClientLoadError'
import { ClientTable } from '@/components/client/ClientTable'
import { getClientLoadError, parseClientPage, type ClientLoadError as LoadError } from '@/components/client/client-utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listCustomers } from '@/services/customer'
import type { CustomerPage } from '@/types/customer'

const PAGE_SIZE = 8

export default function ClientsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<{
    customerPage: CustomerPage | null
    error: LoadError | null
    requestKey: string
  }>({ customerPage: null, error: null, requestKey: '' })
  const currentPage = parseClientPage(searchParams.get('page'))
  const requestKey = `${user?.id}:${user?.organization.id}:${currentPage}:${retryCount}`
  const currentRequest = requestKey === requestState.requestKey
  const customerPage = currentRequest ? requestState.customerPage : null
  const error = currentRequest ? requestState.error : null

  useEffect(() => {
    const controller = new AbortController()
    listCustomers({ page: currentPage - 1, size: PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setRequestState({ customerPage: response, error: null, requestKey })
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setRequestState({ customerPage: null, error: getClientLoadError(requestError), requestKey })
        }
      })
    return () => controller.abort()
  }, [currentPage, requestKey])

  const handlePageChange = (page: number) => setSearchParams({ page: String(page) })

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<Button disabled title="This screen currently supports consultation only."><Plus aria-hidden="true" />Add client</Button>}
        description="Consult clients and their legal identification details."
        title="Clients"
      />
      {error ? (
        <ClientLoadError error={error} onRetry={() => setRetryCount((count) => count + 1)} />
      ) : !customerPage ? (
        <div aria-label="Loading clients" className="space-y-4" role="status">
          <span className="sr-only">Loading clients</span>
          <Skeleton className="h-10 w-80 max-w-full" />
          {Array.from({ length: PAGE_SIZE }, (_, index) => <Skeleton className="h-11 w-full" key={index} />)}
        </div>
      ) : customerPage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Users aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-base font-semibold">{currentPage > 1 ? 'No clients on this page' : 'No clients yet'}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {currentPage > 1 ? 'Return to the first page to see available clients.' : 'Clients registered in your organization will appear here.'}
          </p>
          {currentPage > 1 ? <Button className="mt-5" onClick={() => handlePageChange(1)} variant="outline">Back to first page</Button> : null}
        </section>
      ) : (
        <section aria-label="Client list" className="min-w-0 space-y-6">
          <ClientTable currentPage={currentPage} customers={customerPage.content} />
          <SupplierPagination
            ariaLabel="Client pagination"
            currentPage={customerPage.number + 1}
            itemLabel="clients"
            onPageChange={handlePageChange}
            pageSize={customerPage.size}
            totalElements={customerPage.totalElements}
            totalPages={customerPage.totalPages}
          />
        </section>
      )}
    </div>
  )
}

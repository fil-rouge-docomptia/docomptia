import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ClientDetailHeader } from '@/components/client/ClientDetailHeader'
import { ClientLoadError } from '@/components/client/ClientLoadError'
import { ClientOverview } from '@/components/client/ClientOverview'
import { getClientLoadError, parseClientPage, type ClientLoadError as LoadError } from '@/components/client/client-utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { getCustomer } from '@/services/customer'
import type { Customer } from '@/types/customer'

export default function ClientDetailsPage() {
  const { customerId: customerIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<{
    customer: Customer | null
    error: LoadError | null
    requestKey: string
  }>({ customer: null, error: null, requestKey: '' })
  const customerId = Number(customerIdParam)
  const validId = /^\d+$/.test(customerIdParam ?? '') && Number.isSafeInteger(customerId) && customerId > 0
  const requestKey = `${user?.id}:${user?.organization.id}:${customerIdParam}:${retryCount}`
  const currentRequest = requestKey === requestState.requestKey
  const customer = currentRequest ? requestState.customer : null
  const error = !validId ? 'not-found' : currentRequest ? requestState.error : null

  useEffect(() => {
    if (!validId) return
    const controller = new AbortController()
    getCustomer(customerId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setRequestState({ customer: response, error: null, requestKey })
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setRequestState({ customer: null, error: getClientLoadError(requestError, true), requestKey })
        }
      })
    return () => controller.abort()
  }, [customerId, requestKey, validId])

  return (
    <div className="space-y-6 [&_h1]:break-words">
      <Button asChild className="h-11 sm:h-9" size="sm" variant="ghost">
        <Link to={`/clients?page=${parseClientPage(searchParams.get('page'))}`}><ArrowLeft aria-hidden="true" />Back to clients</Link>
      </Button>
      {error ? (
        <ClientLoadError error={error} onRetry={() => setRetryCount((count) => count + 1)} />
      ) : !customer ? (
        <div aria-label="Loading client details" className="space-y-6" role="status">
          <span className="sr-only">Loading client details</span>
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-11 w-full max-w-md" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-32" key={index} />)}
          </div>
        </div>
      ) : (
        <>
          <ClientDetailHeader customer={customer} />
          <Tabs value="overview">
            <TabsList aria-label="Client details" className="grid h-11 w-full max-w-md grid-cols-4 gap-1 bg-transparent p-0">
              {['Overview', 'Invoices', 'Accounting', 'Activity'].map((tab) => (
                <TabsTrigger
                  aria-describedby={tab === 'Overview' ? undefined : 'client-tabs-unavailable'}
                  className="h-11 bg-muted px-2 text-xs data-[state=active]:border data-[state=active]:border-border"
                  disabled={tab !== 'Overview'}
                  key={tab}
                  value={tab.toLowerCase()}
                >{tab}</TabsTrigger>
              ))}
            </TabsList>
            <p className="mt-3 text-xs text-muted-foreground" id="client-tabs-unavailable">
              Client invoices, accounting and activity are not available yet. This directory currently supports consultation only.
            </p>
            <TabsContent className="mt-6" value="overview"><ClientOverview customer={customer} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

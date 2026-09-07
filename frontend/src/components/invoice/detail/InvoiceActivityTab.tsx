import { useEffect, useState } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'

import { InvoiceActivityEvent } from '@/components/invoice/detail/InvoiceActivityEvent'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { getInvoiceHistory } from '@/services/invoice'
import type { InvoiceHistoryItem } from '@/types/invoice'

import { activityTimestamp } from './invoice-activity-utils'

export function InvoiceActivityTab({ history, invoiceId }: {
  // A partial mutation response invalidates the history included in the invoice details.
  history: InvoiceHistoryItem[] | null
  invoiceId: number
}) {
  const [retryCount, setRetryCount] = useState(0)
  const [request, setRequest] = useState<{
    key: string
    history: InvoiceHistoryItem[] | null
    error: boolean
  }>({ key: '', history: null, error: false })
  const requestKey = `${invoiceId}:${retryCount}`
  const currentRequest = request.key === requestKey
  const events = history ?? (currentRequest ? request.history : null)
  const error = history === null && currentRequest && request.error

  useEffect(() => {
    if (history !== null) {
      return
    }

    const controller = new AbortController()
    getInvoiceHistory(invoiceId, controller.signal)
      .then((updatedHistory) => {
        setRequest({ key: requestKey, history: updatedHistory, error: false })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequest({ key: requestKey, history: null, error: true })
        }
      })

    return () => controller.abort()
  }, [history, invoiceId, requestKey])

  const sortedEvents = events?.toSorted((left, right) => (
    activityTimestamp(right.date) - activityTimestamp(left.date)
  ))

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.25px] text-foreground">Activity</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Chronological audit trail · Newest first
          </p>
        </div>
        <Badge variant="outline">Read-only audit log</Badge>
      </header>

      <Alert className="border-transparent bg-info-muted">
        <AlertTitle>Read-only audit history</AlertTitle>
        <AlertDescription>
          Recorded events cannot be edited or deleted from this screen.
        </AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load activity</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>The latest history could not be loaded. You can retry without repeating the invoice action.</p>
            <Button onClick={() => setRetryCount((count) => count + 1)} variant="outline">
              Retry activity
            </Button>
          </AlertDescription>
        </Alert>
      ) : !sortedEvents ? (
        <div aria-label="Loading invoice activity" className="space-y-3" role="status">
          {[0, 1, 2].map((index) => <Skeleton className="h-20 w-full" key={index} />)}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="audit-events-title" className="min-w-0">
            <h3 className="text-base font-semibold text-foreground" id="audit-events-title">
              Audit events
            </h3>
            {sortedEvents.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center px-4 py-8 text-center">
                <Clock3 aria-hidden="true" className="size-8 text-muted-foreground" />
                <h4 className="mt-4 text-sm font-semibold">No activity yet</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status changes and corrections will appear here.
                </p>
              </div>
            ) : (
              <ol aria-label="Invoice activity" className="mt-3 space-y-2">
                {sortedEvents.map((item, index) => (
                  <li key={`${item.date}-${item.type}-${item.action}-${index}`}>
                    {index > 0 ? <Separator className="mb-2" /> : null}
                    <InvoiceActivityEvent item={item} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside aria-label="Audit properties" className="space-y-2.5 rounded-lg border border-border p-4">
            <Badge variant="outline">Read-only</Badge>
            <h3 className="text-base font-semibold">Audit properties</h3>
            <p className="text-sm text-muted-foreground">
              Review the authors, timestamps and details recorded for this invoice.
            </p>
            <Separator />
            <dl className="space-y-2.5">
              <div>
                <dt className="text-xs text-muted-foreground">History</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {sortedEvents.length} recorded {sortedEvents.length === 1 ? 'event' : 'events'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Editing</dt>
                <dd className="mt-0.5 text-sm font-medium">Not permitted</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  )
}

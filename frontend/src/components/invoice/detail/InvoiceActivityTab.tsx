import { useEffect, useState } from 'react'
import { AlertCircle, Clock3 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getInvoiceHistory } from '@/services/invoice'
import type { InvoiceHistoryItem } from '@/types/invoice'

function formatActivityDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function activityDescription(item: InvoiceHistoryItem) {
  if (item.comment) {
    return item.comment
  }

  if (item.fieldName) {
    return `${item.fieldName} changed${item.newValue ? ` to ${item.newValue}` : ''}`
  }

  return item.type.replaceAll('_', ' ').toLowerCase()
}

export function InvoiceActivityTab({ invoiceId }: { invoiceId: number }) {
  const [requestState, setRequestState] = useState<{
    error: boolean
    history: InvoiceHistoryItem[] | null
    requestKey: string
  }>({ error: false, history: null, requestKey: '' })
  const [retryCount, setRetryCount] = useState(0)
  const requestKey = `${invoiceId}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = currentRequest && requestState.error
  const history = currentRequest ? requestState.history : null

  useEffect(() => {
    const controller = new AbortController()

    getInvoiceHistory(invoiceId, controller.signal)
      .then((nextHistory) => {
        setRequestState({ error: false, history: nextHistory, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, history: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [invoiceId, requestKey])

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load activity</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>The other invoice sections remain available.</p>
            <Button onClick={() => setRetryCount((count) => count + 1)} size="sm" type="button" variant="outline">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!history) {
    return (
      <div aria-label="Loading invoice activity" className="space-y-5 p-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex gap-3" key={index}>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Clock3 aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-foreground">No activity yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Status changes and corrections will appear here.
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-0 p-5">
      {history.map((item, index) => (
        <li className="relative flex gap-3 pb-6 last:pb-0" key={`${item.date}-${item.type}-${index}`}>
          {index < history.length - 1 ? (
            <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" />
          ) : null}
          <span className="z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {item.action.replaceAll('_', ' ')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{activityDescription(item)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatActivityDate(item.date)}{item.author ? ` · ${item.author}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

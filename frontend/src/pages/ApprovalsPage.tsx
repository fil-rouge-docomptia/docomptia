import { useEffect, useState } from 'react'
import { AlertCircle, BadgeCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { InvoicePagination } from '@/components/invoice/InvoicePagination'
import { InvoiceTable } from '@/components/invoice/InvoiceTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listPendingValidationInvoices } from '@/services/invoice'
import type {
  InvoiceListItem,
  InvoicePage,
  InvoiceSortField,
  SortDirection,
} from '@/types/invoice'

const PAGE_SIZE = 8
const sortableFields: InvoiceSortField[] = ['createdAt', 'invoiceDate', 'totalTtc']

type ApprovalRequestState = {
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
    : 'invoiceDate'
}

function parseDirection(value: string | null): SortDirection {
  return value?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
}

function formatVisibleAmount(invoices: InvoiceListItem[]) {
  const currencies = new Set(
    invoices.map((invoice) => invoice.currencyCode).filter(Boolean),
  )

  if (currencies.size > 1) {
    return 'Mixed currencies'
  }

  const total = invoices.reduce((sum, invoice) => {
    const amount = Number(invoice.totalTtc)
    return Number.isFinite(amount) ? sum + amount : sum
  }, 0)

  return new Intl.NumberFormat('en-GB', {
    currency: [...currencies][0] ?? 'EUR',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(total)
}

function countOverdueInvoices(invoices: InvoiceListItem[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return invoices.filter((invoice) => {
    if (!invoice.dueDate) {
      return false
    }

    const dueDate = new Date(`${invoice.dueDate}T00:00:00`)
    return !Number.isNaN(dueDate.getTime()) && dueDate < today
  }).length
}

function ApprovalQueueSummary({ invoicePage }: { invoicePage: InvoicePage }) {
  const metrics = [
    { label: 'Awaiting review', value: String(invoicePage.totalElements) },
    { label: 'On this page', value: String(invoicePage.content.length) },
    { label: 'Visible amount', value: formatVisibleAmount(invoicePage.content) },
    { label: 'Overdue on this page', value: String(countOverdueInvoices(invoicePage.content)) },
  ]

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          className={`px-5 py-4 ${index % 2 === 0 ? 'border-r border-border' : ''} ${index < 2 ? 'border-b border-border lg:border-b-0' : ''} ${index > 0 ? 'lg:border-l lg:border-border' : ''} lg:border-r-0`}
          key={metric.label}
        >
          <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
          <dd className="mt-2 text-2xl font-semibold tracking-[-0.5px] text-foreground">
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ApprovalsLoadingState() {
  return (
    <div aria-label="Loading approvals" className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="bg-card px-5 py-4" key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
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
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<ApprovalRequestState>({
    error: false,
    invoicePage: null,
    requestKey: '',
  })
  const currentPage = parsePage(searchParams.get('page'))
  const sortBy = parseSortField(searchParams.get('sortBy'))
  const direction = parseDirection(searchParams.get('direction'))
  const requestKey = `${currentPage}:${sortBy}:${direction}:${retryCount}`
  const isCurrentRequest = requestState.requestKey === requestKey
  const error = isCurrentRequest && requestState.error
  const invoicePage = isCurrentRequest ? requestState.invoicePage : null

  useEffect(() => {
    const controller = new AbortController()

    listPendingValidationInvoices(
      {
        direction,
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
          setRequestState({ error: true, invoicePage: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [currentPage, direction, requestKey, sortBy])

  const updateSearchParams = (updates: Record<string, string>) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      Object.entries(updates).forEach(([key, value]) => nextParams.set(key, value))
      return nextParams
    })
  }

  const handleSortChange = (field: InvoiceSortField) => {
    const nextDirection = sortBy === field && direction === 'ASC' ? 'DESC' : 'ASC'
    updateSearchParams({ direction: nextDirection, page: '1', sortBy: field })
  }

  const getApprovalReviewHref = (invoice: InvoiceListItem, index: number) => {
    const returnTo = `/approvals${searchParams.size ? `?${searchParams.toString()}` : ''}`
    const reviewParams = new URLSearchParams({
      position: String(invoicePage ? invoicePage.number * invoicePage.size + index + 1 : index + 1),
      returnTo,
      total: String(invoicePage?.totalElements ?? 0),
    })

    return `/approvals/${invoice.invoiceId}?${reviewParams.toString()}`
  }

  return (
    <div className="space-y-8">
      <PageHeader
        description="Review invoices awaiting your accounting decision."
        title="Approvals"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load approvals</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Check your connection and permissions, then try again.</p>
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
      ) : !invoicePage ? (
        <ApprovalsLoadingState />
      ) : invoicePage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <BadgeCheck aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">No approvals waiting</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Invoices submitted for validation will appear here.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <ApprovalQueueSummary invoicePage={invoicePage} />
          <section
            aria-label="Approval queue"
            className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1"
          >
            <InvoiceTable
              direction={direction}
              getInvoiceHref={getApprovalReviewHref}
              invoices={invoicePage.content}
              onSortChange={handleSortChange}
              sortBy={sortBy}
            />
            <InvoicePagination
              currentPage={invoicePage.number + 1}
              onPageChange={(page) => updateSearchParams({ page: String(page) })}
              pageSize={invoicePage.size}
              totalElements={invoicePage.totalElements}
              totalPages={invoicePage.totalPages}
            />
          </section>
        </div>
      )}
    </div>
  )
}

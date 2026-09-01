import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DashboardActivityPanel } from '@/components/dashboard/DashboardActivityPanel'
import { DashboardAttentionCard } from '@/components/dashboard/DashboardAttentionCard'
import { DashboardMetricGrid } from '@/components/dashboard/DashboardMetricGrid'
import { DashboardPipeline } from '@/components/dashboard/DashboardPipeline'
import { DashboardRecentInvoices } from '@/components/dashboard/DashboardRecentInvoices'
import { DashboardSpendingOverview } from '@/components/dashboard/DashboardSpendingOverview'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { getDashboardSummary } from '@/services/dashboard'
import { listInvoices } from '@/services/invoice'
import type { DashboardPeriodQuery, DashboardSummary } from '@/types/dashboard'
import type { InvoiceListItem } from '@/types/invoice'

const RECENT_INVOICE_COUNT = 4

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLastThirtyDays(): DashboardPeriodQuery {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 29)

  return {
    endDate: toIsoDate(endDate),
    startDate: toIsoDate(startDate),
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const [summaryRetryCount, setSummaryRetryCount] = useState(0)
  const [recentInvoices, setRecentInvoices] = useState<InvoiceListItem[] | null>(null)
  const [recentInvoicesError, setRecentInvoicesError] = useState(false)
  const [recentInvoicesRetryCount, setRecentInvoicesRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getDashboardSummary(getLastThirtyDays(), controller.signal)
      .then(setSummary)
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setSummaryError(true)
        }
      })

    return () => controller.abort()
  }, [summaryRetryCount])

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction: 'DESC',
        page: 0,
        size: RECENT_INVOICE_COUNT,
        sortBy: 'createdAt',
      },
      controller.signal,
    )
      .then((invoicePage) => setRecentInvoices(invoicePage.content))
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setRecentInvoicesError(true)
        }
      })

    return () => controller.abort()
  }, [recentInvoicesRetryCount])

  const retrySummary = () => {
    setSummary(null)
    setSummaryError(false)
    setSummaryRetryCount((count) => count + 1)
  }
  const retryRecentInvoices = () => {
    setRecentInvoices(null)
    setRecentInvoicesError(false)
    setRecentInvoicesRetryCount((count) => count + 1)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <>
            <Button asChild className="h-11 md:h-10" variant="outline">
              <span>Last 30 days</span>
            </Button>
            <Button asChild className="h-11 md:h-10">
              <Link to="/inbox?upload=1">
                <Upload aria-hidden="true" />
                Upload invoice
              </Link>
            </Button>
          </>
        }
        description="Monitor your invoice processing activity."
        title="Dashboard"
      />

      <DashboardMetricGrid
        error={summaryError}
        onRetry={retrySummary}
        summary={summary}
      />

      <DashboardPipeline
        error={summaryError}
        onRetry={retrySummary}
        statuses={summary?.statusDistribution ?? null}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="order-2 min-w-0 xl:col-start-1 xl:row-start-1">
          <DashboardRecentInvoices
            error={recentInvoicesError}
            invoices={recentInvoices}
            onRetry={retryRecentInvoices}
          />
        </div>
        <aside className="order-1 min-w-0 xl:col-start-2 xl:row-start-1">
          <DashboardAttentionCard
            alerts={summary?.alerts ?? null}
            error={summaryError}
            onRetry={retrySummary}
          />
        </aside>
        <div className="order-3 min-w-0 xl:col-start-1 xl:row-start-2">
          <DashboardSpendingOverview
            error={summaryError}
            onRetry={retrySummary}
            summary={summary}
          />
        </div>
        <div className="order-4 min-w-0 xl:col-start-2 xl:row-start-2">
          <DashboardActivityPanel />
        </div>
      </div>
    </div>
  )
}

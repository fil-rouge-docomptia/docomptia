import { useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { DashboardActivityPanel } from '@/components/dashboard/DashboardActivityPanel'
import { DashboardAttentionCard } from '@/components/dashboard/DashboardAttentionCard'
import { DashboardMetricGrid } from '@/components/dashboard/DashboardMetricGrid'
import { DashboardPeriodSelect } from '@/components/dashboard/DashboardPeriodSelect'
import { DashboardPipeline } from '@/components/dashboard/DashboardPipeline'
import { DashboardRecentInvoices } from '@/components/dashboard/DashboardRecentInvoices'
import { DashboardSpendingOverview } from '@/components/dashboard/DashboardSpendingOverview'
import {
  getDashboardPeriod,
  parseDashboardPeriodPreset,
  type DashboardPeriodPreset,
} from '@/components/dashboard/dashboard-period'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { getDashboardSummary } from '@/services/dashboard'
import { listInvoices } from '@/services/invoice'
import { getCurrentOrganization } from '@/services/organization'
import type { DashboardSummary } from '@/types/dashboard'
import type { InvoiceListItem } from '@/types/invoice'

const RECENT_INVOICE_COUNT = 4
const PERIOD_QUERY_PARAM = 'period'

type RequestState<T> = {
  data: T | null
  error: boolean
  requestKey: string
}

const initialRequestState = {
  data: null,
  error: false,
  requestKey: '',
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const periodPreset = parseDashboardPeriodPreset(searchParams.get(PERIOD_QUERY_PARAM))
  const period = useMemo(() => getDashboardPeriod(periodPreset), [periodPreset])
  const [summaryRetryCount, setSummaryRetryCount] = useState(0)
  const [recentInvoicesRetryCount, setRecentInvoicesRetryCount] = useState(0)
  const summaryRequestKey = `${period.startDate}:${period.endDate}:${summaryRetryCount}`
  const recentInvoicesRequestKey = `${period.startDate}:${period.endDate}:${recentInvoicesRetryCount}`
  const [summaryState, setSummaryState] = useState<RequestState<DashboardSummary>>(initialRequestState)
  const [recentInvoicesState, setRecentInvoicesState] = useState<RequestState<InvoiceListItem[]>>(initialRequestState)
  const [currencyCode, setCurrencyCode] = useState<string | null>(null)
  const [currencyError, setCurrencyError] = useState(false)
  const [currencyRetryCount, setCurrencyRetryCount] = useState(0)
  const summaryIsCurrent = summaryState.requestKey === summaryRequestKey
  const recentInvoicesAreCurrent = recentInvoicesState.requestKey === recentInvoicesRequestKey
  const summary = summaryIsCurrent ? summaryState.data : null
  const summaryError = summaryIsCurrent && summaryState.error
  const recentInvoices = recentInvoicesAreCurrent ? recentInvoicesState.data : null
  const recentInvoicesError = recentInvoicesAreCurrent && recentInvoicesState.error

  useEffect(() => {
    if (searchParams.get(PERIOD_QUERY_PARAM) !== periodPreset) {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set(PERIOD_QUERY_PARAM, periodPreset)
        return nextParams
      }, { replace: true })
    }
  }, [periodPreset, searchParams, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()

    getDashboardSummary(period, controller.signal)
      .then((nextSummary) => setSummaryState({
        data: nextSummary,
        error: false,
        requestKey: summaryRequestKey,
      }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setSummaryState({
            data: null,
            error: true,
            requestKey: summaryRequestKey,
          })
        }
      })

    return () => controller.abort()
  }, [period, summaryRequestKey])

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction: 'DESC',
        endDate: period.endDate,
        page: 0,
        size: RECENT_INVOICE_COUNT,
        sortBy: 'createdAt',
        startDate: period.startDate,
      },
      controller.signal,
    )
      .then((invoicePage) => setRecentInvoicesState({
        data: invoicePage.content,
        error: false,
        requestKey: recentInvoicesRequestKey,
      }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setRecentInvoicesState({
            data: null,
            error: true,
            requestKey: recentInvoicesRequestKey,
          })
        }
      })

    return () => controller.abort()
  }, [period.endDate, period.startDate, recentInvoicesRequestKey])

  useEffect(() => {
    const controller = new AbortController()

    getCurrentOrganization(controller.signal)
      .then((organization) => setCurrencyCode(organization.defaultCurrencyCode ?? 'EUR'))
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setCurrencyError(true)
        }
      })

    return () => controller.abort()
  }, [currencyRetryCount])

  const retrySummary = () => {
    setSummaryRetryCount((count) => count + 1)
  }
  const retryRecentInvoices = () => {
    setRecentInvoicesRetryCount((count) => count + 1)
  }
  const retrySpendingOverview = () => {
    retrySummary()
    setCurrencyCode(null)
    setCurrencyError(false)
    setCurrencyRetryCount((count) => count + 1)
  }
  const selectPeriod = (nextPeriod: DashboardPeriodPreset) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set(PERIOD_QUERY_PARAM, nextPeriod)
      return nextParams
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <DashboardPeriodSelect onValueChange={selectPeriod} value={periodPreset} />
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

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="order-2 min-w-0 xl:col-start-1 xl:row-start-1">
          <DashboardRecentInvoices
            error={recentInvoicesError}
            invoices={recentInvoices}
            onRetry={retryRecentInvoices}
          />
        </div>
        <aside
          className="order-1 min-w-0 scroll-mt-6 xl:col-start-2 xl:row-start-1"
          id="processing-issues"
        >
          <DashboardAttentionCard
            alerts={summary?.alerts ?? null}
            error={summaryError}
            onRetry={retrySummary}
          />
        </aside>
        <div className="order-3 min-w-0 xl:col-start-1 xl:row-start-2">
          <DashboardSpendingOverview
            currencyCode={currencyCode}
            error={summaryError || currencyError}
            onRetry={retrySpendingOverview}
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

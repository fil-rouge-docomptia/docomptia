import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  getDashboardPeriod,
  parseDashboardPeriodPreset,
  type DashboardPeriodPreset,
} from '@/components/dashboard/dashboard-period'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReportFilters } from '@/components/report/ReportFilters'
import { ReportSummary } from '@/components/report/ReportSummary'
import { getReportInvoiceListHref } from '@/components/report/report-navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDashboardSummary } from '@/services/dashboard'
import { getCurrentOrganization } from '@/services/organization'
import type { DashboardSummary } from '@/types/dashboard'

const PERIOD_QUERY_PARAM = 'period'

type ReportData = {
  currencyCode: string
  summary: DashboardSummary
}

type ReportRequestState = {
  data: ReportData | null
  error: boolean
  requestKey: string
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function ReportLoadingState() {
  return (
    <div aria-label="Loading reports" className="space-y-8">
      {[4, 2, 3].map((cardCount, sectionIndex) => (
        <section className="space-y-4" key={cardCount}>
          <div>
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-1 h-4 w-full max-w-80" />
          </div>
          <div
            className={sectionIndex === 1
              ? 'grid gap-4 xl:grid-cols-2'
              : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'}
          >
            {Array.from({ length: cardCount }, (_, index) => (
              <Card className="h-[124px] p-4 shadow-elevation-1" key={index}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-9 w-20" />
                <Skeleton className="mt-3 h-5 w-28" />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const periodPreset = parseDashboardPeriodPreset(searchParams.get(PERIOD_QUERY_PARAM))
  const period = useMemo(() => getDashboardPeriod(periodPreset), [periodPreset])
  const [retryCount, setRetryCount] = useState(0)
  const requestKey = `${period.startDate}:${period.endDate}:${retryCount}`
  const [requestState, setRequestState] = useState<ReportRequestState>({
    data: null,
    error: false,
    requestKey: '',
  })
  const requestIsCurrent = requestState.requestKey === requestKey
  const data = requestIsCurrent ? requestState.data : null
  const error = requestIsCurrent && requestState.error

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

    Promise.all([
      getDashboardSummary(period, controller.signal),
      getCurrentOrganization(controller.signal),
    ])
      .then(([summary, organization]) => {
        setRequestState({
          data: {
            currencyCode: organization.defaultCurrencyCode ?? 'EUR',
            summary,
          },
          error: false,
          requestKey,
        })
      })
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) {
          setRequestState({ data: null, error: true, requestKey })
        }
      })

    return () => controller.abort()
  }, [period, requestKey])

  const selectPeriod = (nextPeriod: DashboardPeriodPreset) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set(PERIOD_QUERY_PARAM, nextPeriod)
      return nextParams
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={(
          <Button disabled title="Report export is not supported by the API yet">
            <Download aria-hidden="true" />
            Export report
          </Button>
        )}
        description="Operational analytics for invoice processing, spending and controls."
        title="Reports"
      />

      <ReportFilters onPeriodChange={selectPeriod} period={periodPreset} />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load reports</AlertTitle>
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
      ) : !data ? (
        <ReportLoadingState />
      ) : data.summary.totals.invoiceCount === 0 ? (
        <section className="flex justify-center pt-4">
          <Card className="flex min-h-64 w-full max-w-xl flex-col items-center justify-center p-10 text-center shadow-elevation-1">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <BarChart3 aria-hidden="true" className="size-6" />
            </span>
            <Badge variant="secondary">No data</Badge>
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.25px] text-foreground">
              No report data for this period
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Select another date range or review the detailed invoice list.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link to={getReportInvoiceListHref(period)}>View invoices</Link>
            </Button>
          </Card>
        </section>
      ) : (
        <ReportSummary
          currencyCode={data.currencyCode}
          period={period}
          periodPreset={periodPreset}
          summary={data.summary}
        />
      )}
    </div>
  )
}

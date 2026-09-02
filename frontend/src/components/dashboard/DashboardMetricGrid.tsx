import { Link } from 'react-router-dom'

import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardSummary } from '@/types/dashboard'

type DashboardMetricGridProps = {
  error: boolean
  onRetry: () => void
  summary: DashboardSummary | null
}

type Metric = {
  href?: string
  label: string
  value: number
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card className="h-[124px] shadow-elevation-1">
      <div className="flex h-full flex-col p-4">
        <p className="text-sm leading-5 text-muted-foreground">{metric.label}</p>
        <p className="text-3xl font-semibold leading-9 tracking-[-0.75px] text-foreground">
          {metric.value.toLocaleString('en-GB')}
        </p>
        {metric.href ? (
          <Link
            className="mt-auto flex h-10 w-fit items-center rounded-md px-2 text-sm font-medium text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            to={metric.href}
          >
            View filtered list
          </Link>
        ) : (
          <span className="mt-auto flex h-10 w-fit items-center rounded-md px-2 text-sm font-medium text-primary">
            View filtered list
          </span>
        )}
      </div>
    </Card>
  )
}

function MetricSkeleton() {
  return (
    <Card aria-label="Loading dashboard metric" className="h-[124px] p-4 shadow-elevation-1">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-9 w-14" />
      <Skeleton className="mt-3 h-5 w-28" />
    </Card>
  )
}

export function DashboardMetricGrid({
  error,
  onRetry,
  summary,
}: DashboardMetricGridProps) {
  const metrics: Metric[] = summary
    ? [
        {
          href: '/invoices?status=DEPOSEE',
          label: 'To process',
          value: summary.workQueues.toProcess,
        },
        {
          href: '/invoices?status=A_VERIFIER',
          label: 'Waiting for approval',
          value: summary.workQueues.awaitingValidation,
        },
        {
          href: '/invoices?status=EXPORTABLE',
          label: 'Ready to export',
          value: summary.workQueues.exportable,
        },
        {
          label: 'Processing issues',
          value:
            summary.alerts.ocrErrors +
            summary.alerts.pendingDuplicates +
            summary.alerts.unbalancedAccountingEntries,
        },
      ]
    : []

  if (error) {
    return (
      <Card className="col-span-full min-h-[124px] shadow-elevation-1">
        <DashboardBlockError
          message="Invoice indicators are unavailable."
          onRetry={onRetry}
        />
      </Card>
    )
  }

  return (
    <section
      aria-label="Invoice indicators"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {summary
        ? metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)
        : Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
    </section>
  )
}

import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import {
  DashboardSectionAction,
  DashboardSectionHeader,
} from '@/components/dashboard/DashboardSectionHeader'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardSummary } from '@/types/dashboard'

type DashboardSpendingOverviewProps = {
  error: boolean
  onRetry: () => void
  summary: DashboardSummary | null
}

const numberFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatPeriod(summary: DashboardSummary) {
  if (!summary.period.startDate || !summary.period.endDate) {
    return 'Selected period'
  }

  return `${summary.period.startDate} – ${summary.period.endDate}`
}

export function DashboardSpendingOverview({
  error,
  onRetry,
  summary,
}: DashboardSpendingOverviewProps) {
  const rows = summary
    ? [
        { label: 'Excluding tax', value: Number(summary.totals.totalHt) },
        { label: 'VAT', value: Number(summary.totals.totalTva) },
        { label: 'Including tax', value: Number(summary.totals.totalTtc) },
      ]
    : []
  const maximum = Math.max(...rows.map((row) => row.value), 0)

  return (
    <section aria-labelledby="dashboard-spending-title" className="min-w-0 max-w-full">
      <DashboardSectionHeader
        action={<DashboardSectionAction>View report</DashboardSectionAction>}
        description="Invoice totals over the selected period."
        title="Spending overview"
        titleId="dashboard-spending-title"
      />
      <Card className="min-h-[172px] min-w-0 max-w-full p-4 shadow-elevation-1">
        {error ? (
          <DashboardBlockError
            message="Spending totals are unavailable."
            onRetry={onRetry}
          />
        ) : !summary ? (
          <div aria-label="Loading spending overview">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-8 w-28" />
            <div className="mt-3 space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton className="h-4 w-full" key={index} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total invoice amount</p>
                <p className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-foreground">
                  {numberFormatter.format(Number(summary.totals.totalTtc))}
                </p>
              </div>
              <span className="text-right text-xs text-muted-foreground">{formatPeriod(summary)}</span>
            </div>
            <div className="mt-2 space-y-2">
              {rows.map((row) => (
                <div className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3" key={row.label}>
                  <span className="text-xs font-medium text-foreground">{row.label}</span>
                  <span className="h-2 overflow-hidden rounded-sm bg-muted">
                    <span
                      className="block h-full rounded-sm bg-primary"
                      style={{ width: maximum === 0 ? '0%' : `${(row.value / maximum) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-xs font-medium text-foreground">
                    {numberFormatter.format(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  )
}

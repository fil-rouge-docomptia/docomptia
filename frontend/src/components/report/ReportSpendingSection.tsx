import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader'
import { Card } from '@/components/ui/card'
import type { DashboardSummary } from '@/types/dashboard'

type ReportSpendingSectionProps = {
  currencyCode: string
  summary: DashboardSummary
}

const periodDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatAmount(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat('en-GB', {
      currency: currencyCode,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      style: 'currency',
    }).format(value)
  } catch {
    return `${value.toLocaleString('en-GB')} ${currencyCode}`
  }
}

function formatPeriodDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : periodDateFormatter.format(date)
}

function formatPeriod(summary: DashboardSummary) {
  const { endDate, startDate } = summary.period
  if (!startDate || !endDate) {
    return 'Selected period'
  }

  return `${formatPeriodDate(startDate)} – ${formatPeriodDate(endDate)}`
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function ReportSpendingSection({
  currencyCode,
  summary,
}: ReportSpendingSectionProps) {
  const totalHt = Number(summary.totals.totalHt)
  const totalTva = Number(summary.totals.totalTva)
  const totalTtc = Number(summary.totals.totalTtc)
  const rows = [
    { label: 'Excluding tax', value: totalHt },
    { label: 'VAT', value: totalTva },
    { label: 'Including tax', value: totalTtc },
  ]
  const maximum = Math.max(...rows.map((row) => row.value), 0)
  const netPercentage = totalTtc > 0 ? clampPercentage((totalHt / totalTtc) * 100) : 0
  const vatPercentage = totalTtc > 0 ? clampPercentage((totalTva / totalTtc) * 100) : 0

  return (
    <section aria-labelledby="report-spending-title">
      <DashboardSectionHeader
        description="Invoice totals for the selected date range."
        title="Spending"
        titleId="report-spending-title"
      />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-4 shadow-elevation-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Spending overview</p>
              <p className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-foreground">
                {formatAmount(totalTtc, currencyCode)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{formatPeriod(summary)}</span>
          </div>

          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div
                className="grid grid-cols-[5.5rem_minmax(3rem,1fr)_auto] items-center gap-2 sm:grid-cols-[6.5rem_1fr_6.5rem] sm:gap-3"
                key={row.label}
              >
                <span className="text-xs font-medium text-foreground">{row.label}</span>
                <span className="h-2 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full rounded-sm bg-primary"
                    style={{ width: maximum === 0 ? '0%' : `${(row.value / maximum) * 100}%` }}
                  />
                </span>
                <span className="text-right text-xs font-medium text-foreground">
                  {formatAmount(row.value, currencyCode)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 p-4 shadow-elevation-1">
          <p className="text-xs text-muted-foreground">Spending breakdown</p>
          <p className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-foreground">
            {formatAmount(totalTtc, currencyCode)}
          </p>
          <div
            aria-label={`Spending breakdown: ${netPercentage.toFixed(1)}% excluding tax and ${vatPercentage.toFixed(1)}% VAT`}
            className="mt-5 flex h-3 overflow-hidden rounded-sm bg-muted"
            role="img"
          >
            <span className="h-full bg-primary" style={{ width: `${netPercentage}%` }} />
            <span className="h-full bg-accent-foreground" style={{ width: `${vatPercentage}%` }} />
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Excluding tax</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatAmount(totalHt, currencyCode)}
              </dd>
            </div>
            <div className="rounded-md bg-accent p-3">
              <dt className="text-xs text-accent-foreground">VAT</dt>
              <dd className="mt-1 text-sm font-semibold text-accent-foreground">
                {formatAmount(totalTva, currencyCode)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </section>
  )
}

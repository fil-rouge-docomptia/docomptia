import { Link } from 'react-router-dom'

import { Card } from '@/components/ui/card'

export type ReportMetric = {
  actionLabel: string
  href: string
  label: string
  value: number
}

type ReportMetricGridProps = {
  ariaLabel: string
  columns?: 3 | 4
  metrics: ReportMetric[]
}

export function ReportMetricGrid({
  ariaLabel,
  columns = 4,
  metrics,
}: ReportMetricGridProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={columns === 3
        ? 'grid grid-cols-1 gap-4 md:grid-cols-3'
        : 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'}
      role="group"
    >
      {metrics.map((metric) => (
        <Card className="min-h-[124px] shadow-elevation-1" key={metric.label}>
          <div className="flex h-full min-h-[122px] flex-col p-4">
            <p className="text-sm leading-5 text-muted-foreground">{metric.label}</p>
            <p className="text-3xl font-semibold leading-9 tracking-[-0.75px] text-foreground">
              {metric.value.toLocaleString('en-GB')}
            </p>
            <Link
              className="mt-auto flex h-10 w-fit items-center rounded-md px-2 text-sm font-medium text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              to={metric.href}
            >
              {metric.actionLabel}
            </Link>
          </div>
        </Card>
      ))}
    </div>
  )
}

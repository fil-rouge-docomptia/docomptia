import { Link } from 'react-router-dom'

import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import { getDashboardInvoiceListHref } from '@/components/dashboard/dashboard-navigation'
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardPeriodQuery, DashboardStatusCount } from '@/types/dashboard'

type DashboardPipelineProps = {
  error: boolean
  onRetry: () => void
  period: DashboardPeriodQuery
  statuses: DashboardStatusCount[] | null
}

const pipelineSteps = [
  { label: 'To process', status: 'DEPOSEE' },
  { label: 'Processing', status: 'OCR_EN_COURS' },
  { label: 'Needs review', status: 'EXTRAITE' },
  { label: 'Waiting for approval', status: 'A_VERIFIER' },
  { label: 'Approved', status: 'VALIDEE' },
  { label: 'Ready to export', status: 'EXPORTABLE' },
  { label: 'Exported', status: 'EXPORTEE' },
] as const

function selectPipelineStatuses(statuses: DashboardStatusCount[]) {
  const countsByStatus = new Map(statuses.map((status) => [status.status, status.count]))

  return pipelineSteps.flatMap((step) => {
    const count = countsByStatus.get(step.status)
    return count === undefined ? [] : [{ ...step, count }]
  })
}

export function DashboardPipeline({
  error,
  onRetry,
  period,
  statuses,
}: DashboardPipelineProps) {
  const pipelineStatuses = statuses ? selectPipelineStatuses(statuses) : null
  const hasInvoices = pipelineStatuses?.some((status) => status.count > 0) ?? false

  return (
    <section aria-labelledby="dashboard-pipeline-title" className="min-w-0 max-w-full">
      <DashboardSectionHeader
        action={(
          <Button asChild className="bg-accent text-accent-foreground" variant="ghost">
            <Link to="/invoices">View invoices</Link>
          </Button>
        )}
        description="Live distribution across the invoice processing lifecycle."
        title="Invoice processing pipeline"
        titleId="dashboard-pipeline-title"
      />
      <Card
        className={error
          ? 'min-h-[140px] overflow-hidden shadow-elevation-1'
          : 'h-[100px] overflow-hidden shadow-elevation-1'}
      >
        {error ? (
          <DashboardBlockError
            message="The processing pipeline is unavailable."
            onRetry={onRetry}
          />
        ) : !pipelineStatuses ? (
          <div aria-label="Loading invoice processing pipeline" className="flex h-full items-center gap-5 overflow-hidden px-4">
            {Array.from({ length: 7 }, (_, index) => (
              <div className="flex min-w-28 flex-col items-center gap-3" key={index}>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        ) : !hasInvoices ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            No invoices in the selected period.
          </div>
        ) : (
          <div className="h-full min-w-0 max-w-full overflow-x-auto">
            <div className="flex h-full min-w-max items-start gap-2 p-4">
              {pipelineStatuses.map((status, index) => (
                <div className="flex items-start gap-2" key={status.status}>
                  {index > 0 ? <Separator className="w-6" /> : null}
                  <Link
                    aria-label={`View ${status.label} invoices`}
                    className="flex min-w-28 flex-col items-center gap-1 rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    to={getDashboardInvoiceListHref(status.status, period)}
                  >
                    <span className="p-2">
                      <InvoiceStatusBadge label={status.label} status={status.status} />
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {status.count.toLocaleString('en-GB')}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

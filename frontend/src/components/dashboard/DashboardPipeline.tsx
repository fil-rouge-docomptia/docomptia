import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import {
  DashboardSectionAction,
  DashboardSectionHeader,
} from '@/components/dashboard/DashboardSectionHeader'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardStatusCount } from '@/types/dashboard'

type DashboardPipelineProps = {
  error: boolean
  onRetry: () => void
  statuses: DashboardStatusCount[] | null
}

const statusOrder = [
  'DEPOSEE',
  'OCR_EN_COURS',
  'EXTRAITE',
  'A_VERIFIER',
  'VALIDEE',
  'EXPORTABLE',
  'EXPORTEE',
]

function sortStatuses(statuses: DashboardStatusCount[]) {
  return [...statuses].sort((left, right) => {
    const leftIndex = statusOrder.indexOf(left.status)
    const rightIndex = statusOrder.indexOf(right.status)

    return (leftIndex === -1 ? statusOrder.length : leftIndex) -
      (rightIndex === -1 ? statusOrder.length : rightIndex)
  })
}

export function DashboardPipeline({
  error,
  onRetry,
  statuses,
}: DashboardPipelineProps) {
  const sortedStatuses = statuses ? sortStatuses(statuses) : null

  return (
    <section aria-labelledby="dashboard-pipeline-title" className="min-w-0 max-w-full">
      <DashboardSectionHeader
        action={<DashboardSectionAction>View invoices</DashboardSectionAction>}
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
        ) : !sortedStatuses ? (
          <div aria-label="Loading invoice processing pipeline" className="flex h-full items-center gap-5 overflow-hidden px-4">
            {Array.from({ length: 7 }, (_, index) => (
              <div className="flex min-w-28 flex-col items-center gap-3" key={index}>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        ) : sortedStatuses.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            No invoices in the selected period.
          </div>
        ) : (
          <div className="h-full min-w-0 max-w-full overflow-x-auto">
            <div className="flex h-full min-w-max items-center px-4">
              {sortedStatuses.map((status, index) => (
                <div className="flex items-center" key={status.status}>
                  {index > 0 ? <span aria-hidden="true" className="mx-2 h-px w-6 bg-border" /> : null}
                  <div className="flex min-w-28 flex-col items-center gap-3">
                    <InvoiceStatusBadge status={status.status} />
                    <span className="text-xs font-medium text-foreground">
                      {status.count.toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

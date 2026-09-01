import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardAlerts } from '@/types/dashboard'

type DashboardAttentionCardProps = {
  alerts: DashboardAlerts | null
  error: boolean
  onRetry: () => void
}

export function DashboardAttentionCard({
  alerts,
  error,
  onRetry,
}: DashboardAttentionCardProps) {
  if (error) {
    return (
      <Card className="min-h-[260px] min-w-0 shadow-elevation-1">
        <DashboardBlockError
          message="Attention items are unavailable."
          onRetry={onRetry}
        />
      </Card>
    )
  }

  return (
    <Card className="min-h-[260px] min-w-0 p-4 shadow-elevation-1">
      <h2 className="text-lg font-semibold leading-7 text-foreground">Attention required</h2>
      <p className="text-xs leading-4 text-muted-foreground">
        Items that need intervention before accounting.
      </p>

      {!alerts ? (
        <div aria-label="Loading attention items" className="mt-3 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="flex items-center gap-3" key={index}>
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : alerts.ocrErrors === 0 &&
        alerts.pendingDuplicates === 0 &&
        alerts.unbalancedAccountingEntries === 0 ? (
        <div className="mt-7 rounded-md bg-success-muted px-4 py-3 text-sm text-success">
          No issues require attention.
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          {alerts.unbalancedAccountingEntries > 0 ? (
            <AttentionItem
              count={alerts.unbalancedAccountingEntries}
              label="unbalanced accounting entries require correction"
            />
          ) : null}
          {alerts.pendingDuplicates > 0 ? (
            <AttentionItem
              count={alerts.pendingDuplicates}
              label="possible duplicate invoices detected"
            />
          ) : null}
          {alerts.ocrErrors > 0 ? (
            <AttentionItem
              count={alerts.ocrErrors}
              destructive
              label="invoices failed OCR processing"
            />
          ) : null}
        </div>
      )}

      <span className="mt-1 flex h-10 items-center text-sm font-medium text-primary">
        Review all issues
      </span>
    </Card>
  )
}

type AttentionItemProps = {
  count: number
  destructive?: boolean
  label: string
}

function AttentionItem({ count, destructive = false, label }: AttentionItemProps) {
  return (
    <div className="flex min-h-9 items-center gap-3 text-xs font-medium text-foreground">
      <Badge
        className={
          destructive
            ? 'min-w-7 justify-center border-0 bg-destructive px-2 text-destructive-foreground'
            : 'min-w-7 justify-center border-0 bg-warning-muted px-2 text-warning-muted-foreground'
        }
      >
        {count}
      </Badge>
      <span>{`${count} ${label}`}</span>
    </div>
  )
}

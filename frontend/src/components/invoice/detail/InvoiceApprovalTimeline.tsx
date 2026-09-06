import {
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { InvoiceHistoryItem } from '@/types/invoice'

import {
  formatApprovalDate,
  type InvoiceApprovalHistoryContext,
} from './invoice-approval-utils'

type ApprovalTimelineState = 'rejected' | 'waiting'
type ApprovalStepState = 'completed' | 'current' | 'pending' | 'rejected'

function getInitials(author?: string | null) {
  if (!author) {
    return '—'
  }

  return author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function ApprovalStep({
  detail,
  item,
  state,
  title,
}: {
  detail?: string
  item: InvoiceHistoryItem | null
  state: ApprovalStepState
  title: string
}) {
  const stateConfig = {
    completed: {
      badgeClassName: 'border-success/20 bg-success-muted text-success',
      Icon: CheckCircle2,
      label: 'Completed',
    },
    current: {
      badgeClassName: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
      Icon: Clock3,
      label: 'Current',
    },
    pending: {
      badgeClassName: 'border-border bg-secondary text-secondary-foreground',
      Icon: Clock3,
      label: 'Pending',
    },
    rejected: {
      badgeClassName: 'border-destructive/20 bg-destructive/10 text-destructive-text',
      Icon: XCircle,
      label: 'Rejected',
    },
  }[state]
  const { Icon } = stateConfig

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {getInitials(item?.author)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {detail ?? formatApprovalDate(item?.date)}
            </p>
          </div>
        </div>
        <Badge
          className={`gap-1.5 self-start sm:self-center ${stateConfig.badgeClassName}`}
          variant="outline"
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {stateConfig.label}
        </Badge>
      </div>
    </li>
  )
}

export function InvoiceApprovalTimeline({
  context,
  state,
}: {
  context: InvoiceApprovalHistoryContext
  state: ApprovalTimelineState
}) {
  const requestedDetail = context.requested
    ? `${context.requested.author ?? 'Unknown user'} · requested ${formatApprovalDate(
        context.requested.date,
        false,
      )}`
    : 'Submission details not available'
  const rejectedDetail = context.rejected
    ? `${context.rejected.author ?? 'Unknown user'} · ${formatApprovalDate(context.rejected.date)}`
    : 'Decision details not available'

  return (
    <section aria-labelledby="approval-timeline-title">
      <h3 className="text-base font-semibold text-foreground" id="approval-timeline-title">
        Approval timeline
      </h3>
      <ol className="mt-3 space-y-2">
        <ApprovalStep item={context.uploaded} state="completed" title="Uploaded" />
        <Separator asChild>
          <li aria-hidden="true" className="mx-2" />
        </Separator>
        <ApprovalStep item={context.reviewed} state="completed" title="Reviewed" />
        <Separator asChild>
          <li aria-hidden="true" className="mx-2" />
        </Separator>
        <ApprovalStep
          detail={requestedDetail}
          item={context.requested}
          state={state === 'waiting' ? 'current' : 'completed'}
          title="Approval requested"
        />
        <Separator asChild>
          <li aria-hidden="true" className="mx-2" />
        </Separator>
        {state === 'waiting' ? (
          <ApprovalStep
            detail="Waiting for approver"
            item={null}
            state="pending"
            title="Approved"
          />
        ) : (
          <ApprovalStep
            detail={rejectedDetail}
            item={context.rejected}
            state="rejected"
            title="Rejected"
          />
        )}
      </ol>
    </section>
  )
}

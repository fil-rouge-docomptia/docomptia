import { useId, useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InvoiceHistoryItem } from '@/types/invoice'

import { activityAuthor, activityFieldLabel, activityTitle, activityValue } from './invoice-activity-utils'
import { formatApprovalDate } from './invoice-approval-utils'

export function InvoiceActivityEvent({ item }: { item: InvoiceHistoryItem }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const author = activityAuthor(item)
  const title = activityTitle(item)
  const initials = item.author?.trim().split(/\s+/)
    .slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const hasValues = item.fieldName !== null || item.oldValue !== null || item.newValue !== null

  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Avatar aria-hidden="true" className="size-9 shrink-0">
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
            {initials || '—'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 basis-40 break-words">
          <p className="text-sm text-foreground">
            {author} · {title}
            {item.type === 'CORRECTION' && hasValues
              ? ` from ${activityValue(item.oldValue)} to ${activityValue(item.newValue)}`
              : ''}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <time dateTime={item.date || undefined}>{formatApprovalDate(item.date)}</time>
          </p>
        </div>
        <Button
          aria-controls={detailsId}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'View'} details: ${title}`}
          className="h-11 bg-accent text-accent-foreground sm:h-10"
          onClick={() => setExpanded((value) => !value)}
          variant="ghost"
        >
          {expanded ? 'Hide details' : 'View details'}
        </Button>
      </div>
      <section
        aria-label={`${title} details`}
        className="space-y-3 rounded-lg border border-border bg-muted p-4"
        hidden={!expanded}
        id={detailsId}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold">{hasValues ? 'Change details' : 'Event details'}</h4>
          <Badge variant="outline">Read-only</Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-3 break-words text-sm sm:grid-cols-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-0.5 [&_dd]:whitespace-pre-wrap [&_dd]:font-medium">
          {item.fieldName ? (
            <div className="min-w-0 sm:col-span-2">
              <dt>Field</dt>
              <dd>{activityFieldLabel(item.fieldName)}</dd>
            </div>
          ) : null}
          {hasValues ? (
            <>
              <div className="min-w-0">
                <dt>Previous value</dt>
                <dd>{activityValue(item.oldValue)}</dd>
              </div>
              <div className="min-w-0">
                <dt>New value</dt>
                <dd>{activityValue(item.newValue)}</dd>
              </div>
            </>
          ) : null}
          <div className="min-w-0">
            <dt>User</dt>
            <dd>{author}</dd>
          </div>
          <div className="min-w-0">
            <dt>Timestamp</dt>
            <dd><time dateTime={item.date || undefined}>{formatApprovalDate(item.date)}</time></dd>
          </div>
          {item.comment ? (
            <div className="min-w-0 sm:col-span-2">
              <dt>Comment / reason</dt>
              <dd>{item.comment}</dd>
            </div>
          ) : null}
          {item.duplicateAlertId !== null ? (
            <div className="min-w-0">
              <dt>Duplicate alert</dt>
              <dd>#{item.duplicateAlertId}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </article>
  )
}
